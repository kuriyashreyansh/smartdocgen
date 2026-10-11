import json
from pathlib import Path

from app.services.classifier import classify      # A1
from app.services.extractor import extract        # A1
from app.services.grounding import ground         # A2
from app.services.date_utils import normalize_date, pretty_date  # A2
from app.services.validator import validate       # A2

# Below this confidence we do not trust the document type
CONFIDENCE_THRESHOLD = 0.6

SEED_FILE = Path(__file__).parent.parent.parent / "seed" / "doc_types.json"


def load_doc_types():
    """Read all document types from doc_types.json."""
    with open(SEED_FILE, encoding="utf-8") as f:
        return json.load(f)


def parse_request(text, doc_type_override=None):
    """Run the full chain: text in, clean data and questions out.

    Steps: classify -> extract -> ground -> normalize dates -> validate.
    doc_type_override lets the UI force a type when the user picks one.
    """
    doc_types = load_doc_types()

    # Step 1: find the document type (A1)
    if doc_type_override:
        doc_type_id, confidence = doc_type_override, 1.0
    else:
        result = classify(text, doc_types)
        doc_type_id, confidence = result["doc_type"], result["confidence"]

    # Unsure: ask the user to choose instead of guessing
    if doc_type_id is None or confidence < CONFIDENCE_THRESHOLD:
        return {
            "doc_type": None,
            "confidence": confidence,
            "fields": {},
            "missing": [],
            "needs_doc_type": True,
            "options": [{"type_id": d["type_id"], "name": d["name"]} for d in doc_types],
        }

    doc_type = next(d for d in doc_types if d["type_id"] == doc_type_id)
    fields = doc_type["fields"]

    # Step 2: extract raw values (A1)
    raw = extract(text, fields)

    # Step 3: remove any value that is not in the user's text
    clean, removed = ground(raw, text, fields)

    # Step 4: turn date text into real dates
    relative_dates = []
    for f in fields:
        if f["type"] == "date" and clean.get(f["key"]):
            iso, is_relative = normalize_date(clean[f["key"]])
            if iso is None:
                clean[f["key"]] = None      # unreadable date, ask again
            else:
                clean[f["key"]] = iso
                if is_relative:
                    relative_dates.append(f["key"])

    # Step 5: find missing required fields and build questions
    check = validate(clean, fields)

    return {
        "doc_type": doc_type_id,
        "confidence": confidence,
        "fields": clean,
        "missing": check["missing"],
        "is_complete": check["is_complete"],
        "removed_by_grounding": removed,      # shown for transparency
        "confirm_dates": relative_dates,      # UI should ask the user to confirm
        "needs_doc_type": False,
    }