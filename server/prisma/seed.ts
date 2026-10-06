import "dotenv/config";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { faker } from "@faker-js/faker";
import bcrypt from "bcryptjs";
import { generateDemoPaymentMethod } from "../src/services/vietqr.services";
import {
  checkSeedTarget,
  describeExistingData,
  hasRealActivity,
} from "../src/lib/seedGuard";

const prisma = new PrismaClient();

const SELLER_COUNT = 500;
const PRODUCTS_PER_CATEGORY = 100; // 12 categories x 100 = 1,200 products
const CUSTOMER_COUNT = 40;
const DEMO_PASSWORD = "Password123!";
// Fixed logins for the demo/README — one account per role. Every other
// seeded account gets a random Faker address.
const DEMO_ADMIN_EMAIL = "admin@storefront.dev";
const DEMO_SELLER_EMAIL = "seller@storefront.dev";
const DEMO_CUSTOMER_EMAIL = "customer@storefront.dev";

// Each category keeps its own noun pool so generated names stay on-topic and
// searchable ("wireless headphones" only shows up under Electronics), instead
// of faker.commerce.productName()'s category-agnostic output.
const CATEGORIES: { name: string; nouns: string[] }[] = [
  { name: "Electronics", nouns: ["Laptop", "Smartphone", "Headphones", "Bluetooth Speaker", "Smartwatch", "Router", "Webcam", "Monitor", "Keyboard", "Wireless Mouse", "Power Bank", "Tablet"] },
  { name: "Home & Kitchen", nouns: ["Blender", "Toaster", "Cookware Set", "Vacuum Cleaner", "Air Fryer", "Coffee Maker", "Cutting Board", "Dinnerware Set", "Bed Sheet Set", "Curtain Panel"] },
  { name: "Fashion", nouns: ["T-Shirt", "Jacket", "Sneakers", "Jeans", "Dress", "Backpack", "Sunglasses", "Leather Belt", "Scarf", "Wool Hat"] },
  { name: "Beauty & Personal Care", nouns: ["Shampoo", "Face Cream", "Perfume", "Lipstick", "Hair Dryer", "Electric Razor", "Sunscreen", "Nail Polish", "Electric Toothbrush", "Body Lotion"] },
  { name: "Sports & Outdoors", nouns: ["Yoga Mat", "Dumbbell Set", "Tennis Racket", "Camping Tent", "Bicycle Helmet", "Running Shoes", "Water Bottle", "Fishing Rod", "Hiking Backpack", "Resistance Band"] },
  { name: "Books", nouns: ["Novel", "Cookbook", "Notebook", "Planner", "Comic Book", "Textbook", "Journal", "Puzzle Book", "Biography", "Children's Book"] },
  { name: "Toys & Games", nouns: ["Board Game", "Action Figure", "Jigsaw Puzzle", "Building Blocks Set", "RC Car", "Doll", "Card Game", "Stuffed Animal", "Mini Drone", "Chess Set"] },
  { name: "Grocery & Gourmet", nouns: ["Coffee Beans", "Olive Oil", "Pasta", "Honey Jar", "Tea Set", "Spice Mix", "Snack Box", "Granola", "Chocolate Box", "Sparkling Water"] },
  { name: "Automotive", nouns: ["Car Vacuum", "Phone Mount", "Dash Cam", "Seat Cover", "Tire Inflator", "Jump Starter", "Car Charger", "Floor Mat Set", "Wiper Blades", "Air Freshener"] },
  { name: "Health & Household", nouns: ["Vitamin Supplement", "Air Purifier", "Digital Thermometer", "First Aid Kit", "Humidifier", "Hand Sanitizer", "Face Mask Pack", "Massager", "Smart Scale", "Heating Pad"] },
  { name: "Office Products", nouns: ["Desk Organizer", "Office Chair", "Printer", "Notebook Set", "Stapler", "Whiteboard", "Desk Lamp", "Filing Cabinet", "Pen Set", "Monitor Stand"] },
  { name: "Pet Supplies", nouns: ["Dog Leash", "Cat Tree", "Pet Bed", "Aquarium Filter", "Chew Toy", "Pet Carrier", "Litter Box", "Bird Cage", "Feeding Bowl", "Grooming Brush"] },
];

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function uniqueSlug(base: string, used: Set<string>): string {
  let slug = slugify(base);
  let attempt = slug;
  let i = 2;
  while (used.has(attempt)) {
    attempt = `${slug}-${i++}`;
  }
  used.add(attempt);
  return attempt;
}

/**
 * Refuses to touch anything that might not be a throwaway database, and
 * reports what a wipe would cost before doing it.
 *
 * This script deletes every row in every table. That is the point of it — a
 * demo catalog you can regenerate at will — but it is one environment
 * variable away from being pointed at real customers, so it does not get to
 * run on trust.
 */
