"""
LLM-based fact extraction using Cohere (command-a-03-2025).
Free tier: 10 calls/min, 1000 calls/day — no token-per-minute limit.
Much faster than Groq for bulk extraction.
"""

import json
import os
import re
import time
import httpx
from extract_pdf import Chunk

COHERE_API_KEY = os.environ.get("COHERE_API_KEY", "")
COHERE_URL = "https://api.cohere.com/v2/chat"
MODEL = "command-a-03-2025"

# rate limiter: 10 calls/min = 1 call per 6s minimum
_last_call_time: float = 0.0
MIN_INTERVAL = 6.5  # seconds between calls (slightly over 6 for safety)


def _rate_limit():
    global _last_call_time
    now = time.time()
    elapsed = now - _last_call_time
    if elapsed < MIN_INTERVAL:
        time.sleep(MIN_INTERVAL - elapsed)
    _last_call_time = time.time()


def _call(prompt: str, max_tokens: int = 4096) -> str | None:
    _rate_limit()
    headers = {
        "Authorization": f"Bearer {COHERE_API_KEY}",
        "Content-Type": "application/json",
    }
    body = {
        "model": MODEL,
        "messages": [{"role": "user", "content": prompt}],
        "max_tokens": max_tokens,
        "temperature": 0.1,
    }
    for attempt in range(3):
        try:
            r = httpx.post(COHERE_URL, headers=headers, json=body, timeout=60)
            if r.status_code == 429:
                wait = 30 * (attempt + 1)
                print(f"[llm_extract] rate limit, waiting {wait}s...")
                time.sleep(wait)
                continue
            if not r.is_success:
                print(f"[llm_extract] HTTP {r.status_code}: {r.text[:200]}")
                return None
            data = r.json()
            return data["message"]["content"][0]["text"]
        except Exception as e:
            print(f"[llm_extract] attempt {attempt+1} error: {str(e)[:100]}")
            if attempt < 2:
                time.sleep(5)
    return None


# ── chunk selection ─────────────────────────────────────────────────────────

def _is_fact_dense(text: str) -> bool:
    has_numbers = bool(re.search(r"\d[\d,\.]+", text))
    has_keywords = bool(re.search(
        r"(revenue|profit|loss|ebitda|margin|growth|appoint|resign|director|"
        r"crore|million|billion|percent|gdp|inflation|rate|quarter|annual|fy\d)",
        text, re.IGNORECASE
    ))
    return has_numbers or has_keywords


def _select_chunks(chunks: list) -> list:
    useful = [c for c in chunks if len(c.text) > 50 and c.chunk_type != "heading"]
    useful = [c for c in useful if _is_fact_dense(c.text)]
    seen, deduped = set(), []
    for c in useful:
        key = c.text[:80].lower().strip()
        if key not in seen:
            seen.add(key)
            deduped.append(c)
    return deduped


# ── extraction ──────────────────────────────────────────────────────────────

FACT_SCHEMA = """{
  "facts": [
    {
      "subject": "short label",
      "value": "numeric value or short description (no units)",
      "unit": "unit or null",
      "period": "time period or null",
      "scope": "consolidated | standalone | segment | null",
      "entity": "entity name or null",
      "fact_type": "financial_metric | operational_metric | macro_indicator | governance_event | personnel_appointment | personnel_resignation | director_status | company_description | risk_factor | customer_metric | workforce_metric | esg_metric | technology_capability",
      "estimate_or_actual": "actual | estimate | projection | provisional | unknown",
      "as_of_date": "effective date or null",
      "evidence_snippet": "verbatim 1-3 sentence quote from the text",
      "confidence": 0.85
    }
  ]
}"""


def extract_facts_from_chunks(
    chunks: list[Chunk],
    source_doc: str,
    doc_context: str = "",
    batch_size: int = 30,
    on_batch_done: callable = None,
) -> list[dict]:
    selected = _select_chunks(chunks)
    print(f"[llm_extract] {len(chunks)} raw → {len(selected)} fact-dense chunks")

    if not selected:
        return []

    all_facts: list[dict] = []
    total = (len(selected) + batch_size - 1) // batch_size
    for i in range(0, len(selected), batch_size):
        batch = selected[i : i + batch_size]
        n = i // batch_size + 1
        print(f"[llm_extract] batch {n}/{total}")
        facts = _extract_batch(batch, source_doc, doc_context)
        all_facts.extend(facts)
        if on_batch_done and facts:
            on_batch_done(facts)
    return all_facts


