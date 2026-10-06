import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes } from "react-router-dom";
import { ForgotPasswordPage } from "./ForgotPasswordPage";
import { ResetPasswordPage } from "./ResetPasswordPage";
import { VerifyEmailPage } from "./VerifyEmailPage";
import { ProfilePhotoUpload } from "../components/ProfilePhotoUpload";
import { useAuthStore } from "../store/authStore";
import { renderWithProviders } from "../spec/utils";
import { ApiError } from "../api/client";
import * as authApi from "../api/auth";

vi.mock("../api/auth");
vi.mock("../components/Captcha", () => ({ Captcha: ({ onVerify }: { onVerify: (token: string) => void }) => <button type="button" onClick={() => onVerify("test-captcha")}>Complete security check</button> }));
const customer = { id: "customer-1", email: "jane@example.com", role: "customer" as const, avatarUrl: null, emailVerifiedAt: null };
const token = "a".repeat(64);
function Harness() {
  return <Routes>
    <Route path="/forgot-password" element={<ForgotPasswordPage />} />
    <Route path="/reset-password" element={<ResetPasswordPage />} />
    <Route path="/verify-email" element={<VerifyEmailPage />} />
  </Routes>;
}
function Profile() {
  const user = useAuthStore((state) => state.user);
  return user ? <ProfilePhotoUpload user={user} /> : null;
}
beforeEach(() => {
  vi.resetAllMocks(); useAuthStore.getState().clearAuth();
  Object.defineProperty(URL, "createObjectURL", { configurable: true, writable: true, value: vi.fn(() => "blob:preview") });
  Object.defineProperty(URL, "revokeObjectURL", { configurable: true, writable: true, value: vi.fn() });
});
afterEach(() => useAuthStore.getState().clearAuth());

