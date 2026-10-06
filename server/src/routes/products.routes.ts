import { Router } from "express";
import {
  adminCreateProductSchema,
  createReviewSchema,
  productQuerySchema,
  productSuggestQuerySchema,
  updateProductSchema,
} from "@storefront/shared";
import { validate } from "../middleware/validate.middleware";
import { asyncHandler } from "../middleware/errorHandler.middleware";
import { requireAuth } from "../middleware/auth.middleware";
import { requireRole } from "../middleware/requireRole.middleware";
import {
  listProducts,
  suggestProducts,
  getProductBySlug,
  createProduct,
  updateProduct,
  deleteProduct,
} from "../controllers/products.controller";
import { createReview, listProductReviews } from "../controllers/reviews.controller";

export const productsRouter = Router();

productsRouter.get("/", validate(productQuerySchema, "query"), asyncHandler(listProducts));
// Registered before /:slug (and named distinctly from it) so "suggestions"
// is never read as a product slug.
productsRouter.get(
  "/suggestions",
  validate(productSuggestQuerySchema, "query"),
  asyncHandler(suggestProducts),
);
// Reviews are addressed by product *id* (not slug) to match the plan's API
// table; registered before /:slug so "reviews" is never read as a slug.
productsRouter.get("/:id/reviews", asyncHandler(listProductReviews));
productsRouter.post(
  "/:id/reviews",
  requireAuth,
  validate(createReviewSchema),
  asyncHandler(createReview),
);

productsRouter.get("/:slug", asyncHandler(getProductBySlug));
productsRouter.post(
  "/",
  requireAuth,
  requireRole("admin"),
  validate(adminCreateProductSchema),
  asyncHandler(createProduct),
);
productsRouter.patch(
  "/:id",
  requireAuth,
  requireRole("admin"),
  validate(updateProductSchema),
  asyncHandler(updateProduct),
);
productsRouter.delete("/:id", requireAuth, requireRole("admin"), asyncHandler(deleteProduct));
