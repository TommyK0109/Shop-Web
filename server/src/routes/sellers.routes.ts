import { Router } from "express";
import {
  createProductSchema,
  createShipmentSchema,
  rejectPaymentSchema,
  sellerApplicationSchema,
  setProductAvailabilitySchema,
  updatePaymentMethodSchema,
  updateProductSchema,
  updateShipmentSchema,
} from "@storefront/shared";
import { validate } from "../middleware/validate.middleware";
import { asyncHandler } from "../middleware/errorHandler.middleware";
import { requireAuth } from "../middleware/auth.middleware";
import {
  requireSeller,
  requireApprovedSeller,
  requireProductOwner,
  requireShipmentOwner,
} from "../middleware/requireOwnership.middleware";
import { upload } from "../middleware/upload.middleware";
import {
  getSellerBySlug,
  applyToSell,
  getMySeller,
  listMyProducts,
  createMyProduct,
  updateMyProduct,
  setMyProductAvailability,
  deleteMyProduct,
  uploadMyProductImage,
  getMyPaymentMethod,
  updateMyPaymentMethod,
} from "../controllers/sellers.controller";
import {
  listMyPayments,
  confirmPaymentReceived,
  rejectPayment,
} from "../controllers/payments.controller";
import {
  listMySellerOrders,
  createShipment,
  updateShipment,
  listMyShipments,
} from "../controllers/shipments.controller";

export const sellersRouter = Router();

sellersRouter.post("/apply", requireAuth, validate(sellerApplicationSchema), asyncHandler(applyToSell));

sellersRouter.get("/me", requireAuth, requireSeller, asyncHandler(getMySeller));
sellersRouter.get("/me/products", requireAuth, requireSeller, asyncHandler(listMyProducts));
sellersRouter.post(
  "/me/products",
  requireAuth,
  requireSeller,
  requireApprovedSeller,
  validate(createProductSchema),
  asyncHandler(createMyProduct),
);
sellersRouter.patch(
  "/me/products/:id",
  requireAuth,
  requireSeller,
  requireProductOwner,
  validate(updateProductSchema),
  asyncHandler(updateMyProduct),
);
// Confirming a listing is out of stock (or back on sale). This is the only
// action that clears a product out of customers' carts, which is why it is a
// route of its own rather than a field on PATCH /me/products/:id.
sellersRouter.patch(
  "/me/products/:id/availability",
  requireAuth,
  requireSeller,
  requireProductOwner,
  validate(setProductAvailabilitySchema),
  asyncHandler(setMyProductAvailability),
);
// Soft delete: archives the listing, never removes the row.
sellersRouter.delete(
  "/me/products/:id",
  requireAuth,
  requireSeller,
  requireProductOwner,
  asyncHandler(deleteMyProduct),
);
sellersRouter.post(
  "/me/products/:id/images",
  requireAuth,
  requireSeller,
  requireProductOwner,
  upload.single("image"),
  asyncHandler(uploadMyProductImage),
);

// --- Fulfilment: my orders and the shipments that cover them ---------------
sellersRouter.get("/me/orders", requireAuth, requireSeller, asyncHandler(listMySellerOrders));
sellersRouter.get("/me/shipments", requireAuth, requireSeller, asyncHandler(listMyShipments));
sellersRouter.post(
  "/me/shipments",
  requireAuth,
  requireSeller,
  requireApprovedSeller,
  validate(createShipmentSchema),
  asyncHandler(createShipment),
);
sellersRouter.patch(
  "/me/shipments/:id",
  requireAuth,
  requireSeller,
  requireShipmentOwner,
  validate(updateShipmentSchema),
  asyncHandler(updateShipment),
);

// --- Getting paid ---------------------------------------------------------
// The store's own bank details, and the transfers buyers owe it. Every one of
// these is scoped to the caller's own seller row by requireSeller, so a store
// can never read or settle another store's money.
sellersRouter.get("/me/payment-method", requireAuth, requireSeller, asyncHandler(getMyPaymentMethod));
sellersRouter.put(
  "/me/payment-method",
  requireAuth,
  requireSeller,
  validate(updatePaymentMethodSchema),
  asyncHandler(updateMyPaymentMethod),
);
sellersRouter.get("/me/payments", requireAuth, requireSeller, asyncHandler(listMyPayments));
sellersRouter.post(
  "/me/payments/:id/confirm",
  requireAuth,
  requireSeller,
  requireApprovedSeller,
  asyncHandler(confirmPaymentReceived),
);
sellersRouter.post(
  "/me/payments/:id/reject",
  requireAuth,
  requireSeller,
  requireApprovedSeller,
  validate(rejectPaymentSchema),
  asyncHandler(rejectPayment),
);

// Public storefront page — kept below /me/* so "me" isn't ever parsed as a slug.
sellersRouter.get("/:slug", asyncHandler(getSellerBySlug));
