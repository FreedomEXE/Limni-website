"use client";

import { useState } from "react";
import FilterBar from "@/components/common/FilterBar";
import SummaryCard from "@/components/accounts/SummaryCard";
import SimpleListTable from "@/components/accounts/SimpleListTable";
import ManualExecutionSheetCard from "@/components/accounts/ManualExecutionSheetCard";
import type { ClosedRow, SymbolRow } from "@/lib/accounts/accountClientViewRows";

type PlannedSummary = {
  marginUsed?: number | null;
  marginUsedBestCase?: number | null;
  marginAvailable?: number | null;
  scale?: number | null;
  currency?: string | null;
} | null | undefined;

type AccountTradesSectionProps = {
  isOanda: boolean;
  openLegCount: number;
  closedCount: number;
  netExposure: number;
  plannedPairsCount: number;
  plannedLegTotal: number;
  plannedModelChips: Array<[string, number]>;
  statusFilter: string;
  onStatusFilterChange: (value: string) => void;
  search: string;
  onSearchChange: (value: string) => void;
  sort: string;
  onSortChange: (value: string) => void;
  showStopLoss1pct: boolean;
  stopLossLines: string[];
  copied: boolean;
  onCopyStopLoss: () => Promise<void>;
  plannedSummary?: PlannedSummary;
  liveSymbolRows: SymbolRow[];
  reconcileSymbolRows: SymbolRow[];
  closedRows: ClosedRow[];
  metricLabel: string;
  sizeUnitLabel: string;
  openGridCols: string;
  rowGridCols: string;
  manualExecution?: {
    enabled: boolean;
    accountLabel: string;
    weekLabel: string;
    currency: string;
    equity: number;
    defaultRiskMode?: string | null;
    plannedPairs: Array<{
      symbol: string;
      net: number;
      entryPrice?: number | null;
      legs?: Array<{
        model: string;
        direction: string;
      }>;
    }>;
  };
};

