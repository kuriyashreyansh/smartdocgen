import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useParams, useSearchParams } from "react-router-dom";
import { api } from "../api/endpoints";
import { useAsync } from "../hooks/useAsync";
import { useDocTypes } from "../context/DocTypesContext";
import { useToast } from "../context/ToastContext";
import { Alert, Badge, Button, EmptyState, ErrorState, PageHeader, Skeleton } from "../components/ui";
import DynamicForm from "../components/form/DynamicForm";
import BatchEditor from "../components/BatchEditor";
import GenerateResult from "../components/GenerateResult";
import BatchResult from "../components/BatchResult";
import {
  blankPerRow, buildFields, emptyValues, fillValues, hasPerRow, isBlankRow, isTable, mapMissing, validate, validateRows,
} from "../lib/fields";

function Editor({ docType, source, prefill, editing }) {
  const toast = useToast();
  const { byId } = useDocTypes();
  const initial = useMemo(() => {
    if (source) return fillValues(docType, source.data, { clearSensitive: true });
    if (prefill) return fillValues(docType, prefill.fields);
    return { values: emptyValues(docType), cleared: [] };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const [values, setValues] = useState(initial.values);
  const [mode, setMode] = useState("single");
  const [rows, setRows] = useState(() => [blankPerRow(docType)]);
  const [errors, setErrors] = useState({});
  const [rowErrors, setRowErrors] = useState({});
  const [general, setGeneral] = useState([]);
  const [submitError, setSubmitError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [batch, setBatch] = useState(null);
  const [documentId, setDocumentId] = useState(source?.documentId ?? null);
  const [dateHints, setDateHints] = useState(prefill?.confirmDates || []);
  const resultRef = useRef(null);
  const batchMode = mode === "batch";

  // Suggestions for fields that point at another document type (e.g. bill certificate -> approval notes).
  const linkTypes = docType.fields.filter((f) => f.links_to);
  const { data: docs } = useAsync((s) => (linkTypes.length ? api.documents(s) : Promise.resolve([])), [docType.type_id]);
  const linkOptions = useMemo(() => Object.fromEntries(linkTypes.map((f) => [
    f.key, (docs || []).filter((d) => d.type === byId[f.links_to]?.name).map((d) => d.ref_no)])), [docs]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { if (result || batch) resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }); }, [result, batch]);

  const setValue = (key, v) => {
    setValues((s) => ({ ...s, [key]: v }));
    if (errors[key]) setErrors((e) => { const { [key]: _, ...rest } = e; return rest; });
    setDateHints((h) => h.filter((k) => k !== key));
  };

  // Progress through required fields
  const required = docType.fields.filter((f) => f.required && !(batchMode && f.per_row));
  const done = required.filter((f) => isTable(f) ? (values[f.key] || []).some((r) => Object.values(r).some((x) => String(x).trim())) : String(values[f.key] ?? "").trim()).length;

  function focusFirstError() {
    setTimeout(() => document.querySelector('[aria-invalid="true"], .err')?.scrollIntoView({ behavior: "smooth", block: "center" }), 50);
  }

  async function submit(asNew = false) {
    if (busy) return;
    setSubmitError(null); setGeneral([]);
    const errs = validate(docType, values, { skipPerRow: batchMode });
    let rErrs = {};
    if (batchMode) {
      const all = validateRows(docType, rows);
      rows.forEach((r, i) => { if (!isBlankRow(r) && all[i]) rErrs[i] = all[i]; });
      if (rows.every(isBlankRow)) errs._rows = "Add at least one row";
    }
    setErrors(errs); setRowErrors(rErrs);
    if (Object.keys(errs).length || Object.keys(rErrs).length) {
      toast.error("Please fix the highlighted fields.");
      focusFirstError();
      return;
    }
    setBusy(true);
    try {
      if (batchMode) {
        const filled = rows.filter((r) => !isBlankRow(r)).map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, String(v).trim()])));
        const res = await api.generateBatch({ doc_type: docType.type_id, common: buildFields(docType, values, { skipPerRow: true }), rows: filled });
        setBatch(res);
        res.count_error ? toast.error(`${res.count_error} row(s) failed`) : toast.success(`${res.count_ok} documents generated`);
      } else {
        const res = await api.generate({
          doc_type: docType.type_id, fields: buildFields(docType, values),
          document_id: asNew ? null : documentId,
        });
        setResult(res); setDocumentId(res.document_id);
        toast.success(`Generated ${res.ref_no} (v${res.version})`);
      }
    } catch (e) {
      if (e.missing) {
        const m = mapMissing(docType, e.missing);
        setErrors(m.fieldErrors); setGeneral(m.general); focusFirstError();
        toast.error("The server found missing or invalid details.");
      } else {
        setSubmitError(e); toast.error(e.message);
      }
    } finally { setBusy(false); }
  }

  const templateMissing = submitError?.message?.includes("File problem");
  const filledCount = rows.filter((r) => !isBlankRow(r)).length;
  const primaryLabel = batchMode ? (filledCount ? `Generate ${filledCount} document${filledCount === 1 ? "" : "s"}` : "Generate documents") : documentId ? "Generate new version" : "Generate document";

  return (
    <>
      <PageHeader
        title={editing ? `New version of ${source.refNo}` : docType.name}
        subtitle={docType.description?.trim()}
        actions={<Button variant="ghost" to={editing ? `/documents/${source.documentId}` : "/"}>Cancel</Button>}
      />
      <div className="workspace">
        <section className="stack">
          {hasPerRow(docType) && !editing && (
            <div className="row spread card" style={{ padding: 14 }}>
              <div><strong>How many documents?</strong><div className="muted small">Batch mode makes one document per row (for example one receipt per winner).</div></div>
              <div className="seg" role="group" aria-label="Mode">
                <button type="button" aria-pressed={!batchMode} onClick={() => setMode("single")}>Single</button>
                <button type="button" aria-pressed={batchMode} onClick={() => setMode("batch")}>Batch</button>
              </div>
            </div>
          )}
          {initial.cleared.length > 0 && <Alert kind="info" title="Re-enter sensitive details">For security these are only stored as their last 4 characters, so please enter them again: {initial.cleared.join(", ")}.</Alert>}
          {prefill && <Alert kind="info" title="Pre-filled from your description">Check every field. Anything you did not mention is left empty.</Alert>}

          <form className="card stack" noValidate onSubmit={(e) => { e.preventDefault(); submit(); }}>
            {batchMode && <h2>Shared details</h2>}
            <DynamicForm docType={docType} values={values} onChange={setValue} errors={errors} dateHints={dateHints}
              onConfirmDate={(k) => setDateHints((h) => h.filter((x) => x !== k))} skipPerRow={batchMode} linkOptions={linkOptions} />
            {batchMode && (<>
              <h2 style={{ marginTop: 8 }}>One document per row</h2>
              <BatchEditor docType={docType} rows={rows} onChange={(r) => { setRows(r); setRowErrors({}); setErrors((e) => ({ ...e, _rows: undefined })); }} rowErrors={rowErrors} />
              {errors._rows && <div className="err">{errors._rows}</div>}
            </>)}
            {general.length > 0 && <Alert kind="error" title="Also fix"><ul>{general.map((g, i) => <li key={i}>{g}</li>)}</ul></Alert>}
            {submitError && (
              <Alert kind="error" title="Could not generate the document">
                {submitError.message}
                {templateMissing && <div style={{ marginTop: 6 }}>The template file for this document type is missing on the server. Ask the backend team to add it under <span className="mono">backend/storage/templates/</span>, or upload it on the <Link to="/templates">Templates</Link> page.</div>}
              </Alert>
            )}
            <div className="sticky-actions">
              <Button type="submit" variant="primary" icon="file" loading={busy}>{busy ? "Generating…" : primaryLabel}</Button>
              {documentId && !batchMode && <Button type="button" disabled={busy} onClick={() => submit(true)}>Create as a separate document</Button>}
            </div>
          </form>
        </section>

        <aside className="stack" ref={resultRef}>
          {busy && <div className="card stack"><strong>Generating…</strong><Skeleton h={14} /><Skeleton h={14} w="70%" /><Skeleton h={220} /><span className="muted small">Creating the Word file and converting it to PDF can take a few seconds.</span></div>}
          {!busy && result && !batchMode && <GenerateResult result={result} />}
          {!busy && batch && batchMode && <BatchResult result={batch} docType={docType} />}
          {!busy && !(result && !batchMode) && !(batch && batchMode) && (
            <div className="card stack">
              <div className="row spread"><h3>Progress</h3><Badge tone={done === required.length ? "ok" : "neutral"}>{done}/{required.length} required</Badge></div>
              <div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={required.length} aria-valuenow={done}><div style={{ width: `${required.length ? (done / required.length) * 100 : 0}%` }} /></div>
              <p className="muted small">Fields marked * are required. After generating you can preview the PDF here, download the Word file, and create new versions.</p>
            </div>
          )}
        </aside>
      </div>
    </>
  );
}

