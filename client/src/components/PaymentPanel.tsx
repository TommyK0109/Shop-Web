import { useState } from "react";
import { useMarkPaymentTransferred } from "../hooks/usePayments";
import { formatPrice } from "../lib/format";
import type { Payment, PaymentStatus } from "../api/types";

const STATUS_LABEL: Record<PaymentStatus, string> = {
  pending: "Awaiting your transfer",
  awaiting_confirmation: "Waiting for the seller to confirm",
  succeeded: "Payment confirmed",
  failed: "Payment not received",
  refunded: "Refunded",
};

const STATUS_STYLE: Record<PaymentStatus, string> = {
  pending: "bg-amber-100 text-amber-900",
  awaiting_confirmation: "bg-blue-100 text-blue-900",
  succeeded: "bg-green-100 text-green-900",
  failed: "bg-red-100 text-red-900",
  refunded: "bg-gray-100 text-gray-700",
};

function formatVnd(amount: number): string {
  return `${amount.toLocaleString("vi-VN")} ₫`;
}

/** One labelled bank field with a copy button, for buyers who can't scan. */
function CopyableField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
    }
  }

  return (
    <div className="flex items-baseline justify-between gap-3 py-1">
      <span className="shrink-0 text-xs text-gray-500">{label}</span>
      <span className="flex items-baseline gap-2 text-right">
        <span className="font-mono text-sm text-gray-900">{value}</span>
        <button type="button" onClick={copy} className="shrink-0 text-xs text-link hover:underline">
          {copied ? "Copied" : "Copy"}
        </button>
      </span>
    </div>
  );
}

/**
Demo payment panel for a single payment in an order. The server renders the QR
as an inline SVG, and the bank details are frozen on the row so they can't drift
if the seller edits their account later. The plain bank fields are there for
anyone who can't scan.
 */
export function PaymentPanel({ payment, sellerName }: { payment: Payment; sellerName: string }) {
  const markPaid = useMarkPaymentTransferred();
  const isSettled = payment.status === "succeeded" || payment.status === "refunded";

  return (
    <div className="rounded border border-gray-200 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium text-gray-900">{sellerName}</p>
        <span className={`rounded-full px-3 py-1 text-xs font-medium ${STATUS_STYLE[payment.status]}`}>
          {STATUS_LABEL[payment.status]}
        </span>
      </div>

      <p className="mt-1 text-sm text-gray-600">
        {formatPrice(payment.amountCents)}{" "}
        <span className="text-gray-400">· {formatVnd(payment.amountVnd)} to transfer</span>
      </p>

      {payment.status === "failed" && payment.failureReason && (
        <p role="alert" className="mt-3 rounded bg-red-50 px-3 py-2 text-xs text-red-800">
          The seller couldn't match your transfer: {payment.failureReason}
        </p>
      )}

      {!isSettled && (
        <div className="mt-4 flex flex-col gap-4 sm:flex-row">
          {/* The server omits the QR once a payment is settled — there is
              nothing left to pay — so this is null on exactly the branch that
              doesn't render anyway. */}
          {payment.qrSvg && (
            <div className="shrink-0">
              {/* Server-rendered SVG. Safe to inline despite the payload
                  containing seller-supplied text (the account name): the QR
                  encoder emits pure geometry — one path of rectangles — and
                  never writes any of the encoded string into the markup. */}
              <div
                className="h-40 w-40 [&>svg]:h-full [&>svg]:w-full"
                // eslint-disable-next-line react/no-danger
                dangerouslySetInnerHTML={{ __html: payment.qrSvg }}
                role="img"
                aria-label={`Payment QR code for ${sellerName}`}
              />
              <p className="mt-1 text-center text-xs text-gray-400">Scan in your banking app</p>
            </div>
          )}

          <div className="min-w-0 flex-1">
            <p className="text-xs text-gray-500">Or transfer manually</p>
            <div className="mt-1 divide-y divide-gray-100">
              <CopyableField label="Bank" value={payment.bank.name} />
              <CopyableField label="Account" value={payment.bank.accountNumber} />
              <CopyableField label="Name" value={payment.bank.accountName} />
              <CopyableField label="Amount" value={String(payment.amountVnd)} />
              <CopyableField label="Description" value={payment.reference} />
            </div>
            {/* The reference is the only link between a bank transfer and this
                order — the seller has nothing else to match against. */}
            <p className="mt-2 text-xs text-gray-500">
              Include <span className="font-mono font-medium">{payment.reference}</span> in the transfer
              description so the seller can find your payment.
            </p>
          </div>
        </div>
      )}

      {payment.status === "pending" || payment.status === "failed" ? (
        <button
          type="button"
          onClick={() => markPaid.mutate(payment.id)}
          disabled={markPaid.isPending}
          className="mt-4 rounded bg-accent px-4 py-2 text-sm font-medium text-ink hover:bg-accent-dark disabled:opacity-60"
        >
          {markPaid.isPending ? "Saving…" : "I've made this transfer"}
        </button>
      ) : null}

      {payment.status === "awaiting_confirmation" && (
        <p className="mt-4 text-xs text-gray-500">
          Completed payment. The store will confirm it soon. You can check your order status in your account.
        </p>
      )}

      {markPaid.isError && (
        <p role="alert" className="mt-2 text-xs text-red-600">
          {(markPaid.error as Error).message}
        </p>
      )}
    </div>
  );
}
