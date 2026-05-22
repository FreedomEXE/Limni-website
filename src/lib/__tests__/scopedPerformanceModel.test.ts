import { describe, expect, it } from "vitest";
import type { EngineGridProps, EngineSimulationGroup } from "@/lib/performance/engineAdapter";
import {
  deriveScopedSimulationMetrics,
  filterGridPropsByPerformanceScope,
} from "@/lib/performance/scopedPerformanceModel";

function model(overrides: Partial<EngineGridProps["combined"]["models"][number]> = {}) {
  return {
    model: "commercial" as const,
    percent: 0,
    priced: 0,
    total: 0,
    note: "",
    returns: [],
    pair_details: [],
    stats: {
      avg_return: 0,
      median_return: 0,
      win_rate: 0,
      volatility: 0,
      best_pair: null,
      worst_pair: null,
    },
    diagnostics: {
      max_drawdown: null,
      profit_factor: null,
    },
    ...overrides,
  };
}

function fixtureGrid(): EngineGridProps {
  return {
    combined: {
      id: "combined",
      label: "All",
      description: "",
      models: [
        model({
          percent: 4,
          priced: 2,
          total: 2,
          returns: [
            { pair: "Week of 2026-01-19", percent: 3 },
            { pair: "Week of 2026-01-26", percent: 1 },
          ],
          pair_details: [
            { pair: "Week of 2026-01-19", direction: "LONG", reason: [], percent: 3 },
            { pair: "Week of 2026-01-26", direction: "LONG", reason: [], percent: 1 },
          ],
        }),
      ],
    },
    perAsset: [
      {
        id: "commodities",
        label: "Commodities",
        description: "",
        models: [
          model({
            percent: 2,
            priced: 2,
            total: 2,
            returns: [
              { pair: "Week of 2026-01-19", percent: 3 },
              { pair: "Week of 2026-01-26", percent: -1 },
            ],
            pair_details: [
              { pair: "Week of 2026-01-19", direction: "LONG", reason: [], percent: 3 },
              { pair: "Week of 2026-01-26", direction: "SHORT", reason: [], percent: -1 },
            ],
          }),
        ],
      },
    ],
    labels: {
      blended: "Blended",
      dealer: "Dealer",
      commercial: "Commercial",
      sentiment: "Sentiment",
      strength: "Strength",
      antikythera: "Antikythera",
      antikythera_v2: "Antikythera V2",
      antikythera_v3: "Antikythera V3",
    },
    allTime: {
      combined: [
        {
          model: "commercial",
          totalPercent: 4,
          weeks: 2,
          winRate: 100,
          avgWeekly: 2,
        },
      ],
      perAsset: {
        commodities: [
          {
            model: "commercial",
            totalPercent: 2,
            weeks: 2,
            winRate: 50,
            avgWeekly: 1,
          },
        ],
      },
    },
    showAllTime: true,
  };
}

describe("scoped performance model", () => {
  it("uses asset sections directly for scoped all-time rows instead of symbol-filtering week labels", () => {
    const scoped = filterGridPropsByPerformanceScope(fixtureGrid(), ["commodities"], {
      allTimeMode: true,
    });

    expect(scoped?.combined.models[0]?.percent).toBe(2);
    expect(scoped?.combined.models[0]?.total).toBe(2);
    expect(scoped?.combined.models[0]?.pair_details.map((detail) => detail.pair)).toEqual([
      "Week of 2026-01-19",
      "Week of 2026-01-26",
    ]);
    expect(scoped?.allTime.combined[0]?.totalPercent).toBe(2);
  });

  it("still filters single-week symbol rows by asset scope", () => {
    const grid = fixtureGrid();
    grid.combined.models[0] = model({
      percent: 4,
      priced: 2,
      total: 2,
      returns: [
        { pair: "XAUUSD", percent: 3 },
        { pair: "EURUSD", percent: 1 },
      ],
      pair_details: [
        { pair: "XAUUSD", direction: "LONG", reason: [], percent: 3 },
        { pair: "EURUSD", direction: "LONG", reason: [], percent: 1 },
      ],
    });

    const scoped = filterGridPropsByPerformanceScope(grid, ["commodities"], {
      allTimeMode: false,
    });

    expect(scoped?.combined.models[0]?.percent).toBe(3);
    expect(scoped?.combined.models[0]?.pair_details.map((detail) => detail.pair)).toEqual(["XAUUSD"]);
  });

  it("derives custom mixed-scope path metrics from selected asset series", () => {
    const group: EngineSimulationGroup = {
      title: "Agreement",
      description: "",
      metrics: {
        returnPct: 99,
        maxDrawdownPct: 99,
        trades: 99,
      },
      series: [
        {
          id: "total",
          label: "Total",
          trades: 99,
          points: [
            { ts_utc: "2026-01-05T00:00:00.000Z", equity_pct: 0, lock_pct: null, drawdown_pct: 0 },
            { ts_utc: "2026-01-06T00:00:00.000Z", equity_pct: 99, lock_pct: null, drawdown_pct: -99 },
          ],
        },
        {
          id: "asset:fx",
          label: "FX",
          trades: 10,
          points: [
            { ts_utc: "2026-01-05T00:00:00.000Z", equity_pct: 0, lock_pct: null, drawdown_pct: 0 },
            { ts_utc: "2026-01-06T00:00:00.000Z", equity_pct: 10, lock_pct: null, drawdown_pct: 0 },
            { ts_utc: "2026-01-07T00:00:00.000Z", equity_pct: 10, lock_pct: null, drawdown_pct: 0 },
          ],
        },
        {
          id: "asset:indices",
          label: "Indices",
          trades: 2,
          points: [
            { ts_utc: "2026-01-05T00:00:00.000Z", equity_pct: 0, lock_pct: null, drawdown_pct: 0 },
            { ts_utc: "2026-01-06T00:00:00.000Z", equity_pct: 2, lock_pct: null, drawdown_pct: 0 },
            { ts_utc: "2026-01-07T00:00:00.000Z", equity_pct: -2, lock_pct: null, drawdown_pct: -4 },
          ],
        },
        {
          id: "asset:crypto",
          label: "Crypto",
          trades: 5,
          points: [
            { ts_utc: "2026-01-05T00:00:00.000Z", equity_pct: 0, lock_pct: null, drawdown_pct: 0 },
            { ts_utc: "2026-01-06T00:00:00.000Z", equity_pct: 50, lock_pct: null, drawdown_pct: 0 },
          ],
        },
      ],
    };

    const metrics = deriveScopedSimulationMetrics(group, ["fx", "indices"]);

    expect(metrics?.returnPct).toBe(8);
    expect(metrics?.maxDrawdownPct).toBeCloseTo(3.5714, 4);
    expect(metrics?.trades).toBe(12);
  });
});
