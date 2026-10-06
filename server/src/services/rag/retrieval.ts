import type { RagFilters, RagRequest } from "@storefront/shared";
import { env } from "../../env";
import { prisma } from "../../lib/prisma";
import { onceCached, queryEmbeddingKey } from "../../lib/ragCache";
import { AppError } from "../../middleware/errorHandler.middleware";
import { hybridCandidates, hydrateProducts, matchesConstraints, type AttributeConstraints } from "../../repositories/rag.repository";
import { getEmbeddingProvider, type EmbeddingProvider } from "./providers";
import { validateEmbedding } from "./documentBuilder";

export function resolveIntent(request: RagRequest): { filters: RagFilters; attributes: AttributeConstraints; clarification?: string } {
  const filters = { ...request.filters, currency: request.filters.currency.toUpperCase(), purchasableOnly: request.mode === "recommend" || (request.filters.purchasableOnly ?? false) };
  const attributes: AttributeConstraints = {};
  const query = request.query.toLowerCase();
  if (filters.currency !== "USD" || /\b(vnd|dong|đồng|eur|euro|gbp|yen|cad|aud)\b|[₫€£¥]/iu.test(query)) {
    return { filters, attributes, clarification: "Catalog prices are in USD. Please enter your budget in USD; I cannot convert currencies." };
  }
  // Explicit UI budgets win over natural-language budgets. Unsupported money wording asks instead of guessing.
  const moneyMatch = (expression: RegExp) => [...query.matchAll(expression)].find((match) => /\$|\b(?:usd|dollars?|budget)\b/.test(match[0]));
  const max = moneyMatch(/(?:under|below|less than|up to|at most|budget(?: of)?|maximum|max)\s*\$?\s*(\d+(?:\.\d{1,2})?)(?:\s*(?:usd|dollars?))?/gi);
  const suffix = /\$\s*(\d+(?:\.\d{1,2})?)\s*(?:or less|maximum|max|budget)/i.exec(query);
  const min = moneyMatch(/(?:over|above|more than|at least|minimum|min)\s*\$?\s*(\d+(?:\.\d{1,2})?)(?:\s*(?:usd|dollars?))?/gi);
  const range = /(?:between\s*)?\$\s*(\d+(?:\.\d{1,2})?)\s*(?:-|and|to)\s*\$?\s*(\d+(?:\.\d{1,2})?)/i.exec(query);
  const monetaryContext = /\$|\b(?:usd|dollars?|budget|price|cost|spend|amount)\b/i.test(query);
  const maxWithContext = monetaryContext ? (max ?? suffix) : undefined;
  const minWithContext = monetaryContext ? min : undefined;
  const rangeWithContext = monetaryContext ? range : undefined;
  const moneyMention = /\$|\b(?:budget|cheap|affordable|expensive|usd|dollars?)\b/.test(query);
  if (filters.maxPriceCents === undefined && maxWithContext) {
    const amount = Math.round(Number(maxWithContext[1]) * 100);
    filters.maxPriceCents = Math.max(0, amount - (/^(under|below|less than)/i.test(maxWithContext[0]) ? 1 : 0));
  }
  if (filters.minPriceCents === undefined && minWithContext) filters.minPriceCents = Math.round(Number(minWithContext[1]) * 100) + (/^(over|above|more than)/i.test(minWithContext[0]) ? 1 : 0);
  if (rangeWithContext) { filters.minPriceCents ??= Math.round(Number(rangeWithContext[1]) * 100); filters.maxPriceCents ??= Math.round(Number(rangeWithContext[2]) * 100); }
  if ((filters.minPriceCents ?? 0) > (filters.maxPriceCents ?? 100_000_000) || (filters.maxPriceCents ?? 0) > 100_000_000) return { filters: request.filters, attributes, clarification: "Please specify a valid minimum and maximum budget in USD." };
  if (moneyMention && filters.maxPriceCents === undefined && filters.minPriceCents === undefined) return { filters, attributes, clarification: "What is your maximum budget in USD?" };
  if (request.mode === "recommend" && /\bcompar(?:e|ison)\b/.test(query)) return { filters, attributes, clarification: "Select two or three listings and choose Compare products so I can compare those specific products." };
  if (request.mode === "recommend") {
    if (/\b(headphones?|headsets?|earphones?|earbuds?)\b/.test(query)) attributes.kind = "headphones";
    if (/\b(webcams?)\b/.test(query) && !/\b(?:no|without|not)\s+(?:buying\s+)?(?:a\s+)?webcam\b/.test(query)) attributes.kind = "webcam";
    if (/\b(with|need|must have|has|include)\b.*\b(mic|microphone)\b|\b(mic|microphone)\s+(required|essential)\b/.test(query)) attributes.microphone = true;
    if (/\b(without|no)\s+(a\s+)?(?:built-in\s+)?(mic|microphone)\b/.test(query)) attributes.microphone = false;
    // Negative wording must not become a positive hard filter. Keep these
    // constraints strict only when the user explicitly requests them.
    if (/\bwireless\b/.test(query) && !/\b(?:no|without|not)\s+(?:a\s+)?wireless\b/.test(query)) attributes.wireless = true;
    if (/\bbluetooth\b/.test(query) && !/\b(?:no|without|not)\s+bluetooth\b/.test(query)) attributes.connectivity = "bluetooth";
    attributes.compatibility = ["windows", "macos", "linux", "android", "ios", "chromeos"].filter((os) => new RegExp(`\\b${os}\\b`).test(query));
    if (!attributes.compatibility.length) delete attributes.compatibility;
  }
  return { filters, attributes };
}

