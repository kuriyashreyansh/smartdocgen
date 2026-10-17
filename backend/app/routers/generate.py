import re
import zipfile
from datetime import datetime, date
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Club, DocType, Document, DocumentVersion
from app.schemas import GenerateRequest, GenerateResponse, BatchRequest
from app.services.renderer import render_docx, OUTPUTS
from app.services.pdf_converter import docx_to_pdf

router = APIRouter()
DEFAULT_PATTERN = "{prefix}/{session_short}/{code}/{seq:03d}"
MAX_BATCH = 200


class MissingFields(Exception):
    def __init__(self, keys):
        self.keys = keys


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


def _format_inr(value):
    """5000 -> 5,000 and 125000 -> 1,25,000 (Indian digit grouping)."""
    try:
        num = float(str(value).replace(",", "").strip())
    except ValueError:
        return value
    whole, frac = divmod(round(num * 100), 100)
    s = str(whole)
    if len(s) > 3:
        head, tail = s[:-3], s[-3:]
        parts = []
        while len(head) > 2:
            parts.insert(0, head[-2:])
            head = head[:-2]
        if head:
            parts.insert(0, head)
        s = ",".join(parts + [tail])
    return f"{s}.{frac:02d}" if frac else s


def _mask(value) -> str:
    s = str(value)
    return "X" * max(len(s) - 4, 0) + s[-4:]


def _storable(fields: dict, doc_type: DocType) -> dict:
    """What goes into the history: bank and PAN numbers are kept only as their last 4 characters."""
    sensitive = {f["key"] for f in doc_type.fields if f.get("sensitive")}
    return {k: (_mask(v) if k in sensitive else v) for k, v in fields.items()}


def _date_warnings(doc_type: DocType, fields: dict) -> list[str]:
    """Warn (never block) when a date that should be in the future is in the past."""
    out = []
    try:
        from app.services.date_utils import normalize_date
    except Exception:
        return out
    for f in doc_type.fields:
        if f.get("date_check") == "future" and f["key"] in fields:
            try:
                iso, _ = normalize_date(fields[f["key"]])
                if iso and date.fromisoformat(str(iso)[:10]) < date.today():
                    out.append(f"{f['label']} ({fields[f['key']]}) is in the past. Please check the year.")
            except Exception:
                pass
    return out


def _lookup(db: Session, type_id: str, club_id: int):
    doc_type = db.query(DocType).filter_by(type_id=type_id).first()
    if not doc_type:
        raise HTTPException(404, f"Unknown document type: {type_id}")
    club = db.get(Club, club_id)
    if not club:
        raise HTTPException(404, "Club not found")
    return doc_type, club


def _create_document(db: Session, doc_type: DocType, club: Club, fields: dict, document_id=None) -> dict:
    # Never invent: refuse if any required field is missing
    missing = [f["key"] for f in doc_type.fields if f.get("required") and f["key"] not in fields]
    if missing:
        raise MissingFields(missing)

    # New document, or a new version of an existing one
    if document_id:
        doc = db.get(Document, document_id)
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
    for f in doc_type.fields:              # amounts in Indian digit grouping
        if f.get("format") == "inr" and f["key"] in fields:
            context[f["key"]] = _format_inr(fields[f["key"]])

    base = f"{doc.id}_v{version}"
    try:
        docx_path = render_docx(doc_type.template_file, context, f"{base}.docx")
        pdf_path = docx_to_pdf(docx_path)
    except Exception:
        db.rollback()
        raise

    db.add(DocumentVersion(document_id=doc.id, version=version, data=_storable(fields, doc_type),
                           docx_path=docx_path.name, pdf_path=pdf_path.name))
    db.commit()
    return {"document_id": doc.id, "version": version, "ref_no": doc.ref_no,
            "docx_url": f"/files/{docx_path.name}", "pdf_url": f"/files/{pdf_path.name}",
            "warnings": _date_warnings(doc_type, fields)}


@router.post("/generate", response_model=GenerateResponse)
def generate(req: GenerateRequest, db: Session = Depends(get_db)):
    doc_type, club = _lookup(db, req.doc_type, req.club_id)
    try:
        result = _create_document(db, doc_type, club, _clean(req.fields), req.document_id)
    except MissingFields as e:
        raise HTTPException(422, detail={"missing": e.keys})
    except FileNotFoundError as e:
        raise HTTPException(500, f"File problem: {e}")
    return GenerateResponse(**result)


@router.post("/generate/batch")
def generate_batch(req: BatchRequest, db: Session = Depends(get_db)):
    """One document per row (for example one receipt per winner), returned together in a zip."""
    if not req.rows:
        raise HTTPException(422, "No rows to generate")
    if len(req.rows) > MAX_BATCH:
        raise HTTPException(422, f"Too many rows (maximum {MAX_BATCH})")
    doc_type, club = _lookup(db, req.doc_type, req.club_id)

    name_key = next((f["key"] for f in doc_type.fields if f.get("per_row") and f["type"] == "text"), None)
    results, made = [], []
    for i, row in enumerate(req.rows, start=1):
        fields = {**_clean(req.common), **_clean(row)}          # row values win over shared ones
        label = str(fields.get(name_key, "")) if name_key else ""
        try:
            r = _create_document(db, doc_type, club, fields)
            results.append({"row": i, "name": label, "status": "ok", **r})
            made.append((i, label, r))
        except MissingFields as e:
            results.append({"row": i, "name": label, "status": "error", "missing": e.keys})
        except Exception as e:
            results.append({"row": i, "name": label, "status": "error", "message": str(e) or type(e).__name__})

    zip_url = None
    if made:
        zip_name = f"batch_{datetime.now():%Y%m%d_%H%M%S}.zip"
        with zipfile.ZipFile(OUTPUTS / zip_name, "w", zipfile.ZIP_DEFLATED) as z:
            for i, label, r in made:
                safe = re.sub(r"[^A-Za-z0-9]+", "_", label).strip("_") or "document"
                for url in (r["pdf_url"], r["docx_url"]):
                    z.write(OUTPUTS / url.split("/")[-1], f"{i:02d}_{safe}.{url.rsplit('.', 1)[-1]}")
        zip_url = f"/files/{zip_name}"
    return {"count_ok": len(made), "count_error": len(results) - len(made),
            "results": results, "zip_url": zip_url}
