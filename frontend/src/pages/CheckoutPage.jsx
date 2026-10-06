import { useState, useEffect } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { CheckCircle2, Package, CreditCard, MapPin } from 'lucide-react'
import { useCartStore, useAuthStore } from '../stores/index.js'
import { api } from '../services/api.js'

const STEPS = [
  { id: 1, label: 'Address',  icon: <MapPin size={14} /> },
  { id: 2, label: 'Payment',  icon: <CreditCard size={14} /> },
  { id: 3, label: 'Review',   icon: <Package size={14} /> },
]

function StepsHeader({ step }) {
  return (
    <div className="checkout-steps">
      {STEPS.map((s, i) => (
        <div key={s.id} className={`checkout-step ${step === s.id ? 'active' : step > s.id ? 'done' : ''}`} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {i > 0 && <div className="checkout-step-sep" />}
          <div className="checkout-step__num">{step > s.id ? '✓' : s.id}</div>
          <span className="checkout-step__label">{s.icon} {s.label}</span>
        </div>
      ))}
    </div>
  )
}

function AddressStep({ form, setForm, onNext }) {
  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }))

  const handleContinue = () => {
    if (!form.full || !form.street || !form.city || !form.zip || !form.phone) {
      alert('Please fill in all required fields.');
      return;
    }
    onNext();
  };

  return (
    <div>
      <h2 style={{ fontWeight: 700, fontSize: 'var(--font-size-xl)', marginBottom: 'var(--sp-4)' }}>Shipping Address</h2>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--sp-4)' }}>
        <div className="form-group" style={{ gridColumn: '1 / -1' }}>
          <label className="form-label">Full Name</label>
          <input id="checkout-name" className="form-input" placeholder="John Doe" value={form.full} onChange={set('full')} />
        </div>
        <div className="form-group" style={{ gridColumn: '1 / -1' }}>
          <label className="form-label">Street Address</label>
          <input id="checkout-street" className="form-input" placeholder="123 Main Street, Apt 4B" value={form.street} onChange={set('street')} />
        </div>
        <div className="form-group">
          <label className="form-label">City</label>
          <input id="checkout-city" className="form-input" placeholder="Ho Chi Minh City" value={form.city} onChange={set('city')} />
        </div>
        <div className="form-group">
          <label className="form-label">Province</label>
          <input id="checkout-province" className="form-input" placeholder="HCM" value={form.province} onChange={set('province')} />
        </div>
        <div className="form-group">
          <label className="form-label">ZIP / Postal Code</label>
          <input id="checkout-zip" className="form-input" placeholder="70000" value={form.zip} onChange={set('zip')} />
        </div>
        <div className="form-group">
          <label className="form-label">Phone Number</label>
          <input id="checkout-phone" className="form-input" placeholder="+84 012 345 6789" value={form.phone} onChange={set('phone')} />
        </div>
      </div>
      <button id="checkout-next-address" className="btn btn-primary btn-lg" onClick={handleContinue}>Continue to Payment →</button>
    </div>
  )
}

