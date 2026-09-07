"""
LLM-based fact extraction and relationship reconciliation using Anthropic tool use.

extract_facts_from_chunks  — first pass: structured fact extraction per document
reconcile_fact_pair        — second pass: classify relationship between two facts
"""

import json
import os
import re
import anthropic
from extract_pdf import Chunk

client = anthropic.Anthropic(api_key=os.environ.get("ANTHROPIC_API_KEY", ""))

# ── extraction tool schema ──────────────────────────────────────────────────

EXTRACT_TOOL = {
    "name": "extract_facts",
    "description": (
        "Extract every meaningful fact from the document text. "
        "Include numeric metrics, events (appointments/resignations/changes), "
        "governance facts, operational data, macro indicators. "
        "For each fact capture a verbatim evidence snippet from the text."
    ),
    "input_schema": {
        "type": "object",
        "properties": {
            "facts": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "subject": {
                            "type": "string",
                            "description": "What this fact is about (e.g. 'Revenue from operations', 'Sandeep Kumar Barasia role', 'GDP growth rate')"
                        },
                        "value": {
                            "type": "string",
                            "description": "The value or description. Numbers only (no units). For events, a brief description."
                        },
                        "unit": {
                            "type": "string",
                            "description": "Unit if applicable: 'INR million', '₹ Cr', '%', 'million tonnes'. Omit if not applicable."
                        },
                        "period": {
                            "type": "string",
                            "description": "Time period (e.g. 'FY24', 'Q4 FY24', 'year ended March 31 2024', '2024-25'). Omit if not time-bound."
                        },
                        "scope": {
                            "type": "string",
                            "description": "Scope: 'consolidated', 'standalone', 'express parcel segment'. Omit if not applicable."
                        },
                        "entity": {
                            "type": "string",
                            "description": "Primary entity (e.g. 'Delhivery Limited', 'India', 'Sandeep Kumar Barasia')"
                        },
                        "fact_type": {
                            "type": "string",
                            "description": (
                                "Type of fact. Use one of: financial_metric, operational_metric, "
                                "macro_indicator, governance_event, personnel_appointment, "
                                "personnel_resignation, director_status, company_description, "
                                "risk_factor, customer_metric, workforce_metric, esg_metric, "
                                "technology_capability. Or propose a new type if none fit."
                            )
                        },
                        "estimate_or_actual": {
                            "type": "string",
                            "enum": ["actual", "estimate", "projection", "provisional", "unknown"]
                        },
                        "as_of_date": {
                            "type": "string",
                            "description": "Specific date this fact is effective, if stated (e.g. 'July 1, 2024' for a resignation date)."
                        },
                        "evidence_snippet": {
                            "type": "string",
                            "description": "Verbatim quote (1-3 sentences) from the text supporting this fact. Must be exact text from the document."
                        },
                        "confidence": {
                            "type": "number",
                            "description": "0-1 confidence this is a real extractable fact (not hallucinated)."
                        }
                    },
                    "required": ["subject", "fact_type", "evidence_snippet", "confidence"]
                }
            }
        },
        "required": ["facts"]
    }
}


# ── extraction ──────────────────────────────────────────────────────────────

def extract_facts_from_chunks(
    chunks: list[Chunk],
    source_doc: str,
    doc_context: str = "",
    batch_size: int = 30,
) -> list[dict]:
    """
    Batch chunks and call Claude to extract structured facts.
    Returns list of fact dicts enriched with source_doc and page.
    """
    all_facts: list[dict] = []
    for i in range(0, len(chunks), batch_size):
        batch = chunks[i : i + batch_size]
        facts = _extract_batch(batch, source_doc, doc_context)
        all_facts.extend(facts)
    return all_facts


