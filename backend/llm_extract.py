"""
LLM-based fact extraction and relationship reconciliation — Cohere optimised.

Extraction  : page-grouped batches, ~30 chunks/call, 6.5 s rate-limit window
Reconciliation: concurrent with a semaphore (max 3 in-flight), deduped before calling
"""

import json
import os
import re
import time
import threading
import cohere
from extract_pdf import Chunk

COHERE_API_KEY = os.environ.get("COHERE_API_KEY", "")
MODEL = "command-r-08-2024"

def _get_client():
    key = os.environ.get("COHERE_API_KEY", "")
    if not key:
        return None
    return cohere.ClientV2(api_key=key)

# ── rate limiter (shared across extraction + reconciliation) ─────────────────
_rl_lock = threading.Lock()
_last_call: float = 0.0
MIN_INTERVAL = 2.5   # Cohere free tier: ~20 calls/min


def _rate_wait():
    with _rl_lock:
        global _last_call
        wait = MIN_INTERVAL - (time.time() - _last_call)
        if wait > 0:
            time.sleep(wait)
        _last_call = time.time()


def _chat(prompt: str, max_tokens: int = 4096) -> str | None:
    """Single Cohere chat call using official SDK with retry."""
    _rate_wait()
    client = _get_client()
    if not client:
        print("[llm_extract] no cohere client — missing API key")
        return None
    for attempt in range(3):
        try:
            res = client.chat(
                model=MODEL,
                messages=[{"role": "user", "content": prompt}],
                max_tokens=max_tokens,
                temperature=0.1,
            )
            text = res.message.content[0].text
            print(f"[llm_extract] response OK, len={len(text)}")
            return text
        except cohere.errors.TooManyRequestsError:
            wait = 60 * (attempt + 1)
            print(f"[llm_extract] 429 rate limit, waiting {wait}s")
            time.sleep(wait)
        except Exception as e:
            print(f"[llm_extract] attempt {attempt+1} error: {str(e)[:120]}")
            if attempt < 2:
                time.sleep(5)
    return None


# ── chunk filtering ───────────────────────────────────────────────────────────

_FACT_RE = re.compile(
    r"(revenue|profit|loss|ebitda|margin|growth|appoint|resign|director|"
    r"crore|million|billion|percent|gdp|inflation|cagr|shipment|customer|"
    r"employee|workforce|volume|quarter|annual|fy\d|rbi|imf|cpi|repo|gdp)",
    re.IGNORECASE,
)


def _is_useful(chunk: Chunk) -> bool:
    if len(chunk.text) < 50:
        return False
    if chunk.chunk_type == "heading":
        return False
    return bool(re.search(r"\d[\d,\.]+", chunk.text)) or bool(_FACT_RE.search(chunk.text))


def _dedupe_chunks(chunks: list[Chunk]) -> list[Chunk]:
    seen: set[str] = set()
    out: list[Chunk] = []
    for c in chunks:
        key = c.text[:80].lower().strip()
        if key not in seen:
            seen.add(key)
            out.append(c)
    return out


def select_chunks(chunks: list[Chunk]) -> list[Chunk]:
    return _dedupe_chunks([c for c in chunks if _is_useful(c)])


# ── extraction ────────────────────────────────────────────────────────────────

FACT_SCHEMA = """{
  "facts": [
    {
      "subject": "short label",
      "value": "number or brief description (no unit here)",
      "unit": "INR million | % | shares | etc. or null",
      "period": "FY24 | Q4 FY24 | 2024-25 | null",
      "scope": "consolidated | standalone | segment | null",
      "entity": "company or person name or null",
      "fact_type": "financial_metric | operational_metric | macro_indicator | governance_event | personnel_appointment | personnel_resignation | director_status | company_description | risk_factor | customer_metric | workforce_metric | esg_metric | technology_capability",
      "estimate_or_actual": "actual | estimate | projection | provisional | unknown",
      "as_of_date": "YYYY-MM-DD or plain date or null",
      "evidence_snippet": "verbatim 1-3 sentence quote",
      "confidence": 0.85
    }
  ]
}"""

