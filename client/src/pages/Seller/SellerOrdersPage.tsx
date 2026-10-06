import { type FormEvent, useState } from "react";
import { Link } from "react-router-dom";
import { useCreateShipment, useMySeller, useMySellerOrders, useUpdateShipment } from "../../hooks/useSeller";
import { ShipmentTracker } from "../../components/ShipmentTracker";
import { formatPrice } from "../../lib/format";
import type { SellerOrderGroup, ShipmentStatus } from "../../api/types";

// Same forward-only ladder the server enforces in shipments.controller.ts —
// duplicated here purely to label the button, never to decide the outcome.
const NEXT_STATUS: Record<ShipmentStatus, Exclude<ShipmentStatus, "confirmed"> | null> = {
  confirmed: "packed",
  packed: "received",
  received: null,
};

const NEXT_LABEL: Record<string, string> = {
  packed: "Mark as packed",
  received: "Mark as received",
};

const inputClass = "w-full rounded border border-gray-300 px-2 py-1 text-sm outline-none focus:border-accent-dark";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

/** "Confirm this order" — creates the one shipment covering my items in it. */
function ConfirmOrderForm({ orderId, disabled }: { orderId: string; disabled: boolean }) {
  const [carrier, setCarrier] = useState("");
  const [trackingNumber, setTrackingNumber] = useState("");
  const createShipment = useCreateShipment();

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    createShipment.mutate({
      orderId,
      carrier: carrier.trim() || undefined,
      trackingNumber: trackingNumber.trim() || undefined,
    });
  }

  if (disabled) {
    return <p className="text-xs text-gray-500">Your store must be approved before you can confirm orders.</p>;
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <p className="text-xs text-gray-600">
        Confirming creates one shipment covering all of your items in this order.
      </p>
      <input
        value={carrier}
        onChange={(e) => setCarrier(e.target.value)}
        placeholder="Carrier (optional)"
        aria-label={`Carrier for order ${orderId.slice(0, 8)}`}
        className={inputClass}
      />
      <input
        value={trackingNumber}
        onChange={(e) => setTrackingNumber(e.target.value)}
        placeholder="Tracking number (optional)"
        aria-label={`Tracking number for order ${orderId.slice(0, 8)}`}
        className={inputClass}
      />
      <button
        type="submit"
        disabled={createShipment.isPending}
        className="w-full rounded bg-accent py-1.5 text-xs font-medium text-ink hover:bg-accent-dark disabled:opacity-60"
      >
        {createShipment.isPending ? "Confirming…" : "Confirm order"}
      </button>
      {createShipment.isError && (
        <p role="alert" className="text-xs text-red-600">
          {(createShipment.error as Error).message}
        </p>
      )}
    </form>
  );
}

/** Advances an existing shipment one step. No carrier feeds this — see PLAN.md §4. */
function AdvanceShipment({ group }: { group: SellerOrderGroup }) {
  const updateShipment = useUpdateShipment();
  const shipment = group.shipment;
  if (!shipment) return null;

  const next = NEXT_STATUS[shipment.status];

  return (
    <div className="mt-3 space-y-2">
      {next ? (
        <button
          type="button"
          disabled={updateShipment.isPending}
          onClick={() => updateShipment.mutate({ id: shipment.id, input: { status: next } })}
          className="w-full rounded bg-accent py-1.5 text-xs font-medium text-ink hover:bg-accent-dark disabled:opacity-60"
        >
          {updateShipment.isPending ? "Updating…" : NEXT_LABEL[next]}
        </button>
      ) : (
        <p className="text-xs text-gray-500">This shipment is complete.</p>
      )}
      {updateShipment.isError && (
        <p role="alert" className="text-xs text-red-600">
          {(updateShipment.error as Error).message}
        </p>
      )}
    </div>
  );
}

function SellerOrderCard({ group, canConfirm }: { group: SellerOrderGroup; canConfirm: boolean }) {
  return (
    <article className="rounded bg-white shadow-sm">
      <header className="flex flex-wrap items-center gap-4 border-b border-gray-100 px-4 py-3 text-xs text-gray-500">
        <div>
          <p className="font-medium uppercase tracking-wide">Order placed</p>
          <p>{formatDate(group.createdAt)}</p>
        </div>
        <div>
          <p className="font-medium uppercase tracking-wide">Order #</p>
          <p>{group.orderId.slice(0, 8)}</p>
        </div>
        <div>
          <p className="font-medium uppercase tracking-wide">Customer</p>
          <p>{group.customerEmail}</p>
        </div>
        <div className="ml-auto text-right">
          <p className="font-medium uppercase tracking-wide">Your subtotal</p>
          <p className="text-sm text-gray-900">{formatPrice(group.subtotalCents)}</p>
        </div>
      </header>

      <div className="flex flex-wrap gap-6 px-4 py-4">
        <div className="min-w-0 flex-1">
          <ul className="space-y-3">
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
                  <Link to={`/products/${item.product.slug}`} className="text-sm text-link hover:underline">
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

          <address className="mt-4 not-italic text-xs text-gray-500">
            <span className="font-medium uppercase tracking-wide">Ship to</span>
            <br />
            {group.shippingAddress.line1}, {group.shippingAddress.city} {group.shippingAddress.postalCode},{" "}
            {group.shippingAddress.country}
          </address>
        </div>

        <div className="w-full shrink-0 sm:w-64">
          {group.shipment ? (
            <>
              <ShipmentTracker shipment={group.shipment} />
              <AdvanceShipment group={group} />
            </>
          ) : (
            <ConfirmOrderForm orderId={group.orderId} disabled={!canConfirm} />
          )}
        </div>
      </div>
    </article>
  );
}

export function SellerOrdersPage() {
  const { data: sellerData } = useMySeller();
  const { data, isLoading, isError } = useMySellerOrders();

  const canConfirm = sellerData?.seller?.status === "approved";

  if (isLoading) return <p className="py-12 text-center text-gray-500">Loading…</p>;
  if (isError || !data) return <p className="py-12 text-center text-red-600">Couldn't load your orders.</p>;

  return (
    <div>
      <p className="mb-4 text-xs text-gray-500">
        Paid orders containing your items. You only ever see your own line items — another seller's share of a
        shared order, and the order's overall total, stay hidden.
      </p>

      {data.orders.length === 0 ? (
        <p className="rounded bg-white p-8 text-center text-sm text-gray-600 shadow-sm">
          No paid orders yet.
        </p>
      ) : (
        <div className="space-y-4">
          {data.orders.map((group) => (
            <SellerOrderCard key={group.orderId} group={group} canConfirm={canConfirm} />
          ))}
        </div>
      )}
    </div>
  );
}