def _extract_batch(chunks: list[Chunk], source_doc: str, doc_context: str) -> list[dict]:
    lines = []
    if doc_context:
        lines.append(f"[Document context: {doc_context}]\n")
    for chunk in chunks:
        lines.append(f"[Page {chunk.page}] ({chunk.chunk_type})")
        lines.append(chunk.text)
        lines.append("")
    text_block = "\n".join(lines)

    prompt = f"""You are extracting facts from a section of a business/financial/economic document.

Extract ALL meaningful facts — numeric metrics, entity information, personnel events (appointments, resignations, director statuses), operational data, macro indicators, governance facts.

Rules:
- Only extract facts clearly stated in the text. Never infer or hallucinate.
- For director appointments/resignations, capture the effective date in as_of_date.
- For financial figures, record standalone vs consolidated in scope.
- If the document uses "advance estimate", "projected", "forecast" → estimate_or_actual = "estimate".
- evidence_snippet must be verbatim text, not a paraphrase.
- If a rounding disclaimer is present and this is a financial metric, note it.

Document: {source_doc}

Text:
{text_block}"""

    try:
        response = client.messages.create(
            model="claude-3-5-haiku-20241022",
            max_tokens=4096,
            tools=[EXTRACT_TOOL],
            tool_choice={"type": "tool", "name": "extract_facts"},
            messages=[{"role": "user", "content": prompt}],
        )
    except anthropic.APIError as e:
        print(f"[llm_extract] API error: {e}")
        return []

    for block in response.content:
        if block.type == "tool_use" and block.name == "extract_facts":
            raw_facts = block.input.get("facts", [])
            enriched = []
            for fact in raw_facts:
                if not _validate_fact(fact):
                    continue
                snippet = fact.get("evidence_snippet", "")
                fact["source_doc"] = source_doc
                fact["page"] = _find_page(snippet, chunks)
                enriched.append(fact)
            return enriched

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
    """
    Given two candidate related facts, classify their relationship.
    Returns dict: {relationship_type, explanation, confidence}
    """
    def _fmt(f: dict) -> str:
        lines = [
            f"  Subject: {f.get('subject')}",
            f"  Value: {f.get('value')} {f.get('unit', '')}".rstrip(),
            f"  Period: {f.get('period')} | Scope: {f.get('scope')} | Entity: {f.get('entity')}",
            f"  Type: {f.get('fact_type')} | Estimate/Actual: {f.get('estimate_or_actual')}",
            f"  As-of date: {f.get('as_of_date')}",
            f"  Source: {f.get('source_doc')}, page {f.get('page')}",
            f'  Evidence: "{f.get("evidence_snippet", "")[:200]}"',
        ]
        return "\n".join(lines)

    prompt = f"""You are analyzing two facts from different financial/economic documents to classify their relationship.

Fact A:
{_fmt(fact_a)}

Fact B:
{_fmt(fact_b)}

Classify the relationship as exactly one of:
- corroborates: both facts state the same underlying thing (unit conversion or minor label differences are fine)
- contradicts: the facts genuinely conflict and the difference cannot be explained by scope, period, vintage, or estimate vs actual
- reconciled_by_context: the facts look different but the difference is explained by a specific contextual factor (e.g. different period, standalone vs consolidated, advance estimate vs final actual, different as-of dates, rounding disclaimer applies)

Respond ONLY with a JSON object, no markdown:
{{"relationship_type": "corroborates" | "contradicts" | "reconciled_by_context", "explanation": "1-2 sentences naming the specific contextual factor if applicable", "confidence": 0.0-1.0}}"""

    try:
        response = client.messages.create(
            model="claude-3-5-haiku-20241022",
            max_tokens=512,
            messages=[{"role": "user", "content": prompt}],
        )
        text = response.content[0].text.strip()
        # strip markdown fences if present
        text = re.sub(r"^```(?:json)?\s*", "", text)
        text = re.sub(r"\s*```$", "", text)
        result = json.loads(text)
        if result.get("relationship_type") not in ("corroborates", "contradicts", "reconciled_by_context"):
            result["relationship_type"] = "reconciled_by_context"
        return result
    except Exception as e:
        print(f"[llm_extract] reconciler error: {e}")
        return {
            "relationship_type": "reconciled_by_context",
            "explanation": "Automatic reconciliation failed — manual review needed.",
            "confidence": 0.3,
        }
