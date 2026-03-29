import { describe, expect, it } from "vitest";
import {
  getStrategy,
  resolveStrategyId,
  SELECTOR_SENTIMENT_OVERRIDE_RESEARCH_ID,
  SELECTOR_SENTIMENT_OVERRIDE_STRATEGY_ID,
} from "@/lib/performance/strategyConfig";

describe("performance/strategyConfig", () => {
  it("maps the research selector id to the canonical app id", () => {
    expect(resolveStrategyId(SELECTOR_SENTIMENT_OVERRIDE_RESEARCH_ID))
      .toBe(SELECTOR_SENTIMENT_OVERRIDE_STRATEGY_ID);

    expect(getStrategy(SELECTOR_SENTIMENT_OVERRIDE_RESEARCH_ID)?.id)
      .toBe(SELECTOR_SENTIMENT_OVERRIDE_STRATEGY_ID);
  });
});
