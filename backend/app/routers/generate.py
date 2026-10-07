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

def _clean(d: dict) -> dict:
    return {k: v for k, v in d.items() if v not in (None, "")}

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

    # Optional AI-written paragraph (only if asked, and not already supplied or edited by the user)
    if ("purpose_paragraph" in (doc_type.ai_sections or [])
            and req.include_ai_section and "purpose_paragraph" not in fields):
        from app.services.content_writer import write_section
        facts = {k: v for k, v in fields.items() if k not in ("recipient_designation", "faculty_coordinator")}
        fields["purpose_paragraph"] = write_section("Purpose of the event", facts, req.detail_level)

    # New document, or a new version of an existing one
    if req.document_id:
        doc = db.get(Document, req.document_id)
        if not doc:
            raise HTTPException(404, "Document not found")
        version = len(doc.versions) + 1
    else:
        year = datetime.now().year
        count = (db.query(func.count(Document.id))
                   .filter(Document.club_id == club.id,
                           Document.doc_type_id == doc_type.id,
                           Document.ref_no.like(f"%/{year}/%"))
                   .scalar())
        ref_no = f"{club.ref_prefix}/{year}/{doc_type.ref_code}/{count + 1:03d}"
        doc = Document(club_id=club.id, doc_type_id=doc_type.id, ref_no=ref_no)
        db.add(doc)
        db.flush()
        version = 1

    context = {
        **fields,
        "club_full_name": club.full_name,
        "signatory_name": club.signatory_name,
        "signatory_designation": club.signatory_designation,
        "ref_no": doc.ref_no,
        "letter_date": datetime.now().strftime("%d %B %Y"),
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