import type { Request, Response } from "express";
import type { AddCartItemInput, UpdateCartItemInput } from "@storefront/shared";
import { prisma } from "../lib/prisma";
import { calculateCartTotal } from "../lib/cartTotal";
import { AppError } from "../middleware/errorHandler.middleware";
import { unavailableMessage, unavailableReason } from "../services/productAvailability.services";

const cartItemInclude = {
  product: {
    include: {
      images: { orderBy: { sortOrder: "asc" as const } },
      seller: { select: { id: true, slug: true, businessName: true, status: true } },
    },
  },
};

async function getOrCreateCart(userId: string) {
  const existing = await prisma.cart.findUnique({ where: { userId } });
  if (existing) return existing;
  return prisma.cart.create({ data: { userId } });
}

/**
 * A cart is permanent storage, not a staging area.
 *
 * Nothing here filters items out. A product that has sold out, had its price
 * changed, been hidden, or whose store has been suspended still comes back —
 * annotated with why it can't be bought right now, so the UI can say so and
 * the customer can decide. The only rows missing are ones the customer
 * removed themselves, or ones the seller explicitly confirmed were gone (and
 * those leave a notice behind; see `removalNotices`).
 */
async function serializedCart(cartId: string) {
  const [items, notices] = await Promise.all([
    prisma.cartItem.findMany({
      where: { cartId },
      include: cartItemInclude,
      orderBy: { addedAt: "asc" },
    }),
    prisma.cartRemovalNotice.findMany({
      where: { cartId, seenAt: null },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const annotated = items.map((item) => {
    const reason = unavailableReason(item.product, item.quantity);
    return {
      ...item,
      unavailableReason: reason,
      unavailableMessage: reason ? unavailableMessage(reason) : null,
    };
  });

  const purchasable = annotated.filter((item) => item.unavailableReason === null);

  return {
    id: cartId,
    items: annotated,
    totalCents: calculateCartTotal(
      purchasable.map((i) => ({ quantity: i.quantity, priceCents: i.product.priceCents })),
    ),
    purchasableCount: purchasable.length,
    unavailableCount: annotated.length - purchasable.length,
    removalNotices: notices,
  };
}

export async function getCart(req: Request, res: Response) {
  const cart = await getOrCreateCart(req.user!.id);
  res.json({ cart: await serializedCart(cart.id) });
}

export async function addCartItem(req: Request, res: Response) {
  const { productId, quantity } = req.body as AddCartItemInput;

  const product = await prisma.product.findUnique({ where: { id: productId }, include: { seller: true } });
  if (!product || product.seller.status !== "approved" || product.status === "archived") {
    throw new AppError(404, "Product not found");
  }
  if (product.status === "out_of_stock") {
    throw new AppError(409, unavailableMessage("seller_marked_out_of_stock"));
  }

  const cart = await getOrCreateCart(req.user!.id);

  await prisma.cartItem.upsert({
    where: { cartId_productId: { cartId: cart.id, productId } },
    create: { cartId: cart.id, productId, quantity },
    update: { quantity: { increment: quantity } },
  });

  res.status(201).json({ cart: await serializedCart(cart.id) });
}

export async function updateCartItem(req: Request, res: Response) {
  const { quantity } = req.body as UpdateCartItemInput;

  const cart = await getOrCreateCart(req.user!.id);
  const item = await prisma.cartItem.findUnique({ where: { id: req.params.id } });
  if (!item || item.cartId !== cart.id) {
    throw new AppError(404, "Cart item not found");
  }

  await prisma.cartItem.update({ where: { id: item.id }, data: { quantity } });
  res.json({ cart: await serializedCart(cart.id) });
}

export async function removeCartItem(req: Request, res: Response) {
  const cart = await getOrCreateCart(req.user!.id);
  const item = await prisma.cartItem.findUnique({ where: { id: req.params.id } });
  if (!item || item.cartId !== cart.id) {
    throw new AppError(404, "Cart item not found");
  }

  await prisma.cartItem.delete({ where: { id: item.id } });
  res.json({ cart: await serializedCart(cart.id) });
}

/**
 * Marks the "we removed this for you" notices as seen. They are shown once —
 * the customer has been told, and nagging on every cart open would be worse
 * than not telling them at all.
 */
export async function dismissRemovalNotices(req: Request, res: Response) {
  const cart = await getOrCreateCart(req.user!.id);
  await prisma.cartRemovalNotice.updateMany({
    where: { cartId: cart.id, seenAt: null },
    data: { seenAt: new Date() },
  });
  res.json({ cart: await serializedCart(cart.id) });
}
