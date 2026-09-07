"""
Embedding-based candidate fact matching.

Uses sentence-transformers all-MiniLM-L6-v2 — runs locally, free, no API cost.
Embeddings are used only for candidate discovery; the LLM makes the final
relationship decision.
"""

import pickle
import numpy as np

_model = None


def _get_model():
    global _model
    if _model is None:
        from sentence_transformers import SentenceTransformer
        _model = SentenceTransformer("all-MiniLM-L6-v2")
    return _model


def embed_text(text: str) -> bytes:
    """Return embedding as bytes for SQLite BLOB storage."""
    model = _get_model()
    vec = model.encode(text, normalize_embeddings=True)
    return pickle.dumps(vec.astype(np.float32))


def decode_embedding(blob: bytes) -> np.ndarray:
    return pickle.loads(blob)


def fact_text_for_embedding(fact: dict) -> str:
    """Build a compact text representation of a fact for embedding."""
    parts = [
        fact.get("subject", ""),
        fact.get("entity", ""),
        fact.get("fact_type", ""),
        fact.get("period", "") or fact.get("period_normalized", ""),
        fact.get("scope", ""),
    ]
    return " | ".join(p for p in parts if p)


def find_candidate_pairs(
    new_facts: list[dict],
    existing_facts: list[dict],
    top_k: int = 5,
    similarity_threshold: float = 0.55,
) -> list[tuple[dict, dict, float]]:
    """
    For each new fact, find top-k most similar existing facts by cosine similarity.
    Returns list of (new_fact, existing_fact, similarity_score) above the threshold.
    """
    if not new_facts or not existing_facts:
        return []

    model = _get_model()
    new_texts = [fact_text_for_embedding(f) for f in new_facts]
    existing_texts = [fact_text_for_embedding(f) for f in existing_facts]

    new_emb = model.encode(new_texts, normalize_embeddings=True, batch_size=64)
    existing_emb = model.encode(existing_texts, normalize_embeddings=True, batch_size=64)

    # cosine similarity matrix: (new x existing)
    sim_matrix = new_emb @ existing_emb.T

    pairs = []
    for i, new_fact in enumerate(new_facts):
        sims = sim_matrix[i]
        top_indices = np.argsort(sims)[::-1][:top_k]
        for j in top_indices:
            score = float(sims[j])
            if score >= similarity_threshold:
                ef = existing_facts[j]
                # don't pair a fact with itself
                if ef.get("id") != new_fact.get("id"):
                    pairs.append((new_fact, ef, score))

    return pairs
