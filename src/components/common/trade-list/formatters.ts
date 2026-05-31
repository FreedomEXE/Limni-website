/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: formatters.ts
 *
 * Description:
 * Shared formatting helpers and local semantic color maps for TradeList.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import type { AssetClass } from "@/lib/cotMarkets";

export const ASSET_CLASS_CHIP: Record<AssetClass, { bg: string; text: string; border: string }> = {
  fx: { bg: "bg-sky-500/15", text: "text-sky-200", border: "border-sky-400/25" },
  crypto: {
    bg: "bg-orange-500/15",
    text: "text-orange-200",
    border: "border-orange-400/25",
  },
  indices: {
    bg: "bg-violet-500/15",
    text: "text-violet-200",
    border: "border-violet-400/25",
  },
  commodities: {
    bg: "bg-amber-500/15",
    text: "text-amber-200",
    border: "border-amber-400/25",
  },
};

export const ASSET_CLASS_LABEL: Record<AssetClass, string> = {
  fx: "FX",
  crypto: "Crypto",
  indices: "Indices",
  commodities: "Commodities",
};

export function formatSignedPercent(value: unknown, digits = 2) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "--";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(digits)}%`;
}

export function getSignedNumberClass(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "text-(--muted)";
  if (Math.abs(value) < 0.005) return "text-(--muted)";
  return value > 0 ? "text-lime-300" : "text-rose-300";
}

export function formatDateLabel(value: unknown) {
  if (typeof value !== "string" || value.length === 0) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

export function formatTimeLabel(value: unknown) {
  if (typeof value !== "string" || value.length === 0) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "UTC",
  }).format(date);
}

export function formatCountSummary(parts: Array<[string, unknown]>) {
  return parts
    .filter(([, value]) => typeof value === "number" && value > 0)
    .map(([label, value]) => `${value}${label}`)
    .join(" · ");
}
