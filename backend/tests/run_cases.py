import sys
import time
from pathlib import Path

# Make "app" importable when running from the backend folder
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.services.pipeline import parse_request

# Each case: text, expected doc_type (None = must ask the user),
# fields that MUST be filled, fields that MUST be None (never invented)
CASES = [
    # --- Complete requests ---
    {"text": "Permission letter for TechFest on 12 Feb in Seminar Hall, coordinator Prof. Mehta, Coding Club",
     "type": "permission_letter",
     "filled": ["event_name", "venue", "incharge_name"], "empty": []},
    {"text": "Permission letter for Hackathon on 5 March at Main Auditorium, around 150 participants",
     "type": "permission_letter",
     "filled": ["event_name", "venue", "expected_participants"], "empty": ["incharge_name"]},

    # --- Incomplete: must NOT invent ---
    {"text": "Permission letter for TechFest on 12 Feb",
     "type": "permission_letter",
     "filled": ["event_name"], "empty": ["venue", "incharge_name"]},
    {"text": "Permission letter for our fest",
     "type": "permission_letter",
     "filled": [], "empty": ["venue", "event_date", "incharge_name"]},
    {"text": "Need a permission letter, coordinator is Prof. Sharma",
     "type": "permission_letter",
     "filled": ["incharge_name"], "empty": ["event_name", "venue", "event_date"]},
    {"text": "Permission letter for Robotics Workshop in Lab 3",
     "type": "permission_letter",
     "filled": ["venue"], "empty": ["event_date", "incharge_name"]},

    # --- Other document types ---
    {"text": "Invitation notice for Cultural Night on 20 March at Open Air Theatre at 6 pm",
     "type": "invitation_notice",
     "filled": ["event_name", "venue"], "empty": ["contact_person"]},
    {"text": "Write an invitation for our coding contest",
     "type": "invitation_notice",
     "filled": [], "empty": ["venue", "contact_person"]},
    {"text": "Budget request of 25000 rupees for TechFest on 12 Feb for prizes and food, coordinator Prof. Mehta",
     "type": "budget_request",
     "filled": ["event_name", "total_amount"], "empty": []},
    {"text": "We need funds for the annual fest",
     "type": "budget_request",
     "filled": [], "empty": ["total_amount", "faculty_coordinator"]},

    # --- Misleading wording ---
    {"text": "Permission letter for event in Mehta Auditorium",
     "type": "permission_letter",
     "filled": ["venue"], "empty": ["incharge_name"]},
    {"text": "Permission letter for TechFest, expected participants not decided",
     "type": "permission_letter",
     "filled": ["event_name"], "empty": ["expected_participants"]},

    # --- Hinglish ---
    {"text": "kal ke liye seminar hall ka permission letter chahiye",
     "type": "permission_letter",
     "filled": ["venue"], "empty": ["event_name", "incharge_name"]},

    # --- Typos ---
    {"text": "permision leter for TechFest on 12 Feb in Seminar Hall",
     "type": "permission_letter",
     "filled": ["event_name"], "empty": ["incharge_name"]},

    # --- Vague: must ask the user to choose a type ---
    {"text": "need something for the event", "type": None, "filled": [], "empty": []},
    {"text": "hello", "type": None, "filled": [], "empty": []},
]


def run():
    passed = 0
    for i, case in enumerate(CASES, 1):
        problems = []
        try:
            out = parse_request(case["text"])
        except Exception as e:
            print(f"[{i:02}] ERROR: {case['text']}\n     {e}")
            continue

        if out["doc_type"] != case["type"]:
            problems.append(f"type expected {case['type']} got {out['doc_type']}")

        fields = out.get("fields", {})
        for k in case["filled"]:
            if not fields.get(k):
                problems.append(f"{k} should be filled")
        for k in case["empty"]:
            if fields.get(k):
                problems.append(f"{k} was INVENTED: {fields.get(k)}")

        if problems:
            print(f"[{i:02}] FAIL: {case['text']}")
            for p in problems:
                print("     -", p)
        else:
            passed += 1
            print(f"[{i:02}] PASS: {case['text']}")
        time.sleep(1)  # be gentle with the free-tier rate limit

    print(f"\n{passed}/{len(CASES)} passed")


if __name__ == "__main__":
    run()