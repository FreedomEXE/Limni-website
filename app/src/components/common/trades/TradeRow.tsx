/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: TradeRow.tsx
 *
 * Description:
 * Full identity row for one universal ledger trade.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import type { Trade } from "@/lib/trades/tradeTypes";
import TradeIdBadge from "@/components/common/trades/TradeIdBadge";

type TradeRowProps = {
  trade: Trade;
};

function formatDateTime(value: string | null) {
  if (!value) return "--";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toISOString().replace(".000Z", "Z");
}

function formatNumber(value: number | null, decimals = 4, suffix = "") {
  if (value === null || !Number.isFinite(value)) return "--";
  const sign = suffix === "%" && value > 0 ? "+" : "";
  return `${sign}${value.toFixed(decimals)}${suffix}`;
}

function statusClass(trade: Trade) {
  if (trade.capViolated) return "border-rose-500/45 bg-rose-500/10 text-rose-400";
  return "border-emerald-500/35 bg-emerald-500/10 text-emerald-400";
}

function Field({ label, value, testId }: { label: string; value: string | number | null; testId?: string }) {
  return (
    <div className="min-w-0" data-testid={testId}>
      <div className="text-[9px] uppercase tracking-[0.16em] text-(--muted)/70">{label}</div>
      <div className="truncate text-[11px] font-semibold text-(--foreground)">{value ?? "--"}</div>
    </div>
  );
}

export default function TradeRow({ trade }: TradeRowProps) {
  return (
    <div data-testid="trade-row" className="rounded-lg border border-(--panel-border) bg-(--panel)/70 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <TradeIdBadge trade={trade} />
        <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] ${statusClass(trade)}`}>
          {trade.capViolated ? "Cap violation" : "Cap clean"}
        </span>
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="UUID" value={trade.tradeId} />
        <Field label="Anchor" value={`${trade.anchorType} | ${trade.anchorVersion}`} />
        <Field label="Source" value={trade.sourceModel ?? "--"} />
        <Field label="Tier" value={trade.tier ?? "--"} />
        <Field label="Direction" value={trade.direction ?? "--"} testId="trade-direction" />
        <Field label="Weight" value={formatNumber(trade.weight, 4)} />
        <Field label="Entry UTC" value={formatDateTime(trade.entryUtc)} testId="trade-entry-utc" />
        <Field label="Exit UTC" value={formatDateTime(trade.exitUtc)} testId="trade-exit-utc" />
        <Field label="Entry" value={formatNumber(trade.entryPrice, 5)} />
        <Field label="Exit" value={formatNumber(trade.exitPrice, 5)} />
        <Field label="Raw" value={formatNumber(trade.rawPct, 4, "%")} testId="trade-raw-pct" />
        <Field label="ADR Norm" value={formatNumber(trade.adrNormalizedPct, 4, "%")} testId="trade-adr-norm-pct" />
        <Field label="ADR" value={formatNumber(trade.adrPct, 4, "%")} />
        <Field label="Exit Reason" value={trade.exitReason ?? "--"} />
        <Field label="Active Fills" value={trade.activeFillsAtEntry ?? "--"} />
        <Field label="Cap Threshold" value={trade.capThresholdAtEntry ?? "--"} />
      </div>
    </div>
  );
}
