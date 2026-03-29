import { describe, expect, it } from "vitest";
import {
  listStrategyBootstrapSelections,
  buildStrategySelectionKey,
} from "@/lib/performance/strategySelection";
import {
  STRATEGIES,
  BASKET_FILTERS,
  INTRADAY_FILTERS,
} from "@/lib/performance/strategyConfig";

describe("performance/strategySelection bootstrap coverage", () => {
  it("covers the full strategy x filter1 x filter2 selection grid", () => {
    const selections = listStrategyBootstrapSelections();
    const expectedCount =
      STRATEGIES.length * BASKET_FILTERS.length * INTRADAY_FILTERS.length;

    expect(selections).toHaveLength(expectedCount);

    const actualKeys = new Set(
      selections.map((selection) => buildStrategySelectionKey(selection)),
    );
    const expectedKeys = new Set(
      STRATEGIES.flatMap((strategy) =>
        BASKET_FILTERS.flatMap((basketFilter) =>
          INTRADAY_FILTERS.map((intradayFilter) =>
            buildStrategySelectionKey({
              strategyId: strategy.id,
              f1: basketFilter.id,
              f2: intradayFilter.id,
            }),
          ),
        ),
      ),
    );

    expect(actualKeys).toEqual(expectedKeys);
  });
});
