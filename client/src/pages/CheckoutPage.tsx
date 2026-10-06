import { type FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useCart } from "../hooks/useCart";
import { useCreateOrder } from "../hooks/useOrders";
import { formatPrice } from "../lib/format";
import { ApiError } from "../api/client";

export function CheckoutPage() {
  const navigate = useNavigate();
  const { data, isLoading } = useCart();
  const createOrder = useCreateOrder();

  const [line1, setLine1] = useState("");
  const [city, setCity] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [country, setCountry] = useState("");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    try {
      const result = await createOrder.mutateAsync({ line1, city, postalCode, country });
      // Payment happens on the order page now: buyers transfer to each store
      // directly, so there is nowhere off-site to send them.
      navigate(`/orders/${result.orderId}`);
    } catch {
      // surfaced below via createOrder.error
    }
  }

  if (isLoading) return <p className="py-12 text-center text-gray-500">Loading…</p>;

  const cart = data?.cart;

  if (!cart || cart.purchasableCount === 0) {
    return (
      <div className="py-16 text-center">
        <p className="text-gray-600">
          {cart && cart.items.length > 0
            ? "Nothing in your cart can be checked out right now."
            : "Your cart is empty."}
        </p>
        <button type="button" onClick={() => navigate("/")} className="mt-4 text-link hover:underline">
          Continue shopping
        </button>
      </div>
    );
  }

  const serverError = createOrder.error instanceof ApiError ? createOrder.error.message : null;

  return (
    <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Shipping address</h1>
        <form id="checkout-form" onSubmit={handleSubmit} className="mt-4 space-y-4 rounded bg-white p-6 shadow-sm">
          <div>
            <label htmlFor="line1" className="block text-sm font-medium text-gray-700">
              Address
            </label>
            <input
              id="line1"
              value={line1}
              onChange={(e) => setLine1(e.target.value)}
              required
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="city" className="block text-sm font-medium text-gray-700">
                City
              </label>
              <input
                id="city"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                required
                className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label htmlFor="postalCode" className="block text-sm font-medium text-gray-700">
                Postal code
              </label>
              <input
                id="postalCode"
                value={postalCode}
                onChange={(e) => setPostalCode(e.target.value)}
                required
                className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div>
            <label htmlFor="country" className="block text-sm font-medium text-gray-700">
              Country
            </label>
            <input
              id="country"
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              required
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
            />
          </div>

          {serverError && <p className="text-sm text-red-600">{serverError}</p>}
        </form>
      </div>

      <div>
        <h1 className="text-xl font-semibold text-gray-900">Order summary</h1>
        <div className="mt-4 rounded bg-white p-6 shadow-sm">
          <ul className="divide-y divide-gray-100">
            {cart.items
              .filter((item) => item.unavailableReason === null)
              .map((item) => (
                <li key={item.id} className="flex justify-between py-2 text-sm">
                  <span className="text-gray-700">
                    {item.product.name} × {item.quantity}
                  </span>
                  <span className="text-gray-900">{formatPrice(item.product.priceCents * item.quantity)}</span>
                </li>
              ))}
          </ul>

          {/* Unavailable lines aren't ordered and aren't removed either —
              they're still in the cart when the seller restocks. */}
          {cart.unavailableCount > 0 && (
            <p className="mt-3 rounded bg-amber-50 px-3 py-2 text-xs text-amber-900">
              {cart.unavailableCount} unavailable{" "}
              {cart.unavailableCount === 1 ? "item is" : "items are"} excluded from this order and left in your
              cart.
            </p>
          )}

          <div className="mt-4 flex items-center justify-between border-t border-gray-100 pt-4 text-base font-semibold text-gray-900">
            <span>Total</span>
            <span>{formatPrice(cart.totalCents)}</span>
          </div>

          <p className="mt-3 text-xs text-gray-500">
            You'll get a payment QR for each store in this order on the next screen. Each store is paid
            directly and confirms its own transfer.
          </p>

          <button
            type="submit"
            form="checkout-form"
            disabled={createOrder.isPending}
            className="mt-6 w-full rounded bg-accent py-2 text-sm font-medium text-ink hover:bg-accent-dark disabled:opacity-60"
          >
            {createOrder.isPending ? "Placing order…" : "Place order"}
          </button>
        </div>
      </div>
    </div>
  );
}
