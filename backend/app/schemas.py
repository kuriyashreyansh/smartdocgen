from pydantic import BaseModel

class GenerateRequest(BaseModel):
    doc_type: str
    club_id: int = 1
    fields: dict
    detail_level: str = "standard"
    include_ai_section: bool = False
    document_id: int | None = None

class GenerateResponse(BaseModel):
    document_id: int
    version: int
    ref_no: str
    docx_url: str
    pdf_url: str
    warnings: list[str] = []

class BatchRequest(BaseModel):
    doc_type: str
    club_id: int = 1
    common: dict = {}          # values shared by every document (event name, date, venue...)
    rows: list[dict]           # one dict per document (one per winner)
