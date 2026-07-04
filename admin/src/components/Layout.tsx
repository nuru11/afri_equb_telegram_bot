import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { api } from "../api";

export function Layout({ email }: { email: string }) {
  const navigate = useNavigate();

  async function handleLogout() {
    await api.logout();
    navigate("/login");
  }

  return (
    <div className="layout">
      <aside className="sidebar">
        <h1>MOE Result Bot</h1>
        <nav>
          <NavLink to="/" end className={({ isActive }) => (isActive ? "active" : "")}>
            Analytics
          </NavLink>
          <NavLink to="/settings" className={({ isActive }) => (isActive ? "active" : "")}>
            Settings
          </NavLink>
          <NavLink to="/broadcast" className={({ isActive }) => (isActive ? "active" : "")}>
            Broadcast
          </NavLink>
        </nav>
      </aside>
      <main className="main">
        <div className="header-bar">
          <span />
          <span className="email">
            {email}{" "}
            <button type="button" className="btn btn-secondary" onClick={handleLogout} style={{ marginLeft: "0.5rem", padding: "0.3rem 0.75rem", fontSize: "0.85rem" }}>
              Logout
            </button>
          </span>
        </div>
        <Outlet />
      </main>
    </div>
  );
}
