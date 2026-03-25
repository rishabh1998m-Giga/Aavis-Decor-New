/**
 * API base: empty string = same-origin (Vite proxy / production nginx /api).
 * Set VITE_API_URL when the SPA and API use different origins.
 */
export function apiBaseUrl(): string {
  const v = import.meta.env.VITE_API_URL;
  if (v === undefined || v === null || String(v).trim() === "") return "";
  return String(v).replace(/\/$/, "");
}

export function apiUrl(path: string): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${apiBaseUrl()}${p}`;
}

export class ApiRequestError extends Error {
  constructor(
    message: string,
    public status: number,
    public body?: unknown
  ) {
    super(message);
    this.name = "ApiRequestError";
  }
}

export async function apiJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(apiUrl(path), {
    ...init,
    credentials: "include",
    headers: {
      Accept: "application/json",
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...((init?.headers as Record<string, string>) || {}),
    },
  });
  const text = await res.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text) as unknown;
    } catch {
      data = text;
    }
  }
  if (!res.ok) {
    const msg =
      typeof data === "object" && data && "error" in data
        ? String((data as { error: string }).error)
        : res.statusText;
    throw new ApiRequestError(msg || "Request failed", res.status, data);
  }
  return data as T;
}

/** Multipart upload; do not set Content-Type (browser sets boundary). */
export async function apiUpload(
  path: string,
  form: FormData
): Promise<{ url: string }> {
  const res = await fetch(apiUrl(path), {
    method: "POST",
    credentials: "include",
    body: form,
  });
  const text = await res.text();
  let data: unknown = {};
  if (text) {
    try {
      data = JSON.parse(text) as unknown;
    } catch {
      data = {};
    }
  }
  if (!res.ok) {
    const msg =
      typeof data === "object" && data && "error" in data
        ? String((data as { error: string }).error)
        : res.statusText;
    throw new ApiRequestError(msg || "Upload failed", res.status, data);
  }
  return data as { url: string };
}

export function isApiConfigured(): boolean {
  return true;
}

export function apiConfigMessage(): string | null {
  return null;
}
