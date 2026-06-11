/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: resolveDisplayValue.ts
 *
 * Description:
 * Resolve return display values from the canonical/execution matrix and the
 * selected view mode.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import type { ViewMode } from "@/lib/viewMode/viewModeTypes";

export type ReturnMatrix = {
  canonical: { rawPct: number } | null;
  execution: { rawPct: number } | null;
  adrPct: number | null;
};

export type RiskMatrix = {
  canonical: {
    maeRawPct: number | null;
    pathDrawdownRawPct: number | null;
  } | null;
  execution: {
    maeRawPct: number | null;
    pathDrawdownRawPct: number | null;
  } | null;
  adrPct: number | null;
};

export function resolveDisplayReturn(
  row: ReturnMatrix,
  viewMode: ViewMode,
): number | null {
  const anchor = viewMode.anchor === "canonical" ? row.canonical : row.execution;
  if (!anchor) return null;
  if (viewMode.normalization === "raw") {
    return anchor.rawPct;
  }
  if (typeof row.adrPct !== "number" || !Number.isFinite(row.adrPct) || row.adrPct <= 0) {
    return null;
  }
  return anchor.rawPct / row.adrPct;
}

export function resolveDisplayDrawdown(
  row: RiskMatrix | null | undefined,
  viewMode: ViewMode,
  field: "mae" | "pathDrawdown",
): number | null {
  if (!row) return null;
  const anchor = viewMode.anchor === "canonical" ? row.canonical : row.execution;
  if (!anchor) return null;
  const rawPct = field === "mae" ? anchor.maeRawPct : anchor.pathDrawdownRawPct;
  if (typeof rawPct !== "number" || !Number.isFinite(rawPct)) return null;
  if (viewMode.normalization === "raw") return rawPct;
  if (typeof row.adrPct !== "number" || !Number.isFinite(row.adrPct) || row.adrPct <= 0) {
    return null;
  }
  return rawPct / row.adrPct;
}
