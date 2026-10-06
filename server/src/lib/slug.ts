export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

// Appends -2, -3, ... until `exists` reports the candidate is free. Callers
// pass a lookup scoped to whatever's doing the insert (a Prisma client or an
// in-transaction tx), so this works both outside and inside a transaction.
export async function uniqueSlug(base: string, exists: (slug: string) => Promise<boolean>): Promise<string> {
  const root = slugify(base) || "item";
  let candidate = root;
  let attempt = 2;
  while (await exists(candidate)) {
    candidate = `${root}-${attempt++}`;
  }
  return candidate;
}
