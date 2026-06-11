import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import type { Trade } from "@/lib/trades/tradeTypes";

const getTradesForSurface = vi.fn();
const getFillsForParentTrade = vi.fn();

vi.mock("@/lib/trades/tradeReaders", () => ({
  getTradesForSurface,
  getFillsForParentTrade,
}));

const { GET } = await import("@/app/api/trades/drilldown/route");

function trade(overrides: Partial<Trade> = {}): Trade {
  return {
    tradeId: "mock-weekly-hold-execution-parent",
    origin: "backtest",
    strategyFamily: "weekly_hold",
    strategyVariant: "agree_3of4-weekly_hold-none",
    engineVersion: "strategy-artifact-v27",
    anchorType: "execution",
    anchorVersion: "execution_monday_utc_v1",
    symbol: "AUDCAD",
    assetClass: "fx",
    direction: "LONG",
    sourceModel: "agree_3of4",
    tier: null,
    weekOpenUtc: "2026-05-10T23:00:00.000Z",
    entryUtc: "2026-05-11T00:00:00.000Z",
    exitUtc: "2026-05-15T21:00:00.000Z",
    entryPrice: 0.98985,
    exitPrice: 0.98284,
    rawPct: -0.708188,
    adrNormalizedPct: -0.94108,
    adrPct: 0.752527,
    weight: 1,
    exitReason: "week_close",
    parentTradeId: null,
    fillSeq: null,
    activeFillsAtEntry: null,
    capThresholdAtEntry: null,
    capViolated: false,
    liveTradeId: null,
    warnings: [],
    createdAtUtc: "2026-05-28T00:00:00.000Z",
    ...overrides,
  };
}

function request(query: string) {
  return new NextRequest(`http://localhost/api/trades/drilldown?${query}`);
}

describe("trade drilldown route", () => {
  beforeEach(() => {
    getTradesForSurface.mockReset();
    getFillsForParentTrade.mockReset();
  });

  it("normalizes agreement weekly hold requests and returns parent trades", async () => {
    getTradesForSurface.mockResolvedValue([trade()]);

    const response = await GET(request(
      "symbol=AUDCAD&weekOpenUtc=2026-05-10T23%3A00%3A00Z&strategyFamily=weekly_hold&strategyVariant=agreement&anchorType=execution",
    ));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(getTradesForSurface).toHaveBeenCalledWith(expect.objectContaining({
      strategyFamily: "weekly_hold",
      strategyVariant: "agree_3of4-weekly_hold-none",
      anchorType: "execution",
      symbol: "AUDCAD",
      weekOpenUtc: "2026-05-10T23:00:00.000Z",
    }));
    expect(json.trades).toHaveLength(1);
    expect(json.trades[0].tradeId).toBe("mock-weekly-hold-execution-parent");
    expect(json.trades[0].direction).toBe("LONG");
    expect(json.trades[0].rawPct).toBeCloseTo(-0.7082, 4);
    expect(json.trades[0].adrNormalizedPct).toBeCloseTo(-0.9411, 4);
    expect(json.fills).toHaveLength(0);
    expect(json.hasMore).toBe(false);
  });

  it("returns ADR Grid parent rows with sorted fills", async () => {
    const parent = trade({
      tradeId: "mock-adr-grid-execution-parent",
      strategyFamily: "adr_grid",
      strategyVariant: "agree_3of4-adr_grid-pair_fill_cap",
      rawPct: 0.20231,
      adrNormalizedPct: 0.268841,
    });
    getTradesForSurface.mockResolvedValue([parent]);
    getFillsForParentTrade.mockResolvedValue([
      trade({ tradeId: "fill-2", strategyFamily: "adr_grid", parentTradeId: parent.tradeId, fillSeq: 2 }),
      trade({ tradeId: "fill-1", strategyFamily: "adr_grid", parentTradeId: parent.tradeId, fillSeq: 1 }),
    ]);

    const response = await GET(request(
      "symbol=AUDCAD&weekOpenUtc=2026-05-10T23%3A00%3A00Z&strategyFamily=adr_grid&strategyVariant=agreement&anchorType=execution",
    ));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.meta.resolvedStrategyVariant).toBe("agree_3of4-adr_grid-pair_fill_cap");
    expect(json.trades).toHaveLength(1);
    expect(json.fills.map((fill: Trade) => fill.fillSeq)).toEqual([1, 2]);
  });

  it("rejects missing required params", async () => {
    const response = await GET(request("symbol=AUDCAD"));
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toContain("Missing required params");
  });

  it("normalizes tiered shorthand to the current tiered strategy id", async () => {
    getTradesForSurface.mockResolvedValue([]);

    await GET(request(
      "symbol=AUDCAD&weekOpenUtc=2026-05-10T23%3A00%3A00Z&strategyFamily=weekly_hold&strategyVariant=tiered&anchorType=execution",
    ));

    expect(getTradesForSurface).toHaveBeenCalledWith(expect.objectContaining({
      strategyVariant: "tiered_4w-weekly_hold-none",
    }));
  });
});
