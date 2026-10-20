import { useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../api/endpoints";
import { fileUrl } from "../api/client";
import { useAsync } from "../hooks/useAsync";
import { useDocTypes } from "../context/DocTypesContext";
import { Badge, Button, EmptyState, ErrorState, PageHeader, Skeleton } from "../components/ui";
import { formatDate, formatDateTime, prettyKey } from "../lib/format";

function DataView({ docType, data }) {
  const defs = docType ? docType.fields : Object.keys(data).map((k) => ({ key: k, label: prettyKey(k), type: Array.isArray(data[k]) ? "table" : "text" }));
  const present = defs.filter((f) => data[f.key] !== undefined && data[f.key] !== "" && !(Array.isArray(data[f.key]) && !data[f.key].length));
  if (!present.length) return <p className="muted">No data stored for this version.</p>;
  return (
    <dl className="kv">
      {present.map((f) => (
        <div key={f.key} style={{ display: "contents" }}>
          <dt>{f.label}</dt>
          <dd>{Array.isArray(data[f.key]) ? (
            <div className="table-scroll"><table className="t"><thead><tr>{Object.keys(data[f.key][0] || {}).map((c) => <th key={c}>{f.columns?.find((x) => x.key === c)?.label || prettyKey(c)}</th>)}</tr></thead>
              <tbody>{data[f.key].map((r, i) => <tr key={i}>{Object.values(r).map((v, j) => <td key={j}>{String(v)}</td>)}</tr>)}</tbody></table></div>
          ) : f.type === "date" ? formatDate(data[f.key]) : String(data[f.key])}</dd>
        </div>
      ))}
    </dl>
  );
}

export default function DocumentDetail() {
  const { id } = useParams();
  const { byId } = useDocTypes();
  const { data, error, loading, reload } = useAsync((s) => api.document(id, s), [id]);
  const [picked, setPicked] = useState(null);

  if (loading) return <div className="stack"><Skeleton h={32} w="35%" /><div className="card"><Skeleton h={420} /></div></div>;
  if (error) {
    return error.status === 404
      ? <EmptyState icon="alert" title="Document not found" action={<Button variant="primary" to="/documents">Back to documents</Button>}>It may have been removed or the link is wrong.</EmptyState>
      : <ErrorState error={error} onRetry={reload} title="Could not load this document" />;
  }
  const docType = byId[data.type_id];
  const versions = data.versions;
  const current = versions.find((v) => v.version === picked) || versions.at(-1);
  const pdf = current && fileUrl(current.pdf_url);

  return (
    <>
      <PageHeader title={<span className="mono">{data.ref_no}</span>} subtitle={docType?.name}
        actions={<><Button to="/documents">All documents</Button>
          {docType && <Button variant="primary" icon="plus" to={`/create/${data.type_id}?doc=${data.document_id}`}>Create new version</Button>}</>} />
      {!current ? <EmptyState icon="file" title="No versions yet">This document has no generated versions.</EmptyState> : (
        <div className="workspace" style={{ gridTemplateColumns: "minmax(0,1.2fr) minmax(0,1fr)" }}>
          <section className="card stack">
            <div className="row spread">
              <div className="tabs" role="tablist" aria-label="Versions">
                {versions.map((v) => <button key={v.version} role="tab" className="chip" aria-pressed={v.version === current.version} aria-selected={v.version === current.version} onClick={() => setPicked(v.version)}>v{v.version}</button>)}
              </div>
              <span className="row"><Button size="sm" icon="download" href={pdf}>PDF</Button><Button size="sm" icon="download" href={fileUrl(current.docx_url)} download>Word</Button></span>
            </div>
            <iframe key={pdf} className="pdf-frame" style={{ height: 620 }} title={`PDF of version ${current.version}`} src={pdf} />
          </section>
          <aside className="card stack" style={{ position: "static" }}>
            <div className="row spread"><h2>Version {current.version}</h2><Badge>{formatDateTime(current.created_at)}</Badge></div>
            {versions.length > 1 && <p className="muted small">{versions.length} versions. Select a tab to compare what was entered each time.</p>}
            <DataView docType={docType} data={current.data || {}} />
            {!docType && <p className="muted small">This document’s template is no longer available, so labels are shown as stored.</p>}
            <p className="muted small">Bank and PAN numbers are stored masked, so a new version asks you to enter them again.</p>
          </aside>
        </div>
      )}
    </>
  );
}
