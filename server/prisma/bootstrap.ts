import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

/**
 * Brings a real deployment up to a usable state. The counterpart to
 * `seed.ts`, and its opposite in every way that matters:
 *
 *   seed.ts       deletes everything, invents 1,200 products, dev only
 *   bootstrap.ts  deletes nothing, inserts only what is missing, safe anywhere
 *
 * A fresh production database has no categories, so no seller can list
 * anything, and no admin, so nobody can approve the first seller. That is the
 * entire job here — the two things a deployment cannot create through its own
 * UI, and nothing else.
 *
 * Idempotent: running it twice changes nothing the second time.
 *
 *   ADMIN_EMAIL=you@example.com ADMIN_PASSWORD='...' npm run bootstrap --workspace server
 */

const prisma = new PrismaClient();

/**
 * The starting catalogue structure. Deliberately the same list the demo seed
 * uses, so a real store and a demo store are shaped the same way and the
 * client's category filters look right on day one.
 */
const CATEGORIES = [
  "Electronics",
  "Home & Kitchen",
  "Fashion",
  "Beauty & Personal Care",
  "Sports & Outdoors",
  "Books",
  "Toys & Games",
  "Grocery & Gourmet",
  "Automotive",
  "Health & Household",
  "Office Products",
  "Pet Supplies",
];

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

const MIN_ADMIN_PASSWORD_LENGTH = 12;

/**
 * An admin can approve sellers and read every order on the platform. A weak
 * password on that account is the whole system's weak password, so this is
 * stricter than the 8 characters the public signup form asks for.
 */
function validateAdminPassword(password: string): string | null {
  if (password.length < MIN_ADMIN_PASSWORD_LENGTH) {
    return `ADMIN_PASSWORD must be at least ${MIN_ADMIN_PASSWORD_LENGTH} characters (admin accounts can approve sellers and read every order).`;
  }
  // The one password this repository documents publicly, in the README, for
  // the demo accounts. It must never become a real admin's password.
  if (password === "Password123!") {
    return "ADMIN_PASSWORD is the demo password published in this repository's README. Choose a different one.";
  }
  return null;
}

async function ensureCategories(): Promise<number> {
  let created = 0;
  for (const name of CATEGORIES) {
    const slug = slugify(name);
    const existing = await prisma.category.findUnique({ where: { slug } });
    if (existing) continue;
    await prisma.category.create({ data: { name, slug } });
    created++;
  }
  return created;
}

async function ensureAdmin(): Promise<"created" | "promoted" | "exists" | "skipped"> {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;

  if (!email || !password) {
    console.log(
      "No ADMIN_EMAIL/ADMIN_PASSWORD given — skipping admin creation.\n" +
        "  Provide both to create the first admin account:\n" +
        "    ADMIN_EMAIL=you@example.com ADMIN_PASSWORD='...' npm run bootstrap --workspace server",
    );
    return "skipped";
  }

  const problem = validateAdminPassword(password);
  if (problem) {
    console.error(`\nRefusing to create the admin account.\n\n  ${problem}\n`);
    process.exit(1);
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    if (existing.role === "admin") return "exists";
    // The account is already there as a customer or seller. Promote it
    // rather than failing — but never touch the password, because this
    // script must not be a way to take over an existing account.
    await prisma.user.update({ where: { id: existing.id }, data: { role: "admin" } });
    return "promoted";
  }

  await prisma.user.create({
    data: { email, passwordHash: await bcrypt.hash(password, 10), role: "admin" },
  });
  return "created";
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("\nDATABASE_URL is not set.\n");
    process.exit(1);
  }

  const categoriesCreated = await ensureCategories();
  const adminOutcome = await ensureAdmin();

  console.log(
    `Bootstrap complete. Categories: ${categoriesCreated} created, ${CATEGORIES.length - categoriesCreated} already present.`,
  );
  switch (adminOutcome) {
    case "created":
      console.log(`Admin account created for ${process.env.ADMIN_EMAIL}.`);
      break;
    case "promoted":
      console.log(`Existing account ${process.env.ADMIN_EMAIL} promoted to admin (password unchanged).`);
      break;
    case "exists":
      console.log(`Admin account ${process.env.ADMIN_EMAIL} already exists — nothing changed.`);
      break;
    case "skipped":
      break;
  }
  console.log("Nothing was deleted.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
