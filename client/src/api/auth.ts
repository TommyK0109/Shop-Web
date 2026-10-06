import type { LoginInput, RegisterInput, ForgotPasswordInput, ResetPasswordInput } from "@storefront/shared";
import { apiFetch } from "./client";
import type { AuthUser } from "./types";

export interface AuthResponse {
  user: AuthUser;
  accessToken: string;
  verificationEmailSent?: boolean;
}

export function registerRequest(input: RegisterInput) {
  return apiFetch<AuthResponse>("/auth/register", { method: "POST", body: input });
}

export function loginRequest(input: LoginInput) {
  return apiFetch<AuthResponse>("/auth/login", { method: "POST", body: input });
}

export function refreshRequest() {
  return apiFetch<AuthResponse>("/auth/refresh", { method: "POST" });
}

export function logoutRequest() {
  return apiFetch<void>("/auth/logout", { method: "POST" });
}

export function forgotPasswordRequest(input: ForgotPasswordInput) {
  return apiFetch<{ message: string }>("/auth/forgot-password", { method: "POST", body: input });
}
export function resetPasswordRequest(input: ResetPasswordInput) {
  return apiFetch<{ message: string }>("/auth/reset-password", { method: "POST", body: input });
}
export function verifyEmailRequest(token: string) {
  return apiFetch<{ message: string; user: AuthUser }>("/auth/verify-email", { method: "POST", body: { token } });
}
export function resendVerificationRequest() {
  return apiFetch<{ message: string }>("/auth/resend-verification", { method: "POST" });
}
export function uploadAvatarRequest(image: File) {
  const body = new FormData();
  body.append("image", image);
  return apiFetch<{ user: AuthUser }>("/auth/avatar", { method: "POST", body });
}
export function removeAvatarRequest() {
  return apiFetch<{ user: AuthUser }>("/auth/avatar", { method: "DELETE" });
}
