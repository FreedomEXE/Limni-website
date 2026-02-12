import { describe, expect, test, vi } from "vitest";
import { buildMt5PlannedView } from "@/lib/accounts/mt5Planning";
import { computePlannedLegCounts } from "@/lib/accounts/accountClientViewStats";

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

  test("does not drop non-fx rows when fx-only mode is enabled (EA parity)", async () => {
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
    expect(result.plannedPairs.some((pair) => pair.symbol === "BTCUSD")).toBe(true);
  });

  test("keeps netted symbols and preserves model leg counts", async () => {
    const signals = [
      ...Array.from({ length: 10 }, (_, i) => ({
        symbol: `A${i}`,
        asset_class: "fx" as const,
        model: "antikythera" as const,
        direction: "LONG" as const,
      })),
      ...Array.from({ length: 24 }, (_, i) => ({
        symbol: `B${i}`,
        asset_class: "fx" as const,
        model: "blended" as const,
        direction: "LONG" as const,
      })),
      ...Array.from({ length: 24 }, (_, i) => ({
        symbol: `D${i}`,
        asset_class: "fx" as const,
        model: "dealer" as const,
        direction: "LONG" as const,
      })),
      ...Array.from({ length: 23 }, (_, i) => ({
        symbol: `C${i}`,
        asset_class: "fx" as const,
        model: "commercial" as const,
        direction: "SHORT" as const,
      })),
      ...Array.from({ length: 28 }, (_, i) => ({
        symbol: `S${i}`,
        asset_class: "fx" as const,
        model: "sentiment" as const,
        direction: "LONG" as const,
      })),
      // Net-zero symbol across models must still be counted as legs.
      { symbol: "NET1", asset_class: "fx" as const, model: "blended" as const, direction: "LONG" as const },
      { symbol: "NET1", asset_class: "fx" as const, model: "dealer" as const, direction: "SHORT" as const },
    ];

    const result = await buildMt5PlannedView({
      basketSignals: { pairs: signals },
      selectedWeek: "2026-02-09",
      currentWeekOpenUtc: "2026-02-09",
      nextWeekOpenUtc: "2026-02-16",
      forceFxOnlyPlanned: false,
      lotMapRows: [],
      freeMargin: 100,
      equity: 100,
      currency: "USD",
    });

    const counts = computePlannedLegCounts(result.plannedPairs, false);
    expect(counts.get("antikythera")).toBe(10);
    expect(counts.get("blended")).toBe(25);
    expect(counts.get("dealer")).toBe(25);
    expect(counts.get("commercial")).toBe(23);
    expect(counts.get("sentiment")).toBe(28);
    expect(result.plannedPairs.some((pair) => pair.symbol === "NET1")).toBe(true);
    expect(result.planningDiagnostics.filtersApplied.dropNetted).toBe(false);
  });

  test("filters legs using lot-map symbol resolution (EA parity)", async () => {
    const result = await buildMt5PlannedView({
      basketSignals: {
        pairs: [
          { symbol: "SPXUSD", asset_class: "indices", model: "dealer", direction: "LONG" },
          { symbol: "EURUSD", asset_class: "fx", model: "sentiment", direction: "LONG" },
          { symbol: "BTCUSD", asset_class: "crypto", model: "blended", direction: "LONG" },
        ],
      },
      selectedWeek: "2026-02-09",
      currentWeekOpenUtc: "2026-02-09",
      nextWeekOpenUtc: "2026-02-16",
      forceFxOnlyPlanned: false,
      lotMapRows: [{ symbol: "SPX500", lot: 1.2 }, { symbol: "EURUSD.i", lot: 0.13 }],
      freeMargin: 1000,
      equity: 1000,
      currency: "USD",
    });

    expect(result.planningDiagnostics.eaFilteredLegCount).toBe(2);
    expect(result.plannedPairs.map((pair) => pair.symbol).sort()).toEqual(["EURUSD", "SPXUSD"]);
  });
});
