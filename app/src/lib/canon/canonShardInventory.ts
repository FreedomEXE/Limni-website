/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: canonShardInventory.ts
 *
 * Description:
 * Pure client/server-safe inventory helpers for comparing local canon week
 * shards against the server inventory contract.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import type {
  CanonShardRecord,
  CanonVariantInventory,
  CanonWeekShardEntry,
} from "@/lib/canon/canonShardTypes";

export type CanonShardGap = {
  weekOpenUtc: string;
  reason: "missing" | "hash-mismatch" | "schema-mismatch";
  expected: CanonWeekShardEntry;
  local: CanonShardRecord | null;
};

export function expectedWeeksForVariant(inventory: CanonVariantInventory) {
  return [...inventory.baselineWeeks, ...inventory.deltaWeeks]
    .sort((left, right) => left.weekOpenUtc.localeCompare(right.weekOpenUtc));
}

export function computeCanonShardGaps(
  inventory: CanonVariantInventory,
  localRecords: CanonShardRecord[],
): CanonShardGap[] {
  const localByWeek = new Map(localRecords.map((record) => [record.weekOpenUtc, record]));
  const gaps: CanonShardGap[] = [];

  for (const expected of expectedWeeksForVariant(inventory)) {
    const local = localByWeek.get(expected.weekOpenUtc) ?? null;
    if (!local) {
      gaps.push({
        weekOpenUtc: expected.weekOpenUtc,
        reason: "missing",
        expected,
        local,
      });
      continue;
    }
    if (local.schemaVersion !== expected.schemaVersion) {
      gaps.push({
        weekOpenUtc: expected.weekOpenUtc,
        reason: "schema-mismatch",
        expected,
        local,
      });
      continue;
    }
    if (local.payloadHash !== expected.sha256) {
      gaps.push({
        weekOpenUtc: expected.weekOpenUtc,
        reason: "hash-mismatch",
        expected,
        local,
      });
    }
  }

  return gaps;
}

export function summarizeCanonShardInventory(localRecords: CanonShardRecord[]) {
  const weeks = Array.from(new Set(localRecords.map((record) => record.weekOpenUtc))).sort();
  return {
    weeks,
    count: weeks.length,
    latestWeekOpenUtc: weeks.at(-1) ?? null,
  };
}
