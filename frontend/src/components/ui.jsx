import { Star } from 'lucide-react'

// ── Star Rating Component ───────────────────────────────────
export function StarRating({ rating = 0, count, size = 14, showCount = true }) {
  const stars = Array.from({ length: 5 }, (_, i) => {
    const filled = i + 1 <= Math.floor(rating)
    const half   = !filled && i < rating
    return { filled, half }
  })

  return (
    <span className="stars" title={`${rating} out of 5 stars`}>
      {stars.map((s, i) => (
        <svg key={i} width={size} height={size} viewBox="0 0 24 24" className="star" style={{ color: s.filled || s.half ? 'var(--color-star)' : 'var(--color-star-empty)' }}>
          <defs>
            {s.half && <linearGradient id={`half-${i}`}><stop offset="50%" stopColor="var(--color-star)" /><stop offset="50%" stopColor="var(--color-star-empty)" /></linearGradient>}
          </defs>
          <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26" fill={s.half ? `url(#half-${i})` : 'currentColor'} />
        </svg>
      ))}
      {showCount && count !== undefined && (
        <span className="rating-count">{Number(count).toLocaleString()}</span>
      )}
    </span>
  )
}

// ── Skeleton Loaders ────────────────────────────────────────
export function ProductCardSkeleton() {
  return (
    <div className="product-card" style={{ cursor: 'default', pointerEvents: 'none' }}>
      <div className="product-card__img-wrap">
        <div className="skeleton" style={{ width: '100%', height: '100%' }} />
      </div>
      <div className="product-card__body">
        <div className="skeleton skeleton-text" style={{ width: '90%' }} />
        <div className="skeleton skeleton-text" style={{ width: '60%' }} />
        <div className="skeleton skeleton-text-sm" style={{ width: '40%', marginTop: 4 }} />
        <div className="skeleton" style={{ height: 32, borderRadius: 4, marginTop: 8 }} />
      </div>
    </div>
  )
}

// ── Spinner ─────────────────────────────────────────────────
export function Spinner({ size = 24, color = 'var(--color-primary)' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className="animate-spin" style={{ color }}>
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.25" />
      <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}

// ── Toast Notification ───────────────────────────────────────
import { useToastStore } from '../stores/index.js'
import { CheckCircle2, XCircle, AlertCircle, Info } from 'lucide-react'

export function ToastContainer() {
  const toasts = useToastStore(s => s.toasts)
  const remove = useToastStore(s => s.remove)

  const icons = {
    success: <CheckCircle2 size={18} />,
    error:   <XCircle size={18} />,
    warning: <AlertCircle size={18} />,
    default: <Info size={18} />,
  }

  return (
    <div className="toast-container">
      {toasts.map(t => (
        <div key={t.id} className={`toast ${t.type}`} onClick={() => remove(t.id)}>
          {icons[t.type] || icons.default}
          <span>{t.message}</span>
        </div>
      ))}
    </div>
  )
}

// ── Badge Helper ─────────────────────────────────────────────
export function Badge({ type, text }) {
  if (!text) return null
  const cls = type === 'deal' ? 'badge-deal' : type === 'top' ? 'badge-top' : type === 'new' ? 'badge-new' : 'badge-deal'
  return <span className={`badge ${cls}`}>{text}</span>
}

// ── Status Pill ──────────────────────────────────────────────
export function StatusPill({ status }) {
  const map = {
    ACTIVE: 'active', PENDING: 'pending', SUSPENDED: 'suspended', BANNED: 'banned',
    APPROVED: 'approved', REJECTED: 'rejected',
    Delivered: 'delivered', Shipped: 'shipped', Cancelled: 'cancelled',
    Preparing: 'preparing', Confirmed: 'confirmed',
    PAID: 'active', FAILED: 'banned', REFUNDED: 'suspended',
  }
  return <span className={`status-pill status-${map[status] || 'pending'}`}>{status}</span>
}

// ── Price Display ────────────────────────────────────────────
export function Price({ price, originalPrice, size = 'normal' }) {
  const main = price.toFixed(2)
  const [dollars, cents] = main.split('.')
  const discount = originalPrice ? Math.round((1 - price / originalPrice) * 100) : 0

  return (
    <div className="product-card__price-row">
      <span className="product-card__price" style={size === 'large' ? { fontSize: 28 } : {}}>
        <span className="product-card__price-symbol">$</span>{dollars}<span style={{ fontSize: '0.7em' }}>.{cents}</span>
      </span>
      {originalPrice && (
        <>
          <span className="product-card__original-price">${originalPrice.toFixed(2)}</span>
          <span className="product-card__discount">-{discount}%</span>
        </>
      )}
    </div>
  )
}

// ── Empty State ──────────────────────────────────────────────
export function EmptyState({ icon = '📦', title, text, action }) {
  return (
    <div className="empty-state">
      <div className="empty-state__icon">{icon}</div>
      <h3 className="empty-state__title">{title}</h3>
      {text && <p className="empty-state__text">{text}</p>}
      {action && <div style={{ marginTop: 'var(--sp-4)' }}>{action}</div>}
    </div>
  )
}

// ── Breadcrumb ───────────────────────────────────────────────
import { useNavigate } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'

export function Breadcrumb({ items }) {
  const navigate = useNavigate()
  return (
    <nav className="breadcrumb" aria-label="Breadcrumb">
      {items.map((item, i) => (
        <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-1)' }}>
          {i > 0 && <ChevronRight size={12} className="breadcrumb__sep" />}
          {item.href
            ? <span className="breadcrumb__item" onClick={() => navigate(item.href)}>{item.label}</span>
            : <span className="breadcrumb__current">{item.label}</span>
          }
        </span>
      ))}
    </nav>
  )
}

