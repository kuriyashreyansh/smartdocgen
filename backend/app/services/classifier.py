from pathlib import Path
from app.services.llm_client import ask_json

PROMPT = (Path(__file__).parent.parent / "prompts" / "classify.txt").read_text(encoding="utf-8")

def classify(text: str, doc_types: list[dict]) -> dict:
    listing = "\n".join(f'- {d["type_id"]}: {d["description"]}' for d in doc_types)
    result = ask_json(PROMPT, f"Document types:\n{listing}\n\nRequest:\n{text}")
    valid_ids = {d["type_id"] for d in doc_types}
    if result.get("doc_type") not in valid_ids:
        return {"doc_type": None, "confidence": 0.0}
    return {"doc_type": result["doc_type"], "confidence": float(result.get("confidence", 0))}