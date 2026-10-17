from typing import Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.services.pipeline import parse_request

router = APIRouter()


class ParseRequest(BaseModel):
    text: str
    club_id: Optional[int] = None
    detail_level: str = "standard"
    doc_type: Optional[str] = None   # set when the user picks a type manually


@router.post("/parse")
def parse(req: ParseRequest):
    """Take plain text and return doc type, fields and missing questions."""
    if not req.text.strip():
        raise HTTPException(status_code=400, detail="Text is empty")
    try:
        return parse_request(req.text, req.doc_type)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Parse failed: {type(e).__name__}: {e}")