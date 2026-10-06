import { type FormEvent, useState } from "react";
import { updatePaymentMethodSchema } from "@storefront/shared";
import {
  useConfirmPayment,
  useMyPaymentMethod,
  useMyPayments,
  useRejectPayment,
  useUpdateMyPaymentMethod,
} from "../../hooks/usePayments";
import { formatPrice } from "../../lib/format";
import type { PaymentStatus, SellerPayment } from "../../api/types";

const STATUS_LABEL: Record<PaymentStatus, string> = {
  pending: "Awaiting buyer transfer",
  awaiting_confirmation: "Buyer says they've paid",
  succeeded: "Confirmed",
  failed: "Rejected",
  refunded: "Refunded",
};

const STATUS_STYLE: Record<PaymentStatus, string> = {
  pending: "bg-gray-100 text-gray-700",
  awaiting_confirmation: "bg-amber-100 text-amber-900",
  succeeded: "bg-emerald-100 text-emerald-800",
  failed: "bg-red-100 text-red-800",
  refunded: "bg-gray-200 text-gray-600",
};

const inputClass =
  "mt-1 w-full rounded border border-gray-300 px-2 py-1 text-sm outline-none focus:border-accent-dark";

/**
 * Where this store's money goes.
 *
 * Editing these details only affects future orders — every payment already
 * created snapshots the account it was raised against, so a buyer who has
 * been shown a QR keeps being shown that same QR.
 */