/** Resolves the document type (and, when editing, the existing document) before showing the form. */
export default function CreateDocument() {
  const { typeId } = useParams();
  const [search] = useSearchParams();
  const editId = search.get("doc");
  const { state } = useLocation();
  const { byId, types, loading, error, reload } = useDocTypes();
  const existing = useAsync((s) => (editId ? api.document(editId, s) : Promise.resolve(null)), [editId]);
  const docType = byId[typeId];

  if (loading || existing.loading) return <div className="stack"><Skeleton h={32} w="40%" /><div className="card stack"><Skeleton h={40} /><Skeleton h={40} /><Skeleton h={120} /></div></div>;
  if (error) return <ErrorState error={error} onRetry={reload} title="Could not load document types" />;
  if (existing.error) return <ErrorState error={existing.error} onRetry={existing.reload} title="Could not load that document" />;
  if (!docType) {
    return <EmptyState icon="alert" title="Unknown document type" action={<Button variant="primary" to="/">Choose a template</Button>}>
      “{typeId}” is not available{types.length ? "" : " (the server has no document types yet)"}.</EmptyState>;
  }
  let source = null;
  if (existing.data) {
    const latest = existing.data.versions.at(-1);
    if (existing.data.type_id !== typeId || !latest) {
      return <EmptyState icon="alert" title="This document does not match the selected type" action={<Button to="/documents">Back to documents</Button>} />;
    }
    source = { documentId: existing.data.document_id, refNo: existing.data.ref_no, data: latest.data };
  }
  return <Editor key={`${typeId}-${editId || "new"}`} docType={docType} source={source} prefill={state?.prefill} editing={!!source} />;
}
