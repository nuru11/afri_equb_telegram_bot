import { useEffect, useState } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { api } from "./api";
import { Layout } from "./components/Layout";
import { AnalyticsPage } from "./pages/AnalyticsPage";
import { BroadcastPage } from "./pages/BroadcastPage";
import { LoginPage } from "./pages/LoginPage";
import { SettingsPage } from "./pages/SettingsPage";
import "./styles.css";

function ProtectedRoute({
  children,
  isAuthenticated,
}: {
  children: React.ReactNode;
  isAuthenticated: boolean;
}) {
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}

export function App() {
  const [authChecked, setAuthChecked] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [email, setEmail] = useState("");

  useEffect(() => {
    api
      .me()
      .then((data) => {
        setIsAuthenticated(true);
        setEmail(data.email);
      })
      .catch(() => setIsAuthenticated(false))
      .finally(() => setAuthChecked(true));
  }, []);

  if (!authChecked) {
    return (
      <div className="login-page">
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/login"
          element={
            isAuthenticated ? (
              <Navigate to="/" replace />
            ) : (
              <LoginPage
                onLogin={() => {
                  setIsAuthenticated(true);
                  api.me().then((d) => setEmail(d.email));
                }}
              />
            )
          }
        />
        <Route
          element={
            <ProtectedRoute isAuthenticated={isAuthenticated}>
              <Layout email={email} />
            </ProtectedRoute>
          }
        >
          <Route index element={<AnalyticsPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="broadcast" element={<BroadcastPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
