import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Zap, TrendingUp, Sparkles } from 'lucide-react'
import ProductCard from '../components/ProductCard.jsx'
import { ProductCardSkeleton, CategoryIcon } from '../components/ui.jsx'
import { CATEGORIES, BANNER_SLIDES, PRODUCTS, getRecommended, getTrending, getDeals } from '../data/mockData.js'
import { useAuthStore } from '../stores/index.js'

// ── Hero Banner Carousel ─────────────────────────────────────
function HeroBanner() {
  const [active, setActive] = useState(0)
  const total = BANNER_SLIDES.length

  const next = useCallback(() => setActive(a => (a + 1) % total), [total])
  const prev = () => setActive(a => (a - 1 + total) % total)

  useEffect(() => { const t = setInterval(next, 5000); return () => clearInterval(t) }, [next])

  return (
    <div className="hero-banner" style={{ minHeight: 340 }} aria-label="Promotional banners">
      {BANNER_SLIDES.map((slide, i) => (
        <div
          key={slide.id}
          className={`hero-banner__slide ${i === active ? 'active' : ''}`}
          style={{ background: slide.bg }}
        >
          <div className="hero-banner__overlay" />
          <div className="hero-banner__content">
            <p className="hero-banner__tag" style={{ color: slide.accent }}>{slide.tag}</p>
            <h1 className="hero-banner__title">{slide.title}</h1>
            <p className="hero-banner__subtitle">{slide.subtitle}</p>
            <Link to={slide.ctaLink} className="btn btn-primary btn-lg">
              {slide.cta} →
            </Link>
          </div>
        </div>
      ))}

      <button className="hero-banner__nav hero-banner__nav--prev" onClick={prev} aria-label="Previous slide">
        <ChevronLeft size={20} />
      </button>
      <button className="hero-banner__nav hero-banner__nav--next" onClick={next} aria-label="Next slide">
        <ChevronRight size={20} />
      </button>

      <div className="hero-banner__dots">
        {BANNER_SLIDES.map((_, i) => (
          <button key={i} className={`hero-dot ${i === active ? 'active' : ''}`} onClick={() => setActive(i)} aria-label={`Go to slide ${i + 1}`} />
        ))}
      </div>
    </div>
  )
}

// ── Category Showcase ────────────────────────────────────────
function CategoryShowcase() {
  return (
    <section className="widget" aria-labelledby="categories-title">
      <h2 className="widget-title" id="categories-title">
        Shop by Category
        <Link to="/search">See all →</Link>
      </h2>
      <div className="category-grid">
        {CATEGORIES.map(cat => (
          <Link key={cat.id} to={`/category/${cat.slug}`} className="category-card" aria-label={`Browse ${cat.name}`}>
            <div className="category-card__icon" style={{ background: cat.bg, color: cat.color }}>
              <CategoryIcon slug={cat.slug} size={24} />
            </div>
            <span className="category-card__name">{cat.name}</span>
          </Link>
        ))}
      </div>
    </section>
  )
}

// ── Product Section (horizontal scroll) ─────────────────────
function ProductSection({ title, icon, products, linkTo, loading = false, id }) {
  return (
    <section className="widget" aria-labelledby={id}>
      <h2 className="widget-title" id={id}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {icon} {title}
        </span>
        <Link to={linkTo || '/search'}>See all →</Link>
      </h2>
      <div className="carousel-scroll">
        {loading
          ? Array.from({ length: 6 }).map((_, i) => <div key={i} style={{ minWidth: 180 }}><ProductCardSkeleton /></div>)
          : products.map(p => <ProductCard key={p.id} product={p} />)
        }
      </div>
    </section>
  )
}

// ── Recommendation Banner ─────────────────────────────────────
function AIRecommendBanner({ user }) {
  return (
    <div style={{
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      borderRadius: 'var(--radius-md)',
      padding: 'var(--sp-6)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 'var(--sp-4)',
      flexWrap: 'wrap',
      color: '#fff',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)' }}>
        <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Sparkles size={24} />
        </div>
        <div>
          <h3 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 700, marginBottom: 2 }}>
            AI-Powered Recommendations
          </h3>
          <p style={{ fontSize: 'var(--font-size-sm)', opacity: 0.85 }}>
            {user ? `Personalized for ${user.name.split(' ')[0]} based on your browsing` : 'Sign in to unlock personalized recommendations'}
          </p>
        </div>
      </div>
      {!user && (
        <Link to="/login" className="btn" style={{ background: '#fff', color: '#764ba2', fontWeight: 700, flexShrink: 0 }}>
          Sign In to Personalize
        </Link>
      )}
    </div>
  )
}

