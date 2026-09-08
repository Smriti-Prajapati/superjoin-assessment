"""
Embedding-based candidate fact matching using Cohere Embed v3.

Cohere embed-english-v3.0 is used in batches (max 96 texts per call).
Embeddings are cached in the SQLite BLOB column so re-processing skips
the API entirely.

Falls back to sentence-transformers (local) if no COHERE_API_KEY is set.
"""

import os
import pickle
import time
import httpx
import numpy as np

COHERE_API_KEY = os.environ.get("COHERE_API_KEY", "")
EMBED_URL = "https://api.cohere.com/v2/embed"
EMBED_MODEL = "embed-english-v3.0"
EMBED_BATCH = 90          # Cohere max is 96, stay a little under
EMBED_INTERVAL = 1.0      # seconds between embed calls (free tier is lenient)

_local_model = None


# ── public helpers ────────────────────────────────────────────────────────────

def fact_text_for_embedding(fact: dict) -> str:
    """Compact text representation used for both storage and comparison."""
    parts = [
        fact.get("subject", ""),
        fact.get("entity", ""),
        fact.get("fact_type", ""),
        fact.get("period", "") or fact.get("period_normalized", ""),
        fact.get("scope", ""),
    ]
    return " | ".join(p for p in parts if p)


def embed_text(text: str) -> bytes:
    """Embed a single string and return as pickle bytes for SQLite."""
    vecs = embed_texts([text])
    return pickle.dumps(vecs[0].astype(np.float32))


def embed_texts(texts: list[str]) -> list[np.ndarray]:
    """Embed a list of strings. Uses Cohere if key present, else local model."""
    if COHERE_API_KEY:
        return _cohere_embed(texts)
    return _local_embed(texts)


def decode_embedding(blob: bytes) -> np.ndarray:
    return pickle.loads(blob)


# ── candidate pair finding ────────────────────────────────────────────────────

def find_candidate_pairs(
    new_facts: list[dict],
    existing_facts: list[dict],
    top_k: int = 5,
    similarity_threshold: float = 0.50,
) -> list[tuple[dict, dict, float]]:
    """
    For each new fact, find top_k most similar existing facts.
    Returns (new_fact, existing_fact, score) tuples above the threshold.

    Reuses cached embeddings from the `embedding` field when present,
    only calling the API for facts without one.
    """
    if not new_facts or not existing_facts:
        return []

    new_emb = _get_or_compute_embeddings(new_facts)
    existing_emb = _get_or_compute_embeddings(existing_facts)

    # cosine similarity (already normalised)
    sim_matrix = new_emb @ existing_emb.T

    pairs: list[tuple[dict, dict, float]] = []
    for i, nf in enumerate(new_facts):
        sims = sim_matrix[i]
        top_idx = np.argsort(sims)[::-1][:top_k]
        for j in top_idx:
            score = float(sims[j])
            if score >= similarity_threshold:
                ef = existing_facts[j]
                if ef.get("id") != nf.get("id"):
                    pairs.append((nf, ef, score))

    return pairs


# ── internal ──────────────────────────────────────────────────────────────────

def _get_or_compute_embeddings(facts: list[dict]) -> np.ndarray:
    """Return (n, dim) matrix. Uses cached blob when available."""
    cached: dict[int, np.ndarray] = {}
    missing_idx: list[int] = []

    for i, f in enumerate(facts):
        blob = f.get("embedding")
        if blob:
            try:
                cached[i] = decode_embedding(blob)
                continue
            except Exception:
                pass
        missing_idx.append(i)

    if missing_idx:
        texts = [fact_text_for_embedding(facts[i]) for i in missing_idx]
        vecs = embed_texts(texts)
        for idx, vec in zip(missing_idx, vecs):
            cached[idx] = vec

    # stack in original order
    dim = next(iter(cached.values())).shape[0]
    matrix = np.zeros((len(facts), dim), dtype=np.float32)
    for i, vec in cached.items():
        matrix[i] = vec
    return matrix


_last_embed_call: float = 0.0

def _cohere_embed(texts: list[str]) -> list[np.ndarray]:
    """Call Cohere Embed in batches, return list of unit-norm vectors."""
    global _last_embed_call
    results: list[np.ndarray] = []

    for start in range(0, len(texts), EMBED_BATCH):
        batch = texts[start : start + EMBED_BATCH]

        # respect rate limit
        elapsed = time.time() - _last_embed_call
        if elapsed < EMBED_INTERVAL:
            time.sleep(EMBED_INTERVAL - elapsed)

        for attempt in range(3):
            try:
                r = httpx.post(
                    EMBED_URL,
                    headers={"Authorization": f"Bearer {COHERE_API_KEY}", "Content-Type": "application/json"},
                    json={"texts": batch, "model": EMBED_MODEL, "input_type": "search_document"},
                    timeout=30,
                )
                _last_embed_call = time.time()
                if r.status_code == 429:
                    time.sleep(30)
                    continue
                r.raise_for_status()
                data = r.json()
                vecs = [np.array(e, dtype=np.float32) for e in data["embeddings"]["float"]]
                # normalise
                for v in vecs:
                    norm = np.linalg.norm(v)
                    if norm > 0:
                        v /= norm
                results.extend(vecs)
                break
            except Exception as e:
                print(f"[embeddings] cohere embed error (attempt {attempt+1}): {e}")
                if attempt < 2:
                    time.sleep(5)
                else:
                    # fallback: zero vectors for this batch
                    results.extend([np.zeros(1024, dtype=np.float32)] * len(batch))

    return results


def _local_embed(texts: list[str]) -> list[np.ndarray]:
    global _local_model
    if _local_model is None:
        from sentence_transformers import SentenceTransformer
        _local_model = SentenceTransformer("all-MiniLM-L6-v2")
    vecs = _local_model.encode(texts, normalize_embeddings=True, batch_size=64)
    return list(vecs)
