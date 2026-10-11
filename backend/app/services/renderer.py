from pathlib import Path
from docxtpl import DocxTemplate
from jinja2.sandbox import SandboxedEnvironment

TEMPLATES = Path(__file__).parent.parent.parent / "storage" / "templates"
OUTPUTS = Path(__file__).parent.parent.parent / "storage" / "outputs"

def render_docx(template_name: str, context: dict, out_name: str) -> Path:
    OUTPUTS.mkdir(parents=True, exist_ok=True)
    doc = DocxTemplate(TEMPLATES / template_name)
<<<<<<< HEAD
    doc.render(context, jinja_env=SandboxedEnvironment(), autoescape=True)
=======
    doc.render(context, jinja_env=SandboxedEnvironment())
>>>>>>> da49a66c73dbe8f74558a16b3f5d5bbad82d56a8
    out_path = OUTPUTS / out_name
    doc.save(out_path)
    return out_path
