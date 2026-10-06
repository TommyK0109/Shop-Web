import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import request from "supertest";
import { env } from "../src/env";
import { signAccessToken } from "../src/lib/jwt";
import { AppError, errorHandler } from "../src/middleware/errorHandler.middleware";

const doubles = vi.hoisted(() => ({ slot: vi.fn(), run: vi.fn(), release: vi.fn(), sessionUser: vi.fn() }));
vi.mock("../src/lib/prisma", () => ({ prisma: { user: { findUnique: doubles.sessionUser } } }));
vi.mock("../src/middleware/ragLimits", () => ({ acquireRagSlot: doubles.slot }));
vi.mock("../src/services/rag/answer", () => ({ runRag: doubles.run }));
import { ragRouter } from "../src/routes/rag.routes";

const app = express();
app.use(express.json());
app.use("/rag", ragRouter);
app.use(errorHandler);
const token = signAccessToken({ sub: "rag-test-user", role: "customer" });
const original = { enabled: env.RAG_ENABLED, generation: env.RAG_GENERATION_ENABLED, timeout: env.RAG_REQUEST_TIMEOUT_MS };

describe("RAG HTTP boundary", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    doubles.sessionUser.mockResolvedValue({ id: "rag-test-user", role: "customer", tokenVersion: 0 });
    env.RAG_ENABLED = true;
    env.RAG_GENERATION_ENABLED = true;
    doubles.release.mockResolvedValue(undefined);
    doubles.slot.mockResolvedValue(doubles.release);
    doubles.run.mockResolvedValue({ status: "search_results" });
  });
  afterEach(() => {
    env.RAG_ENABLED = original.enabled;
    env.RAG_GENERATION_ENABLED = original.generation;
    env.RAG_REQUEST_TIMEOUT_MS = original.timeout;
  });
  it("authenticates before retrieval and rejects invalid selections", async () => {
    expect((await request(app).post("/rag/search").send({ query: "headphones" })).status).toBe(401);
    expect((await request(app).post("/rag/answer").auth(token, { type: "bearer" }).send({ query: "compare", mode: "compare" })).status).toBe(400);
    expect(doubles.slot).not.toHaveBeenCalled();
    expect(doubles.run).not.toHaveBeenCalled();
  });
  it("keeps disabled capabilities free of limiter and provider work", async () => {
    env.RAG_ENABLED = false;
    expect((await request(app).get("/rag/capabilities")).body).toEqual({ enabled: false, generationEnabled: false });
    expect((await request(app).post("/rag/search").auth(token, { type: "bearer" }).send({ query: "headphones" })).status).toBe(503);
    expect(doubles.slot).not.toHaveBeenCalled();
  });
  it("returns a retry hint when shared limits reject a request", async () => {
    doubles.slot.mockRejectedValue(new AppError(429, "Rate limited"));
    const response = await request(app).post("/rag/answer").auth(token, { type: "bearer" }).send({ query: "headphones" });
    expect(response.status).toBe(429);
    expect(response.headers["retry-after"]).toBe("60");
    expect(doubles.run).not.toHaveBeenCalled();
  });
  it("releases the user slot after a controlled provider failure", async () => {
    doubles.run.mockRejectedValue(new AppError(502, "Provider unavailable"));
    expect((await request(app).post("/rag/answer").auth(token, { type: "bearer" }).send({ query: "headphones" })).status).toBe(502);
    expect(doubles.release).toHaveBeenCalledOnce();
  });
  it("aborts provider work at the total request deadline", async () => {
    env.RAG_REQUEST_TIMEOUT_MS = 30;
    let signal: AbortSignal | undefined;
    doubles.run.mockImplementation((_request, _generate, currentSignal) => {
      signal = currentSignal;
      return new Promise((_resolve, reject) => currentSignal.addEventListener("abort", () => reject(new AppError(504, "Timed out")), { once: true }));
    });
    expect((await request(app).post("/rag/answer").auth(token, { type: "bearer" }).send({ query: "headphones" })).status).toBe(504);
    expect(signal?.aborted).toBe(true);
    expect(doubles.release).toHaveBeenCalledOnce();
  });
});
