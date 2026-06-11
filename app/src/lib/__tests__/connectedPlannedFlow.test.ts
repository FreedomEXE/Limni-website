import { describe, expect, test, vi } from "vitest";
import { buildConnectedPlannedView } from "@/lib/accounts/connectedPlannedFlow";

vi.mock("@/lib/accounts/connectedPlanning", () => ({
  buildBasePlannedPairs: vi.fn().mockReturnValue({
    plannedPairs: [{ symbol: "EURUSD", assetClass: "fx", net: 1, legs: [] }],
    plannedNote: "Model scope: SENTIMENT",
  }),
  applyBitgetPlannedSizing: vi.fn().mockResolvedValue({
    plannedPairs: [{ symbol: "BTCUSDT", assetClass: "crypto", net: -1, legs: [] }],
  }),
  applyOandaPlannedSizing: vi.fn().mockResolvedValue({
    plannedPairs: [{ symbol: "EURUSD", assetClass: "fx", net: 1, legs: [] }],
    plannedSummary: { marginUsed: 10, scale: 1, currency: "$" },
  }),
}));

vi.mock("@/lib/accounts/bitgetAccount", () => ({
  fetchBitgetUsdtEquity: vi.fn().mockResolvedValue(100),
}));

describe("connected planned flow", () => {
  test("returns empty plan for all-time view", async () => {
    const result = await buildConnectedPlannedView({
      provider: "oanda",
      accountKey: "oanda:1",
      config: null,
      selectedWeek: "all",
      basketPairs: [],
      statsEquity: 100,
    });
    expect(result.plannedPairs).toHaveLength(0);
  });

  test("applies provider-specific sizing for oanda", async () => {
    const result = await buildConnectedPlannedView({
      provider: "oanda",
      accountKey: "oanda:1",
      config: null,
      selectedWeek: "2026-02-09",
      basketPairs: [],
      statsEquity: 100,
    });
    expect(result.plannedPairs.length).toBeGreaterThan(0);
    expect(result.plannedSummary?.marginUsed).toBe(10);
  });
});
