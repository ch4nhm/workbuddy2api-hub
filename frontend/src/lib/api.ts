const KEY_STORE = "wb-proxy-api-key";
const PANEL_STORE = "wb-proxy-panel-token";

let panelToken = "";
let apiKey = "";
let sessionLostHandler: (() => void) | null = null;

try {
  panelToken = sessionStorage.getItem(PANEL_STORE) || "";
} catch {
  panelToken = "";
}

try {
  const fromUrl = new URLSearchParams(window.location.search).get("key");
  if (fromUrl) {
    apiKey = fromUrl.trim();
    localStorage.setItem(KEY_STORE, apiKey);
    const rest = new URLSearchParams(window.location.search);
    rest.delete("key");
    const qs = rest.toString();
    history.replaceState(null, "", window.location.pathname + (qs ? `?${qs}` : ""));
  } else {
    apiKey = (localStorage.getItem(KEY_STORE) || "").trim();
  }
} catch {
  apiKey = "";
}

export function getPanelToken(): string {
  return panelToken;
}

export function setPanelToken(token: string): void {
  panelToken = token || "";
  try {
    if (panelToken) sessionStorage.setItem(PANEL_STORE, panelToken);
    else sessionStorage.removeItem(PANEL_STORE);
  } catch {
    // Session storage is optional; the in-memory token still works.
  }
}

export function onPanelSessionLost(handler: (() => void) | null): void {
  sessionLostHandler = handler;
}

export function isAuthError(error: unknown): boolean {
  return error instanceof Error && error.message === "unauthorized";
}

function usableKey(value: string): string {
  return value && /^[\x20-\x7e]+$/.test(value) ? value : "";
}

function authHeaders(base?: Record<string, string>): Record<string, string> {
  const headers = { ...(base || {}) };
  const key = usableKey(apiKey);
  if (key) headers.Authorization = `Bearer ${key}`;
  if (panelToken) headers["X-Panel-Token"] = panelToken;
  return headers;
}

interface InflightEntry {
  at: number;
  promise: Promise<unknown>;
}

const inflight = new Map<string, InflightEntry>();
const STALE_MS = 60_000;

export interface ReadOptions {
  revalidate?: boolean;
  signal?: AbortSignal;
}

export const POLL_READ: ReadOptions = { revalidate: true };

export async function getJSON<T>(url: string, options: ReadOptions = {}): Promise<T> {
  const cache = options.revalidate ? "no-cache" : "no-store";
  const key = `${cache} ${url}`;
  const hit = inflight.get(key);
  if (hit && Date.now() - hit.at < STALE_MS && !options.signal) {
    return hit.promise as Promise<T>;
  }

  const run = async () => {
    const response = await fetch(url, {
      cache,
      headers: authHeaders(),
      signal: options.signal,
    });
    if (response.status === 401 || response.status === 403) {
      sessionLostHandler?.();
      throw new Error("unauthorized");
    }
    if (!response.ok) throw new Error(String(response.status));
    return (await response.json()) as T;
  };

  const entry: InflightEntry = { at: Date.now(), promise: null as unknown as Promise<unknown> };
  entry.promise = run().finally(() => {
    if (inflight.get(key) === entry) inflight.delete(key);
  });
  inflight.set(key, entry);
  return entry.promise as Promise<T>;
}

export async function postJSON<T = Record<string, unknown>>(
  url: string,
  body: unknown = {},
): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(body ?? {}),
  });
  const text = await response.text();
  let parsed: Record<string, unknown> = {};
  try {
    parsed = text ? JSON.parse(text) : {};
  } catch {
    parsed = { raw: text };
  }
  if (response.status === 401 || response.status === 403) {
    sessionLostHandler?.();
    throw new Error("unauthorized");
  }
  if (!response.ok) {
    const error = parsed.error as { message?: string } | undefined;
    throw new Error(error?.message || String(response.status));
  }
  return parsed as T;
}

export async function downloadJSON(
  url: string,
  label = "",
): Promise<{ count: number; filename: string }> {
  const response = await fetch(url, {
    cache: "no-store",
    headers: authHeaders(),
  });
  if (response.status === 401 || response.status === 403) {
    sessionLostHandler?.();
    throw new Error("unauthorized");
  }
  if (!response.ok) {
    let message = `HTTP ${response.status}`;
    try {
      const payload = (await response.json()) as { error?: { message?: string } };
      message = payload.error?.message || message;
    } catch {
      // Keep the status-based message when the error body is not JSON.
    }
    throw new Error(message);
  }

  const text = await response.text();
  let parsed: { count?: number };
  try {
    parsed = JSON.parse(text) as { count?: number };
  } catch {
    throw new Error("返回内容不是 JSON");
  }

  const stamp = new Date().toISOString().slice(0, 19).replace(/[-:T]/g, "");
  const filename = `workbuddy-accounts-${label}${stamp}.json`;
  const blob = new Blob([text], { type: "application/json" });
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);

  return { count: Number(parsed.count || 0), filename };
}

export async function loginPanel(password: string): Promise<{
  ok?: boolean;
  token?: string;
  using_default_password?: boolean;
  error?: { message?: string };
}> {
  const response = await fetch("/panel/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password }),
  });
  const data = (await response.json().catch(() => ({}))) as {
    ok?: boolean;
    token?: string;
    using_default_password?: boolean;
    error?: { message?: string };
  };
  if (!response.ok) throw new Error(data.error?.message || "密码错误");
  if (data.token) setPanelToken(data.token);
  return data;
}

export async function logoutPanel(): Promise<void> {
  try {
    await postJSON("/panel/logout", {});
  } finally {
    setPanelToken("");
  }
}
