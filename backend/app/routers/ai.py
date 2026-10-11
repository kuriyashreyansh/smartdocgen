from fastapi import APIRouter
from pydantic import BaseModel
from app.services.content_writer import write_section

router = APIRouter(prefix="/ai")

class SectionRequest(BaseModel):
    facts: dict
    section: str = "Purpose of the event"
    detail_level: str = "standard"
    tone: str = "formal"

@router.post("/section")
def ai_section(req: SectionRequest):
    facts = {k: v for k, v in req.facts.items() if v not in (None, "")}
    text = write_section(req.section, facts, req.detail_level, req.tone)
    if not text:
        return {"text": "", "ai_generated": False,
                "message": "The AI could not write this section from the details given. "
                           "Add more notes, or write it yourself."}
    return {"text": text, "ai_generated": True, "message": ""}
