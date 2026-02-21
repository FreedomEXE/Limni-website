import { describe, expect, it } from "vitest";
import {
  PERFORMANCE_MODELS,
  PERFORMANCE_MODEL_LABELS,
  resolvePerformanceSystem,
} from "@/lib/performance/modelConfig";

describe("performance model config", () => {
  it("exports expected model order", () => {
    expect(PERFORMANCE_MODELS).toEqual([
      "antikythera",
      "antikythera_v2",
      "antikythera_v3",
      "blended",
      "dealer",
      "commercial",
      "sentiment",
    ]);
  });

  it("has labels for every model", () => {
    for (const model of PERFORMANCE_MODELS) {
      expect(PERFORMANCE_MODEL_LABELS[model]).toBeTruthy();
    }
  });

  it("resolves supported systems including v3", () => {
    expect(resolvePerformanceSystem("v1")).toBe("v1");
    expect(resolvePerformanceSystem("v2")).toBe("v2");
    expect(resolvePerformanceSystem("v3")).toBe("v3");
    expect(resolvePerformanceSystem("unknown")).toBe("v1");
  });
});
