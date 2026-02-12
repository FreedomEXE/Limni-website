import { describe, expect, test, vi } from "vitest";
import { loadConnectedWeekData, resolveConnectedWeekContext } from "@/lib/accounts/connectedPageData";

vi.mock("@/lib/performanceSnapshots", () => ({
  listWeekOptionsForAccount: vi.fn().mockResolvedValue(["2026-02-09"]),
  getWeekOpenUtc: vi.fn().mockReturnValue("2026-02-09"),
  readPerformanceSnapshotsByWeek: vi.fn().mockResolvedValue([]),
}));

vi.mock("@/lib/accountStats", () => ({
  getAccountStatsForWeek: vi.fn().mockResolvedValue({
    weekOpenUtc: "2026-02-09",
    equity: 100,
    balance: 100,
    weeklyPnlPct: 0,
    basketPnlPct: 0,
    currency: "USD",
    lockedProfitPct: null,
    openPositions: 0,
    tradesThisWeek: 0,
    leverage: null,
    margin: null,
    freeMargin: null,
    riskUsedPct: null,
  }),
}));

vi.mock("@/lib/basketSignals", () => ({
  buildBasketSignals: vi.fn().mockResolvedValue({
    week_open_utc: "2026-02-09",
    pairs: [],
  }),
}));

vi.mock("@/lib/accountEquityCurve", () => ({
  buildAccountEquityCurve: vi.fn().mockResolvedValue([]),
}));

describe("connected page data helpers", () => {
  test("resolves week context using current week fallback", async () => {
    const result = await resolveConnectedWeekContext({
      accountKey: "oanda:abc",
      weekParamValue: null,
    });
    expect(result.currentWeekOpenUtc).toBe("2026-02-09");
    expect(result.selectedWeek).toBe("2026-02-09");
    expect(result.weekOptionsWithUpcoming).toContain("2026-02-09");
  });

  test("loads connected week data bundle", async () => {
    const result = await loadConnectedWeekData({
      accountKey: "oanda:abc",
      selectedWeek: "2026-02-09",
      currentWeekOpenUtc: "2026-02-09",
    });
    expect(result.stats.equity).toBe(100);
    expect(Array.isArray(result.basketSignals.pairs)).toBe(true);
    expect(Array.isArray(result.equityCurve)).toBe(true);
    expect(result.staticDrawdownPct).toBe(0);
    expect(result.trailingDrawdownPct).toBe(0);
  });
});
