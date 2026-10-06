import "dotenv/config";
import { randomBytes } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import { Prisma, PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { productSpecificationsSchema } from "@storefront/shared";
import { checkSeedTarget } from "../src/lib/seedGuard";
import { enqueueProductIndex } from "../src/repositories/ragIndex.repository";
import { DEMO_NOTICE, DEMO_PREFIX, ragDemoId, ragDemoProducts } from "./ragDemoData";

const prisma = new PrismaClient();

async function main() {
  const target = checkSeedTarget({ nodeEnv: process.env.NODE_ENV, databaseUrl: process.env.DATABASE_URL, confirmToken: undefined });
  if (!target.allowed || !target.local) throw new Error("RAG demo import is limited to a local, non-production database. It never runs the destructive catalog seed.");
  const passwordHash = await bcrypt.hash(randomBytes(32).toString("hex"), 10);
  let changed = 0;
  await prisma.$transaction(async (tx) => {
    // An existing Electronics category is reused without renaming it.
    const category = await tx.category.upsert({ where: { slug: "electronics" }, update: {}, create: { id: ragDemoId("category"), name: "Electronics", slug: "electronics" } });
    for (const hidden of [false, true]) {
      const key = hidden ? "hidden-seller" : "seller";
      const userId = ragDemoId(`${key}-user`);
      const sellerId = ragDemoId(key);
      const email = `${DEMO_PREFIX}${key}@example.invalid`;
      const existingUser = await tx.user.findFirst({ where: { OR: [{ id: userId }, { email }] } });
      if (existingUser && (existingUser.id !== userId || existingUser.email !== email || existingUser.role !== "seller")) throw new Error("Demo user identity collision; no changes imported.");
      await tx.user.upsert({ where: { id: userId }, update: {}, create: { id: userId, email, passwordHash, role: "seller" } });
      const slug = `${DEMO_PREFIX}${key}`;
      const existingSeller = await tx.seller.findFirst({ where: { OR: [{ id: sellerId }, { slug }, { userId }] } });
      if (existingSeller && (existingSeller.id !== sellerId || existingSeller.userId !== userId || existingSeller.slug !== slug)) throw new Error("Demo seller identity collision; no changes imported.");
      await tx.seller.upsert({ where: { id: sellerId }, update: {}, create: { id: sellerId, userId, slug, applicantName: "Demo fixture", nationalIdMasked: "DEMO", businessName: hidden ? "RAG Demo Suspended Store" : "RAG Demo Electronics", description: DEMO_NOTICE, addressLine1: "Fictional demo address", city: "Demo", postalCode: "00000", country: "US", status: hidden ? "suspended" : "approved" } });
      // Deliberately do not fabricate bank details or payment methods.
    }
    for (const fixture of ragDemoProducts) {
      const id = ragDemoId(fixture.key);
      const slug = `${DEMO_PREFIX}${fixture.key}`;
      const sellerId = ragDemoId(fixture.hiddenSeller ? "hidden-seller" : "seller");
      const description = `${DEMO_NOTICE}\n\n${fixture.description}`;
      const specifications = productSpecificationsSchema.parse(fixture.specifications) as Prisma.InputJsonObject;
      const existing = await tx.product.findFirst({ where: { OR: [{ id }, { slug }] } });
      if (existing && (existing.id !== id || existing.slug !== slug || existing.sellerId !== sellerId)) throw new Error(`Demo product identity collision for ${fixture.key}; no changes imported.`);
      const sourceChanged = !existing || existing.name !== fixture.name || existing.description !== description || !isDeepStrictEqual(existing.specifications, specifications) || existing.categoryId !== category.id;
      const record = { name: fixture.name, description, specifications, categoryId: category.id, priceCents: fixture.priceCents, stockQty: fixture.stockQty ?? 20, status: fixture.status ?? "active" as const };
      if (!existing) {
        await tx.product.create({ data: { ...record, id, slug, sellerId } });
      } else {
        await tx.product.update({ where: { id }, data: { ...record, ...(sourceChanged ? { ragRevision: { increment: 1 } } : {}) } });
      }
      // Ensure a durable job even after a worker failure; unchanged document
      // hashes let the worker skip unnecessary provider requests.
      await enqueueProductIndex(tx, id);
      if (sourceChanged) changed++;
    }
  }, { timeout: 30_000 });
  console.log(`Imported ${ragDemoProducts.length} authored demo products; ${changed} new or changed source records. Unrelated records were preserved. Indexing jobs are queued; no provider calls were made.`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Demo import failed");
  process.exitCode = 1;
}).finally(() => prisma.$disconnect());
