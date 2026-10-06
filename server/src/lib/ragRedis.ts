import { createClient } from "redis";
import { env } from "../env";
import { AppError } from "../middleware/errorHandler.middleware";

let client: ReturnType<typeof createClient> | undefined;
let connecting: Promise<void> | undefined;

export async function getRagRedis() {
  if (!env.REDIS_URL) throw new AppError(503, "The optional assistant requires its Redis configuration.");
  if (!client) {
    client = createClient({ url: env.REDIS_URL, disableOfflineQueue: true, socket: { connectTimeout: 1000, reconnectStrategy: false } });
    client.on("error", () => { /* commands propagate sanitized errors */ });
  }
  try {
    if (!client.isReady) {
      connecting ??= client.connect().then(() => undefined).finally(() => { connecting = undefined; });
      await connecting;
    }
    return client;
  } catch { throw new AppError(503, "Assistant limits are unavailable. Please try again later."); }
}

export async function closeRagRedis() {
  if (client?.isOpen) await client.disconnect();
  client = undefined;
}
