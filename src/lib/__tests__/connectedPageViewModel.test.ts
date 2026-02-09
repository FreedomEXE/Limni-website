import { describe, expect, test } from "vitest";
import {
  buildConnectedDrawerKpiRows,
  buildConnectedDrawerPlannedPairs,
  resolveConnectedSelectedWeek,
  resolveConnectedTradeModeLabel,
} from "@/lib/accounts/connectedPageViewModel";

describe("connected page view model", () => {
  test("resolves selected week with all/valid/fallback behavior", () => {
    const options = ["2026-02-09", "2026-02-16"] as const;
    expect(
      resolveConnectedSelectedWeek({
        weekParamValue: "all",
        weekOptionsWithUpcoming: [...options],
        currentWeekOpenUtc: "2026-02-09",
      }),
    ).toBe("all");
    expect(
      resolveConnectedSelectedWeek({
        weekParamValue: "2026-02-16",
        weekOptionsWithUpcoming: [...options],
        currentWeekOpenUtc: "2026-02-09",
      }),
    ).toBe("2026-02-16");
    expect(
      resolveConnectedSelectedWeek({
        weekParamValue: "2026-03-01",
        weekOptionsWithUpcoming: [...options],
        currentWeekOpenUtc: "2026-02-09",
      }),
    ).toBe("2026-02-09");
  });

  test("resolves trade mode label", () => {
    expect(resolveConnectedTradeModeLabel({ trade_mode: "manual" })).toBe("MANUAL");
    expect(resolveConnectedTradeModeLabel(null)).toBe("AUTO");
  });

  test("maps planned pairs into drawer rows", () => {
    const rows = buildConnectedDrawerPlannedPairs([
      {
        symbol: "EURUSD",
        assetClass: "fx",
        net: 1,
        legs: [{ model: "sentiment", direction: "LONG" }],
      },
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.symbol).toBe("EURUSD");
    expect(rows[0]?.legsCount).toBe(1);
  });

  test("builds KPI rows for connected account drawer", () => {
    const rows = buildConnectedDrawerKpiRows(
      {
        weekOpenUtc: "2026-02-09",
        equity: 100,
        balance: 99,
        weeklyPnlPct: 1,
        basketPnlPct: -0.5,
        currency: "USD",
        lockedProfitPct: null,
        openPositions: 2,
        tradesThisWeek: 10,
        leverage: 10,
        margin: 25,
        freeMargin: 75,
        riskUsedPct: 2.5,
      },
      "USD",
    );
    expect(rows.some((r) => r.label === "Equity")).toBe(true);
    expect(rows.some((r) => r.label === "Risk Used")).toBe(true);
  });
});
