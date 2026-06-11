import { describe, expect, it } from "vitest";
import { resolveDashboardBias } from "@/lib/dashboard/dashboardSelection";

describe("dashboard/dashboardSelection", () => {
  it("keeps supported data biases stable", () => {
    expect(resolveDashboardBias("dealer")).toBe("dealer");
    expect(resolveDashboardBias("commercial")).toBe("commercial");
    expect(resolveDashboardBias("sentiment")).toBe("sentiment");
  });

  it("falls back to dealer for unsupported values", () => {
    expect(resolveDashboardBias("unknown")).toBe("dealer");
    expect(resolveDashboardBias(null)).toBe("dealer");
    expect(resolveDashboardBias(undefined)).toBe("dealer");
  });
});
