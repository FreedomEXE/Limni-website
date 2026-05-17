import { afterEach, describe, expect, it, vi } from "vitest";
import {
  singleWeekPathToSimulation,
  singleWeekToSimulation,
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

  it("caps trade-derived asset fallback endpoints at now", () => {
    const now = new Date("2026-05-13T12:00:00.000Z");
    vi.useFakeTimers();
    vi.setSystemTime(now);

    const path: BasketPathResult = {
      weekOpenUtc: currentWeekResult.weekOpenUtc,
      strategyId: "dealer",
      entryStyleId: "weekly_hold",
      resolution: "1h",
      points: [
        {
          tsUtc: currentWeekResult.weekOpenUtc,
          equityPct: 0,
          peakPct: 0,
          drawdownPct: 0,
          activePositions: 1,
        },
        {
          tsUtc: now.toISOString(),
          equityPct: 1.23,
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
