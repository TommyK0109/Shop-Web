import { useEffect, useRef, useState } from "react";

interface Turnstile {
  render: (element: HTMLElement, options: Record<string, unknown>) => string;
  remove: (id: string) => void;
}
declare global { interface Window { turnstile?: Turnstile } }

let loading: Promise<void> | undefined;
function loadTurnstile() {
  if (window.turnstile) return Promise.resolve();
  if (!loading) {
    loading = new Promise<void>((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      script.async = true;
      const timeout = window.setTimeout(() => fail(), 15000);
      function fail() {
        window.clearTimeout(timeout);
        script.remove();
        loading = undefined;
        reject(new Error("Security check could not load"));
      }
      script.onload = () => { window.clearTimeout(timeout); resolve(); };
      script.onerror = fail;
      document.head.append(script);
    });
  }
  return loading;
}

export function Captcha({ action, onVerify, resetKey = 0 }: {
  action: "login" | "register" | "forgot_password";
  onVerify: (token: string) => void;
  resetKey?: number;
}) {
  const container = useRef<HTMLDivElement>(null);
  const callback = useRef(onVerify);
  callback.current = onVerify;
  const [retry, setRetry] = useState(0);
  const [status, setStatus] = useState<"loading" | "ready" | "verified" | "error">("loading");
  const [compact, setCompact] = useState(false);
  const sitekey = import.meta.env.VITE_TURNSTILE_SITE_KEY || (import.meta.env.DEV ? "1x00000000000000000000AA" : "");
  const invalidKey = !sitekey || (import.meta.env.PROD && /^[123]x0/.test(sitekey));

  useEffect(() => {
    const element = container.current;
    if (!element || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => setCompact(entry.contentRect.width < 300));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let cancelled = false;
    let widgetId: string | undefined;
    callback.current("");
    setStatus("loading");
    if (invalidKey) { setStatus("error"); return; }
    loadTurnstile().then(() => {
      if (cancelled || !container.current) return;
      if (!window.turnstile) throw new Error("Security check unavailable");
      widgetId = window.turnstile.render(container.current, {
        sitekey, action, theme: "light", size: compact || container.current.clientWidth < 300 ? "compact" : "flexible",
        callback: (token: string) => { if (!cancelled) { callback.current(token); setStatus("verified"); } },
        "expired-callback": () => { if (!cancelled) { callback.current(""); setStatus("ready"); } },
        "error-callback": () => { if (!cancelled) { callback.current(""); setStatus("error"); } },
        "timeout-callback": () => { if (!cancelled) { callback.current(""); setStatus("error"); } },
      });
      setStatus((current) => current === "loading" ? "ready" : current);
    }).catch(() => { if (!cancelled) setStatus("error"); });
    return () => { cancelled = true; if (widgetId !== undefined) window.turnstile?.remove(widgetId); };
  }, [action, resetKey, retry, sitekey, invalidKey, compact]);

  return (
    <div className="captcha-field">
      <span className="captcha-label">Security check</span>
      <div ref={container} />
      <p className="auth-hint" role="status">
        {status === "loading" ? "Loading security check…" : status === "verified" ? "Security check complete." : status === "error" ? "The security check could not load. Please try again." : "Complete the check to continue."}
      </p>
      {status === "error" && <button type="button" className="text-link" onClick={() => setRetry((value) => value + 1)}>Retry security check</button>}
    </div>
  );
}
