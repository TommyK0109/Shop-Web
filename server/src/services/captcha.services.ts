import { env } from "../env";
import { AppError } from "../middleware/errorHandler.middleware";

const TEST_SECRET = "1x0000000000000000000000000000000AA";

export async function verifyCaptcha(token: string | undefined, action: string) {
  if (!token || token.length > 2048) throw new AppError(400, "Please complete the security check.");
  const secret = env.TURNSTILE_SECRET_KEY || TEST_SECRET;
  let result: { success?: boolean; action?: string; hostname?: string };
  try {
    const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ secret, response: token }),
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) throw new Error("CAPTCHA provider unavailable");
    result = await response.json() as typeof result;
  } catch {
    throw new AppError(503, "The security check is unavailable. Please try again.");
  }
  const testKey = /^[123]x0/.test(secret) && env.NODE_ENV !== "production";
  const expectedHostname = new URL(env.CLIENT_ORIGIN).hostname;
  if (result.success !== true || (!testKey && (result.action !== action || result.hostname !== expectedHostname))) {
    throw new AppError(400, "The security check expired or failed. Please try again.");
  }
}
