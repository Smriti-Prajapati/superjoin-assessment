# -*- coding: utf-8 -*-
"""
Backend verification script.
Tests: module imports, db init, period normalization, unit conversion, values_are_close.
Run: .venv\Scripts\python.exe verify_backend.py
"""
import sys, os
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "backend"))

PASS = 0; FAIL = 0

def check(label, got, expected):
    global PASS, FAIL
    ok = got == expected
    if ok:
        PASS += 1
        print(f"  OK  {label}")
    else:
        FAIL += 1
        print(f"  FAIL {label}")
        print(f"       got:      {got!r}")
        print(f"       expected: {expected!r}")

def check_true(label, expr):
    global PASS, FAIL
    if expr:
        PASS += 1
        print(f"  OK  {label}")
    else:
        FAIL += 1
        print(f"  FAIL {label}")

# ── imports ──────────────────────────────────────────────────────────────────
print("\n=== Module imports ===")
try:
    from db import init_db, get_conn
    print("  OK  db")
except Exception as e:
    print(f"  FAIL db: {e}"); sys.exit(1)

try:
    from extract_pdf import extract_chunks, get_page_count, has_rounding_disclaimer, Chunk
    print("  OK  extract_pdf")
except Exception as e:
    print(f"  FAIL extract_pdf: {e}"); sys.exit(1)

try:
    from normalize import normalize_period, normalize_unit, to_base_value, values_are_close
    print("  OK  normalize")
except Exception as e:
    print(f"  FAIL normalize: {e}"); sys.exit(1)

try:
    from embeddings import fact_text_for_embedding, find_candidate_pairs
    print("  OK  embeddings (lazy model load)")
except Exception as e:
    print(f"  FAIL embeddings: {e}"); sys.exit(1)

# ── db init ───────────────────────────────────────────────────────────────────
print("\n=== Database init ===")
import tempfile
with tempfile.TemporaryDirectory() as tmp:
    os.environ["DB_PATH"] = os.path.join(tmp, "test.db")
    import importlib, db as db_mod
    importlib.reload(db_mod)
    from db import init_db as _init, get_conn as _conn
    _init()
    c = _conn()
    tables = {r[0] for r in c.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()}
    c.close()
    for t in ("documents", "facts", "relationships"):
        check_true(f"table '{t}' created", t in tables)

# ── period normalization ──────────────────────────────────────────────────────
print("\n=== Period normalization ===")
PERIOD_CASES = [
    ("FY24",                        "FY24"),
    ("FY 2024",                     "FY24"),
    ("year ended March 31, 2024",   "FY24"),
    ("year ending March 31, 2025",  "FY25"),
    ("year ended March 31, 2023",   "FY23"),
    ("2024-25",                     "FY25"),
    ("2023-24",                     "FY24"),
    ("fiscal 2024",                 "FY24"),
    ("fiscal year 2025",            "FY25"),
    ("Q4 FY24",                     "Q4 FY24"),
    ("Q1 FY25",                     "Q1 FY25"),
    ("Q4 FY2024",                   "Q4 FY24"),
    ("H1 FY25",                     "H1 FY25"),
    ("H2 FY24",                     "H2 FY24"),
    (None,                          None),
]
for raw, expected in PERIOD_CASES:
    check(f"normalize_period({raw!r})", normalize_period(raw), expected)

# ── unit normalization ────────────────────────────────────────────────────────
print("\n=== Unit normalization ===")
UNIT_CASES = [
    ("INR million",  "INR_CR", 0.1),
    ("crore",        "INR_CR", 1.0),
    ("lakh",         "INR_CR", 0.01),
    ("%",            "PERCENT", 1.0),
    ("bps",          "BPS",    1.0),
    (None,           None,      1.0),
]
for raw, exp_key, exp_mult in UNIT_CASES:
    key, mult = normalize_unit(raw)
    check(f"normalize_unit({raw!r}) -> key",  key,  exp_key)
    check(f"normalize_unit({raw!r}) -> mult", mult, exp_mult)

# ── to_base_value + values_are_close ─────────────────────────────────────────
print("\n=== Value conversion & comparison ===")

v1 = to_base_value("81415",   "INR million")   # -> 8141.5 INR_CR
v2 = to_base_value("8141.5",  "INR Cr")        # -> 8141.5 INR_CR  (exact same)
v3 = to_base_value("8142",    "INR Cr")        # within 2%
v4 = to_base_value("7900",    "INR Cr")        # >2% off (7900 vs 8141.5 = 3% diff)
vs = to_base_value("74540.82","INR million")   # standalone
vc = to_base_value("81415.38","INR million")   # consolidated

check_true("81415 INR mn == 8141.5 Cr (exact)",         values_are_close(v1, v2))
check_true("81415 INR mn ~= 8142 Cr (rounding ok)",     values_are_close(v1, v3))
check_true("81415 INR mn != 7900 Cr (>2% diff)",        not values_are_close(v1, v4))
check_true("standalone 74540 != consolidated 81415",    not values_are_close(vs, vc))

p1 = to_base_value("7.6", "%")
p2 = to_base_value("7.6", "percent")
check_true("7.6% == 7.6 percent", values_are_close(p1, p2))

# ── fact_text_for_embedding ───────────────────────────────────────────────────
print("\n=== Embedding text builder ===")
fact = {
    "subject":          "Revenue from operations",
    "entity":           "Delhivery Limited",
    "fact_type":        "financial_metric",
    "period":           "FY24",
    "period_normalized":"FY24",
    "scope":            "consolidated",
}
txt = fact_text_for_embedding(fact)
check_true("embedding text non-empty",          len(txt) > 0)
check_true("embedding text contains subject",   "Revenue" in txt)
check_true("embedding text contains entity",    "Delhivery" in txt)
check_true("embedding text contains period",    "FY24" in txt)

# ── summary ───────────────────────────────────────────────────────────────────
print(f"\n{'='*45}")
total = PASS + FAIL
status = "ALL PASS" if FAIL == 0 else f"{FAIL} FAILED"
print(f"Results: {PASS}/{total} passed  [{status}]")
sys.exit(0 if FAIL == 0 else 1)
