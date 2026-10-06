import { createClient, type RedisClientType } from "redis";
import { env } from "../env";

let client: RedisClientType | null = null;
let connectPromise: Promise<RedisClientType> | null = null;
let unavailableUntil = 0;
const RETRY_BACKOFF_MS = 10_000;

async function getClient(): Promise<RedisClientType> {
  if (client) return client;
  if (Date.now() < unavailableUntil) {
    throw new Error("Redis marked unavailable, skipping until backoff expires");
  }
  if (!connectPromise) {
    connectPromise = (async () => {
      const c: RedisClientType = createClient({
        url: env.REDIS_URL,
        socket: { connectTimeout: 300, reconnectStrategy: false },
      });
      c.on("error", () => {
        // The 'error' event is required on the client to stop node from
        // crashing on connection loss; failures are surfaced to callers via
        // the rejected promises below instead.
      });
      await c.connect();
      client = c;
      return c;
    })().catch((err) => {
      unavailableUntil = Date.now() + RETRY_BACKOFF_MS;
      connectPromise = null;
      throw err;
    });
  }
  return connectPromise;
}

export async function getOrSetCache<T>(key: string, ttlSeconds: number, fn: () => Promise<T>): Promise<T> {
  if (!env.REDIS_URL) return fn();
  try {
    const redis = await getClient();
    const cached = await redis.get(key);
    if (cached !== null) {
      return JSON.parse(cached) as T;
    }
    const fresh = await fn();
    await redis.set(key, JSON.stringify(fresh), { EX: ttlSeconds });
    return fresh;
  } catch {
    return fn();
  }
}

export async function getCacheVersion(namespace: string): Promise<number> {
  if (!env.REDIS_URL) return 0;
  try {
    const redis = await getClient();
    const value = await redis.get(`cache:version:${namespace}`);
    return value ? Number(value) : 0;
  } catch {
    return 0;
  }
}

export async function bumpCacheVersion(namespace: string): Promise<void> {
  if (!env.REDIS_URL) return;
  try {
    const redis = await getClient();
    await redis.incr(`cache:version:${namespace}`);
  } catch {
    // No cached reads will be served for stale data even if this fails: a
    // dead cache serves nothing, not stale entries.
  }
}
