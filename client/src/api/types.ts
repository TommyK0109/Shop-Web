import type { ProductSpecifications } from "@storefront/shared";

export type UserRole = "customer" | "seller" | "admin";
export type SellerStatus = "pending" | "approved" | "rejected" | "suspended";

export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
  avatarUrl?: string | null;
  emailVerifiedAt?: string | null;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
}

export interface ProductImage {
  id: string;
  url: string;
  sortOrder: number;
}

export interface ProductSellerSummary {
  id: string;
  slug: string;
  businessName: string;
  status: SellerStatus;
}

export interface Review {
  id: string;
  rating: number;
  comment: string | null;
  createdAt: string;
  user: { id: string; email: string };
}

/**
 * `out_of_stock` is the seller confirming the listing can't be bought — which
 * is a different thing from `stockQty` being 0, and the only thing that takes
 * a product out of a cart. `archived` is the soft delete; it never reaches
 * the storefront.
 */
export type ProductStatus = "active" | "out_of_stock" | "archived";

export interface Product {
  id: string;
  sellerId: string;
  categoryId: string;
  name: string;
  slug: string;
  description: string;
  specifications: ProductSpecifications | null;
  priceCents: number;
  stockQty: number;
  status: ProductStatus;
  outOfStockAt: string | null;
  archivedAt: string | null;
  images: ProductImage[];
  category: Category;
  seller: ProductSellerSummary;
}

export interface ProductDetail extends Product {
  reviews: Review[];
}

