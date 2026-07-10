import { useState } from 'react'
import { Link, NavLink, useNavigate, Outlet } from 'react-router-dom'
import { Package, Heart, MapPin, Settings, ShoppingBag, ChevronRight, Check } from 'lucide-react'
import { useAuthStore, useWishlistStore } from '../stores/index.js'
import { ORDERS, PRODUCTS } from '../data/mockData.js'
import { StatusPill, EmptyState } from '../components/ui.jsx'
import ProductCard from '../components/ProductCard.jsx'

function AccountNav() {
  const sections = [
    { title: 'Shopping', links: [
      { to: '/account/orders', icon: <Package size={15} />, label: 'My Orders' },
      { to: '/account/wishlist', icon: <Heart size={15} />, label: 'Wishlist' },
    ]},
    { title: 'Account', links: [
      { to: '/account/addresses', icon: <MapPin size={15} />, label: 'Addresses' },
      { to: '/account/settings', icon: <Settings size={15} />, label: 'Settings' },
    ]},
  ]
  return (
    <nav className="account-nav" aria-label="Account navigation">
      {sections.map(sec => (
        <div key={sec.title} className="account-nav__section">
          <div className="account-nav__section-title">{sec.title}</div>
          {sec.links.map(link => (
            <NavLink key={link.to} to={link.to} className={({ isActive }) => `account-nav__link ${isActive ? 'active' : ''}`}>
              {link.icon} {link.label}
            </NavLink>
          ))}
        </div>
      ))}
    </nav>
  )
}