def _extract_batch(chunks: list[Chunk], source_doc: str, doc_context: str) -> list[dict]:
    lines = []
    if doc_context:
        lines.append(f"[Document: {doc_context}]\n")
    for chunk in chunks:
        lines.append(f"[Page {chunk.page}]")
        lines.append(chunk.text)
        lines.append("")

    prompt = f"""Extract ALL meaningful facts from this document section. Document: {source_doc}

Rules:
- Only extract facts clearly stated in the text. Never hallucinate.
- For director appointments/resignations: set as_of_date to the effective date.
- For financial figures: set scope to standalone or consolidated.
- "advance estimate", "projected", "forecast" → estimate_or_actual = "estimate".
- evidence_snippet must be verbatim text. confidence >= 0.5 only.

Text:
{chr(10).join(lines)}

Return ONLY valid JSON matching this structure exactly, no markdown fences:
{FACT_SCHEMA}"""

    raw = _call(prompt, max_tokens=4096)
    if not raw:
        return []

    try:
        raw = re.sub(r"^```(?:json)?\s*", "", raw.strip())
        raw = re.sub(r"\s*```$", "", raw)
        # find the JSON object
        match = re.search(r'\{.*\}', raw, re.DOTALL)
        if match:
            raw = match.group(0)
        data = json.loads(raw)
        facts = data.get("facts", [])
        enriched = []
        for fact in facts:
            if not _validate_fact(fact):
                continue
            fact["source_doc"] = source_doc
            fact["page"] = _find_page(fact.get("evidence_snippet", ""), chunks)
            enriched.append(fact)
        print(f"[llm_extract]   → {len(enriched)} facts")
        return enriched
    except Exception as e:
        print(f"[llm_extract] parse error: {e} | raw[:100]: {raw[:100]}")
        return []


def _find_page(snippet: str, chunks: list[Chunk]) -> int | None:
    if not snippet or not chunks:
        return chunks[0].page if chunks else None
    needle = snippet[:60].lower().strip()
    for chunk in chunks:
        if needle[:40] in chunk.text.lower():
            return chunk.page
    return chunks[0].page


def _validate_fact(fact: dict) -> bool:
    return (
        bool(fact.get("subject"))
        and bool(fact.get("evidence_snippet"))
        and fact.get("confidence", 0) >= 0.5
    )


# ── reconciliation ──────────────────────────────────────────────────────────

def reconcile_fact_pair(fact_a: dict, fact_b: dict) -> dict:
    def _fmt(f: dict) -> str:
        return "\n".join([
            f"  Subject: {f.get('subject')}",
            f"  Value: {f.get('value')} {f.get('unit', '')}".rstrip(),
            f"  Period: {f.get('period')} | Scope: {f.get('scope')} | Entity: {f.get('entity')}",
            f"  Type: {f.get('fact_type')} | Estimate/Actual: {f.get('estimate_or_actual')}",
            f"  As-of: {f.get('as_of_date')} | Source: {f.get('source_doc')} p.{f.get('page')}",
            f'  Evidence: "{(f.get("evidence_snippet") or "")[:150]}"',
        ])

    prompt = f"""Classify the relationship between these two facts from different documents.

Fact A:
{_fmt(fact_a)}

Fact B:
{_fmt(fact_b)}

Classify as exactly one of:
- corroborates: same underlying fact (unit conversion or minor label differences ok)
- contradicts: genuine conflict not explainable by scope, period, estimate vs actual, or rounding
- reconciled_by_context: difference explained by scope (standalone vs consolidated), period, estimate vs actual, as-of date, or rounding

Return ONLY this JSON, no markdown:
{{"relationship_type": "corroborates", "explanation": "one sentence", "confidence": 0.85}}"""

    raw = _call(prompt, max_tokens=200)
    if not raw:
        return {"relationship_type": "reconciled_by_context", "explanation": "reconciliation failed", "confidence": 0.3}

    try:
        raw = re.sub(r"^```(?:json)?\s*", "", raw.strip())
        raw = re.sub(r"\s*```$", "", raw)
        match = re.search(r'\{.*\}', raw, re.DOTALL)
        if match:
            raw = match.group(0)
        result = json.loads(raw)
        if result.get("relationship_type") not in ("corroborates", "contradicts", "reconciled_by_context"):
            result["relationship_type"] = "reconciled_by_context"
        return result
    except Exception as e:
        print(f"[llm_extract] reconciler parse error: {e}")
        return {"relationship_type": "reconciled_by_context", "explanation": "reconciliation failed", "confidence": 0.3}
