import "dotenv/config";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { ragRequestSchema, type RagResponse } from "@storefront/shared";
import { prisma } from "../src/lib/prisma";
import { env } from "../src/env";
import { closeRagRedis } from "../src/lib/ragRedis";
import { processNextIndexJob } from "../src/services/rag/indexing";
import { runRag } from "../src/services/rag/answer";
import { DEMO_PREFIX } from "../prisma/ragDemoData";

// A live evaluation harness. Production retrieval, providers and prompts are unchanged.
const output = resolve(__dirname, "../../docs/rag-test-artifacts");
const pause = (ms: number) => new Promise<void>((done) => setTimeout(done, ms));
const http: Array<{ model: string; operation: string; status: number; durationMs: number; providerStatus?: string }> = [];
const originalFetch = globalThis.fetch;
globalThis.fetch = async (input, init) => {
  const started = Date.now();
  const response = await originalFetch(input, init);
  const url = new URL(String(input));
  if (url.hostname === "generativelanguage.googleapis.com") {
    const [model, operation] = url.pathname.split("/models/")[1].split(":");
    let providerStatus: string | undefined;
    if (!response.ok) {
      const data = await response.clone().json().catch(() => null) as { error?: { status?: string } } | null;
      providerStatus = data?.error?.status;
    }
    http.push({ model, operation, status: response.status, durationMs: Date.now() - started, providerStatus });
  }
  return response;
};

async function ledger() {
  return prisma.$queryRaw<Array<{ day: string; calls: number; input_tokens: number; output_tokens: number }>>`
    SELECT day, calls::int, input_tokens::int, output_tokens::int FROM rag_provider_days ORDER BY day`;
}

interface Question {
  id: string; kind: string; query: string; mode?: string; split?: string;
  productKeys?: string[]; expectedKeys: string[]; forbiddenKeys?: string[];
  filters?: Record<string, unknown>; expectedStatus?: string; expectedErrorStatus?: number;
  reviewRequirement?: string; manualScenario?: string;
}
interface Result {
  number: number; question: Question; request: unknown; startedAt: string; durationMs: number;
  response?: RagResponse; error?: { status: number | null; message: string };
  returnedKeys: string[]; checks: string[]; automatedResult: string;
  providerHttp: typeof http;
}

