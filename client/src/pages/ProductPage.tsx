import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useProduct } from "../hooks/useProduct";
import { formatPrice } from "../lib/format";
import { StarRating } from "../components/StarRating";
import { ReviewForm } from "../components/ReviewForm";
import { useAddToCart } from "../hooks/useCart";
import { useAuth } from "../hooks/useAuth";
import { useUiStore } from "../store/uiStore";
import { useRagCapabilities } from "../hooks/useRag";
import { ProductSpecifications } from "../components/ProductSpecifications";

export function ProductPage() {
  const { data: ragCapabilities } = useRagCapabilities();
  const { slug } = useParams<{ slug: string }>();
  const { data, isLoading, isError } = useProduct(slug);
  const [activeImage, setActiveImage] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const addToCart = useAddToCart();
  const openCart = useUiStore((s) => s.openCart);

  if (isLoading) return <p className="py-12 text-center text-gray-500">Loading…</p>;
  if (isError || !data) return <p className="py-12 text-center text-red-600">Product not found.</p>;

  const { product } = data;
  const images = product.images;
  const avgRating = product.reviews.length
    ? Math.round(product.reviews.reduce((sum, r) => sum + r.rating, 0) / product.reviews.length)
    : 0;

  return (
    <div>
      <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
        <div>
          <div className="flex h-96 items-center justify-center rounded bg-white p-4">
            {images[activeImage] ? (
              <img
                src={images[activeImage].url}
                alt={product.name}
                className="max-h-full max-w-full object-contain"
              />
            ) : (
              <span className="text-gray-400">No image</span>
            )}
          </div>
          {images.length > 1 && (
            <div className="mt-2 flex gap-2">
              {images.map((image, i) => (
                <button
                  key={image.id}
                  type="button"
                  onClick={() => setActiveImage(i)}
                  className={`h-16 w-16 overflow-hidden rounded border ${
                    i === activeImage ? "border-ink" : "border-gray-200"
                  }`}
                >
                  <img src={image.url} alt="" className="h-full w-full object-contain" />
                </button>
              ))}
            </div>
          )}
        </div>

        <div>
          <h1 className="text-2xl font-semibold text-gray-900">{product.name}</h1>

          <div className="mt-2 flex items-center gap-2 text-sm">
            <StarRating rating={avgRating} />
            <span className="text-gray-500">({product.reviews.length} reviews)</span>
          </div>

          <p className="mt-4 text-3xl font-bold text-gray-900">{formatPrice(product.priceCents)}</p>

          <p className="mt-1 text-sm text-gray-600">
            {product.stockQty > 0 ? `${product.stockQty} in stock` : "Out of stock"}
          </p>

          {product.stockQty > 0 && (
            <div className="mt-4 flex items-center gap-3">
              <select
                aria-label="Quantity"
                value={quantity}
                onChange={(e) => setQuantity(Number(e.target.value))}
                className="rounded border border-gray-300 px-2 py-2 text-sm"
              >
                {Array.from({ length: Math.min(product.stockQty, 10) }, (_, i) => i + 1).map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
              <button
                type="button"
                disabled={addToCart.isPending}
                onClick={() => {
                  if (!isAuthenticated) {
                    navigate("/login", { state: { from: { pathname: `/products/${product.slug}` } } });
                    return;
                  }
                  addToCart.mutate(
                    { productId: product.id, quantity },
                    { onSuccess: openCart },
                  );
                }}
                className="rounded bg-accent px-6 py-2 text-sm font-medium text-ink hover:bg-accent-dark disabled:opacity-60"
              >
                {addToCart.isPending ? "Adding…" : "Add to cart"}
              </button>
            </div>
          )}

          <p className="mt-4 text-sm text-gray-500">
            Sold by{" "}
            <Link to={`/sellers/${product.seller.slug}`} className="text-link hover:underline">
              {product.seller.businessName}
            </Link>
          </p>

          <p className="mt-6 whitespace-pre-line text-sm text-gray-700">{product.description}</p>
          <section className="mt-6"><h2 className="mb-2 font-semibold text-gray-900">Listing specifications</h2><ProductSpecifications value={product.specifications} /></section>
          {ragCapabilities?.enabled && <Link to={`/assistant?productId=${encodeURIComponent(product.id)}`} className="mt-4 inline-block text-sm text-link underline">Ask about this product</Link>}
        </div>
      </div>

      <section className="mt-10 grid grid-cols-1 gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">
            Reviews {product.reviews.length > 0 && <span className="text-gray-400">({product.reviews.length})</span>}
          </h2>
          {product.reviews.length === 0 ? (
            <p className="text-sm text-gray-500">No reviews yet.</p>
          ) : (
            <ul className="space-y-4">
              {product.reviews.map((review) => (
                <li key={review.id} className="rounded bg-white p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <StarRating rating={review.rating} />
                    <span className="text-xs text-gray-500">{review.user.email}</span>
                    <span className="text-xs text-gray-400">
                      {new Date(review.createdAt).toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                  </div>
                  {review.comment && <p className="mt-2 text-sm text-gray-700">{review.comment}</p>}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <ReviewForm productId={product.id} productSlug={product.slug} reviews={product.reviews} />
        </div>
      </section>
    </div>
  );
}
