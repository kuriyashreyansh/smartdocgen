from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.database import Base, engine
from app.routers import generate,ai,documents

Base.metadata.create_all(engine)

app = FastAPI(title="SmartDoc")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

OUTPUTS = Path(__file__).parent.parent / "storage" / "outputs"
OUTPUTS.mkdir(parents=True, exist_ok=True)
app.mount("/files", StaticFiles(directory=OUTPUTS), name="files")

app.include_router(generate.router)
app.include_router(ai.router)
app.include_router(documents.router)

@app.get("/health")
def health():
    return {"ok": True}

from fastapi.responses import RedirectResponse

@app.get("/", include_in_schema=False)
def root():
    return RedirectResponse("/docs")