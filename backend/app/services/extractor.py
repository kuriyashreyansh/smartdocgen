from pathlib import Path
from app.services.llm_client import ask_json

PROMPT = (Path(__file__).parent.parent / "prompts" / "extract.txt").read_text(encoding="utf-8")

def extract(text: str, fields: list[dict]) -> dict:
    spec = "\n".join(f'- {f["key"]} ({f["type"]}): {f["label"]}' for f in fields)
    raw = ask_json(PROMPT, f"Fields:\n{spec}\n\nRequest:\n{text}")
    return {f["key"]: (raw.get(f["key"]) or None) for f in fields}