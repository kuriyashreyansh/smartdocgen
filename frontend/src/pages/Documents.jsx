import { useMemo, useState } from "react";
import { api } from "../api/endpoints";
import { fileUrl } from "../api/client";
import { useAsync } from "../hooks/useAsync";
import { Badge, Button, EmptyState, ErrorState, PageHeader, Skeleton } from "../components/ui";
import { Icon } from "../components/ui/Icon";
import { formatDateTime } from "../lib/format";

export default function Documents() {
  const { data, error, loading, reload } = useAsync((s) => api.documents(s));
  const [q, setQ] = useState("");
  const [type, setType] = useState("");

  const types = useMemo(() => [...new Set((data || []).map((d) => d.type).filter(Boolean))], [data]);
  const shown = useMemo(() => (data || []).filter((d) =>
    (!type || d.type === type) && (!q.trim() || `${d.ref_no} ${d.type}`.toLowerCase().includes(q.trim().toLowerCase()))), [data, q, type]);

  return (
    <>
      <PageHeader title="Documents" subtitle="Every document generated for your club, newest first."
        actions={<><Button icon="refresh" onClick={reload} disabled={loading}>Refresh</Button><Button variant="primary" icon="plus" to="/">New document</Button></>} />
      {loading && !data ? <div className="card stack">{[0, 1, 2, 3].map((i) => <Skeleton key={i} h={20} />)}</div> :
        error ? <ErrorState error={error} onRetry={reload} title="Could not load documents" /> :
        !data.length ? <EmptyState icon="history" title="No documents yet" action={<Button variant="primary" to="/">Create your first document</Button>}>Generated documents are saved here with all their versions.</EmptyState> : (
        <div className="stack">
          <div className="row">
            <div className="input-wrap" style={{ flex: "1 1 240px" }}>
              <input className="input" placeholder="Search by reference or type" aria-label="Search documents" value={q} onChange={(e) => setQ(e.target.value)} style={{ paddingLeft: 38 }} />
              <span style={{ position: "absolute", left: 11, top: 10, color: "var(--muted)" }}><Icon name="search" size={18} /></span>
            </div>
            <select className="input" style={{ width: "auto" }} aria-label="Filter by type" value={type} onChange={(e) => setType(e.target.value)}>
              <option value="">All types</option>{types.map((t) => <option key={t}>{t}</option>)}
            </select>
          </div>
          {!shown.length ? <EmptyState icon="search" title="No matches" action={<Button onClick={() => { setQ(""); setType(""); }}>Clear filters</Button>}>No documents match your search.</EmptyState> : (
            <div className="table-scroll">
              <table className="t">
                <thead><tr><th>Reference</th><th>Type</th><th>Versions</th><th>Created</th><th>Status</th><th /></tr></thead>
                <tbody>
                  {shown.map((d) => (
                    <tr key={d.document_id}>
                      <td className="mono">{d.ref_no}</td><td>{d.type || "—"}</td>
                      <td>{d.version_count}</td><td className="muted">{formatDateTime(d.created_at)}</td>
                      <td><Badge>{d.status}</Badge></td>
                      <td><span className="row" style={{ justifyContent: "flex-end", flexWrap: "nowrap" }}>
                        {d.latest && <Button size="sm" href={fileUrl(d.latest.pdf_url)}>PDF</Button>}
                        {d.latest && <Button size="sm" href={fileUrl(d.latest.docx_url)} download>Word</Button>}
                        <Button size="sm" variant="primary" to={`/documents/${d.document_id}`}>Open</Button></span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>)}
    </>
  );
}
