import { describe, expect, test, vi } from "vitest";
import { buildMt5PlannedView } from "@/lib/accounts/mt5Planning";

vi.mock("@/lib/oandaTrade", () => ({
  fetchOandaPricing: vi.fn().mockResolvedValue([]),
}));

describe("mt5 planning", () => {
  test("drops planned pairs when selected week is outside current/upcoming", async () => {
    const result = await buildMt5PlannedView({
      basketSignals: {
        pairs: [
          { symbol: "EURUSD", asset_class: "fx", model: "sentiment", direction: "LONG" },
        ],
      },
      selectedWeek: "2026-01-01",
      currentWeekOpenUtc: "2026-02-09",
      nextWeekOpenUtc: "2026-02-16",
      forceFxOnlyPlanned: false,
      lotMapRows: [],
      freeMargin: 100,
      equity: 100,
      currency: "USD",
    });

    expect(result.plannedPairs).toHaveLength(0);
  });

  test("keeps only fx rows when fx-only mode is enabled", async () => {
    const result = await buildMt5PlannedView({
      basketSignals: {
        pairs: [
          { symbol: "EURUSD", asset_class: "fx", model: "sentiment", direction: "LONG" },
          { symbol: "BTCUSD", asset_class: "crypto", model: "sentiment", direction: "LONG" },
        ],
      },
      selectedWeek: "2026-02-09",
      currentWeekOpenUtc: "2026-02-09",
      nextWeekOpenUtc: "2026-02-16",
      forceFxOnlyPlanned: true,
      lotMapRows: [],
      freeMargin: 100,
      equity: 100,
      currency: "USD",
    });

    expect(result.showStopLoss1pct).toBe(true);
    expect(result.plannedPairs.every((pair) => pair.assetClass === "fx")).toBe(true);
  });
});
