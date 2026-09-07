# FactLens

A fact extraction and cross-document linking system for financial/economic PDFs.

Upload PDFs → Claude extracts structured facts → sentence-transformers finds candidate pairs → Claude classifies each relationship as **corroborates**, **contradicts**, or **reconciled by context**.

Built for the Superjoin intern assignment.

---

## Architecture

```
data/               ← put your PDFs here before running
backend/
  main.py           ← FastAPI app (REST API)
  pipeline.py       ← orchestrates extraction → storage → linking
  extract_pdf.py    ← PyMuPDF chunker (preserves page numbers)
  llm_extract.py    ← Anthropic tool-use extraction + LLM reconciler
  embeddings.py     ← sentence-transformers candidate matching
  normalize.py      ← period (FY24) and unit (INR_CR) normalization
  db.py             ← SQLite schema: documents, facts, relationships
  ingest_all.py     ← batch ingestion CLI
frontend/
  src/
    App.jsx                      ← main layout + polling
    api/client.js                ← fetch wrapper
    components/
      UploadZone.jsx             ← drag-and-drop PDF upload
      FactCard.jsx               ← fact list item
      EvidencePanel.jsx          ← evidence + linked facts sidebar
      RelationshipsPanel.jsx     ← cross-doc relationship browser
      RelationshipBadge.jsx      ← corroborates / contradicts / reconciled
      FactTypeBadge.jsx          ← colour-coded fact type label
verify_backend.py   ← 39-test verification suite (run to check setup)
```

### Pipeline flow

```
PDF
 └─ extract_pdf.py     → chunks (page number, text, type)
 └─ llm_extract.py     → structured facts via Claude tool use
 └─ normalize.py       → period_normalized, unit normalization
 └─ db.py              → INSERT into facts
 └─ embeddings.py      → all-MiniLM-L6-v2 embeddings → candidate pairs
 └─ llm_extract.py     → reconcile_fact_pair → relationship classification
 └─ db.py              → INSERT into relationships
```

---

## Requirements

- Python 3.13
- Node.js 18+
- An Anthropic API key

No Visual Studio Build Tools needed — all Python packages install from pre-built wheels.

---

## Setup

### 1. Clone and create .env

```bash
git clone <your-repo-url>
cd superjoin-assessment
cp .env.example .env
# edit .env and set ANTHROPIC_API_KEY=sk-ant-...
```

### 2. Python environment

```powershell
python -m venv .venv
.venv\Scripts\python.exe -m pip install -r backend\requirements.txt
```

If you hit a build error on `pydantic-core`, install pydantic separately first:
```powershell
.venv\Scripts\python.exe -m pip install pydantic==2.10.6 --only-binary=:all:
.venv\Scripts\python.exe -m pip install -r backend\requirements.txt --only-binary=:all:
```

### 3. Frontend

```powershell
cd frontend
npm install
cd ..
```

### 4. Verify setup

```powershell
.venv\Scripts\python.exe verify_backend.py
# Expected: Results: 39/39 passed  [ALL PASS]
```

---

## Running

### Start the backend

```powershell
cd backend
..\venv\Scripts\python.exe -m uvicorn main:app --reload --port 8000
```

Or from the project root:
```powershell
.venv\Scripts\python.exe -m uvicorn backend.main:app --reload --port 8000
```

### Start the frontend

In a second terminal:
```powershell
cd frontend
npm run dev
# opens at http://localhost:5173
```

---

## Ingesting PDFs

### Option A — Drag and drop in the UI

Open http://localhost:5173, drag PDFs onto the upload zone. Extraction runs in the background (check backend terminal for progress logs).

### Option B — Batch ingest from CLI

Copy PDFs into the `data/` folder first:
```
data/
  delhivery/
    delhivery-annual-report-fy24.pdf
    delhivery-ipo-prospectus.pdf
    ...
  india-macroeconomy/
    india-economic-survey-2024-25.pdf
    rbi-annual-report-2024-25.pdf
    imf-india-article-iv-2025.pdf
```

Then run:
```powershell
cd backend
..\venv\Scripts\python.exe ingest_all.py
```

The pipeline processes documents sequentially and prints progress:
```
Processing: delhivery-annual-report-fy24.pdf
[pipeline] ingesting delhivery-annual-report-fy24.pdf (94 pages, rounding=True)
[pipeline] 1240 chunks extracted
[pipeline] 187 raw facts from LLM
[pipeline] 183 facts stored
[pipeline] 45 candidate pairs
[pipeline] 31 relationships stored
```

---

## API reference

| Method | Path | Description |
|--------|------|-------------|
| GET | `/documents` | List all ingested documents |
| POST | `/documents` | Upload a PDF (multipart) — async processing |
| POST | `/documents/path` | Ingest PDF already on disk `{"filepath": "..."}` |
| GET | `/documents/{id}/facts` | All facts for a document |
| GET | `/facts` | List facts — filter by `fact_type`, `entity`, `period`, `source_doc` |
| GET | `/facts/{id}` | Single fact |
| GET | `/facts/{id}/relationships` | All relationships for a fact |
| GET | `/relationships` | List relationships — filter by `relationship_type` |

Interactive docs at http://localhost:8000/docs

---

## Design decisions

**SQLite over a graph DB** — the assignment says don't use a graph DB as core storage. SQLite is self-contained, works on Render/Railway free tier, and a `relationships` join table is enough for cross-document linking.

**Two-pass architecture** — embeddings (all-MiniLM-L6-v2) find candidate pairs cheaply; the LLM makes the actual relationship decision. This keeps LLM call count bounded.

**Incremental ingestion** — adding a new document only computes relationships between new facts and existing facts, not the full cross-product.

**Temporal reconciliation** — the reconciler is explicitly told to check `as_of_date`, `period`, `scope`, `estimate_or_actual`, and rounding disclaimers before classifying something as a contradiction. A director "active as of March 31" and "resigned July 1" → `reconciled_by_context`, not `contradicts`.

**No hardcoded facts** — all facts are extracted generically. The normalization layer ensures "81,415 INR million" and "8,141.5 INR Cr" map to the same base value for comparison.

---

## Relationship types

| Type | Meaning |
|------|---------|
| `corroborates` | Both facts state the same underlying thing (unit conversion and minor label differences accepted) |
| `contradicts` | Genuine conflict that cannot be explained by any contextual factor |
| `reconciled_by_context` | Facts look different but the difference is explained by scope (standalone vs consolidated), period, estimate vs actual, as-of date, or rounding disclaimer |

---

## Free deployment

**Render (recommended)**

Backend:
- New → Web Service → connect repo
- Build command: `pip install -r backend/requirements.txt`
- Start command: `uvicorn backend.main:app --host 0.0.0.0 --port $PORT`
- Add env var: `ANTHROPIC_API_KEY`

Frontend:
- New → Static Site → connect repo
- Build command: `cd frontend && npm install && npm run build`
- Publish directory: `frontend/dist`
- Add env var: `VITE_API_URL=https://your-backend.onrender.com`

SQLite file persists on Render's free tier ephemeral disk. For persistence across deploys, add a Render disk or switch `DB_PATH` to `/var/data/factlens.db`.

**Railway** — same pattern, add a volume at `/app/data` and set `DB_PATH=/app/data/factlens.db`.

---

## Known limitations

- sentence-transformers downloads `all-MiniLM-L6-v2` (~90MB) on first run
- Large PDFs (100+ pages) take several minutes to process — the UI polls every 8s and updates automatically
- Free-tier Render instances sleep after 15 min of inactivity; first request after sleep is slow
