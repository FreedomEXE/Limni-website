import type { PerformanceModel } from "@/lib/performanceLab";

export type PerformanceSystem = "v1" | "v2" | "v3";

export const PERFORMANCE_MODELS: PerformanceModel[] = [
  "antikythera",
  "antikythera_v2",
  "antikythera_v3",
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

export const PERFORMANCE_V3_MODELS: PerformanceModel[] = [
  "antikythera_v3",
  "dealer",
  "commercial",
  "sentiment",
];

export const PERFORMANCE_SYSTEM_MODEL_MAP: Record<PerformanceSystem, PerformanceModel[]> = {
  v1: PERFORMANCE_V1_MODELS,
  v2: PERFORMANCE_V2_MODELS,
  v3: PERFORMANCE_V3_MODELS,
};

export function resolvePerformanceSystem(value: string | null | undefined): PerformanceSystem {
  return value === "v2" || value === "v3" ? value : "v1";
}

export const PERFORMANCE_MODEL_LABELS: Record<PerformanceModel, string> = {
  blended: "Blended",
  dealer: "Dealer",
  commercial: "Commercial",
  sentiment: "Sentiment",
  antikythera: "Antikythera",
  antikythera_v2: "Antikythera",
  antikythera_v3: "Antikythera",
};
