from app.services.grounding import ground
from app.services.date_utils import normalize_date, pretty_date

FIELDS = [
    {"key": "event_name", "type": "text"},
    {"key": "event_date", "type": "date"},
    {"key": "venue", "type": "text"},
    {"key": "expected_participants", "type": "number"},
]

text = "Permission letter for TechFest on 12 Feb, around 200 participants"

# Simulated LLM output where the model invented the venue (it is not in the text)
llm_output = {"event_name": "TechFest", "event_date": "12 Feb",
              "venue": "Main Auditorium", "expected_participants": 200}

clean, removed = ground(llm_output, text, FIELDS)
print("clean  :", clean)
print("removed:", removed)

# Convert the raw date text into a real date
iso, relative = normalize_date(clean["event_date"])
print("date   :", iso, "| relative:", relative, "|", pretty_date(iso))