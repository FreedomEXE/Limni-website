import { describe, expect, test, vi } from "vitest";
import { buildMt5PlannedView } from "@/lib/accounts/mt5Planning";
import { computePlannedLegCounts } from "@/lib/accounts/accountClientViewStats";

vi.mock("@/lib/oandaTrade", () => ({
  fetchOandaPricing: vi.fn().mockResolvedValue([]),
}));

describe("mt5 planning", () => {
  test("uses EA planning diagnostics as canonical source", async () => {
    const result = await buildMt5PlannedView({
      basketSignals: { pairs: [] },
      planningDiagnostics: {
        signals_raw_count_by_model: {
          antikythera: 10,
          blended: 24,
          dealer: 24,
          commercial: 23,
          sentiment: 28,
        },
        signals_accepted_count_by_model: {
          antikythera: 10,
          blended: 24,
          dealer: 24,
          commercial: 23,
          sentiment: 28,
        },
        signals_skipped_count_by_reason: {
          lot_cap: 2,
        },
        planned_legs: [
          { symbol: "BTCUSD", model: "dealer", direction: "SHORT", units: 1.91 },
          { symbol: "BTCUSD", model: "blended", direction: "SHORT", units: 1.91 },
          { symbol: "ETHUSD", model: "dealer", direction: "SHORT", units: 64.48 },
          { symbol: "ETHUSD", model: "blended", direction: "SHORT", units: 64.48 },
        ],
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
      antikythera: 10,
      blended: 24,
      dealer: 24,
      commercial: 23,
      sentiment: 28,
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
    expect(result.planningDiagnostics).toBeUndefined();
  });

  test("marks current week as missing when diagnostics have not arrived", async () => {
    const result = await buildMt5PlannedView({
      basketSignals: {
        pairs: [{ symbol: "EURUSD", asset_class: "fx", model: "sentiment", direction: "LONG" }],
      },
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
  });
});
