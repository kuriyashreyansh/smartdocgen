import { Button } from "../ui";
import { Icon } from "../ui/Icon";
import { blankRow, enteredCols, tableTotals } from "../../lib/fields";
import { inr } from "../../lib/format";

/** Editable table for `type: "table"` fields (expense lists, items purchased, payees…). */
export default function TableField({ field, rows, onChange, error, values }) {
  const setCell = (i, key, v) => onChange(rows.map((r, idx) => (idx === i ? { ...r, [key]: v } : r)));
  const remove = (i) => onChange(rows.length > 1 ? rows.filter((_, idx) => idx !== i) : [blankRow(field)]);
  const { computed, total, extras } = tableTotals(field, rows, values);
  const colSpan = field.columns.length;

  return (
    <div className="field full">
      <div className="card-title" style={{ marginBottom: 8 }}>
        <span className="lbl" style={{ margin: 0, fontWeight: 600 }}>
          {field.label}{field.required && <span className="req"> *</span>}
        </span>
        <Button size="sm" className="btn-sm" icon="plus" type="button" onClick={() => onChange([...rows, blankRow(field)])}>Add row</Button>
      </div>
      <div className="table-scroll" role="group" aria-label={field.label}>
        <table className="t">
          <thead>
            <tr>{field.columns.map((c) => <th key={c.key} className={c.type === "number" ? "num" : ""}>{c.label}{c.optional ? "" : " *"}</th>)}<th /></tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i}>
                {field.columns.map((c) => c.multiply ? (
                  <td key={c.key}><span className="computed" aria-label={`${c.label} (calculated)`}>{Number.isFinite(computed[i][c.key]) ? inr(computed[i][c.key]) : "—"}</span></td>
                ) : (
                  <td key={c.key}>
                    <input className="input" aria-label={`${c.label}, row ${i + 1}`} value={row[c.key] ?? ""}
                      type={c.sensitive ? "password" : "text"} inputMode={c.type === "number" ? "decimal" : undefined}
                      autoComplete="off" onChange={(e) => setCell(i, c.key, e.target.value)}
                      style={c.type === "number" ? { textAlign: "right" } : undefined} />
                  </td>
                ))}
                <td className="col-x">
                  <button type="button" className="icon-btn" onClick={() => remove(i)} aria-label={`Remove row ${i + 1}`}><Icon name="trash" size={17} /></button>
                </td>
              </tr>
            ))}
          </tbody>
          {total !== null && (
            <tfoot>
              <tr><td colSpan={colSpan - 1} className="num">Total</td><td className="num">{inr(total)}</td><td /></tr>
              {extras.map((e) => (
                <tr key={e.key}><td colSpan={colSpan - 1} className="num" style={{ textTransform: "capitalize" }}>{e.label}</td><td className="num">{inr(e.value)}</td><td /></tr>
              ))}
            </tfoot>
          )}
        </table>
      </div>
      {error && <div className="err">{error}</div>}
      <div className="help">
        {enteredCols(field).some((c) => c.sensitive) ? "Masked columns are only kept as their last 4 characters in history. " : ""}
        Totals shown here are a preview; the final figures are calculated when the document is generated.
      </div>
    </div>
  );
}
