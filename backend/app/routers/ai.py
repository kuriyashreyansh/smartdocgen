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
    return {"text": text, "ai_generated": True}