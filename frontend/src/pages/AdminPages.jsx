import { useState } from 'react'
import { NavLink, Link } from 'react-router-dom'
import {
  LayoutDashboard, Users, Package, ShoppingBag, BarChart2,
  Bot, CheckCircle2, XCircle, Eye, Trash2, Settings, Bell
} from 'lucide-react'
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend
} from 'recharts'
import { ADMIN_STATS, PROVIDER_APPLICATIONS, ALL_USERS, PRODUCTS, ORDERS, REVENUE_DATA } from '../data/mockData.js'
import { StatusPill } from '../components/ui.jsx'
import { useToastStore } from '../stores/index.js'

const ADMIN_NAV_ITEMS = [
  { section: 'Overview', links: [
    { to: '/admin',              icon: <LayoutDashboard size={16} />, label: 'Dashboard', end: true },
    { to: '/admin/analytics',    icon: <BarChart2 size={16} />,      label: 'Analytics' },
  ]},
  { section: 'Management', links: [
    { to: '/admin/applications', icon: <CheckCircle2 size={16} />,   label: 'Provider Apps', badge: PROVIDER_APPLICATIONS.filter(a => a.status === 'PENDING').length },
    { to: '/admin/users',        icon: <Users size={16} />,           label: 'Users' },
    { to: '/admin/products',     icon: <Package size={16} />,         label: 'Products' },
    { to: '/admin/orders',       icon: <ShoppingBag size={16} />,     label: 'Orders' },
  ]},
  { section: 'AI/ML', links: [
    { to: '/admin/ml',           icon: <Bot size={16} />,             label: 'DeepFM Engine' },
  ]},
  { section: 'System', links: [
    { to: '/admin/settings',     icon: <Settings size={16} />,        label: 'Settings' },
  ]},
]

