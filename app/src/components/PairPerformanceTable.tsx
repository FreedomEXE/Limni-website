"use client";

import type { Direction } from "@/lib/cotTypes";
import type { PairPerformance } from "@/lib/priceStore";
import MissingReturnCell from "@/components/common/MissingReturnCell";
import TradeDrilldownModal from "@/components/common/trades/TradeDrilldownModal";
import { resolveDisplayReturn } from "@/lib/viewMode/resolveDisplayValue";
import { useViewMode } from "@/lib/viewMode/viewModeStore";
import { useState } from "react";
import type { AnchorType, TradeDirection } from "@/lib/trades/tradeTypes";

type PairRow = {
  pair: string;
  direction: Direction;
  performance?: PairPerformance | null;
};

type PairPerformanceTableProps = {
  rows: PairRow[];
  note?: string;
  missingPairs?: string[];
  weekOpenUtc?: string;
  strategyVariant?: string;
};

function formatSigned(value: number, decimals: number, suffix = "") {
  const sign = value > 0 ? "+" : value < 0 ? "" : "";
  return `${sign}${value.toFixed(decimals)}${suffix}`;
}

function valueTone(value: number) {
  if (value > 0) {
    return "text-emerald-700";
  }
  if (value < 0) {
    return "text-rose-700";
  }
  return "text-[color:var(--muted)]";
}

function warningReason(warnings: string[] | undefined) {
  if (warnings?.includes("execution_close_bar_missing")) {
    return "Execution data unavailable: incomplete close bar";
  }
  return "Data unavailable";
}

function resolvePerformancePercent(performance: PairPerformance | null | undefined, viewMode: Parameters<typeof resolveDisplayReturn>[1]) {
  if (!performance) return null;
  if (performance.returnMatrix) {
    return resolveDisplayReturn(performance.returnMatrix, viewMode);
  }
  return performance.percent;
}

function isTradeDirection(direction: Direction): direction is TradeDirection {
  return direction === "LONG" || direction === "SHORT";
}

