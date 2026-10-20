# SmartDoc frontend

React + Vite single-page app for the SmartDoc backend (FastAPI, `../backend`).

## Run locally

```bash
# 1. Backend (terminal 1) - from the repo root
cd backend
python -m venv .venv && source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt
# create backend/.env (the server will not start without it):
#   LLM_API_KEY=...  LLM_BASE_URL=...  LLM_MODEL=...
python -m seed.seed                                       # creates the club + document types
uvicorn app.main:app --reload --port 8000
# PDF output needs LibreOffice installed (soffice)

# 2. Frontend (terminal 2)
cd frontend
cp .env.example .env        # optional
npm install
npm run dev                 # http://localhost:5173
```

In development the browser calls `/api/*` and Vite forwards it to `BACKEND_URL` (default `http://127.0.0.1:8000`),
so there are no CORS problems and SPA routes (`/documents`) never clash with API routes (`GET /documents`).

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | dev server with API proxy |
| `npm run build` / `npm run preview` | production build / serve it |
| `npm run test:unit` | pure logic tests (validation, payload building, totals) |
| `npm test` | integration tests: renders the real app against a **running backend** on :8000 (`TEST_API_URL` to change). They create real documents. |

## Structure

```
src/
  api/        client.js (fetch wrapper, error normalisation), endpoints.js (one function per backend route)
  context/    DocTypesContext (GET /doc-types, loaded once), ToastContext
  hooks/      useAsync
  lib/        fields.js (form state, validation, payload, totals), format.js (INR, dates)
  components/ Layout, DocTypeCard, GenerateResult, BatchEditor, BatchResult
    form/     DynamicForm, FieldInput, TableField, AiDraft   (forms are built from the doc type definition)
    ui/       Icon, Button, Alert, EmptyState, Skeleton, ...
  pages/      Dashboard, SmartCompose, CreateDocument, Documents, DocumentDetail, Templates
```

Forms are generated from `fields` in `backend/seed/doc_types.json`, so a new document type needs **no frontend change**.
