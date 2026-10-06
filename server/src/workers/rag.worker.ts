import { env } from "../env";
import { prisma } from "../lib/prisma";
import { closeRagRedis } from "../lib/ragRedis";
import { processNextIndexJob } from "../services/rag/indexing";

const controller = new AbortController();
process.once("SIGTERM", () => controller.abort());
process.once("SIGINT", () => controller.abort());

async function main() {
  if (!env.RAG_ENABLED) {
    console.log("RAG is disabled; indexing worker is waiting for shutdown.");
    await new Promise<void>((resolve) => controller.signal.addEventListener("abort", () => resolve(), { once: true }));
    return;
  }
  console.log("RAG indexing worker started.");
  await Promise.all(Array.from({ length: env.RAG_WORKER_CONCURRENCY }, async () => {
    while (!controller.signal.aborted) {
      try {
        const outcome = await processNextIndexJob({ signal: controller.signal });
        if (outcome !== "idle") continue;
      } catch {
        console.error("RAG worker: INDEX_DATABASE_UNAVAILABLE");
      }
      await new Promise<void>((resolve) => {
        const stop = () => { clearTimeout(timer); resolve(); };
        const timer = setTimeout(() => { controller.signal.removeEventListener("abort", stop); resolve(); }, 2000);
        controller.signal.addEventListener("abort", stop, { once: true });
      });
    }
  }));
}

main().catch(() => { console.error("RAG worker: WORKER_FAILED"); process.exitCode = 1; })
  .finally(async () => { await closeRagRedis(); await prisma.$disconnect(); });
