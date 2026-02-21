import type { PerformanceModel } from "@/lib/performanceLab";

export type PerformanceSystem = "v1" | "v2";

export const PERFORMANCE_MODELS: PerformanceModel[] = [
  "antikythera",
  "blended",
  "dealer",
  "commercial",
  "sentiment",
];

export const PERFORMANCE_V1_MODELS: PerformanceModel[] = [
  "antikythera",
  "blended",
  "dealer",
  "commercial",
  "sentiment",
];

export const PERFORMANCE_V2_MODELS: PerformanceModel[] = [
  "dealer",
  "sentiment",
  "antikythera_v2",
];

export const PERFORMANCE_SYSTEM_MODEL_MAP: Record<PerformanceSystem, PerformanceModel[]> = {
  v1: PERFORMANCE_V1_MODELS,
  v2: PERFORMANCE_V2_MODELS,
};

export function resolvePerformanceSystem(value: string | null | undefined): PerformanceSystem {
  return value === "v2" ? "v2" : "v1";
}

export const PERFORMANCE_MODEL_LABELS: Record<PerformanceModel, string> = {
  blended: "Blended",
  dealer: "Dealer",
  commercial: "Commercial",
  sentiment: "Sentiment",
  antikythera: "Antikythera",
  antikythera_v2: "Antikythera",
};
