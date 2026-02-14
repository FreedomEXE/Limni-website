import { describe, expect, test, vi } from "vitest";
import { buildMt5PlannedView } from "@/lib/accounts/mt5Planning";
import { computePlannedLegCounts } from "@/lib/accounts/accountClientViewStats";

vi.mock("@/lib/oandaTrade", () => ({
  fetchOandaPricing: vi.fn().mockResolvedValue([]),
}));

describe("mt5 planning", () => {
  test("uses basket signals as canonical planned source", async () => {
    const result = await buildMt5PlannedView({
      basketSignals: {
        pairs: [
          { symbol: "BTCUSD", asset_class: "crypto", model: "dealer", direction: "SHORT" },
          { symbol: "BTCUSD", asset_class: "crypto", model: "blended", direction: "SHORT" },
          { symbol: "ETHUSD", asset_class: "crypto", model: "dealer", direction: "SHORT" },
          { symbol: "ETHUSD", asset_class: "crypto", model: "blended", direction: "SHORT" },
          { symbol: "EURUSD", asset_class: "fx", model: "sentiment", direction: "LONG" },
        ],
      },
      planningDiagnostics: {
        signals_skipped_count_by_reason: {
          lot_cap: 2,
        },
        capacity_limited: true,
        capacity_limit_reason: "lot_cap",
      },
      selectedWeek: "2026-02-09",
      currentWeekOpenUtc: "2026-02-09",
      nextWeekOpenUtc: "2026-02-16",
      forceFxOnlyPlanned: false,
      lotMapRows: [],
      freeMargin: 100,
      equity: 100,
      currency: "USD",
    });

    expect(result.planningMode).toBe("available");
    expect(result.planningDiagnostics?.modelLegCounts).toMatchObject({
      blended: 2,
      dealer: 2,
      sentiment: 1,
    });
    expect(result.planningDiagnostics?.capacityLimited).toBe(true);
    expect(result.planningDiagnostics?.capacityLimitReason).toBe("lot_cap");
    const counts = computePlannedLegCounts(result.plannedPairs, false);
    expect(counts.get("dealer")).toBe(2);
    expect(result.plannedPairs.find((pair) => pair.symbol === "BTCUSD")?.net).toBe(-2);
  });

  test("marks historical week as legacy when diagnostics are unavailable", async () => {
    const result = await buildMt5PlannedView({
      basketSignals: {
        pairs: [{ symbol: "EURUSD", asset_class: "fx", model: "sentiment", direction: "LONG" }],
      },
      planningDiagnostics: undefined,
      selectedWeek: "2026-02-02",
      currentWeekOpenUtc: "2026-02-09",
      nextWeekOpenUtc: "2026-02-16",
      forceFxOnlyPlanned: false,
      lotMapRows: [],
      freeMargin: 100,
      equity: 100,
      currency: "USD",
    });

    expect(result.planningMode).toBe("legacy");
    expect(result.plannedPairs).toHaveLength(0);
    expect(result.planningDiagnostics?.displayedLegCount).toBe(0);
  });

  test("marks current week as missing when no basket signals are available", async () => {
    const result = await buildMt5PlannedView({
      basketSignals: { pairs: [] },
      planningDiagnostics: undefined,
      selectedWeek: "2026-02-09",
      currentWeekOpenUtc: "2026-02-09",
      nextWeekOpenUtc: "2026-02-16",
      forceFxOnlyPlanned: false,
      lotMapRows: [],
      freeMargin: 100,
      equity: 100,
      currency: "USD",
    });

    expect(result.planningMode).toBe("missing");
    expect(result.plannedPairs).toHaveLength(0);
    expect(result.planningDiagnostics?.rawApiLegCount).toBe(0);
  });

  test("defaults to live lot map when both live and frozen maps exist", async () => {
    const result = await buildMt5PlannedView({
      basketSignals: {
        pairs: [{ symbol: "EURUSD", asset_class: "fx", model: "sentiment", direction: "LONG" }],
      },
      planningDiagnostics: undefined,
      selectedWeek: "2026-02-09",
      currentWeekOpenUtc: "2026-02-09",
      nextWeekOpenUtc: "2026-02-16",
      forceFxOnlyPlanned: false,
      lotMapRows: [{ symbol: "EURUSD", lot: 0.23 }],
      frozenLotMapRows: [{ symbol: "EURUSD", lot: 0.11 }],
      sizingSourcePreference: "auto",
      freeMargin: 100,
      equity: 100,
      currency: "USD",
    });

    expect(result.sizingSource).toBe("live_lot_map");
    expect(result.planningDiagnostics?.sizingSource).toBe("live_lot_map");
    expect(result.planningDiagnostics?.sizingSourceLocked).toBe(false);
  });

  test("supports forcing frozen map for debugging parity checks", async () => {
    const result = await buildMt5PlannedView({
      basketSignals: {
        pairs: [{ symbol: "EURUSD", asset_class: "fx", model: "sentiment", direction: "LONG" }],
      },
      planningDiagnostics: undefined,
      selectedWeek: "2026-02-09",
      currentWeekOpenUtc: "2026-02-09",
      nextWeekOpenUtc: "2026-02-16",
      forceFxOnlyPlanned: false,
      lotMapRows: [{ symbol: "EURUSD", lot: 0.23 }],
      frozenLotMapRows: [{ symbol: "EURUSD", lot: 0.11 }],
      sizingSourcePreference: "frozen",
      freeMargin: 100,
      equity: 100,
      currency: "USD",
    });

    expect(result.sizingSource).toBe("frozen_week_plan");
    expect(result.planningDiagnostics?.sizingSource).toBe("frozen_week_plan");
    expect(result.planningDiagnostics?.sizingSourceLocked).toBe(true);
  });
});
