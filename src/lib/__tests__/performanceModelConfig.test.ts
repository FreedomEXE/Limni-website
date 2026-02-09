import { describe, expect, it } from "vitest";
import {
  PERFORMANCE_MODELS,
  PERFORMANCE_MODEL_LABELS,
} from "@/lib/performance/modelConfig";

describe("performance model config", () => {
  it("exports expected model order", () => {
    expect(PERFORMANCE_MODELS).toEqual([
      "antikythera",
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
});
