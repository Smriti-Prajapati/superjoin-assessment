"""
Normalizers for periods and units.

These run after LLM extraction to put facts into comparable form.
Original raw values are always preserved in the DB for display.
"""

import re


# ── period normalization ────────────────────────────────────────────────────

def normalize_period(raw: str | None) -> str | None:
    if not raw:
        return None
    s = raw.strip()

    # already clean: "FY24" or "Q4 FY24"
    if re.match(r"^(Q[1-4]\s+)?FY\d{2}$", s, re.IGNORECASE):
        return s.upper()

    # "Q4 FY24", "Q1 FY2025"
    m = re.search(r"\bQ([1-4])\s*FY\s*(\d{2,4})\b", s, re.IGNORECASE)
    if m:
        fy = str(m.group(2))[-2:]
        return f"Q{m.group(1)} FY{fy}"

    # "H1 FY25", "H2 FY24"
    m = re.search(r"\bH([12])\s*FY\s*(\d{2,4})\b", s, re.IGNORECASE)
    if m:
        fy = str(m.group(2))[-2:]
        return f"H{m.group(1)} FY{fy}"

    # "year ended March 31, 2024" → FY24 (Indian fiscal year ends March 31)
    m = re.search(r"year\s+end(?:ed|ing)\s+march\s+31,?\s*(20\d{2})", s, re.IGNORECASE)
    if m:
        year = int(m.group(1))
        return f"FY{year % 100:02d}"

    # "2024-25" or "2024–25" → FY25 (end year)
    m = re.search(r"\b(20\d{2})[-–](\d{2})\b", s)
    if m:
        return f"FY{m.group(2)}"

    # "FY 2024" or "FY2024"
    m = re.search(r"\bFY\s*(20\d{2})\b", s, re.IGNORECASE)
    if m:
        return f"FY{int(m.group(1)) % 100:02d}"

    # "fiscal 2024" or "fiscal year 2024"
    m = re.search(r"\bfiscal\s+(?:year\s+)?(20\d{2})\b", s, re.IGNORECASE)
    if m:
        return f"FY{int(m.group(1)) % 100:02d}"

    # "FY24" embedded in longer string
    m = re.search(r"\bFY\s*(\d{2})\b", s, re.IGNORECASE)
    if m:
        return f"FY{m.group(1)}"

    return s  # fallback: return as-is


# ── unit normalization ──────────────────────────────────────────────────────
# Base units: INR_CR (Indian rupees in crores), USD_MN, PERCENT, PP, BPS

_INR_UNIT_MAP: dict[str, tuple[str, float]] = {
    # crore variants
    "inr cr": ("INR_CR", 1.0),
    "₹ cr": ("INR_CR", 1.0),
    "rs. cr": ("INR_CR", 1.0),
    "rs cr": ("INR_CR", 1.0),
    "crore": ("INR_CR", 1.0),
    "crores": ("INR_CR", 1.0),
    "cr": ("INR_CR", 1.0),
    "inr crore": ("INR_CR", 1.0),
    "inr crores": ("INR_CR", 1.0),
    # million variants (1 million = 0.1 crore)
    "inr million": ("INR_CR", 0.1),
    "₹ million": ("INR_CR", 0.1),
    "rs. million": ("INR_CR", 0.1),
    "rs million": ("INR_CR", 0.1),
    "million": ("INR_CR", 0.1),
    "mn": ("INR_CR", 0.1),
    "inr mn": ("INR_CR", 0.1),
    "₹mn": ("INR_CR", 0.1),
    # lakh variants (1 lakh = 0.01 crore)
    "inr lakh": ("INR_CR", 0.01),
    "₹ lakh": ("INR_CR", 0.01),
    "lakh": ("INR_CR", 0.01),
    "lakhs": ("INR_CR", 0.01),
    # billion variants (1 billion = 100 crore)
    "inr billion": ("INR_CR", 100.0),
    "₹ billion": ("INR_CR", 100.0),
    "billion": ("INR_CR", 100.0),
    "bn": ("INR_CR", 100.0),
    # USD
    "usd million": ("USD_MN", 1.0),
    "$ million": ("USD_MN", 1.0),
    "usd mn": ("USD_MN", 1.0),
    "usd billion": ("USD_MN", 1000.0),
    "$ billion": ("USD_MN", 1000.0),
    # rates / percentages
    "percent": ("PERCENT", 1.0),
    "%": ("PERCENT", 1.0),
    "percentage points": ("PP", 1.0),
    "pp": ("PP", 1.0),
    "bps": ("BPS", 1.0),
    "basis points": ("BPS", 1.0),
}


def normalize_unit(raw_unit: str | None) -> tuple[str | None, float]:
    """Returns (normalized_unit_key, multiplier_to_base).
    Multiply the raw value by multiplier to get base-unit value."""
    if not raw_unit:
        return None, 1.0
    key = raw_unit.strip().lower()
    if key in _INR_UNIT_MAP:
        return _INR_UNIT_MAP[key]
    return raw_unit, 1.0


def to_base_value(value_str: str | None, unit: str | None) -> float | None:
    """Convert a value + unit to a base numeric value for comparison."""
    if value_str is None:
        return None
    try:
        cleaned = re.sub(r"[,\s₹$]", "", str(value_str))
        cleaned = re.sub(r"^(approx\.?|~|>|<|>=|<=)\s*", "", cleaned)
        # range "1.2-1.5" → midpoint
        if re.match(r"^\d[\d.]*-\d[\d.]*$", cleaned):
            a, b = cleaned.split("-")
            val = (float(a) + float(b)) / 2
        else:
            val = float(cleaned)
    except (ValueError, TypeError):
        return None
    _, multiplier = normalize_unit(unit)
    return val * multiplier


def values_are_close(v1: float, v2: float, tolerance: float = 0.02) -> bool:
    """True if two normalized values are within tolerance (default 2%)."""
    if v1 == 0 and v2 == 0:
        return True
    if v1 == 0 or v2 == 0:
        return abs(v1 - v2) < 0.001
    return abs(v1 - v2) / max(abs(v1), abs(v2)) <= tolerance