_SYSTEM = (
    "You are a precise fact extractor for financial and economic documents. "
    "Return only valid JSON. Never hallucinate — extract only what is stated."
)


def extract_facts_from_chunks(
    chunks: list[Chunk],
    source_doc: str,
    doc_context: str = "",
    batch_size: int = 20,
    on_batch_done: callable = None,
    on_progress: callable = None,
) -> list[dict]:
    """
    Extract facts from fact-dense chunks.

    on_batch_done(facts)  — called after each batch is committed
    on_progress(done, total) — called after each batch for progress reporting
    """
    selected = select_chunks(chunks)
    total = (len(selected) + batch_size - 1) // batch_size if selected else 0
    print(f"[llm_extract] {len(chunks)} raw → {len(selected)} useful → {total} batches")

    if on_progress:
        on_progress(0, total)

    all_facts: list[dict] = []
    for i in range(0, len(selected), batch_size):
        batch = selected[i : i + batch_size]
        n = i // batch_size + 1
        print(f"[llm_extract] batch {n}/{total}")
        facts = _extract_batch(batch, source_doc, doc_context)
        all_facts.extend(facts)
        if on_batch_done and facts:
            on_batch_done(facts)
        if on_progress:
            on_progress(n, total)

    return all_facts


def _extract_batch(chunks: list[Chunk], source_doc: str, doc_context: str) -> list[dict]:
    ctx = f"[{doc_context}]\n\n" if doc_context else ""
    text_block = "\n\n".join(
        f"[Page {c.page}] {c.text}" for c in chunks
    )
    prompt = (
        f"{ctx}Extract ALL meaningful facts from the text below.\n"
        f"Document: {source_doc}\n\n"
        "Rules:\n"
        "- Only extract facts clearly stated in the text.\n"
        "- Director appointments/resignations → set as_of_date.\n"
        "- Financial figures → set scope (standalone/consolidated).\n"
        "- advance estimate / projected / forecast → estimate_or_actual = estimate.\n"
        "- evidence_snippet must be verbatim text from the document.\n"
        "- Omit facts with confidence < 0.5.\n\n"
        f"Text:\n{text_block}\n\n"
        f"Return ONLY this JSON (no markdown fences):\n{FACT_SCHEMA}"
    )

    raw = _chat(prompt, max_tokens=4096)
    if not raw:
        return []

    return _parse_facts(raw, source_doc, chunks)


def _parse_facts(raw: str, source_doc: str, chunks: list[Chunk]) -> list[dict]:
    try:
        print(f"[llm_extract] raw response (first 400): {raw[:400]}")
        # strip markdown fences
        raw = re.sub(r"^```(?:json)?\s*", "", raw.strip())
        raw = re.sub(r"\s*```\s*$", "", raw.strip())
        raw = raw.strip()
        # find the outermost JSON object
        start = raw.find("{")
        end = raw.rfind("}") + 1
        if start == -1 or end == 0:
            print(f"[llm_extract] no JSON object found in response")
            return []
        raw = raw[start:end]
        data = json.loads(raw)
        out = []
        for fact in data.get("facts", []):
            if not fact.get("subject"):
                continue
            if not fact.get("evidence_snippet"):
                continue
            try:
                conf = float(fact.get("confidence", 0.7))
            except (TypeError, ValueError):
                conf = 0.7
            if conf < 0.4:
                continue
            fact["source_doc"] = source_doc
            fact["page"] = _find_page(fact.get("evidence_snippet", ""), chunks)
            out.append(fact)
        print(f"[llm_extract]   → {len(out)} facts parsed")
        return out
    except Exception as e:
        print(f"[llm_extract] parse error: {e} | raw[:300]: {raw[:300]}")
        return []


