import { Link } from "react-router-dom";
import { useOrders } from "../hooks/useOrders";
import { formatPrice } from "../lib/format";
import { groupItemsBySeller } from "../lib/orderGroups";
import { ShipmentTracker } from "../components/ShipmentTracker";
import type { Order, OrderStatus } from "../api/types";

const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  pending_payment: "Awaiting payment",
  // Each store in an order is paid separately, so an order can genuinely sit
  // half-settled — that is a normal state, not an error.
  partially_paid: "Partly paid",
  paid: "Paid",
  cancelled: "Cancelled",
};

const ORDER_STATUS_STYLE: Record<OrderStatus, string> = {
  pending_payment: "bg-amber-100 text-amber-800",
  partially_paid: "bg-blue-100 text-blue-800",
  paid: "bg-emerald-100 text-emerald-800",
  cancelled: "bg-gray-200 text-gray-600",
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

function OrderCard({ order }: { order: Order }) {
  const groups = groupItemsBySeller(order.items);

  return (
    <article className="rounded bg-white shadow-sm">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 px-4 py-3">
        <div className="text-xs text-gray-500">
          <p className="font-medium uppercase tracking-wide">Order placed</p>
          <p>{formatDate(order.createdAt)}</p>
        </div>
        <div className="text-xs text-gray-500">
          <p className="font-medium uppercase tracking-wide">Total</p>
          <p>{formatPrice(order.totalCents)}</p>
        </div>
        <div className="text-xs text-gray-500">
          <p className="font-medium uppercase tracking-wide">Order #</p>
          <p>{order.id.slice(0, 8)}</p>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${ORDER_STATUS_STYLE[order.status]}`}>
            {ORDER_STATUS_LABEL[order.status]}
          </span>
          <Link to={`/orders/${order.id}`} className="text-sm text-link hover:underline">
            Order details
          </Link>
        </div>
      </header>

      {/* One block per seller: a single order can be part-received from one
          store while another store hasn't confirmed yet. */}
      <div className="divide-y divide-gray-100">
        {groups.map((group) => (
          <section key={group.sellerId} className="px-4 py-4">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <p className="text-sm text-gray-600">
                  Sold by{" "}
                  <Link to={`/sellers/${group.seller.slug}`} className="text-link hover:underline">
                    {group.seller.businessName}
                  </Link>
                </p>

                <ul className="mt-3 space-y-3">
                  {group.items.map((item) => (
                    <li key={item.id} className="flex items-center gap-3">
                      {item.product.images[0] ? (
                        <img
                          src={item.product.images[0].url}
                          alt=""
                          className="h-14 w-14 shrink-0 rounded border border-gray-100 object-contain"
                        />
                      ) : (
                        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded border border-gray-100 text-[10px] text-gray-400">
                          No image
                        </span>
                      )}
                      <div className="min-w-0">
                        <Link
                          to={`/products/${item.product.slug}`}
                          className="text-sm text-link hover:underline"
                        >
                          {item.product.name}
                        </Link>
                        <p className="text-xs text-gray-500">
                          Qty {item.quantity} · {formatPrice(item.unitPriceCents)} each
                        </p>
                      </div>
                      <span className="ml-auto shrink-0 text-sm text-gray-900">
                        {formatPrice(item.unitPriceCents * item.quantity)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="w-full shrink-0 sm:w-56">
                <ShipmentTracker shipment={group.shipment} />
                <p className="mt-2 text-xs text-gray-500">
                  Subtotal {formatPrice(group.subtotalCents)}
                </p>
              </div>
            </div>
          </section>
        ))}
      </div>
    </article>
  );
}

export function OrdersPage() {
  const { data, isLoading, isError } = useOrders();

  if (isLoading) return <p className="py-12 text-center text-gray-500">Loading…</p>;
  if (isError || !data) return <p className="py-12 text-center text-red-600">Could not load your orders.</p>;

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="mb-4 text-xl font-semibold text-gray-900">Your orders</h1>

      {data.orders.length === 0 ? (
        <div className="rounded bg-white p-8 text-center shadow-sm">
          <p className="text-gray-600">You haven't placed any orders yet.</p>
          <Link to="/" className="mt-3 inline-block text-sm text-link hover:underline">
            Start shopping
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {data.orders.map((order) => (
            <OrderCard key={order.id} order={order} />
          ))}
        </div>
      )}
    </div>
  );
}
