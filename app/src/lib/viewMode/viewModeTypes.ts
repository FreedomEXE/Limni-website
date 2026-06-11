/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: viewModeTypes.ts
 *
 * Description:
 * Shared view-mode types and defaults for return anchor and normalization
 * preferences across Limni UI surfaces.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

export type AnchorValue = "canonical" | "execution";
export type NormalizationValue = "raw" | "adr_normalized";

export type ViewMode = {
  anchor: AnchorValue;
  normalization: NormalizationValue;
};

export type ViewAxis = "anchor" | "normalization";

export type ViewSurface = "performance" | "matrix" | "data" | "research";

export const VIEW_MODE_AXIS_OPTIONS: {
  anchor: { value: AnchorValue; label: string; tooltip: string }[];
  normalization: { value: NormalizationValue; label: string; tooltip: string }[];
} = {
  anchor: [
    { value: "execution", label: "Execution", tooltip: "Returns from Mon 00:00 UTC strategy open" },
    { value: "canonical", label: "Market truth", tooltip: "Returns from true market open per asset class" },
  ],
  normalization: [
    { value: "adr_normalized", label: "ADR-norm", tooltip: "1 ADR move = 1% return (smooths cross-asset volatility)" },
    { value: "raw", label: "Raw %", tooltip: "Raw percentage return, unscaled" },
  ],
};

export const SURFACE_DEFAULTS: Record<ViewSurface, ViewMode> = {
  performance: { anchor: "execution", normalization: "adr_normalized" },
  matrix: { anchor: "execution", normalization: "adr_normalized" },
  data: { anchor: "execution", normalization: "raw" },
  research: { anchor: "execution", normalization: "raw" },
};

export const SURFACE_AVAILABLE_AXES: Record<ViewSurface, ViewAxis[]> = {
  performance: ["normalization"],
  matrix: ["anchor", "normalization"],
  data: ["anchor", "normalization"],
  research: ["anchor", "normalization"],
};
