import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Heart, ShoppingCart } from 'lucide-react'
import { StarRating, Badge, Price } from './ui.jsx'
import { useCartStore, useWishlistStore, useToastStore } from '../stores/index.js'

export default function ProductCard({ product }) {
  const navigate = useNavigate()
  const addItem      = useCartStore(s => s.addItem)
  const toggle       = useWishlistStore(s => s.toggle)
  const isWishlisted = useWishlistStore(s => s.isWishlisted(product.id))
  const showToast    = useToastStore(s => s.show)
  const [adding, setAdding] = useState(false)

  const handleAddToCart = (e) => {
    e.stopPropagation()
    setAdding(true)
    addItem(product)
    showToast(`Added "${product.title.slice(0, 30)}…" to cart`, 'success')
    setTimeout(() => setAdding(false), 600)
  }

  const handleWishlist = (e) => {
    e.stopPropagation()
    toggle(product)
    showToast(isWishlisted ? 'Removed from wishlist' : 'Added to wishlist ♥')
  }

  const discount = product.originalPrice
    ? Math.round((1 - product.price / product.originalPrice) * 100)
    : 0

  return (
    <article
      className="product-card"
      onClick={() => navigate(`/product/${product.id}`)}
      aria-label={product.title}
    >
      {/* Image */}
      <div className="product-card__img-wrap">
        {(product.badge || product.isNew) && (
          <div className="product-card__badge">
            {product.badge && <Badge type={product.badge} text={product.isNew ? 'NEW' : product.badgeText || product.badge.toUpperCase()} />}
            {product.isNew && !product.badge && <Badge type="new" text="NEW" />}
          </div>
        )}
        <button
          className={`product-card__wishlist ${isWishlisted ? 'active' : ''}`}
          onClick={handleWishlist}
          aria-label={isWishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
        >
          <Heart size={16} fill={isWishlisted ? 'var(--color-danger)' : 'none'} />
        </button>
        <img
          className="product-card__img"
          src={product.images?.[0] || 'https://via.placeholder.com/400'}
          alt={product.title}
          loading="lazy"
        />
      </div>

      {/* Body */}
      <div className="product-card__body">
        <p className="product-card__title">{product.title}</p>

        <div className="product-card__rating">
          <StarRating rating={product.rating} count={product.reviewCount} size={13} />
        </div>

        <Price price={product.price} originalPrice={product.originalPrice} />

        {product.stock < 10 && product.stock > 0 && (
          <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-danger)' }}>
            Only {product.stock} left in stock!
          </p>
        )}

        <p className="product-card__delivery">
          Get it <strong>tomorrow</strong> — order in 8 hrs
        </p>

        <div className="product-card__add-btn">
          <button
            className={`btn btn-primary btn-full btn-sm ${adding ? 'animate-pulse' : ''}`}
            onClick={handleAddToCart}
            id={`add-to-cart-${product.id}`}
          >
            <ShoppingCart size={14} />
            {adding ? 'Adding…' : 'Add to Cart'}
          </button>
        </div>
      </div>
    </article>
  )
}
