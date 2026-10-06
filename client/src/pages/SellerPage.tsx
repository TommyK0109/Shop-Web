import { useParams } from "react-router-dom";
import { useSeller } from "../hooks/useSeller";
import { ProductCard } from "../components/ProductCard";

export function SellerPage() {
  const { slug } = useParams<{ slug: string }>();
  const { data, isLoading, isError } = useSeller(slug);

  if (isLoading) return <p className="py-12 text-center text-gray-500">Loading…</p>;
  if (isError || !data) return <p className="py-12 text-center text-red-600">Seller not found.</p>;

  const { seller } = data;

  return (
    <div>
      <div className="rounded bg-white p-6">
        <h1 className="text-2xl font-semibold text-gray-900">{seller.businessName}</h1>
        <p className="mt-1 text-sm text-gray-500">
          {seller.city}, {seller.country}
        </p>
        {seller.description && <p className="mt-4 text-sm text-gray-700">{seller.description}</p>}
      </div>

      <h2 className="mt-8 mb-4 text-lg font-semibold text-gray-900">
        Products ({seller.products.length})
      </h2>

      {seller.products.length === 0 ? (
        <p className="text-sm text-gray-500">This seller hasn't listed any products yet.</p>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {seller.products.map((product) => (
            <ProductCard key={product.id} product={product} showSeller={false} />
          ))}
        </div>
      )}
    </div>
  );
}
