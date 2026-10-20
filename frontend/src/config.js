// The backend exposes no /clubs endpoint, so the active club is configuration for now.
export const CLUB_ID = Number(import.meta.env.VITE_CLUB_ID || 1);
export const API_BASE = (import.meta.env.VITE_API_URL || "/api").replace(/\/$/, "");
