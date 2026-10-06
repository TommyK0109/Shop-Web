import { z } from "zod";

const flag = z.enum(["true", "false"]).default("false").transform((value) => value === "true");
const positive = (value: number, max: number) => z.coerce.number().int().positive().max(max).default(value);

/** One reviewed embedding space and a free-tier-only adapter. Changing it requires rebuilding the index. */
export const ragConfigSchema = z.object({
  RAG_ENABLED: flag,
  RAG_GENERATION_ENABLED: flag,
  RAG_EMBEDDING_PROVIDER: z.literal("gemini").default("gemini"),
  RAG_EMBEDDING_MODEL: z.literal("gemini-embedding-2").default("gemini-embedding-2"),
  RAG_EMBEDDING_DIMENSIONS: z.coerce.number().refine((n) => n === 1536, "Migration requires 1536 dimensions").default(1536),
  RAG_GENERATION_PROVIDER: z.literal("gemini").default("gemini"),
  RAG_GENERATION_MODEL: z.literal("gemini-3.1-flash-lite").default("gemini-3.1-flash-lite"),
  GEMINI_API_KEY: z.string().optional(),
  RAG_GEMINI_FREE_TIER_CONFIRMED: flag,
  RAG_DAILY_BUDGET: z.coerce.number().refine((n) => n === 0, "This implementation has no paid provider mode").default(0),
  RAG_DAILY_REQUEST_LIMIT: positive(500, 100_000),
  RAG_PROVIDER_TIMEOUT_MS: positive(15_000, 60_000),
  RAG_REQUEST_TIMEOUT_MS: positive(45_000, 120_000),
  RAG_MAX_OUTPUT_TOKENS: positive(2000, 8000),
  RAG_MAX_CONTEXT_TOKENS: positive(24_000, 64_000),
  RAG_MAX_SOURCE_BYTES: positive(8000, 8000),
  RAG_WORKER_CONCURRENCY: positive(2, 8),
  RAG_PROVIDER_CONCURRENCY: positive(2, 8),
  RAG_USER_REQUESTS_PER_MINUTE: positive(5, 30),
}).superRefine((value, ctx) => {
  const issue = (path: string, message: string) => ctx.addIssue({ code: "custom", path: [path], message });
  if (value.RAG_GENERATION_ENABLED && !value.RAG_ENABLED) issue("RAG_GENERATION_ENABLED", "Generation requires RAG_ENABLED");
  if (value.RAG_ENABLED) {
    if (!value.GEMINI_API_KEY?.trim()) issue("GEMINI_API_KEY", "Required when RAG is enabled");
    if (!value.RAG_GEMINI_FREE_TIER_CONFIRMED) issue("RAG_GEMINI_FREE_TIER_CONFIRMED", "Confirm the key belongs to a free-tier Google project before enabling RAG");
  }
  if (value.RAG_PROVIDER_TIMEOUT_MS > value.RAG_REQUEST_TIMEOUT_MS) issue("RAG_PROVIDER_TIMEOUT_MS", "Provider deadline must fit the request deadline");
});
