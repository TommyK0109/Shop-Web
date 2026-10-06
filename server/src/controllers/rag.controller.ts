import type { Request, Response } from "express";
import type { RagRequest } from "@storefront/shared";
import { env } from "../env";
import { AppError } from "../middleware/errorHandler.middleware";
import { acquireRagSlot } from "../middleware/ragLimits";
import { runRag } from "../services/rag/answer";

export async function handleRag(req: Request, res: Response, generate: boolean) {
  if (!env.RAG_ENABLED || (generate && !env.RAG_GENERATION_ENABLED)) throw new AppError(503, "This assistant capability is currently disabled.");
  const controller = new AbortController();
  const closed = () => { if (!res.writableEnded) controller.abort(); };
  req.on("aborted", closed);
  res.on("close", closed);
  let timer: ReturnType<typeof setTimeout> | undefined;
  let release: (() => Promise<void>) | undefined;
  try {
    const deadline = new Promise<never>((_resolve, reject) => {
      timer = setTimeout(() => { controller.abort(); reject(new AppError(504, "The assistant request timed out. Please try again.")); }, env.RAG_REQUEST_TIMEOUT_MS);
    });
    // The limiter acquisition is included in the whole request deadline.
    const operation = async () => {
      const acquired = await acquireRagSlot(req.user!.id);
      // A slow limiter can finish after the request deadline's finally block.
      // Release that late lease here instead of leaving it active until expiry.
      if (controller.signal.aborted) {
        await acquired();
        controller.signal.throwIfAborted();
      }
      release = acquired;
      controller.signal.throwIfAborted();
      return runRag(req.body as RagRequest, generate, controller.signal);
    };
    const result = await Promise.race([operation(), deadline]);
    if (!res.destroyed) res.json(result);
  } catch (error) {
    if (error instanceof AppError && error.statusCode === 429) res.setHeader("Retry-After", "60");
    if (!res.destroyed) throw error;
  } finally {
    if (timer) clearTimeout(timer);
    req.off("aborted", closed);
    res.off("close", closed);
    await release?.();
  }
}
