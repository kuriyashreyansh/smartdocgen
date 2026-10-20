import { fileUrl } from "../api/client";
import { Alert, Badge, Button } from "./ui";

/** Outcome of POST /generate/batch: per-row status and the zip with every generated document. */
export default function BatchResult({ result, docType }) {
  const label = Object.fromEntries(docType.fields.map((f) => [f.key, f.label]));
  const detail = (r) => r.missing ? "Missing or invalid: " + r.missing.map((m) => label[m] || m).join(", ") : r.message || "Failed";
  return (
    <div className="stack" id="result">
      <Alert kind={result.count_error ? "warn" : "success"}
        title={`${result.count_ok} document${result.count_ok === 1 ? "" : "s"} generated${result.count_error ? `, ${result.count_error} failed` : ""}`}>
        {result.count_error > 0 && "Fix the failed rows and generate again. Rows that succeeded were already saved, so only resubmit the failed ones."}
      </Alert>
      {result.zip_url && <div><Button variant="primary" icon="download" href={fileUrl(result.zip_url)} download>Download all (zip)</Button></div>}
      <div className="table-scroll">
        <table className="t">
          <thead><tr><th>#</th><th>Name</th><th>Status</th><th>Details</th></tr></thead>
          <tbody>
            {result.results.map((r) => (
              <tr key={r.row}>
                <td>{r.row}</td><td>{r.name || "—"}</td>
                <td><Badge tone={r.status === "ok" ? "ok" : "bad"}>{r.status === "ok" ? "Done" : "Failed"}</Badge></td>
                <td>
                  {r.status === "ok" ? (
                    <span className="row"><span className="mono">{r.ref_no}</span>
                      <a href={fileUrl(r.pdf_url)} target="_blank" rel="noreferrer">PDF</a>
                      <a href={fileUrl(r.docx_url)} target="_blank" rel="noreferrer">Word</a></span>
                  ) : <span style={{ color: "var(--bad)" }}>{detail(r)}</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
