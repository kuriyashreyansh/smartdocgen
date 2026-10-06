from app.services.classifier import classify
from app.services.extractor import extract

import json, hashlib, os

CACHE = "llm_cache.json"
_cache = json.load(open(CACHE)) if os.path.exists(CACHE) else {}

def cached(fn, *args):
    key = hashlib.md5((fn.__name__ + json.dumps(args, sort_keys=True)).encode()).hexdigest()
    if key not in _cache:
        _cache[key] = fn(*args)
        json.dump(_cache, open(CACHE, "w"))
    return _cache[key]
DOC_TYPES = [
    {"type_id": "permission_letter", "description": "Letter asking college authorities for permission to hold an event"},
    {"type_id": "invitation_notice", "description": "Notice or invitation announcing an event to students"},
    {"type_id": "sponsorship_letter", "description": "Letter asking a company to sponsor an event"},
    {"type_id": "budget_request", "description": "Request for funds listing expected expenses for an event"},
]

FIELDS = [
    {"key": "event_name", "type": "text", "label": "Event name"},
    {"key": "event_date", "type": "date", "label": "Event date"},
    {"key": "venue", "type": "text", "label": "Venue"},
    {"key": "expected_participants", "type": "number", "label": "Expected participants"},
    {"key": "faculty_coordinator", "type": "text", "label": "Faculty coordinator"},
]

CLASSIFY_TESTS = [
    "Need a permission letter for TechFest on 12 Feb in Seminar Hall",
    "Write an invitation for our coding contest next week",
    "We want to ask Infosys to sponsor our hackathon",
    "Prepare a budget request for the annual fest",
    "need something for the event",
]

EXTRACT_TESTS = [
    "Permission letter for TechFest 2027 on 12 Feb in Seminar Hall, around 200 participants",
    "Permission letter for TechFest on 12 Feb",
    "Permission letter for our fest, coordinator is Prof. Mehta",
]

print("=== CLASSIFY ===")
for t in CLASSIFY_TESTS:
    print(t, "->", classify(t, DOC_TYPES))

print("\n=== EXTRACT ===")
for t in EXTRACT_TESTS:
    print(t)
    print("  ", extract(t, FIELDS))