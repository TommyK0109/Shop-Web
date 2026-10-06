import "dotenv/config";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { performance } from "node:perf_hooks";
import { PrismaClient } from "@prisma/client";
import { z } from "zod";
import { ragFiltersSchema, ragRequestSchema, type RagProduct, type RagResponse } from "@storefront/shared";
import { DEMO_PREFIX, ragDemoProducts } from "../prisma/ragDemoData";
import { CANONICAL_FORMAT_VERSION } from "../src/services/rag/documentBuilder";

const questionSchema = z.object({
  id: z.string(), split: z.enum(["development", "held-out"]), kind: z.string(), query: z.string(),
  mode: z.enum(["recommend", "product", "compare"]).default("recommend"),
  productKeys: z.array(z.string()).default([]), expectedKeys: z.array(z.string()),
  forbiddenKeys: z.array(z.string()).default([]), filters: ragFiltersSchema.default({}),
  expectedStatus: z.enum(["answered", "clarification_needed", "insufficient_evidence"]).optional(),
  expectedErrorStatus: z.number().int().optional(),
  reviewRequirement: z.string().optional(), manualScenario: z.string().optional(),
});
const datasetSchema = z.object({ version: z.string(), description: z.string(), questions: z.array(questionSchema).min(40).max(60) });
const prisma = new PrismaClient();

async function usageSnapshot() {
  const [value] = await prisma.$queryRaw<Array<{ calls: bigint; input: bigint; output: bigint }>>`
    SELECT COALESCE(SUM(calls), 0)::bigint AS calls,
      COALESCE(SUM(input_tokens), 0)::bigint AS input,
      COALESCE(SUM(output_tokens), 0)::bigint AS output FROM rag_provider_days`;
  return { calls: Number(value.calls), input: Number(value.input), output: Number(value.output) };
}

function recall(expected: string[], actual: string[]): number | null {
  return expected.length ? expected.filter((key) => actual.slice(0, 5).includes(key)).length / expected.length : null;
}
function mean(values: Array<number | null>): number | null {
  const numbers = values.filter((value): value is number => value !== null);
  return numbers.length ? numbers.reduce((a, b) => a + b, 0) / numbers.length : null;
}
function percentile(values: number[], fraction: number): number | null {
  if (!values.length) return null;
  return [...values].sort((a, b) => a - b)[Math.min(values.length - 1, Math.ceil(values.length * fraction) - 1)];
}

