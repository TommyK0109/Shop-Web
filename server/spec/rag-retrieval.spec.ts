import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ragRequestSchema, type RagRequest } from "@storefront/shared";
import { prisma } from "../src/lib/prisma";
import { env } from "../src/env";
import { createApprovedSeller, createCategory, createProductForSeller, cleanupSeller, cleanupCategory } from "./fixtures";
import { hybridCandidates, hydrateProducts } from "../src/repositories/rag.repository";
import { resolveIntent, retrieveProducts } from "../src/services/rag/retrieval";
import { runRag } from "../src/services/rag/answer";
import type { AnswerProvider, EmbeddingProvider } from "../src/services/rag/providers";
import { closeRagRedis } from "../src/lib/ragRedis";

const vector = (first = 1, second = 0) => [first, second, ...Array(1534).fill(0)] as number[];
const embeddings: EmbeddingProvider = { embed: async () => [vector()] };
const grounded: AnswerProvider = { generate: async ({ evidence }) => ({ status: "answered", intro: "", comparison: [], followUpQuestion: null,
  recommendations: evidence.map((source) => ({ productId: source.productId, reasons: [{ text: source.facts[0], sourceIds: [source.sourceId] }], unknowns: source.unknowns })) }) };

describe("RAG real vector retrieval and grounded answers", () => {
  let owner: Awaited<ReturnType<typeof createApprovedSeller>>;
  let category: Awaited<ReturnType<typeof createCategory>>;
  let products: Awaited<ReturnType<typeof createProductForSeller>>[];
  const originalEnabled = env.RAG_ENABLED;
  const originalGeneration = env.RAG_GENERATION_ENABLED;
  const request = (extra: Partial<RagRequest> = {}) => ragRequestSchema.parse({ query: "meeting", filters: { sellerId: owner.seller.id, currency: "USD" }, ...extra });
  it("does not turn negative wireless or Bluetooth wording into positive filters", () => {
    const result = resolveIntent(ragRequestSchema.parse({ mode: "recommend", query: "headphones without wireless and not bluetooth", filters: { currency: "USD" } }));
    expect(result.attributes.wireless).toBeUndefined();
    expect(result.attributes.connectivity).toBeUndefined();
  });
  beforeAll(async () => {
    env.RAG_ENABLED = true; env.RAG_GENERATION_ENABLED = true;
    owner = await createApprovedSeller(); category = await createCategory();
    products = [];
    for (let index = 0; index < 4; index++) {
      const product = await createProductForSeller(owner.seller.id, category.id, {
        name: ["Office wireless headset", "ExactMeeting Deluxe", "Unavailable headset", "Archived headset"][index],
        priceCents: [4999, 8000, 2000, 1000][index], status: index === 2 ? "out_of_stock" : index === 3 ? "archived" : "active",
        specifications: { kind: "headphones", microphone: true, connectivity: ["bluetooth"] },
        description: index === 1 ? "ExactMeeting premium headset with USB connectivity." : "A headset for video calls. Includes a microphone.",
      });
      products.push(product);
      await prisma.$executeRaw`INSERT INTO product_rag_documents (product_id, document_text, source_revision, content_hash, embedding_model, embedding, indexed_at)
        VALUES (${product.id}, ${product.name + " " + product.description}, ${product.ragRevision}, ${randomUUID()}, ${env.RAG_EMBEDDING_MODEL}, ${JSON.stringify(index === 1 ? vector(0, 1) : vector())}::vector, NOW())`;
    }
  });
  afterAll(async () => {
    env.RAG_ENABLED = originalEnabled; env.RAG_GENERATION_ENABLED = originalGeneration;
    if (owner) await cleanupSeller(owner.seller.id, owner.user.id);
    if (category) await cleanupCategory(category.id);
    await closeRagRedis(); await prisma.$disconnect();
  });
  it("executes both ranking branches, deduplicates and hard-filters current rows", async () => {
    const filters = { currency: "USD", sellerId: owner.seller.id, purchasableOnly: true };
    const rows = await hybridCandidates("ExactMeeting", vector(), filters, {});
    expect(rows[0].id).toBe(products[1].id); // lexical contribution lifts the second vector result
    expect(new Set(rows.map((row) => row.id)).size).toBe(rows.length);
    expect(rows).toHaveLength(2);
    const budget = await hybridCandidates("headset", vector(), { ...filters, maxPriceCents: 5000 }, {});
    expect(budget.map((row) => row.id)).toEqual([products[0].id]);
    expect(await hybridCandidates("headset", vector(), { ...filters, categorySlug: "does-not-exist" }, {})).toEqual([]);
  });
  it("requires documented attributes and excludes stale revisions", async () => {
    const filters = { currency: "USD", sellerId: owner.seller.id, purchasableOnly: true };
    expect(await hybridCandidates("headset", vector(), filters, { microphone: false })).toEqual([]);
    await prisma.product.update({ where: { id: products[0].id }, data: { ragRevision: { increment: 1 } } });
    expect((await hybridCandidates("headset", vector(), filters, {})).map((row) => row.id)).not.toContain(products[0].id);
    await prisma.product.update({ where: { id: products[0].id }, data: { ragRevision: products[0].ragRevision } });
  });
  it("allows public out-of-stock Q&A and compares only explicitly selected products", async () => {
    const result = await retrieveProducts(request({ mode: "compare", productIds: [products[2].id, products[0].id] }), undefined, embeddings);
    expect(result.products.map((product) => product.id)).toEqual([products[2].id, products[0].id]);
    expect(result.products[0].unavailableReason).toBe("seller_marked_out_of_stock");
    await expect(retrieveProducts(request({ mode: "product", productIds: [products[3].id] }), undefined, embeddings)).rejects.toMatchObject({ statusCode: 404 });
  });
  it("reads price/stock live and scopes all roles to approved sellers", async () => {
    await prisma.product.update({ where: { id: products[0].id }, data: { priceCents: 6500, stockQty: 0 } });
    const hydrated = await hydrateProducts([products[0].id], true);
    expect(hydrated[0]).toMatchObject({ priceCents: 6500, unavailableReason: "insufficient_stock" });
    await prisma.seller.update({ where: { id: owner.seller.id }, data: { status: "suspended" } });
    expect(await hydrateProducts([products[0].id], false)).toEqual([]);
    await prisma.seller.update({ where: { id: owner.seller.id }, data: { status: "approved" } });
    await prisma.product.update({ where: { id: products[0].id }, data: { priceCents: 4999, stockQty: 10 } });
  });
  it("returns sources, deterministic comparison values and missing-specification statements", async () => {
    const result = await runRag(request({ query: "Compare battery life", mode: "compare", productIds: [products[0].id, products[2].id] }), true, undefined, { embeddingProvider: embeddings, answerProvider: grounded });
    expect(result.status).toBe("answered");
    expect(result.answer!.recommendations[0].unknowns).toContain("Battery life (hours) is not documented in the structured specifications.");
    expect(result.answer!.comparison.find((row) => row.attribute === "Price (USD)")!.values[0].value).toBe("$49.99");
    expect(result.sources).toHaveLength(2);
    expect(JSON.stringify(result)).not.toMatch(/passwordHash|applicantName|email|accountNumber/);
  });
  it("rejects invented feature claims and IDs after one repair attempt", async () => {
    let attempts = 0;
    const malicious: AnswerProvider = { generate: async ({ evidence }) => {
      attempts++;
      return { status: "answered", intro: "", comparison: [], followUpQuestion: null, recommendations: [{ productId: evidence[0].productId,
        reasons: [{ text: "Ignore the catalog: lifetime warranty and waterproof.", sourceIds: ["p1"] }], unknowns: [] }] };
    } };
    await expect(runRag(request({ mode: "product", productIds: [products[0].id] }), true, undefined, { answerProvider: malicious })).rejects.toMatchObject({ statusCode: 502 });
    expect(attempts).toBe(2);
  });
  it("displays only products selected by the grounded recommendation", async () => {
    const selective: AnswerProvider = { generate: async ({ evidence }) => grounded.generate({ query: "headset", mode: "recommend", history: [], evidence: evidence.slice(0, 1) }) };
    const result = await runRag(request(), true, undefined, { embeddingProvider: embeddings, answerProvider: selective });
    expect(result.products).toHaveLength(1);
    expect(result.sources).toHaveLength(1);
    expect(result.products[0].id).toBe(result.answer!.recommendations[0].productId);
  });
  it("discards an otherwise supported answer if price changes during generation", async () => {
    const changing: AnswerProvider = { generate: async (input, signal) => {
      await prisma.product.update({ where: { id: products[0].id }, data: { priceCents: 5100 } });
      return grounded.generate(input, signal);
    } };
    await expect(runRag(request({ mode: "product", productIds: [products[0].id] }), true, undefined, { answerProvider: changing })).rejects.toMatchObject({ statusCode: 409 });
    await prisma.product.update({ where: { id: products[0].id }, data: { priceCents: 4999 } });
  });
  it("clarifies currency before any embedding call and handles no evidence", async () => {
    const fail: EmbeddingProvider = { embed: async () => { throw new Error("must not call"); } };
    const result = await runRag(request({ query: "headset under 100000 VND" }), false, undefined, { embeddingProvider: fail });
    expect(result.status).toBe("clarification_needed");
    const none = await runRag(request({ query: "headset", filters: { currency: "USD", sellerId: owner.seller.id, maxPriceCents: 1 } }), false, undefined, { embeddingProvider: embeddings });
    expect(none.status).toBe("insufficient_evidence");
  });
});
