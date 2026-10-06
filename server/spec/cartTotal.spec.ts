import { describe, expect, it } from "vitest";
import { calculateCartTotal } from "../src/lib/cartTotal";

describe("calculateCartTotal", () => {
  it("returns 0 for an empty cart", () => {
    expect(calculateCartTotal([])).toBe(0);
  });

  it("sums quantity times price across items", () => {
    const total = calculateCartTotal([
      { quantity: 2, priceCents: 500 },
      { quantity: 1, priceCents: 999 },
    ]);
    expect(total).toBe(1999);
  });
});
