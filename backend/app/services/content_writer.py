import logging
from pathlib import Path
from app.services.llm_client import ask_text, ask_json

BASE = Path(__file__).parent.parent / "prompts"
PROMPT = (BASE / "write_section.txt").read_text(encoding="utf-8")
VERIFY = (BASE / "verify_section.txt").read_text(encoding="utf-8")

LENGTHS = {
    "short":    ("at most 50 words", 50),
    "standard": ("at most 150 words", 150),
    "detailed": ("at most 300 words", 300),
}

def _repeated(text: str, facts: dict) -> bool:
    low = text.lower()
    return any(low.count(str(v).lower()) > 2 for v in facts.values() if len(str(v)) > 3)

def _unsupported(text: str, facts: dict) -> list:
    result = ask_json(VERIFY, f"FACTS: {facts}\n\nTEXT: {text}")
    return result.get("unsupported", [])

def _safe_fallback(facts: dict) -> str:
    parts = [f"{k.replace('_', ' ')}: {v}" for k, v in facts.items() if v]
    return "Details of the event are as follows. " + "; ".join(parts) + "."

def write_section(section: str, facts: dict, level: str = "standard", tone: str = "formal") -> str:
    instr, max_words = LENGTHS[level]
    base = f"Section: {section}\nTone: {tone}\nLength: {instr}\nFacts: {facts}"
    feedback = ""
    for _ in range(3):
        text = ask_text(PROMPT, base + feedback, max_tokens=4000)
        if not text:
            continue
        if len(text.split()) > max_words or _repeated(text, facts):
            feedback = "\nThe last draft was too long or repeated facts. Be shorter and state each fact once."
            continue
        bad = _unsupported(text, facts)
        if not bad:
            return text
        logging.warning("Unsupported claims: %s", bad)
        feedback = "\nThe last draft contained unsupported claims. Remove them: " + "; ".join(bad)
    return _safe_fallback(facts)