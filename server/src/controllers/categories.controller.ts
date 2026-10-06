import type { Request, Response } from "express";
import type { CreateCategoryInput, UpdateCategoryInput } from "@storefront/shared";
import { prisma } from "../lib/prisma";
import { uniqueSlug } from "../lib/slug";
import { AppError } from "../middleware/errorHandler.middleware";
import { bumpCacheVersion, getCacheVersion, getOrSetCache } from "../lib/cache";
import { updateCategoryProductsIndex } from "../services/rag/indexing";

// Category names change rarely, so a 5-minute TTL is generous — invalidated
// immediately anyway by the version bump on every write below.
const CATEGORIES_TTL_SECONDS = 300;

export async function listCategories(_req: Request, res: Response) {
  const version = await getCacheVersion("categories");
  const categories = await getOrSetCache(`categories:list:v${version}`, CATEGORIES_TTL_SECONDS, () =>
    prisma.category.findMany({ orderBy: { name: "asc" } }),
  );
  res.json({ categories });
}

export async function createCategory(req: Request, res: Response) {
  const { name } = req.body as CreateCategoryInput;
  const slug = await uniqueSlug(name, async (candidate) => {
    const existing = await prisma.category.findUnique({ where: { slug: candidate } });
    return existing !== null;
  });

  const category = await prisma.category.create({ data: { name, slug } });
  await bumpCacheVersion("categories");
  res.status(201).json({ category });
}

export async function updateCategory(req: Request, res: Response) {
  const { name } = req.body as UpdateCategoryInput;

  const category = await prisma.category.findUnique({ where: { id: req.params.id } });
  if (!category) {
    throw new AppError(404, "Category not found");
  }

  const updated = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM categories WHERE id = ${category.id} FOR UPDATE`;
    const current = await tx.category.findUniqueOrThrow({ where: { id: category.id } });
    const result = await tx.category.update({ where: { id: category.id }, data: { name } });
    if (name !== undefined && name !== current.name) await updateCategoryProductsIndex(tx, category.id);
    return result;
  });
  // Category name is embedded in every cached product response too.
  await Promise.all([bumpCacheVersion("categories"), bumpCacheVersion("products")]);
  res.json({ category: updated });
}

export async function deleteCategory(req: Request, res: Response) {
  const category = await prisma.category.findUnique({ where: { id: req.params.id } });
  if (!category) {
    throw new AppError(404, "Category not found");
  }

  const productCount = await prisma.product.count({ where: { categoryId: category.id } });
  if (productCount > 0) {
    throw new AppError(409, "Cannot delete a category that still has products");
  }

  await prisma.category.delete({ where: { id: category.id } });
  await bumpCacheVersion("categories");
  res.status(204).send();
}
