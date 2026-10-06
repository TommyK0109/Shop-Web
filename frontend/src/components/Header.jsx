import { useState, useEffect, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Search, ShoppingCart, MapPin, ChevronDown, Menu, User, Package, Heart, LogOut, Settings } from 'lucide-react'
import { useCartStore, useAuthStore, useSearchStore } from '../stores/index.js'
import '../styles/header.css'

const NAV_ITEMS = [
  { label: '☰ All', href: '/search', dropdown: [] },
  { label: 'Electronics',  href: '/category/electronics' },
  { label: 'Fashion',      href: '/category/fashion' },
  { label: 'Home & Garden',href: '/category/home' },
  { label: 'Sports',       href: '/category/sports' },
  { label: 'Books',        href: '/category/books' },
  { label: 'Beauty',       href: '/category/beauty' },
  { label: '🔥 Deals',     href: '/deals', highlighted: true },
]

const SEARCH_CATEGORIES = ['All', 'Electronics', 'Fashion', 'Home', 'Sports', 'Books', 'Beauty', 'Automotive']

export default function Header() {
  const navigate     = useNavigate()
  const cartCount    = useCartStore(s => s.items.reduce((a, i) => a + i.qty, 0))
  const { user, role, logout } = useAuthStore()
  const { query, setQuery } = useSearchStore()
  const [localQ, setLocalQ] = useState(query)
  const [showUserMenu, setShowUserMenu] = useState(false)
  const userMenuRef = useRef(null)

  // Close user menu on outside click
  useEffect(() => {
    const handler = (e) => { if (userMenuRef.current && !userMenuRef.current.contains(e.target)) setShowUserMenu(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleSearch = (e) => {
    e.preventDefault()
    if (localQ.trim()) { setQuery(localQ); navigate(`/search?q=${encodeURIComponent(localQ)}`) }
  }

  const handleLogout = () => { logout(); setShowUserMenu(false); navigate('/') }

  const dashboardLink = role === 'ADMIN' ? '/admin' : role === 'PROVIDER' ? '/provider' : '/account'

  return (
    <header className="header" role="banner">
      {/* === TOP BAR === */}
      <div className="header__inner">
        {/* Logo */}
        <Link to="/" className="header__logo" aria-label="Mixi Shop Home">
          <span className="header__logo-spark">Mixi</span>
          <span className="header__logo-smart"> Shop</span>
        </Link>

        {/* Deliver To */}
        <div className="header__deliver hide-mobile">
          <span className="header__deliver-label">Deliver to</span>
          <span className="header__deliver-loc">
            <MapPin size={14} />
            Ho Chi Minh City
          </span>
        </div>

        {/* Search */}
        <form className="header__search" onSubmit={handleSearch} role="search">
          <select className="header__search-cat" aria-label="Search category">
            {SEARCH_CATEGORIES.map(c => <option key={c}>{c}</option>)}
          </select>
          <input
            className="header__search-input"
            type="search"
            placeholder="Search products, brands, categories…"
            value={localQ}
            onChange={e => setLocalQ(e.target.value)}
            aria-label="Search"
            id="search-input"
          />
          <button className="header__search-btn" type="submit" aria-label="Submit search">
            <Search size={20} />
          </button>
        </form>

        {/* Account */}
        <div style={{ position: 'relative' }} ref={userMenuRef}>
          {user ? (
            <>
              <div
                className="header__action"
                onClick={() => setShowUserMenu(v => !v)}
                style={{ cursor: 'pointer', minWidth: 80, flexDirection: 'row', gap: 6 }}
              >
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--color-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14, color: '#111', flexShrink: 0 }}>
                  {user.name?.[0]?.toUpperCase() || '?'}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span className="header__action-label">Hello, {user.name?.split(' ')[0]}</span>
                  <span className="header__action-value" style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    Account <ChevronDown size={12} />
                  </span>
                </div>
              </div>
              {showUserMenu && (
                <div style={{
                  position: 'absolute', top: 'calc(100% + 4px)', right: 0,
                  background: 'var(--color-surface)', border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-md)', minWidth: 200,
                  boxShadow: 'var(--shadow-md)', zIndex: 999,
                  animation: 'slideUp 0.15s ease',
                }}>
                  <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--color-border)', fontSize: 'var(--font-size-sm)' }}>
                    <div style={{ fontWeight: 600 }}>{user.name}</div>
                    <div style={{ color: 'var(--color-text-secondary)', fontSize: 12 }}>{role}</div>
                  </div>
                  {[
                    { icon: <Package size={15} />, label: 'Dashboard', to: dashboardLink },
                    { icon: <Heart size={15} />,   label: 'Wishlist',   to: '/account/wishlist' },
                    { icon: <Settings size={15} />,label: 'Settings',   to: '/account/settings' },
                  ].map(item => (
                    <Link key={item.label} to={item.to} className="navbar__dropdown-item"
                      style={{ display: 'flex', alignItems: 'center', gap: 8 }}
                      onClick={() => setShowUserMenu(false)}>
                      {item.icon}{item.label}
                    </Link>
                  ))}
                  <div style={{ borderTop: '1px solid var(--color-border)', margin: '4px 0' }} />
                  <button onClick={handleLogout} className="navbar__dropdown-item" style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, color: 'var(--color-danger)', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', fontSize: 'var(--font-size-sm)' }}>
                    <LogOut size={15} />Sign Out
                  </button>
                </div>
              )}
            </>
          ) : (
            <Link to="/login" className="header__action">
              <span className="header__action-label">Hello, sign in</span>
              <span className="header__action-value" style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                Account <ChevronDown size={12} />
              </span>
            </Link>
          )}
        </div>

        {/* Orders */}
        <Link to="/account/orders" className="header__action hide-mobile" style={{ minWidth: 60 }}>
          <span className="header__action-label">Returns &</span>
          <span className="header__action-value">Orders</span>
        </Link>

        {/* Cart */}
        <Link to="/cart" className="header__cart" aria-label={`Cart, ${cartCount} items`} id="cart-icon">
          <div className="header__cart-icon">
            <ShoppingCart size={28} />
            {cartCount > 0 && (
              <span className="header__cart-count">{cartCount > 99 ? '99+' : cartCount}</span>
            )}
          </div>
          <span className="header__cart-text hide-mobile">Cart</span>
        </Link>
      </div>

      {/* === NAVBAR === */}
      <nav className="navbar" aria-label="Main navigation">
        <div className="navbar__inner">
          {NAV_ITEMS.map(item => (
            <Link
              key={item.label}
              to={item.href}
              className={`navbar__item ${item.highlighted ? 'highlighted' : ''}`}
            >
              {item.label}
            </Link>
          ))}
        </div>
      </nav>
    </header>
  )
}
