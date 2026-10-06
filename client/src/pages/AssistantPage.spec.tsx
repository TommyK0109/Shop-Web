import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { RagProduct, RagResponse } from "@storefront/shared";
import { AssistantPage } from "./AssistantPage";
import { renderWithProviders } from "../spec/utils";
import * as ragApi from "../api/rag";
import * as categoriesApi from "../api/categories";

vi.mock("../api/rag");
vi.mock("../api/categories");
const submit = vi.mocked(ragApi.submitRag);
const categoryId = "10000000-0000-4000-8000-000000000001";
function product(index: number): RagProduct {
  return { id: `20000000-0000-4000-8000-00000000000${index}`, name: `Headset ${index}`, slug: `headset-${index}`, description: "Demo headset.", priceCents: 3000, stockQty: 3, status: "active", category: { id: categoryId, name: "Electronics", slug: "electronics" }, seller: { id: "30000000-0000-4000-8000-000000000001", businessName: "Demo store", slug: "demo-store" }, imageUrl: null, specifications: index === 1 ? { microphone: true, batteryHours: 12 } : { microphone: true }, sourceRevision: 1, unavailableReason: null };
}
function response(): RagResponse {
  return { requestId: "request-1", status: "answered", answer: { intro: "Here are the matching listings.", recommendations: [{ productId: product(1).id, reasons: [{ text: "The listing documents a microphone.", sourceIds: ["p1"] }], unknowns: ["Noise suppression is not documented."] }], comparison: [], followUpQuestion: null }, products: [product(1), product(2), product(3), product(4)], sources: [1, 2, 3, 4].map((id) => ({ id: `p${id}`, productId: product(id).id, revision: 1 })), filters: { currency: "USD", categorySlug: "electronics", maxPriceCents: 5000, purchasableOnly: true }, generatedAt: "2026-10-01T00:00:00.000Z" };
}
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(ragApi.getRagCapabilities).mockResolvedValue({ enabled: true, generationEnabled: true });
  vi.mocked(categoriesApi.listCategories).mockResolvedValue({ categories: [{ id: categoryId, name: "Electronics", slug: "electronics" }] });
  submit.mockResolvedValue(response());
});

describe("AssistantPage", () => {
  it("submits explicit filters, renders listing sources and unknowns, and retains constraints for follow-ups", async () => {
    const user = userEvent.setup();
    renderWithProviders(<AssistantPage />);
    await user.type(await screen.findByLabelText("Your question"), "Headphones for meetings");
    await user.selectOptions(screen.getByLabelText("Category"), "electronics");
    await user.type(screen.getByLabelText("Maximum budget (USD)"), "50");
    await user.click(screen.getByRole("button", { name: "Ask assistant" }));
    expect(await screen.findByText("Noise suppression is not documented.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Source: Headset 1" })).toHaveAttribute("href", "/products/headset-1");
    expect(submit.mock.calls[0][0]).toMatchObject({ filters: { currency: "USD", categorySlug: "electronics", maxPriceCents: 5000, purchasableOnly: true }, history: [] });
    await user.clear(screen.getByLabelText("Your question"));
    await user.type(screen.getByLabelText("Your question"), "Which includes a microphone?");
    await user.click(screen.getByRole("button", { name: "Ask assistant" }));
    await waitFor(() => expect(submit).toHaveBeenCalledTimes(2));
    expect(submit.mock.calls[1][0].history).toHaveLength(2);
    expect(submit.mock.calls[1][0].filters.maxPriceCents).toBe(5000);
  });

  it("bounds comparison selection to three and shows missing specifications", async () => {
    const user = userEvent.setup();
    renderWithProviders(<AssistantPage />);
    await user.type(await screen.findByLabelText("Your question"), "Find headsets");
    await user.click(screen.getByRole("button", { name: "Ask assistant" }));
    await user.click(await screen.findByRole("checkbox", { name: "Compare Headset 1" }));
    await user.click(screen.getByRole("checkbox", { name: "Compare Headset 2" }));
    await user.click(screen.getByRole("checkbox", { name: "Compare Headset 3" }));
    expect(screen.getByRole("checkbox", { name: "Compare Headset 4" })).toBeDisabled();
    await user.selectOptions(screen.getByLabelText("Mode"), "compare");
    submit.mockResolvedValueOnce({ ...response(), products: [product(1), product(2), product(3)] });
    await user.click(screen.getByRole("button", { name: "Ask assistant" }));
    const table = await screen.findByRole("table");
    expect(within(table).getAllByText("Not documented")).toHaveLength(2);
    expect(submit.mock.calls[1][0]).toMatchObject({ mode: "compare", productIds: [product(1).id, product(2).id, product(3).id], filters: { purchasableOnly: false } });
  });

  it("passes the selected product ID and uses search-only mode when generation is off", async () => {
    vi.mocked(ragApi.getRagCapabilities).mockResolvedValue({ enabled: true, generationEnabled: false });
    submit.mockResolvedValue({ ...response(), status: "search_results", answer: null });
    const user = userEvent.setup();
    renderWithProviders(<AssistantPage />, { route: `/assistant?productId=${product(1).id}` });
    await user.type(await screen.findByLabelText("Your question"), "Does it have a microphone?");
    await user.click(screen.getByRole("button", { name: "Search listings" }));
    await screen.findByText("Search results from current listings. Generated advice is off.");
    expect(submit.mock.calls[0][0]).toMatchObject({ mode: "product", productIds: [product(1).id] });
    expect(submit.mock.calls[0][1]).toBe(false);
  });

  it("cancels the request and ignores a late response", async () => {
    let resolve: (value: RagResponse) => void = () => {};
    submit.mockImplementationOnce(() => new Promise((done) => { resolve = done; }));
    const user = userEvent.setup();
    renderWithProviders(<AssistantPage />);
    await user.type(await screen.findByLabelText("Your question"), "Find headsets");
    await user.click(screen.getByRole("button", { name: "Ask assistant" }));
    await user.click(screen.getByRole("button", { name: "Cancel request" }));
    expect(submit.mock.calls[0][2]?.aborted).toBe(true);
    await act(async () => { resolve(response()); });
    expect(screen.getByText("Request cancelled.")).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Assistant response" })).not.toBeInTheDocument();
  });

  it("does not automatically retry failures and provides a user retry", async () => {
    submit.mockRejectedValueOnce(new Error("Provider temporarily unavailable"));
    const user = userEvent.setup();
    renderWithProviders(<AssistantPage />);
    await user.type(await screen.findByLabelText("Your question"), "Find headsets");
    await user.click(screen.getByRole("button", { name: "Ask assistant" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Provider temporarily unavailable");
    expect(submit).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole("button", { name: "Retry request" }));
    await screen.findByRole("region", { name: "Assistant response" });
    expect(submit).toHaveBeenCalledTimes(2);
  });
});
