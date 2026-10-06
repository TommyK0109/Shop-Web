import { randomUUID } from "node:crypto";
import { ragResponseSchema, type RagAnswer, type RagRequest, type RagResponse } from "@storefront/shared";
import { env } from "../../env";
import { AppError } from "../../middleware/errorHandler.middleware";
import { hydrateProducts } from "../../repositories/rag.repository";
import { retrieveProducts } from "./retrieval";
import { evidenceFor, comparisonFor, validateGroundedAnswer } from "./grounding";
import { getAnswerProvider, type AnswerProvider, type EmbeddingProvider } from "./providers";

export interface RagDependencies { embeddingProvider?: EmbeddingProvider; answerProvider?: AnswerProvider }
const emptyAnswer = (intro: string, followUpQuestion: string | null = null): RagAnswer => ({ intro, recommendations: [], comparison: [], followUpQuestion });

export async function runRag(request: RagRequest, generate: boolean, signal?: AbortSignal, deps: RagDependencies = {}): Promise<RagResponse> {
  if (!env.RAG_ENABLED) throw new AppError(503, "Shopping assistant is disabled. You can still browse the catalog.");
  if (generate && !env.RAG_GENERATION_ENABLED) throw new AppError(503, "Assistant answers are disabled. Use product search instead.");
  const requestId = randomUUID();
  const started = Date.now();
  try {
    const result = await retrieveProducts(request, signal, deps.embeddingProvider);
    signal?.throwIfAborted();
    const sources = result.products.map((product, index) => ({ id: `p${index + 1}`, productId: product.id, revision: product.sourceRevision }));
    const response: RagResponse = { requestId, status: "search_results", answer: null, products: result.products, sources, filters: result.filters, generatedAt: new Date().toISOString() };
    if (result.clarification) {
      response.status = "clarification_needed";
      response.answer = emptyAnswer("Please clarify your search.", result.clarification);
    } else if (!result.products.length) {
      response.status = "insufficient_evidence";
      response.answer = emptyAnswer("No current listings match the supplied constraints. Try a broader search or check back after listings are indexed.");
    } else if (generate) {
      const evidence = evidenceFor(result.products, request);
      const provider = deps.answerProvider ?? getAnswerProvider();
      let answer: ReturnType<typeof validateGroundedAnswer> | undefined;
      for (let attempt = 0; attempt < 2; attempt++) {
        signal?.throwIfAborted();
        const raw = await provider.generate({ query: request.query, mode: request.mode, history: request.history, evidence, repair: attempt > 0 }, signal);
        try { answer = validateGroundedAnswer(raw, evidence); break; }
        catch (error) { if (attempt === 1) throw error; }
      }
      if (!answer) throw new AppError(502, "No supported assistant answer was returned.");
      response.status = answer.status;
      response.answer = { ...answer,
        intro: answer.status === "answered" ? "Here is what the selected listings document." : answer.status === "insufficient_evidence" ? "The retrieved listings do not provide enough evidence to answer this question." : "Please clarify your question.",
        comparison: request.mode === "compare" && answer.status === "answered" ? comparisonFor(result.products, sources) : [],
        recommendations: answer.recommendations.map((recommendation) => ({ ...recommendation,
          unknowns: [...new Set([...recommendation.unknowns, ...(evidence.find((source) => source.productId === recommendation.productId)?.unknowns ?? [])])].slice(0, 8),
        })),
      };
      // Non-answers must not appear as implicit product recommendations.
      if (answer.status !== "answered") { response.products = []; response.sources = []; }
      else if (request.mode === "recommend") {
        const recommended = new Set(answer.recommendations.map((item) => item.productId));
        response.products = response.products.filter((product) => recommended.has(product.id));
        response.sources = response.sources.filter((source) => recommended.has(source.productId));
      }
      if (response.answer) delete (response.answer as RagAnswer & { status?: string }).status;
    }
    signal?.throwIfAborted();
    // A change during embedding/generation invalidates the complete answer snapshot.
    const fresh = await hydrateProducts(result.products.map((product) => product.id), true);
    if (JSON.stringify(fresh) !== JSON.stringify(result.products)) throw new AppError(409, "The catalog changed while answering. Please submit your question again for current information.");
    response.generatedAt = new Date().toISOString();
    console.info(JSON.stringify({ event: "rag_request", requestId, stage: generate ? "answer" : "search", status: response.status,
      products: sources.map((source) => ({ id: source.productId, revision: source.revision })), durationMs: Date.now() - started }));
    return ragResponseSchema.parse(response);
  } catch (error) {
    if (signal?.aborted) throw new AppError(504, "The assistant request timed out or was cancelled.");
    if (error instanceof AppError) throw error;
    // Do not let the general Express handler log provider/source payloads or raw SQL.
    console.warn(JSON.stringify({ event: "rag_request", requestId, stage: "failure", code: "RAG_DEPENDENCY_FAILURE", durationMs: Date.now() - started }));
    throw new AppError(503, "The assistant is temporarily unavailable. Please try again later.");
  }
}
