import sqlite3
import os

DB_PATH = os.environ.get("DB_PATH", "factlens.db")


def get_conn():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def init_db():
    conn = get_conn()
    c = conn.cursor()

    c.execute("""
        CREATE TABLE IF NOT EXISTS documents (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            filename TEXT NOT NULL,
            filepath TEXT NOT NULL UNIQUE,
            source_group TEXT,
            page_count INTEGER,
            ingested_at TEXT DEFAULT (datetime('now'))
        )
    """)

    c.execute("""
        CREATE TABLE IF NOT EXISTS facts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            document_id INTEGER NOT NULL REFERENCES documents(id),
            subject TEXT NOT NULL,
            value TEXT,
            unit TEXT,
            period TEXT,
            period_normalized TEXT,
            scope TEXT,
            entity TEXT,
            fact_type TEXT,
            estimate_or_actual TEXT,
            as_of_date TEXT,
            extra_context TEXT,
            source_doc TEXT NOT NULL,
            page INTEGER,
            evidence_snippet TEXT,
            confidence REAL,
            embedding BLOB,
            created_at TEXT DEFAULT (datetime('now'))
        )
    """)

    c.execute("""
        CREATE TABLE IF NOT EXISTS relationships (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            fact_id_a INTEGER NOT NULL REFERENCES facts(id),
            fact_id_b INTEGER NOT NULL REFERENCES facts(id),
            relationship_type TEXT NOT NULL,
            explanation TEXT,
            confidence REAL,
            created_at TEXT DEFAULT (datetime('now')),
            UNIQUE(fact_id_a, fact_id_b)
        )
    """)

    # live progress tracking per document
    c.execute("""
        CREATE TABLE IF NOT EXISTS progress (
            document_id INTEGER PRIMARY KEY REFERENCES documents(id),
            stage TEXT NOT NULL DEFAULT 'extracting',
            batches_done INTEGER NOT NULL DEFAULT 0,
            batches_total INTEGER NOT NULL DEFAULT 0,
            facts_found INTEGER NOT NULL DEFAULT 0,
            relationships_found INTEGER NOT NULL DEFAULT 0,
            updated_at TEXT DEFAULT (datetime('now'))
        )
    """)

    conn.commit()
    conn.close()


def upsert_progress(doc_id: int, **kwargs):
    """Update progress for a document. kwargs: stage, batches_done, batches_total, facts_found, relationships_found."""
    conn = get_conn()
    # build SET clause from kwargs
    fields = {k: v for k, v in kwargs.items()
              if k in ("stage", "batches_done", "batches_total", "facts_found", "relationships_found")}
    if not fields:
        conn.close()
        return
    set_clause = ", ".join(f"{k} = ?" for k in fields)
    set_clause += ", updated_at = datetime('now')"
    values = list(fields.values()) + [doc_id]
    conn.execute(
        f"INSERT INTO progress (document_id) VALUES (?) ON CONFLICT(document_id) DO NOTHING",
        (doc_id,)
    )
    conn.execute(f"UPDATE progress SET {set_clause} WHERE document_id = ?", values)
    conn.commit()
    conn.close()
