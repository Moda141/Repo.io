const TOKEN_KEY = "mdm_token";

export const getToken = () => {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
};
export const setToken = (t: string | null) => {
  try {
    if (t) localStorage.setItem(TOKEN_KEY, t);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* storage unavailable */
  }
};

export class ApiError extends Error {
  /** Per-field validation errors, when the API returns {detail: {fields: {...}}}. */
  fields?: Record<string, string>;
  constructor(public status: number, message: string, fields?: Record<string, string>) {
    super(message);
    this.fields = fields;
  }
}

export async function api<T = unknown>(path: string, init: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(path, { ...init, headers: { ...headers, ...(init.headers as object) } });
  if (!res.ok) {
    let message = res.statusText;
    let fields: Record<string, string> | undefined;
    try {
      const detail = (await res.json()).detail;
      if (typeof detail === "string") message = detail;
      else if (detail && typeof detail === "object" && !Array.isArray(detail)) {
        message = detail.message ?? message;
        fields = detail.fields;
      } else if (Array.isArray(detail) && detail.length) {
        message = detail.map((d: { msg?: string }) => d.msg).filter(Boolean).join("; ") || message;
      }
    } catch {
      /* not json */
    }
    throw new ApiError(res.status, message, fields);
  }
  return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
}
