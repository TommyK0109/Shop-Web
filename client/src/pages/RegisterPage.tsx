import { type FormEvent, useState } from "react";
import {
  Link,
  type Location,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { registerSchema } from "@storefront/shared";
import { useAuth } from "../hooks/useAuth";
import { ApiError } from "../api/client";
import { AuthLayout } from "../components/AuthLayout";
import { Icon } from "../components/Icon";
import { Captcha } from "../components/Captcha";

export function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const previous = (location.state as { from?: Location } | null)?.from;
  const from = previous
    ? `${previous.pathname}${previous.search ?? ""}${previous.hash ?? ""}`
    : "/";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [captchaToken, setCaptchaToken] = useState("");
  const [captchaAttempt, setCaptchaAttempt] = useState(0);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setFieldError(null);
    register.reset();
    if (!captchaToken) { setFieldError("Please complete the security check."); return; }
    const result = registerSchema.safeParse({ email: email.trim(), password, captchaToken });
    if (!result.success) {
      setFieldError(result.error.issues[0].message);
      return;
    }
    try {
      const response = await register.mutateAsync(result.data);
      navigate(from, { replace: true, state: { signupNotice: response.verificationEmailSent
        ? "Welcome! Check your inbox to verify your email address."
        : "Your account is ready. A verification email could not be sent. You can try again from your profile." } });
    } catch {
      // The mutation error is rendered below.
      setCaptchaToken("");
      setCaptchaAttempt((value) => value + 1);
    }
  }

  const serverError = register.isError
    ? register.error instanceof ApiError
      ? register.error.message
      : "We couldn’t connect. Please try creating your account again."
    : null;
  const error = fieldError ?? serverError;

  return (
    <AuthLayout>
      <span className="eyebrow">A LITTLE MORE YOU</span>
      <h1>Join the neighborhood.</h1>
      <p className="auth-description">
        Your next favorite thing is waiting. Make yourself at home.
      </p>
      <form onSubmit={handleSubmit} className="auth-form">
        <div>
          <label htmlFor="email">Email address</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            autoComplete="email"
            placeholder="you@example.com"
            className="auth-input"
            aria-describedby={error ? "auth-error" : undefined}
          />
        </div>
        <div>
          <label htmlFor="password">Create a password</label>
          <div className="password-field">
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              minLength={8}
              autoComplete="new-password"
              placeholder="At least 8 characters"
              className="auth-input"
              aria-describedby={
                error ? "password-hint auth-error" : "password-hint"
              }
            />
            <button
              type="button"
              aria-label={showPassword ? "Hide password" : "Show password"}
              aria-pressed={showPassword}
              onClick={() => setShowPassword((shown) => !shown)}
            >
              {showPassword ? "Hide" : "Show"}
            </button>
          </div>
          <p id="password-hint" className="auth-hint">
            Use at least 8 characters to keep your account safe.
          </p>
        </div>
        <Captcha action="register" onVerify={setCaptchaToken} resetKey={captchaAttempt} />
        {error && (
          <p id="auth-error" role="alert" className="auth-error">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={register.isPending || !captchaToken}
          className="button button-dark"
        >
          {register.isPending ? "Creating your account…" : "Create account"}
          <Icon name="arrow" width="17" height="17" />
        </button>
      </form>
      <p className="auth-switch">
        Already part of the neighborhood?{" "}
        <Link to="/login" state={location.state}>
          Sign in
        </Link>
      </p>
    </AuthLayout>
  );
}
