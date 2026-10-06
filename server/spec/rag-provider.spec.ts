import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { env } from "../src/env";

const doubles = vi.hoisted(() => ({ reserve: vi.fn(), usage: vi.fn(), slot: vi.fn(), release: vi.fn(), fetch: vi.fn() }));
vi.mock("../src/lib/prisma", () => ({ prisma: { $queryRaw: doubles.reserve, $executeRaw: doubles.usage } }));
vi.mock("../src/middleware/ragLimits", () => ({ acquireRagSlot: doubles.slot }));
import { getAnswerProvider, getEmbeddingProvider } from "../src/services/rag/providers";

const original = { enabled: env.RAG_ENABLED, confirmed: env.RAG_GEMINI_FREE_TIER_CONFIRMED, key: env.GEMINI_API_KEY };
describe("Gemini adapter contract and free-tier failures", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    env.RAG_ENABLED = true;
    env.RAG_GEMINI_FREE_TIER_CONFIRMED = true;
    env.GEMINI_API_KEY = "test-key";
    doubles.reserve.mockResolvedValue([{ day: "2026-10-01" }]);
    doubles.slot.mockResolvedValue(doubles.release);
    doubles.release.mockResolvedValue(undefined);
    doubles.usage.mockResolvedValue(1);
    vi.stubGlobal("fetch", doubles.fetch);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    env.RAG_ENABLED = original.enabled;
    env.RAG_GEMINI_FREE_TIER_CONFIRMED = original.confirmed;
    env.GEMINI_API_KEY = original.key;
  });
  it("uses one 1536-dimensional embedding per input and separates document/query roles", async () => {
    const vector = [1, ...Array(1535).fill(0)];
    doubles.fetch.mockImplementation(async () => new Response(JSON.stringify({ embedding: { values: vector } }), { status: 200 }));
    expect(await getEmbeddingProvider().embed(["document"])).toEqual([vector]);
    await getEmbeddingProvider().embed(["meeting headset"], undefined, "query");
    const [url, options] = doubles.fetch.mock.calls[0];
    expect(url).toMatch(/models\/gemini-embedding-2:embedContent$/);
    expect(JSON.parse(options.body)).toMatchObject({ output_dimensionality: 1536, content: { parts: [{ text: "title: none | text: document" }] } });
    expect(JSON.parse(doubles.fetch.mock.calls[1][1].body).content.parts[0].text).toBe("task: search result | query: meeting headset");
    expect(doubles.reserve).toHaveBeenCalledTimes(2);
  });
  it("stops before HTTP when the durable daily allowance is exhausted", async () => {
    doubles.reserve.mockResolvedValue([]);
    await expect(getEmbeddingProvider().embed(["document"])).rejects.toMatchObject({ statusCode: 503 });
    expect(doubles.fetch).not.toHaveBeenCalled();
    expect(doubles.release).toHaveBeenCalledOnce();
  });
  it("does not retry quota failures or expose provider payloads", async () => {
    doubles.fetch.mockResolvedValue(new Response("private provider payload", { status: 429 }));
    await expect(getEmbeddingProvider().embed(["document"])).rejects.toMatchObject({ statusCode: 503, message: expect.not.stringContaining("private") });
    expect(doubles.fetch).toHaveBeenCalledOnce();
    expect(doubles.release).toHaveBeenCalledOnce();
  });
  it("rejects malformed embedding dimensions", async () => {
    doubles.fetch.mockResolvedValue(new Response(JSON.stringify({ embedding: { values: [1, 2] } }), { status: 200 }));
    await expect(getEmbeddingProvider().embed(["document"])).rejects.toMatchObject({ statusCode: 502 });
  });
  it("requests structured answers and records reported token usage", async () => {
    doubles.fetch.mockResolvedValue(new Response(JSON.stringify({ candidates: [{ finishReason: "STOP", content: { parts: [{ text: '{"status":"answered"}' }] } }], usageMetadata: { promptTokenCount: 12, candidatesTokenCount: 5 } }), { status: 200 }));
    expect(await getAnswerProvider().generate({ query: "headphones", mode: "recommend", history: [], evidence: [] })).toEqual({ status: "answered" });
    expect(doubles.fetch.mock.calls[0][0]).toMatch(/models\/gemini-3\.1-flash-lite:generateContent$/);
    expect(JSON.parse(doubles.fetch.mock.calls[0][1].body).generationConfig.responseMimeType).toBe("application/json");
    expect(doubles.usage).toHaveBeenCalledOnce();
  });
});
