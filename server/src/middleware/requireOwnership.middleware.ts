import type { NextFunction, Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { AppError } from "./errorHandler.middleware";

/**
 * run after requireAuth. Resolves the caller's own Seller row and
 * attaches it as req.seller — every /sellers/me/* route needs this to 
 * know which store is being acted on.
 */
export async function requireSeller(req: Request, _res: Response, next: NextFunction) {
  if (!req.user) {
    return next(new AppError(401, "Authentication required"));
  }
  const seller = await prisma.seller.findUnique({ where: { userId: req.user.id } });
  if (!seller) {
    return next(new AppError(403, "No seller account found for this user"));
  }
  req.seller = seller;
  next();
}

// Must run after requireSeller. Gates actions (like creating new listings)
// that only make sense once the platform has approved the seller.
export function requireApprovedSeller(req: Request, _res: Response, next: NextFunction) {
  if (!req.seller) {
    return next(new AppError(403, "No seller account found for this user"));
  }
  if (req.seller.status !== "approved") {
    return next(new AppError(403, "Seller account is not approved"));
  }
  next();
}

// Must run after requireSeller. Confirms the product in the URL belongs to
// the caller's own store before allowing a write — the ownership boundary
// that keeps seller A from touching seller B's catalog.
export async function requireProductOwner(req: Request, _res: Response, next: NextFunction) {
  if (!req.seller) {
    return next(new AppError(403, "No seller account found for this user"));
  }
  const product = await prisma.product.findUnique({ where: { id: req.params.id } });
  if (!product) {
    return next(new AppError(404, "Product not found"));
  }
  if (product.sellerId !== req.seller.id) {
    return next(new AppError(403, "You do not own this product"));
  }
  req.product = product;
  next();
}

// Must run after requireSeller. The shipment equivalent of
// requireProductOwner — a seller can only ever advance a shipment they
// created for their own items.
export async function requireShipmentOwner(req: Request, _res: Response, next: NextFunction) {
  if (!req.seller) {
    return next(new AppError(403, "No seller account found for this user"));
  }
  const shipment = await prisma.shipment.findUnique({ where: { id: req.params.id } });
  if (!shipment) {
    return next(new AppError(404, "Shipment not found"));
  }
  if (shipment.sellerId !== req.seller.id) {
    return next(new AppError(403, "You do not own this shipment"));
  }
  req.shipment = shipment;
  next();
}
