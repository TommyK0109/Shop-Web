import { Link, useParams } from "react-router-dom";
import { useCancelOrder, useOrder } from "../hooks/useOrders";
import { formatPrice } from "../lib/format";
import { groupItemsBySeller } from "../lib/orderGroups";
import { ShipmentTracker } from "../components/ShipmentTracker";
import { PaymentPanel } from "../components/PaymentPanel";
import type { OrderStatus } from "../api/types";

const STATUS_LABEL: Record<OrderStatus, string> = {
  pending_payment: "Awaiting payment",
  partially_paid: "Partly paid — some stores still to pay",
  paid: "Payment confirmed",
  cancelled: "Cancelled",
};

export function OrderConfirmationPage() {
  const { id } = useParams<{ id: string }>();
  const { data, isLoading, isError } = useOrder(id);
  const cancelOrder = useCancelOrder(id!);

  if (isLoading) return <p className="py-12 text-center text-gray-500">Loading…</p>;
  if (isError || !data) return <p className="py-12 text-center text-red-600">Order not found.</p>;

  const { order } = data;
  const groups = groupItemsBySeller(order.items);

  return (
    <div className="mx-auto max-w-2xl">
      <div className="rounded bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Order #{order.id.slice(0, 8)}</h1>
            <p className="mt-1 text-sm text-gray-600">{STATUS_LABEL[order.status] ?? order.status}</p>
          </div>
          {/* Only while nobody has been paid yet — once a seller confirms a
              transfer, backing out is a refund, not a cancellation. */}
          {order.status === "pending_payment" && (
            <button
              type="button"
              disabled={cancelOrder.isPending}
              onClick={() => cancelOrder.mutate()}
              className="shrink-0 rounded border border-red-200 px-3 py-1 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-60"
            >
              {cancelOrder.isPending ? "Cancelling…" : "Cancel order"}
            </button>
          )}
        </div>
        {cancelOrder.isError && (
          <p role="alert" className="mt-2 text-xs text-red-600">
            {(cancelOrder.error as Error).message}
          </p>
        )}
        {(order.status === "pending_payment" || order.status === "partially_paid") && (
          <p className="mt-1 text-xs text-gray-400">
            Each store confirms its own transfer. This updates automatically as they do.
          </p>
        )}

        {/* Payment lives on the order, one panel per store: an order spanning
            three sellers is three transfers that settle independently. */}
        {order.payments.length > 0 && (
          <section className="mt-6">
            <h2 className="text-sm font-semibold text-gray-900">
              {order.payments.length === 1 ? "Payment" : `Payments (${order.payments.length} stores)`}
            </h2>
            <div className="mt-3 space-y-4">
              {order.payments.map((payment) => (
                <PaymentPanel
                  key={payment.id}
                  payment={payment}
                  sellerName={
                    groups.find((group) => group.sellerId === payment.sellerId)?.seller.businessName ??
                    "This store"
                  }
                />
              ))}
            </div>
          </section>
        )}

        {/* Grouped by seller rather than listed flat: each store fulfils its
            own items, so each gets its own shipment status. */}
        <div className="mt-6 divide-y divide-gray-100 border-t border-gray-100">
          {groups.map((group) => (
            <section key={group.sellerId} className="py-4">
              <p className="text-sm text-gray-600">
                Sold by{" "}
                <Link to={`/sellers/${group.seller.slug}`} className="text-link hover:underline">
                  {group.seller.businessName}
                </Link>
              </p>

              <ul className="mt-2 space-y-2">
                {group.items.map((item) => (
                  <li key={item.id} className="flex items-start justify-between text-sm">
                    <Link to={`/products/${item.product.slug}`} className="text-gray-900 hover:underline">
                      {item.product.name} × {item.quantity}
                    </Link>
                    <span className="ml-4 shrink-0 text-gray-900">
                      {formatPrice(item.unitPriceCents * item.quantity)}
                    </span>
                  </li>
                ))}
              </ul>

              <div className="mt-3 max-w-xs">
                <ShipmentTracker shipment={group.shipment} />
              </div>
            </section>
          ))}
        </div>

        <div className="mt-4 flex items-center justify-between border-t border-gray-100 pt-4 text-base font-semibold text-gray-900">
          <span>Total</span>
          <span>{formatPrice(order.totalCents)}</span>
        </div>

        <p className="mt-4 text-sm text-gray-600">
          Shipping to {order.shippingAddress.line1}, {order.shippingAddress.city}, {order.shippingAddress.country}
        </p>

        <Link to="/orders" className="mt-6 inline-block text-sm text-link hover:underline">
          ← All your orders
        </Link>
      </div>
    </div>
  );
}
