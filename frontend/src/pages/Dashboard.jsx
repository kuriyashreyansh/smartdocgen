import { Link } from "react-router-dom";
import { api } from "../api/endpoints";
import { useAsync } from "../hooks/useAsync";
import { useDocTypes } from "../context/DocTypesContext";
import { Badge, Button, EmptyState, ErrorState, PageHeader, Skeleton, SkeletonCards } from "../components/ui";
import { Icon } from "../components/ui/Icon";
import DocTypeCard from "../components/DocTypeCard";
import { formatDateTime } from "../lib/format";

function RecentDocuments() {
  const { data, error, loading, reload } = useAsync((s) => api.documents(s));
  if (loading) return <div className="card stack">{[0, 1, 2].map((i) => <Skeleton key={i} h={18} />)}</div>;
  if (error) return <ErrorState error={error} onRetry={reload} title="Could not load recent documents" />;
  if (!data.length) {
    return <EmptyState icon="history" title="No documents yet">Documents you generate will show up here with their reference numbers and download links.</EmptyState>;
  }
  return (
    <div className="table-scroll">
      <table className="t">
        <thead><tr><th>Reference</th><th>Type</th><th>Created</th><th /></tr></thead>
        <tbody>
          {data.slice(0, 5).map((d) => (
            <tr key={d.document_id}>
              <td className="mono">{d.ref_no}</td><td>{d.type}</td>
              <td className="muted">{formatDateTime(d.created_at)}</td>
              <td className="num"><Button size="sm" to={`/documents/${d.document_id}`}>Open</Button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function Dashboard() {
  const { types, loading, error, reload } = useDocTypes();
  return (
    <>
      <PageHeader title="What would you like to create?" subtitle="Describe a document in plain words, or pick a template and fill in the details." />
      <div className="hero">
        <Link to="/smart" className="card hero-card primary">
          <span className="badge-ico"><Icon name="sparkles" /></span>
          <div><h3>Smart compose</h3><p>Paste a short request. We detect the document type and pre-fill the form for you.</p></div>
        </Link>
        <Link to="/documents" className="card hero-card">
          <span className="badge-ico"><Icon name="history" /></span>
          <div><h3>Document history</h3><p>Find, download or create a new version of documents you made earlier.</p></div>
        </Link>
      </div>

      <section className="section" aria-labelledby="types-h">
        <div className="card-title"><h2 id="types-h">Document templates</h2>{!loading && !error && <Badge>{types.length}</Badge>}</div>
        {loading ? <SkeletonCards /> : error ? <ErrorState error={error} onRetry={reload} title="Could not load document templates" /> :
          !types.length ? <EmptyState icon="layers" title="No templates yet" action={<Button variant="primary" to="/templates">Add a template</Button>}>
            The server has no document types. Seed the database (python -m seed.seed) or upload a template.</EmptyState> :
          <div className="grid-cards">{types.map((t) => <DocTypeCard key={t.type_id} type={t} />)}</div>}
      </section>

      <section className="section" aria-labelledby="recent-h">
        <div className="card-title"><h2 id="recent-h">Recent documents</h2><Button variant="ghost" size="sm" to="/documents">View all</Button></div>
        <RecentDocuments />
      </section>
    </>
  );
}