function PaymentMethodCard() {
  const { data, isLoading } = useMyPaymentMethod();
  const update = useUpdateMyPaymentMethod();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ bankBin: "", accountNumber: "", accountName: "" });
  const [validationError, setValidationError] = useState<string | null>(null);

  if (isLoading) return <p className="text-sm text-gray-500">Loading your payment details…</p>;
  if (!data) return null;

  const { paymentMethod, banks } = data;

  function startEditing() {
    setForm({
      bankBin: paymentMethod.bankBin,
      accountNumber: paymentMethod.accountNumber,
      accountName: paymentMethod.accountName,
    });
    setValidationError(null);
    setEditing(true);
  }

  function handleSave(e: FormEvent) {
    e.preventDefault();
    const parsed = updatePaymentMethodSchema.safeParse(form);
    if (!parsed.success) {
      setValidationError(parsed.error.issues[0]?.message ?? "Check the values");
      return;
    }
    setValidationError(null);
    update.mutate(parsed.data, { onSuccess: () => setEditing(false) });
  }

  return (
    <section className="mb-8 rounded bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-gray-900">How you get paid</h2>
        {!editing && (
          <button type="button" onClick={startEditing} className="text-xs text-link hover:underline">
            Edit
          </button>
        )}
      </div>

      {editing ? (
        <form onSubmit={handleSave} className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3 sm:items-end">
          <label className="block text-xs text-gray-600">
            Bank
            <select
              value={form.bankBin}
              onChange={(e) => setForm({ ...form, bankBin: e.target.value })}
              className={inputClass}
            >
              {banks.map((bank) => (
                <option key={bank.bin} value={bank.bin}>
                  {bank.name}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-xs text-gray-600">
            Account number
            <input
              inputMode="numeric"
              value={form.accountNumber}
              onChange={(e) => setForm({ ...form, accountNumber: e.target.value })}
              className={inputClass}
            />
          </label>

          <label className="block text-xs text-gray-600">
            Account holder
            <input
              value={form.accountName}
              onChange={(e) => setForm({ ...form, accountName: e.target.value })}
              className={inputClass}
            />
          </label>

          <div className="flex flex-wrap items-center gap-3 sm:col-span-3">
            <button
              type="submit"
              disabled={update.isPending}
              className="rounded bg-accent px-4 py-1 text-xs font-medium text-ink hover:bg-accent-dark disabled:opacity-60"
            >
              {update.isPending ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="text-xs text-gray-500 hover:underline"
            >
              Cancel
            </button>
            {(validationError || update.isError) && (
              <span role="alert" className="text-xs text-red-600">
                {validationError ?? (update.error as Error).message}
              </span>
            )}
          </div>
        </form>
      ) : (
        <dl className="mt-2 grid grid-cols-1 gap-x-6 gap-y-1 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-xs text-gray-500">Bank</dt>
            <dd className="text-gray-900">{paymentMethod.bankName}</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500">Account number</dt>
            <dd className="font-mono text-gray-900">{paymentMethod.accountNumber}</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500">Account holder</dt>
            <dd className="text-gray-900">{paymentMethod.accountName}</dd>
          </div>
        </dl>
      )}

      <p className="mt-3 text-xs text-gray-500">
        Buyers transfer straight into this account and scan a QR built from it — the platform never holds your
        money. Changing these details only affects future orders.
      </p>
    </section>
  );
}

function PaymentRow({ payment }: { payment: SellerPayment }) {
  const confirm = useConfirmPayment();
  const reject = useRejectPayment();
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");

  const settled = payment.status === "succeeded" || payment.status === "refunded";
  const error = confirm.error ?? reject.error;

  return (
    <li className="px-4 py-3 text-sm">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <span className="font-mono text-xs text-gray-500">{payment.reference}</span>
        <span className="text-gray-600">{payment.customerEmail}</span>
        <span className="text-xs text-gray-500">
          order {payment.order.id.slice(0, 8)} ·{" "}
          {new Date(payment.order.createdAt).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          })}
        </span>
        <span className="ml-auto font-medium text-gray-900">{formatPrice(payment.amountCents)}</span>
        <span className={`rounded-full px-3 py-1 text-xs font-medium ${STATUS_STYLE[payment.status]}`}>
          {STATUS_LABEL[payment.status]}
        </span>
      </div>

      {payment.status === "failed" && payment.failureReason && (
        <p className="mt-1 text-xs text-red-700">You rejected this: {payment.failureReason}</p>
      )}

      {!settled && (
        <div className="mt-2 flex flex-wrap items-center gap-3">
          {/* Confirming is what releases this order into the seller's own
              fulfilment queue — nothing else can. */}
          <button
            type="button"
            onClick={() => confirm.mutate(payment.id)}
            disabled={confirm.isPending}
            className="rounded bg-accent px-3 py-1 text-xs font-medium text-ink hover:bg-accent-dark disabled:opacity-60"
          >
            {confirm.isPending ? "Confirming…" : "I've received this"}
          </button>

          {rejecting ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                reject.mutate(
                  { id: payment.id, input: { reason: reason.trim() } },
                  { onSuccess: () => setRejecting(false) },
                );
              }}
              className="flex flex-wrap items-center gap-2"
            >
              <input
                aria-label={`Reason for rejecting ${payment.reference}`}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Nothing arrived / wrong amount"
                className="rounded border border-gray-300 px-2 py-1 text-xs"
              />
              <button
                type="submit"
                disabled={reject.isPending || reason.trim() === ""}
                className="rounded border border-red-300 px-3 py-1 text-xs text-red-700 hover:bg-red-50 disabled:opacity-60"
              >
                {reject.isPending ? "Rejecting…" : "Reject"}
              </button>
              <button
                type="button"
                onClick={() => setRejecting(false)}
                className="text-xs text-gray-500 hover:underline"
              >
                Cancel
              </button>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => setRejecting(true)}
              className="text-xs text-gray-500 hover:underline"
            >
              Not received
            </button>
          )}
        </div>
      )}

      {error && (
        <p role="alert" className="mt-1 text-xs text-red-600">
          {(error as Error).message}
        </p>
      )}
    </li>
  );
}

export function SellerPaymentsPage() {
  const { data, isLoading, isError } = useMyPayments();

  const waiting = data?.payments.filter((p) => p.status === "awaiting_confirmation") ?? [];

  return (
    <div>
      <PaymentMethodCard />

      <h2 className="mb-2 text-sm font-semibold text-gray-900">Transfers</h2>
      {waiting.length > 0 && (
        <p className="mb-3 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          {waiting.length} {waiting.length === 1 ? "buyer says they've" : "buyers say they've"} transferred.
          Check your account, then confirm — confirming is what puts the order in your fulfilment queue.
        </p>
      )}

      {isLoading && <p className="text-sm text-gray-500">Loading your transfers…</p>}
      {isError && <p className="text-sm text-red-600">Couldn't load your transfers.</p>}

      {data &&
        (data.payments.length === 0 ? (
          <p className="rounded bg-white p-8 text-center text-sm text-gray-600 shadow-sm">
            No orders to be paid for yet.
          </p>
        ) : (
          <ul className="divide-y divide-gray-100 rounded bg-white shadow-sm">
            {data.payments.map((payment) => (
              <PaymentRow key={payment.id} payment={payment} />
            ))}
          </ul>
        ))}
    </div>
  );
}
