import type { ProductSpecifications } from "@storefront/shared";

export const specificationLabels: Record<keyof ProductSpecifications, string> = {
  kind: "Product type", connectivity: "Connectivity", microphone: "Microphone", batteryHours: "Battery life (hours)",
  weightGrams: "Weight (g)", compatibility: "Compatible systems", limitations: "Documented limitations",
  resolution: "Resolution", frameRateFps: "Frame rate (fps)", cableLengthMeters: "Cable length (m)",
};

export function specificationValue(value: unknown): string {
  if (value === undefined || value === null || (Array.isArray(value) && value.length === 0)) return "Not documented";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (Array.isArray(value)) return value.join(", ");
  return String(value);
}
