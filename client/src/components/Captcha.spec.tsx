import { act, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Captcha } from "./Captcha";
import { renderWithProviders } from "../spec/utils";

const renderWidget = vi.fn(); const removeWidget = vi.fn();
beforeEach(() => {
  renderWidget.mockReset().mockReturnValue("widget-id"); removeWidget.mockReset();
  window.turnstile = { render: renderWidget, remove: removeWidget };
});
afterEach(() => { delete window.turnstile; });

describe("CAPTCHA widget lifecycle", () => {
  it("reports verification and clears expired or failed tokens", async () => {
    const onVerify = vi.fn(); renderWithProviders(<Captcha action="login" onVerify={onVerify} />);
    await waitFor(() => expect(renderWidget).toHaveBeenCalledOnce());
    const options = renderWidget.mock.calls[0][1];
    expect(options.action).toBe("login");
    act(() => options.callback("valid-token"));
    expect(onVerify).toHaveBeenLastCalledWith("valid-token");
    expect(screen.getByRole("status")).toHaveTextContent("complete");
    act(() => options["expired-callback"]());
    expect(onVerify).toHaveBeenLastCalledWith("");
    act(() => options["error-callback"]());
    expect(onVerify).toHaveBeenLastCalledWith("");
    expect(screen.getByRole("button", { name: "Retry security check" })).toBeInTheDocument();
  });
  it("removes the consumed widget and renders a new challenge after a failed submission", async () => {
    const onVerify = vi.fn();
    const { rerender, unmount } = renderWithProviders(<Captcha action="register" onVerify={onVerify} resetKey={0} />);
    await waitFor(() => expect(renderWidget).toHaveBeenCalledOnce());
    rerender(<Captcha action="register" onVerify={onVerify} resetKey={1} />);
    await waitFor(() => expect(renderWidget).toHaveBeenCalledTimes(2));
    expect(removeWidget).toHaveBeenCalledWith("widget-id");
    expect(onVerify).toHaveBeenLastCalledWith("");
    unmount(); expect(removeWidget).toHaveBeenCalledTimes(2);
  });
});
