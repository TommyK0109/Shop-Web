import { afterEach, describe, expect, it, vi } from "vitest";
import { verifyCaptcha } from "../src/services/captcha.services";

vi.mock("../src/env", () => ({ env: { NODE_ENV: "production", TURNSTILE_SECRET_KEY: "production-secret", CLIENT_ORIGIN: "https://shop.example.com" } }));
afterEach(() => vi.unstubAllGlobals());

describe("server CAPTCHA verification", () => {
  it("rejects missing and oversized tokens before calling Cloudflare", async () => {
    const fetchMock = vi.fn(); vi.stubGlobal("fetch", fetchMock);
    await expect(verifyCaptcha(undefined, "login")).rejects.toMatchObject({ statusCode: 400 });
    await expect(verifyCaptcha("x".repeat(2049), "register")).rejects.toMatchObject({ statusCode: 400 });
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("sends the token to Siteverify and accepts the expected hostname/action", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: true, hostname: "shop.example.com", action: "login" })));
    vi.stubGlobal("fetch", fetchMock);
    await expect(verifyCaptcha("valid-token", "login")).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledWith("https://challenges.cloudflare.com/turnstile/v0/siteverify", expect.objectContaining({ method: "POST", signal: expect.any(AbortSignal) }));
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ secret: "production-secret", response: "valid-token" });
  });
  it.each([
    { success: false },
    { success: true, hostname: "evil.example.com", action: "login" },
    { success: true, hostname: "shop.example.com", action: "register" },
    { success: true },
  ])("rejects failure, replay, or mismatched context: %j", async (result) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(result))));
    await expect(verifyCaptcha("token", "login")).rejects.toMatchObject({ statusCode: 400 });
  });
  it("fails closed on provider/network errors", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network error")));
    await expect(verifyCaptcha("token", "login")).rejects.toMatchObject({ statusCode: 503 });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("unavailable", { status: 503 })));
    await expect(verifyCaptcha("token", "register")).rejects.toMatchObject({ statusCode: 503 });
  });
});