export default function AccountTradesSection(props: AccountTradesSectionProps) {
  const {
    isOanda,
    openLegCount,
    closedCount,
    netExposure,
    plannedPairsCount,
    plannedLegTotal,
    plannedModelChips,
    statusFilter,
    onStatusFilterChange,
    search,
    onSearchChange,
    sort,
    onSortChange,
    showStopLoss1pct,
    stopLossLines,
    copied,
    onCopyStopLoss,
    plannedSummary,
    liveSymbolRows,
    reconcileSymbolRows,
    closedRows,
    metricLabel,
    sizeUnitLabel,
    openGridCols,
    rowGridCols,
    manualExecution,
  } = props;
  const [openMode, setOpenMode] = useState<"live" | "reconcile">("live");
  const symbolRows = openMode === "live" ? liveSymbolRows : reconcileSymbolRows;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-3">
        <SummaryCard
          label="Open"
          value={openLegCount}
          hint="Open legs right now"
          onClick={() => onStatusFilterChange("open")}
          selected={statusFilter === "open"}
        />
        <SummaryCard
          label="Closed"
          value={closedCount}
          hint="Closed this week"
          onClick={() => onStatusFilterChange("closed")}
          selected={statusFilter === "closed"}
        />
        <SummaryCard
          label="Net Exposure"
          value={isOanda ? `${netExposure.toFixed(0)} units` : `${netExposure.toFixed(2)}`}
          hint="Planned net exposure (reconciliation)"
        />
      </div>
      {plannedPairsCount > 0 ? (
        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)]/60 px-4 py-3 text-xs text-[color:var(--muted)]">
          <span className="uppercase tracking-[0.2em]">
            Legs (open {openLegCount} / planned {plannedLegTotal})
          </span>
          {plannedModelChips.map(([key, count]) => (
            <span
              key={key}
              className="rounded-full border border-[var(--panel-border)] bg-[var(--panel)] px-3 py-1 font-semibold uppercase tracking-[0.18em] text-[var(--foreground)]/80"
            >
              {key}: {count}
            </span>
          ))}
        </div>
      ) : null}
      <FilterBar
        status={statusFilter}
        onStatusChange={onStatusFilterChange}
        search={search}
        onSearchChange={onSearchChange}
        sort={sort}
        onSortChange={onSortChange}
        statusOptions={["open", "closed"]}
      />
      {statusFilter === "open" ? (
        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)]/70 p-2">
          <button
            type="button"
            onClick={() => setOpenMode("live")}
            className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] transition ${
              openMode === "live"
                ? "border-[var(--accent)]/50 bg-[var(--accent)]/10 text-[var(--accent-strong)]"
                : "border-[var(--panel-border)] bg-[var(--panel)] text-[var(--foreground)]/70 hover:border-[var(--accent)] hover:text-[var(--accent-strong)]"
            }`}
          >
            Live Positions
          </button>
          <button
            type="button"
            onClick={() => setOpenMode("reconcile")}
            className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] transition ${
              openMode === "reconcile"
                ? "border-[var(--accent)]/50 bg-[var(--accent)]/10 text-[var(--accent-strong)]"
                : "border-[var(--panel-border)] bg-[var(--panel)] text-[var(--foreground)]/70 hover:border-[var(--accent)] hover:text-[var(--accent-strong)]"
            }`}
          >
            Planned vs Filled
          </button>
          <span className="ml-auto text-xs text-[color:var(--muted)]">
            {openMode === "live"
              ? "Source: live MT5 positions"
              : "Source: model plan reconciled against live MT5 positions"}
          </span>
        </div>
      ) : null}
      {statusFilter === "open" && manualExecution?.enabled ? (
        <ManualExecutionSheetCard
          accountLabel={manualExecution.accountLabel}
          weekLabel={manualExecution.weekLabel}
          currency={manualExecution.currency}
          equity={manualExecution.equity}
          defaultRiskMode={manualExecution.defaultRiskMode}
          plannedPairs={manualExecution.plannedPairs}
        />
      ) : null}
      {showStopLoss1pct && statusFilter === "open" && stopLossLines.length > 0 ? (
        <div className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)]/80 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--foreground)]/80">
                Recommended Stop Losses (1%)
              </p>
              <p className="mt-1 text-xs text-[color:var(--muted)]">
                Format: SYMBOL [tab] DIRECTION [tab] SL PRICE
              </p>
            </div>
            <button
              type="button"
              onClick={onCopyStopLoss}
              className="rounded-full border border-[var(--panel-border)] bg-[var(--panel)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--muted)] transition hover:border-[var(--accent)] hover:text-[var(--accent-strong)]"
            >
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
          <textarea
            readOnly
            value={stopLossLines.join("\n")}
            className="mt-3 h-32 w-full resize-none rounded-xl border border-[var(--panel-border)] bg-[var(--panel)]/70 p-3 font-mono text-xs text-[var(--foreground)]"
          />
        </div>
      ) : null}
      {plannedSummary ? (
        <div className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)]/80 px-4 py-3 text-xs text-[color:var(--muted)]">
          Estimated margin used this week:{" "}
          <span className="font-semibold text-[var(--foreground)]">
            {plannedSummary.currency ?? "$"}
            {(plannedSummary.marginUsed ?? 0).toFixed(2)}
          </span>
          {plannedSummary.marginUsedBestCase !== null &&
          plannedSummary.marginUsedBestCase !== undefined ? (
            <>
              {" "}
              • Best case (net hedged){" "}
              <span className="font-semibold text-[var(--foreground)]">
                {plannedSummary.currency ?? "$"}
                {plannedSummary.marginUsedBestCase.toFixed(2)}
              </span>
            </>
          ) : null}
          {plannedSummary.marginAvailable ? (
            <>
              {" "}
              • Available{" "}
              <span className="font-semibold text-[var(--foreground)]">
                {plannedSummary.currency ?? "$"}
                {plannedSummary.marginAvailable.toFixed(2)}
              </span>
            </>
          ) : null}
          {plannedSummary.scale ? <> • Scale {plannedSummary.scale.toFixed(2)}x</> : null}
        </div>
      ) : null}
      {statusFilter === "open" ? (
        <SimpleListTable
          columns={
            openMode === "live"
              ? [
                  { key: "symbol", label: "Symbol" },
                  { key: "direction", label: "Direction" },
                  { key: "filled", label: "Lots" },
                  { key: "net", label: "Net" },
                  { key: "metric", label: metricLabel },
                  { key: "legs", label: "Legs" },
                ]
              : [
                  { key: "symbol", label: "Symbol" },
                  { key: "direction", label: "Direction" },
                  { key: "filled", label: "Filled" },
                  { key: "net", label: "Net" },
                  { key: "metric", label: metricLabel },
                  { key: "legs", label: "Legs" },
                ]
          }
          rows={symbolRows}
          emptyState={
            openMode === "live"
              ? "No live open positions for this week."
              : "No planned/live reconciliation rows for this week."
          }
          maxHeight={520}
          gridClassName={openGridCols}
          renderRow={(row) => {
            const plannedLong = Number(row.plannedLong ?? 0);
            const plannedShort = Number(row.plannedShort ?? 0);
            const openLong = Number(row.openLong ?? 0);
            const openShort = Number(row.openShort ?? 0);
            const openPnl = Number(row.openPnl ?? 0);
            const grossPlanned = plannedLong + plannedShort;
            const grossOpen = openLong + openShort;
            const netPlanned = plannedLong - plannedShort;
            const netOpen = openLong - openShort;

            const fmt = (val: number) => val.toFixed(isOanda ? 0 : 2);
            const filledText =
              openMode === "live"
                ? `${fmt(grossOpen)}`
                : grossPlanned > 0
                  ? `${fmt(grossOpen)}/${fmt(grossPlanned)}`
                  : `${fmt(grossOpen)}/—`;
            const netText =
              typeof netPlanned === "number"
                ? openMode === "live"
                  ? `${fmt(netOpen)}`
                  : netPlanned !== 0
                  ? `${fmt(netOpen)}/${fmt(netPlanned)}`
                  : `${fmt(netOpen)}`
                : `${fmt(netOpen)}`;

            const directionSource = Math.abs(netOpen) > 0 ? netOpen : netPlanned;
            const direction =
              directionSource > 0 ? "LONG" : directionSource < 0 ? "SHORT" : "NEUTRAL";

            const expanded =
              (Array.isArray(row.plannedLegs) && row.plannedLegs.length > 0) ||
              (Array.isArray(row.openLegs) && row.openLegs.length > 0);

            return (
              <details className={expanded ? "group" : ""}>
                <summary
                  className={`grid cursor-pointer list-none ${openGridCols} gap-3 [&::-webkit-details-marker]:hidden`}
                >
                  <span className="font-semibold">{row.symbol}</span>
                  <span
                    className={
                      direction === "LONG"
                        ? "text-emerald-700"
                        : direction === "SHORT"
                          ? "text-rose-700"
                          : "text-[color:var(--muted)]"
                    }
                  >
                    {direction}
                  </span>
                  <span className="text-xs text-[color:var(--muted)]">{filledText}</span>
                  <span className={netOpen >= 0 ? "text-emerald-700" : "text-rose-700"}>
                    {netOpen >= 0 ? "+" : ""}
                    {netText}
                  </span>
                  <span className={openPnl >= 0 ? "text-emerald-700" : "text-rose-700"}>
                    {Number.isFinite(openPnl) ? openPnl.toFixed(2) : "—"}
                  </span>
                  <span className="text-xs text-[color:var(--muted)]">
                    {openMode === "live"
                      ? `${Number(row.legsOpenCount ?? 0)}`
                      : `${Number(row.legsOpenCount ?? 0)}/${Number(row.legsPlannedCount ?? 0)}`}
                  </span>
                </summary>

                {expanded ? (
                  <div className={`mt-3 grid gap-3 ${openMode === "live" ? "" : "md:grid-cols-2"}`}>
                    {openMode === "reconcile" ? (
                      <div className="rounded-xl border border-[var(--panel-border)] bg-[var(--panel)]/80 p-3">
                        <div className="text-[10px] uppercase tracking-[0.2em] text-[color:var(--muted)]">
                          Planned Legs
                        </div>
                        <div className="mt-2 space-y-2">
                          {(row.plannedLegs ?? []).length === 0 ? (
                            <div className="text-xs text-[color:var(--muted)]">No planned legs.</div>
                          ) : (
                            (row.plannedLegs ?? []).map((leg, idx) => (
                              <div
                                key={`${row.symbol}-planned-${idx}`}
                                className="grid grid-cols-[1fr_0.7fr_0.9fr] gap-2 rounded-lg border border-[var(--panel-border)] bg-[var(--panel)] px-3 py-2 text-xs"
                              >
                                <div className="truncate text-[var(--foreground)]/90">
                                  {String(leg.model ?? "unknown")}
                                </div>
                                <div
                                  className={
                                    String(leg.direction).toUpperCase() === "LONG"
                                      ? "text-emerald-700"
                                      : "text-rose-700"
                                  }
                                >
                                  {String(leg.direction).toUpperCase()}
                                </div>
                                <div className="text-right">
                                  {Number.isFinite(Number(leg.units)) ? fmt(Number(leg.units)) : "—"}{" "}
                                  {sizeUnitLabel}
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    ) : null}

                    <div className="rounded-xl border border-[var(--panel-border)] bg-[var(--panel)]/80 p-3">
                      <div className="text-[10px] uppercase tracking-[0.2em] text-[color:var(--muted)]">
                        Open Legs
                      </div>
                      <div className="mt-2 space-y-2">
                        {(row.openLegs ?? []).length === 0 ? (
                          <div className="text-xs text-[color:var(--muted)]">No open legs.</div>
                        ) : (
                          (row.openLegs ?? []).map((leg) => (
                            <div
                              key={leg.id}
                              className="grid grid-cols-[1fr_0.7fr_0.9fr_0.9fr] gap-2 rounded-lg border border-[var(--panel-border)] bg-[var(--panel)] px-3 py-2 text-xs"
                            >
                              <div className="truncate text-[var(--foreground)]/90">
                                {leg.model ? `${leg.model} • ` : ""}
                                {String(leg.basket ?? "live")}
                              </div>
                              <div
                                className={
                                  String(leg.side).toUpperCase() === "BUY"
                                    ? "text-emerald-700"
                                    : "text-rose-700"
                                }
                              >
                                {String(leg.side).toUpperCase()}
                              </div>
                              <div className="text-right">
                                {fmt(Number(leg.lots ?? 0))} {sizeUnitLabel}
                              </div>
                              <div
                                className={`text-right ${
                                  Number(leg.pnl ?? 0) >= 0 ? "text-emerald-700" : "text-rose-700"
                                }`}
                              >
                                {Number(leg.pnl ?? 0).toFixed(2)}
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                ) : null}
              </details>
            );
          }}
        />
      ) : (
        <SimpleListTable
          columns={[
            { key: "symbol", label: "Symbol" },
            { key: "direction", label: "Direction" },
            { key: "size", label: "Size" },
            { key: "metric", label: metricLabel },
            { key: "legs", label: "Legs" },
          ]}
          rows={closedRows}
          emptyState="No closed positions for this week."
          maxHeight={520}
          gridClassName={rowGridCols}
          renderRow={(row) => (
            <div className={`grid ${rowGridCols} gap-3`}>
              <span className="font-semibold">{row.symbol}</span>
              <span
                className={
                  String(row.direction).toUpperCase() === "BUY"
                    ? "text-emerald-700"
                    : "text-rose-700"
                }
              >
                {String(row.direction).toUpperCase()}
              </span>
              <span className="text-xs text-[color:var(--muted)]">
                {Number(row.lots ?? 0).toFixed(isOanda ? 0 : 2)} {sizeUnitLabel}
              </span>
              <span className="text-xs text-[color:var(--muted)]">—</span>
              <span className="text-xs text-[color:var(--muted)]">{row.legs?.length ?? 0} legs</span>
            </div>
          )}
        />
      )}
    </div>
  );
}
