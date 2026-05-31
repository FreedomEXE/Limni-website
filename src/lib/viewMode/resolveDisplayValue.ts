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
  adrPct: number;
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
  if (!Number.isFinite(row.adrPct) || row.adrPct <= 0) {
    return null;
  }
  return anchor.rawPct / row.adrPct;
}
