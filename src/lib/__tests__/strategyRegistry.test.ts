import { describe, expect, it } from "vitest";
import { resolveStrategySummarySourcePolicy } from "@/lib/performance/strategyRegistry";

describe("performance/strategyRegistry", () => {
  it("keeps universal_v1 on coverage_auto source policy", () => {
    expect(resolveStrategySummarySourcePolicy("universal_v1")).toBe("coverage_auto");
  });
});
