import { describe, expect, it } from "vitest";
import type { CanonicalPriceBar } from "@/lib/canonicalPriceBars";
import type { PositionLeg, WeekPositionLedger } from "@/lib/performance/positionLedger";
import { computeBasketPath } from "@/lib/performance/basketPathEngine";

function bar(symbol: string, closeUtc: string, prices: {
  open?: number;
  high: number;
  low: number;
  close: number;
}): CanonicalPriceBar {
  const closeMs = Date.parse(closeUtc);
  return {
    symbol,
    assetClass: "fx",
    timeframe: "1h",
    barOpenUtc: new Date(closeMs - 60 * 60 * 1000).toISOString(),
    barCloseUtc: closeUtc,
    openPrice: prices.open ?? prices.close,
    highPrice: prices.high,
    lowPrice: prices.low,
    closePrice: prices.close,
    sourceProvider: "test",
    qualityStatus: "complete",
  };
}

function leg(overrides: Partial<PositionLeg> = {}): PositionLeg {
  return {
    symbol: "EURUSD",
    assetClass: "fx",
    direction: "LONG",
    entryTimeUtc: "2026-01-05T00:00:00.000Z",
    exitTimeUtc: "2026-01-05T03:00:00.000Z",
    weight: 1,
    adrPct: 1,
    adrMultiplier: 1,
    rawReturnPct: 10,
    normalizedReturnPct: 10,
    displayReturnPct: 10,
    returnPct: 10,
    entryPrice: 100,
    exitPrice: 110,
    strategyId: "test",
    entryStyleId: "adr_grid",
    source: "test",
    tier: null,
    ...overrides,
  };
}

function ledger(legs: PositionLeg[], overrides: Partial<WeekPositionLedger> = {}): WeekPositionLedger {
  return {
    logicalWeekOpenUtc: "2026-01-05T00:00:00.000Z",
    weekOpenUtc: "2026-01-05T00:00:00.000Z",
    weekCloseUtc: "2026-01-05T03:00:00.000Z",
    strategyId: "test",
    entryStyleId: "adr_grid",
    legs,
    ...overrides,
  };
}

