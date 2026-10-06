import { type FormEvent, useState } from "react";
import {
  Link,
  type Location,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { loginSchema } from "@storefront/shared";
import { useAuth } from "../hooks/useAuth";
import { ApiError } from "../api/client";
import { AuthLayout } from "../components/AuthLayout";
import { Icon } from "../components/Icon";
import { Captcha } from "../components/Captcha";

export function LoginPage() {
  const { login } = useAuth();
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
    login.reset();
    if (!captchaToken) { setFieldError("Please complete the security check."); return; }
    const result = loginSchema.safeParse({ email: email.trim(), password, captchaToken });
    if (!result.success) {
      setFieldError(result.error.issues[0].message);
      return;
    }
    try {
      await login.mutateAsync(result.data);
      navigate(from, { replace: true });
    } catch {
      // The mutation error is rendered below.
      setCaptchaToken("");
      setCaptchaAttempt((value) => value + 1);
    }
  }

  const serverError = login.isError
    ? login.error instanceof ApiError
      ? login.error.message
      : "We couldn’t connect. Please try signing in again."
    : null;
  const error = fieldError ?? serverError;

  return (
    <AuthLayout>
      <span className="eyebrow">GOOD TO SEE YOU AGAIN</span>
      <h1>Welcome back.</h1>
      <p className="auth-description">Sign in to pick up where you left off.</p>
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
          <label htmlFor="password">Password</label>
          <div className="password-field">
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              autoComplete="current-password"
              placeholder="Enter your password"
              className="auth-input"
              aria-describedby={error ? "auth-error" : undefined}
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
        </div>
        <Link to="/forgot-password" className="auth-recovery-link">Forgot your password?</Link>
        <Captcha action="login" onVerify={setCaptchaToken} resetKey={captchaAttempt} />
        {error && (
          <p id="auth-error" role="alert" className="auth-error">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={login.isPending || !captchaToken}
          className="button button-dark"
        >
          {login.isPending ? "Signing in…" : "Sign in"}
          <Icon name="arrow" width="17" height="17" />
        </button>
      </form>
      <p className="auth-switch">
        New to the neighborhood?{" "}
        <Link to="/register" state={location.state}>
          Create an account
        </Link>
      </p>
    </AuthLayout>
  );
}
