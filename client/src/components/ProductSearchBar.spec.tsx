import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ProductSearchBar } from "./ProductSearchBar";
import { renderWithProviders } from "../spec/utils";
import * as productsApi from "../api/products";

vi.mock("../api/products");
const getSuggestions = vi.mocked(productsApi.getProductSuggestions);
const products = [
  { id: "headphones", name: "Wireless headphones", slug: "wireless-headphones", priceCents: 4999, images: [] },
  { id: "stand", name: "Headphone stand", slug: "headphone-stand", priceCents: 1999, images: [] },
];

function SearchHarness() {
  const location = useLocation();
  const navigate = useNavigate();
  return (
    <>
      <ProductSearchBar />
      <span aria-label="Current route">{location.pathname}{location.search}</span>
      <Link to="/?search=camera">Search cameras</Link>
      <Link to="/">Browse catalog</Link>
      <button onClick={() => navigate(-1)}>Back</button>
    </>
  );
}

beforeEach(() => {
  vi.resetAllMocks();
  getSuggestions.mockResolvedValue({ products });
});

describe("ProductSearchBar", () => {
  it.each(["Enter", "icon"])("submits a trimmed, encoded query with %s and resets catalog pagination", async (method) => {
    const user = userEvent.setup();
    renderWithProviders(<SearchHarness />, { route: "/?category=electronics&page=3" });
    const input = screen.getByRole("combobox", { name: "Search products" });
    await user.type(input, "  headphones & stand  ");
    if (method === "Enter") await user.keyboard("{Enter}");
    else await user.click(screen.getByRole("button", { name: "Search" }));
    expect(screen.getByLabelText("Current route")).toHaveTextContent("/?search=headphones+%26+stand");
    expect(input).toHaveValue("headphones & stand");
    expect(input).toHaveAttribute("aria-expanded", "false");
  });

  it("debounces suggestions and lets the keyboard choose an accessible product option", async () => {
    const user = userEvent.setup();
    renderWithProviders(<SearchHarness />);
    const input = screen.getByRole("combobox", { name: "Search products" });
    await user.type(input, "headphones");
    const options = await screen.findAllByRole("option");
    expect(getSuggestions).toHaveBeenCalledTimes(1);
    expect(getSuggestions).toHaveBeenCalledWith("headphones");
    await user.keyboard("{ArrowUp}");
    expect(options[1]).toHaveAttribute("aria-selected", "true");
    expect(input).toHaveAttribute("aria-activedescendant", options[1].id);
    await user.keyboard("{ArrowDown}");
    expect(options[0]).toHaveAttribute("aria-selected", "true");
    await user.keyboard("{Enter}");
    expect(screen.getByLabelText("Current route")).toHaveTextContent("/products/wireless-headphones");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("opens a clicked suggestion and supports the link to all matching results", async () => {
    const user = userEvent.setup();
    renderWithProviders(<SearchHarness />);
    const input = screen.getByRole("combobox", { name: "Search products" });
    await user.type(input, "headphones");
    await user.click(await screen.findByRole("button", { name: /Wireless headphones/ }));
    expect(screen.getByLabelText("Current route")).toHaveTextContent("/products/wireless-headphones");
    await user.type(input, "stand");
    await user.click(await screen.findByRole("button", { name: 'See all results for "stand"' }));
    expect(screen.getByLabelText("Current route")).toHaveTextContent("/?search=stand");
  });

  it("clears the input, retains focus, and browses the catalog when an empty search is submitted", async () => {
    const user = userEvent.setup();
    renderWithProviders(<SearchHarness />, { route: "/?search=headphones" });
    const input = screen.getByRole("combobox", { name: "Search products" });
    await user.click(input);
    await screen.findAllByRole("option");
    await user.click(screen.getByRole("button", { name: "Clear search" }));
    expect(input).toHaveValue("");
    expect(input).toHaveFocus();
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    await user.keyboard("{Enter}");
    expect(screen.getByLabelText("Current route").textContent).toBe("/");
    expect(getSuggestions.mock.calls.every(([query]) => query.length > 0)).toBe(true);
  });

  it("synchronizes the input with navigation and browser history", async () => {
    const user = userEvent.setup();
    renderWithProviders(<SearchHarness />, { route: "/?search=headphones" });
    const input = screen.getByRole("combobox", { name: "Search products" });
    expect(input).toHaveValue("headphones");
    await user.click(screen.getByRole("link", { name: "Search cameras" }));
    expect(input).toHaveValue("camera");
    await user.click(screen.getByRole("button", { name: "Back" }));
    expect(input).toHaveValue("headphones");
    await user.click(screen.getByRole("link", { name: "Browse catalog" }));
    expect(input).toHaveValue("");
  });

  it("dismisses an empty or loading dropdown with Escape and closes when focus leaves", async () => {
    getSuggestions.mockResolvedValue({ products: [] });
    const user = userEvent.setup();
    renderWithProviders(<SearchHarness />);
    const input = screen.getByRole("combobox", { name: "Search products" });
    await user.type(input, "unknown");
    expect(input).toHaveAttribute("aria-expanded", "true");
    await user.keyboard("{Escape}");
    expect(input).toHaveAttribute("aria-expanded", "false");
    await user.click(input);
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent('No products found for "unknown"'));
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    await user.click(input);
    await user.tab();
    await user.tab();
    await user.tab();
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("hides stale suggestions while a new query is being entered", async () => {
    const user = userEvent.setup();
    renderWithProviders(<SearchHarness />);
    const input = screen.getByRole("combobox", { name: "Search products" });
    await user.type(input, "headphones");
    await screen.findAllByRole("option");
    getSuggestions.mockResolvedValue({ products: [] });
    await user.clear(input);
    await user.type(input, "camera");
    expect(screen.queryByRole("option")).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Searching...");
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent('No products found for "camera"'));
  });

  it("reports unavailable suggestions and still allows a full catalog search", async () => {
    getSuggestions.mockRejectedValue(new Error("Network error"));
    const user = userEvent.setup();
    renderWithProviders(<SearchHarness />);
    await user.type(screen.getByRole("combobox", { name: "Search products" }), "headphones");
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Suggestions are unavailable"));
    await user.keyboard("{Enter}");
    expect(screen.getByLabelText("Current route")).toHaveTextContent("/?search=headphones");
  });
});
