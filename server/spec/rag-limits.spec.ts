import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { env } from "../src/env";
import { closeRagRedis, getRagRedis } from "../src/lib/ragRedis";
import { acquireRagSlot } from "../src/middleware/ragLimits";

describe("shared Redis RAG limits", () => {
  const users: string[] = [];
  const user = () => { const id = `spec-${randomUUID()}`; users.push(id); return id; };
  afterAll(async () => {
    try {
      const redis = await getRagRedis();
      for (const id of users) await redis.del([`rag:user:${id}:active`, `rag:user:${id}:minute`]);
    } finally { await closeRagRedis(); }
  });
  it("atomically admits only one active request per user", async () => {
    const id = user();
    const results = await Promise.allSettled([acquireRagSlot(id), acquireRagSlot(id)]);
    const accepted = results.filter((result) => result.status === "fulfilled");
    expect(accepted).toHaveLength(1);
    expect(results.find((result) => result.status === "rejected")).toMatchObject({ reason: { statusCode: 429 } });
    for (const result of accepted) if (result.status === "fulfilled") await result.value();
    await (await acquireRagSlot(id))();
  });
  it("retains the shared rate count after each request releases its slot", async () => {
    const id = user();
    for (let i = 0; i < env.RAG_USER_REQUESTS_PER_MINUTE; i++) await (await acquireRagSlot(id))();
    await expect(acquireRagSlot(id)).rejects.toMatchObject({ statusCode: 429 });
    await (await acquireRagSlot(user()))();
  });
});
