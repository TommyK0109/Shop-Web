import { useState } from 'react'
import { NavLink, Link, useNavigate } from 'react-router-dom'
import { BarChart2, Package, ShoppingBag, TrendingUp, PlusCircle, Edit2, Trash2, AlertCircle, Eye, Check, X } from 'lucide-react'
import { PRODUCTS, PROVIDER_STATS, ORDERS } from '../data/mockData.js'
import { StatusPill, EmptyState } from '../components/ui.jsx'
import { useToastStore } from '../stores/index.js'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'

const REVENUE_DATA = [
  { day: 'Mon', revenue: 1240 }, { day: 'Tue', revenue: 980 }, { day: 'Wed', revenue: 1780 },
  { day: 'Thu', revenue: 1450 }, { day: 'Fri', revenue: 2100 }, { day: 'Sat', revenue: 2680 }, { day: 'Sun', revenue: 1890 },
]

const PROVIDER_NAV = [
  { to: '/provider',          icon: <BarChart2 size={16} />, label: 'Dashboard',  end: true },
  { to: '/provider/products', icon: <Package size={16} />,   label: 'Products' },
  { to: '/provider/orders',   icon: <ShoppingBag size={16} />, label: 'Orders' },
  { to: '/provider/analytics',icon: <TrendingUp size={16} />, label: 'Analytics' },
]

