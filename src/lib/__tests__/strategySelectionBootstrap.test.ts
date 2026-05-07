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
  STRENGTH_GATES,
} from "@/lib/performance/strategyConfig";

describe("performance/strategySelection bootstrap coverage", () => {
  it("covers the full strategy x filter1 x filter2 selection grid", () => {
    const selections = listStrategyBootstrapSelections();
    const filter2Options = STRENGTH_GATES.length > 0
      ? STRENGTH_GATES
      : [{ id: "none" }];
    const expectedCount =
      STRATEGIES.length * ENTRY_STYLE_FILTERS.length * filter2Options.length;

    expect(selections).toHaveLength(expectedCount);

    const actualKeys = new Set(
      selections.map((selection) => buildStrategySelectionKey(selection)),
    );
    const expectedKeys = new Set(
      STRATEGIES.flatMap((strategy) =>
        ENTRY_STYLE_FILTERS.flatMap((entryStyle) =>
          filter2Options.map((strengthGate) =>
            buildStrategySelectionKey({
              strategyId: strategy.id,
              f1: entryStyle.id,
              f2: strengthGate.id,
            }),
          ),
        ),
      ),
    );

    expect(actualKeys).toEqual(expectedKeys);
  });

  it("covers the visible selector grid used for Performance preloading", () => {
    const selections = listVisibleStrategyBootstrapSelections();
    const filter2Options = STRENGTH_GATES.length > 0
      ? STRENGTH_GATES
      : [{ id: "none" }];
    const expectedCount =
      VISIBLE_STRATEGY_IDS.length * ENTRY_STYLE_FILTERS.length * filter2Options.length;

    expect(selections).toHaveLength(expectedCount);
    expect(new Set(selections.map((selection) => selection.strategyId))).toEqual(
      new Set(VISIBLE_STRATEGY_IDS),
    );
  });
});
