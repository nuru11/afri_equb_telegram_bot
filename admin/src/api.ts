// Empty = same origin (API serves admin). Set VITE_API_URL when admin is on another domain.
const API_BASE = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const headers = new Headers(options.headers);
  if (options.body !== undefined && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const res = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    ...options,
    headers,
  });

  const contentType = res.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    const hint = API_BASE
      ? `Unexpected response from ${API_BASE}${path}.`
      : "Admin is calling its own domain for /api. Set VITE_API_URL to your API server and rebuild.";
    throw new Error(hint);
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed: ${res.status}`);
  }

  return res.json() as Promise<T>;
}

export type Settings = {
  remedialReleased: boolean;
  entranceReleased: boolean;
  remedialChannelLink: string;
  entranceChannelLink: string;
  remedialChannelChatId: string;
  entranceChannelChatId: string;
  remedialUrl: string;
  entranceUrl: string;
  preReleaseMessage: string;
  postActionMessage: string;
};

export type Analytics = {
  totalUsers: number;
  activeUsers: number;
  blockedUsers: number;
  remedialClicks: number;
  entranceClicks: number;
};

export type Broadcast = {
  id: string;
  content: string;
  photoUrl: string | null;
  status: string;
  sent: number;
  failed: number;
  total: number;
  recalledAt: string | null;
  recalled: number;
  recallFailed: number;
  createdAt: string;
};

export type BroadcastStatus = {
  id: string;
  status: string;
  sent: number;
  failed: number;
  total: number;
  processed: number;
  progress: number;
  message: string;
  deleteRunning: boolean;
  deleteTotal: number;
  deleteProcessed: number;
  deleteCleared: number;
  deleteFailed: number;
  deleteProgress: number;
};

export type DeleteBroadcastResult = {
  ok: boolean;
  deleting?: boolean;
  deleted?: boolean;
  userChatsCleared?: boolean;
};

export const api = {
  login: (email: string, password: string) =>
    request<{ email: string }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),

  logout: () => request<{ ok: boolean }>("/api/auth/logout", { method: "POST" }),

  me: () => request<{ email: string }>("/api/auth/me"),

  getSettings: () => request<Settings>("/api/settings"),

  updateSettings: (data: Partial<Settings>) =>
    request<Settings>("/api/settings", {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  testChannel: (type: "remedial" | "entrance") =>
    request<{ ok: boolean; message: string; botIsAdmin: boolean }>(
      "/api/settings/test-channel",
      { method: "POST", body: JSON.stringify({ type }) }
    ),

  getAnalytics: () => request<Analytics>("/api/analytics"),

  getBroadcasts: () => request<Broadcast[]>("/api/broadcasts"),

  createBroadcast: (content: string, photoUrl?: string) =>
    request<Broadcast>("/api/broadcasts", {
      method: "POST",
      body: JSON.stringify({ content, photoUrl: photoUrl || "" }),
    }),

  getBroadcastStatus: (id: string) =>
    request<BroadcastStatus>(`/api/broadcasts/${id}/status`),

  uploadPhoto: async (file: File): Promise<{ url: string }> => {
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch(`${API_BASE}/api/uploads/photo`, {
      method: "POST",
      credentials: "include",
      body: formData,
    });
    const contentType = res.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
      throw new Error("Upload failed: unexpected response");
    }
    const body = await res.json();
    if (!res.ok) {
      throw new Error(body.error || `Upload failed: ${res.status}`);
    }
    return body as { url: string };
  },

  deleteBroadcast: (id: string) =>
    request<DeleteBroadcastResult>(`/api/broadcasts/${id}`, { method: "DELETE" }),
};
