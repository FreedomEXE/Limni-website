/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: strategyWeekShardCache.ts
 *
 * Description:
 * Persistence layer for per-week strategy artifact shards. Enables
 * incremental artifact building where each week is computed and
 * persisted independently.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import { query, queryOne } from "@/lib/db";
import type { BasketPathSummary } from "@/lib/performance/basketPathEngine";
import type { EngineSimulationGroup } from "@/lib/performance/engineAdapter";
import type { WeeklyHoldResult } from "@/lib/performance/weeklyHoldEngine";

const STRATEGY_WEEK_SHARDS_TABLE = "strategy_week_shards";
let ensureWeekShardsTablePromise: Promise<void> | null = null;

export type WeekShardEntry = {
  selectionKey: string;
  weekOpenUtc: string;
  engineVersion: string;
  weekFingerprint: string;
  weekResult: WeeklyHoldResult;
  pathSummary: BasketPathSummary;
  sim: EngineSimulationGroup;
  cachedAtUtc: string;
};

type WeekShardDbRow = {
  selection_key: string;
  week_open_utc: string;
  engine_version: string;
  week_fingerprint: string;
  week_result_json: WeeklyHoldResult;
  path_summary_json: BasketPathSummary;
  sim_json: EngineSimulationGroup;
  cached_at_utc: string;
};

function normalizeUtcString(value: string) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toISOString();
}

function mapWeekShardRow(row: WeekShardDbRow): WeekShardEntry {
  return {
    selectionKey: row.selection_key,
    weekOpenUtc: normalizeUtcString(row.week_open_utc),
    engineVersion: row.engine_version,
    weekFingerprint: row.week_fingerprint,
    weekResult: row.week_result_json,
    pathSummary: row.path_summary_json,
    sim: row.sim_json,
    cachedAtUtc: normalizeUtcString(row.cached_at_utc),
  };
}

export async function readWeekShards(
  selectionKey: string,
  engineVersion: string,
): Promise<WeekShardEntry[]> {
  try {
    const rows = await query<WeekShardDbRow>(
      `SELECT selection_key,
              week_open_utc::text AS week_open_utc,
              engine_version,
              week_fingerprint,
              week_result_json,
              path_summary_json,
              sim_json,
              cached_at_utc::text AS cached_at_utc
         FROM ${STRATEGY_WEEK_SHARDS_TABLE}
        WHERE selection_key = $1
          AND engine_version = $2
        ORDER BY week_open_utc ASC`,
      [selectionKey, engineVersion],
    );
    return rows.map(mapWeekShardRow);
  } catch (error) {
    if (isMissingWeekShardsTable(error)) {
      await ensureWeekShardsTable();
      return [];
    }
    throw error;
  }
}

export async function readWeekShard(
  selectionKey: string,
  weekOpenUtc: string,
  engineVersion: string,
): Promise<WeekShardEntry | null> {
  try {
    const row = await queryOne<WeekShardDbRow>(
      `SELECT selection_key,
              week_open_utc::text AS week_open_utc,
              engine_version,
              week_fingerprint,
              week_result_json,
              path_summary_json,
              sim_json,
              cached_at_utc::text AS cached_at_utc
         FROM ${STRATEGY_WEEK_SHARDS_TABLE}
        WHERE selection_key = $1
          AND week_open_utc = $2::timestamptz
          AND engine_version = $3
        LIMIT 1`,
      [selectionKey, weekOpenUtc, engineVersion],
    );
    return row ? mapWeekShardRow(row) : null;
  } catch (error) {
    if (isMissingWeekShardsTable(error)) {
      await ensureWeekShardsTable();
      return null;
    }
    throw error;
  }
}

