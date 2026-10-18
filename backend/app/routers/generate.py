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


def make_ref_no(db: Session, club: Club, doc_type: DocType, fields: dict | None = None) -> str:
    """First free number for this pattern, e.g. ACM/2026-27/SIH/001, then /002 for the next one."""
    _, names = academic_session()
    extra = {}
    if fields and fields.get("event_code"):
        extra["event_code"] = re.sub(r"[^A-Za-z0-9]", "", str(fields["event_code"])).upper()
    pattern = doc_type.ref_pattern or DEFAULT_PATTERN
    seq = 1
    while True:
        candidate = pattern.format(prefix=club.ref_prefix, code=doc_type.ref_code, seq=seq, **names, **extra)
        taken = (db.query(Document.id)
                   .filter(Document.club_id == club.id, Document.ref_no == candidate).first())
        if not taken:
            return candidate
        seq += 1


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


def _pretty_date(value, with_day=False, numeric=False):
    """'2026-10-20' or '20-10-2026' -> '20 October 2026' (plus ', Tuesday' when asked, or 20/10/2026 in numeric style).
    Unreadable text is kept as typed."""
    try:
        from app.services.date_utils import normalize_date
        iso, _ = normalize_date(value)
        if not iso:
            return value
        d = date.fromisoformat(str(iso)[:10])
        if numeric:
            return d.strftime("%d/%m/%Y")
        text = f"{d.day} {d:%B %Y}"
        return f"{text}, {d:%A}" if with_day else text
    except Exception:
        return value


def _num(v) -> float:
    return float(str(v).replace(",", "").strip())


def _process_tables(doc_type: DocType, fields: dict):
    """Check every table field (for example the expense list) and work out its totals.
    Returns (values_for_the_template, problems)."""
    values, problems = {}, []
    grand, has_grand = 0.0, False
    groups = {}
    for f in doc_type.fields:
        if f["type"] != "table":
            continue
        rows_in = fields.get(f["key"]) or []
        cols = f["columns"]
        entered = [c for c in cols if not c.get("multiply")]       # columns the user types
        total_col = (f.get("total") or {}).get("column")
        rows_out, total = [], 0.0
        for i, row in enumerate(rows_in, start=1):
            if not any(str(row.get(c["key"], "")).strip() for c in entered):
                continue                                           # blank line, ignore
            out, nums = {}, {}
            for c in entered:
                v = str(row.get(c["key"], "")).strip()
                if not v:
                    if not c.get("optional"):
                        problems.append(f"{f['label']}: row {i} needs {c['label']}")
                    out[c["key"]] = ""
                    continue
                if c.get("type") == "number":
                    try:
                        nums[c["key"]] = _num(v)
                    except ValueError:
                        problems.append(f"{f['label']}: row {i}, {c['label']} must be a number")
                        continue
                    if total_col == c["key"]:
                        total += nums[c["key"]]
                    v = _format_inr(v) if c.get("format") == "inr" else v
                out[c["key"]] = v
            for c in cols:                                         # computed columns, e.g. quantity x unit cost
                if c.get("multiply"):
                    a, b = c["multiply"]
                    if a in nums and b in nums:
                        val = nums[a] * nums[b]
                        if total_col == c["key"]:
                            total += val
                        out[c["key"]] = _format_inr(val) if c.get("format") == "inr" else str(val)
                    else:
                        out[c["key"]] = ""
            rows_out.append(out)
        if not rows_out and f.get("required"):
            problems.append(f"{f['label']}: add at least one row")
        values[f["key"]] = rows_out
        if f.get("total"):
            values[f["total"]["key"]] = _format_inr(total)
            for extra in f["total"].get("also", []):               # e.g. total + taxes
                add = 0.0
                raw = fields.get(extra["add"])
                if raw not in (None, ""):
                    try:
                        add = _num(raw)
                    except ValueError:
                        problems.append(f"{extra['add'].replace('_', ' ').capitalize()} must be a number")
                values[extra["key"]] = _format_inr(total + add)
        if f.get("adds_to") == "grand_total":
            has_grand, grand = True, grand + total
        if f.get("any_of"):
            groups.setdefault(f["any_of"], []).append((f["label"], bool(rows_out)))
    if has_grand:
        values["grand_total"] = _format_inr(grand)
    for labels in groups.values():
        if not any(filled for _, filled in labels):
            problems.append("Add at least one row in: " + " or ".join(label for label, _ in labels))
    return values, problems


def _mask(value) -> str:
    s = str(value)
    return "X" * max(len(s) - 4, 0) + s[-4:]


def _storable(fields: dict, doc_type: DocType) -> dict:
    """What goes into the history: bank and PAN numbers are kept only as their last 4 characters."""
    sensitive = {f["key"] for f in doc_type.fields if f.get("sensitive")}
    out = {k: (_mask(v) if k in sensitive else v) for k, v in fields.items()}
    for f in doc_type.fields:
        if f["type"] == "table" and isinstance(out.get(f["key"]), list):
            hidden = {c["key"] for c in f["columns"] if c.get("sensitive")}
            if hidden:
                out[f["key"]] = [{ck: (_mask(cv) if ck in hidden and cv else cv) for ck, cv in row.items()}
                                 for row in out[f["key"]] if isinstance(row, dict)]
    return out


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
    missing = [f["key"] for f in doc_type.fields
               if f.get("required") and f["type"] != "table" and f["key"] not in fields]
    table_values, table_problems = _process_tables(doc_type, fields)
    if missing or table_problems:
        raise MissingFields(missing + table_problems)

    # New document, or a new version of an existing one
    if document_id:
        doc = db.get(Document, document_id)
        if not doc:
            raise HTTPException(404, "Document not found")
        version = len(doc.versions) + 1
    else:
        doc = Document(club_id=club.id, doc_type_id=doc_type.id,
                       ref_no=fields.get("ref_no") or make_ref_no(db, club, doc_type, fields))
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
    context.update(table_values)           # table rows and totals
    for f in doc_type.fields:
        if f["key"] not in fields:
            continue
        if f.get("format") == "inr":       # amounts in Indian digit grouping
            context[f["key"]] = _format_inr(fields[f["key"]])
        elif f["type"] == "date":          # dates as '20 October 2026' (or 20/10/2026, or with the weekday)
            context[f["key"]] = _pretty_date(fields[f["key"]], f.get("weekday", False), f.get("date_style") == "numeric")
    link_warnings = []
    for f in doc_type.fields:              # e.g. a bill certificate points to its approval note
        if f.get("links_to") and fields.get(f["key"]):
            linked = (db.query(Document).join(DocType, Document.doc_type_id == DocType.id)
                        .filter(DocType.type_id == f["links_to"], Document.club_id == club.id,
                                Document.ref_no == str(fields[f["key"]]).strip()).first())
            if linked:
                context[f["key"] + "__date"] = linked.created_at.strftime("%d/%m/%Y")
            else:
                link_warnings.append(f"{f['label']} {fields[f['key']]} was not found among the documents made here.")

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
            "warnings": _date_warnings(doc_type, fields) + link_warnings}


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
