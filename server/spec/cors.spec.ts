import express from "express";
import cors from "cors";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { createCorsOptions } from "../src/lib/cors";

function createApp(nodeEnv: string, clientOrigin = "http://localhost:5173") {
  const app = express();
  app.use(cors(createCorsOptions(clientOrigin, nodeEnv)));
  app.get("/health", (_req, res) => res.json({ status: "ok" }));
  return app;
}

describe("browser access to the API", () => {
  it.each(["http://localhost:5173", "http://localhost:5174", "http://localhost:5175"])(
    "allows the development frontend at %s with credentials",
    async (origin) => {
      const res = await request(createApp("development")).get("/health").set("Origin", origin);
      expect(res.status).toBe(200);
      expect(res.headers["access-control-allow-origin"]).toBe(origin);
      expect(res.headers["access-control-allow-credentials"]).toBe("true");
      expect(res.headers.vary).toContain("Origin");
    },
  );

  it("allows authenticated request preflights on the fallback port", async () => {
    const res = await request(createApp("development"))
      .options("/api/products")
      .set("Origin", "http://localhost:5174")
      .set("Access-Control-Request-Method", "POST")
      .set("Access-Control-Request-Headers", "authorization,content-type");
    expect(res.status).toBe(204);
    expect(res.headers["access-control-allow-origin"]).toBe("http://localhost:5174");
    expect(res.headers["access-control-allow-headers"]).toBe("authorization,content-type");
  });

  it.each([
    "https://example.com",
    "http://localhost.attacker.example:5174",
    "http://127.0.0.1:5174",
    "https://localhost:5174",
    "http://localhost:5174/path",
    "null",
  ])("does not grant browser access to an unconfigured origin %s", async (origin) => {
    const res = await request(createApp("development")).get("/health").set("Origin", origin);
    expect(res.headers["access-control-allow-origin"]).toBeUndefined();
  });

  it.each(["production", "test"])("requires the exact configured origin in %s", async (nodeEnv) => {
    const app = createApp(nodeEnv);
    const allowed = await request(app).get("/health").set("Origin", "http://localhost:5173");
    const denied = await request(app).get("/health").set("Origin", "http://localhost:5174");
    expect(allowed.headers["access-control-allow-origin"]).toBe("http://localhost:5173");
    expect(denied.headers["access-control-allow-origin"]).toBeUndefined();
  });

  it("keeps remote frontend origins exact even in development", async () => {
    const app = createApp("development", "https://storefront.example");
    const allowed = await request(app).get("/health").set("Origin", "https://storefront.example");
    const denied = await request(app).get("/health").set("Origin", "https://storefront.example:5174");
    expect(allowed.headers["access-control-allow-origin"]).toBe("https://storefront.example");
    expect(denied.headers["access-control-allow-origin"]).toBeUndefined();
  });

  it.each(["127.0.0.1", "[::1]"])("supports another port on the configured loopback host %s", async (host) => {
    const origin = `http://${host}:5174`;
    const res = await request(createApp("development", `http://${host}:5173`))
      .get("/health").set("Origin", origin);
    expect(res.headers["access-control-allow-origin"]).toBe(origin);
  });

  it("still serves requests without an Origin header", async () => {
    const res = await request(createApp("development")).get("/health");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok" });
  });
});
