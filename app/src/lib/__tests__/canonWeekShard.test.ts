import { describe, expect, test } from "vitest";
import type { ClosedHistoryRow } from "@/lib/basket/basketSummaryTypes";
import type { CanonArtifact } from "@/lib/canon/canonArtifact";
import {
  buildCanonVariantInventory,
  buildCanonWeekShard,
} from "@/lib/canon/canonWeekShard.server";
import {
  CANON_AGGREGATE_SHARD_SCHEMA_VERSION,
  CANON_WEEK_SHARD_SCHEMA_VERSION,
} from "@/lib/canon/canonShardTypes";
import type { ReleaseManifest } from "@/lib/version/releaseManifest";

const manifest = {
  releaseLine: "v2",
  displayVersion: "v2",
  liveVersion: "v2.0.2",
  semanticVersion: "2.0.2",
  devVersion: "v2.0.3",
  canonVersion: "v2",
  cacheNamespace: "v2.0.2",
  preparedAt: "2026-06-01T00:00:00.000Z",
  releasedAt: null,
  anchorCommit: "v2",
  previousVersion: {
    liveVersion: "v2.0.1",
  },
  components: {
    engineVersion: "strategy-artifact-v28",
    anchorVersion: "execution_monday_utc_v1",
    canonicalAnchorVersion: "canonical_weekly_v2",
    tradeLedgerVersion: "trade-identity-v2-direction-key",
    preloadCacheVersion: "global-preload-test",
    canonicalDerivationVersion: "v2_intraday_weekly",
    executionDerivationVersion: "v1_execution_monday_utc",
  },
  canon: {
    artifactStatus: "valid",
    validForEngineVersion: "strategy-artifact-v28",
    requiresEngineVersion: "strategy-artifact-v28",
    generatedAt: "2026-05-30T00:00:00.000Z",
    sourceLedgerRowCount: 2,
    sourceHash: "sha256:source",
    variants: [],
  },
  changes: ["test"],
} as ReleaseManifest;

function row(overrides: Partial<ClosedHistoryRow>): ClosedHistoryRow {
  return {
    rowKind: "trade",
    origin: "backtest",
    strategyFamily: "weekly_hold",
    strategyVariant: "tandem-weekly_hold-none",
    symbol: "AUDCAD",
    assetClass: "fx",
    weekOpenUtc: "2026-05-24T23:00:00.000Z",
    sourceModel: "tandem",
    tier: null,
    direction: "LONG",
    fillSeq: null,
    parentNaturalRef: null,
    canonicalTradeId: "canonical-1",
    executionTradeId: "execution-1",
    entryUtc: null,
    exitUtc: null,
    entryPrice: null,
    exitPrice: null,
    returnMatrix: {
      canonical: { rawPct: 1 },
      execution: { rawPct: 1.2 },
      adrPct: 0.8,
    },
    exitReason: null,
    capActiveFillsAtEntry: null,
    capThresholdAtEntry: null,
    capViolated: false,
    warnings: [],
    ...overrides,
  };
}

function artifact(rows: ClosedHistoryRow[]): CanonArtifact {
  return {
    metadata: {
      releaseLine: "v2",
      appVersion: "v2.0.2",
      semanticVersion: "2.0.2",
      canonVersion: "v2",
      preparedAt: "2026-06-01T00:00:00.000Z",
      releasedAt: null,
      canonGeneratedAt: "2026-05-30T00:00:00.000Z",
      strategyVariant: "tandem-weekly_hold-none",
      sourceLedgerRowCount: rows.length,
      sourceHash: "sha256:test-source",
    },
    bundle: {
      rows,
      strategyVariant: "tandem-weekly_hold-none",
      scope: ["fx"],
      generatedAt: "2026-05-30T00:00:00.000Z",
    },
  };
}

