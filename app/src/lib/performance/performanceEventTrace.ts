/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: performanceEventTrace.ts
 *
 * Description:
 * Pure helpers for the read-only performance event trace. The script layer
 * owns database reads; these helpers keep request normalization and simple
 * arithmetic testable.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import { DateTime } from "luxon";
import { getCanonicalWeekOpenUtc } from "@/lib/weekAnchor";
import {
  AGREE_3OF4_STRATEGY_ID,
  SELECTOR_STRATEGY_ID,
  TIERED_4W_STRATEGY_ID,
  getEntryStyle,
  getRiskOverlay,
  getStrategy,
  isRiskOverlayValidForEntryStyle,
} from "@/lib/performance/strategyConfig";
import type { WeeklyHoldTrade } from "@/lib/performance/weeklyHoldEngine";

export type TraceSelection = {
  strategyId: string;
  entryStyleId: string;
  riskOverlayId: string;
};

const STRATEGY_ALIASES: Record<string, string> = {
  agreement: AGREE_3OF4_STRATEGY_ID,
  agree: AGREE_3OF4_STRATEGY_ID,
  agree_3of4: AGREE_3OF4_STRATEGY_ID,
  "agree-3of4": AGREE_3OF4_STRATEGY_ID,
  tandem: "tandem",
  tiered: TIERED_4W_STRATEGY_ID,
  tiered_4w: TIERED_4W_STRATEGY_ID,
  selector: SELECTOR_STRATEGY_ID,
  dealer: "dealer",
  commercial: "commercial",
  sentiment: "sentiment",
  strength: "strength",
};

const ENTRY_STYLE_ALIASES: Record<string, string> = {
  weekly: "weekly_hold",
  weekly_hold: "weekly_hold",
  "weekly-hold": "weekly_hold",
  hold: "weekly_hold",
  adr: "adr_grid",
  grid: "adr_grid",
  adr_grid: "adr_grid",
  "adr-grid": "adr_grid",
};

const RISK_OVERLAY_ALIASES: Record<string, string> = {
  none: "none",
  off: "none",
  pair_fill_cap: "pair_fill_cap",
  "pair-fill-cap": "pair_fill_cap",
  fill_cap: "pair_fill_cap",
  exposure_cap: "pair_fill_cap",
};

function normalizeToken(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase().replace(/\s+/g, "_");
}

export function normalizeTraceStrategyId(value: string | null | undefined) {
  const token = normalizeToken(value);
  const alias = STRATEGY_ALIASES[token] ?? token;
  return getStrategy(alias)?.id ?? null;
}

export function normalizeTraceEntryStyleId(value: string | null | undefined) {
  const token = normalizeToken(value);
  const alias = ENTRY_STYLE_ALIASES[token] ?? token;
  return getEntryStyle(alias)?.id ?? null;
}

export function normalizeTraceRiskOverlayId(value: string | null | undefined) {
  const token = normalizeToken(value);
  const alias = RISK_OVERLAY_ALIASES[token] ?? token;
  return getRiskOverlay(alias)?.id ?? null;
}

export function resolveTraceSelection(input: {
  strategy?: string | null;
  entryStyle?: string | null;
  riskOverlay?: string | null;
}): TraceSelection {
  const strategyId = normalizeTraceStrategyId(input.strategy) ?? "tandem";
  const entryStyleId = normalizeTraceEntryStyleId(input.entryStyle) ?? "weekly_hold";
  const requestedOverlay = normalizeTraceRiskOverlayId(input.riskOverlay);
  const defaultOverlayId = entryStyleId === "adr_grid" ? "pair_fill_cap" : "none";
  const overlayId = requestedOverlay ?? defaultOverlayId;
  const overlay = getRiskOverlay(overlayId);

  return {
    strategyId,
    entryStyleId,
    riskOverlayId: isRiskOverlayValidForEntryStyle(overlay, entryStyleId)
      ? overlayId
      : defaultOverlayId,
  };
}

export function resolveTraceWeekOpenUtc(dateInput: string): string {
  const trimmed = dateInput.trim();
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(trimmed);
  const parsed = dateOnly
    ? DateTime.fromISO(`${trimmed}T12:00:00`, { zone: "America/New_York" })
    : DateTime.fromISO(trimmed, { zone: "utc" });

  if (!parsed.isValid) {
    throw new Error(`Invalid trace date: ${dateInput}. Use YYYY-MM-DD or ISO datetime.`);
  }

  return getCanonicalWeekOpenUtc(parsed.toUTC());
}

export function computeDirectionalReturnPct(
  direction: "LONG" | "SHORT",
  assetReturnPct: number,
) {
  return direction === "SHORT" ? -assetReturnPct : assetReturnPct;
}

export function summarizeTraceTrades(trades: WeeklyHoldTrade[]) {
  const rawReturnPct = trades.reduce((sum, trade) => sum + (trade.rawReturnPct ?? trade.returnPct), 0);
  const normalizedReturnPct = trades.reduce(
    (sum, trade) => sum + (trade.normalizedReturnPct ?? trade.returnPct),
    0,
  );
  const displayReturnPct = trades.reduce(
    (sum, trade) => sum + (trade.displayReturnPct ?? trade.returnPct),
    0,
  );

  return {
    count: trades.length,
    rawReturnPct,
    normalizedReturnPct,
    displayReturnPct,
  };
}
