import { describe, expect, it } from "vitest";
import { centsToPriceInput, formatPrice, parsePriceToCents } from "./format";

describe("formatPrice", () => {
  it("renders integer cents as a currency string", () => {
    expect(formatPrice(1999)).toBe("$19.99");
  });

  it("keeps trailing zeros on a whole-dollar amount", () => {
    expect(formatPrice(2000)).toBe("$20.00");
  });

  it("groups thousands", () => {
    expect(formatPrice(123456789)).toBe("$1,234,567.89");
  });

  it("renders a free item as $0.00 rather than an empty string", () => {
    expect(formatPrice(0)).toBe("$0.00");
  });
});

describe("parsePriceToCents", () => {
  it("converts a decimal amount to integer cents", () => {
    expect(parsePriceToCents("19.99")).toBe(1999);
  });

  it("accepts a whole number with no decimal point", () => {
    expect(parsePriceToCents("20")).toBe(2000);
  });

  it("accepts a single decimal place", () => {
    expect(parsePriceToCents("19.9")).toBe(1990);
  });

  it("ignores surrounding whitespace", () => {
    expect(parsePriceToCents("  5.50  ")).toBe(550);
  });

  // Floating-point multiplication is exactly why prices are stored as cents
  // (PLAN.md §4) — 0.1 * 100 is 10.000000000000002 before rounding.
  it("rounds instead of leaving a floating-point remainder", () => {
    expect(parsePriceToCents("0.10")).toBe(10);
    expect(parsePriceToCents("1.15")).toBe(115);
  });

  it.each(["", "abc", "-5", "19.999", "1,999", "1e3", "$5"])("rejects %o", (input) => {
    expect(parsePriceToCents(input)).toBeNull();
  });
});

describe("centsToPriceInput", () => {
  it("round-trips through parsePriceToCents", () => {
    expect(parsePriceToCents(centsToPriceInput(1999))).toBe(1999);
  });

  it("always shows two decimal places for a form field", () => {
    expect(centsToPriceInput(2000)).toBe("20.00");
    expect(centsToPriceInput(5)).toBe("0.05");
  });
});
