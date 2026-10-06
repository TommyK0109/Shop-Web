export function formatPrice(cents: number): string {
  return (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
}

/**
 * Seller-facing price fields are entered in dollars, but every price crosses
 * the API as integer cents (PLAN.md §4) — this is the only place the two
 * representations meet. Returns null for anything that isn't a clean amount.
 */
export function parsePriceToCents(value: string): number | null {
  const trimmed = value.trim();
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) return null;
  return Math.round(Number(trimmed) * 100);
}

export function centsToPriceInput(cents: number): string {
  return (cents / 100).toFixed(2);
}
