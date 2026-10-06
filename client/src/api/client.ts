import { useAuthStore } from "../store/authStore";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:5201/api";

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  signal?: AbortSignal;
  /** Internal — set on the retry after a silent refresh so we don't loop forever. */
  isRetry?: boolean;
}

async function rawFetch(path: string, options: RequestOptions, accessToken: string | null) {
  const multipart = options.body instanceof FormData;
  return fetch(`${API_URL}${path}`, {
    method: options.method ?? "GET",
    credentials: "include",
    signal: options.signal,
    headers: {
      ...(options.body && !multipart ? { "Content-Type": "application/json" } : {}),
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body: multipart ? options.body as FormData : options.body ? JSON.stringify(options.body) : undefined,
  });
}

// A 401 usually just means the short-lived access token expired mid-session.
// One silent refresh + retry keeps the user from being bounced to /login
// every 15 minutes while the httpOnly refresh cookie is still good.
export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { accessToken, setAccessToken, clearAuth } = useAuthStore.getState();
  const res = await rawFetch(path, options, accessToken);

  if (res.status === 401 && !options.isRetry && accessToken) {
    try {
      const refreshRes = await rawFetch("/auth/refresh", { method: "POST", signal: options.signal }, null);
      if (!refreshRes.ok) throw new Error("refresh failed");
      const { accessToken: nextToken, user } = (await refreshRes.json()) as { accessToken: string; user?: import("./types").AuthUser };
      options.signal?.throwIfAborted();
      setAccessToken(nextToken);
      if (user) useAuthStore.getState().setUser(user);
      return apiFetch<T>(path, { ...options, isRetry: true });
    } catch (error) {
      if (options.signal?.aborted || (error instanceof Error && error.name === "AbortError")) throw error;
      clearAuth();
      throw new ApiError(401, "Session expired — please log in again");
    }
  }

  if (res.status === 204) return undefined as T;

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new ApiError(res.status, data?.error ?? "Request failed");
  }
  return data as T;
}
