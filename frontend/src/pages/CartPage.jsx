import { Link, useNavigate } from 'react-router-dom'
import { Trash2, ShoppingBag, ArrowRight, Tag } from 'lucide-react'
import { useCartStore, useToastStore } from '../stores/index.js'
import { QtyControl, EmptyState } from '../components/ui.jsx'

import { useEffect } from 'react'

export default function CartPage() {
  const navigate  = useNavigate()
  const items     = useCartStore(s => s.items)
  const removeItem = useCartStore(s => s.removeItem)
  const updateQty  = useCartStore(s => s.updateQty)
  const fetchCart  = useCartStore(s => s.fetchCart)
  const showToast  = useToastStore(s => s.show)

  useEffect(() => {
    fetchCart()
  }, [fetchCart])

  const subtotal = items.reduce((s, i) => s + i.price * i.qty, 0)
  const savings  = items.reduce((s, i) => s + ((i.originalPrice || i.price) - i.price) * i.qty, 0)
  const shipping = subtotal >= 25 ? 0 : 4.99
  const total    = subtotal + shipping

  if (items.length === 0) {
    return (
      <div className="container page-content">
        <EmptyState
          icon="🛒"
          title="Your cart is empty"
          text="Looks like you haven't added anything yet. Browse our products and find something you'll love!"
          action={<Link to="/" className="btn btn-primary btn-lg">Continue Shopping</Link>}
        />
      </div>
    )
  }

  return (
    <div className="container page-content">
      <div className="cart-layout">
        {/* Cart Items */}
        <div>
          <h1 className="cart-title">
            Shopping Cart
            <span style={{ float: 'right', fontSize: 'var(--font-size-base)', color: 'var(--color-link)', cursor: 'pointer' }}>
              Price
            </span>
          </h1>

          {items.map(item => (
            <div key={item.id} className="cart-item">
              {/* Image */}
              <div className="cart-item__img-wrap" onClick={() => navigate(`/product/${item.id}`)} style={{ cursor: 'pointer' }}>
                <img className="cart-item__img" src={item.images?.[0]} alt={item.title} />
              </div>

              {/* Details */}
              <div>
                <p className="cart-item__title" onClick={() => navigate(`/product/${item.id}`)}>
                  {item.title}
                </p>
                <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginBottom: 4 }}>
                  Sold by: <span style={{ color: 'var(--color-link)' }}>{item.provider?.name}</span>
                </p>
                <p className="cart-item__stock">In Stock</p>
                <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-success)', marginBottom: 8 }}>
                  FREE Delivery
                </p>
                <div className="cart-item__actions">
                  <QtyControl qty={item.qty} min={1} max={10} onChange={q => updateQty(item.id, q)} />
                  <span className="cart-item__sep">|</span>
                  <button className="cart-item__action-btn" onClick={() => { removeItem(item.id); showToast('Item removed from cart') }}>
                    <Trash2 size={13} style={{ display: 'inline', marginRight: 2 }} />Delete
                  </button>
                  <span className="cart-item__sep">|</span>
                  <button className="cart-item__action-btn">Save for later</button>
                </div>
              </div>

              {/* Price */}
              <div className="cart-item__price">
                ${(item.price * item.qty).toFixed(2)}
                {item.originalPrice && (
                  <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', textDecoration: 'line-through' }}>
                    ${(item.originalPrice * item.qty).toFixed(2)}
                  </div>
                )}
              </div>
            </div>
          ))}

          {savings > 0 && (
            <p style={{ textAlign: 'right', padding: 'var(--sp-3) 0', fontSize: 'var(--font-size-base)', color: 'var(--color-danger)' }}>
              Your order qualifies for FREE Shipping. <strong>You save ${savings.toFixed(2)}</strong>!
            </p>
          )}

          <p style={{ textAlign: 'right', fontSize: 'var(--font-size-xl)', paddingTop: 'var(--sp-3)', borderTop: '1px solid var(--color-border)' }}>
            Subtotal ({items.reduce((a, i) => a + i.qty, 0)} items):
            <strong style={{ marginLeft: 8 }}>${subtotal.toFixed(2)}</strong>
          </p>
        </div>

        {/* Order Summary */}
        <div className="order-summary-box">
          {subtotal < 25 && (
            <div style={{ background: 'var(--color-success-bg)', border: '1px solid var(--color-success)', borderRadius: 'var(--radius-sm)', padding: 'var(--sp-3)', marginBottom: 'var(--sp-4)', fontSize: 'var(--font-size-sm)', color: 'var(--color-success)' }}>
              Add <strong>${(25 - subtotal).toFixed(2)}</strong> more to get FREE shipping!
            </div>
          )}

          <h2 className="order-summary-title">Order Summary</h2>
          <div className="order-summary-row">
            <span>Items ({items.reduce((a, i) => a + i.qty, 0)}):</span>
            <span>${subtotal.toFixed(2)}</span>
          </div>
          {savings > 0 && (
            <div className="order-summary-row" style={{ color: 'var(--color-danger)' }}>
              <span>Discount:</span>
              <span>-${savings.toFixed(2)}</span>
            </div>
          )}
          <div className="order-summary-row">
            <span>Shipping:</span>
            <span style={{ color: shipping === 0 ? 'var(--color-success)' : undefined }}>
              {shipping === 0 ? 'FREE' : `$${shipping.toFixed(2)}`}
            </span>
          </div>
          <div className="order-summary-row" style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
            <span>Tax (10%):</span>
            <span>${(total * 0.1).toFixed(2)}</span>
          </div>
          <div className="order-summary-total">
            <span>Order Total:</span>
            <span>${(total * 1.1).toFixed(2)}</span>
          </div>

          {/* Promo Code */}
          <div style={{ marginBottom: 'var(--sp-4)' }}>
            <div style={{ display: 'flex', gap: 'var(--sp-2)' }}>
              <input className="form-input" placeholder="Promo code" style={{ flex: 1 }} id="promo-code-input" />
              <button className="btn btn-secondary" style={{ flexShrink: 0 }}>
                <Tag size={15} /> Apply
              </button>
            </div>
          </div>

          <button
            id="proceed-to-checkout-btn"
            className="btn btn-buynow btn-xl btn-full"
            onClick={() => navigate('/checkout')}
          >
            Proceed to Checkout <ArrowRight size={18} />
          </button>

          <div style={{ textAlign: 'center', marginTop: 'var(--sp-3)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--sp-2)', color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-xs)' }}>
            🔒 Secure checkout — your data is protected
          </div>
        </div>
      </div>
    </div>
  )
}
