import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiFetch } from "./client";
import { useAuthStore } from "../store/authStore";

const fetchMock = vi.fn<typeof fetch>();
beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  useAuthStore.setState({ accessToken: "old-token", status: "authenticated", user: null });
});
afterEach(() => { vi.unstubAllGlobals(); vi.resetAllMocks(); useAuthStore.getState().clearAuth(); });

describe("apiFetch cancellation and refresh", () => {
  it("sends multipart images without a JSON header and preserves the body across token refresh", async () => {
    const body = new FormData(); body.append("image", new File(["photo"], "photo.png", { type: "image/png" }));
    fetchMock.mockResolvedValueOnce(new Response("{}", { status: 401 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ accessToken: "new-token", user: { id: "user", email: "user@example.com", role: "customer", avatarUrl: "https://images.example.com/photo.webp" } })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true })));
    await apiFetch("/auth/avatar", { method: "POST", body });
    expect(fetchMock.mock.calls[0][1]?.body).toBe(body);
    expect(fetchMock.mock.calls[2][1]?.body).toBe(body);
    expect(fetchMock.mock.calls[0][1]?.headers).not.toHaveProperty("Content-Type");
    expect(useAuthStore.getState().user?.avatarUrl).toBe("https://images.example.com/photo.webp");
  });
  it("preserves cancellation through a successful refresh and retries once", async () => {
    const controller = new AbortController();
    fetchMock.mockResolvedValueOnce(new Response("{}", { status: 401 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ accessToken: "new-token" })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true })));
    await expect(apiFetch("/rag/answer", { method: "POST", body: { query: "headphones" }, signal: controller.signal })).resolves.toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    for (const call of fetchMock.mock.calls) expect(call[1]?.signal).toBe(controller.signal);
    expect(fetchMock.mock.calls[2][1]?.headers).toMatchObject({ Authorization: "Bearer new-token" });
  });

  it("does not log out or retry when cancelled during token refresh", async () => {
    const controller = new AbortController();
    fetchMock.mockResolvedValueOnce(new Response("{}", { status: 401 })).mockImplementationOnce(async () => {
      controller.abort();
      throw new DOMException("Aborted", "AbortError");
    });
    await expect(apiFetch("/rag/answer", { signal: controller.signal })).rejects.toMatchObject({ name: "AbortError" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(useAuthStore.getState().status).toBe("authenticated");
    expect(useAuthStore.getState().accessToken).toBe("old-token");
  });
});
