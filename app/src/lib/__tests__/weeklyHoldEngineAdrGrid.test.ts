import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CanonicalPriceBar } from "@/lib/canonicalPriceBars";
import { computeWeeklyHold } from "@/lib/performance/weeklyHoldEngine";
import type { BiasSourceConfig, EntryStyleConfig, RiskOverlayConfig } from "@/lib/performance/strategyConfig";

let mockBars: CanonicalPriceBar[] = [];
let mockSignals: Array<{
  weekOpenUtc: string;
  model: string;
  symbol: string;
  assetClass: string;
  direction: "LONG" | "SHORT" | "NEUTRAL";
}> = [];
let mockExecutionReturns: Array<{
  symbol: string;
  assetClass: "fx" | "crypto";
  openPrice: number;
  closePrice: number;
  returnPct: number;
}> = [];

vi.mock("@/lib/weekAnchor", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/weekAnchor")>();
  return {
    ...actual,
    getDisplayWeekOpenUtc: () => "2026-01-12T00:00:00.000Z",
  };
});

vi.mock("@/lib/pairReturns", () => ({
  getCanonicalWeeklyPairReturns: vi.fn(async () => [
    {
      symbol: "EURUSD",
      assetClass: "fx",
      openPrice: 100,
      closePrice: 100,
      returnPct: 0,
    },
  ]),
  getExecutionWeeklyPairReturns: vi.fn(async () => mockExecutionReturns),
}));

vi.mock("@/lib/performance/basketSource", () => ({
  getCanonicalBasketWeek: vi.fn(async (weekOpenUtc: string) => ({
    weekOpenUtc,
    signals: mockSignals.length > 0 ? mockSignals : [
      {
        weekOpenUtc,
        model: "dealer",
        symbol: "EURUSD",
        assetClass: "fx",
        direction: "LONG",
      },
    ],
  })),
  filterByModel: (week: { signals: Array<{ model: string }> }, model: string) =>
    week.signals.filter((signal) => signal.model === model),
  nonNeutralSignals: (signals: Array<{ direction: string }>) =>
    signals.filter((signal) => signal.direction !== "NEUTRAL"),
}));

vi.mock("@/lib/performance/adrLookup", () => ({
  loadWeeklyAdrMap: vi.fn(async () => new Map([["EURUSD", 10]])),
  getAdrPct: vi.fn(() => 10),
  getTargetAdrPct: vi.fn(() => 1),
}));

vi.mock("@/lib/performance/pathBarLoader", () => ({
  loadPathBars: vi.fn(async () => new Map([["EURUSD", mockBars]])),
}));

const biasSource: BiasSourceConfig = {
  id: "dealer",
  label: "Dealer",
  type: "single",
  description: "Dealer test",
  cardBreakdown: "asset_class",
};

const adrGridEntry: EntryStyleConfig = {
  id: "adr_grid",
  label: "ADR Grid",
  description: "ADR Grid test",
  hasTradeLog: true,
  plModel: "adr_grid",
  matrixUi: {
    showStatsBar: true,
    showTriggerState: true,
    showIntradayDetail: true,
    currentColumnLabel: "Fills",
    historicalColumnLabel: "Fills",
    detailTitle: "ADR Grid",
  },
};

const pairFillCap: RiskOverlayConfig = {
  id: "pair_fill_cap",
  label: "Pair Fill Cap",
  description: "Max 3 active fills",
  appliesToEntryStyles: ["adr_grid"],
};

function bar(index: number, highPrice: number, lowPrice: number): CanonicalPriceBar {
  const close = `2026-01-05T${String(index + 1).padStart(2, "0")}:00:00.000Z`;
  const open = `2026-01-05T${String(index).padStart(2, "0")}:00:00.000Z`;
  return {
    symbol: "EURUSD",
    assetClass: "fx",
    timeframe: "1h",
    barOpenUtc: open,
    barCloseUtc: close,
    openPrice: 100,
    highPrice,
    lowPrice,
    closePrice: 100,
    sourceProvider: "test",
    qualityStatus: "complete",
  };
}

