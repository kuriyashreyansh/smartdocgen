import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { api } from "../api/endpoints";
import { Icon } from "./ui/Icon";

const NAV = [
  { to: "/", label: "Dashboard", icon: "home", end: true },
  { to: "/smart", label: "Smart compose", icon: "sparkles" },
  { to: "/documents", label: "Documents", icon: "history" },
  { to: "/templates", label: "Templates", icon: "layers" },
];

function ServerStatus() {
  const [ok, setOk] = useState(null);
  useEffect(() => {
    let alive = true;
    const check = () => api.health().then(() => alive && setOk(true)).catch(() => alive && setOk(false));
    check();
    const t = setInterval(check, 30000);
    return () => { alive = false; clearInterval(t); };
  }, []);
  return (
    <div className="status" title="Backend /health">
      <span className={`dot ${ok === null ? "" : ok ? "dot-ok" : "dot-bad"}`} />
      {ok === null ? "Checking server…" : ok ? "Backend online" : "Backend unreachable"}
    </div>
  );
}

export default function Layout() {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  useEffect(() => setOpen(false), [pathname]);

  return (
    <div className="shell">
      <header className="topbar">
        <button className="icon-btn" onClick={() => setOpen(true)} aria-label="Open menu"><Icon name="menu" /></button>
        <span className="brand-name">SmartDoc</span>
      </header>
      {open && <div className="scrim" onClick={() => setOpen(false)} />}
      <aside className={`sidebar ${open ? "open" : ""}`}>
        <div className="brand"><span className="brand-logo"><Icon name="file" size={20} /></span><span className="brand-name">SmartDoc</span></div>
        <nav aria-label="Main">
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}>
              <Icon name={n.icon} size={19} />{n.label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-foot"><ServerStatus /></div>
      </aside>
      <main className="main"><div className="container"><Outlet /></div></main>
    </div>
  );
}
