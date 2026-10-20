import { request } from "./client";
import { CLUB_ID } from "../config";

// One function per backend route that exists in backend/app/routers/*.py
export const api = {
  health: (signal) => request("/health", { signal }),
  docTypes: (signal) => request("/doc-types", { signal }),
  documents: (signal) => request(`/documents?club_id=${CLUB_ID}`, { signal }),
  document: (id, signal) => request(`/documents/${id}`, { signal }),
  generate: (body) => request("/generate", { method: "POST", json: { club_id: CLUB_ID, ...body } }),
  generateBatch: (body) => request("/generate/batch", { method: "POST", json: { club_id: CLUB_ID, ...body } }),
  parse: (body) => request("/parse", { method: "POST", json: { club_id: CLUB_ID, ...body } }),
  aiSection: (body) => request("/ai/section", { method: "POST", json: body }),
  inspectTemplate: (file) => {
    const form = new FormData();
    form.append("file", file);
    return request("/templates/inspect", { method: "POST", form });
  },
  saveTemplate: (body) => request("/templates", { method: "POST", json: body }),
};
