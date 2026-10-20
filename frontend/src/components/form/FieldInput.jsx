import { useId, useState } from "react";
import { Icon } from "../ui/Icon";

/**
 * One input driven by a field definition from doc_types.json:
 * text | longtext | date | number | (options -> select) | sensitive (masked) | links_to (suggestions).
 */
export default function FieldInput({ field, value, onChange, error, hint, suggestions, children, compact = false }) {
  const id = useId();
  const [reveal, setReveal] = useState(false);
  const describedBy = [error && `${id}-err`, field.question && !compact && `${id}-help`].filter(Boolean).join(" ") || undefined;
  const common = { id, value: value ?? "", "aria-invalid": !!error, "aria-describedby": describedBy,
    onChange: (e) => onChange(e.target.value), className: "input" };

  let control;
  if (field.options) {
    control = (
      <select {...common}>
        <option value="">Select…</option>
        {field.options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    );
  } else if (field.type === "longtext") {
    control = <textarea {...common} rows={4} />;
  } else if (field.type === "date") {
    control = <input {...common} type="date" />;
  } else if (field.type === "number") {
    control = <input {...common} type="text" inputMode="decimal" placeholder="0" autoComplete="off" />;
  } else if (field.sensitive) {
    control = (
      <div className="input-wrap">
        <input {...common} type={reveal ? "text" : "password"} autoComplete="off" spellCheck={false} />
        <button type="button" className="icon-btn" onClick={() => setReveal((r) => !r)} aria-label={reveal ? "Hide value" : "Show value"}>
          <Icon name={reveal ? "eyeOff" : "eye"} size={18} />
        </button>
      </div>
    );
  } else {
    control = <input {...common} type="text" list={suggestions ? `${id}-list` : undefined} autoComplete="off" />;
  }

  return (
    <div className={`field ${field.type === "longtext" ? "full" : ""}`}>
      {compact ? null : (
        <label className="lbl" htmlFor={id}>
          <span>{field.label}{field.required && <span className="req" aria-hidden="true"> *</span>}</span>
          {!field.required && <span className="opt">optional</span>}
        </label>
      )}
      {control}
      {suggestions && <datalist id={`${id}-list`}>{suggestions.map((s) => <option key={s} value={s} />)}</datalist>}
      {error && <div id={`${id}-err`} className="err">{error}</div>}
      {hint}
      {field.sensitive && !compact && <div className="help">Sensitive: only the last 4 characters are kept in the document history.</div>}
      {field.question && !compact && !error && <div id={`${id}-help`} className="help">{field.question}</div>}
      {children}
    </div>
  );
}
