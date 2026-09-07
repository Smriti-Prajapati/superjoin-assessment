"""
Main ingestion pipeline.

Flow per document:
  PDF → chunks → LLM extraction → normalize + store facts → embed
  → candidate matching vs existing facts → LLM reconciler → store relationships

Incremental: only pairs between the new doc's facts and existing facts are
computed, not the full cross-product each time.
"""

import os
import json
from pathlib import Path

from db import get_conn
from extract_pdf import extract_chunks, get_page_count, has_rounding_disclaimer
from normalize import normalize_period, normalize_unit
from llm_extract import extract_facts_from_chunks, reconcile_fact_pair
from embeddings import embed_text, fact_text_for_embedding, find_candidate_pairs


def ingest_document(filepath: str) -> dict:
    """
    Full pipeline for a single PDF.
    Returns a summary dict.
    """
    filepath = os.path.abspath(filepath)
    filename = Path(filepath).name
    source_group = _guess_source_group(filepath)

    conn = get_conn()
    try:
        # idempotent: skip if already ingested
        existing = conn.execute(
            "SELECT id FROM documents WHERE filepath = ?", (filepath,)
        ).fetchone()
        if existing:
            return {"status": "already_ingested", "document_id": existing["id"]}

        page_count = get_page_count(filepath)
        has_rounding = has_rounding_disclaimer(filepath)

        cur = conn.execute(
            "INSERT INTO documents (filename, filepath, source_group, page_count) VALUES (?, ?, ?, ?)",
            (filename, filepath, source_group, page_count),
        )
        doc_id = cur.lastrowid
        conn.commit()

        print(f"[pipeline] ingesting {filename} ({page_count} pages, rounding={has_rounding})")

        chunks = extract_chunks(filepath)
        print(f"[pipeline] {len(chunks)} chunks extracted")

        doc_context = f"source_group={source_group}, rounding_disclaimer={has_rounding}"
        raw_facts = extract_facts_from_chunks(chunks, filename, doc_context)
        print(f"[pipeline] {len(raw_facts)} raw facts from LLM")

        # store + normalize
        stored_facts: list[dict] = []
        for fact in raw_facts:
            fid = _store_fact(conn, fact, doc_id, has_rounding)
            if fid:
                fact["id"] = fid
                stored_facts.append(fact)
        conn.commit()
        print(f"[pipeline] {len(stored_facts)} facts stored")

        # compute and store embeddings
        for fact in stored_facts:
            emb = embed_text(fact_text_for_embedding(fact))
            conn.execute("UPDATE facts SET embedding = ? WHERE id = ?", (emb, fact["id"]))
        conn.commit()

        # cross-doc relationship computation
        existing_facts = _load_other_doc_facts(conn, doc_id)
        print(f"[pipeline] {len(existing_facts)} existing facts for matching")
        if existing_facts and stored_facts:
            _compute_relationships(conn, stored_facts, existing_facts)

        # within-doc relationships (e.g. standalone vs consolidated of same metric)
        _compute_within_doc_relationships(conn, stored_facts)
        conn.commit()

        return {
            "status": "ok",
            "document_id": doc_id,
            "facts_extracted": len(stored_facts),
            "filename": filename,
        }
    finally:
        conn.close()


# ── helpers ─────────────────────────────────────────────────────────────────

def _store_fact(conn, fact: dict, doc_id: int, has_rounding: bool) -> int | None:
    subject = (fact.get("subject") or "").strip()
    if not subject:
        return None

    period_norm = normalize_period(fact.get("period"))
    unit = fact.get("unit")

    extra: dict = {}
    if has_rounding and fact.get("fact_type") == "financial_metric":
        extra["rounding_disclaimer"] = True
    if fact.get("extra_context"):
        extra["notes"] = fact["extra_context"]

    try:
        cur = conn.execute(
            """
            INSERT INTO facts (
                document_id, subject, value, unit, period, period_normalized,
                scope, entity, fact_type, estimate_or_actual, as_of_date,
                extra_context, source_doc, page, evidence_snippet, confidence
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                doc_id,
                subject,
                fact.get("value"),
                unit,
                fact.get("period"),
                period_norm,
                fact.get("scope"),
                fact.get("entity"),
                fact.get("fact_type"),
                fact.get("estimate_or_actual", "unknown"),
                fact.get("as_of_date"),
                json.dumps(extra) if extra else None,
                fact.get("source_doc", ""),
                fact.get("page"),
                (fact.get("evidence_snippet") or "")[:1000],
                fact.get("confidence", 0.7),
            ),
        )
        return cur.lastrowid
    except Exception as e:
        print(f"[pipeline] store_fact error for '{subject}': {e}")
        return None


def _load_other_doc_facts(conn, doc_id: int) -> list[dict]:
    rows = conn.execute(
        """
        SELECT id, subject, value, unit, period, period_normalized, scope,
               entity, fact_type, estimate_or_actual, as_of_date,
               source_doc, page, evidence_snippet, confidence
        FROM facts WHERE document_id != ?
        """,
        (doc_id,),
    ).fetchall()
    return [dict(r) for r in rows]


def _compute_relationships(conn, new_facts: list[dict], existing_facts: list[dict]):
    candidates = find_candidate_pairs(new_facts, existing_facts, top_k=5, similarity_threshold=0.55)
    print(f"[pipeline] {len(candidates)} candidate pairs")

    stored = 0
    for new_fact, existing_fact, _ in candidates:
        fa_id, fb_id = new_fact["id"], existing_fact["id"]
        already = conn.execute(
            "SELECT id FROM relationships WHERE (fact_id_a=? AND fact_id_b=?) OR (fact_id_a=? AND fact_id_b=?)",
            (fa_id, fb_id, fb_id, fa_id),
        ).fetchone()
        if already:
            continue
        result = reconcile_fact_pair(new_fact, existing_fact)
        conn.execute(
            "INSERT OR IGNORE INTO relationships (fact_id_a, fact_id_b, relationship_type, explanation, confidence) VALUES (?, ?, ?, ?, ?)",
            (fa_id, fb_id, result["relationship_type"], result.get("explanation", ""), result.get("confidence", 0.7)),
        )
        stored += 1
    conn.commit()
    print(f"[pipeline] {stored} relationships stored")


def _compute_within_doc_relationships(conn, facts: list[dict]):
    if len(facts) < 2:
        return
    # higher threshold for within-doc to avoid noise
    candidates = find_candidate_pairs(facts, facts, top_k=3, similarity_threshold=0.78)
    added = 0
    for fa, fb, _ in candidates:
        if fa["id"] == fb["id"]:
            continue
        already = conn.execute(
            "SELECT id FROM relationships WHERE (fact_id_a=? AND fact_id_b=?) OR (fact_id_a=? AND fact_id_b=?)",
            (fa["id"], fb["id"], fb["id"], fa["id"]),
        ).fetchone()
        if already:
            continue
        result = reconcile_fact_pair(fa, fb)
        conn.execute(
            "INSERT OR IGNORE INTO relationships (fact_id_a, fact_id_b, relationship_type, explanation, confidence) VALUES (?, ?, ?, ?, ?)",
            (fa["id"], fb["id"], result["relationship_type"], result.get("explanation", ""), result.get("confidence", 0.7)),
        )
        added += 1
    if added:
        conn.commit()


def _guess_source_group(filepath: str) -> str:
    p = filepath.lower()
    if "delhivery" in p:
        return "delhivery"
    if any(k in p for k in ("macro", "rbi", "imf", "economic", "india")):
        return "india-macroeconomy"
    return Path(filepath).parent.name
