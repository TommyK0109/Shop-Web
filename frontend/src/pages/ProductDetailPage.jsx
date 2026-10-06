import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { Heart, Share2, ChevronLeft, ChevronRight, ShieldCheck, Truck, RotateCcw, Star } from 'lucide-react'
import { getProduct, PRODUCTS, REVIEWS } from '../data/mockData.js'
import { useCartStore, useWishlistStore, useToastStore } from '../stores/index.js'
import { StarRating, Breadcrumb, QtyControl, Price } from '../components/ui.jsx'
import ProductCard from '../components/ProductCard.jsx'

// ── Image Gallery ────────────────────────────────────────────
function Gallery({ images, title }) {
  const [active, setActive] = useState(0)
  const [zoomed, setZoomed] = useState(false)

  return (
    <div className="product-gallery">
      <div className="product-gallery__main" onMouseEnter={() => setZoomed(true)} onMouseLeave={() => setZoomed(false)}>
        <img
          src={images[active]}
          alt={title}
          style={{ transform: zoomed ? 'scale(1.1)' : 'scale(1)', transition: 'transform 0.3s ease', objectFit: 'contain', padding: 24, width: '100%', height: '100%' }}
        />
      </div>
      {images.length > 1 && (
        <div className="product-gallery__thumbs">
          {images.map((img, i) => (
            <div
              key={i}
              className={`product-gallery__thumb ${i === active ? 'active' : ''}`}
              onClick={() => setActive(i)}
            >
              <img src={img} alt={`View ${i + 1}`} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Reviews Section ──────────────────────────────────────────
function ReviewsSection({ product }) {
  const ratingDist = [
    { stars: 5, pct: 68 }, { stars: 4, pct: 18 },
    { stars: 3, pct: 8 },  { stars: 2, pct: 3 }, { stars: 1, pct: 3 },
  ]
  return (
    <div>
      <h2 style={{ fontSize: 'var(--font-size-xl)', fontWeight: 700, marginBottom: 'var(--sp-4)' }}>
        Customer Reviews
      </h2>
      <div className="reviews-summary">
        <div className="reviews-avg">
          <div className="reviews-avg__num">{product.rating}</div>
          <StarRating rating={product.rating} size={18} showCount={false} />
          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginTop: 4 }}>
            {product.reviewCount.toLocaleString()} ratings
          </div>
        </div>
        <div className="reviews-bars">
          {ratingDist.map(r => (
            <div key={r.stars} className="reviews-bar-row">
              <span className="reviews-bar-label">{r.stars} star</span>
              <div className="reviews-bar-track">
                <div className="reviews-bar-fill" style={{ width: `${r.pct}%` }} />
              </div>
              <span className="reviews-bar-pct">{r.pct}%</span>
            </div>
          ))}
        </div>
      </div>
      <div style={{ marginTop: 'var(--sp-6)' }}>
        {REVIEWS.map(r => (
          <div key={r.id} className="review-card">
            <div className="review-card__header">
              <div className="review-card__avatar">{r.author[0]}</div>
              <div>
                <div className="review-card__author">{r.author}</div>
                <div className="review-card__date">{r.date}</div>
              </div>
            </div>
            <StarRating rating={r.rating} size={13} showCount={false} />
            <p className="review-card__title" style={{ marginTop: 4 }}>{r.title}</p>
            <p className="review-card__body">{r.body}</p>
            <div style={{ marginTop: 8, fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
              {r.helpful} people found this helpful
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

import { api } from '../services/api.js'

export default function ProductDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [qty, setQty]       = useState(1)
  const [added, setAdded]   = useState(false)
  const [product, setProduct] = useState(null)
  const [loading, setLoading] = useState(true)
  const [related, setRelated] = useState([])

  const addItem      = useCartStore(s => s.addItem)
  const toggle       = useWishlistStore(s => s.toggle)
  const isWishlisted = useWishlistStore(s => s.isWishlisted(id))
  const showToast    = useToastStore(s => s.show)

  useEffect(() => {
    window.scrollTo(0, 0);
    setLoading(true);
    api.get(`/products/${id}`)
      .then(res => {
        const prod = res.data;
        // Make sure fields like price are parsed as numbers
        prod.price = Number(prod.price);
        if (prod.originalPrice) prod.originalPrice = Number(prod.originalPrice);
        
        // Convert category to structure matching frontend expectations
        if (prod.category && typeof prod.category === 'object') {
          prod.categorySlug = prod.category.slug;
          prod.categoryName = prod.category.name;
        }

        setProduct(prod);
        
        // Fetch related products
        return api.get('/products', { params: { categoryId: prod.categoryId } });
      })
      .then(res => {
        const relatedList = res.data.products || res.data;
        setRelated(relatedList.filter(p => p.id !== id).slice(0, 6));
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  }, [id])

  if (loading) {
    return (
      <div className="container page-content" style={{ textAlign: 'center', paddingTop: 80 }}>
        <h2>Loading product details...</h2>
      </div>
    )
  }

  if (!product) {
    return (
      <div className="container page-content" style={{ textAlign: 'center', paddingTop: 80 }}>
        <h2>Product not found</h2>
        <button className="btn btn-primary" onClick={() => navigate('/')} style={{ marginTop: 16 }}>Back to Home</button>
      </div>
    )
  }

  const handleAddToCart = () => {
    addItem(product, qty)
    setAdded(true)
    showToast('Item added to cart!', 'success')
    setTimeout(() => setAdded(false), 1500)
  }

  const handleBuyNow = () => {
    addItem(product, qty)
    navigate('/cart')
  }

  const discount = product.originalPrice ? Math.round((1 - product.price / product.originalPrice) * 100) : 0

  return (
    <div className="container page-content">
      {/* Breadcrumb */}
      <Breadcrumb items={[
        { label: 'Home', href: '/' },
        { 
          label: typeof product.category === 'object' ? product.category.name : (product.category.charAt(0).toUpperCase() + product.category.slice(1)), 
          href: `/category/${typeof product.category === 'object' ? product.category.slug : product.category}` 
        },
        { label: product.title.slice(0, 40) + '…' },
      ]} />

      {/* Main grid */}
      <div className="product-detail">
        {/* Gallery */}
        <Gallery images={product.images} title={product.title} />

        {/* Info */}
        <div className="product-info">
          <div className="product-info__brand">
            Visit the <span style={{ color: 'var(--color-link)' }}>{product.provider.name}</span> Store
          </div>
          <h1 className="product-info__title">{product.title}</h1>

          <div className="product-info__rating-row">
            <StarRating rating={product.rating} count={product.reviewCount} size={16} />
            <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
              | {product.reviewCount.toLocaleString()} ratings
            </span>
          </div>

          {/* Price */}
          <div className="product-info__price-box">
            {discount > 0 && <div className="product-info__deal-label">🔖 Limited time deal</div>}
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--sp-2)', flexWrap: 'wrap' }}>
              <span style={{ fontSize: 28, fontWeight: 700 }}>
                <span style={{ fontSize: 16, verticalAlign: 'super' }}>$</span>
                {product.price.toFixed(2)}
              </span>
              {product.originalPrice && (
                <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', textDecoration: 'line-through' }}>
                  List: ${product.originalPrice.toFixed(2)}
                </span>
              )}
              {discount > 0 && (
                <span className="badge badge-deal">SAVE {discount}%</span>
              )}
            </div>
          </div>

          {/* Description */}
          <div style={{ marginBottom: 'var(--sp-4)' }}>
            <h3 style={{ fontWeight: 700, marginBottom: 'var(--sp-2)', fontSize: 'var(--font-size-base)' }}>About this item</h3>
            <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', lineHeight: 1.7 }}>{product.description}</p>
          </div>

          {/* Specs */}
          <div style={{ marginBottom: 'var(--sp-4)' }}>
            <h3 style={{ fontWeight: 700, marginBottom: 'var(--sp-2)', fontSize: 'var(--font-size-base)' }}>Technical Details</h3>
            <table className="product-info__spec-table">
              <tbody>
                {Object.entries(product.specs || {}).map(([k, v]) => (
                  <tr key={k}><td>{k}</td><td>{v}</td></tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Tags */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--sp-2)' }}>
            {product.tags.map(tag => (
              <span key={tag} className="chip">#{tag}</span>
            ))}
          </div>
        </div>

        {/* Buy Box */}
        <div className="buy-box">
          <div className="buy-box__price">
            <span style={{ fontSize: 14, verticalAlign: 'super' }}>$</span>
            {product.price.toFixed(2)}
          </div>
          {product.originalPrice && (
            <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginBottom: 8 }}>
              Save <strong style={{ color: 'var(--color-danger)' }}>${(product.originalPrice - product.price).toFixed(2)}</strong> ({discount}%)
            </p>
          )}
          <div className="buy-box__delivery">
            <Truck size={14} style={{ display: 'inline', marginRight: 4 }} />
            <strong>FREE delivery</strong> tomorrow — Order in 6 hrs
          </div>
          <div className={`buy-box__stock ${product.stock === 0 ? 'out' : ''}`}>
            {product.stock > 0 ? 'In Stock' : 'Out of Stock'}
            {product.stock < 10 && product.stock > 0 && ` — Only ${product.stock} left!`}
          </div>

          <div className="buy-box__qty">
            <span className="buy-box__qty-label">Qty:</span>
            <QtyControl qty={qty} min={1} max={Math.min(product.stock, 10)} onChange={setQty} />
          </div>

          <div className="buy-box__actions">
            <button
              id="add-to-cart-detail"
              className="btn btn-primary btn-lg btn-full"
              onClick={handleAddToCart}
              disabled={product.stock === 0}
            >
              {added ? '✓ Added to Cart!' : 'Add to Cart'}
            </button>
            <button
              id="buy-now-btn"
              className="btn btn-buynow btn-lg btn-full"
              onClick={handleBuyNow}
              disabled={product.stock === 0}
            >
              Buy Now
            </button>
            <button
              className="btn btn-secondary btn-full"
              onClick={() => { toggle(product); showToast(isWishlisted ? 'Removed from wishlist' : 'Added to wishlist ♥') }}
            >
              <Heart size={16} fill={isWishlisted ? 'var(--color-danger)' : 'none'} style={{ color: isWishlisted ? 'var(--color-danger)' : 'currentColor' }} />
              {isWishlisted ? 'Remove from Wishlist' : 'Add to Wish List'}
            </button>
          </div>

          <div className="buy-box__provider">
            Sold by <a href="#">{product.provider.name}</a>
          </div>

          {/* Trust badges */}
          <div style={{ marginTop: 'var(--sp-4)', display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>
            {[
              { icon: <ShieldCheck size={14} />, text: 'Secure transaction' },
              { icon: <RotateCcw size={14} />,   text: 'Free returns within 30 days' },
              { icon: <Truck size={14} />,        text: 'Fulfilled by Mixi Shop' },
            ].map(item => (
              <div key={item.text} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                {item.icon} {item.text}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Reviews */}
      <div className="widget" style={{ marginTop: 'var(--sp-6)' }}>
        <ReviewsSection product={product} />
      </div>

      {/* Related Products */}
      {related.length > 0 && (
        <div className="widget" style={{ marginTop: 'var(--sp-4)' }}>
          <h2 className="widget-title">Related Products</h2>
          <div className="carousel-scroll">
            {related.map(p => <ProductCard key={p.id} product={p} />)}
          </div>
        </div>
      )}
    </div>
  )
}
