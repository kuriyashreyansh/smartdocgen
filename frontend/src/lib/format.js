const inrFmt = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 });

/** 125000 -> "1,25,000" (Indian digit grouping, like the backend). */
export const inr = (n) => (Number.isFinite(n) ? inrFmt.format(n) : "");

/** Accepts "1,250.50" or 1250.5; returns NaN when it is not a number (same rule as the backend). */
export const toNumber = (v) => {
  const s = String(v ?? "").replace(/,/g, "").trim();
  return s === "" ? NaN : Number(s);
};

export const formatDate = (iso) => {
  if (!iso) return "";
  const d = new Date(String(iso).length === 10 ? `${iso}T00:00:00` : iso);
  return isNaN(d) ? String(iso) : d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
};

export const formatDateTime = (iso) => {
  const d = new Date(iso);
  return isNaN(d)
    ? ""
    : d.toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
};

export const prettyKey = (k) => k.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
