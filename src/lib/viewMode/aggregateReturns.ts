/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: aggregateReturns.ts
 *
 * Description:
 * Aggregate helpers for return matrices. Aggregation happens after view-mode
 * resolution so raw and ADR-normalized modes do not share precomputed totals.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import type { ViewMode } from "./viewModeTypes";
import { resolveDisplayReturn, type ReturnMatrix } from "./resolveDisplayValue";

export function resolveReturnSequence(
  rows: ReturnMatrix[],
  viewMode: ViewMode,
): number[] {
  return rows
    .map((row) => resolveDisplayReturn(row, viewMode))
    .filter((value): value is number => value !== null);
}

export function sumResolvedReturns(rows: ReturnMatrix[], viewMode: ViewMode): number {
  return resolveReturnSequence(rows, viewMode).reduce((sum, value) => sum + value, 0);
}

export function averageResolvedReturns(rows: ReturnMatrix[], viewMode: ViewMode): number | null {
  const seq = resolveReturnSequence(rows, viewMode);
  return seq.length === 0 ? null : seq.reduce((sum, value) => sum + value, 0) / seq.length;
}

export function compoundResolvedReturns(rows: ReturnMatrix[], viewMode: ViewMode): number {
  return resolveReturnSequence(rows, viewMode).reduce(
    (acc, value) => acc * (1 + value / 100),
    1,
  ) * 100 - 100;
}
