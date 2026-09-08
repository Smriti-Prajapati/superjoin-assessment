import os
import shutil
import threading
import queue
import time
from pathlib import Path
from contextlib import asynccontextmanager

from fastapi import FastAPI, UploadFile, File, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

load_dotenv()

from db import init_db, get_conn
from pipeline import ingest_document

UPLOAD_DIR = Path("uploads")
UPLOAD_DIR.mkdir(exist_ok=True)

# serialized ingestion queue — one doc at a time to avoid rate limit conflicts
_ingest_queue: queue.Queue = queue.Queue()

def _queue_worker():
    while True:
        filepath = _ingest_queue.get()
        filename = os.path.basename(filepath)
        _current_processing["filename"] = filename
        _current_processing["started_at"] = time.time()
        try:
            result = ingest_document(filepath)
            print(f"[queue] done: {result}")
        except Exception as e:
            import traceback
            print(f"[queue] error for {filepath}: {e}")
            traceback.print_exc()
        finally:
            _current_processing.clear()
            _ingest_queue.task_done()

# start single worker thread
_worker = threading.Thread(target=_queue_worker, daemon=True)
_worker.start()


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


app = FastAPI(title="FactLens API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# track currently processing doc
_current_processing: dict = {}


# ── queue status ─────────────────────────────────────────────────────────────

@app.get("/queue")
def get_queue_status():
    return {
        "queued": _ingest_queue.qsize(),
        "current": _current_processing.copy(),
    }


# ── documents ───────────────────────────────────────────────────────────────

@app.post("/documents", status_code=202)
async def upload_document(file: UploadFile = File(...)):
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(400, "Only PDF files are supported")
    dest = UPLOAD_DIR / file.filename
    with dest.open("wb") as f:
        shutil.copyfileobj(file.file, f)
    _ingest_queue.put(str(dest))
    queue_size = _ingest_queue.qsize()
    return {"status": "queued", "filename": file.filename, "position": queue_size}


@app.post("/documents/path")
async def ingest_from_path(body: dict):
    """Ingest a PDF already on disk (useful for batch scripts)."""
    filepath = body.get("filepath", "")
    if not filepath or not os.path.exists(filepath):
        raise HTTPException(400, f"File not found: {filepath}")
    _ingest_queue.put(filepath)
    return {"status": "queued", "filepath": filepath}


@app.get("/documents")
def list_documents():
    conn = get_conn()
    rows = conn.execute(
        "SELECT id, filename, source_group, page_count, ingested_at FROM documents ORDER BY ingested_at DESC"
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


@app.get("/documents/{doc_id}")
def get_document(doc_id: int):
    conn = get_conn()
    row = conn.execute("SELECT * FROM documents WHERE id = ?", (doc_id,)).fetchone()
    conn.close()
    if not row:
        raise HTTPException(404, "Document not found")
    return dict(row)


@app.get("/documents/{doc_id}/facts")
def get_document_facts(doc_id: int):
    conn = get_conn()
    rows = conn.execute(
        "SELECT * FROM facts WHERE document_id = ? ORDER BY page, id", (doc_id,)
    ).fetchall()
    conn.close()
    return [_strip_embedding(r) for r in rows]


# ── facts ────────────────────────────────────────────────────────────────────

@app.get("/facts")
def list_facts(
    fact_type: str = None,
    entity: str = None,
    period: str = None,
    source_doc: str = None,
    limit: int = 200,
    offset: int = 0,
):
    conn = get_conn()
    q = "SELECT * FROM facts WHERE 1=1"
    params: list = []
    if fact_type:
        q += " AND fact_type = ?"
        params.append(fact_type)
    if entity:
        q += " AND entity LIKE ?"
        params.append(f"%{entity}%")
    if period:
        q += " AND (period = ? OR period_normalized = ?)"
        params.extend([period, period])
    if source_doc:
        q += " AND source_doc LIKE ?"
        params.append(f"%{source_doc}%")
    q += " ORDER BY id LIMIT ? OFFSET ?"
    params.extend([limit, offset])
    rows = conn.execute(q, params).fetchall()
    conn.close()
    return [_strip_embedding(r) for r in rows]


@app.get("/facts/{fact_id}")
def get_fact(fact_id: int):
    conn = get_conn()
    row = conn.execute("SELECT * FROM facts WHERE id = ?", (fact_id,)).fetchone()
    conn.close()
    if not row:
        raise HTTPException(404, "Fact not found")
    return _strip_embedding(row)


@app.get("/facts/{fact_id}/relationships")
def get_fact_relationships(fact_id: int):
    conn = get_conn()
    rows = conn.execute(
        """
        SELECT r.*,
               fa.subject as subject_a, fa.value as value_a, fa.unit as unit_a,
               fa.period as period_a, fa.source_doc as source_a, fa.page as page_a,
               fa.entity as entity_a, fa.fact_type as type_a,
               fb.subject as subject_b, fb.value as value_b, fb.unit as unit_b,
               fb.period as period_b, fb.source_doc as source_b, fb.page as page_b,
               fb.entity as entity_b, fb.fact_type as type_b
        FROM relationships r
        JOIN facts fa ON r.fact_id_a = fa.id
        JOIN facts fb ON r.fact_id_b = fb.id
        WHERE r.fact_id_a = ? OR r.fact_id_b = ?
        ORDER BY r.confidence DESC
        """,
        (fact_id, fact_id),
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


# ── relationships ────────────────────────────────────────────────────────────

@app.get("/relationships")
def list_relationships(
    relationship_type: str = None,
    limit: int = 200,
    offset: int = 0,
):
    conn = get_conn()
    q = """
        SELECT r.*,
               fa.subject as subject_a, fa.value as value_a, fa.unit as unit_a,
               fa.period as period_a, fa.source_doc as source_a, fa.page as page_a,
               fa.entity as entity_a, fa.fact_type as type_a,
               fb.subject as subject_b, fb.value as value_b, fb.unit as unit_b,
               fb.period as period_b, fb.source_doc as source_b, fb.page as page_b,
               fb.entity as entity_b, fb.fact_type as type_b
        FROM relationships r
        JOIN facts fa ON r.fact_id_a = fa.id
        JOIN facts fb ON r.fact_id_b = fb.id
        WHERE 1=1
    """
    params: list = []
    if relationship_type:
        q += " AND r.relationship_type = ?"
        params.append(relationship_type)
    q += " ORDER BY r.confidence DESC LIMIT ? OFFSET ?"
    params.extend([limit, offset])
    rows = conn.execute(q, params).fetchall()
    conn.close()
    return [dict(r) for r in rows]


# ── helpers ──────────────────────────────────────────────────────────────────

def _strip_embedding(row) -> dict:
    d = dict(row)
    d.pop("embedding", None)
    return d


def _run_pipeline(filepath: str):
    try:
        result = ingest_document(filepath)
        print(f"[pipeline] done: {result}")
    except Exception as e:
        import traceback
        print(f"[pipeline] error for {filepath}: {e}")
        traceback.print_exc()


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
