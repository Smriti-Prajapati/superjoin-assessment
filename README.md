# FactLens- Fact Knowledge Layer

FactLens extracts meaningful facts from PDFs, grounds every fact in source evidence, and automatically identifies where documents corroborate, contradict, or reconcile through context.

Built for the Superjoin VIT 2026 Engineering Intern assignment.

---

## Video Demo

> [**Watch the FactLens Demo**](https://www.loom.com/share/820a593a61f24b98aca4f3f4d72f7870)

## Screenshots

<img width="1919" height="1003" alt="image" src="https://github.com/user-attachments/assets/2146f60d-40ca-45dc-888c-77849707fddf" />

---

## Setup

**Requirements:** Python 3.13, Node.js 18+, and a free Cohere API key.

### Clone the Repository

```bash
git clone https://github.com/Smriti-Prajapati/superjoin-assessment.git
cd superjoin-assessment
```

### Configure Environment

```bash
cp .env.example .env
```

Add your Cohere API key to `.env`:

```text
COHERE_API_KEY=your_api_key_here
```

### Backend

Create the Python virtual environment and install dependencies:

```bash
python -m venv .venv
.venv\Scripts\python.exe -m pip install -r backend/requirements.txt --only-binary=:all:
```

### Frontend

```bash
cd frontend
npm install
```

### Run

Open two terminals.

**Terminal 1 — Backend:**

```bash
cd backend
..\.venv\Scripts\python.exe -m uvicorn main:app --port 8000
```

**Terminal 2 — Frontend:**

```bash
cd frontend
npm run dev
```

Open the application at:

```text
http://localhost:5173
```

Upload PDFs using the upload zone.

---

## The Four Cases

### 1. Corroborated

Delhivery shipment volumes appear in both the IPO prospectus and FY24 annual report. Same entity, same metric, and consistent values → corroborated.

### 2. Contradicted

A metric is reported at two different values with no period, scope, or unit difference to explain it. Two contradicted pairs are visible in the UI.

### 3. Reconciled by Context

Delhivery standalone revenue (₹74,540 Mn) vs consolidated revenue (₹81,415 Mn), for the same period. The reconciler identifies the specific contextual field and explains why the values are not contradictory.

### 4. Extraction Failure, Documented

Approximately 50% of sampled facts had incorrect page numbers. The evidence text remains correct; page attribution can fail when snippets span chunk boundaries.

A potential fix is to ask the LLM to return explicit `[Page N]` markers.

---

### Key Engineering Decisions

- **Two-pass comparison** — embeddings find candidate pairs first, then the LLM is used only for candidate relationship analysis, avoiding an O(n²) all-pairs LLM comparison.

- **Incremental processing** — new documents are compared against the existing fact layer without rebuilding all existing knowledge.

- **Dynamic fact types** — the LLM proposes fact types dynamically rather than using a fixed enum, allowing the system to work across different domains.

- **Four relationship types** — `corroborated`, `contradicted`, `reconciled`, and `related`. The `related` category prevents unrelated facts from being incorrectly classified as reconciled.

- **SQLite over graph DB** — a relationships table using `fact_id_a` and `fact_id_b` provides the required relationship queries without adding the complexity of a graph database.

---

## Fact Representation

Each extracted fact contains structured information such as:

```json
{
  "subject": "...",
  "predicate": "...",
  "value": "...",
  "unit": "...",
  "period": "...",
  "scope": "...",
  "source_document": "...",
  "page": "...",
  "evidence": "...",
  "confidence": "..."
}
```

The schema is intentionally generic so that the system can process different types of documents and facts without document-specific rules.

---

## Evidence Grounding

Every extracted fact is linked to its source document and evidence snippet.

The Evidence Panel provides:

- Source document
- Page number
- Exact evidence snippet
- Period
- Scope
- Confidence
- Related facts
- Relationship reasoning

This allows users to trace an extracted fact back to its original source.

---

## Limitations and Next Steps

### Current Limitations

- **Page attribution** — approximately 50% of sampled facts had incorrect page numbers, although the evidence text remains correct.

- **Scanned/image-only PDFs** — currently not supported because the system requires an extractable text layer.

- **Free Cohere tier** — rate limits can make processing large PDFs slower. A 100-page PDF may take approximately 3–5 minutes depending on document size and number of extracted chunks.

- **Fact deduplication** — the same fact may occasionally appear more than once when overlapping chunks contain the same information.

### Next Steps

- Improve page attribution using explicit `[Page N]` markers.
- Add fact deduplication.
- Add human feedback for relationship labels.
- Support JSON/CSV export.
- Further optimize large-document processing.

---

## AI Tools Used

- **Cohere** — structured fact extraction, embeddings, and relationship reasoning.
- **ChatGPT** — used for exploring implementation approaches, debugging, documentation, and improving the application.

AI tools were used as development aids and as part of the fact extraction and reasoning workflow. The final architecture, data flow, UI, and engineering decisions were implemented and tested as part of the project.

---

## Technology Stack

- **Frontend:** React
- **Backend:** FastAPI
- **Database:** SQLite
- **PDF Processing:** PyMuPDF
- **LLM / Embeddings:** Cohere

---

## Additional Notes

FactLens is designed as a prototype Fact Knowledge Layer rather than a general-purpose document chatbot.

The primary focus is on:

1. Discovering meaningful facts.
2. Grounding facts in source evidence.
3. Comparing facts across documents.
4. Identifying corroboration and contradiction.
5. Explaining apparent contradictions through context.
6. Preserving uncertainty and documenting extraction failures.

The system is designed to accept new PDFs without relying on hardcoded document-specific facts, filenames, or rules.