import { describe, expect, it } from "vitest";
import { resolveStrategySummarySourcePolicy } from "@/lib/performance/strategyRegistry";

describe("performance/strategyRegistry", () => {
  it("keeps universal_v1 on prefer_db source policy", () => {
    expect(resolveStrategySummarySourcePolicy("universal_v1")).toBe("prefer_db");
  });
});