function PaymentStep({ method, setMethod, onNext, onBack }) {
  return (
    <div>
      <h2 style={{ fontWeight: 700, fontSize: 'var(--font-size-xl)', marginBottom: 'var(--sp-4)' }}>Payment Method</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)', marginBottom: 'var(--sp-6)' }}>
        {[
          { id: 'card',   label: 'Credit / Debit Card',   icon: '💳' },
          { id: 'paypal', label: 'PayPal',                icon: '🅿️' },
          { id: 'cod',    label: 'Cash on Delivery',      icon: '💵' },
        ].map(m => (
          <label key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)', padding: 'var(--sp-4)', border: `2px solid ${method === m.id ? 'var(--color-primary)' : 'var(--color-border)'}`, borderRadius: 'var(--radius-md)', cursor: 'pointer', background: method === m.id ? 'var(--color-primary-light)' : 'var(--color-surface)', transition: 'all 0.2s' }}>
            <input type="radio" name="payment" value={m.id} checked={method === m.id} onChange={() => setMethod(m.id)} />
            <span style={{ fontSize: 24 }}>{m.icon}</span>
            <span style={{ fontWeight: 600 }}>{m.label}</span>
          </label>
        ))}
      </div>
      {method === 'card' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--sp-4)', marginBottom: 'var(--sp-4)' }}>
          <div className="form-group" style={{ gridColumn: '1 / -1' }}>
            <label className="form-label">Card Number (Stripe sandbox: use 4242...)</label>
            <input id="card-number" className="form-input" placeholder="4242 4242 4242 4242" />
          </div>
          <div className="form-group">
            <label className="form-label">Expiry</label>
            <input id="card-expiry" className="form-input" placeholder="MM/YY" />
          </div>
          <div className="form-group">
            <label className="form-label">CVV</label>
            <input id="card-cvv" className="form-input" placeholder="123" />
          </div>
        </div>
      )}
      <div style={{ display: 'flex', gap: 'var(--sp-3)' }}>
        <button className="btn btn-secondary btn-lg" onClick={onBack}>← Back</button>
        <button id="checkout-next-payment" className="btn btn-primary btn-lg" onClick={onNext}>Review Order →</button>
      </div>
    </div>
  )
}

function ReviewStep({ isPlacing, onPlace, onBack }) {
  const items   = useCartStore(s => s.items)
  const subtotal = items.reduce((s, i) => s + i.price * i.qty, 0)

  return (
    <div>
      <h2 style={{ fontWeight: 700, fontSize: 'var(--font-size-xl)', marginBottom: 'var(--sp-4)' }}>Review Your Order</h2>
      <div style={{ background: 'var(--color-bg-alt)', borderRadius: 'var(--radius-md)', padding: 'var(--sp-4)', marginBottom: 'var(--sp-4)' }}>
        {items.map(item => (
          <div key={item.id} style={{ display: 'flex', gap: 'var(--sp-3)', padding: 'var(--sp-2) 0', borderBottom: '1px solid var(--color-border)', alignItems: 'center' }}>
            <img src={item.images?.[0]} alt={item.title} style={{ width: 60, height: 60, objectFit: 'contain', borderRadius: 'var(--radius-sm)', background: '#fff', padding: 4 }} />
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, lineHeight: 1.3, marginBottom: 2 }}>{item.title.slice(0, 50)}…</p>
              <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>Qty: {item.qty}</p>
            </div>
            <strong>${(item.price * item.qty).toFixed(2)}</strong>
          </div>
        ))}
        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, padding: 'var(--sp-3) 0 0', fontSize: 'var(--font-size-lg)' }}>
          <span>Total:</span>
          <span>${(subtotal * 1.1).toFixed(2)}</span>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 'var(--sp-3)' }}>
        <button className="btn btn-secondary btn-lg" onClick={onBack} disabled={isPlacing}>← Back</button>
        <button id="place-order-btn" className="btn btn-buynow btn-lg" style={{ flex: 1 }} onClick={onPlace} disabled={isPlacing}>
          {isPlacing ? 'Processing Order...' : 'Place Order & Pay 🎉'}
        </button>
      </div>
    </div>
  )
}

