import type { Request, Response } from "express";
import type { RejectPaymentInput } from "@storefront/shared";
import { prisma } from "../lib/prisma";
import { AppError } from "../middleware/errorHandler.middleware";
import {
  assertBuyerCanMarkPaid,
  assertSellerCanSettle,
  refreshOrderStatus,
  serializePayment,
} from "../services/payments.services";

/**
 * Money moves directly between the buyer's bank and the seller's, so the
 * platform never sees it. That makes settlement a two-party claim rather than
 * a gateway callback:
 *
 *   buyer says "I transferred"  ->  awaiting_confirmation
 *   seller checks their account ->  succeeded | failed
 *
 * The seller's word is what counts, because the seller is the only party who
 * can actually see the money arrive. The buyer's step is not required — a
 * seller can confirm a transfer that landed before the buyer clicked
 * anything — but it tells the seller where to look.
 */

// --- Buyer side -------------------------------------------------------------

/** POST /api/payments/:id/mark-paid */
export async function markPaymentTransferred(req: Request, res: Response) {
  const payment = await prisma.payment.findUnique({
    where: { id: req.params.id },
    include: { order: { select: { userId: true } } },
  });
  if (!payment) {
    throw new AppError(404, "Payment not found");
  }
  if (payment.order.userId !== req.user!.id) {
    throw new AppError(403, "This payment belongs to someone else's order");
  }
  assertBuyerCanMarkPaid(payment);

  const updated = await prisma.payment.update({
    where: { id: payment.id },
    data: {
      status: "awaiting_confirmation",
      markedPaidAt: new Date(),
      // Re-declaring after a rejection clears the old reason, so the buyer
      // isn't left staring at a stale "we couldn't find your transfer".
      rejectedAt: null,
      failureReason: null,
    },
  });

  res.json({ payment: await serializePayment(updated) });
}

// --- Seller side ------------------------------------------------------------

/**
 * GET /api/sellers/me/payments — every transfer owed to this store.
 *
 * Scoped to the caller's own seller id, so one store can never see another's
 * takings. Ordered with the ones actually waiting on the seller first.
 */
export async function listMyPayments(req: Request, res: Response) {
  const payments = await prisma.payment.findMany({
    where: { sellerId: req.seller!.id },
    include: {
      order: {
        select: {
          id: true,
          createdAt: true,
          status: true,
          user: { select: { id: true, email: true } },
        },
      },
    },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
  });

  res.json({
    payments: await Promise.all(
      payments.map(async ({ order, ...payment }) => ({
        ...(await serializePayment(payment)),
        order: { id: order.id, createdAt: order.createdAt, status: order.status },
        customerEmail: order.user.email,
      })),
    ),
  });
}

/**
 * POST /api/sellers/me/payments/:id/confirm — "the money arrived."
 *
 * This is the single action that unlocks fulfilment for this seller's slice
 * of the order, and the one that makes a later review count as a verified
 * purchase.
 */
export async function confirmPaymentReceived(req: Request, res: Response) {
  const payment = await prisma.payment.findUnique({ where: { id: req.params.id } });
  if (!payment) {
    throw new AppError(404, "Payment not found");
  }
  // Ownership boundary: a payment that isn't mine doesn't exist as far as
  // this store is concerned.
  if (payment.sellerId !== req.seller!.id) {
    throw new AppError(404, "Payment not found");
  }
  assertSellerCanSettle(payment);

  const updated = await prisma.$transaction(async (tx) => {
    const confirmed = await tx.payment.update({
      where: { id: payment.id },
      data: {
        status: "succeeded",
        confirmedAt: new Date(),
        rejectedAt: null,
        failureReason: null,
      },
    });
    // The order's own status is derived from its payments — one seller being
    // paid may move the order to partially_paid or, if they were the last,
    // to paid.
    await refreshOrderStatus(tx, payment.orderId);
    return confirmed;
  });

  res.json({ payment: await serializePayment(updated) });
}

/** POST /api/sellers/me/payments/:id/reject — "nothing arrived." */
export async function rejectPayment(req: Request, res: Response) {
  const { reason } = req.body as RejectPaymentInput;

  const payment = await prisma.payment.findUnique({ where: { id: req.params.id } });
  if (!payment) {
    throw new AppError(404, "Payment not found");
  }
  if (payment.sellerId !== req.seller!.id) {
    throw new AppError(404, "Payment not found");
  }
  assertSellerCanSettle(payment);

  const updated = await prisma.$transaction(async (tx) => {
    const rejected = await tx.payment.update({
      where: { id: payment.id },
      data: { status: "failed", rejectedAt: new Date(), failureReason: reason, markedPaidAt: null },
    });
    await refreshOrderStatus(tx, payment.orderId);
    return rejected;
  });

  res.json({ payment: await serializePayment(updated) });
}