describe("account email flows", () => {
  it("requires CAPTCHA before requesting a reset and shows the generic success notice", async () => {
    vi.mocked(authApi.forgotPasswordRequest).mockResolvedValue({ message: "If an account exists for this email, you will receive a password reset link shortly." });
    const user = userEvent.setup(); renderWithProviders(<Harness />, { route: "/forgot-password" });
    const submit = screen.getByRole("button", { name: "Send reset link" });
    expect(submit).toBeDisabled();
    await user.type(screen.getByLabelText("Email address"), "JANE@example.com");
    await user.click(screen.getByRole("button", { name: "Complete security check" }));
    await user.click(submit);
    expect(await screen.findByText("Check your inbox.")).toBeInTheDocument();
    expect(vi.mocked(authApi.forgotPasswordRequest).mock.calls[0][0]).toEqual({ email: "jane@example.com", captchaToken: "test-captcha" });
    expect(screen.getByRole("status")).toHaveTextContent("30 minutes");
  });
  it("reports unavailable email delivery and requires a new security check for retry", async () => {
    vi.mocked(authApi.forgotPasswordRequest).mockRejectedValue(new ApiError(503, "Password reset emails are unavailable. Please contact support."));
    const user = userEvent.setup(); renderWithProviders(<Harness />, { route: "/forgot-password" });
    await user.type(screen.getByLabelText("Email address"), customer.email);
    await user.click(screen.getByRole("button", { name: "Complete security check" }));
    await user.click(screen.getByRole("button", { name: "Send reset link" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("unavailable");
    expect(screen.getByRole("button", { name: "Send reset link" })).toBeDisabled();
    expect(screen.getByLabelText("Email address")).toHaveValue(customer.email);
  });
  it("prevents password mismatch and clears the session only after a successful reset", async () => {
    useAuthStore.getState().setAuth(customer, "old-token");
    vi.mocked(authApi.resetPasswordRequest).mockResolvedValue({ message: "Updated" });
    const user = userEvent.setup(); renderWithProviders(<Harness />, { route: `/reset-password#token=${token}` });
    await user.type(screen.getByLabelText("New password", { exact: true }), "Replacement123!");
    await user.type(screen.getByLabelText("Confirm new password"), "Mismatch123!");
    await user.click(screen.getByRole("button", { name: "Update password" }));
    expect(screen.getByRole("alert")).toHaveTextContent("do not match");
    expect(authApi.resetPasswordRequest).not.toHaveBeenCalled();
    expect(useAuthStore.getState().accessToken).toBe("old-token");
    await user.clear(screen.getByLabelText("Confirm new password"));
    await user.type(screen.getByLabelText("Confirm new password"), "Replacement123!");
    await user.click(screen.getByRole("button", { name: "Update password" }));
    expect(await screen.findByRole("heading", { name: "Password updated." })).toBeInTheDocument();
    expect(vi.mocked(authApi.resetPasswordRequest).mock.calls[0][0]).toEqual({ token, password: "Replacement123!" });
    expect(useAuthStore.getState().status).toBe("unauthenticated");
  });
  it("shows a recovery action for a missing reset token", () => {
    renderWithProviders(<Harness />, { route: "/reset-password" });
    expect(screen.getByRole("alert")).toHaveTextContent("missing or invalid");
    expect(screen.getByRole("link", { name: "Request a new reset link" })).toHaveAttribute("href", "/forgot-password");
    expect(authApi.resetPasswordRequest).not.toHaveBeenCalled();
  });
  it("waits for confirmation before consuming an email link and updates a matching profile", async () => {
    useAuthStore.getState().setAuth(customer, "access");
    vi.mocked(authApi.verifyEmailRequest).mockResolvedValue({ message: "Verified", user: { ...customer, emailVerifiedAt: "2026-10-03T00:00:00Z" } });
    const user = userEvent.setup(); renderWithProviders(<Harness />, { route: `/verify-email#token=${token}` });
    expect(authApi.verifyEmailRequest).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Verify email address" }));
    expect(await screen.findByRole("heading", { name: "Email verified." })).toBeInTheDocument();
    expect(useAuthStore.getState().user?.emailVerifiedAt).toBeTruthy();
    expect(useAuthStore.getState().accessToken).toBe("access");
  });
  it("does not switch accounts when a verification link belongs to someone else", async () => {
    useAuthStore.getState().setAuth(customer, "access");
    vi.mocked(authApi.verifyEmailRequest).mockResolvedValue({ message: "Verified", user: { ...customer, id: "other-user", email: "other@example.com", emailVerifiedAt: "2026-10-03T00:00:00Z" } });
    const user = userEvent.setup(); renderWithProviders(<Harness />, { route: `/verify-email#token=${token}` });
    await user.click(screen.getByRole("button", { name: "Verify email address" }));
    await screen.findByRole("heading", { name: "Email verified." });
    expect(useAuthStore.getState().user).toEqual(customer);
  });
});

describe("profile photo controls", () => {
  it("previews, saves, persists, and removes a photo", async () => {
    useAuthStore.getState().setAuth(customer, "access");
    vi.mocked(authApi.uploadAvatarRequest).mockResolvedValue({ user: { ...customer, avatarUrl: "https://images.example.com/avatar.webp" } });
    vi.mocked(authApi.removeAvatarRequest).mockResolvedValue({ user: customer });
    const user = userEvent.setup(); renderWithProviders(<Profile />);
    const file = new File(["image"], "photo.png", { type: "image/png" });
    await user.upload(screen.getByLabelText("Choose profile image"), file);
    expect(screen.getByAltText("New profile photo preview")).toHaveAttribute("src", "blob:preview");
    await user.click(screen.getByRole("button", { name: "Save photo" }));
    expect(await screen.findByRole("status")).toHaveTextContent("updated");
    expect(vi.mocked(authApi.uploadAvatarRequest).mock.calls[0][0]).toBe(file);
    expect(useAuthStore.getState().user?.avatarUrl).toBe("https://images.example.com/avatar.webp");
    expect(JSON.parse(localStorage.getItem("storefront:user")!).avatarUrl).toBe("https://images.example.com/avatar.webp");
    await waitFor(() => expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:preview"));
    await user.click(screen.getByRole("button", { name: "Remove photo" }));
    expect(await screen.findByRole("status")).toHaveTextContent("removed");
    expect(useAuthStore.getState().user?.avatarUrl).toBeNull();
  });
  it("rejects oversized/unsupported files without starting an upload", async () => {
    useAuthStore.getState().setAuth(customer, "access");
    const user = userEvent.setup({ applyAccept: false }); renderWithProviders(<Profile />);
    const input = screen.getByLabelText("Choose profile image");
    await user.upload(input, new File(["<svg/>"], "image.svg", { type: "image/svg+xml" }));
    expect(screen.getByRole("alert")).toHaveTextContent("JPEG, PNG, or WebP");
    await user.upload(input, new File([new Uint8Array(5 * 1024 * 1024 + 1)], "large.png", { type: "image/png" }));
    expect(screen.getByRole("alert")).toHaveTextContent("5 MB");
    expect(authApi.uploadAvatarRequest).not.toHaveBeenCalled();
  });
  it("preserves the saved avatar when uploading fails", async () => {
    const saved = "https://images.example.com/saved.webp";
    useAuthStore.getState().setAuth({ ...customer, avatarUrl: saved }, "access");
    vi.mocked(authApi.uploadAvatarRequest).mockRejectedValue(new ApiError(502, "Your photo could not be uploaded. Please try again."));
    const user = userEvent.setup(); renderWithProviders(<Profile />);
    await user.upload(screen.getByLabelText("Choose profile image"), new File(["image"], "photo.png", { type: "image/png" }));
    await user.click(screen.getByRole("button", { name: "Save photo" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("could not be uploaded");
    expect(useAuthStore.getState().user?.avatarUrl).toBe(saved);
    expect(screen.getByRole("button", { name: "Save photo" })).toBeEnabled();
  });
});
