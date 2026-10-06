import { z } from "zod";
import { productSpecificationsSchema } from "./product";

export const ragFiltersSchema = z.object({
  categorySlug: z.string().trim().min(1).max(100).optional(),
  sellerId: z.string().uuid().optional(),
  minPriceCents: z.number().int().min(0).max(100_000_000).optional(),
  maxPriceCents: z.number().int().min(0).max(100_000_000).optional(),
  currency: z.string().trim().length(3).default("USD"),
  purchasableOnly: z.boolean().optional(),
}).strict().refine((value) => value.minPriceCents === undefined || value.maxPriceCents === undefined || value.minPriceCents <= value.maxPriceCents,
  { message: "Minimum budget must not exceed maximum budget", path: ["maxPriceCents"] });
export type RagFilters = z.infer<typeof ragFiltersSchema>;

export const ragRequestSchema = z.object({
  query: z.string().trim().min(1).max(2000),
  mode: z.enum(["recommend", "product", "compare"]).default("recommend"),
  filters: ragFiltersSchema.default({}),
  productIds: z.array(z.string().uuid()).max(3).default([]),
  history: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().trim().min(1).max(2000) }).strict()).max(6).default([]),
}).strict().superRefine((value, ctx) => {
  const count = value.productIds.length;
  if (new Set(value.productIds).size !== count) ctx.addIssue({ code: "custom", path: ["productIds"], message: "Choose distinct products" });
  if ((value.mode === "recommend" && count !== 0) || (value.mode === "product" && count !== 1) || (value.mode === "compare" && (count < 2 || count > 3))) {
    ctx.addIssue({ code: "custom", path: ["productIds"], message: "Choose one product for questions or two to three products for comparison" });
  }
  if (value.query.length + value.history.reduce((total, message) => total + message.content.length, 0) > 10_000) {
    ctx.addIssue({ code: "custom", path: ["history"], message: "Conversation is too long; start a new question" });
  }
});
export type RagRequest = z.infer<typeof ragRequestSchema>;
export type RagRequestInput = z.input<typeof ragRequestSchema>;

const sourceIdsSchema = z.array(z.string().min(1).max(40)).min(1).max(6);
export const ragAnswerSchema = z.object({
  intro: z.string().max(1000),
  recommendations: z.array(z.object({
    productId: z.string().uuid(),
    reasons: z.array(z.object({ text: z.string().min(1).max(500), sourceIds: sourceIdsSchema }).strict()).max(6),
    unknowns: z.array(z.string().min(1).max(300)).max(8),
  }).strict()).max(6),
  comparison: z.array(z.object({
    attribute: z.string().min(1).max(100),
    values: z.array(z.object({ productId: z.string().uuid(), value: z.string().max(300), sourceIds: sourceIdsSchema }).strict()).min(2).max(3),
  }).strict()).max(12),
  followUpQuestion: z.string().min(1).max(500).nullable(),
}).strict();
export type RagAnswer = z.infer<typeof ragAnswerSchema>;
export const ragGeneratedAnswerSchema = ragAnswerSchema.extend({ status: z.enum(["answered", "clarification_needed", "insufficient_evidence"]) });
export type RagGeneratedAnswer = z.infer<typeof ragGeneratedAnswerSchema>;

export const ragProductSchema = z.object({
  id: z.string().uuid(), name: z.string().max(200), slug: z.string().min(1).max(250),
  description: z.string().max(12_000), priceCents: z.number().int().min(0), stockQty: z.number().int().min(0),
  status: z.enum(["active", "out_of_stock"]),
  category: z.object({ id: z.string().uuid(), name: z.string(), slug: z.string() }),
  seller: z.object({ id: z.string().uuid(), businessName: z.string(), slug: z.string() }),
  imageUrl: z.string().url().nullable(), specifications: productSpecificationsSchema.nullable(),
  sourceRevision: z.number().int().positive(), unavailableReason: z.string().max(100).nullable(),
});
export type RagProduct = z.infer<typeof ragProductSchema>;
export const ragSourceSchema = z.object({ id: z.string().min(1).max(40), productId: z.string().uuid(), revision: z.number().int().positive() });
export type RagSource = z.infer<typeof ragSourceSchema>;
export const ragResponseSchema = z.object({
  requestId: z.string().min(1).max(100),
  status: z.enum(["answered", "clarification_needed", "insufficient_evidence", "search_results"]),
  answer: ragAnswerSchema.nullable(),
  products: z.array(ragProductSchema).max(6), sources: z.array(ragSourceSchema).max(6),
  filters: ragFiltersSchema, generatedAt: z.string().datetime(),
});
export type RagResponse = z.infer<typeof ragResponseSchema>;
export const ragCapabilitiesSchema = z.object({ enabled: z.boolean(), generationEnabled: z.boolean() });
export type RagCapabilities = z.infer<typeof ragCapabilitiesSchema>;
