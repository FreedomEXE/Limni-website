/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: matrixStyles.ts
 *
 * Description:
 * Shared visual helpers for flagship matrix boards so CFD and crypto
 * can render consistent chips, row highlights, and percentage text.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

export type MatrixTrendState = "BULLISH" | "BEARISH" | "NEUTRAL";
export type MatrixGateDecision = "PASS" | "SKIP" | "NO_DATA";
export type MatrixContextView = "CONFIRM" | "MIXED" | "CONFLICT" | "N/A";

export function stateClass(state: MatrixTrendState) {
  if (state === "BULLISH") return "border-emerald-500/35 bg-emerald-500/12 text-emerald-700 dark:text-emerald-300";
  if (state === "BEARISH") return "border-rose-500/35 bg-rose-500/12 text-rose-700 dark:text-rose-300";
  return "border-slate-500/25 bg-slate-500/10 text-slate-600 dark:text-slate-300";
}

export function stateLabel(state: MatrixTrendState) {
  if (state === "BULLISH") return "B";
  if (state === "BEARISH") return "S";
  return "N";
}

export function gateClass(gate: MatrixGateDecision) {
  if (gate === "PASS") return "border-emerald-500/35 bg-emerald-500/12 text-emerald-700 dark:text-emerald-300";
  if (gate === "SKIP") return "border-rose-500/35 bg-rose-500/12 text-rose-700 dark:text-rose-300";
  return "border-slate-500/25 bg-slate-500/10 text-slate-600 dark:text-slate-300";
}

export function biasChipClass(bias: MatrixTrendState) {
  if (bias === "BULLISH") return "border-emerald-500/40 bg-emerald-500/14 text-emerald-700 dark:text-emerald-300";
  if (bias === "BEARISH") return "border-rose-500/40 bg-rose-500/14 text-rose-700 dark:text-rose-300";
  return "border-slate-500/30 bg-slate-500/10 text-slate-700 dark:text-slate-300";
}

export function rowHighlightClass(bias: MatrixTrendState) {
  if (bias === "BULLISH") return "bg-emerald-500/[0.07] hover:bg-emerald-500/[0.13]";
  if (bias === "BEARISH") return "bg-rose-500/[0.07] hover:bg-rose-500/[0.13]";
  return "bg-slate-500/[0.04] hover:bg-slate-500/[0.08]";
}

export function contextClass(view: MatrixContextView) {
  if (view === "CONFIRM") return "border-emerald-500/35 bg-emerald-500/12 text-emerald-700 dark:text-emerald-300";
  if (view === "CONFLICT") return "border-rose-500/35 bg-rose-500/12 text-rose-700 dark:text-rose-300";
  if (view === "MIXED") return "border-amber-500/35 bg-amber-500/12 text-amber-700 dark:text-amber-300";
  return "border-slate-500/25 bg-slate-500/10 text-slate-600 dark:text-slate-300";
}

export function formatPct(value: number | null, digits = 2) {
  if (value === null || !Number.isFinite(value)) return "—";
  return `${value.toFixed(digits)}%`;
}
