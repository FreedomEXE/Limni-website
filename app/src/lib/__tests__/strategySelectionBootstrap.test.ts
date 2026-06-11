import { describe, expect, it } from "vitest";
import {
  listStrategyBootstrapSelections,
  listVisibleStrategyBootstrapSelections,
  buildStrategySelectionKey,
  VISIBLE_STRATEGY_IDS,
} from "@/lib/performance/strategySelection";
import {
  STRATEGIES,
  ENTRY_STYLE_FILTERS,
  RISK_OVERLAYS,
  isRiskOverlayValidForEntryStyle,
} from "@/lib/performance/strategyConfig";

describe("performance/strategySelection bootstrap coverage", () => {
  it("covers the full strategy x filter1 x filter2 selection grid", () => {
    const selections = listStrategyBootstrapSelections();
    const expectedSelections = STRATEGIES.flatMap((strategy) =>
      ENTRY_STYLE_FILTERS.flatMap((entryStyle) =>
        RISK_OVERLAYS
          .filter((riskOverlay) => isRiskOverlayValidForEntryStyle(riskOverlay, entryStyle.id))
          .map((riskOverlay) => ({
            strategyId: strategy.id,
            f1: entryStyle.id,
            f2: riskOverlay.id,
          })),
      ),
    );

    expect(selections).toHaveLength(expectedSelections.length);

    const actualKeys = new Set(
      selections.map((selection) => buildStrategySelectionKey(selection)),
    );
    const expectedKeys = new Set(
      expectedSelections.map((selection) => buildStrategySelectionKey(selection)),
    );

    expect(actualKeys).toEqual(expectedKeys);
  });

  it("covers the visible selector grid used for Performance preloading", () => {
    const selections = listVisibleStrategyBootstrapSelections();
    const visibleStrategies = STRATEGIES.filter((strategy) =>
      VISIBLE_STRATEGY_IDS.includes(strategy.id as (typeof VISIBLE_STRATEGY_IDS)[number]),
    );
    const expectedSelections = visibleStrategies.flatMap((strategy) =>
      ENTRY_STYLE_FILTERS.flatMap((entryStyle) =>
        RISK_OVERLAYS
          .filter((riskOverlay) => isRiskOverlayValidForEntryStyle(riskOverlay, entryStyle.id))
          .map((riskOverlay) => ({
            strategyId: strategy.id,
            f1: entryStyle.id,
            f2: riskOverlay.id,
          })),
      ),
    );

    expect(selections).toHaveLength(expectedSelections.length);
    expect(new Set(selections.map((selection) => selection.strategyId))).toEqual(
      new Set(VISIBLE_STRATEGY_IDS),
    );
    expect(
      selections.some((selection) => selection.f1 === "weekly_hold" && selection.f2 === "pair_fill_cap"),
    ).toBe(false);
    expect(
      selections.some((selection) => selection.f1 === "adr_grid" && selection.f2 === "pair_fill_cap"),
    ).toBe(true);
    expect(
      selections.some((selection) => selection.f1 === "adr_grid" && selection.f2 === "none"),
    ).toBe(true);
  });
});
