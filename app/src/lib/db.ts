import { Pool, type PoolClient } from "pg";

import { rootServerEnv } from "@/lib/server/rootEnv";

let pool: Pool | null = null;
let poolResetPromise: Promise<void> | null = null;

function numberEnv(name: string, fallback: number) {
  const raw = rootServerEnv(name);
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

const DB_QUERY_RETRY_LIMIT = numberEnv(
  "DB_QUERY_RETRY_LIMIT",
  process.env.NODE_ENV === "production" ? 2 : 0,
);
const DB_CONNECTION_TIMEOUT_MS = numberEnv(
  "DB_CONNECTION_TIMEOUT_MS",
  process.env.NODE_ENV === "production" ? 10000 : 4000,
);
const DB_POOL_MAX = numberEnv(
  "DB_POOL_MAX",
  process.env.NODE_ENV === "production" ? 10 : 4,
);

/**
 * Get the database connection pool (singleton pattern)
 */
export function getPool(): Pool {
  if (!pool) {
    const databaseUrl = rootServerEnv("DATABASE_URL");

    if (!databaseUrl) {
      throw new Error("DATABASE_URL environment variable not set");
    }

    const requiresSsl =
      process.env.NODE_ENV === "production" ||
      databaseUrl.includes("render.com") ||
      databaseUrl.includes("sslmode=require");

    pool = new Pool({
      connectionString: databaseUrl,
      ssl: requiresSsl ? { rejectUnauthorized: false } : false,
      max: DB_POOL_MAX,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: DB_CONNECTION_TIMEOUT_MS,
    });

    pool.on("error", (err) => {
      console.error(
        "Unexpected error on idle PostgreSQL client",
        err instanceof Error ? err.message : err,
      );
    });
  }

  return pool;
}

/**
 * Execute a query and return rows
 */
export async function query<T = unknown>(
  text: string,
  params?: readonly unknown[]
): Promise<T[]> {
  const retryLimit = Number.isFinite(DB_QUERY_RETRY_LIMIT)
    ? Math.max(0, Math.min(2, Math.floor(DB_QUERY_RETRY_LIMIT)))
    : 2;
  const attempts = retryLimit + 1;
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const pool = getPool();
      const result = await pool.query(text, params as unknown[]);
      return result.rows;
    } catch (error) {
      lastError = error;
      if (attempt >= attempts || !isTransientConnectionError(error)) {
        throw error;
      }
      console.warn(
        `[db] Retrying transient database query failure (${attempt}/${attempts - 1}):`,
        error instanceof Error ? error.message : error,
      );
      await resetPoolAfterTransientError();
    }
  }

  throw lastError;
}

/**
 * Execute a query and return a single row (or null)
 */
export async function queryOne<T = unknown>(
  text: string,
  params?: readonly unknown[]
): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows.length > 0 ? rows[0] : null;
}

/**
 * Get a client from the pool for transactions
 */
export async function getClient(): Promise<PoolClient> {
  const pool = getPool();
  return await pool.connect();
}

function isTransientConnectionError(error: unknown) {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return (
    message.includes("connection terminated") ||
    message.includes("connection timeout") ||
    message.includes("terminating connection") ||
    message.includes("connection ended unexpectedly")
  );
}

async function resetPoolAfterTransientError() {
  if (!pool) return;
  if (!poolResetPromise) {
    const stalePool = pool;
    pool = null;
    poolResetPromise = stalePool
      .end()
      .catch((error) => {
        console.warn(
          "[db] Failed to close stale PostgreSQL pool:",
          error instanceof Error ? error.message : error,
        );
      })
      .finally(() => {
        poolResetPromise = null;
      });
  }
  await poolResetPromise;
}

/**
 * Execute function within a transaction
 */
export async function transaction<T>(
  callback: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await getClient();
  try {
    await client.query("BEGIN");
    const result = await callback(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
