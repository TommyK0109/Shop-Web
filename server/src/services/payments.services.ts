import type { OrderStatus, Payment, Prisma } from "@prisma/client";
import { AppError } from "../middleware/errorHandler.middleware";
import { buildVietQrPayload, generateDemoPaymentMethod, generatePaymentReference, renderQrSvg } from "./vietqr.services";

/**
 * This project prices in integer USD-style cents, but the QR settles in VND,
 * which has no sub-unit. Converting at a hard-coded rate would be a lie
 * dressed as arithmetic, so the rate lives here as one named constant with
 * its provenance stated, rather than being smeared through the controllers.
 *
 * A production build would price in VND natively (or hold a rate fetched from
 * a real FX source, with the rate used stamped on each Payment row so a past
 * order can still be reconciled).
 */
export const VND_PER_CENT = 250;

export function centsToVnd(cents: number): number {
  return Math.round(cents * VND_PER_CENT);
}

/**
 * Ensures a seller has bank details. Called when a seller applies, so no
 * store ever reaches "approved" without a way to be paid — and again as a
 * safety net at checkout for the seed's and older rows' benefit.
 */
export async function ensurePaymentMethod(tx: Prisma.TransactionClient, sellerId: string, businessName: string) {
  const existing = await tx.sellerPaymentMethod.findUnique({ where: { sellerId } });
  if (existing) return existing;

  return tx.sellerPaymentMethod.create({
    data: { sellerId, ...generateDemoPaymentMethod(businessName) },
  });
}

export interface SellerSlice {
  sellerId: string;
  businessName: string;
  amountCents: number;
}

/**
 * Splits an order into one payment per seller.
 *
 * Buyers transfer straight into each store's own account, so an order that
 * spans three stores is three independent transfers. Each row freezes the
 * amount and the bank details it was created against: a seller editing their
 * account later must not change what a past buyer was told to pay, or where.
 */
export async function createPaymentsForOrder(
  tx: Prisma.TransactionClient,
  orderId: string,
  slices: SellerSlice[],
): Promise<void> {
  for (const slice of slices) {
    const method = await ensurePaymentMethod(tx, slice.sellerId, slice.businessName);
    await tx.payment.create({
      data: {
        orderId,
        sellerId: slice.sellerId,
        amountCents: slice.amountCents,
        reference: generatePaymentReference(),
        status: "pending",
        bankBin: method.bankBin,
        bankName: method.bankName,
        accountNumber: method.accountNumber,
        accountName: method.accountName,
      },
    });
  }
}

/**
 * Rebuilds the QR a buyer was shown, from the snapshot on the Payment row.
 *
 * Every input is frozen on the row, so this is a pure function of stored data
 * rather than a lookup of the seller's *current* details — regenerating is
 * cheaper and less error-prone than storing the same string twice.
 */
export async function renderPaymentQr(payment: Payment): Promise<{ payload: string; svg: string }> {
  const payload = buildVietQrPayload({
    bankBin: payment.bankBin,
    accountNumber: payment.accountNumber,
    amountVnd: centsToVnd(payment.amountCents),
    reference: payment.reference,
  });
  return { payload, svg: await renderQrSvg(payload) };
}

/** A payment that is settled needs no QR: there is nothing left to pay. */
function needsQr(payment: Payment): boolean {
  return payment.status !== "succeeded" && payment.status !== "refunded";
}

/**
 * What the buyer needs to pay one store, ready to render. The QR is the happy
 * path; the plain bank details are there because a QR is useless to someone
 * paying from a desktop or a bank whose app does not scan.
 *
 * The QR is only generated for payments that still need one. Order lists
 * serialize every payment on every order, and rendering a matrix for
 * already-settled ones is pure waste.
 */
export async function serializePayment(payment: Payment) {
  const qr = needsQr(payment) ? await renderPaymentQr(payment) : null;
  return {
    id: payment.id,
    orderId: payment.orderId,
    sellerId: payment.sellerId,
    status: payment.status,
    amountCents: payment.amountCents,
    amountVnd: centsToVnd(payment.amountCents),
    reference: payment.reference,
    bank: {
      bin: payment.bankBin,
      name: payment.bankName,
      accountNumber: payment.accountNumber,
      accountName: payment.accountName,
    },
    qrPayload: qr?.payload ?? null,
    qrSvg: qr?.svg ?? null,
    markedPaidAt: payment.markedPaidAt,
    confirmedAt: payment.confirmedAt,
    rejectedAt: payment.rejectedAt,
    failureReason: payment.failureReason,
  };
}

export async function serializePayments(payments: Payment[]) {
  return Promise.all(payments.map(serializePayment));
}

/**
 * An order's status is now derived, not set: it is a summary of its seller
 * payments rather than a fact of its own. `cancelled` is the exception — that
 * is an administrative decision about the order itself, so it is never
 * overwritten by payment activity.
 */
export function deriveOrderStatus(
  payments: Array<{ status: string }>,
  current: OrderStatus,
): OrderStatus {
  if (current === "cancelled") return "cancelled";
  if (payments.length === 0) return "pending_payment";

  const succeeded = payments.filter((p) => p.status === "succeeded").length;
  if (succeeded === 0) return "pending_payment";
  if (succeeded === payments.length) return "paid";
  return "partially_paid";
}

/** Recomputes and persists an order's derived status. */
export async function refreshOrderStatus(tx: Prisma.TransactionClient, orderId: string): Promise<OrderStatus> {
  const order = await tx.order.findUniqueOrThrow({
    where: { id: orderId },
    select: { status: true, payments: { select: { status: true } } },
  });

  const next = deriveOrderStatus(order.payments, order.status);
  if (next !== order.status) {
    await tx.order.update({ where: { id: orderId }, data: { status: next } });
  }
  return next;
}

/** The states a buyer is allowed to move a payment out of. */
export function assertBuyerCanMarkPaid(payment: Payment): void {
  if (payment.status === "succeeded") {
    throw new AppError(409, "This payment has already been confirmed by the seller");
  }
  if (payment.status === "awaiting_confirmation") {
    throw new AppError(409, "You have already marked this as transferred");
  }
  if (payment.status === "refunded") {
    throw new AppError(409, "This payment has been refunded");
  }
}

/** The states a seller is allowed to settle. */
export function assertSellerCanSettle(payment: Payment): void {
  if (payment.status === "succeeded") {
    throw new AppError(409, "This payment is already confirmed");
  }
  if (payment.status === "refunded") {
    throw new AppError(409, "This payment has been refunded");
  }
}
