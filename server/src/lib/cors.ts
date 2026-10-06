import type { CorsOptions } from "cors";

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

export function createCorsOptions(clientOrigin: string, nodeEnv: string): CorsOptions {
  return {
    credentials: true,
    origin(origin, callback) {
      if (!origin || origin === clientOrigin) {
        callback(null, true);
        return;
      }

      let allowed = false;
      if (nodeEnv === "development") {
        try {
          const configured = new URL(clientOrigin);
          const requested = new URL(origin);
          // Vite chooses another port when its default is occupied. Allow
          // that only for the configured loopback host in development.
          allowed = LOOPBACK_HOSTS.has(configured.hostname)
            && requested.hostname === configured.hostname
            && requested.protocol === configured.protocol
            && requested.origin === origin;
        } catch {
          // Invalid origins receive no CORS permission.
        }
      }
      callback(null, allowed);
    },
  };
}
