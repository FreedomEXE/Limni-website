import { describe, expect, it } from "vitest";
import { computeMaxDrawdownFromPercentReturns } from "@/lib/performance/drawdown";

describe("performance/drawdown", () => {
  it("returns zero for empty input", () => {
    expect(computeMaxDrawdownFromPercentReturns([])).toBe(0);
  });

  it("computes drawdown from compounded equity", () => {
    const result = computeMaxDrawdownFromPercentReturns([10, -5, -10, 8]);
    expect(result).toBeCloseTo(14.5, 6);
  });

  it("caps at 100% when a return wipes equity", () => {
    expect(computeMaxDrawdownFromPercentReturns([15, -120, 20])).toBe(100);
  });

  it("never exceeds 100% for recoverable paths", () => {
    const result = computeMaxDrawdownFromPercentReturns([30, -60, 40, -20]);
    expect(result).toBeGreaterThanOrEqual(0);
    expect(result).toBeLessThanOrEqual(100);
  });
});
