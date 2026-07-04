import { useEffect, useRef, useState } from "react";
import { api, type Broadcast, type BroadcastStatus } from "../api";

export function BroadcastPage() {
  const [content, setContent] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");
  const [history, setHistory] = useState<Broadcast[]>([]);
  const [activeStatus, setActiveStatus] = useState<BroadcastStatus | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    loadHistory();
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  async function loadHistory() {
    try {
      const data = await api.getBroadcasts();
      setHistory(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load broadcasts");
    }
  }

  function startPolling(broadcastId: string) {
    if (pollRef.current) clearInterval(pollRef.current);

    const poll = async () => {
      try {
        const status = await api.getBroadcastStatus(broadcastId);
        setActiveStatus(status);
        if (status.status === "COMPLETED" || status.status === "FAILED") {
          if (pollRef.current) clearInterval(pollRef.current);
          loadHistory();
        }
      } catch {
        if (pollRef.current) clearInterval(pollRef.current);
      }
    };

    poll();
    pollRef.current = setInterval(poll, 2000);
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim()) return;

    setSending(true);
    setError("");
    setActiveStatus(null);

    try {
      const broadcast = await api.createBroadcast(content, photoUrl || undefined);
      startPolling(broadcast.id);
      setContent("");
      setPhotoUrl("");
      loadHistory();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Broadcast failed");
    } finally {
      setSending(false);
    }
  }

  return (
    <div>
      <h1 className="page-title">Broadcast</h1>
      {error && <div className="alert alert-error">{error}</div>}

      <div className="card">
        <h2>Send Message to All Users</h2>
        <form onSubmit={handleSend}>
          <div className="form-group">
            <label htmlFor="content">Message</label>
            <textarea
              id="content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Enter your broadcast message..."
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="photoUrl">Photo URL (optional)</label>
            <input
              id="photoUrl"
              type="url"
              value={photoUrl}
              onChange={(e) => setPhotoUrl(e.target.value)}
              placeholder="https://example.com/image.jpg"
            />
          </div>
          <button type="submit" className="btn btn-primary" disabled={sending}>
            {sending ? "Starting broadcast..." : "Send Broadcast"}
          </button>
        </form>
      </div>

      {activeStatus && activeStatus.status === "RUNNING" && (
        <div className="card">
          <h2>Progress</h2>
          <p>{activeStatus.message}</p>
          <div className="progress-bar">
            <div
              className="progress-bar-fill"
              style={{ width: `${activeStatus.progress}%` }}
            />
          </div>
          <p style={{ fontSize: "0.85rem", color: "#666" }}>
            Sent: {activeStatus.sent} | Failed: {activeStatus.failed} | Total:{" "}
            {activeStatus.total}
          </p>
        </div>
      )}

      {activeStatus && activeStatus.status === "COMPLETED" && (
        <div className="alert alert-success">
          Broadcast completed. Sent: {activeStatus.sent}, Failed: {activeStatus.failed}
        </div>
      )}

      <div className="card">
        <h2>Broadcast History</h2>
        {history.length === 0 ? (
          <p style={{ color: "#666" }}>No broadcasts yet.</p>
        ) : (
          <ul className="broadcast-history">
            {history.map((b) => (
              <li key={b.id}>
                <strong>{new Date(b.createdAt).toLocaleString()}</strong> — {b.status} —{" "}
                {b.sent}/{b.total} sent
                <br />
                <span style={{ color: "#666" }}>
                  {b.content.slice(0, 80)}
                  {b.content.length > 80 ? "..." : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
