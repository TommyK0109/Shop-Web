import { Link, useLocation, useNavigate } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { verifyEmailRequest } from "../api/auth";
import { ApiError } from "../api/client";
import { useAuthStore } from "../store/authStore";
import { AuthLayout } from "../components/AuthLayout";

export function VerifyEmailPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const token = new URLSearchParams(location.hash.slice(1)).get("token") || "";
  const complete = Boolean((location.state as { verificationComplete?: boolean } | null)?.verificationComplete);
  const mutation = useMutation({ mutationFn: verifyEmailRequest, onSuccess: ({ user: verified }) => {
    const current = useAuthStore.getState();
    if (current.status === "authenticated" && current.user?.id === verified.id) current.setUser(verified);
    navigate("/verify-email", { replace: true, state: { verificationComplete: true } });
  } });
  const valid = /^[a-f0-9]{64}$/.test(token);
  return <AuthLayout>
    <span className="eyebrow">MAKE YOURSELF AT HOME</span>
    <h1>{complete ? "Email verified." : "Verify your email."}</h1>
    <div className="auth-result">
      {complete ? <p role="status">Your email address is confirmed. You’re all set.</p> : <>
        <p>{valid ? "Confirm your email address to finish setting up your Storefront profile." : "This verification link is missing or invalid. You can request a new email from your profile."}</p>
        {valid && <button type="button" className="button button-dark" disabled={mutation.isPending} onClick={() => mutation.mutate(token)}>{mutation.isPending ? "Verifying…" : "Verify email address"}</button>}
        {mutation.isError && <p role="alert" className="auth-error">{mutation.error instanceof ApiError ? mutation.error.message : "We could not connect. Please try again."}</p>}
      </>}
    </div>
    <p className="auth-switch"><Link to={user ? "/account" : "/login"}>{user ? "Go to your profile" : "Back to sign in"}</Link></p>
  </AuthLayout>;
}
