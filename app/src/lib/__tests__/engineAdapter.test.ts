import { afterEach, describe, expect, it, vi } from "vitest";
import {
  singleWeekPathToSimulation,
  singleWeekToSimulation,
  weeklyHoldToGridProps,
} from "@/lib/performance/engineAdapter";
import type { BiasSourceConfig } from "@/lib/performance/strategyConfig";
import type { BasketPathResult } from "@/lib/performance/basketPathEngine";
import type { WeeklyHoldResult } from "@/lib/performance/weeklyHoldEngine";

const biasSource: BiasSourceConfig = {
  id: "dealer",
  label: "Dealer",
  type: "single",
  description: "Dealer test strategy",
  cardBreakdown: "asset_class",
};

const currentWeekResult: WeeklyHoldResult = {
  weekOpenUtc: "2026-05-11T00:00:00.000Z",
  biasSourceId: "dealer",
  trades: [
    {
      symbol: "EURUSD",
      assetClass: "fx",
      direction: "LONG",
      openPrice: 1.1,
      closePrice: 1.12,
      returnPct: 1.23,
      source: "dealer",
      tier: null,
    },
  ],
  totalReturnPct: 1.23,
  winCount: 1,
  lossCount: 0,
  winRate: 100,
  tradeCount: 1,
  signals: [],
  isRealized: false,
};

describe("performance/engineAdapter simulations", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("caps legacy current-week simulation endpoints at now", () => {
    const now = new Date("2026-05-13T12:00:00.000Z");
    vi.useFakeTimers();
    vi.setSystemTime(now);

    const simulation = singleWeekToSimulation(currentWeekResult, biasSource, "May 11");

    expect(simulation.series.length).toBeGreaterThan(0);
    for (const series of simulation.series) {
      expect(series.points.at(-1)?.ts_utc).toBe(now.toISOString());
    }
  });

  it("uses planned current-week ADR Grid baskets for display counts while keeping fills nested", () => {
    const gridResult: WeeklyHoldResult = {
      ...currentWeekResult,
      trades: [
        {
          symbol: "EURUSD",
          assetClass: "fx",
          direction: "LONG",
          openPrice: 1.09,
          closePrice: 1.1,
          returnPct: 0.4,
          source: "dealer",
          tier: 1,
          detail: {
            tradeNumber: 1,
            entryTimeUtc: "2026-05-11T01:00:00.000Z",
            exitTimeUtc: "2026-05-11T02:00:00.000Z",
            exitReason: "grid_tp",
            anchorPrice: 1.1,
            tpPrice: 1.1,
            adrPct: 2,
            maePct: null,
          },
        },
        {
          symbol: "EURUSD",
          assetClass: "fx",
          direction: "LONG",
          openPrice: 1.08,
          closePrice: 1.09,
          returnPct: 0.35,
          source: "dealer",
          tier: 1,
          detail: {
            tradeNumber: 2,
            entryTimeUtc: "2026-05-11T03:00:00.000Z",
            exitTimeUtc: "2026-05-11T04:00:00.000Z",
            exitReason: "grid_tp",
            anchorPrice: 1.1,
            tpPrice: 1.09,
            adrPct: 2,
            maePct: null,
          },
        },
      ],
      totalReturnPct: 0.75,
      winCount: 2,
      lossCount: 0,
      tradeCount: 2,
      plannedTrades: [
        {
          symbol: "AUDUSD",
          assetClass: "fx",
          direction: "SHORT",
          openPrice: 0.66,
          closePrice: 0.66,
          returnPct: 0,
          source: "dealer",
          tier: 1,
        },
        {
          symbol: "EURUSD",
          assetClass: "fx",
          direction: "LONG",
          openPrice: 1.1,
          closePrice: 1.1,
          returnPct: 0,
          source: "dealer",
          tier: 1,
        },
      ],
      displayUnit: "grids",
      isRealized: false,
    };

    const props = weeklyHoldToGridProps(gridResult, { ...biasSource, cardBreakdown: "tiers" }, "May 11", "ADR Grid");
    const tierOne = props.combined.models.find((model) => model.model === "dealer");

    expect(tierOne?.total).toBe(2);
    expect(tierOne?.pair_details.map((row) => row.pair)).toEqual(["AUDUSD", "EURUSD"]);
    expect(tierOne?.pair_details.find((row) => row.pair === "EURUSD")?.children).toHaveLength(2);
    expect(tierOne?.percent).toBeCloseTo(0.75);
  });

  it("preserves ADR Grid TP metadata for non-TP closes", () => {
    const gridResult: WeeklyHoldResult = {
      ...currentWeekResult,
      trades: [
        {
          symbol: "EURUSD",
          assetClass: "fx",
          direction: "LONG",
          openPrice: 1.02,
          closePrice: 1.03,
          returnPct: 0.1,
          source: "dealer",
          tier: 1,
          detail: {
            tradeNumber: 1,
            entryTimeUtc: "2026-05-11T01:00:00.000Z",
            exitTimeUtc: "2026-05-11T02:00:00.000Z",
            exitReason: "grid_reset",
            anchorPrice: 1,
            tpPrice: 1.04,
            adrPct: 10,
            maePct: null,
          },
        },
      ],
      totalReturnPct: 0.1,
      winCount: 1,
      lossCount: 0,
      tradeCount: 1,
      displayUnit: "grids",
      isRealized: true,
    };

    const props = weeklyHoldToGridProps(gridResult, { ...biasSource, cardBreakdown: "tiers" }, "May 11", "ADR Grid");
    const detail = props.combined.models[0]?.pair_details[0]?.tradeDetail as { tpPrice?: number } | undefined;

    expect(detail?.tpPrice).toBe(1.04);
  });

  it("caps trade-derived asset fallback endpoints at now", () => {
    const now = new Date("2026-05-13T12:00:00.000Z");
    vi.useFakeTimers();
    vi.setSystemTime(now);

    const path: BasketPathResult = {
      weekOpenUtc: currentWeekResult.weekOpenUtc,
      strategyId: "dealer",
      entryStyleId: "weekly_hold",
      returnMode: "normalized",
      resolution: "1h",
      points: [
        {
          tsUtc: currentWeekResult.weekOpenUtc,
          balancePct: 0,
          equityPct: 0,
          adverseEquityPct: 0,
          peakPct: 0,
          drawdownPct: 0,
          activePositions: 1,
        },
        {
          tsUtc: now.toISOString(),
          balancePct: 1.23,
          equityPct: 1.23,
          adverseEquityPct: 1.23,
          peakPct: 1.23,
          drawdownPct: 0,
          activePositions: 1,
        },
      ],
      summary: {
        totalReturnPct: 1.23,
        peakPct: 1.23,
        troughPct: 0,
        maxDrawdownPct: 0,
        peakToCloseGivebackPct: 0,
        troughToCloseRecoveryPct: 1.23,
        maxActivePositions: 1,
      },
    };

    const simulation = singleWeekPathToSimulation(
      path,
      currentWeekResult,
      biasSource,
      "May 11",
      "Weekly Hold",
    );

    const assetSeries = simulation.series.filter((series) => series.id.startsWith("asset:"));
    expect(assetSeries.length).toBeGreaterThan(0);
    for (const series of assetSeries) {
      expect(series.points.at(-1)?.ts_utc).toBe(now.toISOString());
    }
  });
});
