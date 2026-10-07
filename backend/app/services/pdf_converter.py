import subprocess, shutil
from pathlib import Path

def _find_soffice() -> str:
    found = shutil.which("soffice")
    if found:
        return found
    for p in [r"C:\Program Files\LibreOffice\program\soffice.exe",
              r"C:\Program Files (x86)\LibreOffice\program\soffice.exe"]:
        if Path(p).exists():
            return p
    raise FileNotFoundError("LibreOffice not found. Install it from libreoffice.org")

def docx_to_pdf(docx_path: Path) -> Path:
    docx_path = Path(docx_path)
    subprocess.run(
        [_find_soffice(), "--headless", "--convert-to", "pdf",
         "--outdir", str(docx_path.parent), str(docx_path)],
        check=True, capture_output=True, timeout=120,
    )
    return docx_path.with_suffix(".pdf")