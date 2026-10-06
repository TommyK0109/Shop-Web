import { env } from "../src/env";
import { prisma } from "../src/lib/prisma";
import { enqueueProductIndex } from "../src/services/rag/indexing";

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const categoryArg = args.find((arg) => arg.startsWith("--category="));
  const categorySlug = categoryArg?.slice("--category=".length);
  if (args.some((arg) => arg !== "--dry-run" && !arg.startsWith("--category="))) throw new Error("Use --dry-run and/or --category=slug");
  let cursor: string | undefined;
  let total = 0;
  do {
    const products = await prisma.product.findMany({
      where: { seller: { status: "approved" }, status: { not: "archived" },
        ...(categorySlug ? { category: { slug: categorySlug } } : {}) },
      orderBy: { id: "asc" }, take: 100, ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: { id: true, ragRevision: true, ragDocument: { select: { sourceRevision: true, embeddingModel: true } } },
    });
    for (const product of products) {
      if (product.ragDocument?.sourceRevision === product.ragRevision && product.ragDocument.embeddingModel === env.RAG_EMBEDDING_MODEL) continue;
      total++;
      if (!dryRun) await prisma.$transaction((tx) => enqueueProductIndex(tx, product.id));
    }
    cursor = products.length === 100 ? products[products.length - 1].id : undefined;
  } while (cursor);
  console.log(JSON.stringify({ dryRun, category: categorySlug ?? null, enqueued: total }));
}

main().catch((error: unknown) => { console.error(error instanceof Error ? error.message : "BACKFILL_FAILED"); process.exitCode = 1; })
  .finally(async () => { await prisma.$disconnect(); });
