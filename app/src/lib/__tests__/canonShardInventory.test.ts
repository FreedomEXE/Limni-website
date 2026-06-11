import { describe, expect, test } from "vitest";
import {
  computeCanonShardGaps,
  summarizeCanonShardInventory,
} from "@/lib/canon/canonShardInventory";
import {
  CANON_WEEK_SHARD_SCHEMA_VERSION,
  type CanonShardRecord,
  type CanonVariantInventory,
  type CanonWeekShardEntry,
} from "@/lib/canon/canonShardTypes";

function week(weekOpenUtc: string, sha256: `sha256:${string}`): CanonWeekShardEntry {
  return {
    weekOpenUtc,
    source: "release-canon",
    schemaVersion: CANON_WEEK_SHARD_SCHEMA_VERSION,
    sha256,
    sizeBytes: 100,
    generatedAtUtc: "2026-06-01T00:00:00.000Z",
    rowCounts: {
      rows: 1,
      trades: 1,
      pairs: 1,
    },
  };
}

function inventory(weeks: CanonWeekShardEntry[]): CanonVariantInventory {
  return {
    strategyVariant: "tandem-weekly_hold-none",
    baselineWeeks: weeks,
    deltaWeeks: [],
    aggregate: {
      key: "v2::tandem-weekly_hold-none::aggregate",
      schemaVersion: "canon-aggregate-shard-v1",
      status: "not-materialized",
      sha256: null,
      sizeBytes: 0,
      generatedAtUtc: null,
    },
    latestClosedWeekOpenUtc: weeks.at(-1)?.weekOpenUtc ?? null,
  };
}

function inventoryWithDelta(
  baselineWeeks: CanonWeekShardEntry[],
  deltaWeeks: CanonWeekShardEntry[],
): CanonVariantInventory {
  return {
    ...inventory(baselineWeeks),
    deltaWeeks,
    latestClosedWeekOpenUtc: [...baselineWeeks, ...deltaWeeks].at(-1)?.weekOpenUtc ?? null,
  };
}

function record(overrides: Partial<CanonShardRecord>): CanonShardRecord {
  return {
    key: "v2::tandem-weekly_hold-none::2026-05-17T23:00:00.000Z",
    canonVersion: "v2",
    strategyVariant: "tandem-weekly_hold-none",
    weekOpenUtc: "2026-05-17T23:00:00.000Z",
    source: "release-canon",
    schemaVersion: CANON_WEEK_SHARD_SCHEMA_VERSION,
    payloadHash: "sha256:aaa",
    storedAtUtc: "2026-06-01T00:00:00.000Z",
    shard: {} as CanonShardRecord["shard"],
    ...overrides,
  };
}

describe("canonShardInventory", () => {
  test("computes missing and corrupt shard gaps by week", () => {
    const gaps = computeCanonShardGaps(
      inventory([
        week("2026-05-17T23:00:00.000Z", "sha256:aaa"),
        week("2026-05-24T23:00:00.000Z", "sha256:bbb"),
        week("2026-05-31T23:00:00.000Z", "sha256:ccc"),
      ]),
      [
        record({
          weekOpenUtc: "2026-05-17T23:00:00.000Z",
          payloadHash: "sha256:aaa",
        }),
        record({
          weekOpenUtc: "2026-05-24T23:00:00.000Z",
          payloadHash: "sha256:wrong",
        }),
      ],
    );

    expect(gaps.map((gap) => [gap.weekOpenUtc, gap.reason])).toEqual([
      ["2026-05-24T23:00:00.000Z", "hash-mismatch"],
      ["2026-05-31T23:00:00.000Z", "missing"],
    ]);
  });

  test("fetches only missing closed-week delta shards when release canon is cached", () => {
    const gaps = computeCanonShardGaps(
      inventoryWithDelta(
        [
          week("2026-05-17T23:00:00.000Z", "sha256:aaa"),
          week("2026-05-24T23:00:00.000Z", "sha256:bbb"),
        ],
        [
          {
            ...week("2026-05-31T23:00:00.000Z", "sha256:ccc"),
            source: "closed-week-delta",
          },
        ],
      ),
      [
        record({
          weekOpenUtc: "2026-05-17T23:00:00.000Z",
          payloadHash: "sha256:aaa",
        }),
        record({
          weekOpenUtc: "2026-05-24T23:00:00.000Z",
          payloadHash: "sha256:bbb",
        }),
      ],
    );

    expect(gaps.map((gap) => [gap.weekOpenUtc, gap.reason, gap.expected.source])).toEqual([
      ["2026-05-31T23:00:00.000Z", "missing", "closed-week-delta"],
    ]);
  });

  test("refetches only shards with stale schema contracts", () => {
    const gaps = computeCanonShardGaps(
      inventory([
        week("2026-05-17T23:00:00.000Z", "sha256:aaa"),
        week("2026-05-24T23:00:00.000Z", "sha256:bbb"),
      ]),
      [
        record({
          weekOpenUtc: "2026-05-17T23:00:00.000Z",
          payloadHash: "sha256:aaa",
        }),
        record({
          weekOpenUtc: "2026-05-24T23:00:00.000Z",
          schemaVersion: "canon-week-shard-v0" as typeof CANON_WEEK_SHARD_SCHEMA_VERSION,
          payloadHash: "sha256:bbb",
        }),
      ],
    );

    expect(gaps.map((gap) => [gap.weekOpenUtc, gap.reason])).toEqual([
      ["2026-05-24T23:00:00.000Z", "schema-mismatch"],
    ]);
  });

  test("summarizes local shard inventory", () => {
    expect(summarizeCanonShardInventory([
      record({ weekOpenUtc: "2026-05-24T23:00:00.000Z" }),
      record({ weekOpenUtc: "2026-05-17T23:00:00.000Z" }),
      record({ weekOpenUtc: "2026-05-24T23:00:00.000Z" }),
    ])).toEqual({
      weeks: [
        "2026-05-17T23:00:00.000Z",
        "2026-05-24T23:00:00.000Z",
      ],
      count: 2,
      latestWeekOpenUtc: "2026-05-24T23:00:00.000Z",
    });
  });
});
