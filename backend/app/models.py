from datetime import datetime
from sqlalchemy import String, Integer, JSON, ForeignKey, DateTime
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base

class Club(Base):
    __tablename__ = "clubs"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100))
    full_name: Mapped[str] = mapped_column(String(200))
    ref_prefix: Mapped[str] = mapped_column(String(20))
    signatory_name: Mapped[str] = mapped_column(String(100))
    signatory_designation: Mapped[str] = mapped_column(String(100))

class DocType(Base):
    __tablename__ = "doc_types"
    id: Mapped[int] = mapped_column(primary_key=True)
    type_id: Mapped[str] = mapped_column(String(50), unique=True)
    name: Mapped[str] = mapped_column(String(100))
    description: Mapped[str] = mapped_column(String(300))
    template_file: Mapped[str] = mapped_column(String(200))
    ref_code: Mapped[str] = mapped_column(String(10))
    fields: Mapped[list] = mapped_column(JSON)
    ai_sections: Mapped[list] = mapped_column(JSON, default=list)

class Document(Base):
    __tablename__ = "documents"
    id: Mapped[int] = mapped_column(primary_key=True)
    club_id: Mapped[int] = mapped_column(ForeignKey("clubs.id"))
    doc_type_id: Mapped[int] = mapped_column(ForeignKey("doc_types.id"))
    ref_no: Mapped[str] = mapped_column(String(60))
    status: Mapped[str] = mapped_column(String(20), default="draft")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    versions: Mapped[list["DocumentVersion"]] = relationship(back_populates="document")

class DocumentVersion(Base):
    __tablename__ = "document_versions"
    id: Mapped[int] = mapped_column(primary_key=True)
    document_id: Mapped[int] = mapped_column(ForeignKey("documents.id"))
    version: Mapped[int] = mapped_column(Integer)
    data: Mapped[dict] = mapped_column(JSON)
    docx_path: Mapped[str] = mapped_column(String(300))
    pdf_path: Mapped[str] = mapped_column(String(300))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    document: Mapped["Document"] = relationship(back_populates="versions")