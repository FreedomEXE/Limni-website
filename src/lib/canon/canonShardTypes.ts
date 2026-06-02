/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: canonShardTypes.ts
 *
 * Description:
 * Shared release-canon week shard contracts used by server inventory routes
 * and future client-side IndexedDB shard storage.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import type { ClosedHistoryRow } from "@/lib/basket/basketSummaryTypes";

export const CANON_INVENTORY_SCHEMA_VERSION = "canon-inventory-v1" as const;
export const CANON_WEEK_SHARD_SCHEMA_VERSION = "canon-week-shard-v1" as const;
export const CANON_AGGREGATE_SHARD_SCHEMA_VERSION = "canon-aggregate-shard-v1" as const;
export const CANON_WEEK_KEY_SEMANTICS = "display-week-open-utc" as const;

export type CanonShardSource = "release-canon" | "closed-week-delta";

export type CanonWeekShardEntry = {
  weekOpenUtc: string;
  source: CanonShardSource;
  schemaVersion: typeof CANON_WEEK_SHARD_SCHEMA_VERSION;
  sha256: `sha256:${string}`;
  sizeBytes: number;
  generatedAtUtc: string;
  rowCounts: {
    rows: number;
    trades: number;
    pairs: number;
  };
};

export type CanonAggregateInventoryEntry = {
  key: string;
  schemaVersion: typeof CANON_AGGREGATE_SHARD_SCHEMA_VERSION;
  status: "not-materialized" | "available";
  sha256: `sha256:${string}` | null;
  sizeBytes: number;
  generatedAtUtc: string | null;
};

export type CanonVariantInventory = {
  strategyVariant: string;
  baselineWeeks: CanonWeekShardEntry[];
  deltaWeeks: CanonWeekShardEntry[];
  aggregate: CanonAggregateInventoryEntry;
  latestClosedWeekOpenUtc: string | null;
};

export type CanonInventoryManifest = {
  schemaVersion: typeof CANON_INVENTORY_SCHEMA_VERSION;
  releaseLine: string;
  appVersion: string;
  canonVersion: string;
  cacheNamespace: string;
  currentWeekOpenUtc: string;
  latestClosedWeekOpenUtc: string | null;
  weekKeySemantics: typeof CANON_WEEK_KEY_SEMANTICS;
  variants: Record<string, CanonVariantInventory>;
  generatedAtUtc: string;
};

export type CanonWeekShard = {
  metadata: {
    schemaVersion: typeof CANON_WEEK_SHARD_SCHEMA_VERSION;
    canonVersion: string;
    releaseLine: string;
    appVersionPreparedFrom: string;
    strategyVariant: string;
    weekOpenUtc: string;
    weekCloseUtc: string;
    weekKeySemantics: typeof CANON_WEEK_KEY_SEMANTICS;
    source: CanonShardSource;
    generatedAtUtc: string;
    sourceHash: `sha256:${string}`;
    payloadHash: `sha256:${string}`;
    rowCounts: {
      rows: number;
      trades: number;
      pairs: number;
      weekResults: number;
    };
    anchors: {
      canonicalAnchorVersion: string;
      executionAnchorVersion: string;
      canonicalWeeks: string[];
      executionWeeks: string[];
    };
  };
  payload: {
    weekOptions: string[];
    closedHistoryRows: ClosedHistoryRow[];
  };
};

export type CanonShardRecord = {
  key: string;
  canonVersion: string;
  strategyVariant: string;
  weekOpenUtc: string;
  source: CanonShardSource;
  schemaVersion: typeof CANON_WEEK_SHARD_SCHEMA_VERSION;
  payloadHash: `sha256:${string}`;
  storedAtUtc: string;
  shard: CanonWeekShard;
};

export type CanonInventoryRecord = {
  key: string;
  canonVersion: string;
  strategyVariant: string;
  weeks: string[];
  latestClosedWeekOpenUtc: string | null;
  updatedAtUtc: string;
};

export type CanonKernelMetaRecord = {
  key: string;
  releaseLine: string;
  appVersion: string;
  canonVersion: string;
  cacheNamespace: string;
  schemaVersion: typeof CANON_INVENTORY_SCHEMA_VERSION;
  updatedAtUtc: string;
};

export function canonWeekShardKey(canonVersion: string, strategyVariant: string, weekOpenUtc: string) {
  return `${canonVersion}::${strategyVariant}::${weekOpenUtc}`;
}

export function canonVariantInventoryKey(canonVersion: string, strategyVariant: string) {
  return `${canonVersion}::${strategyVariant}`;
}

