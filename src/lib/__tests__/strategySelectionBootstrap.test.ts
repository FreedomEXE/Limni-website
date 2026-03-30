import { describe, expect, it } from "vitest";
import {
  listStrategyBootstrapSelections,
  buildStrategySelectionKey,
} from "@/lib/performance/strategySelection";
import {
  STRATEGIES,
  ENTRY_STYLE_FILTERS,
  STRENGTH_GATES,
} from "@/lib/performance/strategyConfig";

describe("performance/strategySelection bootstrap coverage", () => {
  it("covers the full strategy x filter1 x filter2 selection grid", () => {
    const selections = listStrategyBootstrapSelections();
    const expectedCount =
      STRATEGIES.length * ENTRY_STYLE_FILTERS.length * STRENGTH_GATES.length;

    expect(selections).toHaveLength(expectedCount);

    const actualKeys = new Set(
      selections.map((selection) => buildStrategySelectionKey(selection)),
    );
    const expectedKeys = new Set(
      STRATEGIES.flatMap((strategy) =>
        ENTRY_STYLE_FILTERS.flatMap((entryStyle) =>
          STRENGTH_GATES.map((strengthGate) =>
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
});
