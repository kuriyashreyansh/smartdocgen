from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Club, DocType, Document, DocumentVersion
from app.schemas import GenerateRequest, GenerateResponse
from app.services.renderer import render_docx
from app.services.pdf_converter import docx_to_pdf

router = APIRouter()
DEFAULT_PATTERN = "{prefix}/{session_short}/{code}/{seq:03d}"

def _clean(d: dict) -> dict:
    return {k: v for k, v in d.items() if v not in (None, "")}

def academic_session(today: datetime | None = None):
    """The academic year starts in July: Oct 2026 -> 2026-27."""
    today = today or datetime.now()
    start = today.year if today.month >= 7 else today.year - 1
    end = start + 1
    return start, {"session_short": f"{start % 100:02d}-{end % 100:02d}",
                   "session_long": f"{start}-{end % 100:02d}"}

def make_ref_no(db: Session, club: Club, doc_type: DocType) -> str:
    start, names = academic_session()
    count = (db.query(func.count(Document.id))
               .filter(Document.club_id == club.id,
                       Document.doc_type_id == doc_type.id,
                       Document.created_at >= datetime(start, 7, 1))
               .scalar())
    pattern = doc_type.ref_pattern or DEFAULT_PATTERN
    return pattern.format(prefix=club.ref_prefix, code=doc_type.ref_code, seq=count + 1, **names)

@router.post("/generate", response_model=GenerateResponse)
def generate(req: GenerateRequest, db: Session = Depends(get_db)):
    doc_type = db.query(DocType).filter_by(type_id=req.doc_type).first()
    if not doc_type:
        raise HTTPException(404, f"Unknown document type: {req.doc_type}")
    club = db.get(Club, req.club_id)
    if not club:
        raise HTTPException(404, "Club not found")

    fields = _clean(req.fields)

    # Never invent: refuse if any required field is missing
    missing = [f["key"] for f in doc_type.fields if f.get("required") and f["key"] not in fields]
    if missing:
        raise HTTPException(422, detail={"missing": missing})

    # New document, or a new version of an existing one
    if req.document_id:
        doc = db.get(Document, req.document_id)
        if not doc:
            raise HTTPException(404, "Document not found")
        version = len(doc.versions) + 1
    else:
        doc = Document(club_id=club.id, doc_type_id=doc_type.id,
                       ref_no=fields.get("ref_no") or make_ref_no(db, club, doc_type))
        db.add(doc)
        db.flush()
        version = 1

    context = {
        **(club.officials or {}),          # office-bearers, reused in every document
        **fields,                          # what the user entered (can override the officials)
        "club_full_name": club.full_name,
        "signatory_name": club.signatory_name,
        "signatory_designation": club.signatory_designation,
        "ref_no": doc.ref_no,
        "letter_date": fields.get("letter_date") or datetime.now().strftime("%d %B %Y"),
    }

    base = f"{doc.id}_v{version}"
    try:
        docx_path = render_docx(doc_type.template_file, context, f"{base}.docx")
        pdf_path = docx_to_pdf(docx_path)
    except FileNotFoundError as e:
        db.rollback()
        raise HTTPException(500, f"File problem: {e}")

    db.add(DocumentVersion(document_id=doc.id, version=version, data=fields,
                           docx_path=docx_path.name, pdf_path=pdf_path.name))
    db.commit()

    return GenerateResponse(document_id=doc.id, version=version, ref_no=doc.ref_no,
                            docx_url=f"/files/{docx_path.name}", pdf_url=f"/files/{pdf_path.name}")
