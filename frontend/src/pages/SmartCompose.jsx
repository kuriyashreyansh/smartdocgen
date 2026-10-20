import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api/endpoints";
import { useDocTypes } from "../context/DocTypesContext";
import { Alert, Badge, Button, PageHeader } from "../components/ui";
import { isTable } from "../lib/fields";
import { formatDate } from "../lib/format";

const EXAMPLES = [
  "We need Seminar Hall 402 in the CSE department on 12 December from 6 PM to 8 PM for our Internal Hackathon. About 150 participants, offline.",
  "Approval note for the SIH internal hackathon on 20 November at the main auditorium. Category: hackathon, for all year students.",
];

export default function SmartCompose() {
  const nav = useNavigate();
  const { types, byId } = useDocTypes();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [res, setRes] = useState(null);

  async function analyse(typeOverride) {
    if (!text.trim() || busy) return;
    setBusy(true); setError(null);
    try { setRes(await api.parse({ text, doc_type: typeOverride || undefined })); }
    catch (e) { setError(e); setRes(null); }
    finally { setBusy(false); }
  }

  const type = res?.doc_type ? byId[res.doc_type] : null;
  const found = type ? type.fields.filter((f) => !isTable(f) && res.fields?.[f.key] != null && res.fields[f.key] !== "") : [];
  const hasTables = type?.fields.some(isTable);

  return (
    <>
      <PageHeader title="Smart compose" subtitle="Describe the document you need. We will detect its type and fill in only what you actually mention. Nothing is guessed." />
      <div className="workspace">
        <section className="card stack">
          <div className="field">
            <label className="lbl" htmlFor="req"><span>Your request</span></label>
            <textarea id="req" className="input" rows={7} value={text} onChange={(e) => setText(e.target.value)}
              placeholder="e.g. We need a venue for our hackathon on 12 December, 6 to 8 PM…"
              onKeyDown={(e) => { if ((e.ctrlKey || e.metaKey) && e.key === "Enter") analyse(); }} />
            <div className="help">Press Ctrl/⌘ + Enter to analyse.</div>
          </div>
          <div className="row">
            <Button variant="primary" icon="sparkles" loading={busy} disabled={!text.trim()} onClick={() => analyse()}>Analyse request</Button>
            <Button variant="ghost" to="/">Pick a template instead</Button>
          </div>
          <div>
            <div className="muted small" style={{ marginBottom: 6 }}>Try an example</div>
            <div className="stack" style={{ gap: 8 }}>
              {EXAMPLES.map((ex) => <button key={ex} className="chip" style={{ textAlign: "left", borderRadius: 10 }} onClick={() => setText(ex)}>{ex}</button>)}
            </div>
          </div>
          {error && (
            <Alert kind="error" title="Could not analyse the request" action={
              <div style={{ marginTop: 8 }}>You can still <Link to="/">choose a template</Link> and fill the form manually.</div>}>{error.message}</Alert>
          )}
        </section>

        <aside className="stack">
          {!res && !busy && <div className="card"><h3>How it works</h3><ol className="muted" style={{ paddingLeft: 18, marginBottom: 0 }}>
            <li>Write your request in plain words.</li><li>We detect the document type.</li><li>Review the extracted details, then continue to the form.</li></ol></div>}

          {res?.needs_doc_type && (
            <div className="card stack">
              <Alert kind="warn" title="We are not sure which document you need">Pick the right type and we will extract the details again.</Alert>
              <div className="tabs">{(res.options || types).map((o) => <button key={o.type_id} className="chip" disabled={busy} onClick={() => analyse(o.type_id)}>{o.name}</button>)}</div>
            </div>
          )}

          {res && !res.needs_doc_type && (
            <div className="card stack">
              <div className="row spread">
                <div><div className="muted small">Detected type</div><h3>{type?.name || res.doc_type}</h3></div>
                <Badge tone={res.confidence >= 0.8 ? "ok" : "warn"}>{Math.round(res.confidence * 100)}% sure</Badge>
              </div>
              <div className="field">
                <label className="lbl" htmlFor="chg"><span>Not right? Change type</span></label>
                <select id="chg" className="input" value={res.doc_type} disabled={busy} onChange={(e) => analyse(e.target.value)}>
                  {types.map((t) => <option key={t.type_id} value={t.type_id}>{t.name}</option>)}
                </select>
              </div>
              {found.length ? (
                <dl className="kv">{found.map((f) => (<div key={f.key} style={{ display: "contents" }}><dt>{f.label}</dt><dd>{f.type === "date" ? formatDate(res.fields[f.key]) : String(res.fields[f.key])}</dd></div>))}</dl>
              ) : <p className="muted">No details could be found in your text.</p>}
              {res.confirm_dates?.length > 0 && <Alert kind="warn" title="Please confirm dates">Some dates were worked out from relative words (like “tomorrow”). You will be asked to confirm them on the form.</Alert>}
              {res.removed_by_grounding?.length > 0 && <Alert kind="info" title="Left out on purpose">These values were not found in your text, so they were removed: {res.removed_by_grounding.map((k) => type?.fields.find((f) => f.key === k)?.label || k).join(", ")}.</Alert>}
              {res.missing?.length > 0 && <Alert kind="info" title={`${res.missing.length} detail${res.missing.length > 1 ? "s" : ""} still needed`}><ul>{res.missing.map((m) => <li key={m.key}>{m.question}</li>)}</ul></Alert>}
              {hasTables && <p className="muted small">Tables (like expenses) are not extracted from text. You will fill those on the form.</p>}
              <Button variant="primary" onClick={() => nav(`/create/${res.doc_type}`, { state: { prefill: { fields: res.fields, confirmDates: res.confirm_dates || [], removed: res.removed_by_grounding || [] } } })}>Continue to form</Button>
            </div>
          )}
        </aside>
      </div>
    </>
  );
}
