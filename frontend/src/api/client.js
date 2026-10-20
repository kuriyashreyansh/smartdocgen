import { API_BASE } from "../config";

/** Error thrown for every failed request, with the backend's different error shapes normalised. */
export class ApiError extends Error {
  constructor(message, { status = 0, missing = null, fields = null } = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.missing = missing; // from POST /generate -> 422 {detail: {missing: [...]}}
    this.fields = fields; // from POST /templates -> 422 {detail: {error, fields}}
  }
}

/** Turn a stored path such as "/files/1_v1.pdf" into a URL the browser can open. */
export const fileUrl = (path) => (!path ? null : /^https?:/.test(path) ? path : `${API_BASE}${path}`);

function explain(status, body, raw) {
  const d = body?.detail;
  if (d && typeof d === "object" && !Array.isArray(d)) {
    if (Array.isArray(d.missing))
      return new ApiError("Some required details are missing or invalid.", { status, missing: d.missing });
    if (d.error) return new ApiError(d.error, { status, fields: d.fields || null });
  }
  if (typeof d === "string") return new ApiError(d, { status });
  if (Array.isArray(d)) // FastAPI request-validation errors
    return new ApiError(d.map((e) => `${(e.loc || []).slice(1).join(".")}: ${e.msg}`).join("; "), { status });
  if (status >= 500) return new ApiError(`The server hit an error (HTTP ${status}).${raw && raw.length < 120 && !raw.startsWith("<") ? " " + raw : ""}`, { status });
  return new ApiError(`Request failed (HTTP ${status}).`, { status });
}

export async function request(path, { method = "GET", json, form, signal } = {}) {
  const init = { method, signal, headers: {} };
  if (json !== undefined) {
    init.headers["Content-Type"] = "application/json";
    init.body = JSON.stringify(json);
  } else if (form) {
    init.body = form;
  }
  let res;
  try {
    res = await fetch(`${API_BASE}${path}`, init);
  } catch (e) {
    if (e.name === "AbortError") throw e;
    throw new ApiError("Cannot reach the server. Check that the backend is running.");
  }
  const raw = await res.text();
  let body = null;
  try { body = raw ? JSON.parse(raw) : null; } catch { /* non-JSON body */ }
  if (!res.ok) throw explain(res.status, body, raw);
  return body;
}
