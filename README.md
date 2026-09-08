# FactLens

Extract facts from PDFs, link them to source evidence, and find where they agree, conflict, or need context to make sense.

Built for the Superjoin VIT 2026 Engineering Intern assignment.

---

## Demo

> **[add your demo video link here]**

---

## Setup

**You need:** Python 3.13, Node.js 18+, a free [Cohere API key](https://dashboard.cohere.com) (no card needed)

```bash
git clone https://github.com/Smriti-Prajapati/superjoin-assessment.git
cd superjoin-assessment
cp .env.example .env
# open .env and paste your COHERE_API_KEY
```

**Backend:**
```bash
python -m venv .venv
.venv\Scripts\python.exe -m pip install -r backend/requirements.txt --only-binary=:all:
```

**Frontend:**
```bash
cd frontend && npm install
```

**Run:**
```bash
# terminal 1
cd backend && ..\venv\Scripts\python.exe -m uvicorn main:app --port 8000

# terminal 2
cd frontend && npm run dev
```

Open **http://localhost:5173**, drag PDFs onto the upload zone. Facts appear as they're extracted — no need to wait for the whole doc.

For batch processing: `python backend/ingest_all.py`

---

## The Four Cases

All visible in the **Relationships** tab after processing the PDFs.

**1. Corroborated** — Delhivery's market share and shipment volume numbers appear in both the IPO prospectus and the FY24 annual report. Same entity, same metric, consistent numbers → marked corroborates.

**2. Contradicted** — A metric stated at two genuinely different values across documents with no period, scope, or unit difference to explain it. The UI shows 2 contradicted pairs.

**3. Reconciled by context** — The largest group (200+ pairs). Examples: Delhivery standalone revenue (₹74,540 mn) vs consolidated (₹81,415 mn) — explained by scope. FY23 vs FY24 figures for the same metric — explained by period. The reconciler is required to name the specific field in its explanation, it won't just say "reconciled" without a reason.

**4. Extraction failure, documented** — `verify_facts.py` found that ~10/20 sampled facts had wrong page numbers. The evidence snippet is always verbatim and correct, but the page number can be off. Root cause: the LLM extracts from batches of 30 chunks spanning multiple pages, and the page-attribution heuristic fails when snippets don't match chunk text exactly. I improved the search (progressive needle lengths + word-frequency fallback) but the fix only applies to new ingestions. What I'd do properly: ask the LLM to return which `[Page N]` marker the evidence came from.

---

## Approach

PDFs → PyMuPDF chunks (≤800 chars, page numbers preserved) → filter to fact-dense chunks → Cohere Chat extracts structured facts in batches → Cohere Embed finds candidate pairs → Cohere Chat classifies each pair as corroborates / contradicts / reconciled / related → stored in SQLite.

**Things I thought about:**

- **Two-pass instead of all-pairs** — embeddings cheaply find candidates, LLM only runs on those. Keeps API calls to O(k·n) not O(n²).
- **Incremental** — new doc only compares against existing facts, never rebuilds. Adding doc 6 doesn't re-process docs 1–5.
- **Dynamic fact types** — the LLM can propose new types (it's not a fixed enum). Works on any domain without code changes.
- **Four relationship types not three** — added `related` for facts that share a subject but aren't actually comparable (different transactions, different metrics). Without this, the reconciler mislabels unrelated facts as "reconciled".
- **Serialized queue** — one PDF at a time so two docs don't race on the Cohere rate limit.
- **SQLite not a graph DB** — the assignment explicitly says graph DB alone isn't the answer. A relationships table with fact_id_a/b is sufficient for everything needed here.

---

## Limitations and what I'd fix

- Page numbers are sometimes wrong (~50% in a sample) — evidence text is always correct
- Scanned/image PDFs won't work — text layer only
- Cohere free tier is 10 calls/min so a 100-page PDF takes 3–5 minutes
- Some `reconciled` pairs should probably be `related` — the prompt is better now but not perfect
- No deduplication — the same fact can get extracted twice if it appears in two overlapping chunks

**Next up:**
- Better page attribution by returning `[Page N]` markers from the LLM
- Fact deduplication before storage
- Human feedback to correct wrong relationship labels
- Export to JSON/CSV
