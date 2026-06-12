import { describe, expect, test } from "vitest";
import type { ClosedHistoryRow } from "@/lib/basket/basketSummaryTypes";
import type { CanonArtifact } from "@/lib/canon/canonArtifact";
import { composeClosedHistoryBundleFromShards } from "@/lib/canon/canonShardComposition";
import { canonWeekShardKey, type CanonShardRecord, type CanonWeekShard } from "@/lib/canon/canonShardTypes";
import { buildCanonWeekShard } from "@/lib/canon/canonWeekShard.server";
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
    sourceLedgerRowCount: 4,
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
    weekOpenUtc: "2026-05-17T23:00:00.000Z",
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
      scope: ["fx", "indices", "commodities", "crypto"],
      generatedAt: "2026-05-30T00:00:00.000Z",
    },
  };
}

function record(shard: CanonWeekShard): CanonShardRecord {
  return {
    key: canonWeekShardKey(
      shard.metadata.canonVersion,
      shard.metadata.strategyVariant,
      shard.metadata.weekOpenUtc,
    ),
    canonVersion: shard.metadata.canonVersion,
    strategyVariant: shard.metadata.strategyVariant,
    weekOpenUtc: shard.metadata.weekOpenUtc,
    source: shard.metadata.source,
    schemaVersion: shard.metadata.schemaVersion,
    payloadHash: shard.metadata.payloadHash,
    storedAtUtc: "2026-06-01T00:00:00.000Z",
    shard,
  };
}

describe("canon shard composition", () => {
  test("composes verified week shards into a closed-history bundle", () => {
    const rows = [
      row({
        symbol: "XAUUSD",
        assetClass: "commodities",
        canonicalTradeId: "canonical-4",
        executionTradeId: "execution-4",
        weekOpenUtc: "2026-05-24T23:00:00.000Z",
      }),
      row({
        symbol: "EURUSD",
        canonicalTradeId: "canonical-2",
        executionTradeId: "execution-2",
      }),
      row({
        symbol: "AUDCAD",
        canonicalTradeId: "canonical-1",
        executionTradeId: "execution-1",
      }),
      row({
        symbol: "BTCUSD",
        assetClass: "crypto",
        canonicalTradeId: "canonical-3",
        executionTradeId: "execution-3",
        weekOpenUtc: "2026-05-24T23:00:00.000Z",
      }),
    ];
    const source = artifact(rows);
    const shards = [
      buildCanonWeekShard({
        manifest,
        artifact: source,
        strategyVariant: "tandem-weekly_hold-none",
        weekOpenUtc: "2026-05-24T23:00:00.000Z",
      }),
      buildCanonWeekShard({
        manifest,
        artifact: source,
        strategyVariant: "tandem-weekly_hold-none",
        weekOpenUtc: "2026-05-17T23:00:00.000Z",
      }),
    ].map(record);
    const rogueCurrentWeekShard = record(buildCanonWeekShard({
      manifest,
      artifact: artifact([
        row({
          symbol: "USDJPY",
          canonicalTradeId: "canonical-current",
          executionTradeId: "execution-current",
          weekOpenUtc: "2026-05-31T23:00:00.000Z",
        }),
      ]),
      strategyVariant: "tandem-weekly_hold-none",
      weekOpenUtc: "2026-05-31T23:00:00.000Z",
    }));

    const bundle = composeClosedHistoryBundleFromShards({
      records: [...shards, rogueCurrentWeekShard],
      strategyVariant: "tandem-weekly_hold-none",
      weekOpenUtcs: [
        "2026-05-17T23:00:00.000Z",
        "2026-05-24T23:00:00.000Z",
      ],
    });
    const commodities = composeClosedHistoryBundleFromShards({
      records: shards,
      strategyVariant: "tandem-weekly_hold-none",
      scope: ["commodities"],
    });

    expect(bundle.strategyVariant).toBe("tandem-weekly_hold-none");
    expect(bundle.generatedAt).toBe("2026-05-30T00:00:00.000Z");
    expect(bundle.rows.map((item) => item.canonicalTradeId)).toEqual([
      "canonical-1",
      "canonical-2",
      "canonical-3",
      "canonical-4",
    ]);
    expect(commodities.scope).toEqual(["commodities"]);
    expect(commodities.rows.map((item) => item.symbol)).toEqual(["XAUUSD"]);
  });
});
