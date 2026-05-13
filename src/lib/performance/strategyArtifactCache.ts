/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: strategyArtifactCache.ts
 *
 * Description:
 * Process-level cache store for strategy artifacts. Keeps the latest
 * precomputed payload plus source fingerprints so the loader can reuse
 * unchanged results and patch only the weeks whose inputs changed.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import { query, queryOne } from "@/lib/db";

export type StrategyArtifactFingerprint = {
  engineVersion: string;
  currentWeekOpenUtc: string;
  weekOptionsSignature: string;
  weekFingerprints: Record<string, string>;
};

export type StrategyArtifactEntry<T> = {
  cachedAtUtc: string;
  fingerprint: StrategyArtifactFingerprint;
  payload: T;
};

const STRATEGY_ARTIFACT_CACHE_SYMBOL = Symbol.for("limni.performance.strategyArtifactCache");
const STRATEGY_ARTIFACTS_TABLE = "strategy_artifacts";
const STRATEGY_ARTIFACT_MEMORY_CACHE_TTL_MS = Number(
  process.env.STRATEGY_ARTIFACT_MEMORY_CACHE_TTL_MS ?? "30000",
);

type StoredStrategyArtifactEntry<T> = StrategyArtifactEntry<T> & {
  loadedAtMs: number;
};

function getMemoryCacheTtlMs() {
  if (
    Number.isFinite(STRATEGY_ARTIFACT_MEMORY_CACHE_TTL_MS) &&
    STRATEGY_ARTIFACT_MEMORY_CACHE_TTL_MS >= 0
  ) {
    return Math.floor(STRATEGY_ARTIFACT_MEMORY_CACHE_TTL_MS);
  }
  return 30000;
}

function getStore() {
  const scoped = globalThis as typeof globalThis & {
    [STRATEGY_ARTIFACT_CACHE_SYMBOL]?: Map<string, StoredStrategyArtifactEntry<unknown>>;
  };
  if (!scoped[STRATEGY_ARTIFACT_CACHE_SYMBOL]) {
    scoped[STRATEGY_ARTIFACT_CACHE_SYMBOL] = new Map<string, StoredStrategyArtifactEntry<unknown>>();
  }
  return scoped[STRATEGY_ARTIFACT_CACHE_SYMBOL]!;
}

export function getStrategyArtifactEntry<T>(key: string): StrategyArtifactEntry<T> | null {
  const entry = getStore().get(key);
  if (!entry) return null;
  const ttlMs = getMemoryCacheTtlMs();
  if (ttlMs > 0 && Date.now() - entry.loadedAtMs > ttlMs) {
    getStore().delete(key);
    return null;
  }
  return entry as StrategyArtifactEntry<T>;
}

export function setStrategyArtifactEntry<T>(key: string, entry: StrategyArtifactEntry<T>) {
  getStore().set(key, {
    ...entry,
    loadedAtMs: Date.now(),
  } as StoredStrategyArtifactEntry<unknown>);
}

export function clearStrategyArtifactEntry(key: string) {
  getStore().delete(key);
}

export function clearAllStrategyArtifactEntries() {
  getStore().clear();
}

type StrategyArtifactDbRow = {
  selection_key: string;
  cached_at_utc: string;
  fingerprint_json: StrategyArtifactFingerprint;
  payload_json: unknown;
};

export async function readStrategyArtifactEntry<T>(key: string): Promise<StrategyArtifactEntry<T> | null> {
  const memoryEntry = getStrategyArtifactEntry<T>(key);
  if (memoryEntry) return memoryEntry;

  try {
    const row = await queryOne<StrategyArtifactDbRow>(
      `SELECT selection_key,
              cached_at_utc::text AS cached_at_utc,
              fingerprint_json,
              payload_json
         FROM ${STRATEGY_ARTIFACTS_TABLE}
        WHERE selection_key = $1
        LIMIT 1`,
      [key],
    );

    if (!row) return null;

    const entry: StrategyArtifactEntry<T> = {
      cachedAtUtc: row.cached_at_utc,
      fingerprint: row.fingerprint_json,
      payload: row.payload_json as T,
    };

    setStrategyArtifactEntry(key, entry);
    return entry;
  } catch (error) {
    if (isMissingStrategyArtifactsTable(error)) {
      return null;
    }
    throw error;
  }
}

export async function persistStrategyArtifactEntry<T>(key: string, entry: StrategyArtifactEntry<T>) {
  setStrategyArtifactEntry(key, entry);

  try {
    await query(
      `INSERT INTO ${STRATEGY_ARTIFACTS_TABLE} (
         selection_key,
         cached_at_utc,
         fingerprint_json,
         payload_json
       )
       VALUES ($1, $2::timestamptz, $3::jsonb, $4::jsonb)
       ON CONFLICT (selection_key)
       DO UPDATE SET
         cached_at_utc = EXCLUDED.cached_at_utc,
         fingerprint_json = EXCLUDED.fingerprint_json,
         payload_json = EXCLUDED.payload_json,
         updated_at = NOW()`,
      [
        key,
        entry.cachedAtUtc,
        JSON.stringify(entry.fingerprint),
        JSON.stringify(entry.payload),
      ],
    );
  } catch (error) {
    if (isMissingStrategyArtifactsTable(error)) {
      return;
    }
    throw error;
  }
}

function isMissingStrategyArtifactsTable(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && error.code === "42P01";
}
