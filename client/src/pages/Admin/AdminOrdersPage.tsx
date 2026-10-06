import { useState } from "react";
import { Link } from "react-router-dom";
import { useAdminOrders, useUpdateOrderStatus } from "../../hooks/useAdmin";
import { Pagination } from "../../components/Pagination";
import { formatPrice } from "../../lib/format";
import { SHIPMENT_LABEL } from "../../lib/orderGroups";
import type { AdminOrder, AdminOrderItem, OrderStatus } from "../../api/types";

const PAGE_SIZE = 20;

const STATUS_FILTERS: Array<{ value: OrderStatus | "all"; label: string }> = [
  { value: "all", label: "All" },
  { value: "pending_payment", label: "Awaiting payment" },
  { value: "partially_paid", label: "Partly paid" },
  { value: "paid", label: "Paid" },
  { value: "cancelled", label: "Cancelled" },
];

/**
 * Cancelling is the only order-level decision left to an admin: paid-ness is
 * derived from the per-seller payments, and only the seller who was actually
 * paid can establish it.
 */
const ADMIN_ORDER_ACTIONS = [
  { value: "active" as const, label: "Active" },
  { value: "cancelled" as const, label: "Cancelled" },
];

/** Groups one order's items by seller — the cross-seller view's whole point. */
function bySeller(items: AdminOrderItem[]) {
  const groups = new Map<string, { businessName: string; slug: string; items: AdminOrderItem[] }>();
  for (const item of items) {
    let group = groups.get(item.sellerId);
    if (!group) {
      group = { businessName: item.seller.businessName, slug: item.seller.slug, items: [] };
      groups.set(item.sellerId, group);
    }
    group.items.push(item);
  }
  return [...groups.values()];
}

function OrderRow({ order }: { order: AdminOrder }) {
  const [expanded, setExpanded] = useState(false);
  const updateStatus = useUpdateOrderStatus();
  const sellerGroups = bySeller(order.items);

  return (
    <li className="px-4 py-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          className="font-mono text-xs text-link hover:underline"
        >
          {expanded ? "▾" : "▸"} {order.id.slice(0, 8)}
        </button>
        <span className="text-gray-600">{order.user.email}</span>
        <span className="text-gray-500">
          {new Date(order.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
        </span>
        <span className="text-gray-500">
          {sellerGroups.length} seller{sellerGroups.length === 1 ? "" : "s"} · {order.items.length} item
          {order.items.length === 1 ? "" : "s"}
        </span>
        <span className="ml-auto font-medium text-gray-900">{formatPrice(order.totalCents)}</span>

        <select
          aria-label={`Status of order ${order.id.slice(0, 8)}`}
          value={order.status === "cancelled" ? "cancelled" : "active"}
          disabled={updateStatus.isPending}
          onChange={(e) =>
            updateStatus.mutate({ id: order.id, status: e.target.value as "active" | "cancelled" })
          }
          className="rounded border border-gray-300 px-2 py-1 text-xs disabled:opacity-60"
        >
          {ADMIN_ORDER_ACTIONS.map((action) => (
            <option key={action.value} value={action.value}>
              {action.label}
            </option>
          ))}
        </select>
      </div>

      {expanded && (
        <div className="mt-3 space-y-3 border-l-2 border-gray-100 pl-4">
          <p className="text-xs text-gray-500">
            Ship to {order.shippingAddress.line1}, {order.shippingAddress.city}{" "}
            {order.shippingAddress.postalCode}, {order.shippingAddress.country}
            {order.payments.length > 0 &&
              ` · ${order.payments.filter((p) => p.status === "succeeded").length}/${order.payments.length} stores paid`}
          </p>

          {sellerGroups.map((group) => (
            <div key={group.slug}>
              <p className="text-xs font-medium text-gray-700">
                <Link to={`/sellers/${group.slug}`} className="text-link hover:underline">
                  {group.businessName}
                </Link>
                {" — "}
                <span className="font-normal text-gray-500">
                  {group.items[0].shipment
                    ? SHIPMENT_LABEL[group.items[0].shipment.status]
                    : "not yet confirmed"}
                </span>
              </p>
              <ul className="mt-1 space-y-0.5">
                {group.items.map((item) => (
                  <li key={item.id} className="flex justify-between text-xs text-gray-600">
                    <Link to={`/products/${item.product.slug}`} className="hover:underline">
                      {item.product.name} × {item.quantity}
                    </Link>
                    <span>{formatPrice(item.unitPriceCents * item.quantity)}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      {updateStatus.isError && (
        <p role="alert" className="mt-1 text-xs text-red-600">
          {(updateStatus.error as Error).message}
        </p>
      )}
    </li>
  );
}

export function AdminOrdersPage() {
  const [status, setStatus] = useState<OrderStatus | "all">("all");
  const [page, setPage] = useState(1);
  const { data, isLoading, isError } = useAdminOrders({
    status: status === "all" ? undefined : status,
    page,
    limit: PAGE_SIZE,
  });

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-2">
        {STATUS_FILTERS.map((filter) => (
          <button
            key={filter.value}
            type="button"
            onClick={() => {
              setStatus(filter.value);
              setPage(1);
            }}
            className={`rounded-full px-3 py-1 text-xs ${
              status === filter.value ? "bg-ink text-white" : "bg-white text-gray-600 hover:bg-gray-100"
            }`}
          >
            {filter.label}
          </button>
        ))}
      </div>

      {isLoading && <p className="text-sm text-gray-500">Loading orders…</p>}
      {isError && <p className="text-sm text-red-600">Couldn't load orders.</p>}

      {data && (
        <>
          <p className="mb-2 text-xs text-gray-500">{data.pagination.total} orders</p>
          {data.orders.length === 0 ? (
            <p className="rounded bg-white p-8 text-center text-sm text-gray-500 shadow-sm">
              No orders match this filter.
            </p>
          ) : (
            <ul className="divide-y divide-gray-100 rounded bg-white shadow-sm">
              {data.orders.map((order) => (
                <OrderRow key={order.id} order={order} />
              ))}
            </ul>
          )}

          {data.pagination.totalPages > 1 && (
            <div className="mt-4">
              <Pagination
                page={data.pagination.page}
                totalPages={data.pagination.totalPages}
                onPageChange={setPage}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}
