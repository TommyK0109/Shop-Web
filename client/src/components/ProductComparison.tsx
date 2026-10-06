import { Link } from "react-router-dom";
import type { ProductSpecifications, RagProduct } from "@storefront/shared";
import { formatPrice } from "../lib/format";
import { specificationLabels, specificationValue } from "../lib/productSpecifications";

export function ProductComparison({ products }: { products: RagProduct[] }) {
  if (products.length < 2) return null;
  const keys = Array.from(new Set(products.flatMap((product) => Object.keys(product.specifications ?? {})))) as (keyof ProductSpecifications)[];
  return <div className="overflow-x-auto rounded border border-gray-200 bg-white">
    <table className="w-full text-left text-sm"><caption className="p-3 text-left font-semibold">Listing comparison</caption>
      <thead><tr><th scope="col" className="p-3">Documented detail</th>{products.map((product) => <th key={product.id} scope="col" className="min-w-40 p-3"><Link className="text-link hover:underline" to={`/products/${product.slug}`}>{product.name}</Link></th>)}</tr></thead>
      <tbody>
        <tr className="border-t"><th scope="row" className="p-3 font-medium">Price</th>{products.map((product) => <td key={product.id} className="p-3">{formatPrice(product.priceCents)}</td>)}</tr>
        <tr className="border-t"><th scope="row" className="p-3 font-medium">Availability</th>{products.map((product) => <td key={product.id} className="p-3">{product.unavailableReason || product.stockQty < 1 || product.status === "out_of_stock" ? "Out of stock" : "Available"}</td>)}</tr>
        {keys.map((key) => <tr key={key} className="border-t"><th scope="row" className="p-3 font-medium">{specificationLabels[key]}</th>{products.map((product) => <td key={product.id} className="p-3">{specificationValue(product.specifications?.[key])}</td>)}</tr>)}
        {keys.length === 0 && <tr className="border-t"><th scope="row" className="p-3 font-medium">Specifications</th>{products.map((product) => <td key={product.id} className="p-3">Not documented</td>)}</tr>}
      </tbody>
    </table>
  </div>;
}
