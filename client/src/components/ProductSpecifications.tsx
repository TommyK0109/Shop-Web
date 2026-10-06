import { type ProductSpecifications as Specifications, supportsProductSpecifications } from "@storefront/shared";
import { specificationLabels, specificationValue } from "../lib/productSpecifications";

export function ProductSpecifications({ value }: { value: Specifications | null | undefined }) {
  const entries = Object.entries(value ?? {}).filter(([, item]) => item !== undefined && (!Array.isArray(item) || item.length > 0));
  if (!entries.length) return <p className="text-sm text-gray-500">Specifications not documented.</p>;
  return <dl className="divide-y divide-gray-100 text-sm">{entries.map(([key, item]) => (
    <div key={key} className="grid grid-cols-2 gap-4 py-2"><dt className="text-gray-500">{specificationLabels[key as keyof Specifications]}</dt><dd className="text-gray-900">{specificationValue(item)}</dd></div>
  ))}</dl>;
}

export function SpecificationsFields({ value, categorySlug, onChange }: {
  value: Specifications | null | undefined;
  categorySlug: string;
  onChange: (next: Specifications | null) => void;
}) {
  if (!supportsProductSpecifications(categorySlug)) return null;
  const current = value ?? {};
  const inputClass = "mt-1 w-full rounded border border-gray-300 px-2 py-1 text-sm";
  function patch(key: keyof Specifications, next: unknown) {
    const updated = { ...current, [key]: next };
    if (next === undefined) delete updated[key];
    onChange(Object.keys(updated).length ? updated : null);
  }
  return <fieldset className="col-span-full rounded border border-gray-200 p-3">
    <legend className="px-1 text-sm font-medium">Documented specifications (optional)</legend>
    <p className="mb-3 text-xs text-gray-500">Only enter details documented for this listing. Leave unknown values blank.</p>
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <label className="text-xs text-gray-600">Product type<select className={inputClass} value={current.kind ?? ""} onChange={(e) => patch("kind", e.target.value || undefined)}>
        <option value="">Not documented</option><option value="headphones">Headphones</option><option value="webcam">Webcam</option><option value="accessory">Accessory</option>
      </select></label>
      <label className="text-xs text-gray-600">Microphone<select className={inputClass} value={current.microphone === undefined ? "" : String(current.microphone)} onChange={(e) => patch("microphone", e.target.value === "" ? undefined : e.target.value === "true")}>
        <option value="">Not documented</option><option value="true">Yes</option><option value="false">No</option>
      </select></label>
      {(["batteryHours", "weightGrams", "frameRateFps", "cableLengthMeters"] as const).map((key) => <label key={key} className="text-xs text-gray-600">{specificationLabels[key]}<input className={inputClass} type="number" min={key === "batteryHours" ? 0 : 0.01} step={key === "frameRateFps" ? 1 : "any"} value={current[key] ?? ""} onChange={(e) => patch(key, e.target.value === "" ? undefined : Number(e.target.value))} /></label>)}
      <label className="text-xs text-gray-600">Resolution<input className={inputClass} maxLength={50} value={current.resolution ?? ""} onChange={(e) => patch("resolution", e.target.value || undefined)} /></label>
      {([ ["connectivity", ["bluetooth", "usb-a", "usb-c", "3.5mm", "wireless-2.4ghz", "hdmi"]], ["compatibility", ["windows", "macos", "linux", "android", "ios", "chromeos"]] ] as const).map(([key, options]) => <fieldset key={key} className="text-xs text-gray-600"><legend>{specificationLabels[key]}</legend><div className="mt-1 flex flex-wrap gap-3">{options.map((option) => <label key={option} className="flex items-center gap-1"><input type="checkbox" checked={(current[key] as readonly string[] | undefined)?.includes(option) ?? false} onChange={(e) => {
        const next = e.target.checked ? [...(current[key] ?? []), option] : (current[key] ?? []).filter((item) => item !== option);
        patch(key, next.length ? next : undefined);
      }} />{option}</label>)}</div></fieldset>)}
      <label className="text-xs text-gray-600 sm:col-span-2">Documented limitations (one per line)<textarea className={inputClass} rows={2} value={current.limitations?.join("\n") ?? ""} onChange={(e) => patch("limitations", e.target.value ? e.target.value.split("\n") : undefined)} /></label>
    </div>
  </fieldset>;
}
