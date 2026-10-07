import re, uuid, shutil
from pathlib import Path
from docxtpl import DocxTemplate
from jinja2.sandbox import SandboxedEnvironment

BASE = Path(__file__).parent.parent.parent / "storage"
TEMPLATES = BASE / "templates"
PENDING = BASE / "pending"

# Values the backend fills in itself, so admins never define them as form fields
AUTO_VARS = {"ref_no", "letter_date", "club_full_name", "signatory_name", "signatory_designation"}
AI_VARS = {"purpose_paragraph"}

def save_pending(file_bytes: bytes) -> str:
    PENDING.mkdir(parents=True, exist_ok=True)
    token = f"{uuid.uuid4().hex}.docx"
    (PENDING / token).write_bytes(file_bytes)
    return token

def detect_placeholders(token: str) -> dict:
    path = PENDING / token
    if not path.exists():
        raise FileNotFoundError("Upload expired or not found")
    found = DocxTemplate(path).get_undeclared_template_variables(jinja_env=SandboxedEnvironment())
    return {
        "user_fields": sorted(found - AUTO_VARS - AI_VARS),
        "auto_fields": sorted(found & AUTO_VARS),
        "ai_fields": sorted(found & AI_VARS),
    }

def publish_template(token: str, type_id: str) -> str:
    if not re.fullmatch(r"[a-z0-9_]{3,50}", type_id):
        raise ValueError("type_id must be lowercase letters, numbers and underscores (3-50 chars)")
    src = PENDING / token
    if not src.exists():
        raise FileNotFoundError("Upload expired or not found")
    TEMPLATES.mkdir(parents=True, exist_ok=True)
    dest_name = f"{type_id}.docx"
    shutil.copyfile(src, TEMPLATES / dest_name)
    src.unlink()
    return dest_name