import type { Shipment } from "../api/types";
import { SHIPMENT_LABEL, SHIPMENT_STEPS } from "../lib/orderGroups";

/**
 * The three-step fulfilment strip for one seller's shipment. Status is
 * self-reported by the seller (no carrier integration — see PLAN.md §4), so
 * a null shipment means that seller simply hasn't confirmed the order yet.
 */
export function ShipmentTracker({ shipment }: { shipment: Shipment | null }) {
  if (!shipment) {
    return (
      <p className="text-xs text-gray-500">
        Waiting for the seller to confirm this part of your order.
      </p>
    );
  }

  const currentStep = SHIPMENT_STEPS.indexOf(shipment.status);

  return (
    <div>
      <ol className="flex items-center gap-1" aria-label={`Shipment status: ${SHIPMENT_LABEL[shipment.status]}`}>
        {SHIPMENT_STEPS.map((step, i) => {
          const reached = i <= currentStep;
          return (
            <li key={step} className="flex flex-1 items-center gap-1">
              <span
                aria-hidden
                className={`h-1.5 w-full rounded-full ${reached ? "bg-accent-dark" : "bg-gray-200"}`}
              />
              <span
                className={`shrink-0 text-[11px] capitalize ${
                  reached ? "font-medium text-gray-900" : "text-gray-400"
                }`}
              >
                {step}
              </span>
            </li>
          );
        })}
      </ol>

      <p className="mt-1.5 text-xs text-gray-600">{SHIPMENT_LABEL[shipment.status]}</p>
      {shipment.trackingNumber && (
        <p className="text-xs text-gray-500">
          {shipment.carrier ? `${shipment.carrier} · ` : ""}
          Tracking {shipment.trackingNumber}
        </p>
      )}
    </div>
  );
}
