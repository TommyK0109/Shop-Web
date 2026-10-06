import { createHash } from "node:crypto";
import { getRagRedis } from "./ragRedis";

/** Cache failure must never replay expensive provider work. */
export async function onceCached<T>(key: string, work: () => Promise<T>, valid: (value: unknown) => value is T): Promise<T> {
  try {
    const cached = await (await getRagRedis()).get(key);
    if (cached !== null) {
      const value: unknown = JSON.parse(cached);
      if (valid(value)) return value;
    }
  } catch { /* cache reads are optional; provider work has separate mandatory limits */ }
  const value = await work();
  try { await (await getRagRedis()).set(key, JSON.stringify(value), { EX: 3600 }); } catch { /* never repeat work */ }
  return value;
}

export function queryEmbeddingKey(text: string, model: string, dimensions: number) {
  return `rag:query:v1:${model}:${dimensions}:${createHash("sha256").update(text).digest("hex")}`;
}
