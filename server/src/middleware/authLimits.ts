import type { RequestHandler } from "express";
import { AppError } from "./errorHandler.middleware";

// Bound memory and expire buckets without a background timer. Run behind a
// trusted proxy only when TRUST_PROXY_HOPS matches your actual deployment.
export function authLimit(max: number, key: (req: Parameters<RequestHandler>[0]) => string, windowMs = 15 * 60_000): RequestHandler {
  const buckets = new Map<string, { count: number; expiresAt: number }>();
  return (req, res, next) => {
    const now = Date.now();
    for (const [id, bucket] of buckets) if (bucket.expiresAt <= now) buckets.delete(id);
    const id = key(req);
    let bucket = buckets.get(id);
    if (!bucket) {
      if (buckets.size >= 10000) return next(new AppError(429, "Too many requests. Please try again later."));
      bucket = { count: 0, expiresAt: now + windowMs };
      buckets.set(id, bucket);
    }
    bucket.count++;
    if (bucket.count > max) {
      res.setHeader("Retry-After", Math.ceil((bucket.expiresAt - now) / 1000));
      return next(new AppError(429, "Too many requests. Please try again later."));
    }
    next();
  };
}
