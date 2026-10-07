from pydantic import BaseModel

class GenerateRequest(BaseModel):
    doc_type: str
    club_id: int = 1
    fields: dict
    detail_level: str = "standard"
    document_id: int | None = None   # set this to create a new version of an existing document

class GenerateResponse(BaseModel):
    document_id: int
    version: int
    ref_no: str
    docx_url: str
    pdf_url: str