export async function retrieveProducts(request: RagRequest, signal?: AbortSignal, embeddingProvider: EmbeddingProvider = getEmbeddingProvider()) {
  signal?.throwIfAborted();
  // IDs are scoped before clarification or provider work, so inaccessible selections never leak details.
  const selected = request.mode === "recommend" ? undefined : await hydrateProducts(request.productIds, true);
  if (selected && selected.length !== request.productIds.length) throw new AppError(404, "One or more selected products could not be found.");
  const intent = resolveIntent(request);
  const { filters, attributes } = intent;
  if (intent.clarification) return { products: [], ...intent };
  if (filters.categorySlug && !await prisma.category.findUnique({ where: { slug: filters.categorySlug }, select: { id: true } })) return { products: [], ...intent, clarification: "Please choose a category from the current category list." };
  if (filters.sellerId && !await prisma.seller.findFirst({ where: { id: filters.sellerId, status: "approved" }, select: { id: true } })) throw new AppError(404, "Store not found.");
  if (selected) return { products: selected.filter((product) => matchesConstraints(product, filters, attributes)), ...intent };
  // Follow-up context helps semantic retrieval; explicit constraints remain authoritative.
  const previous = request.history.filter((message) => message.role === "user").slice(-2).map((message) => message.content).join(" ");
  const semanticText = `${previous} ${request.query}`.normalize("NFKC").replace(/\s+/g, " ").trim();
  const vector = await onceCached(queryEmbeddingKey(semanticText, env.RAG_EMBEDDING_MODEL, env.RAG_EMBEDDING_DIMENSIONS), async () => {
    const vectors = await embeddingProvider.embed([semanticText], signal, "query");
    if (vectors.length !== 1) throw new AppError(502, "Invalid query embedding.");
    validateEmbedding(vectors[0], env.RAG_EMBEDDING_DIMENSIONS);
    return vectors[0];
  }, (value): value is number[] => { try { validateEmbedding(value, env.RAG_EMBEDDING_DIMENSIONS); return true; } catch { return false; } });
  signal?.throwIfAborted();
  const ranked = await hybridCandidates(request.query, vector, filters, attributes);
  const products = (await hydrateProducts(ranked.map((row) => row.id), true)).filter((product) => matchesConstraints(product, filters, attributes));
  return { products, ...intent };
}