export default function PairPerformanceTable({
  rows,
  note,
  missingPairs,
  weekOpenUtc,
  strategyVariant = "tandem-weekly_hold-none",
}: PairPerformanceTableProps) {
  const [viewMode] = useViewMode("data");
  const [drilldown, setDrilldown] = useState<{
    symbol: string;
    weekOpenUtc: string;
    anchorType: AnchorType;
    direction: TradeDirection;
  } | null>(null);
  const totals = rows.reduce(
    (acc, row) => {
      const resolvedPercent = resolvePerformancePercent(row.performance, viewMode);
      if (row.performance && resolvedPercent !== null) {
        const directionFactor = row.direction === "LONG" ? 1 : -1;
        acc.percent += resolvedPercent * directionFactor;
        acc.pips += row.performance.pips;
        acc.count += 1;
      }
      return acc;
    },
    { percent: 0, pips: 0, count: 0 },
  );

  return (
    <div className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] p-6 shadow-sm">
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-[var(--foreground)]">
            Pair trade list
          </h2>
          <p className="text-sm text-[color:var(--muted)]">
            Only opposing biases appear here.
          </p>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="text-xs uppercase text-[color:var(--muted)]">
            <tr>
              <th className="py-2">Pair</th>
              <th className="py-2">Direction</th>
              <th className="py-2">Change %</th>
              <th className="py-2">Pips</th>
            </tr>
          </thead>
          <tbody className="text-[var(--foreground)]">
            {rows.length === 0 ? (
              <tr>
                <td className="py-3 text-sm text-[color:var(--muted)]">
                  No tradable pairs yet.
                </td>
              </tr>
            ) : (
              rows.map((row) => {
                const perf = row.performance;
                const directionFactor = row.direction === "LONG" ? 1 : -1;
                const resolvedPercent = resolvePerformancePercent(perf, viewMode);
                const pnlPercent = resolvedPercent !== null ? resolvedPercent * directionFactor : 0;
                const drillDirection = isTradeDirection(row.direction) ? row.direction : null;
                const rowTone = perf
                  ? pnlPercent > 0
                    ? "bg-emerald-50/60 dark:bg-emerald-900/20"
                    : pnlPercent < 0
                      ? "bg-rose-50/60 dark:bg-rose-900/20"
                      : ""
                  : "";
                return (
                  <tr
                    key={row.pair}
                    onClick={weekOpenUtc && drillDirection
                      ? () => setDrilldown({
                          symbol: row.pair,
                          weekOpenUtc,
                          anchorType: viewMode.anchor,
                          direction: drillDirection,
                        })
                      : undefined}
                    title={weekOpenUtc && drillDirection ? "Open ledger drilldown" : undefined}
                    className={`border-t border-[var(--panel-border)] ${rowTone} ${weekOpenUtc && drillDirection ? "cursor-pointer hover:outline hover:outline-1 hover:outline-[var(--accent)]/40" : ""}`}
                  >
                    <td className="py-2 font-semibold">{row.pair}</td>
                    <td
                      className={`py-2 font-semibold ${
                        row.direction === "LONG"
                          ? "text-emerald-700"
                          : "text-rose-700"
                      }`}
                    >
                      {row.direction}
                    </td>
                    <td
                      className={`py-2 ${
                        resolvedPercent !== null ? valueTone(resolvedPercent) : "text-[color:var(--muted)]"
                      }`}
                    >
                      {resolvedPercent !== null ? (
                        formatSigned(resolvedPercent, 2, "%")
                      ) : (
                        <MissingReturnCell reason={warningReason(perf?.returnWarnings)} />
                      )}
                    </td>
                    <td
                      className={`py-2 ${
                        perf ? valueTone(perf.pips) : "text-[color:var(--muted)]"
                      }`}
                    >
                      {perf ? formatSigned(perf.pips, 1) : "--"}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
          {rows.length > 0 ? (
            <tfoot>
              <tr
                className={`border-t border-[var(--panel-border)] ${
                  totals.count > 0
                    ? totals.percent > 0
                      ? "bg-emerald-100/70 dark:bg-emerald-900/20"
                      : totals.percent < 0
                        ? "bg-rose-100/70 dark:bg-rose-900/20"
                        : ""
                    : ""
                }`}
              >
                <td className="py-2 font-semibold">Total (PnL)</td>
                <td className="py-2 text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
                  {totals.count}/{rows.length} priced
                </td>
                <td
                  className={`py-2 font-semibold ${
                    totals.count > 0 ? valueTone(totals.percent) : "text-[color:var(--muted)]"
                  }`}
                >
                  {totals.count > 0
                    ? formatSigned(totals.percent, 2, "%")
                    : "--"}
                </td>
                <td
                  className={`py-2 font-semibold ${
                    totals.count > 0 ? valueTone(totals.pips) : "text-[color:var(--muted)]"
                  }`}
                >
                  {totals.count > 0 ? formatSigned(totals.pips, 1) : "--"}
                </td>
              </tr>
            </tfoot>
          ) : null}
        </table>
      </div>
      <p className="mt-3 text-xs text-[color:var(--muted)]">
        {note ??
          "Performance uses unified weekly sessions (Sunday 7:00 PM ET week boundaries for historical consistency)."}
      </p>
      {missingPairs && missingPairs.length > 0 ? (
        <div className="mt-3 rounded-lg border border-[var(--accent)]/30 bg-[var(--accent)]/10 px-3 py-2 text-xs text-[var(--accent-strong)]">
          Missing prices for: {missingPairs.join(", ")}
        </div>
      ) : null}
      {drilldown ? (
        <TradeDrilldownModal
          symbol={drilldown.symbol}
          weekOpenUtc={drilldown.weekOpenUtc}
          strategyFamily="weekly_hold"
          strategyVariant={strategyVariant}
          anchorType={drilldown.anchorType}
          direction={drilldown.direction}
          onClose={() => setDrilldown(null)}
        />
      ) : null}
    </div>
  );
}
