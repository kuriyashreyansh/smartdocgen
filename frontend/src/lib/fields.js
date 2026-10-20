// Pure helpers that turn a doc type definition (from GET /doc-types) into form state,
// validation, and the payload for POST /generate. Mirrors the rules in backend/app/routers/generate.py.
import { toNumber, inr } from "./format.js";

export const isTable = (f) => f.type === "table";
export const enteredCols = (f) => f.columns.filter((c) => !c.multiply);
export const hasPerRow = (type) => type.fields.some((f) => f.per_row);
const blank = (v) => v === undefined || v === null || String(v).trim() === "";

export const blankRow = (field) => Object.fromEntries(enteredCols(field).map((c) => [c.key, ""]));

export function emptyValues(type) {
  return Object.fromEntries(type.fields.map((f) => [f.key, isTable(f) ? [blankRow(f)] : ""]));
}

/** Rows where the user typed something (the backend ignores completely blank rows too). */
const filledRows = (field, rows) => (rows || []).filter((r) => enteredCols(field).some((c) => !blank(r[c.key])));

/** Merge stored/extracted data into a fresh form. Sensitive values are stored masked, so they are blanked. */
export function fillValues(type, data = {}, { clearSensitive = false } = {}) {
  const values = emptyValues(type);
  const cleared = [];
  for (const f of type.fields) {
    const v = data[f.key];
    if (v === undefined || v === null) continue;
    if (isTable(f)) {
      if (!Array.isArray(v) || !v.length) continue;
      const hidden = new Set(clearSensitive ? f.columns.filter((c) => c.sensitive).map((c) => c.key) : []);
      values[f.key] = v.map((row) => {
        const out = blankRow(f);
        for (const c of enteredCols(f)) {
          if (hidden.has(c.key)) { if (row[c.key]) cleared.push(`${f.label} › ${c.label}`); }
          else out[c.key] = row[c.key] ?? "";
        }
        return out;
      });
    } else if (clearSensitive && f.sensitive) {
      if (v) cleared.push(f.label);
    } else {
      values[f.key] = String(v);
    }
  }
  return { values, cleared };
}

/** Client-side check before calling the API. Returns { fieldKey: message }. */
export function validate(type, values, { skipPerRow = false } = {}) {
  const errors = {};
  const groups = {};
  for (const f of type.fields) {
    if (skipPerRow && f.per_row) continue;
    const v = values[f.key];
    if (isTable(f)) {
      const rows = filledRows(f, v);
      const problems = [];
      rows.forEach((row, i) => {
        for (const c of enteredCols(f)) {
          const cell = row[c.key];
          if (blank(cell)) { if (!c.optional) problems.push(`Row ${i + 1} needs ${c.label}`); }
          else if (c.type === "number" && Number.isNaN(toNumber(cell))) problems.push(`Row ${i + 1}: ${c.label} must be a number`);
        }
      });
      if (!rows.length && f.required) problems.push("Add at least one row");
      if (problems.length) errors[f.key] = problems.join(". ");
      if (f.any_of) (groups[f.any_of] ||= []).push({ f, filled: rows.length > 0 });
    } else if (blank(v)) {
      if (f.required) errors[f.key] = "This field is required";
    } else if (f.type === "number" && Number.isNaN(toNumber(v))) {
      errors[f.key] = "Enter a valid number";
    }
  }
  for (const list of Object.values(groups)) {
    if (!list.some((g) => g.filled)) errors[list[0].f.key] = "Add at least one row in: " + list.map((g) => g.f.label).join(" or ");
  }
  return errors;
}

/** Fields object for the API: trimmed strings, no empty values, no blank table rows. */
export function buildFields(type, values, { skipPerRow = false } = {}) {
  const out = {};
  for (const f of type.fields) {
    if (skipPerRow && f.per_row) continue;
    const v = values[f.key];
    if (isTable(f)) {
      out[f.key] = filledRows(f, v).map((r) => Object.fromEntries(enteredCols(f).map((c) => [c.key, String(r[c.key] ?? "").trim()])));
    } else if (!blank(v)) {
      out[f.key] = String(v).trim();
    }
  }
  return out;
}

/** The backend's "missing" list mixes field keys ("venue") and sentences ("Expenses: row 1 needs Item"). */
export function mapMissing(type, missing = []) {
  const byKey = new Map(type.fields.map((f) => [f.key, f]));
  const fieldErrors = {}, general = [];
  for (const m of missing) {
    if (byKey.has(m)) { fieldErrors[m] = "This field is required"; continue; }
    const table = type.fields.find((f) => isTable(f) && String(m).startsWith(`${f.label}:`));
    if (table) fieldErrors[table.key] = [fieldErrors[table.key], String(m).slice(table.label.length + 1).trim()].filter(Boolean).join(". ");
    else general.push(String(m));
  }
  return { fieldErrors, general };
}

/** Live preview of table totals. The server calculates the real values; this is only a convenience. */
export function tableTotals(field, rows, values = {}) {
  const cols = field.columns;
  const totalCol = field.total?.column;
  let total = 0, counted = 0;
  const computed = (rows || []).map((row) => {
    const nums = {};
    for (const c of enteredCols(field)) if (c.type === "number") nums[c.key] = toNumber(row[c.key]);
    const out = {};
    for (const c of cols) {
      if (!c.multiply) continue;
      const [a, b] = c.multiply;
      out[c.key] = Number.isFinite(nums[a]) && Number.isFinite(nums[b]) ? nums[a] * nums[b] : NaN;
    }
    const t = totalCol ? (out[totalCol] !== undefined ? out[totalCol] : nums[totalCol]) : NaN;
    if (Number.isFinite(t)) { total += t; counted++; }
    return out;
  });
  const extras = (field.total?.also || []).map((e) => {
    const add = toNumber(values[e.add]);
    return { key: e.key, label: e.key.replace(/_/g, " "), value: total + (Number.isFinite(add) ? add : 0), source: e.add };
  });
  return { computed, total: field.total ? total : null, counted, extras, display: inr };
}

/** Batch mode: validate each row's per_row fields. Returns { rowIndex: { fieldKey: message } }. */
export function validateRows(type, rows) {
  const perRow = type.fields.filter((f) => f.per_row && !isTable(f));
  const out = {};
  rows.forEach((row, i) => {
    const e = {};
    for (const f of perRow) {
      const v = row[f.key];
      if (blank(v)) { if (f.required) e[f.key] = "Required"; }
      else if (f.type === "number" && Number.isNaN(toNumber(v))) e[f.key] = "Not a number";
    }
    if (Object.keys(e).length) out[i] = e;
  });
  return out;
}
export const blankPerRow = (type) => Object.fromEntries(type.fields.filter((f) => f.per_row).map((f) => [f.key, ""]));
export const isBlankRow = (row) => Object.values(row).every(blank);
