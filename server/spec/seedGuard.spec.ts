import { describe, expect, it } from "vitest";
import { checkSeedTarget, describeExistingData, hasRealActivity } from "../src/lib/seedGuard";

/**
 * The demo seed deletes every row in every table. This guard is the only
 * thing standing between that and a production database, and the difference
 * between the two is one environment variable — so it gets covered
 * exhaustively rather than sampled.
 *
 * No database needed: the decision is a pure function of the target.
 */

const LOCAL = "postgresql://postgres:postgres@localhost:5433/storefront?schema=public";
const REMOTE = "postgresql://user:pw@dpg-abc123.oregon-postgres.render.com/storefront_prod";

describe("checkSeedTarget", () => {
  describe("production", () => {
    it("refuses outright, whatever the database is", () => {
      const verdict = checkSeedTarget({ nodeEnv: "production", databaseUrl: LOCAL, confirmToken: undefined });
      expect(verdict.allowed).toBe(false);
    });

    it("cannot be overridden by the confirmation token", () => {
      // Deliberately no escape hatch: an override here is an override
      // somebody reaches for at 2am.
      const verdict = checkSeedTarget({
        nodeEnv: "production",
        databaseUrl: REMOTE,
        confirmToken: "storefront_prod",
      });
      expect(verdict.allowed).toBe(false);
      expect(verdict.allowed === false && verdict.reason).toMatch(/never run in production/);
    });

    it("points the operator at the non-destructive alternative", () => {
      const verdict = checkSeedTarget({ nodeEnv: "production", databaseUrl: LOCAL, confirmToken: undefined });
      expect(verdict.allowed === false && verdict.reason).toMatch(/bootstrap/);
    });
  });

  describe("local databases", () => {
    it.each([
      ["localhost", "postgresql://postgres:postgres@localhost:5433/storefront"],
      ["127.0.0.1", "postgresql://postgres:postgres@127.0.0.1:5432/storefront"],
      ["compose service name", "postgresql://postgres:postgres@postgres:5432/storefront"],
      ["compose alias 'db'", "postgresql://postgres:postgres@db:5432/storefront"],
    ])("allows %s without any confirmation", (_label, url) => {
      const verdict = checkSeedTarget({ nodeEnv: "development", databaseUrl: url, confirmToken: undefined });
      expect(verdict.allowed).toBe(true);
      expect(verdict.allowed === true && verdict.local).toBe(true);
    });

    it("allows the test environment, which CI reseeds constantly", () => {
      expect(checkSeedTarget({ nodeEnv: "test", databaseUrl: LOCAL, confirmToken: undefined }).allowed).toBe(true);
    });

    it("reports the host and database it resolved, so the operator can check", () => {
      const verdict = checkSeedTarget({ nodeEnv: "development", databaseUrl: LOCAL, confirmToken: undefined });
      expect(verdict).toMatchObject({ allowed: true, host: "localhost", database: "storefront" });
    });
  });

  describe("remote databases", () => {
    it("refuses when NODE_ENV is unset but the URL points somewhere real", () => {
      // The actual accident: NODE_ENV forgotten, DATABASE_URL copied from
      // the deployment dashboard.
      const verdict = checkSeedTarget({ nodeEnv: undefined, databaseUrl: REMOTE, confirmToken: undefined });
      expect(verdict.allowed).toBe(false);
      expect(verdict.allowed === false && verdict.reason).toMatch(/remote host/);
    });

    it("still refuses in development mode — the mode is not the protection", () => {
      const verdict = checkSeedTarget({ nodeEnv: "development", databaseUrl: REMOTE, confirmToken: undefined });
      expect(verdict.allowed).toBe(false);
    });

    it("tells the operator the exact command that would work", () => {
      const verdict = checkSeedTarget({ nodeEnv: "development", databaseUrl: REMOTE, confirmToken: undefined });
      expect(verdict.allowed === false && verdict.reason).toContain("SEED_CONFIRM_WIPE=storefront_prod");
    });

    it("lets a correctly named database through", () => {
      const verdict = checkSeedTarget({
        nodeEnv: "development",
        databaseUrl: REMOTE,
        confirmToken: "storefront_prod",
      });
      expect(verdict.allowed).toBe(true);
      expect(verdict.allowed === true && verdict.local).toBe(false);
    });

    it("rejects a token for a different database", () => {
      // Copy-pasting yesterday's confirmation must not unlock today's target.
      const verdict = checkSeedTarget({
        nodeEnv: "development",
        databaseUrl: REMOTE,
        confirmToken: "some_other_db",
      });
      expect(verdict.allowed).toBe(false);
    });

    it.each(["", "yes", "true", "1", "force", "--force"])(
      "rejects the vague confirmation %o that a flag would have accepted",
      (token) => {
        // The whole point of naming the database: a boolean flag becomes
        // muscle memory, a name has to be looked up each time.
        expect(
          checkSeedTarget({ nodeEnv: "development", databaseUrl: REMOTE, confirmToken: token }).allowed,
        ).toBe(false);
      },
    );
  });

  describe("malformed input", () => {
    it("refuses when DATABASE_URL is missing entirely", () => {
      const verdict = checkSeedTarget({ nodeEnv: "development", databaseUrl: undefined, confirmToken: undefined });
      expect(verdict.allowed).toBe(false);
      expect(verdict.allowed === false && verdict.reason).toMatch(/DATABASE_URL is not set/);
    });

    it("refuses an unparseable connection string rather than guessing", () => {
      expect(
        checkSeedTarget({ nodeEnv: "development", databaseUrl: "not-a-url", confirmToken: undefined }).allowed,
      ).toBe(false);
    });

    it("refuses a connection string with no database name", () => {
      expect(
        checkSeedTarget({
          nodeEnv: "development",
          databaseUrl: "postgresql://postgres:postgres@localhost:5432/",
          confirmToken: undefined,
        }).allowed,
      ).toBe(false);
    });
  });

  it("is case-insensitive about the host, since DNS is", () => {
    const verdict = checkSeedTarget({
      nodeEnv: "development",
      databaseUrl: "postgresql://postgres:postgres@LOCALHOST:5432/storefront",
      confirmToken: undefined,
    });
    expect(verdict.allowed).toBe(true);
  });
});

describe("hasRealActivity", () => {
  it("treats any order as a sign somebody actually used this database", () => {
    // The seed creates no orders, so an order can only have come from a
    // person going through checkout.
    expect(hasRealActivity({ users: 500, sellers: 500, products: 1200, orders: 1 })).toBe(true);
  });

  it("does not flag a freshly seeded catalogue", () => {
    expect(hasRealActivity({ users: 541, sellers: 500, products: 1200, orders: 0 })).toBe(false);
  });
});

describe("describeExistingData", () => {
  it("names every count, so the cost of a wipe is concrete before it happens", () => {
    const summary = describeExistingData({ users: 541, sellers: 500, products: 1200, orders: 12 });
    expect(summary).toBe("541 users, 500 sellers, 1200 products, 12 orders");
  });
});
