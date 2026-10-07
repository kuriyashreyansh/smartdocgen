from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Document, DocType

router = APIRouter()

def _version(v):
    return {
        "version": v.version,
        "data": v.data,
        "created_at": v.created_at.isoformat(),
        "docx_url": f"/files/{v.docx_path}",
        "pdf_url": f"/files/{v.pdf_path}",
    }

@router.get("/doc-types")
def list_doc_types(db: Session = Depends(get_db)):
    return [
        {"type_id": t.type_id, "name": t.name, "description": t.description,
         "fields": t.fields, "ai_sections": t.ai_sections}
        for t in db.query(DocType).all()
    ]

@router.get("/documents")
def list_documents(club_id: int = 1, db: Session = Depends(get_db)):
    docs = (db.query(Document).filter(Document.club_id == club_id)
              .order_by(Document.created_at.desc()).all())
    result = []
    for d in docs:
        latest = max(d.versions, key=lambda v: v.version) if d.versions else None
        doc_type = db.get(DocType, d.doc_type_id)
        result.append({
            "document_id": d.id,
            "ref_no": d.ref_no,
            "type": doc_type.name if doc_type else None,
            "status": d.status,
            "created_at": d.created_at.isoformat(),
            "version_count": len(d.versions),
            "latest": _version(latest) if latest else None,
        })
    return result

@router.get("/documents/{document_id}")
def get_document(document_id: int, db: Session = Depends(get_db)):
    d = db.get(Document, document_id)
    if not d:
        raise HTTPException(404, "Document not found")
    doc_type = db.get(DocType, d.doc_type_id)
    return {
        "document_id": d.id,
        "ref_no": d.ref_no,
        "type_id": doc_type.type_id if doc_type else None,
        "status": d.status,
        "versions": [_version(v) for v in sorted(d.versions, key=lambda v: v.version)],
    }