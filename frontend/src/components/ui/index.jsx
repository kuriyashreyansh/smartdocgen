import { Link } from "react-router-dom";
import { Icon } from "./Icon";

export function Spinner({ size = 18 }) {
  return <span className="spinner" style={{ width: size, height: size }} role="status" aria-label="Loading" />;
}

/** Button or router link. `loading` disables it and shows a spinner. */
export function Button({ variant = "secondary", size, icon, loading, children, to, href, className = "", ...rest }) {
  const cls = `btn btn-${variant} ${size === "sm" ? "btn-sm" : ""} ${className}`;
  const inner = (<>{loading ? <Spinner size={16} /> : icon && <Icon name={icon} size={18} />}{children}</>);
  if (to) return <Link to={to} className={cls} {...rest}>{inner}</Link>;
  if (href) return <a href={href} className={cls} target="_blank" rel="noreferrer" {...rest}>{inner}</a>;
  return <button className={cls} disabled={loading || rest.disabled} {...rest}>{inner}</button>;
}

export function Alert({ kind = "info", title, children, onClose, action }) {
  const icon = kind === "success" ? "check" : kind === "info" ? "info" : "alert";
  return (
    <div className={`alert alert-${kind}`} role={kind === "error" ? "alert" : "status"}>
      <Icon name={icon} size={20} />
      <div className="alert-body">
        {title && <strong>{title}</strong>}
        {children && <div>{children}</div>}
        {action}
      </div>
      {onClose && <button className="icon-btn" onClick={onClose} aria-label="Dismiss"><Icon name="x" size={16} /></button>}
    </div>
  );
}

export function ErrorState({ error, onRetry, title = "Something went wrong" }) {
  return (
    <Alert kind="error" title={title}
      action={onRetry && <div style={{ marginTop: 10 }}><Button icon="refresh" onClick={onRetry}>Try again</Button></div>}>
      {error?.message || String(error)}
    </Alert>
  );
}

export function EmptyState({ icon = "file", title, children, action }) {
  return (
    <div className="empty">
      <div className="empty-icon"><Icon name={icon} size={28} /></div>
      <h3>{title}</h3>
      {children && <p>{children}</p>}
      {action}
    </div>
  );
}

export const Skeleton = ({ h = 16, w = "100%", style }) => <div className="skeleton" style={{ height: h, width: w, ...style }} />;

export function SkeletonCards({ n = 4 }) {
  return (
    <div className="grid-cards">
      {Array.from({ length: n }, (_, i) => (
        <div key={i} className="card"><Skeleton h={20} w="60%" /><Skeleton style={{ marginTop: 14 }} /><Skeleton w="80%" style={{ marginTop: 8 }} /></div>
      ))}
    </div>
  );
}

export const Badge = ({ tone = "neutral", children }) => <span className={`badge badge-${tone}`}>{children}</span>;

export function PageHeader({ title, subtitle, actions }) {
  return (
    <header className="page-header">
      <div><h1>{title}</h1>{subtitle && <p className="muted">{subtitle}</p>}</div>
      {actions && <div className="page-actions">{actions}</div>}
    </header>
  );
}
