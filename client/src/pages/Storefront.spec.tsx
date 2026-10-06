import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes, useLocation } from "react-router-dom";
import { Navbar } from "../components/Navbar";
import { CartDrawer } from "../components/CartDrawer";
import { HomePage } from "./HomePage";
import { LoginPage } from "./LoginPage";
import { RegisterPage } from "./RegisterPage";
import { useAuthStore } from "../store/authStore";
import { useUiStore } from "../store/uiStore";
import {
  makeCart,
  makeCartItem,
  makeProduct,
  renderWithProviders,
} from "../spec/utils";
import { ApiError } from "../api/client";
import * as authApi from "../api/auth";
import * as cartApi from "../api/cart";
import * as productsApi from "../api/products";
import * as categoriesApi from "../api/categories";
import * as sellersApi from "../api/sellers";
import * as ragApi from "../api/rag";

vi.mock("../api/auth");
vi.mock("../api/cart");
vi.mock("../api/products");
vi.mock("../api/categories");
vi.mock("../api/sellers");
vi.mock("../api/rag");
vi.mock("../components/Captcha", () => ({
  Captcha: ({ onVerify }: { onVerify: (token: string) => void }) => <button type="button" onClick={() => onVerify("test-captcha")}>Complete security check</button>,
}));

const customer = {
  id: "customer-1",
  email: "jane.doe@example.com",
  role: "customer" as const,
};
const headphones = makeProduct({
  id: "headphones",
  name: "Wireless headphones",
  slug: "wireless-headphones",
});
const categories = [
  { id: "electronics", name: "Electronics", slug: "electronics" },
  { id: "home", name: "Home & Kitchen", slug: "home-kitchen" },
];

function Harness() {
  const location = useLocation();
  return (
    <>
      <Navbar />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/account" element={<p>Profile destination</p>} />
      </Routes>
      <CartDrawer />
      <output aria-label="Current route">
        {location.pathname}
        {location.search}
        {location.hash}
      </output>
    </>
  );
}

beforeEach(() => {
  vi.resetAllMocks();
  useAuthStore.getState().clearAuth();
  useUiStore.setState({ isCartOpen: false });
  vi.mocked(ragApi.getRagCapabilities).mockResolvedValue({
    enabled: false,
    generationEnabled: false,
  });
  vi.mocked(sellersApi.getMySeller).mockRejectedValue(
    new ApiError(403, "No seller account"),
  );
  vi.mocked(cartApi.getCart).mockResolvedValue(makeCart([]));
  vi.mocked(categoriesApi.listCategories).mockResolvedValue({ categories });
  vi.mocked(productsApi.listProducts).mockResolvedValue({
    products: [headphones],
    pagination: { page: 1, limit: 12, total: 1, totalPages: 1 },
  });
  vi.mocked(authApi.loginRequest).mockResolvedValue({
    user: customer,
    accessToken: "test-token",
  });
  vi.mocked(authApi.registerRequest).mockResolvedValue({
    user: customer,
    accessToken: "test-token",
  });
  vi.mocked(authApi.logoutRequest).mockResolvedValue(undefined);
});

afterEach(() => {
  useAuthStore.getState().clearAuth();
  useUiStore.setState({ isCartOpen: false });
});

