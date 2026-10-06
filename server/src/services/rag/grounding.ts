import { ragGeneratedAnswerSchema, type RagAnswer, type RagProduct, type RagRequest, type RagSource } from "@storefront/shared";
import { AppError } from "../../middleware/errorHandler.middleware";
import type { GroundedAnswerInput } from "./providers";

export const specificationLabels: Record<string, string> = {
  kind: "Product type", connectivity: "Connectivity", microphone: "Microphone", batteryHours: "Battery life (hours)",
  weightGrams: "Weight (grams)", compatibility: "Compatible operating systems", limitations: "Documented limitations",
  resolution: "Resolution", frameRateFps: "Frame rate (fps)", cableLengthMeters: "Cable length (meters)",
};
export function displayValue(value: unknown): string {
  if (value === undefined || value === null) return "Not documented";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return Array.isArray(value) ? value.join(", ") : String(value);
}

export function evidenceFor(products: RagProduct[], request: RagRequest): GroundedAnswerInput["evidence"] {
  const terms = new Set(request.query.toLowerCase().match(/[a-z]{3,}/g) ?? []);
  return products.map((product, index) => {
    const facts = Object.entries(product.specifications ?? {}).flatMap(([key, value]) => {
      if (!specificationLabels[key]) return [];
      if (Array.isArray(value)) return value.map((entry) => `Listing specification — ${specificationLabels[key]}: ${displayValue(entry)}.`);
      return [`Listing specification — ${specificationLabels[key]}: ${displayValue(value)}.`];
    });
    // Whole source sentences only: these are excerpts, never fabricated/rewritten specifications.
    const sentences = product.description.match(/[^.!?\n]+[.!?]?/g) ?? [];
    const excerpts = sentences.map((text) => text.trim()).filter((text) => text.length > 0 && text.length <= 400)
      .sort((a, b) => [...terms].filter((term) => b.toLowerCase().includes(term)).length - [...terms].filter((term) => a.toLowerCase().includes(term)).length)
      .slice(0, 6).map((text) => `The listing states: ${text}`);
    const requested = Object.entries({ microphone: /\b(mic|microphone|meetings?|calls?)\b/i, batteryHours: /\bbattery\b/i,
      connectivity: /\b(bluetooth|wireless|connect|usb)\b/i, compatibility: /\b(windows|macos|linux|android|ios|compatible)\b/i,
      weightGrams: /\b(weight|lightweight|grams?)\b/i, resolution: /\b(resolution|1080p|4k|720p)\b/i,
      frameRateFps: /\b(fps|frame rate)\b/i, cableLengthMeters: /\b(cable length|meters?)\b/i,
    }).filter(([, expression]) => expression.test(request.query)).map(([key]) => key);
    const unknowns = requested.filter((key) => product.specifications?.[key as keyof typeof product.specifications] === undefined)
      .map((key) => `${specificationLabels[key]} is not documented in the structured specifications.`);
    for (const topic of ["warranty", "delivery", "returns", "noise cancellation", "noise suppression", "waterproof", "reliability"]) {
      if (request.query.toLowerCase().includes(topic) && !product.description.toLowerCase().includes(topic)) unknowns.push(`${topic[0].toUpperCase() + topic.slice(1)} is not documented in this listing.`);
    }
    if (!product.specifications || !Object.keys(product.specifications).length) unknowns.push("Structured specifications are not documented for this listing.");
    return { sourceId: `p${index + 1}`, productId: product.id, name: product.name, facts: [...facts, ...excerpts].filter((fact) => fact.length <= 500), unknowns: unknowns.slice(0, 8) };
  });
}

/** Membership checks prove each displayed feature sentence came from its cited listing.
 * This constrained extractive answer format deliberately rejects unsupported paraphrases. */
export function validateGroundedAnswer(raw: unknown, evidence: GroundedAnswerInput["evidence"]) {
  const parsed = ragGeneratedAnswerSchema.safeParse(raw);
  const invalid = () => { throw new AppError(502, "The assistant could not produce a supported answer. Please try again."); };
  if (!parsed.success) return invalid();
  const value = parsed.data;
  if (value.intro !== "" || value.comparison.length !== 0) return invalid();
  if (new Set(value.recommendations.map((entry) => entry.productId)).size !== value.recommendations.length) return invalid();
  if (value.status === "answered" && !value.recommendations.length) return invalid();
  if (value.status === "clarification_needed" && !value.followUpQuestion) return invalid();
  if (value.status !== "clarification_needed" && value.followUpQuestion !== null) return invalid();
  if (value.status !== "answered" && value.recommendations.length) return invalid();
  if (value.followUpQuestion && /\b(password|api key|bank|email|address|credit card|ignore|instruction)\b/i.test(value.followUpQuestion)) return invalid();
  for (const recommendation of value.recommendations) {
    const source = evidence.find((item) => item.productId === recommendation.productId);
    if (!source || (!recommendation.reasons.length && !recommendation.unknowns.length)) return invalid();
    for (const reason of recommendation.reasons) {
      if (reason.sourceIds.length !== 1 || reason.sourceIds[0] !== source.sourceId || !source.facts.includes(reason.text)) return invalid();
    }
    if (recommendation.unknowns.some((unknown) => !source.unknowns.includes(unknown))) return invalid();
  }
  return value;
}

export function comparisonFor(products: RagProduct[], sources: RagSource[]): RagAnswer["comparison"] {
  const keys = ["price", "availability", ...Object.keys(specificationLabels).filter((key) => key !== "kind")];
  return keys.map((key) => ({ attribute: key === "price" ? "Price (USD)" : key === "availability" ? "Availability" : specificationLabels[key],
    values: products.map((product) => ({ productId: product.id,
      value: (key === "price" ? `$${(product.priceCents / 100).toFixed(2)}` : key === "availability" ? product.unavailableReason ? "Currently unavailable to purchase" : "Available to purchase" : displayValue(product.specifications?.[key as keyof typeof product.specifications])).slice(0, 300),
      sourceIds: [sources.find((source) => source.productId === product.id)!.id] })) }));
}
