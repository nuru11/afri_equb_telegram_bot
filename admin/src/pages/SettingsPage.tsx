import { useEffect, useState } from "react";
import { api, type Settings } from "../api";

export function SettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [testingRemedial, setTestingRemedial] = useState(false);
  const [testingEntrance, setTestingEntrance] = useState(false);

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

  async function handleTestChannel(type: "remedial" | "entrance") {
    const setTesting = type === "remedial" ? setTestingRemedial : setTestingEntrance;
    setTesting(true);
    setMessage("");
    setError("");
    try {
      const result = await api.testChannel(type);
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

          <h3>Remedial Channel</h3>
          <div className="form-group">
            <label htmlFor="remedialChannelLink">Telegram Channel Link</label>
            <input
              id="remedialChannelLink"
              type="url"
              value={settings.remedialChannelLink}
              onChange={(e) =>
                setSettings({ ...settings, remedialChannelLink: e.target.value })
              }
              placeholder="https://t.me/your-remedial-channel"
            />
          </div>
          <div className="form-group">
            <label htmlFor="remedialChannelChatId">Channel Chat ID</label>
            <input
              id="remedialChannelChatId"
              type="text"
              value={settings.remedialChannelChatId}
              onChange={(e) =>
                setSettings({ ...settings, remedialChannelChatId: e.target.value })
              }
              placeholder="@your-remedial-channel or -1001234567890"
            />
          </div>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => handleTestChannel("remedial")}
            disabled={testingRemedial}
          >
            {testingRemedial ? "Testing..." : "Test Remedial Channel"}
          </button>

          <h3 style={{ marginTop: "1.5rem" }}>Entrance Channel</h3>
          <div className="form-group">
            <label htmlFor="entranceChannelLink">Telegram Channel Link</label>
            <input
              id="entranceChannelLink"
              type="url"
              value={settings.entranceChannelLink}
              onChange={(e) =>
                setSettings({ ...settings, entranceChannelLink: e.target.value })
              }
              placeholder="https://t.me/your-entrance-channel"
            />
          </div>
          <div className="form-group">
            <label htmlFor="entranceChannelChatId">Channel Chat ID</label>
            <input
              id="entranceChannelChatId"
              type="text"
              value={settings.entranceChannelChatId}
              onChange={(e) =>
                setSettings({ ...settings, entranceChannelChatId: e.target.value })
              }
              placeholder="@your-entrance-channel or -1001234567890"
            />
          </div>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => handleTestChannel("entrance")}
            disabled={testingEntrance}
          >
            {testingEntrance ? "Testing..." : "Test Entrance Channel"}
          </button>

          <div className="form-group" style={{ marginTop: "1.5rem" }}>
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
