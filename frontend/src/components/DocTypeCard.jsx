import { Link } from "react-router-dom";
import { Badge } from "./ui";
import { Icon } from "./ui/Icon";
import { hasPerRow, isTable } from "../lib/fields";

export default function DocTypeCard({ type }) {
  return (
    <Link to={`/create/${type.type_id}`} className="card type-card">
      <div className="row spread"><Icon name="file" className="muted" /><Icon name="chevron" size={18} className="muted" /></div>
      <h3>{type.name}</h3>
      <p>{type.description?.trim() || "No description."}</p>
      <div className="row">
        <Badge>{type.fields.length} fields</Badge>
        {type.ai_sections?.length > 0 && <Badge tone="primary">AI draft</Badge>}
        {hasPerRow(type) && <Badge tone="ok">Batch</Badge>}
        {type.fields.some(isTable) && <Badge>Table</Badge>}
      </div>
    </Link>
  );
}
