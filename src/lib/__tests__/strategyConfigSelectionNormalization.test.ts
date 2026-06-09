import { describe, expect, it } from "vitest";
import {
  normalizeFilterSelection,
  shouldSerializeRiskOverlayParam,
} from "@/lib/performance/strategyConfig";

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

  it("keeps adr grid no-cap as an explicit selectable mode", () => {
    expect(
      normalizeFilterSelection({
        f1: "adr_grid",
        f2: "none",
      }),
    ).toEqual({
      f1: "adr_grid",
      f2: "none",
    });
  });

  it("serializes adr grid none because omitting f2 means the capped grid default", () => {
    expect(shouldSerializeRiskOverlayParam({ f1: "weekly_hold", f2: "none" })).toBe(false);
    expect(shouldSerializeRiskOverlayParam({ f1: "adr_grid", f2: "none" })).toBe(true);
    expect(shouldSerializeRiskOverlayParam({ f1: "adr_grid", f2: "pair_fill_cap" })).toBe(true);
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