// ── Quick Stats Bar ──────────────────────────────────────────
function StatsBar() {
  const stats = [
    { icon: '🚚', text: 'Free delivery on orders over $25' },
    { icon: '🔄', text: '30-day free returns' },
    { icon: '🔒', text: 'Secure checkout' },
    { icon: '💬', text: '24/7 customer support' },
  ]
  return (
    <div style={{
      display: 'flex', gap: 'var(--sp-4)', background: 'var(--color-surface)',
      borderRadius: 'var(--radius-md)', padding: 'var(--sp-3) var(--sp-4)',
      flexWrap: 'wrap', justifyContent: 'center',
    }}>
      {stats.map(s => (
        <div key={s.text} style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)', fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
          <span>{s.icon}</span><span>{s.text}</span>
        </div>
      ))}
    </div>
  )
}

// ── Main HomePage ─────────────────────────────────────────────
import { api } from '../services/api.js'

export default function HomePage() {
  const { user } = useAuthStore()
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/products')
      .then(res => {
        // Backend returns search wrapper object with { products, pagination }
        const list = res.data.products || res.data;
        setProducts(list);
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to load products:', err);
        setLoading(false);
      });
  }, [])

  const recommended = products.slice(0, 8)
  const deals       = products.filter(p => Number(p.originalPrice) > Number(p.price)).slice(0, 8)
  const trending    = [...products].sort((a, b) => b.reviewCount - a.reviewCount).slice(0, 8)

  return (
    <main>
      {/* Hero */}
      <div style={{ maxWidth: 'var(--max-width)', margin: '0 auto', padding: '0 var(--sp-4)' }}>
        <div style={{ marginTop: 'var(--sp-4)', display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
          <HeroBanner />
          <StatsBar />
        </div>
      </div>

      {/* Main Content */}
      <div className="container" style={{ marginTop: 'var(--sp-6)', display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
        {/* Categories */}
        <CategoryShowcase />

        {/* AI Banner */}
        <AIRecommendBanner user={user} />

        {/* Personalized Recommendations */}
        <ProductSection
          id="recommended-title"
          title="✨ Recommended For You"
          icon={<Sparkles size={20} style={{ color: '#7c3aed' }} />}
          products={recommended}
          loading={loading}
          linkTo="/recommendations"
        />

        {/* Deals */}
        <ProductSection
          id="deals-title"
          title="🔥 Today's Deals"
          icon={<Zap size={20} style={{ color: 'var(--color-danger)' }} />}
          products={deals}
          loading={loading}
          linkTo="/deals"
        />

        {/* Trending */}
        <ProductSection
          id="trending-title"
          title="📈 Trending Now"
          icon={<TrendingUp size={20} style={{ color: 'var(--color-success)' }} />}
          products={trending}
          loading={loading}
          linkTo="/search?sort=popular"
        />

        {/* Recently Viewed (shown to all) */}
        <ProductSection
          id="recently-viewed-title"
          title="👀 You Might Also Like"
          products={[...PRODUCTS].slice(4, 10)}
          loading={loading}
          linkTo="/search"
        />
      </div>

      {/* Footer */}
      <footer style={{ background: 'var(--color-header)', marginTop: 'var(--sp-12)', color: '#fff' }}>
        <div style={{ background: '#232F3E', padding: 'var(--sp-8) 0' }}>
          <div className="container" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 'var(--sp-6)' }}>
            {[
              { title: 'Get to Know Us', links: ['About Mixi Shop', 'Careers', 'Press', 'Blog'] },
              { title: 'Make Money', links: ['Sell on Mixi Shop', 'Become a Provider', 'Advertise', 'Affiliates'] },
              { title: 'Let Us Help You', links: ['Your Account', 'Returns Centre', 'Order Tracking', 'Help'] },
              { title: 'Mixi Plus', links: ['Membership Benefits', 'Free Shipping', 'Exclusive Deals', 'Digital Content'] },
            ].map(col => (
              <div key={col.title}>
                <h3 style={{ fontSize: 'var(--font-size-sm)', fontWeight: 700, marginBottom: 'var(--sp-3)', color: '#fff' }}>{col.title}</h3>
                {col.links.map(l => (
                  <a key={l} href="#" style={{ display: 'block', fontSize: 'var(--font-size-sm)', color: 'rgba(255,255,255,0.6)', marginBottom: 'var(--sp-2)', textDecoration: 'none' }}
                    onMouseOver={e => e.target.style.color = '#fff'} onMouseOut={e => e.target.style.color = 'rgba(255,255,255,0.6)'}>
                    {l}
                  </a>
                ))}
              </div>
            ))}
          </div>
        </div>
        <div style={{ background: 'var(--color-header)', padding: 'var(--sp-4) 0', textAlign: 'center', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
          <div className="container">
            <div style={{ marginBottom: 'var(--sp-3)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
              <span style={{ fontSize: 'var(--font-size-xl)', fontWeight: 700, color: 'var(--color-primary)' }}>Mixi</span>
              <span style={{ fontSize: 'var(--font-size-xl)', fontWeight: 700, color: '#fff' }}> Shop</span>
            </div>
            <p style={{ fontSize: 'var(--font-size-xs)', color: 'rgba(255,255,255,0.4)' }}>
              © 2026 Mixi Shop. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </main>
  )
}