describe("Storefront shopping flows", () => {
  it("offers guest account options and a cart with keyboard focus containment", async () => {
    const user = userEvent.setup();
    renderWithProviders(<Harness />);
    expect(screen.getByRole("link", { name: "Sign in" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Sign up" })).toBeInTheDocument();
    const trigger = screen.getByRole("button", { name: "Open cart" });
    await user.click(trigger);
    const dialog = screen.getByRole("dialog", { name: "Your cart" });
    expect(dialog).toHaveFocus();
    expect(document.body.style.overflow).toBe("hidden");
    expect(document.querySelector<HTMLElement>(".site-header")?.inert).toBe(true);
    expect(
      within(dialog).getByRole("link", { name: "Sign in to shop" }),
    ).toBeInTheDocument();
    await user.tab();
    expect(
      within(dialog).getByRole("button", { name: "Close cart" }),
    ).toHaveFocus();
    await user.tab({ shift: true });
    expect(
      within(dialog).getByRole("link", { name: "New here? Create an account" }),
    ).toHaveFocus();
    await user.tab();
    expect(
      within(dialog).getByRole("button", { name: "Close cart" }),
    ).toHaveFocus();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
    expect(document.body.style.overflow).toBe("");
    expect(document.querySelector<HTMLElement>(".site-header")?.inert).not.toBe(true);
    expect(cartApi.getCart).not.toHaveBeenCalled();
  });

  it("returns to the original collection after login and exposes profile options", async () => {
    const user = userEvent.setup();
    renderWithProviders(<Harness />, {
      route: "/?search=headphones&page=3#products",
    });
    await user.click(screen.getByRole("link", { name: "Sign in" }));
    await user.type(screen.getByLabelText("Email address"), customer.email);
    await user.type(
      screen.getByLabelText("Password", { exact: true }),
      "Password123!",
    );
    await user.click(screen.getByRole("button", { name: "Complete security check" }));
    await user.click(screen.getByRole("button", { name: "Sign in" }));
    await waitFor(() =>
      expect(screen.getByLabelText("Current route")).toHaveTextContent(
        "/?search=headphones&page=3#products",
      ),
    );
    expect(authApi.loginRequest).toHaveBeenCalledWith({
      email: customer.email,
      password: "Password123!",
      captchaToken: "test-captcha",
    });
    await user.click(screen.getByRole("button", { name: "Account options" }));
    const menu = screen.getByRole("navigation", { name: "Your account" });
    expect(within(menu).getByText(customer.email)).toBeInTheDocument();
    expect(
      within(menu).getByRole("link", { name: "Your profile" }),
    ).toHaveAttribute("href", "/account");
    expect(
      within(menu).getByRole("link", { name: "Your orders" }),
    ).toHaveAttribute("href", "/orders");
    await user.keyboard("{Escape}");
    expect(
      screen.queryByRole("navigation", { name: "Your account" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Account options" }),
    ).toHaveFocus();
  });

  it("preserves the collection when switching to registration and signs in the new account", async () => {
    const user = userEvent.setup();
    renderWithProviders(<Harness />, {
      route: "/?category=electronics#products",
    });
    await user.click(screen.getByRole("link", { name: "Sign in" }));
    await user.click(screen.getByRole("link", { name: "Create an account" }));
    await user.type(screen.getByLabelText("Email address"), customer.email);
    await user.type(screen.getByLabelText("Create a password"), "Password123!");
    await user.click(screen.getByRole("button", { name: "Complete security check" }));
    await user.click(screen.getByRole("button", { name: "Create account" }));
    await waitFor(() =>
      expect(screen.getByLabelText("Current route")).toHaveTextContent(
        "/?category=electronics#products",
      ),
    );
    expect(authApi.registerRequest).toHaveBeenCalledWith({
      email: customer.email,
      password: "Password123!",
      captchaToken: "test-captcha",
    });
    expect(useAuthStore.getState().status).toBe("authenticated");
  });

  it("reports an unavailable login API without losing the entered email", async () => {
    vi.mocked(authApi.loginRequest).mockRejectedValue(
      new Error("Failed to fetch"),
    );
    const user = userEvent.setup();
    renderWithProviders(<Harness />, { route: "/login" });
    await user.type(screen.getByLabelText("Email address"), customer.email);
    await user.type(
      screen.getByLabelText("Password", { exact: true }),
      "Password123!",
    );
    await user.click(screen.getByRole("button", { name: "Complete security check" }));
    await user.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "We couldn’t connect",
    );
    expect(screen.getByLabelText("Email address")).toHaveValue(customer.email);
    expect(useAuthStore.getState().status).toBe("unauthenticated");
  });

  it("filters categories while retaining the search and resetting pagination", async () => {
    const user = userEvent.setup();
    renderWithProviders(<Harness />, { route: "/?search=lamp&page=3" });
    const tabs = screen.getByLabelText("Filter products by category");
    await user.click(
      await within(tabs).findByRole("button", { name: "Home & Kitchen" }),
    );
    expect(screen.getByLabelText("Current route")).toHaveTextContent(
      "/?search=lamp&category=home-kitchen",
    );
    await waitFor(() =>
      expect(productsApi.listProducts).toHaveBeenLastCalledWith({
        search: "lamp",
        categorySlug: "home-kitchen",
        page: 1,
        limit: 12,
      }),
    );
    await user.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(screen.getByLabelText("Current route").textContent).toBe("/");
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Little things.Big happiness.",
    );
  });

  it("adds an actual product, updates the cart count, and opens the cart", async () => {
    useAuthStore.getState().setAuth(customer, "test-token");
    vi.mocked(cartApi.addCartItem).mockResolvedValue(
      makeCart([makeCartItem({ product: headphones, quantity: 1 })]),
    );
    const user = userEvent.setup();
    renderWithProviders(<Harness />);
    await user.click(
      await screen.findByRole("button", {
        name: "Add Wireless headphones to cart",
      }),
    );
    expect(cartApi.addCartItem).toHaveBeenCalledWith(headphones.id, 1);
    const dialog = await screen.findByRole("dialog", {
      name: /Your cart\s*\(1\)/,
    });
    expect(within(dialog).getByText("Wireless headphones")).toBeInTheDocument();
    expect(
      within(dialog).getByRole("link", { name: "Checkout" }),
    ).toHaveAttribute("href", "/checkout");
    expect(screen.getByRole("button", { name: "Open cart" })).toHaveTextContent(
      "Cart1",
    );
  });

  it("routes guests through login before adding a product", async () => {
    const user = userEvent.setup();
    renderWithProviders(<Harness />);
    await user.click(
      await screen.findByRole("button", {
        name: "Add Wireless headphones to cart",
      }),
    );
    expect(screen.getByLabelText("Current route")).toHaveTextContent("/login");
    expect(cartApi.addCartItem).not.toHaveBeenCalled();
  });

  it("clears the signed-in menu and cached cart when signing out", async () => {
    useAuthStore.getState().setAuth(customer, "test-token");
    vi.mocked(cartApi.getCart).mockResolvedValue(
      makeCart([makeCartItem({ product: headphones, quantity: 2 })]),
    );
    const user = userEvent.setup();
    renderWithProviders(<Harness />);
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Open cart" }),
      ).toHaveTextContent("Cart2"),
    );
    await user.click(screen.getByRole("button", { name: "Account options" }));
    await user.click(screen.getByRole("button", { name: "Sign out" }));
    expect(
      await screen.findByRole("link", { name: "Sign in" }),
    ).toBeInTheDocument();
    expect(authApi.logoutRequest).toHaveBeenCalledOnce();
    expect(screen.getByRole("button", { name: "Open cart" })).toHaveTextContent(
      "Cart0",
    );
    expect(useAuthStore.getState().user).toBeNull();
  });
});