// ── Pagination ───────────────────────────────────────────────
import { ChevronLeft } from 'lucide-react'

export function Pagination({ page, totalPages, onPage }) {
  const pages = Array.from({ length: totalPages }, (_, i) => i + 1)
    .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 2)

  return (
    <div className="pagination">
      <button className="page-btn" disabled={page <= 1} onClick={() => onPage(page - 1)}>
        <ChevronLeft size={16} />
      </button>
      {pages.map((p, i) => (
        <span key={p}>
          {i > 0 && pages[i - 1] !== p - 1 && <span className="page-btn" style={{ border: 'none', cursor: 'default' }}>…</span>}
          <button className={`page-btn ${p === page ? 'active' : ''}`} onClick={() => onPage(p)}>{p}</button>
        </span>
      ))}
      <button className="page-btn" disabled={page >= totalPages} onClick={() => onPage(page + 1)}>
        <ChevronRight size={16} />
      </button>
    </div>
  )
}

// ── Quantity Control ─────────────────────────────────────────
import { Minus, Plus } from 'lucide-react'

export function QtyControl({ qty, min = 1, max = 99, onChange }) {
  return (
    <div className="qty-control">
      <button className="qty-btn" onClick={() => onChange(qty - 1)} disabled={qty <= min}><Minus size={14} /></button>
      <span className="qty-val">{qty}</span>
      <button className="qty-btn" onClick={() => onChange(qty + 1)} disabled={qty >= max}><Plus size={14} /></button>
    </div>
  )
}

// ── Category Icon Component ─────────────────────────────────
import { Laptop, Shirt, Home as HomeIcon, Trophy, BookOpen, Sparkles, Gamepad2, Car } from 'lucide-react'

export function CategoryIcon({ slug, size = 20, ...props }) {
  const iconMap = {
    electronics: Laptop,
    fashion:     Shirt,
    home:        HomeIcon,
    sports:      Trophy,
    books:       BookOpen,
    beauty:      Sparkles,
    toys:        Gamepad2,
    automotive:  Car,
  }

  const IconComponent = iconMap[slug] || Sparkles
  return <IconComponent size={size} {...props} />
}

