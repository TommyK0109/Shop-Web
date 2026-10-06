import { Router } from "express";
import { addCartItemSchema, updateCartItemSchema } from "@storefront/shared";
import { validate } from "../middleware/validate.middleware";
import { asyncHandler } from "../middleware/errorHandler.middleware";
import { requireAuth } from "../middleware/auth.middleware";
import {
  getCart,
  addCartItem,
  updateCartItem,
  removeCartItem,
  dismissRemovalNotices,
} from "../controllers/cart.controller";

export const cartRouter = Router();

cartRouter.use(requireAuth);

cartRouter.get("/", asyncHandler(getCart));
cartRouter.post("/items", validate(addCartItemSchema), asyncHandler(addCartItem));
cartRouter.patch("/items/:id", validate(updateCartItemSchema), asyncHandler(updateCartItem));
cartRouter.delete("/items/:id", asyncHandler(removeCartItem));
// Acknowledges the "the seller removed this" notices, so they show once.
cartRouter.post("/notices/dismiss", asyncHandler(dismissRemovalNotices));