export async function persistWeekShard(entry: WeekShardEntry): Promise<void> {
  try {
    await query(
      `INSERT INTO ${STRATEGY_WEEK_SHARDS_TABLE} (
         selection_key,
         week_open_utc,
         engine_version,
         week_fingerprint,
         week_result_json,
         path_summary_json,
         sim_json,
         cached_at_utc
       )
       VALUES ($1, $2::timestamptz, $3, $4, $5::jsonb, $6::jsonb, $7::jsonb, $8::timestamptz)
       ON CONFLICT (selection_key, week_open_utc)
       DO UPDATE SET
         engine_version = EXCLUDED.engine_version,
         week_fingerprint = EXCLUDED.week_fingerprint,
         week_result_json = EXCLUDED.week_result_json,
         path_summary_json = EXCLUDED.path_summary_json,
         sim_json = EXCLUDED.sim_json,
         cached_at_utc = EXCLUDED.cached_at_utc,
         updated_at = NOW()`,
      [
        entry.selectionKey,
        entry.weekOpenUtc,
        entry.engineVersion,
        entry.weekFingerprint,
        JSON.stringify(entry.weekResult),
        JSON.stringify(entry.pathSummary),
        JSON.stringify(entry.sim),
        entry.cachedAtUtc,
      ],
    );
  } catch (error) {
    if (isMissingWeekShardsTable(error)) {
      await ensureWeekShardsTable();
      await persistWeekShard(entry);
      return;
    }
    throw error;
  }
}

export async function listReadyWeekShards(
  selectionKey: string,
  engineVersion: string,
  expectedFingerprints: Record<string, string>,
): Promise<{ ready: string[]; stale: string[]; missing: string[] }> {
  const expectedWeeks = Object.keys(expectedFingerprints);
  const shards = await readWeekShards(selectionKey, engineVersion);
  const shardByWeek = new Map(shards.map((shard) => [shard.weekOpenUtc, shard]));
  const ready: string[] = [];
  const stale: string[] = [];
  const missing: string[] = [];

  for (const weekOpenUtc of expectedWeeks) {
    const shard = shardByWeek.get(weekOpenUtc);
    if (!shard) {
      missing.push(weekOpenUtc);
      continue;
    }
    if (shard.weekFingerprint === expectedFingerprints[weekOpenUtc]) {
      ready.push(weekOpenUtc);
    } else {
      stale.push(weekOpenUtc);
    }
  }

  return { ready, stale, missing };
}

export async function countWeekShardProgress(
  selectionKey: string,
  engineVersion: string,
  expectedWeeks: string[],
): Promise<{ ready: number; total: number }> {
  if (expectedWeeks.length === 0) {
    return { ready: 0, total: 0 };
  }

  try {
    const rows = await query<{ week_open_utc: string }>(
      `SELECT week_open_utc::text AS week_open_utc
         FROM ${STRATEGY_WEEK_SHARDS_TABLE}
        WHERE selection_key = $1
          AND engine_version = $2
          AND week_open_utc = ANY($3::timestamptz[])`,
      [selectionKey, engineVersion, expectedWeeks],
    );
    const expectedSet = new Set(expectedWeeks);
    const ready = new Set(
      rows
        .map((row) => normalizeUtcString(row.week_open_utc))
        .filter((weekOpenUtc) => expectedSet.has(weekOpenUtc)),
    );
    return { ready: ready.size, total: expectedWeeks.length };
  } catch (error) {
    if (isMissingWeekShardsTable(error)) {
      await ensureWeekShardsTable();
      return { ready: 0, total: expectedWeeks.length };
    }
    throw error;
  }
}

function isMissingWeekShardsTable(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && error.code === "42P01";
}

async function ensureWeekShardsTable() {
  ensureWeekShardsTablePromise ??= (async () => {
    await query(`
      CREATE TABLE IF NOT EXISTS ${STRATEGY_WEEK_SHARDS_TABLE} (
        selection_key TEXT NOT NULL,
        week_open_utc TIMESTAMPTZ NOT NULL,
        engine_version TEXT NOT NULL,
        week_fingerprint TEXT NOT NULL,
        week_result_json JSONB NOT NULL,
        path_summary_json JSONB NOT NULL,
        sim_json JSONB NOT NULL,
        cached_at_utc TIMESTAMPTZ NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (selection_key, week_open_utc)
      )
    `);
    await query(`
      CREATE INDEX IF NOT EXISTS idx_strategy_week_shards_updated_at
        ON ${STRATEGY_WEEK_SHARDS_TABLE} (updated_at DESC)
    `);
  })().catch((error) => {
    ensureWeekShardsTablePromise = null;
    throw error;
  });
  return ensureWeekShardsTablePromise;
}
