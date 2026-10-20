import { useState } from "react";
import { Button } from "./ui";
import { Icon } from "./ui/Icon";
import { blankPerRow } from "../lib/fields";

/**
 * Grid for batch generation (POST /generate/batch): one row per document, one column per `per_row` field.
 * Used for e.g. prize money receipts: shared event details above, one winner per row here.
 */
export default function BatchEditor({ docType, rows, onChange, rowErrors = {} }) {
  const cols = docType.fields.filter((f) => f.per_row);
  const [paste, setPaste] = useState("");
  const setCell = (i, k, v) => onChange(rows.map((r, idx) => (idx === i ? { ...r, [k]: v } : r)));
  const remove = (i) => onChange(rows.length > 1 ? rows.filter((_, idx) => idx !== i) : [blankPerRow(docType)]);

  function importPaste() {
    const lines = paste.split(/\r?\n/).filter((l) => l.trim());
    const parsed = lines.map((line) => {
      const cells = line.split("\t");
      return Object.fromEntries(cols.map((c, i) => [c.key, (cells[i] ?? "").trim()]));
    });
    if (parsed.length) {
      const keep = rows.filter((r) => Object.values(r).some((v) => String(v).trim()));
      onChange([...keep, ...parsed]); setPaste("");
    }
  }

  return (
    <div className="stack">
      <div className="table-scroll">
        <table className="t">
          <thead><tr><th>#</th>{cols.map((c) => <th key={c.key}>{c.label}{c.required ? " *" : ""}</th>)}<th /></tr></thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i}>
                <td className="muted">{i + 1}</td>
                {cols.map((c) => (
                  <td key={c.key}>
                    <input className="input" aria-label={`${c.label}, row ${i + 1}`} aria-invalid={!!rowErrors[i]?.[c.key]}
                      title={rowErrors[i]?.[c.key] || ""} value={row[c.key] ?? ""} autoComplete="off"
                      type={c.sensitive ? "password" : "text"} inputMode={c.type === "number" ? "decimal" : undefined}
                      onChange={(e) => setCell(i, c.key, e.target.value)} />
                    {rowErrors[i]?.[c.key] && <div className="err" style={{ marginTop: 2 }}>{rowErrors[i][c.key]}</div>}
                  </td>
                ))}
                <td className="col-x">
                  <button type="button" className="icon-btn" onClick={() => remove(i)} aria-label={`Remove row ${i + 1}`}><Icon name="trash" size={17} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="row">
        <Button icon="plus" type="button" onClick={() => onChange([...rows, blankPerRow(docType)])}>Add row</Button>
        <span className="muted small">{rows.length} row{rows.length === 1 ? "" : "s"} · max 200</span>
      </div>
      <details>
        <summary className="small" style={{ cursor: "pointer", fontWeight: 600 }}>Paste rows from a spreadsheet</summary>
        <p className="help" style={{ margin: "8px 0" }}>Copy cells from Excel or Google Sheets (no header row). Columns must be in this order: {cols.map((c) => c.label).join(", ")}.</p>
        <textarea className="input" rows={4} value={paste} onChange={(e) => setPaste(e.target.value)} aria-label="Pasted spreadsheet rows" />
        <div style={{ marginTop: 8 }}><Button type="button" onClick={importPaste} disabled={!paste.trim()}>Add pasted rows</Button></div>
      </details>
    </div>
  );
}
