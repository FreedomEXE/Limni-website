import { describe, expect, it } from "vitest";
import { normalizeFilterSelection } from "@/lib/performance/strategyConfig";

describe("performance/strategyConfig filter normalization", () => {
  it("preserves new-style entry-style and strength-gate params", () => {
    expect(
      normalizeFilterSelection({
        f1: "adr_pullback",
        f2: "strength_gate",
      }),
    ).toEqual({
      f1: "adr_pullback",
      f2: "strength_gate",
    });
  });

  it("maps legacy adr f2 bookmarks into entry style plus no gate", () => {
    expect(
      normalizeFilterSelection({
        f1: "weekly_hold",
        f2: "adr_pullback",
      }),
    ).toEqual({
      f1: "adr_pullback",
      f2: "none",
    });
  });

  it("keeps weekly hold when only the old none filter is present", () => {
    expect(
      normalizeFilterSelection({
        f1: "weekly_hold",
        f2: "none",
      }),
    ).toEqual({
      f1: "weekly_hold",
      f2: "none",
    });
  });
});
