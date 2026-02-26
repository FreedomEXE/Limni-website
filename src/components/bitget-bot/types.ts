/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: types.ts
 *
 * Description:
 * Shared UI types and helpers for the Bitget Bot v2 dashboard tabs.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import type {
  BitgetBotStatusPayload,
  BitgetRangeRow,
  BitgetSignalRow,
  BitgetTradeRow,
  FundingSnapshotRow,
  LiquidationSnapshotRow,
  OiSnapshotRow,
} from "@/lib/bitgetBotDashboard";

export type BitgetTabKey = "live" | "trades" | "signals" | "market" | "alts";

export type BitgetTabDef = {
  key: BitgetTabKey;
  label: string;
};

export const BITGET_TAB_DEFS: BitgetTabDef[] = [
  { key: "live", label: "Live State" },
  { key: "trades", label: "Trade History" },
  { key: "signals", label: "Signal Log" },
  { key: "market", label: "Market Data" },
  { key: "alts", label: "Alt Screener" },
];

export type BitgetLifecycleState =
  | "IDLE"
  | "WEEK_READY"
  | "WATCHING_RANGE"
  | "WATCHING_SWEEP"
  | "AWAITING_HANDSHAKE"
  | "POSITION_OPEN"
  | "SCALING"
  | "TRAILING"
  | "EXITING"
  | "ERROR"
  | "KILLED";

export type LifecycleBadgeTone = {
  toneClass: string;
  label: string;
};

export function resolveLifecycleTone(
  lifecycle: BitgetLifecycleState | null | undefined,
): LifecycleBadgeTone {
  if (!lifecycle) {
    return {
      label: "IDLE",
      toneClass: "border-[var(--panel-border)] bg-[var(--panel)]/70 text-[color:var(--muted)]",
    };
  }

  if (["POSITION_OPEN", "SCALING", "TRAILING"].includes(lifecycle)) {
    return {
      label: lifecycle,
      toneClass: "border-emerald-300/40 bg-emerald-500/10 text-emerald-200",
    };
  }

  if (["WATCHING_SWEEP", "WATCHING_RANGE", "AWAITING_HANDSHAKE", "WEEK_READY"].includes(lifecycle)) {
    return {
      label: lifecycle,
      toneClass: "border-amber-300/40 bg-amber-500/10 text-amber-200",
    };
  }

  if (["ERROR", "KILLED"].includes(lifecycle)) {
    return {
      label: lifecycle,
      toneClass: "border-rose-300/40 bg-rose-500/10 text-rose-200",
    };
  }

  return {
    label: lifecycle,
    toneClass: "border-[var(--panel-border)] bg-[var(--panel)]/70 text-[color:var(--muted)]",
  };
}

export function isBitgetTabKey(value: string | null | undefined): value is BitgetTabKey {
  return BITGET_TAB_DEFS.some((tab) => tab.key === value);
}

export function toNumber(value: unknown) {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export function toIsoString(value: unknown) {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string") return value;
  return null;
}

export function formatCompactUsd(value: unknown) {
  const num = toNumber(value);
  if (num === null) return "—";
  if (Math.abs(num) >= 1_000_000) return `$${(num / 1_000_000).toFixed(2)}M`;
  if (Math.abs(num) >= 1_000) return `$${(num / 1_000).toFixed(1)}K`;
  return `$${num.toFixed(2)}`;
}

export type BitgetDashboardViewData = BitgetBotStatusPayload;
export type { BitgetTradeRow, BitgetSignalRow, BitgetRangeRow, OiSnapshotRow, FundingSnapshotRow, LiquidationSnapshotRow };
