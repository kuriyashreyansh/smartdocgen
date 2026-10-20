import { useMemo, useState } from "react";
import FieldInput from "./FieldInput";
import TableField from "./TableField";
import AiDraft from "./AiDraft";
import { Button } from "../ui";
import { isTable, tableTotals } from "../../lib/fields";
import { inr } from "../../lib/format";

/**
 * Renders every field of a document type. Props:
 *  docType, values, onChange(key, value), errors, dateHints (keys whose date was guessed from relative words),
 *  onConfirmDate(key), skipPerRow (batch mode: per-row fields live in the batch grid), linkOptions({key: [..]}).
 */
export default function DynamicForm({ docType, values, onChange, errors = {}, dateHints = [], onConfirmDate, skipPerRow = false, linkOptions = {} }) {
  const [notes, setNotes] = useState("");
  const aiKeys = useMemo(() => new Set(docType.ai_sections || []), [docType]);
  const fields = docType.fields.filter((f) => !(skipPerRow && f.per_row));
  const firstAi = fields.find((f) => aiKeys.has(f.key));

  // Facts for the AI: everything typed so far except the AI sections themselves (avoids copy-pasting between sections).
  const getFacts = () => {
    const facts = {};
    for (const f of docType.fields) if (!isTable(f) && !aiKeys.has(f.key) && String(values[f.key] ?? "").trim()) facts[f.key] = values[f.key];
    if (notes.trim()) facts.event_notes = notes.trim();
    return facts;
  };

  const tables = fields.filter(isTable);
  const grandTotal = tables.filter((f) => f.adds_to === "grand_total").reduce((s, f) => s + (tableTotals(f, values[f.key], values).total || 0), 0);

  return (
    <div className="form-grid">
      {firstAi && (
        <div className="full ai-note">
          <details>
            <summary>Rough notes for the AI (optional)</summary>
            <p className="help" style={{ margin: "8px 0" }}>Paste anything you know about the event. The AI only rewrites facts you give it and will not invent details.</p>
            <textarea className="input" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} aria-label="Notes for the AI" />
          </details>
        </div>
      )}
      {fields.map((f) => {
        if (isTable(f)) {
          return <TableField key={f.key} field={f} rows={values[f.key]} onChange={(rows) => onChange(f.key, rows)} error={errors[f.key]} values={values} />;
        }
        const needsConfirm = dateHints.includes(f.key);
        return (
          <FieldInput key={f.key} field={f} value={values[f.key]} onChange={(v) => onChange(f.key, v)} error={errors[f.key]}
            suggestions={f.links_to ? linkOptions[f.key] : undefined}
            hint={needsConfirm && (
              <div className="hint-warn">
                This date was worked out from words like “next” or “tomorrow”. Please confirm it.
                <Button size="sm" className="btn-sm" type="button" onClick={() => onConfirmDate(f.key)}>It’s correct</Button>
              </div>
            )}>
            {aiKeys.has(f.key) && <AiDraft field={f} getFacts={getFacts} value={values[f.key]} onApply={(t) => onChange(f.key, t)} />}
          </FieldInput>
        );
      })}
      {tables.some((f) => f.adds_to === "grand_total") && (
        <div className="full card" style={{ background: "var(--surface-2)", boxShadow: "none" }}>
          <div className="row spread"><strong>Grand total (preview)</strong><strong>₹ {inr(grandTotal)}</strong></div>
        </div>
      )}
    </div>
  );
}
