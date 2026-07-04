import { useEffect, useState } from "react";
import { api, type Analytics } from "../api";

export function AnalyticsPage() {
  const [data, setData] = useState<Analytics | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api.getAnalytics().then(setData).catch((e) => setError(e.message));
  }, []);

  if (error) {
    return <div className="alert alert-error">{error}</div>;
  }

  if (!data) {
    return <p>Loading analytics...</p>;
  }

  return (
    <div>
      <h1 className="page-title">Analytics</h1>
      <div className="stats-grid">
        <div className="stat-card">
          <div className="value">{data.totalUsers.toLocaleString()}</div>
          <div className="label">Total Users</div>
        </div>
        <div className="stat-card">
          <div className="value">{data.activeUsers.toLocaleString()}</div>
          <div className="label">Active Users</div>
        </div>
        <div className="stat-card">
          <div className="value">{data.blockedUsers.toLocaleString()}</div>
          <div className="label">Blocked Users</div>
        </div>
        <div className="stat-card">
          <div className="value">{data.remedialClicks.toLocaleString()}</div>
          <div className="label">Remedial Clicks</div>
        </div>
        <div className="stat-card">
          <div className="value">{data.entranceClicks.toLocaleString()}</div>
          <div className="label">Entrance Clicks</div>
        </div>
      </div>
    </div>
  );
}
