import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import type { Product, SellerProductSummary } from "../api/types";
import { formatPrice } from "../lib/format";
import { useAuth } from "../hooks/useAuth";
import { useAddToCart } from "../hooks/useCart";
import { useUiStore } from "../store/uiStore";
import { ApiError } from "../api/client";
import { Icon } from "./Icon";

interface ProductCardProps {
  product: Product | SellerProductSummary;
  showSeller?: boolean;
}

export function ProductCard({ product, showSeller = true }: ProductCardProps) {
  const image = product.images[0]?.url;
  const [failedImage, setFailedImage] = useState<string | undefined>();
  const { isAuthenticated } = useAuth();
  const addToCart = useAddToCart();
  const openCart = useUiStore((s) => s.openCart);
  const navigate = useNavigate();
  const location = useLocation();
  const available = product.status === "active" && product.stockQty > 0;

  function add() {
    if (!isAuthenticated) {
      navigate("/login", { state: { from: location } });
      return;
    }
    addToCart.mutate(
      { productId: product.id, quantity: 1 },
      { onSuccess: openCart },
    );
  }

  return (
    <article className="product-card">
      <Link
        to={`/products/${product.slug}`}
        className="product-image-link"
        aria-label={`View ${product.name}`}
      >
        <div className="product-image">
          {image && failedImage !== image ? (
            <img
              src={image}
              alt={product.name}
              loading="lazy"
              onError={() => setFailedImage(image)}
            />
          ) : (
            <span className="product-placeholder">
              <Icon name="box" width="40" height="40" />
              Product image coming soon
            </span>
          )}
        </div>
      </Link>
      <span className="product-category">{product.category.name}</span>
      <Link to={`/products/${product.slug}`} className="product-name">
        {product.name}
      </Link>
      {showSeller && "seller" in product && (
        <p className="product-seller">
          By{" "}
          <Link to={`/sellers/${product.seller.slug}`}>
            {product.seller.businessName}
          </Link>
        </p>
      )}
      <div className="product-bottom">
        <span className="product-price">{formatPrice(product.priceCents)}</span>
        {available ? (
          <button
            type="button"
            className="quick-add"
            aria-label={`Add ${product.name} to cart`}
            disabled={addToCart.isPending}
            onClick={add}
          >
            <Icon
              name={addToCart.isPending ? "bag" : "plus"}
              width="16"
              height="16"
            />
          </button>
        ) : (
          <span className="product-unavailable">Out of stock</span>
        )}
      </div>
      {addToCart.isError && (
        <p role="alert" className="product-error">
          {addToCart.error instanceof ApiError
            ? addToCart.error.message
            : "Couldn’t add this item. Please try again."}
        </p>
      )}
    </article>
  );
}
