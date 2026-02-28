/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: types.ts
 *
 * Description:
 * Shared UI types and helpers for the MT5 Forex / Katarakti bot dashboard.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import type {
  KataraktiStatusPayload,
  KataraktiTradeRow,
  KataraktiSignalRow,
  KataraktiBiasRow,
  CorrelationMatrixRow,
} from "@/lib/kataraktiDashboard";

/* ── Tab definitions ───────────────────────── */

export type Mt5ForexTabKey = "live" | "trades" | "signals" | "correlation" | "performance";

export type Mt5ForexTabDef = {
  key: Mt5ForexTabKey;
  label: string;
};

export const MT5_FOREX_TAB_DEFS: Mt5ForexTabDef[] = [
  { key: "live", label: "Live State" },
  { key: "trades", label: "Trade History" },
  { key: "signals", label: "Signal Log" },
  { key: "correlation", label: "Correlation" },
  { key: "performance", label: "Performance" },
];

const MT5_FOREX_TAB_KEY_SET = new Set<Mt5ForexTabKey>(
  MT5_FOREX_TAB_DEFS.map((tab) => tab.key),
);

export function isMt5ForexTabKey(
  value: string | null | undefined,
): value is Mt5ForexTabKey {
  return typeof value === "string" && MT5_FOREX_TAB_KEY_SET.has(value as Mt5ForexTabKey);
}

/* ── Lifecycle ─────────────────────────────── */

export type KataraktiLifecycleState =
  | "IDLE"
  | "WEEK_READY"
  | "SCANNING"
  | "POSITION_OPEN"
  | "TRAILING"
  | "ERROR"
  | "KILLED";

export type LifecycleBadgeTone = {
  toneClass: string;
  label: string;
};

export function resolveKataraktiLifecycleTone(
  lifecycle: KataraktiLifecycleState | string | null | undefined,
): LifecycleBadgeTone {
  if (!lifecycle) {
    return {
      label: "IDLE",
      toneClass:
        "border-[var(--panel-border)] bg-[var(--panel)]/70 text-[color:var(--muted)]",
    };
  }

  if (["POSITION_OPEN", "TRAILING"].includes(lifecycle)) {
    return {
      label: lifecycle,
      toneClass: "border-emerald-300/40 bg-emerald-500/10 text-emerald-200",
    };
  }

  if (["SCANNING", "WEEK_READY"].includes(lifecycle)) {
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
    toneClass:
      "border-[var(--panel-border)] bg-[var(--panel)]/70 text-[color:var(--muted)]",
  };
}

/* ── Formatting helpers ────────────────────── */

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

const SHORT_DATE_TIME_FORMATTER = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

export function formatShortDateTime(value: unknown) {
  const iso = toIsoString(value);
  if (!iso) return "—";
  const ts = Date.parse(iso);
  if (!Number.isFinite(ts)) return iso;
  return SHORT_DATE_TIME_FORMATTER.format(new Date(ts));
}

export function formatCompactUsd(value: unknown) {
  const num = toNumber(value);
  if (num === null) return "—";
  if (Math.abs(num) >= 1_000_000) return `$${(num / 1_000_000).toFixed(2)}M`;
  if (Math.abs(num) >= 1_000) return `$${(num / 1_000).toFixed(1)}K`;
  return `$${num.toFixed(2)}`;
}

export function formatPct(value: unknown, digits = 2) {
  const num = toNumber(value);
  if (num === null) return "—";
  return `${num >= 0 ? "+" : ""}${num.toFixed(digits)}%`;
}

export function formatPrice(value: unknown) {
  const num = toNumber(value);
  if (num === null) return "—";
  return num.toLocaleString("en-US", { maximumFractionDigits: 5 });
}

export function directionTone(direction: string | null | undefined) {
  if (direction === "LONG") return "text-emerald-400";
  if (direction === "SHORT") return "text-rose-400";
  return "text-[color:var(--muted)]";
}

export function pnlTone(value: unknown) {
  const num = toNumber(value);
  if (num === null) return "text-[color:var(--muted)]";
  if (num > 0) return "text-emerald-400";
  if (num < 0) return "text-rose-400";
  return "text-[color:var(--muted)]";
}

/* ── Re-exports for tab components ─────────── */

export type Mt5ForexDashboardData = KataraktiStatusPayload;
export type {
  KataraktiTradeRow,
  KataraktiSignalRow,
  KataraktiBiasRow,
  CorrelationMatrixRow,
};