/** One row of navbar search-as-you-type results — a trimmed-down Product. */
export interface ProductSuggestion {
  id: string;
  name: string;
  slug: string;
  priceCents: number;
  images: ProductImage[];
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export type SellerProductSummary = Omit<Product, "seller">;

export interface Seller {
  id: string;
  slug: string;
  businessName: string;
  description: string | null;
  city: string;
  country: string;
  status: SellerStatus;
  products: SellerProductSummary[];
}

/** Why a cart line can't be checked out, or null if it can. */
export type UnavailableReason =
  | "seller_marked_out_of_stock"
  | "listing_withdrawn"
  | "store_unavailable"
  | "insufficient_stock";

export interface CartItem {
  id: string;
  cartId: string;
  productId: string;
  quantity: number;
  addedAt: string;
  product: Product;
  /** Null means buyable. Items are annotated, never dropped from the cart. */
  unavailableReason: UnavailableReason | null;
  unavailableMessage: string | null;
}

/**
 * Told to the customer when the *seller* removed something from their cart —
 * the only case where the server takes an item out on its own. Shown once,
 * then dismissed.
 */
export interface CartRemovalNotice {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  reason: string;
  createdAt: string;
}

export interface Cart {
  id: string;
  items: CartItem[];
  /** Counts only the buyable items, so it matches what checkout will charge. */
  totalCents: number;
  purchasableCount: number;
  unavailableCount: number;
  removalNotices: CartRemovalNotice[];
}

export interface ShippingAddressInput {
  line1: string;
  city: string;
  postalCode: string;
  country: string;
}

export interface Address extends ShippingAddressInput {
  id: string;
  userId: string;
}

/**
 * An order spanning three stores is three separate transfers now, so "paid"
 * is no longer a single moment — `partially_paid` is a real, common state.
 */
export type OrderStatus = "pending_payment" | "partially_paid" | "paid" | "cancelled";

export type PaymentStatus =
  | "pending"
  | "awaiting_confirmation"
  | "succeeded"
  | "failed"
  | "refunded";

export type ShipmentStatus = "confirmed" | "packed" | "received";

export interface PaymentBank {
  bin: string;
  name: string;
  accountNumber: string;
  accountName: string;
}

/**
 * One store's share of an order, and everything the buyer needs to pay it.
 *
 * The QR is rendered server-side as an inline SVG from the frozen bank
 * details on the row, so what is displayed can't drift if the seller edits
 * their account later. The plain bank fields are there for anyone who can't
 * scan.
 */
export interface Payment {
  id: string;
  orderId: string;
  sellerId: string;
  status: PaymentStatus;
  amountCents: number;
  amountVnd: number;
  /** Goes in the transfer description; how the seller matches it up. */
  reference: string;
  bank: PaymentBank;
  /** Null once the payment is settled — there is nothing left to pay. */
  qrPayload: string | null;
  qrSvg: string | null;
  markedPaidAt: string | null;
  confirmedAt: string | null;
  rejectedAt: string | null;
  failureReason: string | null;
}

export interface SellerPaymentMethod {
  id: string;
  sellerId: string;
  bankBin: string;
  bankName: string;
  accountNumber: string;
  accountName: string;
}

export interface DemoBank {
  bin: string;
  name: string;
}

/** A transfer owed to my store, as the seller dashboard sees it. */
export interface SellerPayment extends Payment {
  order: { id: string; createdAt: string; status: OrderStatus };
  customerEmail: string;
}

export interface Shipment {
  id: string;
  orderId: string;
  sellerId: string;
  carrier: string | null;
  trackingNumber: string | null;
  status: ShipmentStatus;
  confirmedAt: string | null;
  packedAt: string | null;
  receivedAt: string | null;
}

export interface OrderItem {
  id: string;
  orderId: string;
  productId: string;
  sellerId: string;
  shipmentId: string | null;
  quantity: number;
  unitPriceCents: number;
  product: { id: string; name: string; slug: string; images: ProductImage[] };
  seller: { id: string; slug: string; businessName: string };
  shipment: Shipment | null;
}

export interface Order {
  id: string;
  userId: string;
  shippingAddressId: string;
  status: OrderStatus;
  totalCents: number;
  createdAt: string;
  shippingAddress: Address;
  /** One per seller in the order. */
  payments: Payment[];
  items: OrderItem[];
}

/**
 * One seller's slice of an order: their line items plus the single shipment
 * covering them. An order can hold several of these, each moving through
 * `confirmed → packed → received` independently of the others.
 */
export interface OrderSellerGroup {
  sellerId: string;
  seller: { id: string; slug: string; businessName: string };
  items: OrderItem[];
  shipment: Shipment | null;
  subtotalCents: number;
}

export interface AdminOrderItem {
  id: string;
  orderId: string;
  productId: string;
  sellerId: string;
  shipmentId: string | null;
  quantity: number;
  unitPriceCents: number;
  product: { id: string; name: string; slug: string };
  seller: { id: string; slug: string; businessName: string };
  shipment: Shipment | null;
}

export interface AdminOrder {
  id: string;
  userId: string;
  status: OrderStatus;
  totalCents: number;
  createdAt: string;
  user: { id: string; email: string };
  shippingAddress: Address;
  payments: (Payment & { seller: { id: string; businessName: string } })[];
  items: AdminOrderItem[];
}

/**
 * The caller's own seller row, from GET /api/sellers/me. Unlike the public
 * `Seller` shape this carries the application fields the seller submitted —
 * including the national ID, which the server only ever stores (and returns)
 * masked to its last 4 digits. See PLAN.md §4.
 */
export interface MySeller {
  id: string;
  userId: string;
  applicantName: string;
  nationalIdMasked: string;
  businessName: string;
  slug: string;
  description: string | null;
  addressLine1: string;
  city: string;
  postalCode: string;
  country: string;
  status: SellerStatus;
  createdAt: string;
}

/** A seller application as the admin review screen sees it. */
export interface SellerApplication extends MySeller {
  user: { id: string; email: string };
  products: (Omit<Product, "seller" | "images"> & { category: Category })[];
  paymentMethod: SellerPaymentMethod | null;
}

export interface SellerOrderItem {
  id: string;
  orderId: string;
  productId: string;
  sellerId: string;
  shipmentId: string | null;
  quantity: number;
  unitPriceCents: number;
  product: { id: string; name: string; slug: string; images: ProductImage[] };
  shipment: Shipment | null;
}

/**
 * One paid order as *one seller* sees it: their own line items only, never
 * another seller's, and no order-wide total. From GET /api/sellers/me/orders.
 */
export interface SellerOrderGroup {
  orderId: string;
  orderStatus: OrderStatus;
  createdAt: string;
  customerEmail: string;
  shippingAddress: Address;
  shipment: Shipment | null;
  items: SellerOrderItem[];
  subtotalCents: number;
}