function SuccessPage({ orderId }) {
  return (
    <div style={{ textAlign: 'center', padding: 'var(--sp-12) var(--sp-4)' }}>
      <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'var(--color-success-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto var(--sp-6)', animation: 'fadeIn 0.4s ease' }}>
        <CheckCircle2 size={40} style={{ color: 'var(--color-success)' }} />
      </div>
      <h1 style={{ fontSize: 'var(--font-size-3xl)', fontWeight: 700, marginBottom: 'var(--sp-3)', animation: 'slideUp 0.4s ease 0.1s both' }}>
        Order Placed!
      </h1>
      <p style={{ color: 'var(--color-text-secondary)', marginBottom: 'var(--sp-2)', fontSize: 'var(--font-size-md)', animation: 'slideUp 0.4s ease 0.2s both' }}>
        Thank you for your purchase! 🎉
      </p>
      <p style={{ color: 'var(--color-text-secondary)', marginBottom: 'var(--sp-6)', fontSize: 'var(--font-size-sm)', animation: 'slideUp 0.4s ease 0.25s both' }}>
        Order ID: <strong>{orderId}</strong> — We'll email you when it ships.
      </p>
      <div style={{ display: 'flex', gap: 'var(--sp-3)', justifyContent: 'center', flexWrap: 'wrap', animation: 'slideUp 0.4s ease 0.3s both' }}>
        <Link to="/account/orders" className="btn btn-primary btn-lg">Track My Order</Link>
        <Link to="/" className="btn btn-secondary btn-lg">Continue Shopping</Link>
      </div>
    </div>
  )
}

export default function CheckoutPage() {
  const [step, setStep]       = useState(1)
  const [isPlacing, setIsPlacing] = useState(false)
  const [searchParams]        = useSearchParams()
  const clearCart             = useCartStore(s => s.clearCart)

  const successSessionId = searchParams.get('session_id')
  const successOrderId   = searchParams.get('order_id')

  // Address Form State
  const [addressForm, setAddressForm] = useState({
    full: '',
    street: '',
    city: '',
    province: '',
    zip: '',
    phone: ''
  });

  // Payment Method State
  const [paymentMethod, setPaymentMethod] = useState('card');

  const handlePlace = async () => {
    setIsPlacing(true);
    try {
      // 1. Create order on Express backend
      const orderRes = await api.post('/orders', {
        paymentMethod,
        shippingAddress: addressForm
      });
      
      const order = orderRes.data;

      // 2. Clear frontend cart
      clearCart();

      // 3. Initiate payment session
      const payRes = await api.post('/payments/checkout', {
        orderId: order.id
      });

      // 4. Redirect to payment checkout url (Stripe or Mock Checkout Page)
      if (payRes.data.url) {
        window.location.href = payRes.data.url;
      } else {
        alert('Order placed successfully, but checkout session initialization failed.');
        setIsPlacing(false);
      }
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.error || 'Failed to place order. Try again.');
      setIsPlacing(false);
    }
  };

  if (successSessionId || successOrderId) {
    return (
      <div className="container page-content">
        <div className="widget" style={{ maxWidth: 640, margin: '0 auto' }}>
          <SuccessPage orderId={successOrderId || 'ORD-SUCCESS'} />
        </div>
      </div>
    )
  }

  return (
    <div className="container page-content">
      <div style={{ maxWidth: 740, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)', marginBottom: 'var(--sp-6)' }}>
          <Link to="/" style={{ fontSize: 'var(--font-size-xl)', fontWeight: 700, color: 'var(--color-header)', textDecoration: 'none' }}>
            <span style={{ color: 'var(--color-primary)' }}>Mixi</span><span style={{ color: 'var(--color-header)' }}> Shop</span>
          </Link>
          <span style={{ color: 'var(--color-text-muted)' }}>|</span>
          <span style={{ fontWeight: 600 }}>Secure Checkout 🔒</span>
        </div>

        <StepsHeader step={step} />

        <div className="widget">
          {step === 1 && (
            <AddressStep 
              form={addressForm} 
              setForm={setAddressForm} 
              onNext={() => setStep(2)} 
            />
          )}
          {step === 2 && (
            <PaymentStep 
              method={paymentMethod} 
              setMethod={setPaymentMethod} 
              onNext={() => setStep(3)} 
              onBack={() => setStep(1)} 
            />
          )}
          {step === 3 && (
            <ReviewStep 
              isPlacing={isPlacing} 
              onPlace={handlePlace} 
              onBack={() => setStep(2)} 
            />
          )}
        </div>
      </div>
    </div>
  )
}
