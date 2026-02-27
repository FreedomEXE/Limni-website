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

/**
 * Read a value from the poseidon_kv table.
 * Returns empty string if key doesn't exist yet.
 */
export async function kvGet(key: string): Promise<string> {
  const row = await queryOne<KvRow>(
    `SELECT value FROM poseidon_kv WHERE key = $1`,
    [key],
  );
  return row?.value ?? "";
}

/**
 * Upsert a value into the poseidon_kv table.
 */
export async function kvSet(key: string, value: string): Promise<void> {
  await query(
    `INSERT INTO poseidon_kv (key, value, updated_at)
     VALUES ($1, $2, NOW())
     ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()`,
    [key, value],
  );
}
