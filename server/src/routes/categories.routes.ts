import { Router } from "express";
import { createCategorySchema, updateCategorySchema } from "@storefront/shared";
import { validate } from "../middleware/validate.middleware";
import { asyncHandler } from "../middleware/errorHandler.middleware";
import { requireAuth } from "../middleware/auth.middleware";
import { requireRole } from "../middleware/requireRole.middleware";
import { listCategories, createCategory, updateCategory, deleteCategory } from "../controllers/categories.controller";

export const categoriesRouter = Router();

categoriesRouter.get("/", asyncHandler(listCategories));
categoriesRouter.post(
  "/",
  requireAuth,
  requireRole("admin"),
  validate(createCategorySchema),
  asyncHandler(createCategory),
);
categoriesRouter.patch(
  "/:id",
  requireAuth,
  requireRole("admin"),
  validate(updateCategorySchema),
  asyncHandler(updateCategory),
);
categoriesRouter.delete("/:id", requireAuth, requireRole("admin"), asyncHandler(deleteCategory));
