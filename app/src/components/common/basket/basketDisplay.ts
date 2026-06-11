/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: basketDisplay.ts
 *
 * Description:
 * Client display helpers for all-time Basket summary rows.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import type { BasketReturnMatrixRow } from "@/lib/basket/basketSummaryTypes";
import { resolveReturnSequence } from "@/lib/viewMode/aggregateReturns";
import type { ReturnMatrix } from "@/lib/viewMode/resolveDisplayValue";
import type { ViewMode } from "@/lib/viewMode/viewModeTypes";

export function formatBasketPct(value: number | null) {
  if (value === null || !Number.isFinite(value)) return null;
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

export function formatBasketDate(weekOpenUtc: string) {
  const parsed = new Date(weekOpenUtc);
  if (Number.isNaN(parsed.getTime())) return weekOpenUtc;
  return parsed.toLocaleDateString("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function resolveBasketRows(rows: BasketReturnMatrixRow[], viewMode: ViewMode) {
  const matrices: ReturnMatrix[] = rows.map((row) => ({
    canonical: row.canonical,
    execution: row.execution,
    adrPct: row.adrPct ?? 0,
  }));
  const sequence = resolveReturnSequence(matrices, viewMode);
  return sequence.length === 0 ? null : sequence.reduce((sum, value) => sum + value, 0);
}

export function pctTone(value: number | null) {
  if (value === null) return "text-(--muted)";
  if (value > 0) return "text-lime-400";
  if (value < 0) return "text-red-400";
  return "text-(--muted)";
}
