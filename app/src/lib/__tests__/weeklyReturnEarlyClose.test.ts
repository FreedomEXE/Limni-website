import { describe, expect, test } from "vitest";
import type { CanonicalPriceBar } from "@/lib/canonicalPriceBars";
import { deriveWeeklyReturnFromHourlyBars } from "@/lib/canonicalWeeklyReturns";
import { deriveExecutionWeeklyReturnFromHourlyBars } from "@/lib/executionWeeklyReturns";

function bar(openUtc: string, open: number, close: number): CanonicalPriceBar {
  const closeUtc = new Date(new Date(openUtc).getTime() + 60 * 60 * 1000).toISOString();
  return {
    symbol: "SPXUSD",
    assetClass: "indices",
    timeframe: "1h",
    barOpenUtc: openUtc,
    barCloseUtc: closeUtc,
    openPrice: open,
    highPrice: Math.max(open, close),
    lowPrice: Math.min(open, close),
    closePrice: close,
    sourceProvider: "test",
    qualityStatus: "test",
  };
}

describe("weekly return early close handling", () => {
  test("canonical weekly rows complete at the last bar when the market closes early", () => {
    const result = deriveWeeklyReturnFromHourlyBars({
      symbol: "SPXUSD",
      assetClass: "indices",
      weekOpenUtc: "2026-03-29T23:00:00.000Z",
      bars: [
        bar("2026-03-29T22:00:00.000Z", 100, 101),
        bar("2026-04-03T13:00:00.000Z", 110, 112),
      ],
    });

    expect(result?.complete).toBe(true);
    expect(result?.warnings).toContain("inferred_early_close");
    expect(result?.periodCloseUtc).toBe("2026-04-03T14:00:00.000Z");
    expect(result?.returnPct).toBe(12);
  });

  test("execution weekly rows complete at the last tradable bar when the market closes early", () => {
    const result = deriveExecutionWeeklyReturnFromHourlyBars({
      symbol: "SPXUSD",
      assetClass: "indices",
      weekOpenUtc: "2026-03-29T23:00:00.000Z",
      bars: [
        bar("2026-03-30T00:00:00.000Z", 100, 101),
        bar("2026-04-03T13:00:00.000Z", 105, 108),
      ],
    });

    expect(result?.complete).toBe(true);
    expect(result?.warnings).toContain("inferred_early_close");
    expect(result?.windowCloseUtc).toBe("2026-04-03T14:00:00.000Z");
    expect(result?.returnPct).toBe(8);
  });

  test("missing exact open remains incomplete", () => {
    const result = deriveExecutionWeeklyReturnFromHourlyBars({
      symbol: "SPXUSD",
      assetClass: "indices",
      weekOpenUtc: "2026-03-29T23:00:00.000Z",
      bars: [
        bar("2026-03-30T01:00:00.000Z", 100, 101),
        bar("2026-04-03T13:00:00.000Z", 105, 108),
      ],
    });

    expect(result?.complete).toBe(false);
    expect(result?.warnings).toContain("missing_exact_open_bar");
  });
});
