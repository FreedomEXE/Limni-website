import { describe, expect, it } from "vitest";
import { normalizeFilterSelection } from "@/lib/performance/strategyConfig";

describe("performance/strategyConfig filter normalization", () => {
  it("redirects stale adr pullback links into adr grid plus pair fill cap", () => {
    expect(
      normalizeFilterSelection({
        f1: "adr_pullback",
        f2: null,
      }),
    ).toEqual({
      f1: "adr_grid",
      f2: "pair_fill_cap",
    });
  });

  it("absorbs old adr overlay params into the canonical production selection", () => {
    expect(
      normalizeFilterSelection({
        f1: "adr_pullback",
        f2: "adr_normalized",
      }),
    ).toEqual({
      f1: "adr_grid",
      f2: "pair_fill_cap",
    });
  });

  it("maps legacy exposure cap links to pair fill cap for adr grid", () => {
    expect(
      normalizeFilterSelection({
        f1: "adr_grid",
        f2: "exposure_cap",
      }),
    ).toEqual({
      f1: "adr_grid",
      f2: "pair_fill_cap",
    });
  });

  it("keeps weekly hold and none when explicitly selected", () => {
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

  it("forces grid-only overlays off for weekly hold", () => {
    expect(
      normalizeFilterSelection({
        f1: "weekly_hold",
        f2: "pair_fill_cap",
      }),
    ).toEqual({
      f1: "weekly_hold",
      f2: "none",
    });

    expect(
      normalizeFilterSelection({
        f1: "weekly_hold",
        f2: "exposure_cap",
      }),
    ).toEqual({
      f1: "weekly_hold",
      f2: "none",
    });
  });
});
