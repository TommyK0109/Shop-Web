import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CheckoutPage } from "./CheckoutPage";
import { useAuthStore } from "../store/authStore";
import { ApiError } from "../api/client";
import { makeCart, makeCartItem, makeProduct, renderWithProviders } from "../spec/utils";
import * as cartApi from "../api/cart";
import * as ordersApi from "../api/orders";

vi.mock("../api/cart");
vi.mock("../api/orders");

// Checkout ends on the order page rather than at a payment gateway, so the
// assertion is a route change, not a redirect. Everything else in
// react-router-dom stays real.
const navigate = vi.fn();
vi.mock("react-router-dom", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-router-dom")>()),
  useNavigate: () => navigate,
}));

const getCart = vi.mocked(cartApi.getCart);
const createOrder = vi.mocked(ordersApi.createOrder);

const laptop = makeProduct({ id: "p-laptop", name: "Laptop", slug: "laptop", priceCents: 129900 });
const mouse = makeProduct({ id: "p-mouse", name: "Mouse", slug: "mouse", priceCents: 2550 });

const cartWithTwoSellers = () =>
  makeCart([
    makeCartItem({ id: "item-laptop", product: laptop, quantity: 1 }),
    makeCartItem({
      id: "item-mouse",
      product: { ...mouse, sellerId: "seller-2", seller: { ...mouse.seller, id: "seller-2" } },
      quantity: 2,
    }),
  ]);

async function fillAddress(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText("Address"), "1 Test Way");
  await user.type(screen.getByLabelText("City"), "Testville");
  await user.type(screen.getByLabelText("Postal code"), "00000");
  await user.type(screen.getByLabelText("Country"), "Testland");
}

beforeEach(() => {
  useAuthStore.setState({ status: "authenticated", user: null, accessToken: "test-token" });
});

afterEach(() => {
  vi.resetAllMocks();
  useAuthStore.setState({ status: "unauthenticated", user: null, accessToken: null });
});

describe("CheckoutPage", () => {
  it("summarises every line item and the order total", async () => {
    getCart.mockResolvedValue(cartWithTwoSellers());

    renderWithProviders(<CheckoutPage />);

    expect(await screen.findByText("Laptop × 1")).toBeInTheDocument();
    expect(screen.getByText("Mouse × 2")).toBeInTheDocument();
    // A marketplace cart can span sellers; checkout still totals it as one
    // order — $1,299.00 + (2 × $25.50).
    expect(screen.getByText("$1,350.00")).toBeInTheDocument();
  });

  it("offers nothing to pay for when the cart is empty", async () => {
    getCart.mockResolvedValue(makeCart([]));

    renderWithProviders(<CheckoutPage />);

    expect(await screen.findByText("Your cart is empty.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Place order/ })).not.toBeInTheDocument();
  });

  it("leaves unavailable items out of the order without dropping them from the cart", async () => {
    // The cart is permanent: a line the seller has marked out of stock is
    // still in `items`, just excluded from the total and from the order.
    getCart.mockResolvedValue(
      makeCart([
        makeCartItem({ id: "item-laptop", product: laptop, quantity: 1 }),
        makeCartItem({
          id: "item-mouse",
          product: { ...mouse, status: "out_of_stock" },
          quantity: 2,
          unavailableReason: "seller_marked_out_of_stock",
          unavailableMessage: "The seller has marked this as out of stock",
        }),
      ]),
    );

    renderWithProviders(<CheckoutPage />);

    expect(await screen.findByText("Laptop × 1")).toBeInTheDocument();
    // Not in the summary…
    expect(screen.queryByText("Mouse × 2")).not.toBeInTheDocument();
    // …and not in the total. Scoped to the total row: the laptop's own line
    // shows the same figure, so a bare text match would pass either way.
    expect(screen.getByText("Total").parentElement).toHaveTextContent("$1,299.00");
    // …but the customer is told it is still theirs.
    expect(screen.getByText(/1 unavailable item is excluded/)).toBeInTheDocument();
    expect(screen.getByText(/left in your cart/)).toBeInTheDocument();
  });

  it("refuses checkout when nothing in the cart is buyable, and says so", async () => {
    getCart.mockResolvedValue(
      makeCart([
        makeCartItem({
          id: "item-mouse",
          product: { ...mouse, status: "out_of_stock" },
          quantity: 1,
          unavailableReason: "seller_marked_out_of_stock",
          unavailableMessage: "The seller has marked this as out of stock",
        }),
      ]),
    );

    renderWithProviders(<CheckoutPage />);

    expect(await screen.findByText("Nothing in your cart can be checked out right now.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Place order/ })).not.toBeInTheDocument();
  });

  it("posts the shipping address and lands on the order page to pay", async () => {
    const user = userEvent.setup();
    getCart.mockResolvedValue(cartWithTwoSellers());
    createOrder.mockResolvedValue({
      orderId: "order-1",
      order: { id: "order-1" } as unknown as Awaited<ReturnType<typeof ordersApi.createOrder>>["order"],
    });

    renderWithProviders(<CheckoutPage />);
    await screen.findByText("Laptop × 1");

    await fillAddress(user);
    await user.click(screen.getByRole("button", { name: "Place order" }));

    await waitFor(() =>
      expect(createOrder).toHaveBeenCalledWith({
        line1: "1 Test Way",
        city: "Testville",
        postalCode: "00000",
        country: "Testland",
      }),
    );
    // No gateway to hand the browser to any more — the buyer stays on the
    // site and pays each store from the order page.
    await waitFor(() => expect(navigate).toHaveBeenCalledWith("/orders/order-1"));
  });

  it("does not submit while a required address field is blank", async () => {
    const user = userEvent.setup();
    getCart.mockResolvedValue(cartWithTwoSellers());

    renderWithProviders(<CheckoutPage />);
    await screen.findByText("Laptop × 1");

    await user.type(screen.getByLabelText("Address"), "1 Test Way");
    await user.click(screen.getByRole("button", { name: "Place order" }));

    expect(createOrder).not.toHaveBeenCalled();
  });

  it("surfaces the server's reason for refusing the order", async () => {
    const user = userEvent.setup();
    getCart.mockResolvedValue(cartWithTwoSellers());
    createOrder.mockRejectedValue(new ApiError(409, 'Not enough stock for "Laptop"'));

    renderWithProviders(<CheckoutPage />);
    await screen.findByText("Laptop × 1");

    await fillAddress(user);
    await user.click(screen.getByRole("button", { name: "Place order" }));

    expect(await screen.findByText('Not enough stock for "Laptop"')).toBeInTheDocument();
    expect(navigate).not.toHaveBeenCalled();
  });
});
