def _is_empty(value):
    """True if the value is None or an empty/blank string."""
    return value is None or (isinstance(value, str) and not value.strip())


def make_question(field):
    """Build a human-friendly question for a missing field."""
    label = field["label"].lower()
    if field["type"] == "date":
        return f"On which date is the {label}?"
    if field["type"] == "number":
        return f"What is the {label}? (enter a number)"
    return f"What is the {label}?"


def _is_valid_number(value):
    """True if the value can be read as a number (e.g. 200 or '200')."""
    try:
        float(str(value).replace(",", ""))
        return True
    except ValueError:
        return False


def validate(data, fields):
    """Check the cleaned data against the document type's field list.

    data:   {"venue": None, "event_name": "TechFest", ...}
    fields: field list of this document type from doc_types.json
    Returns: {
        "is_complete": True/False,
        "missing": [{"key", "label", "question"}, ...]
    }
    A required field that is empty or has a wrong type goes to "missing",
    so the UI asks the user again instead of guessing.
    """
    missing = []

    for f in fields:
        value = data.get(f["key"])

        # Optional fields may stay empty
        if _is_empty(value):
            if f.get("required"):
                missing.append({
                    "key": f["key"],
                    "label": f["label"],
                    "question": make_question(f),
                })
            continue

        # A number field must really contain a number
        if f["type"] == "number" and not _is_valid_number(value):
            missing.append({
                "key": f["key"],
                "label": f["label"],
                "question": f"Please enter a valid number for {f['label'].lower()}.",
            })

    return {"is_complete": len(missing) == 0, "missing": missing}

import json
from app.services.validator import validate

# Load the real schema written earlier
with open("seed/doc_types.json", encoding="utf-8") as f:
    doc_types = json.load(f)

permission = next(d for d in doc_types if d["type_id"] == "permission_letter")

# Case 1: venue and coordinator are missing
data = {"club_name": "Coding Club", "event_name": "TechFest",
        "event_date": "2027-02-12", "venue": None,
        "expected_participants": 200, "faculty_coordinator": None}
print(validate(data, permission["fields"]))

# Case 2: everything is filled
data["venue"] = "Seminar Hall"
data["faculty_coordinator"] = "Prof. Mehta"
print(validate(data, permission["fields"]))