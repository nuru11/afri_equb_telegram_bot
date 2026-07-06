import { useEffect, useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { api } from "../api";

export function Layout({ email }: { email: string }) {
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    document.body.style.overflow = sidebarOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [sidebarOpen]);

  async function handleLogout() {
    await api.logout();
    navigate("/login");
  }

  function closeSidebar() {
    setSidebarOpen(false);
  }

  return (
    <div className={sidebarOpen ? "layout sidebar-open" : "layout"}>
      <div
        className="sidebar-overlay"
        onClick={closeSidebar}
        aria-hidden={!sidebarOpen}
      />
      <aside className="sidebar">
        <h1>MOE Result Bot</h1>
        <nav>
          <NavLink
            to="/"
            end
            className={({ isActive }) => (isActive ? "active" : "")}
            onClick={closeSidebar}
          >
            Analytics
          </NavLink>
          <NavLink
            to="/settings"
            className={({ isActive }) => (isActive ? "active" : "")}
            onClick={closeSidebar}
          >
            Settings
          </NavLink>
          <NavLink
            to="/broadcast"
            className={({ isActive }) => (isActive ? "active" : "")}
            onClick={closeSidebar}
          >
            Broadcast
          </NavLink>
        </nav>
      </aside>
      <main className="main">
        <div className="header-bar">
          <button
            type="button"
            className="menu-btn"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open menu"
          >
            <span />
            <span />
            <span />
          </button>
          <span className="email">
            {email}{" "}
            <button
              type="button"
              className="btn btn-secondary btn-logout"
              onClick={handleLogout}
            >
              Logout
            </button>
          </span>
        </div>
        <Outlet />
      </main>
    </div>
  );
}
