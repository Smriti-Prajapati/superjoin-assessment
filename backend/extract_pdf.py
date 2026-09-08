"""
PDF text extraction using PyMuPDF — page-by-page, size-bounded chunks.

Each chunk is capped at ~800 characters so it fits comfortably inside a
Cohere prompt with many siblings. Page numbers are always preserved.
"""

import fitz
import re
from dataclasses import dataclass

MAX_CHUNK_CHARS = 800   # soft cap per chunk
MIN_CHUNK_CHARS = 40    # skip anything shorter


@dataclass
class Chunk:
    page: int
    text: str
    chunk_type: str  # "paragraph" | "table_row" | "heading"


# ── public API ───────────────────────────────────────────────────────────────

def extract_chunks(pdf_path: str) -> list[Chunk]:
    """Extract size-bounded chunks from every page, preserving page numbers."""
    doc = fitz.open(pdf_path)
    chunks: list[Chunk] = []

    for page_num, page in enumerate(doc, start=1):
        blocks = page.get_text("blocks", sort=True)
        page_chunks = _blocks_to_chunks(blocks, page_num)
        chunks.extend(page_chunks)

    doc.close()
    return chunks


def get_page_count(pdf_path: str) -> int:
    doc = fitz.open(pdf_path)
    n = doc.page_count
    doc.close()
    return n


def has_rounding_disclaimer(pdf_path: str) -> bool:
    doc = fitz.open(pdf_path)
    text = ""
    for page in doc:
        text += page.get_text()
        if len(text) > 60_000:
            break
    doc.close()
    return bool(re.search(r"rounding.{0,80}(totals?|figures?|sum)", text, re.IGNORECASE))


# ── internal helpers ─────────────────────────────────────────────────────────

def _blocks_to_chunks(blocks: list, page_num: int) -> list[Chunk]:
    """Convert raw PyMuPDF blocks into clean, size-bounded Chunk objects."""
    chunks: list[Chunk] = []

    for block in blocks:
        if block[6] != 0:          # skip image blocks
            continue
        raw = block[4].strip()
        if len(raw) < MIN_CHUNK_CHARS:
            continue

        chunk_type = _classify_block(raw)

        if chunk_type == "table_row":
            # split tables row-by-row first, then size-cap
            for row in _split_table_rows(raw):
                row = row.strip()
                if len(row) >= MIN_CHUNK_CHARS:
                    for sub in _size_cap(row, chunk_type, page_num):
                        chunks.append(sub)
        else:
            for sub in _size_cap(raw, chunk_type, page_num):
                chunks.append(sub)

    return chunks


def _size_cap(text: str, chunk_type: str, page: int) -> list[Chunk]:
    """Split text into MAX_CHUNK_CHARS pieces, breaking at sentence boundaries."""
    if len(text) <= MAX_CHUNK_CHARS:
        return [Chunk(page=page, text=text, chunk_type=chunk_type)]

    # try to split on sentence endings
    pieces: list[str] = []
    buf = ""
    for sentence in re.split(r'(?<=[.!?])\s+', text):
        if len(buf) + len(sentence) + 1 <= MAX_CHUNK_CHARS:
            buf = (buf + " " + sentence).strip()
        else:
            if buf:
                pieces.append(buf)
            # if a single sentence exceeds cap, hard-split
            if len(sentence) > MAX_CHUNK_CHARS:
                for i in range(0, len(sentence), MAX_CHUNK_CHARS):
                    pieces.append(sentence[i : i + MAX_CHUNK_CHARS])
                buf = ""
            else:
                buf = sentence
    if buf:
        pieces.append(buf)

    return [Chunk(page=page, text=p, chunk_type=chunk_type) for p in pieces if len(p) >= MIN_CHUNK_CHARS]


def _classify_block(text: str) -> str:
    lines = [l for l in text.split("\n") if l.strip()]
    if len(lines) >= 3:
        numeric = sum(1 for l in lines if re.search(r"[\d,\.]{2,}", l))
        if numeric / len(lines) > 0.4:
            return "table_row"
    if len(lines) == 1 and len(text) < 100:
        return "heading"
    return "paragraph"


def _split_table_rows(text: str) -> list[str]:
    lines = text.split("\n")
    rows: list[str] = []
    current: list[str] = []

    for line in lines:
        s = line.strip()
        if not s:
            if current:
                rows.append(" | ".join(current))
                current = []
            continue
        if current and re.match(r"^[A-Z\d(]", s) and re.search(r"\d", s):
            rows.append(" | ".join(current))
            current = [s]
        else:
            current.append(s)

    if current:
        rows.append(" | ".join(current))
    return rows
