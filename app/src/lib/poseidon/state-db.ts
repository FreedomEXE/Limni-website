/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: state-db.ts
 *
 * Description:
 * Shared database-backed key-value store for all Poseidon runtime state.
 * Replaces ephemeral filesystem writes that got wiped on every deploy.
 * Uses the poseidon_kv table (migration 010).
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import { query, queryOne } from "@/lib/db";

type KvRow = { key: string; value: string; updated_at: Date };
type PgErrorLike = { code?: string };

const MISSING_RELATION_CODE = "42P01";
let kvReady = false;
let kvInitPromise: Promise<void> | null = null;

function isPgErrorLike(error: unknown): error is PgErrorLike {
  return typeof error === "object" && error !== null && "code" in error;
}

function isMissingRelation(error: unknown): boolean {
  return isPgErrorLike(error) && error.code === MISSING_RELATION_CODE;
}

async function initKvTable(): Promise<void> {
  await query(`
    CREATE TABLE IF NOT EXISTS poseidon_kv (
      key        VARCHAR(100) PRIMARY KEY,
      value      TEXT NOT NULL DEFAULT '',
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await query(`
    INSERT INTO poseidon_kv (key, value) VALUES
      ('session_state', ''),
      ('conversations', '[]'),
      ('behavior', '{}'),
      ('missed_turns', '[]'),
      ('curation_flag', '{}')
    ON CONFLICT (key) DO NOTHING
  `);
}

async function ensureKvTable(): Promise<void> {
  if (kvReady) return;
  if (!kvInitPromise) {
    kvInitPromise = initKvTable()
      .then(() => {
        kvReady = true;
      })
      .catch((error) => {
        kvReady = false;
        kvInitPromise = null;
        throw error;
      });
  }
  await kvInitPromise;
}

async function withKvReady<T>(operation: () => Promise<T>): Promise<T> {
  await ensureKvTable();
  try {
    return await operation();
  } catch (error) {
    if (!isMissingRelation(error)) throw error;

    // Table disappeared or migration was partial; self-heal once and retry.
    kvReady = false;
    kvInitPromise = null;
    await ensureKvTable();
    return await operation();
  }
}

/**
 * Read a value from the poseidon_kv table.
 * Returns empty string if key doesn't exist yet.
 */
export async function kvGet(key: string): Promise<string> {
  const row = await withKvReady(async () => await queryOne<KvRow>(
    `SELECT value FROM poseidon_kv WHERE key = $1`,
    [key],
  ));
  return row?.value ?? "";
}

/**
 * Upsert a value into the poseidon_kv table.
 */
export async function kvSet(key: string, value: string): Promise<void> {
  await withKvReady(async () => {
    await query(
      `INSERT INTO poseidon_kv (key, value, updated_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()`,
      [key, value],
    );
  });
}
