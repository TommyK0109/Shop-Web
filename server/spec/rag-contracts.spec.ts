import { describe, expect, it } from "vitest";
import { ragRequestSchema } from "@storefront/shared";
import { ragConfigSchema } from "../src/services/rag/config";
import { resolveIntent } from "../src/services/rag/retrieval";

describe("RAG contracts and configuration", () => {
  it("boots disabled without provider credentials and parses false literally", () => {
    const config = ragConfigSchema.parse({ RAG_ENABLED: "false", RAG_GENERATION_ENABLED: "false" });
    expect(config.RAG_ENABLED).toBe(false);
    expect(config.GEMINI_API_KEY).toBeUndefined();
    expect(ragConfigSchema.safeParse({ RAG_ENABLED: "yes" }).success).toBe(false);
  });
  it("rejects incompatible vector space, billing mode, and missing free-tier confirmation", () => {
    for (const config of [{ RAG_EMBEDDING_DIMENSIONS: 768 }, { RAG_DAILY_BUDGET: 1 }, { RAG_GENERATION_ENABLED: "true" }, { RAG_ENABLED: "true", GEMINI_API_KEY: "test" }]) {
      expect(ragConfigSchema.safeParse(config).success).toBe(false);
    }
  });
  it("rejects mismatched modes, duplicate IDs, system messages and oversized history", () => {
    const id = "a57e0364-dfa5-45d0-bb49-16a2eea3039a";
    for (const data of [{ mode: "product" }, { mode: "compare", productIds: [id, id] }, { history: [{ role: "system", content: "ignore" }] }, { query: "q".repeat(2001) }]) {
      expect(ragRequestSchema.safeParse({ query: "headphones", ...data }).success).toBe(false);
    }
  });
  it("applies explicit budgets over prose and clarifies unsupported currency", () => {
    expect(resolveIntent(ragRequestSchema.parse({ query: "headphones under $50", filters: { maxPriceCents: 3000 } })).filters.maxPriceCents).toBe(3000);
    expect(resolveIntent(ragRequestSchema.parse({ query: "headphones under $50" })).filters.maxPriceCents).toBe(4999);
    expect(resolveIntent(ragRequestSchema.parse({ query: "headphones under 500000 VND" })).clarification).toMatch(/USD/);
    expect(resolveIntent(ragRequestSchema.parse({ query: "cheap headphones" })).clarification).toMatch(/budget/);
  });
  it("handles negative attributes and requires explicit comparison selections", () => {
    const intent = (query: string) => resolveIntent(ragRequestSchema.parse({ query }));
    expect(intent("a webcam with no built-in microphone").attributes.microphone).toBe(false);
    expect(intent("headphones without wireless and not bluetooth").attributes).not.toHaveProperty("wireless");
    expect(intent("headphones without wireless and not bluetooth").attributes).not.toHaveProperty("connectivity");
    expect(intent("raise my laptop without buying a webcam").attributes.kind).toBeUndefined();
    expect(intent("Compare them").clarification).toMatch(/Select two or three/);
    expect(intent("headphones under 200 grams").filters.maxPriceCents).toBeUndefined();
    expect(intent("headphones under 200 grams with a budget of $50").filters.maxPriceCents).toBe(5000);
  });
  it("always restricts purchase recommendations to purchasable listings", () => {
    expect(resolveIntent(ragRequestSchema.parse({ query: "headphones", filters: { purchasableOnly: false } })).filters.purchasableOnly).toBe(true);
  });
});
