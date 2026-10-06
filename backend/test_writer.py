from app.services.content_writer import write_section

facts = {"event_name": "TechFest 2027", "event_date": "12 February 2027",
         "venue": "Seminar Hall", "expected_participants": 200,
         "event_description": "A two-hour coding contest for first-year students"}

for level in ["short", "standard", "detailed"]:
    text = write_section("Purpose of the event", facts, level)
    print(f"--- {level} ({len(text.split())} words) ---")
    print(text, "\n")