function AdminSidebar() {
  return (
    <aside className="admin-sidebar" style={{ width: 240, flexShrink: 0 }}>
      <div className="admin-sidebar__logo">
        <span style={{ color: 'var(--color-primary)' }}>Mixi</span><span className="admin-sidebar__logo span"> Shop</span>
        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', fontWeight: 400 }}>Admin Dashboard</div>
      </div>
      <nav>
        {ADMIN_NAV_ITEMS.map(section => (
          <div key={section.section} className="admin-nav-section">
            <div className="admin-nav-title">{section.section}</div>
            {section.links.map(link => (
              <NavLink key={link.to} to={link.to} end={link.end}
                className={({ isActive }) => `admin-nav-link ${isActive ? 'active' : ''}`}>
                {link.icon} {link.label}
                {link.badge > 0 && <span className="badge-count">{link.badge}</span>}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>
    </aside>
  )
}

const ORDERS_BY_STATUS = [
  { name: 'Delivered', value: 1824, color: '#067D62' },
  { name: 'Shipped',   value: 932,  color: '#2563eb' },
  { name: 'Preparing', value: 621,  color: '#d97706' },
  { name: 'Pending',   value: 244,  color: '#9ca3af' },
]

import { useEffect } from 'react'
import { api } from '../services/api.js'

export function AdminDashboard() {
  const [statsData, setStatsData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [pendingApps, setPendingApps] = useState([])

  useEffect(() => {
    api.get('/admin/analytics')
      .then(res => {
        setStatsData(res.data)
      })
      .catch(console.error)

    api.get('/admin/applications')
      .then(res => {
        const pending = res.data
          .filter(a => a.status === 'PENDING')
          .map(app => ({
            id: app.id,
            name: app.user?.profile?.firstName ? `${app.user.profile.firstName} ${app.user.profile.lastName || ''}` : 'Applicant',
            email: app.user?.email || 'N/A',
            store: app.storeName,
            category: app.category || 'N/A',
            submitted: new Date(app.createdAt).toLocaleDateString()
          }))
        setPendingApps(pending)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const stats = [
    { label: 'Total Revenue', value: statsData ? `$${Number(statsData.totalRevenue).toLocaleString()}` : '$0', trend: '+12% vs last month', icon: '💰', color: '#059669', bg: '#d1fae5' },
    { label: 'Total Orders',  value: statsData ? statsData.totalOrders.toLocaleString() : '0',  trend: '+8% vs last month',  icon: '📦', color: '#2563eb', bg: '#dbeafe' },
    { label: 'Active Users',  value: statsData ? statsData.totalUsers.toLocaleString() : '0',   trend: '+342 today',   icon: '👥', color: '#7c3aed', bg: '#ede9fe' },
    { label: 'Pending Apps',  value: statsData ? statsData.pendingApps.toString() : '0', trend: 'provider apps',  icon: '⏳', color: '#d97706', bg: '#fef3c7' },
  ]

  if (loading) {
    return (
      <div className="admin-layout">
        <AdminSidebar />
        <main className="admin-content">
          <h2>Loading Admin Dashboard...</h2>
        </main>
      </div>
    )
  }

  return (
    <div className="admin-layout">
      <AdminSidebar />
      <main className="admin-content">
        <div className="admin-header">
          <h1 className="admin-page-title">Dashboard Overview</h1>
          <div style={{ display: 'flex', gap: 'var(--sp-2)' }}>
            <button className="btn btn-secondary btn-sm"><Bell size={15} /> Notifications</button>
            <Link to="/" className="btn btn-secondary btn-sm"><Eye size={15} /> View Store</Link>
          </div>
        </div>

        {/* Stats */}
        <div className="stats-grid">
          {stats.map(s => (
            <div key={s.label} className="stat-card">
              <div className="stat-card__icon" style={{ background: s.bg, color: s.color }}>{s.icon}</div>
              <div className="stat-card__label">{s.label}</div>
              <div className="stat-card__value">{s.value}</div>
              <div className="stat-card__trend up">↑ {s.trend}</div>
            </div>
          ))}
        </div>

        {/* Charts Row */}
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 'var(--sp-4)', marginBottom: 'var(--sp-4)' }}>
          <div className="widget">
            <h2 className="widget-title">Revenue Trend</h2>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={REVENUE_DATA} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip formatter={v => [`$${v.toLocaleString()}`, 'Revenue']} />
                <Line type="monotone" dataKey="revenue" stroke="var(--color-primary)" strokeWidth={2.5} dot={{ r: 4 }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="widget">
            <h2 className="widget-title">Orders by Status</h2>
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={ORDERS_BY_STATUS} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value">
                  {ORDERS_BY_STATUS.map((e, i) => <Cell key={i} fill={e.color} />)}
                </Pie>
                <Tooltip />
                <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Pending Applications Quick View */}
        <div className="widget" style={{ marginBottom: 'var(--sp-4)' }}>
          <h2 className="widget-title">
            Pending Provider Applications
            <Link to="/admin/applications">Review all →</Link>
          </h2>
          <div className="data-table-wrap">
            <table className="data-table">
              <thead><tr><th>Applicant</th><th>Store Name</th><th>Category</th><th>Submitted</th><th>Actions</th></tr></thead>
              <tbody>
                {pendingApps.map(app => (
                  <tr key={app.id}>
                    <td><strong>{app.name}</strong><br /><span style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>{app.email}</span></td>
                    <td>{app.store}</td>
                    <td>{app.category}</td>
                    <td>{app.submitted}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <Link to="/admin/applications" className="btn btn-primary btn-sm"><CheckCircle2 size={13} /> Review</Link>
                      </div>
                    </td>
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

export function AdminApplications() {
  const showToast = useToastStore(s => s.show)
  const [apps, setApps] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchApps = () => {
    api.get('/admin/applications')
      .then(res => {
        const mapped = res.data.map(app => ({
          id: app.id,
          name: app.user?.profile?.firstName ? `${app.user.profile.firstName} ${app.user.profile.lastName || ''}` : 'Applicant',
          email: app.user?.email || 'N/A',
          store: app.storeName,
          category: app.category || 'N/A',
          submitted: new Date(app.createdAt).toLocaleDateString(),
          status: app.status,
          description: app.description
        }));
        setApps(mapped);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    fetchApps()
  }, [])

  const approve = async (id) => {
    try {
      await api.put(`/admin/applications/${id}`, { status: 'APPROVED' });
      showToast('Provider application approved! Role updated.', 'success');
      fetchApps();
    } catch(err) {
      showToast('Failed to approve application', 'error');
    }
  }

  const reject = async (id) => {
    try {
      await api.put(`/admin/applications/${id}`, { status: 'REJECTED' });
      showToast('Application rejected.', 'error');
      fetchApps();
    } catch(err) {
      showToast('Failed to reject application', 'error');
    }
  }

  if (loading) {
    return (
      <div className="admin-layout">
        <AdminSidebar />
        <main className="admin-content">
          <h2>Loading Applications...</h2>
        </main>
      </div>
    )
  }

  return (
    <div className="admin-layout">
      <AdminSidebar />
      <main className="admin-content">
        <div className="admin-header">
          <h1 className="admin-page-title">Provider Applications</h1>
          <div style={{ display: 'flex', gap: 'var(--sp-2)' }}>
            <span className="badge badge-deal" style={{ fontSize: 'var(--font-size-sm)', padding: '4px 12px' }}>
              {apps.filter(a => a.status === 'PENDING').length} Pending
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
          {apps.map(app => (
            <div key={app.id} className="widget" style={{ borderLeft: `4px solid ${app.status === 'APPROVED' ? 'var(--color-success)' : app.status === 'REJECTED' ? 'var(--color-danger)' : 'var(--color-warning)'}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--sp-3)' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)', marginBottom: 'var(--sp-2)' }}>
                    <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--color-primary)', color: '#111', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, flexShrink: 0 }}>
                      {app.name[0]}
                    </div>
                    <div>
                      <div style={{ fontWeight: 700 }}>{app.name}</div>
                      <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>{app.email} · {app.submitted}</div>
                    </div>
                    <StatusPill status={app.status} />
                  </div>
                  <div style={{ display: 'flex', gap: 'var(--sp-6)', fontSize: 'var(--font-size-sm)', flexWrap: 'wrap' }}>
                    <div><span style={{ color: 'var(--color-text-secondary)' }}>Store: </span><strong>{app.store}</strong></div>
                    <div><span style={{ color: 'var(--color-text-secondary)' }}>Category: </span><strong>{app.category}</strong></div>
                  </div>
                  <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', marginTop: 'var(--sp-2)' }}>{app.description}</p>
                </div>
                {app.status === 'PENDING' && (
                  <div style={{ display: 'flex', gap: 'var(--sp-2)', alignItems: 'flex-start' }}>
                    <button id={`approve-${app.id}`} className="btn btn-primary btn-sm" onClick={() => approve(app.id)}>
                      <CheckCircle2 size={14} /> Approve
                    </button>
                    <button id={`reject-${app.id}`} className="btn btn-danger btn-sm" onClick={() => reject(app.id)}>
                      <XCircle size={14} /> Reject
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}

export function AdminUsers() {
  const showToast = useToastStore(s => s.show)
  return (
    <div className="admin-layout">
      <AdminSidebar />
      <main className="admin-content">
        <div className="admin-header">
          <h1 className="admin-page-title">User Management</h1>
          <div style={{ display: 'flex', gap: 'var(--sp-2)' }}>
            <input className="form-input" placeholder="Search users…" style={{ width: 220 }} id="user-search" />
          </div>
        </div>
        <div className="widget">
          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr><th>User</th><th>Role</th><th>Status</th><th>Orders</th><th>Joined</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {ALL_USERS.map(u => (
                  <tr key={u.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)' }}>
                        <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--color-primary)', color: '#111', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13, flexShrink: 0 }}>{u.name[0]}</div>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 'var(--font-size-sm)' }}>{u.name}</div>
                          <div style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>{u.email}</div>
                        </div>
                      </div>
                    </td>
                    <td><span className="chip">{u.role}</span></td>
                    <td><StatusPill status={u.status} /></td>
                    <td>{u.orders}</td>
                    <td>{u.joined}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button className="btn btn-secondary btn-sm" title="View"><Eye size={13} /></button>
                        {u.status === 'ACTIVE'
                          ? <button className="btn btn-danger btn-sm" title="Suspend" onClick={() => showToast(`${u.name} suspended`, 'warning')}>Suspend</button>
                          : <button className="btn btn-primary btn-sm" title="Activate" onClick={() => showToast(`${u.name} reactivated`, 'success')}>Activate</button>
                        }
                      </div>
                    </td>
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

export function AdminMLDashboard() {
  const showToast = useToastStore(s => s.show)
  const [retraining, setRetraining] = useState(false)
  const [progress, setProgress] = useState(0)

  const triggerRetrain = () => {
    setRetraining(true)
    setProgress(0)
    const interval = setInterval(() => {
      setProgress(p => {
        if (p >= 100) { clearInterval(interval); setRetraining(false); showToast('DeepFM model retrained successfully! AUC: 0.834', 'success'); return 0 }
        return p + 5
      })
    }, 200)
  }

  const mlMetrics = [
    { label: 'AUC Score', value: '0.834', desc: 'Area Under ROC Curve', good: true },
    { label: 'Log Loss', value: '0.412', desc: 'Binary Cross-Entropy', good: true },
    { label: 'CTR Lift vs Baseline', value: '+23.4%', desc: 'vs popularity-based', good: true },
    { label: 'Training Events', value: '284,912', desc: 'Total CTR events used', good: true },
    { label: 'Embedding Dim', value: '16', desc: 'Feature embedding size', good: true },
    { label: 'Last Trained', value: 'Jun 30, 02:00 AM', desc: 'Weekly auto-retrain', good: true },
  ]

  const ctrData = [
    { week: 'W1', deepfm: 3.2, baseline: 2.8 },
    { week: 'W2', deepfm: 3.8, baseline: 2.9 },
    { week: 'W3', deepfm: 4.1, baseline: 3.0 },
    { week: 'W4', deepfm: 4.5, baseline: 3.1 },
    { week: 'W5', deepfm: 4.8, baseline: 3.0 },
    { week: 'W6', deepfm: 5.2, baseline: 3.2 },
  ]

  return (
    <div className="admin-layout">
      <AdminSidebar />
      <main className="admin-content">
        <div className="admin-header">
          <div>
            <h1 className="admin-page-title">🤖 DeepFM Recommendation Engine</h1>
            <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)' }}>Monitor and control the CTR prediction model</p>
          </div>
          <button
            id="retrain-model-btn"
            className={`btn ${retraining ? 'btn-secondary' : 'btn-primary'} btn-lg`}
            onClick={triggerRetrain}
            disabled={retraining}
          >
            {retraining ? `Training… ${progress}%` : '⚡ Trigger Retraining'}
          </button>
        </div>

        {/* Progress Bar */}
        {retraining && (
          <div style={{ background: 'var(--color-surface)', borderRadius: 'var(--radius-md)', padding: 'var(--sp-4)', marginBottom: 'var(--sp-4)', border: '1px solid var(--color-border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 'var(--font-size-sm)' }}>
              <span>Training DeepFM model on latest CTR data…</span>
              <strong>{progress}%</strong>
            </div>
            <div style={{ height: 8, background: 'var(--color-border)', borderRadius: 'var(--radius-full)', overflow: 'hidden' }}>
              <div style={{ width: `${progress}%`, height: '100%', background: 'var(--color-primary)', borderRadius: 'var(--radius-full)', transition: 'width 0.2s' }} />
            </div>
          </div>
        )}

        {/* ML Metrics */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--sp-4)', marginBottom: 'var(--sp-4)' }}>
          {mlMetrics.map(m => (
            <div key={m.label} className="stat-card" style={{ borderLeft: `4px solid ${m.good ? 'var(--color-success)' : 'var(--color-danger)'}` }}>
              <div className="stat-card__label">{m.label}</div>
              <div className="stat-card__value" style={{ fontSize: 'var(--font-size-2xl)' }}>{m.value}</div>
              <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>{m.desc}</div>
            </div>
          ))}
        </div>

        {/* CTR Lift Chart */}
        <div className="widget" style={{ marginBottom: 'var(--sp-4)' }}>
          <h2 className="widget-title">CTR Performance: DeepFM vs Baseline</h2>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={ctrData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="week" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} unit="%" />
              <Tooltip formatter={v => [`${v}%`, '']} />
              <Legend />
              <Bar dataKey="deepfm" name="DeepFM" fill="var(--color-primary)" radius={[4,4,0,0]} />
              <Bar dataKey="baseline" name="Popularity Baseline" fill="var(--color-border-dark)" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Architecture Info */}
        <div className="widget">
          <h2 className="widget-title">Model Architecture</h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--sp-6)' }}>
            <div>
              <h3 style={{ fontWeight: 700, marginBottom: 'var(--sp-3)', fontSize: 'var(--font-size-base)' }}>DeepFM Configuration</h3>
              <table className="product-info__spec-table">
                <tbody>
                  {[
                    ['Model', 'DeepFM (PyTorch)'],
                    ['Embedding Dim', '16'],
                    ['MLP Layers', '256 → 128 → 64 → 1'],
                    ['Dropout', '0.3'],
                    ['Activation', 'ReLU + Sigmoid'],
                    ['Optimizer', 'Adam (lr=0.001)'],
                    ['Batch Size', '4096'],
                    ['Epochs', '20'],
                    ['Scheduler', 'APScheduler (weekly)'],
                  ].map(([k, v]) => <tr key={k}><td>{k}</td><td>{v}</td></tr>)}
                </tbody>
              </table>
            </div>
            <div>
              <h3 style={{ fontWeight: 700, marginBottom: 'var(--sp-3)', fontSize: 'var(--font-size-base)' }}>Feature Groups</h3>
              {[
                { name: 'User Features', count: 8, icon: '👤', desc: 'user_id, age_group, preferred_category, purchase_frequency, avg_order_value…' },
                { name: 'Product Features', count: 9, icon: '📦', desc: 'product_id, category_id, price_bucket, avg_rating, discount_rate, days_listed…' },
                { name: 'Context Features', count: 5, icon: '🌐', desc: 'hour_of_day, day_of_week, source, position, device_type' },
              ].map(f => (
                <div key={f.name} style={{ marginBottom: 'var(--sp-3)', padding: 'var(--sp-3)', background: 'var(--color-bg-alt)', borderRadius: 'var(--radius-sm)' }}>
                  <div style={{ fontWeight: 600, fontSize: 'var(--font-size-sm)', marginBottom: 4 }}>{f.icon} {f.name} <span className="badge badge-prime">{f.count}</span></div>
                  <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

export function AdminProducts() {
  const showToast = useToastStore(s => s.show)
  return (
    <div className="admin-layout">
      <AdminSidebar />
      <main className="admin-content">
        <h1 className="admin-page-title" style={{ marginBottom: 'var(--sp-6)' }}>Product Moderation</h1>
        <div className="widget">
          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr><th>Product</th><th>Provider</th><th>Price</th><th>Stock</th><th>Rating</th><th>Status</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {PRODUCTS.slice(0, 8).map(p => (
                  <tr key={p.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)' }}>
                        <img src={p.images?.[0]} alt="" style={{ width: 40, height: 40, objectFit: 'contain', background: 'var(--color-bg-alt)', borderRadius: 4, padding: 3, flexShrink: 0 }} />
                        <span style={{ fontSize: 'var(--font-size-sm)', maxWidth: 180 }}>{p.title.slice(0, 35)}…</span>
                      </div>
                    </td>
                    <td style={{ fontSize: 'var(--font-size-sm)' }}>{p.provider.name}</td>
                    <td>${p.price.toFixed(2)}</td>
                    <td>{p.stock}</td>
                    <td>{p.rating}★</td>
                    <td><StatusPill status={p.stock === 0 ? 'OUT_OF_STOCK' : 'ACTIVE'} /></td>
                    <td>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button className="btn btn-secondary btn-sm"><Eye size={13} /></button>
                        <button className="btn btn-danger btn-sm" onClick={() => showToast('Product removed', 'error')}><Trash2 size={13} /></button>
                      </div>
                    </td>
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
