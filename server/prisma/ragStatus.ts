import { env } from "../src/env";
import { prisma } from "../src/lib/prisma";

async function main() {
  const [coverage, jobs, oldest] = await Promise.all([
    prisma.$queryRaw<Array<{ eligible: bigint; current: bigint }>>`
      SELECT COUNT(*) AS eligible, COUNT(d.product_id) FILTER (WHERE d.source_revision = p.rag_revision AND d.embedding_model = ${env.RAG_EMBEDDING_MODEL}) AS current
      FROM products p JOIN sellers s ON s.id = p.seller_id
      LEFT JOIN product_rag_documents d ON d.product_id = p.id
      WHERE s.status = 'approved' AND p.status <> 'archived'`,
    prisma.ragIndexJob.groupBy({ by: ["state"], _count: true }),
    prisma.ragIndexJob.findFirst({ where: { state: "pending" }, orderBy: { createdAt: "asc" }, select: { createdAt: true } }),
  ]);
  console.log(JSON.stringify({ eligible: Number(coverage[0].eligible), current: Number(coverage[0].current),
    jobs: Object.fromEntries(jobs.map((entry) => [entry.state, entry._count])), oldestPendingAt: oldest?.createdAt ?? null }));
}

main().catch(() => { console.error("INDEX_STATUS_FAILED"); process.exitCode = 1; })
  .finally(async () => { await prisma.$disconnect(); });