def _find_page(snippet: str, chunks: list[Chunk]) -> int | None:
    if not snippet or not chunks:
        return chunks[0].page if chunks else None

    snippet_lower = snippet.lower().strip()

    # try progressively shorter needles until we get a match
    for length in [80, 50, 30, 15]:
        needle = snippet_lower[:length]
        if not needle.strip():
            continue
        for c in chunks:
            if needle in c.text.lower():
                return c.page

    # fallback: find which page has the most words from the snippet
    words = set(snippet_lower.split())
    if len(words) < 3:
        return chunks[0].page
    best_page, best_score = chunks[0].page, 0
    page_scores: dict[int, int] = {}
    for c in chunks:
        txt = c.text.lower()
        score = sum(1 for w in words if w in txt)
        if score > page_scores.get(c.page, 0):
            page_scores[c.page] = score
    if page_scores:
        best_page = max(page_scores, key=page_scores.get)  # type: ignore
    return best_page


# ── reconciliation ────────────────────────────────────────────────────────────
# Concurrent: up to 3 LLM calls in-flight, respecting the shared rate limiter.

_recon_sem = threading.Semaphore(5)


def reconcile_fact_pair(fact_a: dict, fact_b: dict) -> dict:
    """Classify relationship between two candidate facts. Thread-safe."""
    def _fmt(f: dict) -> str:
        return (
            f"  Subject: {f.get('subject')}\n"
            f"  Value: {f.get('value')} {f.get('unit','')}\n".rstrip() + "\n"
            f"  Period: {f.get('period')} | Scope: {f.get('scope')} | Entity: {f.get('entity')}\n"
            f"  Type: {f.get('fact_type')} | Est/Actual: {f.get('estimate_or_actual')}\n"
            f"  As-of: {f.get('as_of_date')} | Source: {f.get('source_doc')} p.{f.get('page')}\n"
            f"  Evidence: \"{(f.get('evidence_snippet') or '')[:150]}\""
        )

    prompt = (
        "Classify the relationship between these two facts.\n\n"
        f"Fact A:\n{_fmt(fact_a)}\n\n"
        f"Fact B:\n{_fmt(fact_b)}\n\n"
        "Relationship types — pick exactly one:\n"
        "- corroborates: BOTH facts assert the SAME underlying claim and their values agree (after unit normalisation). "
        "Must be cross-document confirmation of the same specific figure or event.\n"
        "- contradicts: The facts assert the SAME claim but give irreconcilably different values — "
        "and no contextual field (period, scope, unit, as-of date, rounding) can explain the gap.\n"
        "- reconciled_by_context: The facts appear to conflict but a SPECIFIC contextual field explains the difference. "
        "You MUST name the field in your explanation (e.g. 'standalone vs consolidated scope', "
        "'FY23 vs FY24 period', 'advance estimate vs final actual'). "
        "Do NOT use this for facts that were never in tension.\n"
        "- related: The facts share a subject or entity but are NOT comparable — they describe different "
        "transactions, different metrics, or different time windows. No corroboration/contradiction possible. "
        "Use this instead of reconciled_by_context when the facts simply aren't measuring the same thing.\n\n"
        "Decision rule: ask 'would these two facts be in conflict if they described the same scope/period?' "
        "If no, use 'related'. If yes and context resolves it, use 'reconciled_by_context'. "
        "If yes and context does NOT resolve it, use 'contradicts'. "
        "If they agree, use 'corroborates'.\n\n"
        'Return ONLY: {"relationship_type": "...", "explanation": "one sentence naming the specific reason", "confidence": 0.85}'
    )

    with _recon_sem:
        raw = _chat(prompt, max_tokens=180)

    if not raw:
        return {"relationship_type": "related", "explanation": "failed", "confidence": 0.3}

    try:
        raw = re.sub(r"^```(?:json)?\s*", "", raw.strip())
        raw = re.sub(r"\s*```$", "", raw)
        m = re.search(r"\{.*\}", raw, re.DOTALL)
        if m:
            raw = m.group(0)
        result = json.loads(raw)
        if result.get("relationship_type") not in ("corroborates", "contradicts", "reconciled_by_context", "related"):
            result["relationship_type"] = "related"
        return result
    except Exception as e:
        print(f"[llm_extract] reconciler parse error: {e}")
        return {"relationship_type": "related", "explanation": "failed", "confidence": 0.3}
