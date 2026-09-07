#!/usr/bin/env python3
"""
Batch ingest all PDFs in the data/ directory.

Usage:
    python ingest_all.py              # uses ../data relative to this script
    python ingest_all.py path/to/dir  # custom data directory
"""

import sys
import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

sys.path.insert(0, os.path.dirname(__file__))

from db import init_db
from pipeline import ingest_document


def main():
    data_dir = (
        Path(sys.argv[1])
        if len(sys.argv) > 1
        else Path(__file__).parent.parent / "data"
    )

    if not data_dir.exists():
        print(f"ERROR: data dir not found: {data_dir}")
        sys.exit(1)

    pdfs = sorted(data_dir.rglob("*.pdf"))
    if not pdfs:
        print(f"No PDFs found in {data_dir}")
        sys.exit(1)

    print(f"Found {len(pdfs)} PDF(s):")
    for p in pdfs:
        print(f"  {p.relative_to(data_dir)}")

    init_db()
    print()

    for pdf in pdfs:
        print(f"{'='*60}")
        print(f"Processing: {pdf.name}")
        try:
            result = ingest_document(str(pdf))
            print(f"Result: {result}")
        except Exception as e:
            import traceback
            print(f"ERROR: {e}")
            traceback.print_exc()
        print()

    print("Done.")


if __name__ == "__main__":
    main()