describe("basketPathEngine", () => {
  it("stacks 36 concurrent weekly-hold legs into one synchronized adverse basket drawdown", () => {
    const legs = Array.from({ length: 36 }, () => leg({
      entryTimeUtc: "2026-01-05T00:00:00.000Z",
      exitTimeUtc: "2026-01-05T02:00:00.000Z",
      rawReturnPct: 1,
      normalizedReturnPct: 1,
      displayReturnPct: 1,
      returnPct: 1,
      entryPrice: 100,
      exitPrice: 101,
      entryStyleId: "weekly_hold",
    }));

    const result = computeBasketPath(
      ledger(legs, { entryStyleId: "weekly_hold", weekCloseUtc: "2026-01-05T02:00:00.000Z" }),
      new Map([
        ["EURUSD", [
          bar("EURUSD", "2026-01-05T00:00:00.000Z", { high: 100, low: 100, close: 100 }),
          bar("EURUSD", "2026-01-05T01:00:00.000Z", { high: 100, low: 99, close: 100 }),
          bar("EURUSD", "2026-01-05T02:00:00.000Z", { high: 101, low: 101, close: 101 }),
        ]],
      ]),
      { returnMode: "raw" },
    );

    const adversePoint = result.points.find((point) => point.tsUtc === "2026-01-05T01:00:00.000Z");
    expect(adversePoint?.activePositions).toBe(36);
    expect(adversePoint?.equityPct).toBeCloseTo(0, 6);
    expect(adversePoint?.adverseEquityPct).toBeCloseTo(-36, 6);
    expect(result.summary.maxDrawdownPct).toBeCloseTo(36, 6);
    expect(result.summary.totalReturnPct).toBeCloseTo(36, 6);
  });

  it("stacks concurrent open-position adverse drawdown instead of taking one fill's DD", () => {
    const result = computeBasketPath(
      ledger([leg(), leg()]),
      new Map([
        ["EURUSD", [
          bar("EURUSD", "2026-01-05T00:00:00.000Z", { high: 100, low: 100, close: 100 }),
          bar("EURUSD", "2026-01-05T01:00:00.000Z", { high: 101, low: 90, close: 98 }),
          bar("EURUSD", "2026-01-05T02:00:00.000Z", { high: 105, low: 95, close: 104 }),
          bar("EURUSD", "2026-01-05T03:00:00.000Z", { high: 110, low: 110, close: 110 }),
        ]],
      ]),
      { returnMode: "raw" },
    );

    const adversePoint = result.points.find((point) => point.tsUtc === "2026-01-05T01:00:00.000Z");
    expect(adversePoint?.activePositions).toBe(2);
    expect(adversePoint?.equityPct).toBeCloseTo(-4, 6);
    expect(adversePoint?.adverseEquityPct).toBeCloseTo(-20, 6);
    expect(result.summary.maxDrawdownPct).toBeCloseTo(20, 6);
    expect(result.summary.totalReturnPct).toBeCloseTo(20, 6);
  });

  it("keeps overlapping ADR Grid fills active only inside their own entry/exit windows", () => {
    const result = computeBasketPath(
      ledger([
        leg({
          entryTimeUtc: "2026-01-05T00:00:00.000Z",
          exitTimeUtc: "2026-01-05T03:00:00.000Z",
          rawReturnPct: 3,
          normalizedReturnPct: 3,
          displayReturnPct: 3,
          returnPct: 3,
          exitPrice: 103,
        }),
        leg({
          entryTimeUtc: "2026-01-05T01:00:00.000Z",
          exitTimeUtc: "2026-01-05T02:00:00.000Z",
          rawReturnPct: 2,
          normalizedReturnPct: 2,
          displayReturnPct: 2,
          returnPct: 2,
          exitPrice: 102,
        }),
      ]),
      new Map([
        ["EURUSD", [
          bar("EURUSD", "2026-01-05T00:00:00.000Z", { high: 100, low: 100, close: 100 }),
          bar("EURUSD", "2026-01-05T01:00:00.000Z", { high: 100, low: 95, close: 100 }),
          bar("EURUSD", "2026-01-05T02:00:00.000Z", { high: 102, low: 96, close: 102 }),
          bar("EURUSD", "2026-01-05T03:00:00.000Z", { high: 103, low: 103, close: 103 }),
        ]],
      ]),
      { returnMode: "raw" },
    );

    const firstOverlap = result.points.find((point) => point.tsUtc === "2026-01-05T01:00:00.000Z");
    const secondOverlap = result.points.find((point) => point.tsUtc === "2026-01-05T02:00:00.000Z");
    const afterSecondFillClosed = result.points.find((point) => point.tsUtc === "2026-01-05T03:00:00.000Z");

    expect(firstOverlap?.activePositions).toBe(2);
    expect(firstOverlap?.adverseEquityPct).toBeCloseTo(-10, 6);
    expect(secondOverlap?.activePositions).toBe(2);
    expect(secondOverlap?.balancePct).toBeCloseTo(2, 6);
    expect(afterSecondFillClosed?.activePositions).toBe(1);
    expect(afterSecondFillClosed?.balancePct).toBeCloseTo(5, 6);
    expect(result.summary.totalReturnPct).toBeCloseTo(5, 6);
  });

  it("shows no-cap grid paths carrying more active exposure than pair-capped paths", () => {
    const fillLegs = Array.from({ length: 5 }, (_, index) => leg({
      entryTimeUtc: "2026-01-05T00:00:00.000Z",
      exitTimeUtc: "2026-01-05T03:00:00.000Z",
      rawReturnPct: 1,
      normalizedReturnPct: 1,
      displayReturnPct: 1,
      returnPct: 1,
      entryPrice: 100 + index,
      exitPrice: 101 + index,
    }));
    const bars = new Map([
      ["EURUSD", [
        bar("EURUSD", "2026-01-05T00:00:00.000Z", { high: 104, low: 100, close: 102 }),
        bar("EURUSD", "2026-01-05T01:00:00.000Z", { high: 104, low: 95, close: 100 }),
        bar("EURUSD", "2026-01-05T02:00:00.000Z", { high: 104, low: 97, close: 101 }),
        bar("EURUSD", "2026-01-05T03:00:00.000Z", { high: 105, low: 105, close: 105 }),
      ]],
    ]);

    const noCap = computeBasketPath(ledger(fillLegs), bars, { returnMode: "raw" });
    const pairCap = computeBasketPath(ledger(fillLegs.slice(0, 3)), bars, { returnMode: "raw" });

    const noCapPoint = noCap.points.find((point) => point.tsUtc === "2026-01-05T01:00:00.000Z");
    const pairCapPoint = pairCap.points.find((point) => point.tsUtc === "2026-01-05T01:00:00.000Z");
    expect(noCapPoint?.activePositions).toBe(5);
    expect(pairCapPoint?.activePositions).toBe(3);
    expect(noCap.summary.maxDrawdownPct).toBeGreaterThan(pairCap.summary.maxDrawdownPct);
  });

  it("realizes same-bar grid exits while retaining intrabar adverse equity for drawdown", () => {
    const result = computeBasketPath(
      ledger([
        leg({
          entryTimeUtc: "2026-01-05T01:00:00.000Z",
          exitTimeUtc: "2026-01-05T01:00:00.000Z",
          rawReturnPct: 2,
          normalizedReturnPct: 2,
          displayReturnPct: 2,
          returnPct: 2,
          entryPrice: 100,
          exitPrice: 102,
        }),
      ], { weekCloseUtc: "2026-01-05T02:00:00.000Z" }),
      new Map([
        ["EURUSD", [
          bar("EURUSD", "2026-01-05T00:00:00.000Z", { high: 100, low: 100, close: 100 }),
          bar("EURUSD", "2026-01-05T01:00:00.000Z", { high: 103, low: 95, close: 102 }),
          bar("EURUSD", "2026-01-05T02:00:00.000Z", { high: 102, low: 102, close: 102 }),
        ]],
      ]),
      { returnMode: "raw" },
    );

    const closePoint = result.points.find((point) => point.tsUtc === "2026-01-05T01:00:00.000Z");
    expect(closePoint?.balancePct).toBeCloseTo(2, 6);
    expect(closePoint?.equityPct).toBeCloseTo(2, 6);
    expect(closePoint?.adverseEquityPct).toBeCloseTo(-5, 6);
    expect(closePoint?.drawdownPct).toBeLessThan(-6);
    expect(result.summary.totalReturnPct).toBeCloseTo(2, 6);
    expect(result.summary.maxDrawdownPct).toBeGreaterThan(6);
  });

  it("carries realized P/L forward after a TP closes before the week ends", () => {
    const result = computeBasketPath(
      ledger([
        leg({
          entryTimeUtc: "2026-01-05T00:00:00.000Z",
          exitTimeUtc: "2026-01-05T01:00:00.000Z",
          rawReturnPct: 2,
          normalizedReturnPct: 2,
          displayReturnPct: 2,
          returnPct: 2,
          entryPrice: 100,
          exitPrice: 102,
        }),
      ], { weekCloseUtc: "2026-01-05T03:00:00.000Z" }),
      new Map([
        ["EURUSD", [
          bar("EURUSD", "2026-01-05T00:00:00.000Z", { high: 100, low: 100, close: 100 }),
          bar("EURUSD", "2026-01-05T01:00:00.000Z", { high: 102, low: 101, close: 102 }),
          bar("EURUSD", "2026-01-05T02:00:00.000Z", { high: 99, low: 90, close: 95 }),
          bar("EURUSD", "2026-01-05T03:00:00.000Z", { high: 98, low: 92, close: 96 }),
        ]],
      ]),
      { returnMode: "raw" },
    );

    const postTp = result.points.find((point) => point.tsUtc === "2026-01-05T02:00:00.000Z");
    const weekClose = result.points.find((point) => point.tsUtc === "2026-01-05T03:00:00.000Z");
    expect(postTp?.activePositions).toBe(0);
    expect(postTp?.balancePct).toBeCloseTo(2, 6);
    expect(postTp?.equityPct).toBeCloseTo(2, 6);
    expect(postTp?.adverseEquityPct).toBeCloseTo(2, 6);
    expect(weekClose?.balancePct).toBeCloseTo(2, 6);
    expect(result.summary.totalReturnPct).toBeCloseTo(2, 6);
  });
});
