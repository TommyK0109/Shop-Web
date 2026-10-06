import type { SellerStatus } from "../api/types";

export const SELLER_STATUS_LABEL: Record<SellerStatus, string> = {
  pending: "Awaiting review",
  approved: "Approved",
  rejected: "Rejected",
  suspended: "Suspended",
};

export const SELLER_STATUS_STYLE: Record<SellerStatus, string> = {
  pending: "bg-amber-100 text-amber-800",
  approved: "bg-emerald-100 text-emerald-800",
  rejected: "bg-red-100 text-red-700",
  suspended: "bg-gray-200 text-gray-600",
};

/**
 * What the seller can actually do in this state. Mirrors the server's
 * requireApprovedSeller gate — the UI copy explains the boundary, the server
 * is what enforces it.
 */
export const SELLER_STATUS_HINT: Record<SellerStatus, string> = {
  pending:
    "An admin is reviewing your application and the catalog you proposed. You can edit those listings now, but nothing goes live and you can't add new products until you're approved.",
  approved: "Your store is live. Your products appear in the public catalog and customers can order them.",
  rejected: "Your application wasn't approved, so your listings stay hidden and you can't add new ones.",
  suspended: "Your store is suspended. Your listings are hidden from the catalog and new ones are blocked.",
};
