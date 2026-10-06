/** Hosts that can only be a developer's own machine or a compose network. */
const LOCAL_HOSTS = new Set([
  "localhost",
  "127.0.0.1",
  "::1",
  "[::1]",
  "postgres",
  "db",
  "database",
]);

export interface SeedTarget {
  /** Usually process.env.NODE_ENV. */
  nodeEnv: string | undefined;
  /** Usually process.env.DATABASE_URL. */
  databaseUrl: string | undefined;
  confirmToken: string | undefined;
}

export type SeedGuardResult =
  | { allowed: true; host: string; database: string; local: boolean }
  | { allowed: false; reason: string };

function parseTarget(databaseUrl: string): { host: string; database: string } | null {
  try {
    const url = new URL(databaseUrl);
    const database = decodeURIComponent(url.pathname.replace(/^\//, ""));
    if (!database) return null;
    return { host: url.hostname.toLowerCase(), database };
  } catch {
    return null;
  }
}

export function checkSeedTarget(target: SeedTarget): SeedGuardResult {
  if (!target.databaseUrl) {
    return { allowed: false, reason: "DATABASE_URL is not set — refusing to run against an unknown database." };
  }
  if (target.nodeEnv === "production") {
    return {
      allowed: false,
      reason:
        "NODE_ENV=production. The demo seed deletes every row in the database and will never run in production.\n" +
        "  To create the categories and the first admin account on a real deployment, use `npm run bootstrap` instead —\n" +
        "  it only ever inserts, and never deletes anything.",
    };
  }

  const parsed = parseTarget(target.databaseUrl);
  if (!parsed) {
    return { allowed: false, reason: "DATABASE_URL is not a valid connection string with a database name." };
  }

  const { host, database } = parsed;
  const local = LOCAL_HOSTS.has(host);

  // Layer 2: a remote host is the accident case — NODE_ENV left unset while
  // DATABASE_URL points at staging or production. Typing the database name
  // is the only way through.
  if (!local && target.confirmToken !== database) {
    return {
      allowed: false,
      reason:
        `DATABASE_URL points at a remote host (${host}), not this machine.\n` +
        "  The demo seed deletes every row in the database. If you are certain this is a throwaway database,\n" +
        `  confirm by naming it explicitly:\n\n` +
        `    SEED_CONFIRM_WIPE=${database} npm run seed --workspace server\n`,
    };
  }

  return { allowed: true, host, database, local };
}

/** Row counts that make the cost of a wipe concrete before it happens. */
export interface ExistingData {
  users: number;
  orders: number;
  products: number;
  sellers: number;
}

export function hasRealActivity(data: ExistingData): boolean {
  // Orders are the signal that matters: the demo seed creates none, so any
  // order at all means somebody actually used this database.
  return data.orders > 0;
}

/** Human-readable summary of what a wipe is about to destroy. */
export function describeExistingData(data: ExistingData): string {
  const parts = [
    `${data.users} users`,
    `${data.sellers} sellers`,
    `${data.products} products`,
    `${data.orders} orders`,
  ];
  return parts.join(", ");
}
