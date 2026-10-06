import { type FormEvent, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { forgotPasswordSchema } from "@storefront/shared";
import { forgotPasswordRequest } from "../api/auth";
import { ApiError } from "../api/client";
import { AuthLayout } from "../components/AuthLayout";
import { Captcha } from "../components/Captcha";
import { Icon } from "../components/Icon";

export function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [captchaToken, setCaptchaToken] = useState("");
  const [captchaAttempt, setCaptchaAttempt] = useState(0);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const mutation = useMutation({ mutationFn: forgotPasswordRequest });

  async function submit(event: FormEvent) {
    event.preventDefault();
    setFieldError(null);
    mutation.reset();
    if (!captchaToken) { setFieldError("Please complete the security check."); return; }
    const parsed = forgotPasswordSchema.safeParse({ email, captchaToken });
    if (!parsed.success) { setFieldError(parsed.error.issues[0].message); return; }
    try { await mutation.mutateAsync(parsed.data); }
    catch { setCaptchaToken(""); setCaptchaAttempt((value) => value + 1); }
  }
  const error = fieldError || (mutation.isError ? mutation.error instanceof ApiError ? mutation.error.message : "We could not connect. Please try again." : null);

  return <AuthLayout>
    <span className="eyebrow">LET’S GET YOU BACK IN</span>
    <h1>Forgot your password?</h1>
    <p className="auth-description">Enter your account email and we’ll send a link to choose a new password.</p>
    {mutation.isSuccess ? <div className="auth-result" role="status">
      <span className="auth-result-icon"><Icon name="check" width="26" height="26" /></span>
      <h2>Check your inbox.</h2>
      <p>{mutation.data.message}</p>
      <p>Check your spam folder too. Reset links expire after 30 minutes.</p>
      <button type="button" className="text-link" onClick={() => { mutation.reset(); setCaptchaToken(""); setCaptchaAttempt((value) => value + 1); }}>Try another email</button>
    </div> : <form className="auth-form" onSubmit={submit}>
      <div><label htmlFor="recovery-email">Email address</label><input id="recovery-email" className="auth-input" type="email" autoComplete="email" placeholder="you@example.com" value={email} onChange={(event) => setEmail(event.target.value)} required aria-describedby={error ? "recovery-error" : undefined} /></div>
      <Captcha action="forgot_password" onVerify={setCaptchaToken} resetKey={captchaAttempt} />
      {error && <p className="auth-error" id="recovery-error" role="alert">{error}</p>}
      <button className="button button-dark" disabled={mutation.isPending || !captchaToken}>{mutation.isPending ? "Sending reset link…" : "Send reset link"}<Icon name="arrow" width="17" height="17" /></button>
    </form>}
    <p className="auth-switch"><Link to="/login">Back to sign in</Link></p>
  </AuthLayout>;
}
