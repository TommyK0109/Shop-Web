import { Router } from "express";
import { createOrderSchema, updateOrderStatusSchema } from "@storefront/shared";
import { validate } from "../middleware/validate.middleware";
import { asyncHandler } from "../middleware/errorHandler.middleware";
import { requireAuth } from "../middleware/auth.middleware";
import { requireRole } from "../middleware/requireRole.middleware";
import {
  createOrder,
  listMyOrders,
  getOrderById,
  updateOrderStatus,
  cancelMyOrder,
} from "../controllers/orders.controller";

export const ordersRouter = Router();

ordersRouter.post("/", requireAuth, validate(createOrderSchema), asyncHandler(createOrder));
ordersRouter.get("/", requireAuth, asyncHandler(listMyOrders));
ordersRouter.get("/:id", requireAuth, asyncHandler(getOrderById));
ordersRouter.post("/:id/cancel", requireAuth, asyncHandler(cancelMyOrder));
ordersRouter.patch(
  "/:id/status",
  requireAuth,
  requireRole("admin"),
  validate(updateOrderStatusSchema),
  asyncHandler(updateOrderStatus),
);