describe("weeklyHoldEngine ADR Grid reset semantics", () => {
  beforeEach(() => {
    mockBars = [];
    mockSignals = [];
    mockExecutionReturns = [];
  });

  it("keeps the weekly open untradable and blocks reset-bar entries", async () => {
    mockBars = [
      // This bar reaches the reset target after setting a new cycle low. It also
      // crosses multiple entry levels, but reset-bar entries are conservative omissions.
      bar(1, 103.1, 93.64),
      bar(2, 110, 90),
    ];

    const result = await computeWeeklyHold(biasSource, "2026-01-05T00:00:00.000Z", adrGridEntry);

    expect(result.trades).toHaveLength(0);
    expect(result.plannedTrades).toHaveLength(1);
    expect(result.plannedTrades?.[0]?.openPrice).toBe(100);
  });

  it("closes active fills at reset for sub-TP reset wins", async () => {
    mockBars = [
      // Opens the first continuation level at 102.
      bar(1, 102.1, 100),
      // New cycle low makes reset target 103.004, below the 104.04 TP.
      bar(2, 103.1, 93.64),
    ];

    const result = await computeWeeklyHold(biasSource, "2026-01-05T00:00:00.000Z", adrGridEntry);
    const trade = result.trades[0];

    expect(result.trades).toHaveLength(1);
    expect(trade?.detail?.exitReason).toBe("grid_reset");
    expect(trade?.closePrice).toBeCloseTo(103.004);
    expect(trade?.detail?.tpPrice).toBeCloseTo(104.04);
    expect(trade?.rawReturnPct).toBeGreaterThan(0);
    expect(trade?.rawReturnPct).toBeLessThan(2.0);
  });

  it("caps reset-bar wins at the predetermined TP when TP is before reset", async () => {
    mockBars = [
      // Opens the first continuation level at 102.
      bar(1, 102.1, 100),
      // Reset target is 104.5, beyond the 104.04 TP, so the fill cannot win beyond TP.
      bar(2, 104.6, 95),
    ];

    const result = await computeWeeklyHold(biasSource, "2026-01-05T00:00:00.000Z", adrGridEntry);
    const trade = result.trades[0];

    expect(result.trades).toHaveLength(1);
    expect(trade?.detail?.exitReason).toBe("grid_tp");
    expect(trade?.closePrice).toBeCloseTo(104.04);
    expect(trade?.detail?.tpPrice).toBeCloseTo(104.04);
    expect(trade?.rawReturnPct).toBeCloseTo(2.0);
    expect(trade?.detail?.ambiguityFlags).toContain("reset_bar_tp_precedes_reset");
  });

  it("pair fill cap counts active fills only and frees capacity after TP closes", async () => {
    mockBars = [
      // Opens the first three favorable levels: 102, 104, 106.
      bar(1, 106.1, 100),
      // Closes the 102 fill at TP.
      bar(2, 104.1, 100),
      // With one fill closed, capacity is available for additional entries.
      bar(3, 108.1, 100),
    ];

    const result = await computeWeeklyHold(
      biasSource,
      "2026-01-05T00:00:00.000Z",
      adrGridEntry,
      pairFillCap,
    );

    expect(result.trades.length).toBeGreaterThan(3);
    expect(result.trades.every((trade) => trade.detail?.capViolated === false)).toBe(true);
    expect(result.trades.every((trade) => (trade.detail?.capActiveFillsAtEntry ?? 0) <= 3)).toBe(true);
    expect(result.trades.some((trade) => (trade.detail?.capActiveFillsAtEntry ?? 0) === 3)).toBe(true);
  });

  it("weekly hold uses the unified Friday 11am New York close for crypto", async () => {
    mockSignals = [
      {
        weekOpenUtc: "2026-01-05T00:00:00.000Z",
        model: "dealer",
        symbol: "BTCUSD",
        assetClass: "crypto",
        direction: "LONG",
      },
    ];
    mockExecutionReturns = [
      {
        symbol: "BTCUSD",
        assetClass: "crypto",
        openPrice: 100,
        closePrice: 112,
        returnPct: 12,
      },
    ];

    const result = await computeWeeklyHold(biasSource, "2026-01-05T00:00:00.000Z");

    expect(result.executionWindowOpenUtc).toBe("2026-01-05T01:00:00.000Z");
    expect(result.executionWindowCloseUtc).toBe("2026-01-09T16:00:00.000Z");
    expect(result.trades).toHaveLength(1);
    expect(result.trades[0]?.symbol).toBe("BTCUSD");
    expect(result.trades[0]?.rawReturnPct).toBe(12);
    expect(result.trades[0]?.returnPct).toBeCloseTo(1.2);
  });

  it("does not count flat no-return rows as losses", async () => {
    mockExecutionReturns = [
      {
        symbol: "EURUSD",
        assetClass: "fx",
        openPrice: 100,
        closePrice: 100,
        returnPct: 0,
      },
    ];

    const result = await computeWeeklyHold(biasSource, "2026-01-05T00:00:00.000Z");

    expect(result.trades).toHaveLength(1);
    expect(result.tradeCount).toBe(1);
    expect(result.winCount).toBe(0);
    expect(result.lossCount).toBe(0);
    expect(result.winRate).toBe(0);
  });
});
