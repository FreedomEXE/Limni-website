/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: canonShardComposition.ts
 *
 * Description:
 * Pure composition helpers for turning verified canon week shard records back
 * into app-native closed-history bundles.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import type { AssetClass } from "@/lib/cotMarkets";
import type { ClosedHistoryBundle, ClosedHistoryRow } from "@/lib/basket/basketSummaryTypes";
import type { CanonShardRecord } from "@/lib/canon/canonShardTypes";
import { normalizePerformanceAssetSelection } from "@/lib/performance/performanceAssetScope";

function rowSortKey(row: ClosedHistoryRow) {
  return [
    row.weekOpenUtc,
    row.symbol,
    row.rowKind,
    row.sourceModel ?? "",
    row.tier ?? "",
    row.direction ?? "",
    row.fillSeq ?? "",
    row.canonicalTradeId ?? "",
    row.executionTradeId ?? "",
    row.parentNaturalRef ?? "",
  ].join("|");
}

function sortRows(rows: ClosedHistoryRow[]) {
  return [...rows].sort((left, right) => rowSortKey(left).localeCompare(rowSortKey(right)));
}

function latestGeneratedAt(records: CanonShardRecord[]) {
  return records
    .map((record) => record.shard.metadata.generatedAtUtc)
    .filter(Boolean)
    .sort()
    .at(-1) ?? new Date(0).toISOString();
}

export function composeClosedHistoryBundleFromShards(options: {
  records: CanonShardRecord[];
  strategyVariant: string;
  scope?: readonly AssetClass[] | null;
  weekOpenUtcs?: readonly string[] | null;
}): ClosedHistoryBundle {
  const normalizedScope = normalizePerformanceAssetSelection(options.scope);
  const selected = new Set(normalizedScope);
  const allowedWeeks = options.weekOpenUtcs ? new Set(options.weekOpenUtcs) : null;
  const rows = sortRows(
    options.records
      .filter((record) => record.strategyVariant === options.strategyVariant)
      .filter((record) => !allowedWeeks || allowedWeeks.has(record.weekOpenUtc))
      .flatMap((record) => record.shard.payload.closedHistoryRows)
      .filter((row) => row.strategyVariant === options.strategyVariant)
      .filter((row) => !allowedWeeks || allowedWeeks.has(row.weekOpenUtc))
      .filter((row) => selected.has(row.assetClass)),
  );

  return {
    rows,
    strategyVariant: options.strategyVariant,
    scope: normalizedScope,
    generatedAt: latestGeneratedAt(options.records),
  };
}