async function main() {
  const args = process.argv.slice(2);
  if (args.some((arg) => !["--live", "--generate", "--validate"].includes(arg) && !arg.startsWith("--split=") && !arg.startsWith("--output="))) {
    throw new Error("Usage: rag:eval [--validate] [--live [--generate]] [--split=development|held-out|all] [--output=path]");
  }
  const live = args.includes("--live");
  const generate = args.includes("--generate");
  if (generate && !live) throw new Error("Generation requires explicit --live; the default evaluator never calls a provider.");
  const split = args.find((arg) => arg.startsWith("--split="))?.slice(8) ?? "development";
  if (!["development", "held-out", "all"].includes(split)) throw new Error("Invalid evaluation split");
  const dataset = datasetSchema.parse(JSON.parse(await readFile(resolve(__dirname, "rag-questions.json"), "utf8")));
  const known = new Set(ragDemoProducts.map((product) => product.key));
  const seen = new Set<string>();
  for (const question of dataset.questions) {
    if (seen.has(question.id)) throw new Error(`Duplicate question ${question.id}`);
    seen.add(question.id);
    for (const key of [...question.expectedKeys, ...question.forbiddenKeys, ...question.productKeys]) {
      if (!known.has(key)) throw new Error(`Unknown fixture ${key}`);
    }
  }
  if (args.includes("--validate")) {
    console.log(JSON.stringify({ valid: true, version: dataset.version, questions: dataset.questions.length, products: known.size, heldOut: dataset.questions.filter((question) => question.split === "held-out").length }));
    return;
  }
  const fixtures = await prisma.product.findMany({ where: { slug: { startsWith: DEMO_PREFIX } }, select: { id: true, slug: true } });
  const idByKey = new Map(fixtures.map((product) => [product.slug.slice(DEMO_PREFIX.length), product.id]));
  const keyById = new Map(fixtures.map((product) => [product.id, product.slug.slice(DEMO_PREFIX.length)]));
  for (const key of known) if (!idByKey.has(key)) throw new Error(`Missing demo fixture ${key}; import into an isolated local database with rag:demo first.`);
  const retrieve = live ? (await import("../src/services/rag/retrieval")).retrieveProducts : undefined;
  const answer = generate ? (await import("../src/services/rag/answer")).runRag : undefined;
  const initialUsage = live ? await usageSnapshot() : null;
  const rows: Array<Record<string, unknown> & { baselineRecall: number | null; hybridRecall: number | null; searchLatencyMs: number | null; answerLatencyMs: number | null; violations: string[] }> = [];
  for (const question of dataset.questions.filter((value) => split === "all" || value.split === split)) {
    if (question.manualScenario) {
      rows.push({ id: question.id, manualScenario: question.manualScenario, baselineRecall: null, hybridRecall: null, searchLatencyMs: null, answerLatencyMs: null, violations: [] });
      continue;
    }
    const request = ragRequestSchema.parse({ query: question.query, mode: question.mode, filters: question.filters, productIds: question.productKeys.map((key) => idByKey.get(key)) });
    // Reproduce the catalog's current name-contains approach with equivalent
    // safety filters. Use the entire question, not hand-selected keywords.
    const baseline = await prisma.product.findMany({
      where: { name: { contains: question.query, mode: "insensitive" }, seller: { status: "approved" },
        status: question.mode === "recommend" ? "active" : { in: ["active", "out_of_stock"] },
        ...(question.mode === "recommend" ? { stockQty: { gt: 0 } } : { id: { in: request.productIds } }),
        ...(request.filters.categorySlug ? { category: { slug: request.filters.categorySlug } } : {}),
        ...(request.filters.sellerId ? { sellerId: request.filters.sellerId } : {}),
        priceCents: { gte: request.filters.minPriceCents, lte: request.filters.maxPriceCents },
      }, orderBy: { id: "asc" }, take: 5, select: { id: true },
    });
    const baselineKeys = baseline.map((product) => keyById.get(product.id) ?? `non-fixture:${product.id}`);
    let products: RagProduct[] = [];
    let response: RagResponse | undefined;
    let searchLatencyMs: number | null = null;
    let answerLatencyMs: number | null = null;
    let errorCode: string | undefined;
    let errorStatus: number | undefined;
    const violations: string[] = [];
    try {
      if (retrieve) {
        const started = performance.now();
        products = (await retrieve(request, AbortSignal.timeout(45_000))).products;
        searchLatencyMs = Math.round(performance.now() - started);
      }
      if (answer) {
        const started = performance.now();
        response = await answer(request, true, AbortSignal.timeout(45_000));
        answerLatencyMs = Math.round(performance.now() - started);
      }
    } catch (error) {
      errorCode = error instanceof Error ? error.name : "EVALUATION_ERROR";
      errorStatus = typeof error === "object" && error !== null && "statusCode" in error ? Number(error.statusCode) : undefined;
      if (errorStatus !== question.expectedErrorStatus || errorStatus === undefined) violations.push("Request failed unexpectedly; no quality score can be inferred from this case.");
    }
    if (live && question.expectedErrorStatus !== undefined && errorStatus !== question.expectedErrorStatus) violations.push(`Expected HTTP ${question.expectedErrorStatus} for inaccessible selection`);
    const inspect = (items: RagProduct[]) => {
      for (const product of items) {
        const key = keyById.get(product.id) ?? "non-fixture";
        if (question.forbiddenKeys.includes(key)) violations.push(`Forbidden fixture: ${key}`);
        if (key === "hidden-call" || key === "archived-call") violations.push(`Hidden evidence: ${key}`);
        if (question.mode === "recommend" && (product.stockQty <= 0 || product.status !== "active" || product.unavailableReason !== null)) violations.push(`Unavailable recommendation: ${key}`);
        if (request.filters.maxPriceCents !== undefined && product.priceCents > request.filters.maxPriceCents) violations.push(`Over budget: ${key}`);
        if (request.filters.minPriceCents !== undefined && product.priceCents < request.filters.minPriceCents) violations.push(`Below minimum: ${key}`);
        if (request.filters.categorySlug && product.category.slug !== request.filters.categorySlug) violations.push(`Wrong category: ${key}`);
        if (request.filters.sellerId && product.seller.id !== request.filters.sellerId) violations.push(`Wrong seller: ${key}`);
      }
    };
    inspect(products);
    if (response) {
      inspect(response.products);
      const productIds = new Set(response.products.map((product) => product.id));
      const sources = new Map(response.sources.map((source) => [source.id, source]));
      for (const source of response.sources) if (!productIds.has(source.productId)) violations.push("Source references an absent product");
      for (const recommendation of response.answer?.recommendations ?? []) {
        if (!productIds.has(recommendation.productId)) violations.push("Unknown recommendation ID");
        for (const reason of recommendation.reasons) for (const id of reason.sourceIds) {
          if (sources.get(id)?.productId !== recommendation.productId) violations.push("Invalid recommendation source");
        }
      }
      for (const row of response.answer?.comparison ?? []) for (const value of row.values) for (const id of value.sourceIds) {
        if (!productIds.has(value.productId) || sources.get(id)?.productId !== value.productId) violations.push("Invalid comparison source");
      }
      if (question.expectedStatus && response.status !== question.expectedStatus) violations.push(`Status expected ${question.expectedStatus}, got ${response.status}`);
    }
    const hybridKeys = products.map((product) => keyById.get(product.id) ?? `non-fixture:${product.id}`);
    rows.push({ id: question.id, kind: question.kind, mode: question.mode, split: question.split, expectedKeys: question.expectedKeys,
      baselineKeys, hybridKeys: live ? hybridKeys : null,
      // Recall is meaningful for recommendation retrieval, not direct ID reads.
      baselineRecall: question.mode === "recommend" ? recall(question.expectedKeys, baselineKeys) : null,
      hybridRecall: live && question.mode === "recommend" ? recall(question.expectedKeys, hybridKeys) : null,
      hybridHit: question.expectedKeys.length && live ? question.expectedKeys.some((key) => hybridKeys.slice(0, 5).includes(key)) : null,
      searchLatencyMs, answerLatencyMs, status: response?.status ?? null, answer: response?.answer ?? null,
      reviewRequirement: question.reviewRequirement ?? "Review factual claims against cited fixture specifications.", errorCode, errorStatus,
      violations: [...new Set(violations)],
    });
  }
  const searchLatencies = rows.flatMap((row) => row.searchLatencyMs === null ? [] : [row.searchLatencyMs]);
  const answerLatencies = rows.flatMap((row) => row.answerLatencyMs === null ? [] : [row.answerLatencyMs]);
  const finalUsage = live ? await usageSnapshot() : null;
  const report = {
    datasetVersion: dataset.version, generatedAt: new Date().toISOString(), split,
    mode: generate ? "name-search + hybrid + generation" : live ? "name-search + hybrid" : "name-search baseline (no provider calls)",
    embeddingModel: live ? process.env.RAG_EMBEDDING_MODEL ?? "gemini-embedding-2" : null,
    generationModel: generate ? process.env.RAG_GENERATION_MODEL ?? "gemini-3.1-flash-lite" : null,
    embeddingDimensions: 1536, canonicalVersion: CANONICAL_FORMAT_VERSION, promptVersion: "grounded-selection-v1",
    metrics: { baselineRecallAt5: mean(rows.map((row) => row.baselineRecall)), hybridRecallAt5: mean(rows.map((row) => row.hybridRecall)),
      automatedViolationCases: rows.filter((row) => row.violations.length).length,
      searchLatencyMs: { p50: percentile(searchLatencies, 0.5), p95: percentile(searchLatencies, 0.95), first: searchLatencies[0] ?? null },
      answerLatencyMs: { p50: percentile(answerLatencies, 0.5), p95: percentile(answerLatencies, 0.95), first: answerLatencies[0] ?? null },
      supportedClaimRate: null,
      providerUsage: initialUsage && finalUsage ? { calls: finalUsage.calls - initialUsage.calls,
        inputTokens: finalUsage.input - initialUsage.input, outputTokens: finalUsage.output - initialUsage.output } : null,
      costUsd: null },
    limitations: ["Factual support and missing-information behavior require human review; source ID validation alone does not establish truth.", "Freshness races are manual scenarios covered separately by deterministic integration tests.", "First request is reported separately; process/provider/cache warmness is not controlled.", "Provider ledger deltas can include other active API/worker traffic. Unreported tokens and billing cannot be inferred from request counts; check provider usage records. No paid fallback is permitted.", "Run on the isolated fixture database; unrelated catalog products can change recall."],
    cases: rows,
  };
  const output = JSON.stringify(report, null, 2);
  const outputArg = args.find((arg) => arg.startsWith("--output="));
  if (outputArg) {
    const outputPath = resolve(outputArg.slice(9));
    await writeFile(outputPath, `${output}\n`, { encoding: "utf8", flag: "wx" });
    console.log(`Evaluation report created: ${outputPath}`);
  } else console.log(output);
  if (live && rows.some((row) => row.violations.length)) process.exitCode = 1;
}

main().catch((error: unknown) => { console.error(error instanceof Error ? error.message : "Evaluation failed"); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
