import { Link } from "react-router-dom";
import type { RagResponse } from "@storefront/shared";
import { formatPrice } from "../lib/format";
import { ProductComparison } from "./ProductComparison";

export function AssistantAnswer({ response, selectedIds, onToggle, comparison = false }: {
  response: RagResponse; selectedIds: string[]; onToggle: (id: string) => void; comparison?: boolean;
}) {
  function citations(ids: string[]) {
    return ids.map((id) => {
      const source = response.sources.find((item) => item.id === id);
      const product = response.products.find((item) => item.id === source?.productId);
      return product ? <Link key={id} to={`/products/${product.slug}`} className="ml-2 text-link underline" aria-label={`Source: ${product.name}`}>[{id}]</Link> : null;
    });
  }
  return <section aria-label="Assistant response" className="space-y-4">
    {response.status === "search_results" && <p className="text-sm text-gray-600">Search results from current listings. Generated advice is off.</p>}
    {response.status === "insufficient_evidence" && <p className="rounded bg-amber-50 p-3 text-sm text-amber-900">The listings do not provide enough evidence to answer this question.</p>}
    {response.answer?.intro && <p className="whitespace-pre-line text-gray-800">{response.answer.intro}</p>}
    {response.answer?.followUpQuestion && <p className="rounded bg-blue-50 p-3 text-sm text-gray-900">{response.answer.followUpQuestion}</p>}
    {response.products.length === 0 && response.status === "search_results" && <p className="text-sm text-gray-600">No current listings matched these filters.</p>}
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">{response.products.map((product) => {
      const recommendation = response.answer?.recommendations.find((item) => item.productId === product.id);
      const unavailable = product.unavailableReason !== null || product.stockQty < 1 || product.status === "out_of_stock";
      return <article key={product.id} className="rounded border border-gray-200 bg-white p-4 shadow-sm">
        <Link to={`/products/${product.slug}`} className="block text-link hover:underline">
          {product.imageUrl && <img src={product.imageUrl} alt="" className="mb-3 h-32 w-full object-contain" />}
          <h2 className="font-semibold">{product.name}</h2>
        </Link>
        <p className="mt-1 text-lg font-semibold">{formatPrice(product.priceCents)}</p>
        <p className={`text-xs ${unavailable ? "text-amber-800" : "text-gray-500"}`}>{unavailable ? "Out of stock" : "Available"} · {product.seller.businessName}</p>
        {recommendation && <><ul className="mt-3 space-y-2 text-sm text-gray-700">{recommendation.reasons.map((reason, index) => <li key={index}>{reason.text}{citations(reason.sourceIds)}</li>)}</ul>
          {recommendation.unknowns.length > 0 && <div className="mt-3 text-sm text-gray-600"><h3 className="font-medium">Not documented</h3><ul className="mt-1 list-inside list-disc">{recommendation.unknowns.map((unknown, index) => <li key={index}>{unknown}</li>)}</ul></div>}</>}
        <label className="mt-4 flex items-center gap-2 text-sm"><input type="checkbox" checked={selectedIds.includes(product.id)} disabled={!selectedIds.includes(product.id) && selectedIds.length >= 3} onChange={() => onToggle(product.id)} />Compare {product.name}</label>
      </article>;
    })}</div>
    {comparison && <ProductComparison products={response.products} />}
    {response.answer && response.answer.comparison.length > 0 && <ul className="space-y-2 text-sm">{response.answer.comparison.map((row) => <li key={row.attribute}><strong>{row.attribute}:</strong><ul>{row.values.map((value) => <li key={value.productId}>{response.products.find((product) => product.id === value.productId)?.name}: {value.value}{citations(value.sourceIds)}</li>)}</ul></li>)}</ul>}
    {response.sources.length > 0 && <p className="text-xs text-gray-500">Sources are seller listings. Details reflect the catalog when this response was created.</p>}
  </section>;
}
