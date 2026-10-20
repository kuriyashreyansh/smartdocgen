import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/endpoints";
import { useDocTypes } from "../context/DocTypesContext";
import { useToast } from "../context/ToastContext";
import { Alert, Badge, Button, PageHeader, Spinner } from "../components/ui";
import { Icon } from "../components/ui/Icon";
import { prettyKey } from "../lib/format";

const MAX_BYTES = 5 * 1024 * 1024;
const ID_RE = /^[a-z0-9_]{3,50}$/;
const slug = (name) => name.replace(/\.docx$/i, "").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");

export default function Templates() {
  const toast = useToast();
  const { byId, reload } = useDocTypes();
  const fileRef = useRef(null);
  const [drag, setDrag] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [found, setFound] = useState(null); // { token, user_fields, auto_fields, ai_fields }
  const [form, setForm] = useState({ type_id: "", name: "", description: "", ref_code: "DOC" });
  const [defs, setDefs] = useState([]);
  const [saved, setSaved] = useState(null);

  async function pick(file) {
    if (!file) return;
    setError(null); setSaved(null);
    if (!file.name.toLowerCase().endsWith(".docx")) return setError(new Error("Please choose a .docx file."));
    if (file.size > MAX_BYTES) return setError(new Error("The file is too large (maximum 5 MB)."));
    setBusy(true);
    try {
      const res = await api.inspectTemplate(file);
      setFound(res);
      setDefs(res.user_fields.map((k) => ({ key: k, label: prettyKey(k), type: "text", required: true })));
      const id = slug(file.name);
      setForm({ type_id: id, name: prettyKey(id), description: "", ref_code: "DOC" });
    } catch (e) { setError(e); setFound(null); }
    finally { setBusy(false); if (fileRef.current) fileRef.current.value = ""; }
  }

  const setDef = (i, patch) => setDefs((d) => d.map((x, idx) => (idx === i ? { ...x, ...patch } : x)));
  const idOk = ID_RE.test(form.type_id);
  const valid = idOk && form.name.trim() && form.description.trim() && form.ref_code.trim() && defs.every((d) => d.label.trim());
  const overwrites = !!byId[form.type_id];

  async function save(e) {
    e.preventDefault();
    if (!valid || busy) return;
    setBusy(true); setError(null);
    try {
      const res = await api.saveTemplate({ token: found.token, ...form, fields: defs });
      setSaved(res); setFound(null); reload();
      toast.success("Template saved");
    } catch (err) { setError(err); }
    finally { setBusy(false); }
  }

  return (
    <>
      <PageHeader title="Templates" subtitle="Add a new document type by uploading a Word template. Use {{ placeholders }} in the document for the values that change." />
      <div className="steps"><span className={`step ${!found && !saved ? "on" : ""}`}><b>1</b>Upload</span><span className={`step ${found ? "on" : ""}`}><b>2</b>Describe fields</span><span className={`step ${saved ? "on" : ""}`}><b>3</b>Done</span></div>
      <div className="stack">
        {error && <Alert kind="error" title="Something went wrong" onClose={() => setError(null)}>
          {error.message}{error.fields?.length > 0 && <ul>{error.fields.map((f) => <li key={f} className="mono">{f}</li>)}</ul>}</Alert>}

        {saved && <Alert kind="success" title="Template saved"><span className="mono">{saved.type_id}</span> is now available.
          <div style={{ marginTop: 10 }} className="row"><Button variant="primary" to={`/create/${saved.type_id}`}>Create a document</Button><Button onClick={() => setSaved(null)}>Add another</Button></div></Alert>}

        {!found && !saved && (
          <div className={`dropzone ${drag ? "drag" : ""}`} role="button" tabIndex={0} aria-label="Upload a Word template"
            onClick={() => fileRef.current?.click()} onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && fileRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
            onDrop={(e) => { e.preventDefault(); setDrag(false); pick(e.dataTransfer.files?.[0]); }}>
            {busy ? <Spinner size={28} /> : <Icon name="upload" size={30} />}
            <h3 style={{ marginTop: 10 }}>{busy ? "Reading template…" : "Drop a .docx template here, or click to browse"}</h3>
            <p className="muted small">Maximum 5 MB. We will detect the placeholders automatically.</p>
            <input ref={fileRef} type="file" hidden accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={(e) => pick(e.target.files?.[0])} />
          </div>
        )}

        {found && (
          <form className="card stack" onSubmit={save} noValidate>
            {found.auto_fields.length > 0 && <Alert kind="info" title="Filled automatically">{found.auto_fields.join(", ")}. These come from the club settings, so you do not define them.</Alert>}
            {found.ai_fields.length > 0 && <Alert kind="info" title="AI section detected">{found.ai_fields.join(", ")}</Alert>}
            <div className="form-grid">
              <div className="field"><label className="lbl" htmlFor="tid"><span>Type ID <span className="req">*</span></span></label>
                <input id="tid" className="input mono" value={form.type_id} aria-invalid={!idOk} onChange={(e) => setForm({ ...form, type_id: e.target.value })} />
                <div className={idOk ? "help" : "err"}>Lowercase letters, numbers and underscores, 3–50 characters.</div>
                {overwrites && idOk && <div className="hint-warn">A document type with this ID already exists and will be replaced.</div>}</div>
              <div className="field"><label className="lbl" htmlFor="tn"><span>Name <span className="req">*</span></span></label>
                <input id="tn" className="input" maxLength={100} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
              <div className="field full"><label className="lbl" htmlFor="td"><span>Description <span className="req">*</span></span></label>
                <input id="td" className="input" maxLength={300} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
              <div className="field"><label className="lbl" htmlFor="tr"><span>Reference code <span className="req">*</span></span></label>
                <input id="tr" className="input mono" maxLength={10} value={form.ref_code} onChange={(e) => setForm({ ...form, ref_code: e.target.value.toUpperCase() })} />
                <div className="help">Used in reference numbers, e.g. ACM/2026-27/<b>{form.ref_code || "DOC"}</b>/001.</div></div>
            </div>
            <h2>Fields found in the template <Badge>{defs.length}</Badge></h2>
            {!defs.length ? <p className="muted">No {"{{ placeholders }}"} were found, so documents will be generated without any user input.</p> : (
              <div className="table-scroll"><table className="t"><thead><tr><th>Placeholder</th><th>Label shown on the form</th><th>Type</th><th>Required</th></tr></thead>
                <tbody>{defs.map((d, i) => (
                  <tr key={d.key}><td className="mono">{d.key}</td>
                    <td><input className="input" aria-label={`Label for ${d.key}`} value={d.label} onChange={(e) => setDef(i, { label: e.target.value })} aria-invalid={!d.label.trim()} /></td>
                    <td><select className="input" aria-label={`Type for ${d.key}`} value={d.type} onChange={(e) => setDef(i, { type: e.target.value })}><option value="text">Text</option><option value="date">Date</option><option value="number">Number</option></select></td>
                    <td><input type="checkbox" aria-label={`${d.key} required`} checked={d.required} onChange={(e) => setDef(i, { required: e.target.checked })} /></td></tr>))}</tbody></table></div>)}
            <Alert kind="info">Templates saved here appear in the form. Note: automatic detection from plain text (Smart compose) uses the server’s seed file, so new types are chosen manually until the backend team adds them there.</Alert>
            <div className="row"><Button type="submit" variant="primary" loading={busy} disabled={!valid}>Save template</Button><Button type="button" variant="ghost" onClick={() => { setFound(null); setError(null); }}>Start over</Button></div>
          </form>
        )}
        <p className="muted small">Looking for existing templates? They are listed on the <Link to="/">dashboard</Link>.</p>
      </div>
    </>
  );
}
