import { describe, expect, it, vi } from "vitest";

const doubles = vi.hoisted(() => ({ createClient: vi.fn() }));
vi.mock("redis", () => ({ createClient: doubles.createClient }));
vi.mock("../src/env", () => ({ env: { REDIS_URL: "" } }));
import { bumpCacheVersion, getCacheVersion, getOrSetCache } from "../src/lib/cache";

describe("local setup without Redis", () => {
  it("reads current data once without creating a Redis connection", async () => {
    const read = vi.fn().mockResolvedValue({ stockQty: 3 });
    expect(await getOrSetCache("products", 30, read)).toEqual({ stockQty: 3 });
    expect(read).toHaveBeenCalledTimes(1);
    await bumpCacheVersion("products");
    expect(await getCacheVersion("products")).toBe(0);
    expect(doubles.createClient).not.toHaveBeenCalled();
  });
  it("propagates database errors without repeating the database operation", async () => {
    const error = new Error("database unavailable");
    const read = vi.fn().mockRejectedValue(error);
    await expect(getOrSetCache("products", 30, read)).rejects.toBe(error);
    expect(read).toHaveBeenCalledTimes(1);
  });
});
