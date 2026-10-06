import { type FormEvent, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { resetPasswordSchema } from "@storefront/shared";
import { resetPasswordRequest } from "../api/auth";
import { ApiError } from "../api/client";
import { useAuthStore } from "../store/authStore";
import { AuthLayout } from "../components/AuthLayout";

export function ResetPasswordPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const token = new URLSearchParams(location.hash.slice(1)).get("token") || "";
  const complete = Boolean((location.state as { resetComplete?: boolean } | null)?.resetComplete);
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [show, setShow] = useState(false);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const mutation = useMutation({ mutationFn: resetPasswordRequest });
  async function submit(event: FormEvent) {
    event.preventDefault();
    mutation.reset(); setFieldError(null);
    if (password !== confirmation) { setFieldError("Your passwords do not match."); return; }
    const parsed = resetPasswordSchema.safeParse({ token, password });
    if (!parsed.success) { setFieldError(parsed.error.issues[0].message); return; }
    try {
      await mutation.mutateAsync(parsed.data);
      useAuthStore.getState().clearAuth();
      queryClient.clear();
      navigate("/reset-password", { replace: true, state: { resetComplete: true } });
    } catch { /* Render the error below. */ }
  }
  const error = fieldError || (mutation.isError ? mutation.error instanceof ApiError ? mutation.error.message : "We could not connect. Please try again." : null);
  return <AuthLayout>
    <span className="eyebrow">A FRESH START</span>
    <h1>{complete ? "Password updated." : "Choose a new password."}</h1>
    {complete ? <div className="auth-result" role="status"><p>Your password has been updated and your previous sessions have been signed out.</p><Link to="/login" className="button button-dark">Sign in with your new password</Link></div>
      : !/^[a-f0-9]{64}$/.test(token) ? <div className="auth-result"><p className="auth-error" role="alert">This reset link is missing or invalid. Request a new link to continue.</p><Link to="/forgot-password" className="button button-dark">Request a new reset link</Link></div>
      : <><p className="auth-description">Use at least 8 characters. Choose a password you haven’t used elsewhere.</p>
        <form className="auth-form" onSubmit={submit}>
          <div><label htmlFor="new-password">New password</label><div className="password-field"><input id="new-password" type={show ? "text" : "password"} className="auth-input" autoComplete="new-password" minLength={8} required value={password} onChange={(event) => setPassword(event.target.value)} /><button type="button" aria-label={show ? "Hide password" : "Show password"} aria-pressed={show} onClick={() => setShow((value) => !value)}>{show ? "Hide" : "Show"}</button></div></div>
          <div><label htmlFor="confirm-password">Confirm new password</label><input id="confirm-password" className="auth-input" type={show ? "text" : "password"} autoComplete="new-password" minLength={8} required value={confirmation} onChange={(event) => setConfirmation(event.target.value)} /></div>
          {error && <p className="auth-error" role="alert">{error}</p>}
          <button className="button button-dark" disabled={mutation.isPending}>{mutation.isPending ? "Updating password…" : "Update password"}</button>
        </form><p className="auth-switch"><Link to="/forgot-password">Request a new reset link</Link></p></>}
  </AuthLayout>;
}