describe("canon week shard helpers", () => {
  test("builds deterministic one-week shards from release canon rows", () => {
    const rows = [
      row({ symbol: "EURUSD", canonicalTradeId: "canonical-2", executionTradeId: "execution-2" }),
      row({ symbol: "AUDCAD", canonicalTradeId: "canonical-1", executionTradeId: "execution-1" }),
      row({
        symbol: "GBPUSD",
        weekOpenUtc: "2026-05-17T23:00:00.000Z",
        canonicalTradeId: "canonical-old",
        executionTradeId: "execution-old",
      }),
    ];
    const first = buildCanonWeekShard({
      manifest,
      artifact: artifact(rows),
      strategyVariant: "tandem-weekly_hold-none",
      weekOpenUtc: "2026-05-24T23:00:00.000Z",
    });
    const second = buildCanonWeekShard({
      manifest,
      artifact: artifact([...rows].reverse()),
      strategyVariant: "tandem-weekly_hold-none",
      weekOpenUtc: "2026-05-24T23:00:00.000Z",
    });
    const withoutMilliseconds = buildCanonWeekShard({
      manifest,
      artifact: artifact(rows),
      strategyVariant: "tandem-weekly_hold-none",
      weekOpenUtc: "2026-05-24T23:00:00Z",
    });

    expect(first.metadata.schemaVersion).toBe(CANON_WEEK_SHARD_SCHEMA_VERSION);
    expect(withoutMilliseconds.metadata.weekOpenUtc).toBe("2026-05-24T23:00:00.000Z");
    expect(first.metadata.weekCloseUtc).toBe("2026-05-31T23:00:00.000Z");
    expect(first.metadata.payloadHash).toBe(second.metadata.payloadHash);
    expect(first.metadata.payloadHash).toBe(withoutMilliseconds.metadata.payloadHash);
    expect(first.payload.closedHistoryRows.map((item) => item.symbol)).toEqual(["AUDCAD", "EURUSD"]);
    expect(first.metadata.rowCounts).toMatchObject({
      rows: 2,
      trades: 2,
      pairs: 2,
      weekResults: 0,
    });
  });

  test("builds variant inventory with reserved aggregate slot", () => {
    const sourceArtifact = artifact([
      row({ weekOpenUtc: "2026-05-17T23:00:00.000Z" }),
      row({ weekOpenUtc: "2026-05-24T23:00:00.000Z" }),
    ]);
    const variantInventory = buildCanonVariantInventory({
      manifest,
      artifact: sourceArtifact,
      strategyVariant: "tandem-weekly_hold-none",
    });
    const firstShard = buildCanonWeekShard({
      manifest,
      artifact: sourceArtifact,
      strategyVariant: "tandem-weekly_hold-none",
      weekOpenUtc: "2026-05-17T23:00:00.000Z",
    });

    expect(variantInventory.baselineWeeks.map((week) => week.weekOpenUtc)).toEqual([
      "2026-05-17T23:00:00.000Z",
      "2026-05-24T23:00:00.000Z",
    ]);
    expect(variantInventory.baselineWeeks[0].sha256).toBe(firstShard.metadata.payloadHash);
    expect(variantInventory.deltaWeeks).toEqual([]);
    expect(variantInventory.aggregate).toMatchObject({
      key: "v2::tandem-weekly_hold-none::aggregate",
      schemaVersion: CANON_AGGREGATE_SHARD_SCHEMA_VERSION,
      status: "not-materialized",
    });
    expect(variantInventory.latestClosedWeekOpenUtc).toBe("2026-05-24T23:00:00.000Z");
  });

  test("orders grid shards by grid parent before entry-ordered fills", () => {
    const parentRef = "parent|backtest|adr_grid|tiered_4w-adr_grid-pair_fill_cap|AUDCAD|2026-05-24T23:00:00.000Z|tiered_4w|1|LONG";
    const gridRow = row({
      rowKind: "grid",
      strategyFamily: "adr_grid",
      strategyVariant: "tiered_4w-adr_grid-pair_fill_cap",
      sourceModel: "tiered_4w",
      tier: 1,
      fillSeq: null,
      parentNaturalRef: null,
      canonicalTradeId: "canonical-grid",
      executionTradeId: "execution-grid",
      entryUtc: "2026-05-25T02:00:00.000Z",
    });
    const fill12 = row({
      rowKind: "fill",
      strategyFamily: "adr_grid",
      strategyVariant: "tiered_4w-adr_grid-pair_fill_cap",
      sourceModel: "tiered_4w",
      tier: 1,
      fillSeq: 12,
      parentNaturalRef: parentRef,
      canonicalTradeId: "canonical-12",
      executionTradeId: "execution-12",
      entryUtc: "2026-05-25T14:00:00.000Z",
    });
    const fill6 = row({
      rowKind: "fill",
      strategyFamily: "adr_grid",
      strategyVariant: "tiered_4w-adr_grid-pair_fill_cap",
      sourceModel: "tiered_4w",
      tier: 1,
      fillSeq: 6,
      parentNaturalRef: parentRef,
      canonicalTradeId: "canonical-6",
      executionTradeId: "execution-6",
      entryUtc: "2026-05-25T02:00:00.000Z",
    });
    const fill8 = row({
      rowKind: "fill",
      strategyFamily: "adr_grid",
      strategyVariant: "tiered_4w-adr_grid-pair_fill_cap",
      sourceModel: "tiered_4w",
      tier: 1,
      fillSeq: 8,
      parentNaturalRef: parentRef,
      canonicalTradeId: "canonical-8",
      executionTradeId: "execution-8",
      entryUtc: "2026-05-25T12:00:00.000Z",
    });

    const shard = buildCanonWeekShard({
      manifest,
      artifact: artifact([fill12, gridRow, fill8, fill6]),
      strategyVariant: "tiered_4w-adr_grid-pair_fill_cap",
      weekOpenUtc: "2026-05-24T23:00:00.000Z",
    });

    expect(shard.payload.closedHistoryRows.map((item) => item.rowKind)).toEqual([
      "grid",
      "fill",
      "fill",
      "fill",
    ]);
    expect(shard.payload.closedHistoryRows.map((item) => item.fillSeq)).toEqual([
      null,
      6,
      8,
      12,
    ]);
  });
});