async function main() {
  const target = new URL(env.DATABASE_URL);
  if (target.hostname !== "localhost" || target.port !== "55433" || target.pathname !== "/storefront_test") {
    throw new Error("This evaluation is restricted to localhost:55433/storefront_test.");
  }
  await mkdir(output, { recursive: true });
  if (process.argv.includes("--index")) {
    const before = await ledger();
    const jobs = await prisma.ragIndexJob.findMany({ select: { productId: true }, orderBy: { productId: "asc" } });
    const outcomes: Array<{ productId: string; outcome: string; providerHttp: typeof http }> = [];
    for (const job of jobs) {
      const offset = http.length;
      const outcome = await processNextIndexJob({ productId: job.productId });
      outcomes.push({ productId: job.productId, outcome, providerHttp: http.slice(offset) });
      console.log(JSON.stringify({ stage: "index", completed: outcomes.length, total: jobs.length, outcome, http: http.slice(offset) }));
      await writeFile(resolve(output, "indexing.json"), JSON.stringify({ before, after: await ledger(), outcomes }, null, 2));
      if (outcome === "failed") throw new Error("Live indexing failed; inspect sanitized HTTP diagnostics before proceeding.");
      if (http.length > offset) await pause(4500);
    }
    return;
  }
  const dataset = JSON.parse(await readFile(resolve(__dirname, "rag-questions.json"), "utf8")) as { questions: Question[] };
  const questions: Question[] = [...dataset.questions.filter((q) => !q.manualScenario),
    { id: "q49", kind: "clarification", query: "Find affordable headphones", expectedKeys: [], expectedStatus: "clarification_needed" },
    { id: "q50", kind: "no-results", query: "Find a webcam under $1", expectedKeys: [], expectedStatus: "insufficient_evidence" },
    { id: "q51", kind: "product-question", query: "What is the documented battery life and weight?", mode: "product", productKeys: ["long-call"], expectedKeys: ["long-call"], expectedStatus: "answered" },
    { id: "q52", kind: "comparison", query: "Compare resolution and frame rate", mode: "compare", productKeys: ["tiny-720", "detail-4k"], expectedKeys: ["tiny-720", "detail-4k"], expectedStatus: "answered" },
  ];
  const fixtures = await prisma.product.findMany({ where: { slug: { startsWith: DEMO_PREFIX } }, select: { id: true, slug: true, name: true, status: true, ragRevision: true, seller: { select: { status: true } }, ragDocument: { select: { sourceRevision: true, embeddingModel: true } } } });
  if (fixtures.length !== 36) throw new Error("Expected 36 authored fixtures.");
  const eligible = fixtures.filter((p) => p.status !== "archived" && p.seller.status === "approved");
  if (eligible.some((p) => p.ragDocument?.sourceRevision !== p.ragRevision || p.ragDocument.embeddingModel !== env.RAG_EMBEDDING_MODEL)) throw new Error("Index coverage is incomplete.");
  const byKey = new Map(fixtures.map((p) => [p.slug.slice(DEMO_PREFIX.length), p.id]));
  const byId = new Map(fixtures.map((p) => [p.id, p.slug.slice(DEMO_PREFIX.length)]));
  const before = await ledger();
  const startedAt = new Date().toISOString();
  const rows: Result[] = [];
  for (const question of questions) {
    const request = ragRequestSchema.parse({ query: question.query, mode: question.mode, filters: question.filters, productIds: (question.productKeys ?? []).map((key) => byKey.get(key)) });
    const started = Date.now();
    const offset = http.length;
    const row: Result = { number: rows.length + 1, question, request, startedAt: new Date().toISOString(), durationMs: 0, returnedKeys: [], checks: [], automatedResult: "PASS", providerHttp: [] };
    try {
      row.response = await runRag(request, true, AbortSignal.timeout(env.RAG_REQUEST_TIMEOUT_MS));
      row.returnedKeys = row.response.products.map((p) => byId.get(p.id) ?? p.id);
      if (question.expectedErrorStatus) row.checks.push(`Expected error ${question.expectedErrorStatus}, received a response`);
      if (question.expectedStatus && row.response.status !== question.expectedStatus) row.checks.push(`Expected status ${question.expectedStatus}; received ${row.response.status}`);
      for (const product of row.response.products) {
        const key = byId.get(product.id)!;
        if ((question.forbiddenKeys ?? []).includes(key) || ["hidden-call", "archived-call"].includes(key)) row.checks.push(`Forbidden product: ${key}`);
        if (request.mode === "recommend" && product.unavailableReason !== null) row.checks.push(`Unavailable recommendation: ${key}`);
        const filters = row.response.filters;
        if (filters.maxPriceCents !== undefined && product.priceCents > filters.maxPriceCents) row.checks.push(`Over budget: ${key}`);
        if (filters.minPriceCents !== undefined && product.priceCents < filters.minPriceCents) row.checks.push(`Below minimum: ${key}`);
      }
      if (question.expectedKeys.length && !question.expectedKeys.some((key) => row.returnedKeys.includes(key))) row.checks.push("No labeled relevant product returned");
      if (request.mode === "compare" && question.expectedKeys.some((key) => !row.returnedKeys.includes(key))) row.checks.push("Comparison omitted a selected product");
      const sources = new Map(row.response.sources.map((s) => [s.id, s.productId]));
      for (const rec of row.response.answer?.recommendations ?? []) for (const reason of rec.reasons) {
        if (reason.sourceIds.some((id) => sources.get(id) !== rec.productId)) row.checks.push("Invalid citation");
      }
    } catch (error) {
      const status = typeof error === "object" && error !== null && "statusCode" in error ? Number(error.statusCode) : null;
      row.error = { status, message: error instanceof Error ? error.message : "Unknown evaluation error" };
      if (status !== question.expectedErrorStatus) row.checks.push(`Unexpected error ${status}`);
    }
    row.durationMs = Date.now() - started;
    row.providerHttp = http.slice(offset);
    row.automatedResult = row.checks.length ? "FAIL" : "PASS";
    rows.push(row);
    await writeFile(resolve(output, "live-results.json"), JSON.stringify({ startedAt, updatedAt: new Date().toISOString(), complete: rows.length === questions.length,
      embeddingModel: env.RAG_EMBEDDING_MODEL, generationModel: env.RAG_GENERATION_MODEL, eligibleDocuments: eligible.length,
      execution: "Direct runRag service with live Gemini, PostgreSQL and Redis; not browser/HTTP testing", before, after: await ledger(), rows }, null, 2));
    console.log(JSON.stringify({ case: row.number, id: question.id, status: row.response?.status ?? row.error?.status, result: row.automatedResult, durationMs: row.durationMs, providerHttp: row.providerHttp }));
    // Pace between cases, outside recorded response latency, without changing provider limits.
    if (row.providerHttp.length && rows.length < questions.length) await pause(7000);
  }
}

main().catch((error) => { console.error(error instanceof Error ? error.message : "EVALUATION_FAILED"); process.exitCode = 1; })
  .finally(async () => { globalThis.fetch = originalFetch; await closeRagRedis(); await prisma.$disconnect(); });
