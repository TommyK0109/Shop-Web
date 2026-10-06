import type { NextFunction, Request, Response } from "express";
import { afterEach, describe, expect, it, vi } from "vitest";
import { authLimit } from "../src/middleware/authLimits";

afterEach(() => vi.useRealTimers());
describe("authentication rate limits", () => {
  it("rejects repeated requests, isolates keys, and permits requests after expiry", () => {
    vi.useFakeTimers();
    const limit = authLimit(2, (req) => req.ip!, 1000);
    const next = vi.fn(); const setHeader = vi.fn();
    const call = (ip: string) => limit({ ip } as Request, { setHeader } as unknown as Response, next as NextFunction);
    call("one"); call("one"); call("one");
    expect(next.mock.calls[2][0]).toMatchObject({ statusCode: 429 });
    expect(setHeader).toHaveBeenCalledWith("Retry-After", 1);
    call("two"); expect(next.mock.calls[3]).toEqual([]);
    vi.advanceTimersByTime(1001); call("one"); expect(next.mock.calls[4]).toEqual([]);
  });
});
