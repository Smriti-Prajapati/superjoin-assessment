import sys, os
sys.path.insert(0, r"c:\Users\smrit\superjoin-assessment\backend")
os.environ["DB_PATH"] = r"c:\Users\smrit\superjoin-assessment\backend\factlens.db"
from dotenv import load_dotenv
load_dotenv(r"c:\Users\smrit\superjoin-assessment\.env")

from db import get_conn, init_db
# clear previous failed run
conn = get_conn()
conn.execute("DELETE FROM relationships")
conn.execute("DELETE FROM facts")
conn.execute("DELETE FROM documents")
conn.commit()
conn.close()
print("DB cleared")

init_db()
from pipeline import ingest_document
pdf = r"c:\Users\smrit\superjoin-assessment\backend\uploads\01-delhivery-prospectus-2022-excerpt.pdf"
print(f"Starting: {pdf}")
result = ingest_document(pdf)
print("Result:", result)
