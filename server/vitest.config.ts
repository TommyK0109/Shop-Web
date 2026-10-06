import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // These two experimental suites require the optional Redis service.
    // All storefront/API specs run against PostgreSQL without Redis.
    exclude: ["**/node_modules/**", "**/dist/**", ...(!process.env.REDIS_URL ? ["spec/rag-limits.spec.ts", "spec/rag-retrieval.spec.ts"] : [])],
    environment: "node",
    globals: false,
    testTimeout: 15000,
    hookTimeout: 15000,
    // These are integration tests: every file talks to the same database
    // through its own Prisma client. Running the files in parallel (vitest's
    // default) opened one connection pool per worker, which intermittently
    // crashed a worker outright and silently dropped that file's tests from
    // the run. Serial execution keeps one pool at a time and also means test
    // files can never race each other over shared rows.
    fileParallelism: false,
  },
});
