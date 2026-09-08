"""
LLM-based fact extraction using Groq (free tier).

Strategy to stay within 30K tokens/min:
- Only send the most fact-dense chunks (tables, paragraphs with numbers)
- Small batches of ~10 chunks (~2000 tokens each)
- 60s sliding window limiter — max 12 calls/min to stay safe
"""

import json
import os
import re
import time
import groq as groq_sdk
from extract_pdf import Chunk

_client = None

def _get_client():
    global _client
    if _client is None:
        _client = groq_sdk.Groq(api_key=os.environ.get("GROQ_API_KEY", ""))
    return _client

MODEL = "qwen/qwen3.8-27b"

# sliding window rate limiter
_call_times: list[float] = []
MAX_CALLS_PER_MIN = 10  # conservative — well under free tier limit

def _rate_limit():
    """Block until we're safe to make another call."""
    now = time.time()
    global _call_times
    # drop calls older than 60s
    _call_times = [t for t in _call_times if now - t < 60]
    if len(_call_times) >= MAX_CALLS_PER_MIN:
        wait = 61 - (now - _call_times[0])
        if wait > 0:
            print(f"[llm_extract] rate limit window full, waiting {wait:.0f}s...")
            time.sleep(wait)
        _call_times = [t for t in _call_times if time.time() - t < 60]
    _call_times.append(time.time())


# ── chunk selection ─────────────────────────────────────────────────────────

def _is_fact_dense(text: str) -> bool:
    """True if a chunk likely contains extractable facts."""
    # must have some numeric content or key governance terms
    has_numbers = bool(re.search(r"\d[\d,\.]+", text))
    has_keywords = bool(re.search(
        r"(revenue|profit|loss|ebitda|margin|growth|appoint|resign|director|"
        r"crore|million|billion|percent|gdp|inflation|rate|quarter|annual|fy\d)",
        text, re.IGNORECASE
    ))
    return has_numbers or has_keywords


def _select_chunks(chunks: list[Chunk]) -> list[Chunk]:
    """Filter and deduplicate chunks, keeping only fact-dense ones."""
    useful = [c for c in chunks if len(c.text) > 50 and c.chunk_type != "heading"]
    useful = [c for c in useful if _is_fact_dense(c.text)]
    # deduplicate
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
      "evidence_snippet": "verbatim 1-3 sentence quote",
      "confidence": 0.85
    }
  ]
}"""


def extract_facts_from_chunks(
    chunks: list[Chunk],
    source_doc: str,
    doc_context: str = "",
    batch_size: int = 10,
) -> list[dict]:
    selected = _select_chunks(chunks)
    print(f"[llm_extract] {len(chunks)} raw → {len(selected)} fact-dense chunks selected")

    if not selected:
        return []

    all_facts: list[dict] = []
    total_batches = (len(selected) + batch_size - 1) // batch_size
    for i in range(0, len(selected), batch_size):
        batch = selected[i : i + batch_size]
        batch_num = i // batch_size + 1
        print(f"[llm_extract] batch {batch_num}/{total_batches} (chunks {i+1}-{min(i+batch_size, len(selected))})")
        facts = _extract_batch(batch, source_doc, doc_context)
        all_facts.extend(facts)
    return all_facts


def _extract_batch(chunks: list[Chunk], source_doc: str, doc_context: str) -> list[dict]:
    lines = []
    if doc_context:
        lines.append(f"[Document: {doc_context}]\n")
    for chunk in chunks:
        lines.append(f"[Page {chunk.page}]")
        lines.append(chunk.text)
        lines.append("")

    prompt = f"""Extract facts from this document section. Document: {source_doc}

Rules: only extract clearly stated facts, no hallucination. For financial figures note standalone/consolidated in scope. For appointments/resignations set as_of_date. evidence_snippet must be verbatim text. confidence >= 0.5 only.

Text:
{chr(10).join(lines)}

Return ONLY this JSON (no markdown):
{FACT_SCHEMA}"""

    _rate_limit()
    for attempt in range(3):
        try:
            response = _get_client().chat.completions.create(
                model=MODEL,
                messages=[
                    {"role": "system", "content": "You extract structured facts from financial documents. Return only valid JSON."},
                    {"role": "user", "content": prompt},
                ],
                temperature=0.1,
                max_tokens=2048,
                response_format={"type": "json_object"},
            )
            raw = response.choices[0].message.content.strip()
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

        except groq_sdk.RateLimitError:
            wait = 65
            print(f"[llm_extract] rate limit hit, waiting {wait}s...")
            time.sleep(wait)
            _rate_limit()
        except Exception as e:
            print(f"[llm_extract] attempt {attempt+1} error: {str(e)[:120]}")
            if attempt < 2:
                time.sleep(5)

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

    prompt = f"""Classify relationship between these two facts.

Fact A:
{_fmt(fact_a)}

Fact B:
{_fmt(fact_b)}

Types: corroborates (same underlying fact), contradicts (genuine conflict), reconciled_by_context (different scope/period/estimate vs actual/rounding)

Return ONLY: {{"relationship_type": "corroborates", "explanation": "one sentence", "confidence": 0.85}}"""

    _rate_limit()
    for attempt in range(3):
        try:
            response = _get_client().chat.completions.create(
                model=MODEL,
                messages=[
                    {"role": "system", "content": "Classify relationships between financial facts. Return only valid JSON."},
                    {"role": "user", "content": prompt},
                ],
                temperature=0.0,
                max_tokens=150,
                response_format={"type": "json_object"},
            )
            raw = response.choices[0].message.content.strip()
            result = json.loads(raw)
            if result.get("relationship_type") not in ("corroborates", "contradicts", "reconciled_by_context"):
                result["relationship_type"] = "reconciled_by_context"
            return result

        except groq_sdk.RateLimitError:
            time.sleep(65)
            _rate_limit()
        except Exception as e:
            print(f"[llm_extract] reconciler error: {str(e)[:80]}")
            if attempt < 2:
                time.sleep(5)

    return {"relationship_type": "reconciled_by_context", "explanation": "reconciliation failed", "confidence": 0.3}
