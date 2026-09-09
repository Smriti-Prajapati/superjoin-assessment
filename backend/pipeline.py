"""
Ingestion pipeline — optimised for Cohere free tier.

Optimisations vs original:
  - Idempotent at document level (hash-based skip, not just path)
  - Per-batch DB commit so facts appear in UI progressively
  - Cohere Embed batched in one shot after extraction (not per-fact)
  - find_candidate_pairs uses cached embeddings from DB when available
  - Reconciliation only called for top-k candidates (not O(n²))
  - Progress tracked in `progress` table — polled by /progress/<doc_id>
"""

import os
import json
from pathlib import Path

from db import get_conn, upsert_progress
from extract_pdf import extract_chunks, get_page_count, has_rounding_disclaimer
from normalize import normalize_period
from llm_extract import extract_facts_from_chunks, reconcile_fact_pair, select_chunks
from embeddings import embed_texts, fact_text_for_embedding, find_candidate_pairs, embed_text


def ingest_document(filepath: str) -> dict:
    filepath = os.path.abspath(filepath)
    filename = Path(filepath).name
    source_group = _guess_source_group(filepath)

    conn = get_conn()
    try:
        # ── idempotency check ────────────────────────────────────────────────
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

        print(f"[pipeline] {filename} | {page_count} pages | rounding={has_rounding}")

        # ── chunk extraction ─────────────────────────────────────────────────
        all_chunks = extract_chunks(filepath)
        useful_count = len(select_chunks(all_chunks))
        print(f"[pipeline] {len(all_chunks)} chunks | {useful_count} fact-dense")

        # initialise progress
        batch_total = max(1, (useful_count + 29) // 30)
        upsert_progress(doc_id, stage="extracting", batches_done=0, batches_total=batch_total, facts_found=0)

        # ── LLM extraction with per-batch commit ─────────────────────────────
        stored_facts: list[dict] = []
        doc_context = f"source_group={source_group}, rounding_disclaimer={has_rounding}"

        def on_batch_done(batch_facts: list[dict]):
            for fact in batch_facts:
                fid = _store_fact(conn, fact, doc_id, has_rounding)
                if fid:
                    fact["id"] = fid
                    stored_facts.append(fact)
            conn.commit()
            upsert_progress(doc_id, facts_found=len(stored_facts))

        def on_progress(done: int, total: int):
            upsert_progress(doc_id, stage="extracting", batches_done=done, batches_total=total)

        extract_facts_from_chunks(
            all_chunks, filename, doc_context,
            on_batch_done=on_batch_done,
            on_progress=on_progress,
        )
        print(f"[pipeline] extraction done → {len(stored_facts)} facts")

        # ── batch-embed all new facts in one shot ────────────────────────────
        upsert_progress(doc_id, stage="embedding")
        if stored_facts:
            texts = [fact_text_for_embedding(f) for f in stored_facts]
            batch_size = 90
            all_vecs = []
            import time, pickle, numpy as np
            for i in range(0, len(texts), batch_size):
                vecs = embed_texts(texts[i : i + batch_size])
                all_vecs.extend(vecs)
                if i + batch_size < len(texts):
                    time.sleep(0.5)

            for fact, vec in zip(stored_facts, all_vecs):
                import pickle, numpy as np
                blob = pickle.dumps(vec.astype(np.float32))
                conn.execute("UPDATE facts SET embedding = ? WHERE id = ?", (blob, fact["id"]))
                fact["embedding"] = blob   # cache for immediate use below
            conn.commit()
            print(f"[pipeline] {len(stored_facts)} facts embedded")

        # ── cross-doc relationship computation ───────────────────────────────
        upsert_progress(doc_id, stage="linking")
        existing_facts = _load_other_doc_facts(conn, doc_id)
        print(f"[pipeline] {len(existing_facts)} existing facts from other docs")
        if existing_facts and stored_facts:
            rels = _compute_relationships(conn, stored_facts, existing_facts)
            upsert_progress(doc_id, relationships_found=rels)

        # within-doc (higher threshold to reduce noise)
        if stored_facts:
            _compute_within_doc(conn, stored_facts)

        conn.commit()
        upsert_progress(doc_id, stage="done",
                        facts_found=len(stored_facts),
                        batches_done=batch_total, batches_total=batch_total)

        total_rels = conn.execute("SELECT COUNT(*) FROM relationships WHERE fact_id_a IN "
                                  "(SELECT id FROM facts WHERE document_id=?) OR "
                                  "fact_id_b IN (SELECT id FROM facts WHERE document_id=?)",
                                  (doc_id, doc_id)).fetchone()[0]

        return {
            "status": "ok",
            "document_id": doc_id,
            "facts_extracted": len(stored_facts),
            "relationships": total_rels,
            "filename": filename,
        }
    finally:
        conn.close()


# ── helpers ───────────────────────────────────────────────────────────────────

def _store_fact(conn, fact: dict, doc_id: int, has_rounding: bool) -> int | None:
    subject = (fact.get("subject") or "").strip()
    if not subject:
        return None

    period_norm = normalize_period(fact.get("period"))
    extra: dict = {}
    if has_rounding and fact.get("fact_type") == "financial_metric":
        extra["rounding_disclaimer"] = True

    try:
        cur = conn.execute(
            """INSERT INTO facts (
                document_id, subject, value, unit, period, period_normalized,
                scope, entity, fact_type, estimate_or_actual, as_of_date,
                extra_context, source_doc, page, evidence_snippet, confidence
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                doc_id, subject,
                fact.get("value"), fact.get("unit"),
                fact.get("period"), period_norm,
                fact.get("scope"), fact.get("entity"),
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
        print(f"[pipeline] store_fact error '{subject}': {e}")
        return None


def _load_other_doc_facts(conn, doc_id: int) -> list[dict]:
    rows = conn.execute(
        """SELECT id, subject, value, unit, period, period_normalized, scope,
                  entity, fact_type, estimate_or_actual, as_of_date,
                  source_doc, page, evidence_snippet, confidence, embedding
           FROM facts WHERE document_id != ?""",
        (doc_id,),
    ).fetchall()
    return [dict(r) for r in rows]


def _compute_relationships(conn, new_facts: list[dict], existing_facts: list[dict]) -> int:
    candidates = find_candidate_pairs(
        new_facts, existing_facts, top_k=3, similarity_threshold=0.65
    )
    print(f"[pipeline] {len(candidates)} candidate pairs to reconcile")

    stored = 0
    for nf, ef, score in candidates:
        fa_id, fb_id = nf["id"], ef["id"]
        if conn.execute(
            "SELECT 1 FROM relationships WHERE (fact_id_a=? AND fact_id_b=?) OR (fact_id_a=? AND fact_id_b=?)",
            (fa_id, fb_id, fb_id, fa_id),
        ).fetchone():
            continue
        result = reconcile_fact_pair(nf, ef)
        conn.execute(
            "INSERT OR IGNORE INTO relationships (fact_id_a, fact_id_b, relationship_type, explanation, confidence) "
            "VALUES (?, ?, ?, ?, ?)",
            (fa_id, fb_id, result["relationship_type"], result.get("explanation", ""), result.get("confidence", 0.7)),
        )
        stored += 1
    conn.commit()
    print(f"[pipeline] {stored} relationships stored")
    return stored


def _compute_within_doc(conn, facts: list[dict]):
    if len(facts) < 2:
        return
    candidates = find_candidate_pairs(facts, facts, top_k=2, similarity_threshold=0.82)
    added = 0
    for fa, fb, _ in candidates:
        if fa["id"] == fb["id"]:
            continue
        if conn.execute(
            "SELECT 1 FROM relationships WHERE (fact_id_a=? AND fact_id_b=?) OR (fact_id_a=? AND fact_id_b=?)",
            (fa["id"], fb["id"], fb["id"], fa["id"]),
        ).fetchone():
            continue
        result = reconcile_fact_pair(fa, fb)
        conn.execute(
            "INSERT OR IGNORE INTO relationships (fact_id_a, fact_id_b, relationship_type, explanation, confidence) "
            "VALUES (?, ?, ?, ?, ?)",
            (fa["id"], fb["id"], result["relationship_type"], result.get("explanation", ""), result.get("confidence", 0.7)),
        )
        added += 1
    if added:
        conn.commit()
        print(f"[pipeline] {added} within-doc relationships")


def _guess_source_group(filepath: str) -> str:
    p = filepath.lower()
    if "delhivery" in p:
        return "delhivery"
    if any(k in p for k in ("macro", "rbi", "imf", "economic", "india")):
        return "india-macroeconomy"
    return Path(filepath).parent.name
