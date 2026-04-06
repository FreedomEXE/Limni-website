import { describe, expect, it } from "vitest";
import {
  getStrategy,
  resolveStrategyId,
  SELECTOR_FRAG3_STRATEGY_ID,
  SELECTOR_SENTIMENT_OVERRIDE_RESEARCH_ID,
} from "@/lib/performance/strategyConfig";

describe("performance/strategyConfig", () => {
  it("maps the research selector id to the canonical selector", () => {
    expect(resolveStrategyId(SELECTOR_SENTIMENT_OVERRIDE_RESEARCH_ID))
      .toBe(SELECTOR_FRAG3_STRATEGY_ID);

    expect(getStrategy(SELECTOR_SENTIMENT_OVERRIDE_RESEARCH_ID)?.id)
      .toBe(SELECTOR_FRAG3_STRATEGY_ID);
  });

  it("maps removed strategy ids to their replacements", () => {
    expect(resolveStrategyId("agree_2of3")).toBe("agree_3of4");
    expect(resolveStrategyId("agree_2of3_nocomm")).toBe("agree_3of4");
    expect(resolveStrategyId("selector_sentiment_override")).toBe(SELECTOR_FRAG3_STRATEGY_ID);
  });

  it("defaults to selector_frag3 for unknown ids", () => {
    expect(resolveStrategyId("nonexistent")).toBe(SELECTOR_FRAG3_STRATEGY_ID);
    expect(resolveStrategyId(null)).toBe(SELECTOR_FRAG3_STRATEGY_ID);
    expect(resolveStrategyId(undefined)).toBe(SELECTOR_FRAG3_STRATEGY_ID);
  });
});
