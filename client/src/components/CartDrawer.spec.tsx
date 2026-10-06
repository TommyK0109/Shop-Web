import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CartDrawer } from "./CartDrawer";
import { useUiStore } from "../store/uiStore";
import { useAuthStore } from "../store/authStore";
import { makeCart, makeCartItem, makeProduct, renderWithProviders } from "../spec/utils";
import * as cartApi from "../api/cart";

// The API module is the seam: everything above it — useCart, the mutations,
vi.mock("../api/cart");

const getCart = vi.mocked(cartApi.getCart);
const updateCartItem = vi.mocked(cartApi.updateCartItem);
const removeCartItem = vi.mocked(cartApi.removeCartItem);

const laptop = makeProduct({ id: "p-laptop", name: "Laptop", slug: "laptop", priceCents: 129900 });
const mouse = makeProduct({ id: "p-mouse", name: "Mouse", slug: "mouse", priceCents: 2550 });

beforeEach(() => {
  // useCart is gated on the auth store, and the drawer only renders when the
  // UI store says it's open — both are module-level singletons.
  useAuthStore.setState({ status: "authenticated", user: null, accessToken: "test-token" });
  useUiStore.setState({ isCartOpen: true });
});

afterEach(() => {
  vi.resetAllMocks();
  useUiStore.setState({ isCartOpen: false });
  useAuthStore.setState({ status: "unauthenticated", user: null, accessToken: null });
});

describe("CartDrawer", () => {
  it("renders nothing while the drawer is closed", () => {
    useUiStore.setState({ isCartOpen: false });
    getCart.mockResolvedValue(makeCart([]));

    const { container } = renderWithProviders(<CartDrawer />);
    expect(container).toBeEmptyDOMElement();
  });

  it("lists each line item with its line total and the cart subtotal", async () => {
    getCart.mockResolvedValue(
      makeCart([
        makeCartItem({ id: "item-laptop", product: laptop, quantity: 1 }),
        makeCartItem({ id: "item-mouse", product: mouse, quantity: 2 }),
      ]),
    );

    renderWithProviders(<CartDrawer />);

    expect(await screen.findByText("Laptop")).toBeInTheDocument();
    expect(screen.getByText("Mouse")).toBeInTheDocument();
    expect(screen.getByText("$51.00")).toBeInTheDocument();
    expect(screen.getByText("$1,350.00")).toBeInTheDocument();
  });

  it("shows an empty state and no checkout link when the cart has no items", async () => {
    getCart.mockResolvedValue(makeCart([]));

    renderWithProviders(<CartDrawer />);

    expect(await screen.findByText("Your cart is empty.")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Checkout" })).not.toBeInTheDocument();
  });

  it("sends the chosen quantity and re-renders from the server's cart", async () => {
    const user = userEvent.setup();
    getCart.mockResolvedValue(makeCart([makeCartItem({ id: "item-mouse", product: mouse, quantity: 1 })]));
    updateCartItem.mockResolvedValue(makeCart([makeCartItem({ id: "item-mouse", product: mouse, quantity: 3 })]));

    renderWithProviders(<CartDrawer />);

    const quantity = await screen.findByLabelText("Quantity for Mouse");
    await user.selectOptions(quantity, "3");

    expect(updateCartItem).toHaveBeenCalledWith("item-mouse", 3);
    expect(await screen.findAllByText("$76.50")).toHaveLength(2);
  });

  it("caps the quantity options at the stock on hand", async () => {
    getCart.mockResolvedValue(
      makeCart([
        makeCartItem({ id: "item-rare", product: makeProduct({ name: "Rare Item", stockQty: 3 }), quantity: 1 }),
      ]),
    );

    renderWithProviders(<CartDrawer />);

    const quantity = await screen.findByLabelText("Quantity for Rare Item");
    expect(quantity.querySelectorAll("option")).toHaveLength(3);
  });

  it("removes an item and drops back to the empty state", async () => {
    const user = userEvent.setup();
    getCart.mockResolvedValue(makeCart([makeCartItem({ id: "item-mouse", product: mouse, quantity: 1 })]));
    removeCartItem.mockResolvedValue(makeCart([]));

    renderWithProviders(<CartDrawer />);

    await user.click(await screen.findByRole("button", { name: "Remove" }));

    expect(removeCartItem).toHaveBeenCalledWith("item-mouse");
    expect(await screen.findByText("Your cart is empty.")).toBeInTheDocument();
  });

  it("closes when the backdrop is clicked", async () => {
    const user = userEvent.setup();
    getCart.mockResolvedValue(makeCart([]));

    renderWithProviders(<CartDrawer />);

    await user.click((await screen.findAllByRole("button", { name: "Close cart" }))[0]);

    await waitFor(() => expect(useUiStore.getState().isCartOpen).toBe(false));
  });
});
