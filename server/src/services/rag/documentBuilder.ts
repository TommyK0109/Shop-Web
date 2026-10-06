import { createHash } from "node:crypto";

export const CANONICAL_FORMAT_VERSION = "product-v1";
// Conservative byte bound leaves room inside the embedding model's input limit,
// including text whose tokenizer produces one token per UTF-8 byte.
export const MAX_DOCUMENT_BYTES = 8000;

export interface DocumentSource {
  name: string;
  description: string;
  category: { name: string };
  specifications: unknown;
}

function normalize(value: string): string {
  return value.normalize("NFKC").replace(/\s+/gu, " ").trim();
}

function canonicalValue(value: unknown): unknown {
  if (typeof value === "string") return normalize(value);
  if (Array.isArray(value)) return value.map(canonicalValue);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b, "en"))
      .map(([key, entry]) => [key, canonicalValue(entry)]));
  }
  return value;
}

export function buildProductDocument(source: DocumentSource, maxBytes = MAX_DOCUMENT_BYTES): { text: string; contentHash: string } {
  const text = [
    `Product: ${normalize(source.name)}`,
    `Category: ${normalize(source.category.name)}`,
    `Description: ${normalize(source.description)}`,
    `Specifications: ${source.specifications == null ? "Not documented" : JSON.stringify(canonicalValue(source.specifications))}`,
  ].join("\n");
  if (Buffer.byteLength(text, "utf8") > maxBytes) {
    throw new Error("SOURCE_TOO_LARGE");
  }
  return {
    text,
    contentHash: createHash("sha256").update(`${CANONICAL_FORMAT_VERSION}\n${text}`).digest("hex"),
  };
}

export function validateEmbedding(vector: unknown, dimensions: number): asserts vector is number[] {
  if (!Array.isArray(vector) || vector.length !== dimensions ||
      !vector.every((value) => typeof value === "number" && Number.isFinite(value)) ||
      vector.every((value) => value === 0)) {
    throw new Error("INVALID_EMBEDDING");
  }
}