function ProviderSidebar() {
  return (
    <aside style={{ background: 'var(--color-header)', minHeight: '100vh', width: 240, padding: 'var(--sp-4)', flexShrink: 0 }}>
      <div style={{ color: '#fff', fontSize: 'var(--font-size-xl)', fontWeight: 700, padding: 'var(--sp-4) 0', marginBottom: 'var(--sp-4)', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
        <span style={{ color: 'var(--color-primary)' }}>Mixi</span><span> Shop</span>
        <div style={{ fontSize: 'var(--font-size-xs)', color: 'rgba(255,255,255,0.5)', fontWeight: 400, marginTop: 2 }}>Provider Portal</div>
      </div>
      <nav>
        {PROVIDER_NAV.map(item => (
          <NavLink key={item.to} to={item.to} end={item.end}
            className={({ isActive }) => `admin-nav-link ${isActive ? 'active' : ''}`}>
            {item.icon} {item.label}
          </NavLink>
        ))}
      </nav>
    </aside>
  )
}

export function ProviderDashboard() {
  const stats = [
    { label: 'Total Revenue', value: PROVIDER_STATS.revenue.value, trend: PROVIDER_STATS.revenue.trend, icon: '💰', color: '#059669', bg: '#d1fae5' },
    { label: 'Total Orders',  value: PROVIDER_STATS.orders.value,  trend: PROVIDER_STATS.orders.trend,  icon: '📦', color: '#2563eb', bg: '#dbeafe' },
    { label: 'Products',      value: PROVIDER_STATS.products.value, trend: PROVIDER_STATS.products.trend, icon: '🏪', color: '#7c3aed', bg: '#ede9fe' },
    { label: 'Avg. Rating',   value: PROVIDER_STATS.rating.value,   trend: PROVIDER_STATS.rating.trend,  icon: '⭐', color: '#d97706', bg: '#fef3c7' },
  ]
  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <ProviderSidebar />
      <main style={{ flex: 1, padding: 'var(--sp-6)', background: 'var(--color-bg)' }}>
        <div style={{ marginBottom: 'var(--sp-6)' }}>
          <h1 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 700 }}>Provider Dashboard</h1>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)' }}>Welcome back! Here's what's happening in your store.</p>
        </div>

        {/* Stats */}
        <div className="stats-grid">
          {stats.map(s => (
            <div key={s.label} className="stat-card">
              <div className="stat-card__icon" style={{ background: s.bg, color: s.color }}>{s.icon}</div>
              <div className="stat-card__label">{s.label}</div>
              <div className="stat-card__value">{s.value}</div>
              <div className={`stat-card__trend ${s.trend.includes('+') ? 'up' : 'down'}`}>
                {s.trend.includes('+') ? '↑' : '⚠'} {s.trend}
              </div>
            </div>
          ))}
        </div>

        {/* Revenue Chart */}
        <div className="widget" style={{ marginBottom: 'var(--sp-4)' }}>
          <h2 className="widget-title">Revenue This Week</h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={REVENUE_DATA} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="day" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip formatter={v => [`$${v}`, 'Revenue']} />
              <Bar dataKey="revenue" fill="var(--color-primary)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Recent Orders */}
        <div className="widget">
          <h2 className="widget-title">Recent Orders <Link to="/provider/orders" style={{ fontSize: 'var(--font-size-sm)' }}>See all →</Link></h2>
          <div className="data-table-wrap">
            <table className="data-table">
              <thead><tr><th>Order ID</th><th>Date</th><th>Amount</th><th>Status</th><th>Action</th></tr></thead>
              <tbody>
                {ORDERS.map(o => (
                  <tr key={o.id}>
                    <td><strong>{o.id}</strong></td>
                    <td>{o.date}</td>
                    <td>${o.total.toFixed(2)}</td>
                    <td><StatusPill status={o.status} /></td>
                    <td><Link to="/provider/orders" className="btn btn-secondary btn-sm"><Eye size={13} /> View</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  )
}

import { useEffect } from 'react'
import { api } from '../services/api.js'

export function ProviderProducts() {
  const navigate = useNavigate()
  const showToast = useToastStore(s => s.show)
  const [myProducts, setMyProducts] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchProducts = () => {
    api.get('/products/me')
      .then(res => {
        const formatted = res.data.map(p => ({
          ...p,
          price: Number(p.price),
          rating: p.avgRating || 4.5
        }))
        setMyProducts(formatted)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }

  useEffect(() => {
    fetchProducts()
  }, [])

  const deleteProd = async (id) => {
    if (!confirm('Are you sure you want to delete this product?')) return;
    try {
      await api.delete(`/products/${id}`)
      showToast('Product deleted', 'error')
      fetchProducts()
    } catch(err) {
      showToast('Failed to delete product', 'error')
    }
  }

  const activeCount = myProducts.filter(p => p.status === 'ACTIVE' && p.stock > 0).length
  const outStockCount = myProducts.filter(p => p.stock === 0).length
  const draftCount = myProducts.filter(p => p.status === 'DRAFT').length

  if (loading) {
    return (
      <div style={{ display: 'flex', minHeight: '100vh' }}>
        <ProviderSidebar />
        <main style={{ flex: 1, padding: 'var(--sp-6)', background: 'var(--color-bg)' }}>
          <h2>Loading products...</h2>
        </main>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <ProviderSidebar />
      <main style={{ flex: 1, padding: 'var(--sp-6)', background: 'var(--color-bg)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--sp-6)' }}>
          <h1 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 700 }}>My Products</h1>
          <button className="btn btn-primary btn-lg" id="add-product-btn">
            <PlusCircle size={18} /> Add New Product
          </button>
        </div>

        {/* Quick Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--sp-4)', marginBottom: 'var(--sp-6)' }}>
          {[
            { label: 'Active', value: activeCount, color: 'var(--color-success)', bg: 'var(--color-success-bg)' },
            { label: 'Draft',  value: draftCount,  color: 'var(--color-warning)', bg: 'var(--color-warning-bg)' },
            { label: 'Out of Stock', value: outStockCount, color: 'var(--color-danger)', bg: 'var(--color-danger-bg)' },
          ].map(s => (
            <div key={s.label} style={{ background: s.bg, border: `1px solid ${s.color}40`, borderRadius: 'var(--radius-md)', padding: 'var(--sp-4)', textAlign: 'center' }}>
              <div style={{ fontSize: 28, fontWeight: 700, color: s.color }}>{s.value}</div>
              <div style={{ fontSize: 'var(--font-size-xs)', color: s.color, fontWeight: 600 }}>{s.label}</div>
            </div>
          ))}
        </div>

        <div className="widget">
          {myProducts.length === 0 ? (
            <EmptyState icon="📦" title="No Products Uploaded" text="You have not created any listings yet." />
          ) : (
            <div className="data-table-wrap">
              <table className="data-table">
                <thead>
                  <tr><th>Product</th><th>Price</th><th>Stock</th><th>Rating</th><th>Status</th><th>Actions</th></tr>
                </thead>
                <tbody>
                  {myProducts.map(p => (
                    <tr key={p.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)' }}>
                          <img src={p.images?.[0]} alt="" style={{ width: 44, height: 44, objectFit: 'contain', background: 'var(--color-bg-alt)', borderRadius: 'var(--radius-sm)', padding: 4, flexShrink: 0 }} />
                          <div>
                            <p style={{ fontWeight: 600, fontSize: 'var(--font-size-sm)', lineHeight: 1.3, maxWidth: 220 }}>{p.title.slice(0, 40)}…</p>
                            <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                              {typeof p.category === 'object' ? p.category.name : p.category}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td>${p.price.toFixed(2)}</td>
                      <td>
                        <span style={{ color: p.stock < 10 ? 'var(--color-danger)' : 'var(--color-success)', fontWeight: p.stock < 10 ? 700 : 400 }}>
                          {p.stock < 10 && <AlertCircle size={13} style={{ display: 'inline', marginRight: 3 }} />}
                          {p.stock}
                        </span>
                      </td>
                      <td>{'⭐'.repeat(Math.round(p.rating))} {p.rating}</td>
                      <td><StatusPill status={p.status} /></td>
                      <td>
                        <div style={{ display: 'flex', gap: 'var(--sp-1)' }}>
                          <button className="btn btn-secondary btn-sm" title="Edit"><Edit2 size={13} /></button>
                          <button className="btn btn-danger btn-sm" title="Delete" onClick={() => deleteProd(p.id)}><Trash2 size={13} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

export function ProviderOrders() {
  const showToast = useToastStore(s => s.show)
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchOrders = () => {
    api.get('/orders/incoming')
      .then(res => {
        setOrders(res.data)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }

  useEffect(() => {
    fetchOrders()
  }, [])

  const updateStatus = async (orderId, newStatus) => {
    try {
      await api.put(`/orders/${orderId}/status`, { status: newStatus })
      showToast(`Order status updated to ${newStatus.toLowerCase()}`, 'success')
      fetchOrders()
    } catch(err) {
      showToast('Failed to update order status', 'error')
    }
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', minHeight: '100vh' }}>
        <ProviderSidebar />
        <main style={{ flex: 1, padding: 'var(--sp-6)', background: 'var(--color-bg)' }}>
          <h2>Loading incoming orders...</h2>
        </main>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <ProviderSidebar />
      <main style={{ flex: 1, padding: 'var(--sp-6)', background: 'var(--color-bg)' }}>
        <h1 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 700, marginBottom: 'var(--sp-6)' }}>Incoming Orders</h1>
        <div className="widget">
          {orders.length === 0 ? (
            <EmptyState icon="📦" title="No Incoming Orders" text="No customers have purchased your products yet." />
          ) : (
            <div className="data-table-wrap">
              <table className="data-table">
                <thead>
                  <tr><th>Order ID</th><th>Customer</th><th>Items</th><th>Total</th><th>Date</th><th>Status</th><th>Update</th></tr>
                </thead>
                <tbody>
                  {orders.map(o => (
                    <tr key={o.id}>
                      <td><strong>{o.id.slice(0, 8)}…</strong></td>
                      <td>{o.customer?.profile?.firstName || 'Customer'}</td>
                      <td>{o.items.length} item(s)</td>
                      <td>${Number(o.totalAmount || 0).toFixed(2)}</td>
                      <td>{new Date(o.createdAt).toLocaleDateString()}</td>
                      <td><StatusPill status={o.status} /></td>
                      <td>
                        {o.status === 'PENDING' && (
                          <button className="btn btn-primary btn-sm" onClick={() => updateStatus(o.id, 'PREPARING')}>
                            <Check size={13} /> Confirm
                          </button>
                        )}
                        {o.status === 'CONFIRMED' && (
                          <button className="btn btn-primary btn-sm" onClick={() => updateStatus(o.id, 'PREPARING')}>
                            Start Preparing
                          </button>
                        )}
                        {o.status === 'PREPARING' && (
                          <button className="btn btn-primary btn-sm" onClick={() => updateStatus(o.id, 'SHIPPED')}>
                            Mark Shipped
                          </button>
                        )}
                        {o.status === 'SHIPPED' && (
                          <button className="btn btn-primary btn-sm" onClick={() => updateStatus(o.id, 'DELIVERED')}>
                            Mark Delivered
                          </button>
                        )}
                        {(o.status === 'DELIVERED' || o.status === 'CANCELLED') && (
                          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>Completed</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
