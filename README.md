# FactLens

FactLens extracts meaningful facts from PDFs, grounds every fact in source evidence, and automatically identifies where documents corroborate, contradict, or reconcile each other through context.

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
# paste your COHERE_API_KEY in .env
```

```bash
# backend
python -m venv .venv
.venv\Scripts\python.exe -m pip install -r backend/requirements.txt --only-binary=:all:

# frontend
cd frontend && npm install
```

```bash
# run — two terminals
cd backend && ..\venv\Scripts\python.exe -m uvicorn main:app --port 8000
cd frontend && npm run dev
```

Open **http://localhost:5173** and drop PDFs onto the upload zone.

---

## The Four Cases

**1. Corroborated** — Delhivery shipment volumes appear in both the IPO prospectus and FY24 annual report. Same entity, same metric, consistent values → corroborates.

**2. Contradicted** — A metric at two different values with no period, scope, or unit difference to explain it. 2 contradicted pairs visible in the UI.

**3. Reconciled by context** — Delhivery standalone revenue (₹74,540 Mn) vs consolidated (₹81,415 Mn), same period. The reconciler names the specific field — it won't output "reconciled" without a reason.

**4. Extraction failure, documented** — ~50% of sampled facts had wrong page numbers. Evidence text is always correct; the page attribution heuristic fails when snippets span chunk boundaries. Fix: ask the LLM to return `[Page N]` markers directly.

---

## Approach

PDFs → PyMuPDF chunks → fact-dense filter → Cohere Chat extracts structured facts → Cohere Embed finds candidate pairs → Cohere Chat classifies each pair → SQLite.

- **Two-pass** — embeddings find candidates cheaply, LLM only runs on those (O(k·n) not O(n²))
- **Incremental** — new docs only compare against existing facts, never a full rebuild
- **Dynamic fact types** — the LLM proposes types freely, no fixed enum, works on any domain
- **Four relationship types** — added `related` to prevent mislabeling unrelated facts as reconciled
- **SQLite over graph DB** — a relationships table with `fact_id_a/b` handles every query needed here

---

## Limitations and Next Steps

- Page numbers ~50% wrong in a sample — evidence text is always correct
- Scanned/image-only PDFs not supported (text layer required)
- Free Cohere tier (10 calls/min) means a 100-page PDF takes 3–5 minutes
- No fact deduplication — same fact can appear twice across overlapping chunks

Next: better page attribution via `[Page N]` markers, deduplication, human feedback on relationship labels, JSON/CSV export.
