import { Router } from "express";
import { asyncHandler } from "../middleware/errorHandler.middleware";
import { requireAuth } from "../middleware/auth.middleware";
import { markPaymentTransferred } from "../controllers/payments.controller";

export const paymentsRouter = Router();

// Buyer-side settlement only. The seller-side confirm/reject lives under
// /api/sellers/me/payments, where the seller-ownership middleware already is.
//
// There is no unauthenticated gateway callback any more: money moves directly
// between the buyer's bank and the seller's, so nothing external ever calls
// this API to report a payment.
paymentsRouter.post("/:id/mark-paid", requireAuth, asyncHandler(markPaymentTransferred));
