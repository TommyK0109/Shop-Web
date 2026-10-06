import type { ReactElement, ReactNode } from "react";
import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { Cart, CartItem, CartRemovalNotice, Product } from "../api/types";

/**
 * Retries and caching are what make React Query good in the browser and
 * flaky in tests — a failed query would sit in a retry backoff instead of
 * reporting its error, and a fresh client per test keeps them isolated.
 */
export function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: 0, gcTime: 0 },
      mutations: { retry: false },
    },
  });
}

export function renderWithProviders(ui: ReactElement, { route = "/" }: { route?: string } = {}) {
  const queryClient = createTestQueryClient();

  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[route]}>{children}</MemoryRouter>
      </QueryClientProvider>
    );
  }

  return { queryClient, ...render(ui, { wrapper: Wrapper }) };
}

// --- Fixtures ---------------------------------------------------------------

export function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: "product-1",
    sellerId: "seller-1",
    categoryId: "category-1",
    name: "Test Product",
    slug: "test-product",
    description: "A product used in component tests.",
    specifications: null,
    priceCents: 1999,
    stockQty: 10,
    status: "active",
    outOfStockAt: null,
    archivedAt: null,
    images: [],
    category: { id: "category-1", name: "Electronics", slug: "electronics" },
    seller: { id: "seller-1", slug: "test-store", businessName: "Test Store", status: "approved" },
    ...overrides,
  };
}

export function makeCartItem(overrides: Partial<CartItem> = {}): CartItem {
  const product = overrides.product ?? makeProduct();
  return {
    id: "item-1",
    cartId: "cart-1",
    productId: product.id,
    quantity: 1,
    addedAt: "2026-01-01T00:00:00.000Z",
    unavailableReason: null,
    unavailableMessage: null,
    ...overrides,
    product,
  };
}

/**
 * Builds a cart the way the API does: the total counts only the buyable
 * lines, so an unavailable item is present in `items` but absent from the
 * money — which is the invariant the cart UI is built on.
 */
export function makeCart(items: CartItem[], removalNotices: CartRemovalNotice[] = []): { cart: Cart } {
  const purchasable = items.filter((item) => item.unavailableReason === null);
  return {
    cart: {
      id: "cart-1",
      items,
      totalCents: purchasable.reduce((sum, item) => sum + item.product.priceCents * item.quantity, 0),
      purchasableCount: purchasable.length,
      unavailableCount: items.length - purchasable.length,
      removalNotices,
    },
  };
}

export function makeRemovalNotice(overrides: Partial<CartRemovalNotice> = {}): CartRemovalNotice {
  return {
    id: "notice-1",
    productId: "product-1",
    productName: "Test Product",
    quantity: 1,
    reason: "The seller confirmed this product is out of stock.",
    createdAt: "2026-01-02T00:00:00.000Z",
    ...overrides,
  };
}
