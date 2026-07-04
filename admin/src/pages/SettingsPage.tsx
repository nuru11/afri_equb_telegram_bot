import { useEffect, useState } from "react";
import { api, type Settings } from "../api";

export function SettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    api.getSettings().then(setSettings).catch((e) => setError(e.message));
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!settings) return;
    setSaving(true);
    setMessage("");
    setError("");
    try {
      const updated = await api.updateSettings(settings);
      setSettings(updated);
      setMessage("Settings saved successfully.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function handleTestChannel() {
    setTesting(true);
    setMessage("");
    setError("");
    try {
      const result = await api.testChannel();
      setMessage(result.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Channel test failed");
    } finally {
      setTesting(false);
    }
  }

  if (!settings) {
    return <p>Loading settings...</p>;
  }

  return (
    <div>
      <h1 className="page-title">Settings</h1>
      {message && <div className="alert alert-success">{message}</div>}
      {error && <div className="alert alert-error">{error}</div>}

      <form onSubmit={handleSave}>
        <div className="card">
          <h2>Result Release Toggles</h2>
          <div className="toggle-row">
            <label htmlFor="remedialReleased">2018 Remedial Result Released</label>
            <input
              id="remedialReleased"
              type="checkbox"
              checked={settings.remedialReleased}
              onChange={(e) =>
                setSettings({ ...settings, remedialReleased: e.target.checked })
              }
            />
          </div>
          <div className="toggle-row">
            <label htmlFor="entranceReleased">2018 Entrance Result Released</label>
            <input
              id="entranceReleased"
              type="checkbox"
              checked={settings.entranceReleased}
              onChange={(e) =>
                setSettings({ ...settings, entranceReleased: e.target.checked })
              }
            />
          </div>
        </div>

        <div className="card">
          <h2>Channel & Links</h2>
          <div className="form-group">
            <label htmlFor="channelLink">Telegram Channel Link</label>
            <input
              id="channelLink"
              type="url"
              value={settings.channelLink}
              onChange={(e) => setSettings({ ...settings, channelLink: e.target.value })}
              placeholder="https://t.me/yourchannel"
            />
          </div>
          <div className="form-group">
            <label htmlFor="channelChatId">Channel Chat ID</label>
            <input
              id="channelChatId"
              type="text"
              value={settings.channelChatId}
              onChange={(e) => setSettings({ ...settings, channelChatId: e.target.value })}
              placeholder="@yourchannel or -1001234567890"
            />
          </div>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleTestChannel}
            disabled={testing}
          >
            {testing ? "Testing..." : "Test Channel Connection"}
          </button>
          <div className="form-group" style={{ marginTop: "1rem" }}>
            <label htmlFor="remedialUrl">Official Remedial Result URL</label>
            <input
              id="remedialUrl"
              type="url"
              value={settings.remedialUrl}
              onChange={(e) => setSettings({ ...settings, remedialUrl: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label htmlFor="entranceUrl">Official Entrance Result URL</label>
            <input
              id="entranceUrl"
              type="url"
              value={settings.entranceUrl}
              onChange={(e) => setSettings({ ...settings, entranceUrl: e.target.value })}
            />
          </div>
        </div>

        <div className="card">
          <h2>Custom Messages</h2>
          <div className="form-group">
            <label htmlFor="preReleaseMessage">Pre-Release Message</label>
            <textarea
              id="preReleaseMessage"
              value={settings.preReleaseMessage}
              onChange={(e) =>
                setSettings({ ...settings, preReleaseMessage: e.target.value })
              }
            />
          </div>
          <div className="form-group">
            <label htmlFor="postActionMessage">Post-Join Success Message</label>
            <textarea
              id="postActionMessage"
              value={settings.postActionMessage}
              onChange={(e) =>
                setSettings({ ...settings, postActionMessage: e.target.value })
              }
            />
          </div>
        </div>

        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? "Saving..." : "Save Settings"}
        </button>
      </form>
    </div>
  );
}
