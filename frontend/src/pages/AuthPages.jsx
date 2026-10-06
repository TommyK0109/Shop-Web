import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Eye, EyeOff, Mail, Lock, Phone } from 'lucide-react'
import { useAuthStore, useToastStore } from '../stores/index.js'

function AuthInput({ id, icon, type = 'text', placeholder, value, onChange }) {
  const [show, setShow] = useState(false)
  const isPassword = type === 'password'
  return (
    <div style={{ position: 'relative' }}>
      <div style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }}>
        {icon}
      </div>
      <input
        id={id}
        type={isPassword ? (show ? 'text' : 'password') : type}
        className="form-input"
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        style={{ paddingLeft: 38, paddingRight: isPassword ? 42 : 12 }}
      />
      {isPassword && (
        <button type="button" onClick={() => setShow(v => !v)}
          style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer', padding: 2 }}>
          {show ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      )}
    </div>
  )
}

export function LoginPage() {
  const navigate  = useNavigate()
  const login     = useAuthStore(s => s.login)
  const showToast = useToastStore(s => s.show)
  const [email, setEmail]     = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading]   = useState(false)

  const DB_ACCOUNTS = {
    'customer@example.com':  { name: 'Alex Thompson', role: 'CUSTOMER' },
    'provider@example.com':  { name: 'TechStore Official', role: 'PROVIDER' },
    'admin@example.com':     { name: 'Admin User', role: 'ADMIN' },
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const user = await login(email, password);
      showToast(`Welcome back, ${user.email}! 👋`, 'success');
      const redirects = { CUSTOMER: '/', PROVIDER: '/provider', ADMIN: '/admin' };
      navigate(redirects[user.role]);
    } catch (err) {
      console.error(err);
      showToast(err.response?.data?.error || 'Invalid email or password.', 'error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <Link to="/" className="auth-logo">
        <span style={{ color: 'var(--color-primary)' }}>Mixi</span><span className="auth-logo span"> Shop</span>
      </Link>

      <div className="auth-card animate-fadein">
        <h1 className="auth-title">Sign in</h1>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label" htmlFor="login-email">Email or mobile phone number</label>
            <AuthInput id="login-email" icon={<Mail size={16} />} type="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="login-password">Password</label>
            <AuthInput id="login-password" icon={<Lock size={16} />} type="password" placeholder="At least 6 characters" value={password} onChange={e => setPassword(e.target.value)} />
          </div>
          <button id="login-submit-btn" type="submit" className="btn btn-primary btn-full btn-lg" disabled={loading}>
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginTop: 'var(--sp-3)' }}>
          By continuing, you agree to Mixi Shop's <a href="#">Conditions of Use</a> and <a href="#">Privacy Notice</a>.
        </p>

        <div className="auth-divider">New to Mixi Shop?</div>
        <Link to="/register" className="btn btn-secondary btn-full">Create your Mixi Shop account</Link>

        {/* Demo Accounts */}
        <div style={{ marginTop: 'var(--sp-4)', padding: 'var(--sp-3)', background: 'var(--color-bg-alt)', borderRadius: 'var(--radius-sm)', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
          <strong style={{ display: 'block', marginBottom: 6, color: 'var(--color-text)' }}>🧪 Database Accounts (password: password123)</strong>
          {Object.entries(DB_ACCOUNTS).map(([mail, u]) => (
            <div key={mail} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0' }}>
              <span style={{ color: 'var(--color-link)', cursor: 'pointer' }} onClick={() => { setEmail(mail); setPassword('password123'); }}>{mail}</span>
              <span className="badge" style={{ background: u.role === 'ADMIN' ? '#7c3aed' : u.role === 'PROVIDER' ? 'var(--color-link)' : 'var(--color-success)', color: '#fff', fontSize: 10 }}>{u.role}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="auth-footer" style={{ marginTop: 'var(--sp-4)' }}>
        <Link to="/register/provider">Become a provider</Link> · <a href="#">Help</a> · <a href="#">Privacy</a>
      </div>
    </div>
  )
}

export function RegisterPage({ isProvider = false }) {
  const navigate  = useNavigate()
  const registerCustomer = useAuthStore(s => s.registerCustomer)
  const registerProvider = useAuthStore(s => s.registerProvider)
  const showToast = useToastStore(s => s.show)
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '', storeName: '', category: '', description: '' })
  const [method, setMethod] = useState('email')
  const [loading, setLoading] = useState(false)
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      if (isProvider) {
        await registerProvider(form.email, form.password, form.storeName, form.description);
        showToast('Application submitted successfully! Redirecting...', 'success');
        setTimeout(() => navigate('/'), 1500);
      } else {
        const parts = form.name.split(' ');
        const firstName = parts[0] || '';
        const lastName = parts.slice(1).join(' ') || '';
        await registerCustomer(form.email, form.password, firstName, lastName);
        showToast('Account created successfully! Welcome to Mixi Shop.', 'success');
        setTimeout(() => navigate('/'), 1500);
      }
    } catch (err) {
      console.error(err);
      showToast(err.response?.data?.error || 'Registration failed. Try again.', 'error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <Link to="/" className="auth-logo">
        <span style={{ color: 'var(--color-primary)' }}>Mixi</span><span> Shop</span>
      </Link>

      <div className="auth-card animate-fadein" style={{ maxWidth: isProvider ? 520 : 400 }}>
        <h1 className="auth-title">{isProvider ? '📦 Become a Provider' : 'Create account'}</h1>

        {isProvider && (
          <div style={{ background: 'var(--color-primary-light)', border: '1px solid var(--color-primary)', borderRadius: 'var(--radius-sm)', padding: 'var(--sp-3)', marginBottom: 'var(--sp-4)', fontSize: 'var(--font-size-sm)' }}>
            <strong>🔍 Admin Review Required</strong><br />
            Provider applications are reviewed within 24–48 hours. You\'ll receive an email once approved.
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {!isProvider && (
            <div className="form-group">
              <label className="form-label" htmlFor="reg-name">Your name</label>
              <AuthInput id="reg-name" icon={null} placeholder="First and last name" value={form.name} onChange={set('name')} />
            </div>
          )}

          <div className="form-group">
            <div style={{ display: 'flex', gap: 'var(--sp-2)', marginBottom: 'var(--sp-2)' }}>
              <button type="button" className="btn btn-primary btn-sm" style={{ flex: 1 }}>
                <Mail size={13} /> Email
              </button>
            </div>
            <AuthInput id="reg-email" icon={<Mail size={16} />} type="email" placeholder="you@example.com" value={form.email} onChange={set('email')} />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="reg-password">Password</label>
            <AuthInput id="reg-password" icon={<Lock size={16} />} type="password" placeholder="At least 6 characters" value={form.password} onChange={set('password')} />
          </div>

          {isProvider && (
            <>
              <div className="form-group">
                <label className="form-label">Store / Business Name</label>
                <input id="reg-store" className="form-input" placeholder="e.g. TechGadgets VN" value={form.storeName} onChange={set('storeName')} />
              </div>
              <div className="form-group">
                <label className="form-label">Main Product Category</label>
                <select id="reg-category" className="form-select" value={form.category} onChange={set('category')}>
                  <option value="">Select a category…</option>
                  {['Electronics', 'Fashion', 'Home & Garden', 'Sports', 'Books', 'Beauty', 'Toys & Games', 'Automotive'].map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Tell us about your business</label>
                <textarea id="reg-description" className="form-textarea" placeholder="What do you sell? Where do you source products?" value={form.description} onChange={set('description')} rows={3} />
              </div>
            </>
          )}

          <button id="register-submit-btn" type="submit" className="btn btn-primary btn-full btn-lg" disabled={loading}>
            {loading ? 'Submitting...' : isProvider ? '📨 Submit Application' : 'Create your account'}
          </button>
        </form>

        <div className="auth-divider">Already have an account?</div>
        <Link to="/login" className="btn btn-secondary btn-full">Sign in</Link>

        {!isProvider && (
          <div style={{ textAlign: 'center', marginTop: 'var(--sp-3)', fontSize: 'var(--font-size-xs)' }}>
            Want to sell? <Link to="/register/provider" style={{ color: 'var(--color-link)' }}>Become a Provider</Link>
          </div>
        )}
      </div>
    </div>
  )
}
