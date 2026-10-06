import { describe, expect, it } from "vitest";
import { buildProductDocument, validateEmbedding } from "../src/services/rag/documentBuilder";

describe("canonical RAG documents", () => {
  const source = { name: " Meeting  Headset ", description: "Documented\n USB microphone.",
    category: { name: "Electronics" }, specifications: { microphone: true, connectivity: ["usb-c"] } };

  it("normalizes text and specification key order reproducibly", () => {
    const first = buildProductDocument(source);
    const reordered = buildProductDocument({ ...source, name: "Meeting Headset", description: "Documented USB microphone.",
      specifications: { connectivity: ["usb-c"], microphone: true } });
    expect(reordered).toEqual(first);
    expect(first.text).toContain('"connectivity":["usb-c"],"microphone":true');
  });

  it("does not embed mutable commerce fields", () => {
    const live = { ...source, priceCents: 5000, stockQty: 2, status: "active", seller: { status: "approved" } };
    const changed = { ...live, priceCents: 1000, stockQty: 0, status: "out_of_stock" };
    expect(buildProductDocument(live)).toEqual(buildProductDocument(changed));
  });

  it("reports missing specifications and rejects oversized sources without truncation", () => {
    expect(buildProductDocument({ ...source, specifications: null }).text).toContain("Not documented");
    expect(() => buildProductDocument({ ...source, description: "a".repeat(8001) })).toThrow("SOURCE_TOO_LARGE");
  });

  it("rejects malformed, zero, nonfinite and wrong-dimension vectors", () => {
    expect(() => validateEmbedding([1, 0], 2)).not.toThrow();
    for (const vector of [[1], [0, 0], [1, Number.NaN], [1, Number.POSITIVE_INFINITY], ["1", 2]]) {
      expect(() => validateEmbedding(vector, 2)).toThrow("INVALID_EMBEDDING");
    }
  });
});
