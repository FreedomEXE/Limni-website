import { describe, expect, it } from "vitest";
import {
  buildWeekOptionsFromCurve,
  computeMaxDrawdown,
  pickParam,
  pickParams,
} from "@/lib/research/common";

describe("research/common", () => {
  it("normalizes single and multi query params", () => {
    expect(pickParam("x")).toBe("x");
    expect(pickParam(["x", "y"])).toBe("x");
    expect(pickParam(undefined)).toBeUndefined();

    expect(pickParams("A,B , C")).toEqual(["A", "B", "C"]);
    expect(pickParams(["A", "B"])).toEqual(["A", "B"]);
    expect(pickParams(undefined)).toEqual([]);
  });

  it("computes max drawdown from equity points", () => {
    const points = [
      { equity_pct: 0 },
      { equity_pct: 3 },
      { equity_pct: 1.5 },
      { equity_pct: 4 },
      { equity_pct: -2 },
      { equity_pct: 1 },
    ];
    expect(computeMaxDrawdown(points)).toBe(6);
    expect(computeMaxDrawdown([])).toBe(0);
  });

  it("handles edge cases in drawdown computation", () => {
    // Single point
    expect(computeMaxDrawdown([{ equity_pct: 0 }])).toBe(0);
    expect(computeMaxDrawdown([{ equity_pct: 10 }])).toBe(0);

    // Only increasing (no drawdown)
    expect(
      computeMaxDrawdown([{ equity_pct: 0 }, { equity_pct: 2 }, { equity_pct: 4 }]),
    ).toBe(0);

    // Continuous decline
    expect(
      computeMaxDrawdown([{ equity_pct: 10 }, { equity_pct: 5 }, { equity_pct: 0 }]),
    ).toBe(10);

    // Negative peak
    expect(
      computeMaxDrawdown([{ equity_pct: -5 }, { equity_pct: -10 }, { equity_pct: -3 }]),
    ).toBe(5);
  });

  it("builds week options in reverse chrono order", () => {
    const options = buildWeekOptionsFromCurve([
      { ts_utc: "2026-01-19T05:00:00.000Z" },
      { ts_utc: "2026-01-26T05:00:00.000Z" },
      { ts_utc: "2026-02-02T05:00:00.000Z" },
    ]);
    expect(options.map((o) => o.value)).toEqual([
      "2026-02-02T05:00:00.000Z",
      "2026-01-26T05:00:00.000Z",
      "2026-01-19T05:00:00.000Z",
    ]);
    expect(options[0]?.label).toContain("Week of");
  });
});
