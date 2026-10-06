// Imported for its `declare module "vitest"` block, which is what makes
// toBeInTheDocument & co. typecheck. Its own expect.extend call doesn't take
// on Vitest 4 — the matchers land somewhere the assertion prototype never
// reads — so they're registered explicitly below. Dropping either line
// breaks the suite: this one at compile time, the next at run time.
import "@testing-library/jest-dom/vitest";
import * as matchers from "@testing-library/jest-dom/matchers";
import { afterEach, expect } from "vitest";
import { cleanup } from "@testing-library/react";

expect.extend(matchers);

// Vitest runs with globals: false, so RTL's automatic cleanup (which hooks
// the global afterEach) never registers — wire it up explicitly.
afterEach(() => {
  cleanup();
});
