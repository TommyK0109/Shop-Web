import { randomUUID } from "node:crypto";
import { env } from "../env";
import { getRagRedis } from "../lib/ragRedis";
import { AppError } from "./errorHandler.middleware";

const acquire = `
local now = redis.call('TIME')
local ms = now[1] * 1000 + math.floor(now[2] / 1000)
redis.call('ZREMRANGEBYSCORE', KEYS[1], '-inf', ms)
if redis.call('ZCARD', KEYS[1]) >= tonumber(ARGV[3]) then return 0 end
if KEYS[2] ~= KEYS[1] then
  local count = tonumber(redis.call('GET', KEYS[2]) or '0')
  if count >= tonumber(ARGV[4]) then return -1 end
  redis.call('INCR', KEYS[2])
  if count == 0 then redis.call('PEXPIRE', KEYS[2], 60000) end
end
redis.call('ZADD', KEYS[1], ms + tonumber(ARGV[2]), ARGV[1])
redis.call('PEXPIRE', KEYS[1], tonumber(ARGV[2]) + 1000)
return 1`;

export async function acquireRagSlot(userId?: string): Promise<() => Promise<void>> {
  const token = randomUUID();
  const key = userId ? `rag:user:${userId}:active` : "rag:provider:active";
  const rateKey = userId ? `rag:user:${userId}:minute` : key;
  const leaseMs = (userId ? env.RAG_REQUEST_TIMEOUT_MS : env.RAG_PROVIDER_TIMEOUT_MS) + 5000;
  try {
    const redis = await getRagRedis();
    const result = Number(await redis.eval(acquire, {
      keys: [key, rateKey],
      arguments: [token, String(leaseMs), String(userId ? 1 : env.RAG_PROVIDER_CONCURRENCY), String(env.RAG_USER_REQUESTS_PER_MINUTE)],
    }));
    if (result !== 1) throw new AppError(userId ? 429 : 503, userId ? "Assistant request limit reached. Try again in a minute." : "Assistant is busy. Please try again shortly.");
    return async () => { try { await redis.zRem(key, token); } catch { /* lease recovers after a crash/outage */ } };
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(503, "Assistant limits are unavailable. Please try again later.");
  }
}
