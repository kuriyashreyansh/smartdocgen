import json
import sys

from app.services.extractor import extract
from app.services.grounding import ground

# Usage: python debug_case.py "your sentence"
text = sys.argv[1]

with open("seed/doc_types.json", encoding="utf-8") as f:
    fields = json.load(f)[0]["fields"]  # first type in the file

raw = extract(text, fields)
clean, removed = ground(raw, text, fields)

print("RAW from LLM :", raw)
print("AFTER GROUND :", clean)
print("REMOVED      :", removed)