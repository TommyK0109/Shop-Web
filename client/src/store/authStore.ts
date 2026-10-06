import { create } from "zustand";
import type { AuthUser } from "../api/types";

const CACHED_USER_KEY = "storefront:user";

// The access token only ever lives in memory (never persisted) — it's a
// bearer credential and this store is the one source of truth for it. The
// user profile is cached in localStorage purely so the UI has something to
// render instantly on reload; auth/authStore#bootstrap always re-validates
// the actual session against the server's httpOnly refresh cookie before
// trusting it.
function readCachedUser(): AuthUser | null {
  try {
    const raw = localStorage.getItem(CACHED_USER_KEY);
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  } catch {
    return null;
  }
}

interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  status: "loading" | "authenticated" | "unauthenticated";
  setAccessToken: (token: string) => void;
  setAuth: (user: AuthUser, accessToken: string) => void;
  setUser: (user: AuthUser) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: readCachedUser(),
  accessToken: null,
  status: "loading",

  setAccessToken: (accessToken) => set({ accessToken, status: "authenticated" }),

  setUser: (user) => {
    localStorage.setItem(CACHED_USER_KEY, JSON.stringify(user));
    set({ user });
  },

  setAuth: (user, accessToken) => {
    localStorage.setItem(CACHED_USER_KEY, JSON.stringify(user));
    set({ user, accessToken, status: "authenticated" });
  },

  clearAuth: () => {
    localStorage.removeItem(CACHED_USER_KEY);
    set({ user: null, accessToken: null, status: "unauthenticated" });
  },
}));
