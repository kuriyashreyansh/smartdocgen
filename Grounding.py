import re
from rapidfuzz import fuzz

# 100 = exact match. 85 allows small spelling differences.
FUZZY_THRESHOLD = 85


def _clean(s):
    """Lowercase the text and remove punctuation and extra spaces."""
    return re.sub(r"\s+", " ", re.sub(r"[^\w\s]", " ", str(s).lower())).strip()


def _in_text(value, text):
    """Check whether the value appears in the user's text (exact or close match)."""
    v, t = _clean(value), _clean(text)
    if not v:
        return False
    if v in t:  # direct match
        return True
    # Fuzzy match to tolerate small spelling differences
    return fuzz.partial_ratio(v, t) >= FUZZY_THRESHOLD


def _number_in_text(value, text):
    """Check whether a number (e.g. 200) appears in the text as a number."""
    digits = str(value).replace(",", "").strip()
    text_digits = text.replace(",", "")
    return digits in re.findall(r"\d+(?:\.\d+)?", text_digits)


def ground(extracted, original_text, fields):
    """Verify every extracted value against the user's original text.

    extracted: {"venue": "Main Hall", "event_name": "TechFest", ...}
    fields:    the field list of this document type from doc_types.json
    Returns:   (clean_dict, removed_list)
               Values not found in the text are set to None and their
               keys are listed in removed_list (the "no guessing" rule).
    """
    types = {f["key"]: f["type"] for f in fields}
    clean, removed = {}, []

    for key, value in extracted.items():
        if value is None:
            clean[key] = None
            continue

        # Numbers are checked differently from text
        if types.get(key) == "number":
            ok = _number_in_text(value, original_text)
        else:
            ok = _in_text(value, original_text)

        if ok:
            clean[key] = value
        else:
            clean[key] = None  # the model invented it, so drop it
            removed.append(key)

    return clean, removed