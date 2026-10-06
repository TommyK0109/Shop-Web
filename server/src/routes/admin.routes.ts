import { Router } from "express";
import { adminOrderQuerySchema, updateSellerStatusSchema } from "@storefront/shared";
import { validate } from "../middleware/validate.middleware";
import { asyncHandler } from "../middleware/errorHandler.middleware";
import { requireAuth } from "../middleware/auth.middleware";
import { requireRole } from "../middleware/requireRole.middleware";
import { listSellerApplications, updateSellerStatus, listAllOrders } from "../controllers/admin.controller";

export const adminRouter = Router();

adminRouter.use(requireAuth, requireRole("admin"));

adminRouter.get("/sellers", asyncHandler(listSellerApplications));
adminRouter.patch("/sellers/:id/status", validate(updateSellerStatusSchema), asyncHandler(updateSellerStatus));
adminRouter.get("/orders", validate(adminOrderQuerySchema, "query"), asyncHandler(listAllOrders));
