import os
from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse
from fastapi.staticfiles import StaticFiles

from app.database import Base, engine
from app.routers import generate, ai, documents, templates, parse

Base.metadata.create_all(engine)

app = FastAPI(title="SmartDoc")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

# Use /tmp on Vercel because the standard filesystem is read-only
if os.environ.get("VERCEL"):
    OUTPUTS = Path("/tmp/storage/outputs")
else:
    OUTPUTS = Path(__file__).parent.parent / "storage" / "outputs"

try:
    OUTPUTS.mkdir(parents=True, exist_ok=True)
    app.mount("/files", StaticFiles(directory=OUTPUTS), name="files")
except OSError:
    # Fallback or pass if directory creation fails in strict serverless environments
    pass

app.include_router(generate.router)
app.include_router(ai.router)
app.include_router(documents.router)
app.include_router(templates.router)
app.include_router(parse.router)

@app.get("/health")
def health():
    return {"ok": True}

@app.get("/", include_in_schema=False)
def root():
    return RedirectResponse("/docs")