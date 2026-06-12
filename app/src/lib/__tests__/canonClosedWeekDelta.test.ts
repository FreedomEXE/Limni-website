import { beforeEach, describe, expect, test, vi } from "vitest";
import type { ClosedHistoryRow } from "@/lib/basket/basketSummaryTypes";
import type { ReleaseManifest } from "@/lib/version/releaseManifest";

const mocks = vi.hoisted(() => ({
  buildClosedHistoryBundle: vi.fn(),
  loadStrategyPageData: vi.fn(),
}));

vi.mock("@/lib/basket/basketSummaries", () => ({
  buildClosedHistoryBundle: mocks.buildClosedHistoryBundle,
}));

vi.mock("@/lib/performance/strategyPageData", () => ({
  loadStrategyPageData: mocks.loadStrategyPageData,
}));

import {
  buildClosedWeekDeltaShard,
  buildDeltaWeeksForVariant,
} from "@/lib/canon/canonWeekShard.server";

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

describe("closed-week delta shards", () => {
  beforeEach(() => {
    mocks.buildClosedHistoryBundle.mockReset();
    mocks.loadStrategyPageData.mockReset();
    mocks.buildClosedHistoryBundle.mockResolvedValue({
      rows: [
        row({ weekOpenUtc: "2026-05-24T23:00:00.000Z" }),
        row({
          weekOpenUtc: "2026-05-31T23:00:00.000Z",
          symbol: "EURUSD",
          canonicalTradeId: "canonical-delta",
          executionTradeId: "execution-delta",
        }),
        row({
          weekOpenUtc: "2026-06-07T23:00:00.000Z",
          symbol: "GBPUSD",
          canonicalTradeId: "canonical-current",
          executionTradeId: "execution-current",
        }),
      ],
      strategyVariant: "tandem-weekly_hold-none",
      scope: ["fx"],
      generatedAt: "2026-06-01T12:00:00.000Z",
    });
    mocks.loadStrategyPageData.mockResolvedValue({
      weekResults: {},
    });
  });

  test("lists only post-baseline closed weeks before the current week", async () => {
    const weeks = await buildDeltaWeeksForVariant({
      manifest,
      strategyVariant: "tandem-weekly_hold-none",
      baselineLatestClosedWeekOpenUtc: "2026-05-24T23:00:00.000Z",
      currentWeekOpenUtc: "2026-06-07T23:00:00.000Z",
    });

    expect(weeks.map((week) => week.weekOpenUtc)).toEqual(["2026-05-31T23:00:00.000Z"]);
    expect(weeks[0]).toMatchObject({
      source: "closed-week-delta",
      rowCounts: {
        rows: 1,
        trades: 1,
        pairs: 1,
      },
    });
  });

  test("builds deterministic closed-week delta shards", async () => {
    const first = await buildClosedWeekDeltaShard({
      manifest,
      strategyVariant: "tandem-weekly_hold-none",
      weekOpenUtc: "2026-05-31T23:00:00Z",
      currentWeekOpenUtc: "2026-06-07T23:00:00.000Z",
    });
    const second = await buildClosedWeekDeltaShard({
      manifest,
      strategyVariant: "tandem-weekly_hold-none",
      weekOpenUtc: "2026-05-31T23:00:00.000Z",
      currentWeekOpenUtc: "2026-06-07T23:00:00.000Z",
    });

    expect(first?.metadata.source).toBe("closed-week-delta");
    expect(first?.metadata.weekOpenUtc).toBe("2026-05-31T23:00:00.000Z");
    expect(first?.metadata.payloadHash).toBe(second?.metadata.payloadHash);
    expect(first?.payload.closedHistoryRows.map((item) => item.symbol)).toEqual(["EURUSD"]);
  });

  test("uses strategy artifact rows when DB closed-history has not caught up", async () => {
    mocks.buildClosedHistoryBundle.mockResolvedValue({
      rows: [],
      strategyVariant: "tandem-adr_grid-pair_fill_cap",
      scope: ["fx"],
      generatedAt: "2026-06-01T12:00:00.000Z",
    });
    mocks.loadStrategyPageData.mockResolvedValue({
      weekResults: {
        "2026-05-31T23:00:00.000Z": {
          weekOpenUtc: "2026-05-31T23:00:00.000Z",
          biasSourceId: "tandem",
          trades: [{
            symbol: "EURUSD",
            assetClass: "fx",
            direction: "LONG",
            openPrice: 1.1,
            closePrice: 1.2,
            returnPct: 0.5,
            rawReturnPct: 0.25,
            adrPct: 0.5,
            source: "dealer",
            tier: 1,
            detail: {
              tradeNumber: 1,
              entryTimeUtc: "2026-06-01T00:00:00.000Z",
              exitTimeUtc: "2026-06-05T20:00:00.000Z",
              exitReason: "TP",
              anchorPrice: 1.1,
              tpPrice: 1.2,
              adrPct: 0.5,
              maePct: 0.125,
            },
          }],
          totalReturnPct: 0.5,
          winCount: 1,
          lossCount: 0,
          winRate: 1,
          tradeCount: 1,
          signals: [],
          isRealized: true,
        },
      },
    });

    const weeks = await buildDeltaWeeksForVariant({
      manifest,
      strategyVariant: "tandem-adr_grid-pair_fill_cap",
      baselineLatestClosedWeekOpenUtc: "2026-05-24T23:00:00.000Z",
      currentWeekOpenUtc: "2026-06-07T23:00:00.000Z",
    });
    const shard = await buildClosedWeekDeltaShard({
      manifest,
      strategyVariant: "tandem-adr_grid-pair_fill_cap",
      weekOpenUtc: "2026-05-31T23:00:00.000Z",
      currentWeekOpenUtc: "2026-06-07T23:00:00.000Z",
      baselineLatestClosedWeekOpenUtc: "2026-05-24T23:00:00.000Z",
    });

    expect(weeks).toHaveLength(1);
    expect(weeks[0].rowCounts.rows).toBe(2);
    expect(shard?.metadata.source).toBe("closed-week-delta");
    expect(shard?.payload.closedHistoryRows.map((item) => item.rowKind).sort()).toEqual(["fill", "grid"]);
    const fill = shard?.payload.closedHistoryRows.find((item) => item.rowKind === "fill");
    const grid = shard?.payload.closedHistoryRows.find((item) => item.rowKind === "grid");
    expect(fill?.riskMatrix?.execution?.maeRawPct).toBe(0.125);
    expect(fill?.riskMatrix?.execution?.pathDrawdownRawPct).toBeNull();
    expect(grid?.riskMatrix?.execution?.maeRawPct).toBe(0.125);
    expect(grid?.riskMatrix?.execution?.pathDrawdownRawPct).toBeNull();
  });
});
