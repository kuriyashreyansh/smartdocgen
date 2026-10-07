from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import DocType
from app.services import template_manager as tm

router = APIRouter(prefix="/templates")
MAX_BYTES = 5 * 1024 * 1024

class FieldDef(BaseModel):
    key: str
    label: str
    type: str = "text"          # text | date | number
    required: bool = True

class TemplateSave(BaseModel):
    token: str
    type_id: str
    name: str
    description: str
    ref_code: str = "DOC"
    fields: list[FieldDef]

@router.post("/inspect")
async def inspect(file: UploadFile = File(...)):
    if not (file.filename or "").lower().endswith(".docx"):
        raise HTTPException(400, "Upload a .docx file")
    data = await file.read()
    if len(data) > MAX_BYTES:
        raise HTTPException(400, "File too large (max 5 MB)")
    token = tm.save_pending(data)
    try:
        found = tm.detect_placeholders(token)
    except Exception as e:
        raise HTTPException(400, f"Could not read the template. Check the {{{{ }}}} tags: {e}")
    return {"token": token, **found}

@router.post("")
def save_template(req: TemplateSave, db: Session = Depends(get_db)):
    try:
        detected = tm.detect_placeholders(req.token)
    except FileNotFoundError as e:
        raise HTTPException(404, str(e))

    keys = {f.key for f in req.fields}
    unknown = sorted(keys - set(detected["user_fields"]))
    unlabelled = sorted(set(detected["user_fields"]) - keys)
    if unknown:
        raise HTTPException(422, detail={"error": "Fields not found in the template", "fields": unknown})
    if unlabelled:
        raise HTTPException(422, detail={"error": "Template placeholders without a field definition", "fields": unlabelled})

    try:
        template_file = tm.publish_template(req.token, req.type_id)
    except ValueError as e:
        raise HTTPException(422, str(e))

    values = dict(type_id=req.type_id, name=req.name, description=req.description,
                  template_file=template_file, ref_code=req.ref_code,
                  fields=[f.model_dump() for f in req.fields], ai_sections=detected["ai_fields"])
    existing = db.query(DocType).filter_by(type_id=req.type_id).first()
    if existing:
        for k, v in values.items():
            setattr(existing, k, v)
    else:
        db.add(DocType(**values))
    db.commit()
    return {"saved": True, "type_id": req.type_id, "template_file": template_file}