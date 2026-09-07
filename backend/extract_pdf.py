"""
PDF text extraction using PyMuPDF.

Chunks by logical blocks (paragraphs, table rows, headings) rather than fixed
token windows. Each chunk carries its page number for precise evidence citation.
"""

import fitz  # pymupdf
import re
from dataclasses import dataclass


@dataclass
class Chunk:
    page: int
    text: str
    chunk_type: str  # "paragraph" | "table_row" | "heading"


def extract_chunks(pdf_path: str) -> list[Chunk]:
    doc = fitz.open(pdf_path)
    chunks = []

    for page_num, page in enumerate(doc, start=1):
        # sort=True sorts blocks top-to-bottom, left-to-right
        blocks = page.get_text("blocks", sort=True)
        # block format: (x0, y0, x1, y1, text, block_no, block_type)
        # block_type 0 = text, 1 = image

        for block in blocks:
            if block[6] != 0:  # skip image blocks
                continue
            raw = block[4].strip()
            if not raw or len(raw) < 10:
                continue

            chunk_type = _classify_block(raw)

            if chunk_type == "table_row":
                for row in _split_table_rows(raw):
                    if row.strip():
                        chunks.append(Chunk(page=page_num, text=row.strip(), chunk_type="table_row"))
            else:
                chunks.append(Chunk(page=page_num, text=raw, chunk_type=chunk_type))

    doc.close()
    return chunks


def _classify_block(text: str) -> str:
    lines = [l for l in text.split("\n") if l.strip()]
    if len(lines) >= 3:
        numeric_lines = sum(1 for l in lines if re.search(r"[\d,\.]{2,}", l))
        if numeric_lines / len(lines) > 0.4:
            return "table_row"
    if len(lines) == 1 and len(text) < 100:
        return "heading"
    return "paragraph"


def _split_table_rows(text: str) -> list[str]:
    """Split a multi-line table block into individual rows."""
    lines = text.split("\n")
    rows = []
    current: list[str] = []

    for line in lines:
        stripped = line.strip()
        if not stripped:
            if current:
                rows.append(" | ".join(current))
                current = []
            continue
        # new row heuristic: starts with capital or digit and contains a number
        if current and re.match(r"^[A-Z\d(]", stripped) and re.search(r"\d", stripped):
            rows.append(" | ".join(current))
            current = [stripped]
        else:
            current.append(stripped)

    if current:
        rows.append(" | ".join(current))
    return rows


def get_page_count(pdf_path: str) -> int:
    doc = fitz.open(pdf_path)
    n = doc.page_count
    doc.close()
    return n


def has_rounding_disclaimer(pdf_path: str) -> bool:
    """Check if the PDF mentions a rounding disclaimer near financial tables."""
    doc = fitz.open(pdf_path)
    text = ""
    for page in doc:
        text += page.get_text()
        if len(text) > 50000:
            break
    doc.close()
    return bool(re.search(r"rounding.{0,80}(totals?|figures?|sum)", text, re.IGNORECASE))
