import { useEffect, useRef, useState } from "react";
import { api, type Broadcast, type BroadcastStatus } from "../api";

export function BroadcastPage() {
  const [content, setContent] = useState("");
  const [uploadedPhotoUrl, setUploadedPhotoUrl] = useState("");
  const [manualPhotoUrl, setManualPhotoUrl] = useState("");
  const [photoPreview, setPhotoPreview] = useState("");
  const [uploading, setUploading] = useState(false);
  const [history, setHistory] = useState<Broadcast[]>([]);
  const [activeStatus, setActiveStatus] = useState<BroadcastStatus | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [actionId, setActionId] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

        const shouldStop =
          status.status !== "RUNNING" &&
          status.status !== "PENDING" &&
          !status.deleteRunning;

        if (shouldStop) {
          if (pollRef.current) clearInterval(pollRef.current);
          loadHistory();
        }
      } catch {
        if (pollRef.current) clearInterval(pollRef.current);
        setActiveStatus(null);
        loadHistory();
      }
    };

    poll();
    pollRef.current = setInterval(poll, 2000);
  }

  async function handlePhotoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError("");

    try {
      const { url } = await api.uploadPhoto(file);
      setUploadedPhotoUrl(url);
      setManualPhotoUrl("");
      setPhotoPreview(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Photo upload failed");
      setUploadedPhotoUrl("");
      setPhotoPreview("");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function clearPhoto() {
    setUploadedPhotoUrl("");
    setManualPhotoUrl("");
    setPhotoPreview("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  const activePhotoUrl = uploadedPhotoUrl || manualPhotoUrl.trim();

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim()) return;

    setSending(true);
    setError("");
    setActiveStatus(null);

    try {
      const broadcast = await api.createBroadcast(content, activePhotoUrl || undefined);
      startPolling(broadcast.id);
      setContent("");
      clearPhoto();
      loadHistory();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Broadcast failed");
    } finally {
      setSending(false);
    }
  }

  async function handleDelete(id: string) {
    if (
      !window.confirm(
        "Delete this broadcast from admin and remove the message from all users' Telegram chats? User-side removal only works within 48 hours of sending."
      )
    ) {
      return;
    }

    setActionId(id);
    setError("");
    try {
      const result = await api.deleteBroadcast(id);
      if (result.deleting) {
        startPolling(id);
      } else {
        if (activeStatus?.id === id) setActiveStatus(null);
        loadHistory();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setActionId(null);
    }
  }

  const showSendProgress = activeStatus && activeStatus.status === "RUNNING";
  const showDeleteProgress = activeStatus?.deleteRunning;
  const showSendComplete =
    activeStatus &&
    (activeStatus.status === "COMPLETED" || activeStatus.status === "FAILED") &&
    !activeStatus.deleteRunning;

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
            <label htmlFor="photoFile">Image attachment (optional)</label>
            <input
              id="photoFile"
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              onChange={handlePhotoSelect}
              disabled={uploading}
            />
            {uploading && <p className="form-hint">Uploading image...</p>}
            {photoPreview && (
              <div className="photo-preview">
                <img src={photoPreview} alt="Attachment preview" />
                <button type="button" className="btn btn-secondary" onClick={clearPhoto}>
                  Remove image
                </button>
              </div>
            )}
          </div>
          <div className="form-group">
            <label htmlFor="photoUrl">Or paste image URL</label>
            <input
              id="photoUrl"
              type="url"
              value={manualPhotoUrl}
              disabled={!!uploadedPhotoUrl}
              onChange={(e) => {
                setManualPhotoUrl(e.target.value);
                setUploadedPhotoUrl("");
                setPhotoPreview(e.target.value);
              }}
              placeholder="https://example.com/image.jpg"
            />
            {uploadedPhotoUrl && (
              <p className="form-hint">Using uploaded image. Remove it above to paste a URL instead.</p>
            )}
          </div>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={sending || uploading}
          >
            {sending ? "Starting broadcast..." : "Send Broadcast"}
          </button>
        </form>
      </div>

      {showSendProgress && (
        <div className="card">
          <h2>Progress</h2>
          <p>{activeStatus.message}</p>
          <div className="progress-bar">
            <div
              className="progress-bar-fill"
              style={{ width: `${activeStatus.progress}%` }}
            />
          </div>
          <p className="progress-stats">
            Sent: {activeStatus.sent} | Failed: {activeStatus.failed} | Total:{" "}
            {activeStatus.total}
          </p>
        </div>
      )}

      {showDeleteProgress && (
        <div className="card">
          <h2>Deleting</h2>
          <p>Removing messages from users&apos; chats and admin history...</p>
          <div className="progress-bar">
            <div
              className="progress-bar-fill"
              style={{ width: `${activeStatus.deleteProgress}%` }}
            />
          </div>
          <p className="progress-stats">
            Cleared: {activeStatus.deleteCleared} | Failed: {activeStatus.deleteFailed} | Total:{" "}
            {activeStatus.deleteTotal}
          </p>
        </div>
      )}

      {showSendComplete && activeStatus.status === "COMPLETED" && (
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
                <div className="broadcast-history-header">
                  <div>
                    <strong>{new Date(b.createdAt).toLocaleString()}</strong> — {b.status} —{" "}
                    {b.sent}/{b.total} sent
                  </div>
                  <div className="broadcast-history-actions">
                    <button
                      type="button"
                      className="btn btn-danger"
                      disabled={actionId === b.id || b.status === "RUNNING"}
                      onClick={() => handleDelete(b.id)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
                {b.photoUrl && (
                  <img
                    src={b.photoUrl}
                    alt=""
                    className="broadcast-thumb"
                  />
                )}
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