async function assertSafeToWipe() {
  const verdict = checkSeedTarget({
    nodeEnv: process.env.NODE_ENV,
    databaseUrl: process.env.DATABASE_URL,
    confirmToken: process.env.SEED_CONFIRM_WIPE,
  });

  if (!verdict.allowed) {
    console.error(`
Refusing to seed.

  ${verdict.reason}
`);
    process.exit(1);
  }

  const [users, orders, products, sellers] = await Promise.all([
    prisma.user.count(),
    prisma.order.count(),
    prisma.product.count(),
    prisma.seller.count(),
  ]);
  const existing = { users, orders, products, sellers };

  console.log(`Seeding ${verdict.database} on ${verdict.host}.`);
  if (users + products + sellers > 0) {
    console.log(`About to delete everything currently there: ${describeExistingData(existing)}.`);
  }

  // Orders mean somebody actually used this database. Locally that is just a
  // developer clicking through the app, so it is a warning rather than a
  // refusal — but it is said out loud, because it is also exactly what a
  // real deployment looks like.
  if (hasRealActivity(existing) && process.env.SEED_CONFIRM_WIPE !== verdict.database) {
    console.warn(
      `
  Warning: this database contains ${orders} order(s). If that is real customer activity,
` +
        `  stop now (Ctrl+C). Nothing here is recoverable.
`,
    );
  }
}

async function resetDatabase() {
  // Delete in FK-safe (child-to-parent) order so this is safe to re-run
  // against a dev DB that may already have data (including rows created by
  // manually clicking through the app, not just prior seed runs).
  await prisma.review.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.shipment.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.order.deleteMany();
  await prisma.cartRemovalNotice.deleteMany();
  await prisma.cartItem.deleteMany();
  await prisma.cart.deleteMany();
  await prisma.productImage.deleteMany();
  await prisma.product.deleteMany();
  await prisma.address.deleteMany();
  await prisma.sellerPaymentMethod.deleteMany();
  await prisma.seller.deleteMany();
  await prisma.category.deleteMany();
  await prisma.user.deleteMany();
}