export function AccountPage() {
  const { user } = useAuthStore()
  return (
    <div className="container page-content">
      <h1 style={{ marginBottom: 'var(--sp-4)', fontSize: 'var(--font-size-2xl)', fontWeight: 700 }}>
        Your Account
      </h1>
      <div className="account-layout">
        <AccountNav />
        <div>
          {/* Dashboard cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--sp-4)', marginBottom: 'var(--sp-6)' }}>
            {[
              { icon: '📦', label: 'Orders', value: ORDERS.length, to: '/account/orders', color: '#2563eb' },
              { icon: '♥',  label: 'Wishlist', value: '3 items', to: '/account/wishlist', color: '#db2777' },
              { icon: '⭐', label: 'Reviews', value: '7 written', to: '#', color: '#d97706' },
              { icon: '💳', label: 'Payment', value: '2 saved', to: '#', color: '#059669' },
            ].map(card => (
              <Link key={card.label} to={card.to} style={{
                display: 'flex', alignItems: 'center', gap: 'var(--sp-3)',
                background: 'var(--color-surface)', borderRadius: 'var(--radius-md)',
                padding: 'var(--sp-4)', border: '1px solid var(--color-border)',
                textDecoration: 'none', color: 'var(--color-text)',
                transition: 'all 0.2s', boxShadow: 'var(--shadow-xs)',
              }}
              onMouseOver={e => e.currentTarget.style.boxShadow = 'var(--shadow-sm)'}
              onMouseOut={e => e.currentTarget.style.boxShadow = 'var(--shadow-xs)'}
              >
                <div style={{ width: 44, height: 44, borderRadius: 'var(--radius-lg)', background: `${card.color}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>{card.icon}</div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 'var(--font-size-md)' }}>{card.value}</div>
                  <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>{card.label}</div>
                </div>
                <ChevronRight size={16} style={{ marginLeft: 'auto', color: 'var(--color-text-muted)' }} />
              </Link>
            ))}
          </div>

          {/* Recent Orders Preview */}
          <div className="widget">
            <h2 className="widget-title">Recent Orders <Link to="/account/orders">See all →</Link></h2>
            {ORDERS.slice(0, 2).map(order => (
              <div key={order.id} style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)', padding: 'var(--sp-3) 0', borderBottom: '1px solid var(--color-border)' }}>
                <img src={order.items[0]?.images?.[0]} alt="" style={{ width: 50, height: 50, objectFit: 'contain', borderRadius: 'var(--radius-sm)', background: 'var(--color-bg-alt)', padding: 4 }} />
                <div style={{ flex: 1 }}>
                  <p style={{ fontWeight: 600, fontSize: 'var(--font-size-sm)', marginBottom: 2 }}>{order.id}</p>
                  <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>{order.date} · ${order.total.toFixed(2)}</p>
                </div>
                <StatusPill status={order.status} />
                <Link to={`/account/orders/${order.id}`} className="btn btn-secondary btn-sm">Track</Link>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export function OrdersPage() {
  return (
    <div className="container page-content">
      <h1 style={{ marginBottom: 'var(--sp-4)', fontSize: 'var(--font-size-2xl)', fontWeight: 700 }}>Your Orders</h1>
      <div className="account-layout">
        <AccountNav />
        <div>
          {ORDERS.length === 0 ? (
            <EmptyState icon="📦" title="No orders yet" text="When you place an order, it will appear here." action={<Link to="/" className="btn btn-primary">Start Shopping</Link>} />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
              {ORDERS.map(order => (
                <div key={order.id} className="widget" style={{ borderLeft: `4px solid var(--color-primary)` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--sp-3)', marginBottom: 'var(--sp-4)' }}>
                    <div>
                      <div style={{ display: 'flex', gap: 'var(--sp-4)', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginBottom: 4 }}>
                        <span>ORDER PLACED: <strong>{order.date}</strong></span>
                        <span>TOTAL: <strong>${order.total.toFixed(2)}</strong></span>
                        <span>ORDER ID: <strong>{order.id}</strong></span>
                      </div>
                      <StatusPill status={order.status} />
                    </div>
                    <Link to={`/account/orders/${order.id}`} className="btn btn-secondary btn-sm">
                      View Order Details
                    </Link>
                  </div>
                  <div style={{ display: 'flex', gap: 'var(--sp-3)', flexWrap: 'wrap' }}>
                    {order.items.map(item => (
                      <div key={item.id} style={{ display: 'flex', gap: 'var(--sp-3)', alignItems: 'center' }}>
                        <img src={item.images?.[0]} alt={item.title} style={{ width: 60, height: 60, objectFit: 'contain', background: 'var(--color-bg-alt)', borderRadius: 'var(--radius-sm)', padding: 4 }} />
                        <div>
                          <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-link-dark)', maxWidth: 220 }}>{item.title.slice(0, 50)}…</p>
                          <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>${item.price.toFixed(2)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export function OrderDetailPage() {
  const navigate = useNavigate()
  const order = ORDERS[0] // For demo, always show first order

  return (
    <div className="container page-content">
      <div className="account-layout">
        <AccountNav />
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--sp-4)' }}>
            <h1 style={{ fontSize: 'var(--font-size-xl)', fontWeight: 700 }}>Order {order.id}</h1>
            <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>Placed: {order.date}</span>
          </div>

          {/* Timeline */}
          <div className="widget" style={{ marginBottom: 'var(--sp-4)' }}>
            <h2 className="widget-title">Tracking</h2>
            <div className="order-timeline">
              {order.timeline.map((step, i) => (
                <div key={i} className={`order-timeline__step ${step.done ? 'done' : ''} ${i === order.timeline.filter(s => s.done).length - 1 && step.done ? 'current' : ''}`}>
                  <div className="order-timeline__dot">
                    {step.done ? <Check size={14} /> : <span style={{ fontSize: 10 }}>{i + 1}</span>}
                  </div>
                  <div className="order-timeline__info">
                    <p className="order-timeline__label">{step.label}</p>
                    <p className="order-timeline__time">{step.time}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Items */}
          <div className="widget">
            <h2 className="widget-title">Items in this order</h2>
            {order.items.map(item => (
              <div key={item.id} style={{ display: 'flex', gap: 'var(--sp-4)', padding: 'var(--sp-3) 0', borderBottom: '1px solid var(--color-border)' }}>
                <img src={item.images?.[0]} alt={item.title} style={{ width: 80, height: 80, objectFit: 'contain', background: 'var(--color-bg-alt)', borderRadius: 'var(--radius-sm)', padding: 8 }} />
                <div style={{ flex: 1 }}>
                  <Link to={`/product/${item.id}`} style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, color: 'var(--color-link-dark)', display: 'block', marginBottom: 4 }}>
                    {item.title.slice(0, 60)}…
                  </Link>
                  <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>Sold by: {item.provider?.name}</p>
                  <p style={{ fontWeight: 700, marginTop: 4 }}>${item.price.toFixed(2)}</p>
                </div>
                <button className="btn btn-secondary btn-sm" onClick={() => navigate(`/product/${item.id}`)}>Buy Again</button>
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 'var(--sp-3)', fontWeight: 700, fontSize: 'var(--font-size-lg)' }}>
              Order Total: ${order.total.toFixed(2)}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export function WishlistPage() {
  const items  = useWishlistStore(s => s.items)
  const toggle = useWishlistStore(s => s.toggle)

  return (
    <div className="container page-content">
      <h1 style={{ marginBottom: 'var(--sp-4)', fontSize: 'var(--font-size-2xl)', fontWeight: 700 }}>Wishlist</h1>
      <div className="account-layout">
        <AccountNav />
        <div>
          {items.length === 0
            ? <EmptyState icon="♥" title="Your wishlist is empty" text="Save items you love for later." action={<Link to="/" className="btn btn-primary">Discover Products</Link>} />
            : <div className="product-grid--wide">{items.map(p => <ProductCard key={p.id} product={p} />)}</div>
          }
        </div>
      </div>
    </div>
  )
}
