import type { Product, Seller, Shipment, UserRole } from "@prisma/client";

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        role: UserRole;
      };
      // Populated by requireSeller once the caller's Seller row is resolved,
      // so downstream handlers don't have to look it up again.
      seller?: Seller;
      // Populated by requireProductOwner alongside the ownership check.
      product?: Product;
      // Populated by requireShipmentOwner, same idea one resource over.
      shipment?: Shipment;
    }
  }
}

export {};