async function main() {
  await assertSafeToWipe();
  await resetDatabase();

  // Hash once and reuse for every seeded account — bcrypt is intentionally
  // slow, and hashing it 500+ times individually would make the seed take
  // minutes instead of seconds. Fine for demo data; never do this for real
  // user-facing password resets.
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  // --- Categories ---------------------------------------------------------
  const categoryRows = CATEGORIES.map((c) => ({
    id: randomUUID(),
    name: c.name,
    slug: slugify(c.name),
  }));
  await prisma.category.createMany({ data: categoryRows });

  // --- Admin + demo customers ---------------------------------------------
  const adminId = randomUUID();
  const customerIds = Array.from({ length: CUSTOMER_COUNT }, () => randomUUID());

  await prisma.user.createMany({
    data: [
      { id: adminId, email: DEMO_ADMIN_EMAIL, passwordHash, role: "admin" },
      // The first customer gets a fixed address so the README can document a
      // login that actually works; the rest are random.
      ...customerIds.map((id, i) => ({
        id,
        email: i === 0 ? DEMO_CUSTOMER_EMAIL : `customer-${id}@example.test`,
        passwordHash,
        role: "customer" as const,
      })),
    ],
  });

  // --- Sellers (each backed by a user, round-robin assigned one "home"
  // category so their storefront page reads as a coherent shop rather than
  // a random grab-bag of unrelated products) -------------------------------
  const sellerUserIds = Array.from({ length: SELLER_COUNT }, () => randomUUID());
  await prisma.user.createMany({
    data: sellerUserIds.map((id, i) => ({
      id,
      // Likewise: seller[0] is the documented demo storefront account.
      email: i === 0 ? DEMO_SELLER_EMAIL : `seller-${id}@example.test`,
      passwordHash,
      role: "seller" as const,
    })),
  });

  const sellerSlugs = new Set<string>();
  const sellersByCategory: string[][] = CATEGORIES.map(() => []);

  const sellerRows = sellerUserIds.map((userId, i) => {
    const sellerId = randomUUID();
    const businessName = `${faker.company.name()} ${faker.helpers.arrayElement(["Co", "Store", "Goods", "Market", "Supply"])}`;
    const categoryIndex = i % CATEGORIES.length;
    sellersByCategory[categoryIndex].push(sellerId);

    return {
      id: sellerId,
      userId,
      applicantName: faker.person.fullName(),
      nationalIdMasked: faker.string.numeric(4), // demo-only: last-4 simulation, see PLAN.md security note
      businessName,
      slug: uniqueSlug(businessName, sellerSlugs),
      description: faker.company.catchPhrase(),
      addressLine1: faker.location.streetAddress(),
      city: faker.location.city(),
      postalCode: faker.location.zipCode(),
      country: faker.location.country(),
      status: "approved" as const,
    };
  });
  await prisma.seller.createMany({ data: sellerRows });

  // --- Seller payment methods ---------------------------------------------
  // Every store gets bank details, because a store with no way to receive
  // money cannot take an order. Mock account numbers against real Napas bank
  // BINs, so the QR a buyer scans resolves to a real bank.
  await prisma.sellerPaymentMethod.createMany({
    data: sellerRows.map((seller) => ({
      id: randomUUID(),
      sellerId: seller.id,
      ...generateDemoPaymentMethod(seller.businessName),
    })),
  });

  // --- Products (100 per category, seller picked from that category's pool) ---
  const productSlugs = new Set<string>();
  const productRows: {
    id: string;
    sellerId: string;
    categoryId: string;
    name: string;
    slug: string;
    description: string;
    priceCents: number;
    stockQty: number;
  }[] = [];

  CATEGORIES.forEach((category, categoryIndex) => {
    const categoryId = categoryRows[categoryIndex].id;
    const sellerPool = sellersByCategory[categoryIndex];

    for (let i = 0; i < PRODUCTS_PER_CATEGORY; i++) {
      // A guaranteed purchasable listing owned by the documented demo seller
      // keeps the README walkthrough independent of random seller assignment.
      const demoProduct = categoryIndex === 0 && i === 0;
      const noun = faker.helpers.arrayElement(category.nouns);
      const name = demoProduct ? "Demo Wireless Headphones" : `${faker.commerce.productAdjective()} ${faker.commerce.productMaterial()} ${noun}`;
      productRows.push({
        id: randomUUID(),
        sellerId: demoProduct ? sellerRows[0].id : faker.helpers.arrayElement(sellerPool),
        categoryId,
        name,
        slug: uniqueSlug(name, productSlugs),
        description: demoProduct ? "Fictional headphones for the local customer and seller walkthrough." : faker.commerce.productDescription(),
        priceCents: demoProduct ? 4999 : faker.number.int({ min: 999, max: 29999 }),
        stockQty: demoProduct ? 10 : faker.number.int({ min: 0, max: 200 }),
      });
    }
  });
  // A slice of the catalog is seller-confirmed out of stock, so the demo has
  // the state visible without anyone having to click through the dashboard
  // first. Note this is independent of stockQty: some of these still have
  // units on hand, which is exactly the distinction the cart relies on.
  const outOfStockIds = new Set(
    faker.helpers.arrayElements(productRows.slice(1), Math.floor(productRows.length * 0.04)).map((p) => p.id),
  );

  await prisma.product.createMany({
    data: productRows.map((p) => ({
      ...p,
      status: outOfStockIds.has(p.id) ? ("out_of_stock" as const) : ("active" as const),
      outOfStockAt: outOfStockIds.has(p.id) ? faker.date.recent({ days: 30 }) : null,
    })),
  });

  // --- Product images (one per product; deterministic per slug so re-runs
  // produce stable images without hosting real files) ----------------------
  const imageRows = productRows.map((p) => ({
    id: randomUUID(),
    productId: p.id,
    url: `https://picsum.photos/seed/${p.slug}/640/480`,
    sortOrder: 0,
  }));
  await prisma.productImage.createMany({ data: imageRows });

  // --- Reviews (0-6 per product, rating skewed positive, from the demo
  // customer pool) ----------------------------------------------------------
  const reviewRows = productRows.flatMap((p) => {
    const count = faker.number.int({ min: 0, max: 6 });
    // arrayElements (plural) samples *without* replacement, so no product
    // ever gets two reviews from the same customer — reviews has a unique
    // (product_id, user_id) constraint that arrayElement would violate.
    return faker.helpers.arrayElements(customerIds, count).map((userId) => ({
      id: randomUUID(),
      productId: p.id,
      userId,
      rating: faker.helpers.weightedArrayElement([
        { value: 5, weight: 4 },
        { value: 4, weight: 3 },
        { value: 3, weight: 1.5 },
        { value: 2, weight: 1 },
        { value: 1, weight: 0.5 },
      ]),
      comment: faker.lorem.sentence({ min: 6, max: 18 }),
    }));
  });
  await prisma.review.createMany({ data: reviewRows });

  console.log(`Seeded: ${categoryRows.length} categories, ${sellerRows.length} sellers (each with bank details), ${productRows.length} products (${outOfStockIds.size} marked out of stock), ${imageRows.length} images, ${reviewRows.length} reviews, ${customerIds.length + 1} buyer/admin accounts.`);
  console.log(`Demo login password for every seeded account: ${DEMO_PASSWORD}`);
  console.log(`Demo accounts: ${DEMO_ADMIN_EMAIL} (admin), ${DEMO_SELLER_EMAIL} (seller), ${DEMO_CUSTOMER_EMAIL} (customer).`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
