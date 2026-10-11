from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers import parse

app = FastAPI(title="SmartDocGen")
app.add_middleware(CORSMiddleware, allow_origins=["*"],
                   allow_methods=["*"], allow_headers=["*"])
app.include_router(parse.router)