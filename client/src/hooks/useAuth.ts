import { useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { LoginInput, RegisterInput } from "@storefront/shared";
import { loginRequest, logoutRequest, refreshRequest, registerRequest } from "../api/auth";
import { useAuthStore } from "../store/authStore";

export function useAuthBootstrap() {
  const setAccessToken = useAuthStore((s) => s.setAccessToken);
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const setAuth = useAuthStore((s) => s.setAuth);

  useEffect(() => {
    let cancelled = false;
    refreshRequest()
      .then(({ accessToken, user }) => {
        if (!cancelled && useAuthStore.getState().status === "loading") {
          if (user) setAuth(user, accessToken);
          else setAccessToken(accessToken);
        }
      })
      .catch(() => {
        if (!cancelled && useAuthStore.getState().status === "loading") clearAuth();
      });
    return () => {
      cancelled = true;
    };
  }, [setAccessToken, setAuth, clearAuth]);
}

export function useAuth() {
  const { user, accessToken, status, setAuth, clearAuth } = useAuthStore();
  const queryClient = useQueryClient();

  const login = useMutation({
    mutationFn: (input: LoginInput) => loginRequest(input),
    onSuccess: ({ user, accessToken }) => setAuth(user, accessToken),
  });

  const register = useMutation({
    mutationFn: (input: RegisterInput) => registerRequest(input),
    onSuccess: ({ user, accessToken }) => setAuth(user, accessToken),
  });

  const logout = useMutation({
    mutationFn: () => logoutRequest(),
    onSettled: () => {
      clearAuth();
      queryClient.clear();
    },
  });

  return {
    user,
    accessToken,
    isAuthenticated: status === "authenticated",
    isLoading: status === "loading",
    login,
    register,
    logout,
  };
}
