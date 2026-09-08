# -*- coding: utf-8 -*-
"""
Verify that fact.evidence_snippet actually appears on fact.page in the source PDF.
Checks 20 random facts from the DB.
Run: .venv\Scripts\python.exe verify_facts.py
"""
import sys, os, random
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "backend"))
os.environ.setdefault("DB_PATH", r"c:\Users\smrit\superjoin-assessment\backend\factlens.db")

from db import get_conn
import fitz

conn = get_conn()
facts = conn.execute(
    "SELECT f.id, f.subject, f.page, f.evidence_snippet, f.source_doc, d.filepath "
    "FROM facts f JOIN documents d ON f.document_id = d.id "
    "WHERE f.evidence_snippet IS NOT NULL AND f.page IS NOT NULL "
    "ORDER BY RANDOM() LIMIT 20"
).fetchall()
conn.close()

print(f"Checking {len(facts)} facts...\n")
ok = fail = mismatch = 0

for row in facts:
    fid, subject, page, snippet, source_doc, filepath = row
    snippet_clean = snippet.strip()[:80].lower()

    if not os.path.exists(filepath):
        # try uploads folder
        filepath = os.path.join(r"c:\Users\smrit\superjoin-assessment\backend\uploads", source_doc)

    if not os.path.exists(filepath):
        print(f"  SKIP  id={fid} | file not found: {source_doc}")
        continue

    try:
        doc = fitz.open(filepath)
        total_pages = doc.page_count

        if page < 1 or page > total_pages:
            print(f"  FAIL  id={fid} p.{page} out of range (doc has {total_pages} pages) | {subject[:50]}")
            fail += 1
            doc.close()
            continue

        page_text = doc[page - 1].get_text().lower()
        doc.close()

        needle = snippet_clean[:40]
        if needle in page_text:
            print(f"  OK    id={fid} p.{page} | {subject[:55]}")
            ok += 1
        else:
            # check adjacent pages (off-by-one is common)
            found_nearby = False
            doc2 = fitz.open(filepath)
            for adj in [page - 2, page, page]:  # already checked page-1 index above
                for delta in [-1, 0, 1]:
                    p = page - 1 + delta
                    if 0 <= p < total_pages:
                        if needle in doc2[p].get_text().lower():
                            found_nearby = True
                            actual_page = p + 1
                            break
                if found_nearby:
                    break
            doc2.close()

            if found_nearby:
                if actual_page != page:
                    print(f"  NEAR  id={fid} stored p.{page} but snippet on p.{actual_page} | {subject[:50]}")
                    mismatch += 1
                else:
                    ok += 1
            else:
                print(f"  MISS  id={fid} p.{page} snippet not found on page | {subject[:50]}")
                print(f"        snippet: {snippet_clean[:60]}")
                fail += 1
    except Exception as e:
        print(f"  ERR   id={fid}: {e}")
        fail += 1

print(f"\nResults: {ok} OK  |  {mismatch} page-off-by-one  |  {fail} not found")
