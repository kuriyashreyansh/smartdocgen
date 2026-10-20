import { useState } from "react";
import { fileUrl } from "../api/client";
import { Alert, Button, Badge } from "./ui";

/** Shows the outcome of POST /generate: reference number, warnings, PDF preview and downloads. */
export default function GenerateResult({ result }) {
  const [copied, setCopied] = useState(false);
  const pdf = fileUrl(result.pdf_url), docx = fileUrl(result.docx_url);
  const copy = async () => {
    try { await navigator.clipboard.writeText(result.ref_no); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* clipboard blocked */ }
  };
  return (
    <div className="stack" id="result">
      <Alert kind="success" title="Document generated">
        Reference <span className="mono">{result.ref_no}</span> <Badge tone="primary">version {result.version}</Badge>
      </Alert>
      {result.warnings?.length > 0 && (
        <Alert kind="warn" title="Please double-check">
          <ul>{result.warnings.map((w, i) => <li key={i}>{w}</li>)}</ul>
        </Alert>
      )}
      <div className="row">
        <Button variant="primary" icon="download" href={pdf} download>PDF</Button>
        <Button icon="download" href={docx} download>Word</Button>
        <Button variant="ghost" icon="copy" onClick={copy}>{copied ? "Copied" : "Copy ref no."}</Button>
        <Button variant="ghost" icon="history" to={`/documents/${result.document_id}`}>History</Button>
      </div>
      <iframe className="pdf-frame" title="PDF preview" src={pdf} />
    </div>
  );
}
