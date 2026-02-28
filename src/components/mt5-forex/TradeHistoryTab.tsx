/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: TradeHistoryTab.tsx
 *
 * Description:
 * Interactive trade history table for Katarakti with filters for
 * symbol, direction, exit reason, and session window.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

"use client";

import { Fragment, useMemo, useState, type ChangeEvent } from "react";
import {
  formatShortDateTime,
  toNumber,
  formatPrice,
  formatPct,
  formatCompactUsd,
  directionTone,
  pnlTone,
  type KataraktiTradeRow,
} from "@/components/mt5-forex/types";

type TradeHistoryTabProps = {
  trades: KataraktiTradeRow[];
};

export default function TradeHistoryTab({ trades }: TradeHistoryTabProps) {
  const [symbolFilter, setSymbolFilter] = useState("ALL");
  const [directionFilter, setDirectionFilter] = useState("ALL");
  const [exitFilter, setExitFilter] = useState("ALL");
  const [expanded, setExpanded] = useState<number | null>(null);

  const symbols = useMemo(() => {
    const set = new Set(trades.map((t) => t.symbol));
    return Array.from(set).sort();
  }, [trades]);

  const exitReasons = useMemo(() => {
    const set = new Set(trades.map((t) => t.exit_step ?? t.exit_reason ?? "—"));
    return Array.from(set).sort();
  }, [trades]);

  const filtered = useMemo(() => {
    return trades.filter((row) => {
      if (symbolFilter !== "ALL" && row.symbol !== symbolFilter) return false;
      if (directionFilter !== "ALL" && row.direction !== directionFilter) return false;
      if (exitFilter !== "ALL") {
        const step = row.exit_step ?? row.exit_reason ?? "—";
        if (step !== exitFilter) return false;
      }
      return true;
    });
  }, [trades, symbolFilter, directionFilter, exitFilter]);

  const { totalPnl, winRate } = useMemo(() => {
    let pnl = 0;
    let wins = 0;

    for (const row of filtered) {
      const tradePnl = toNumber(row.pnl_usd) ?? 0;
      pnl += tradePnl;
      if (tradePnl > 0) {
        wins += 1;
      }
    }

    return {
      totalPnl: pnl,
      winRate: filtered.length > 0 ? (wins / filtered.length) * 100 : 0,
    };
  }, [filtered]);

  const selectClass =
    "rounded-lg border border-[var(--panel-border)] bg-[var(--panel)] px-3 py-1.5 text-xs text-[var(--foreground)]";

  return (
    <div className="space-y-4">
      {/* ── Filters ─────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3">
        <select
          className={selectClass}
          value={symbolFilter}
          onChange={(e: ChangeEvent<HTMLSelectElement>) =>
            setSymbolFilter(e.target.value)
          }
        >
          <option value="ALL">All Symbols</option>
          {symbols.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>

        <select
          className={selectClass}
          value={directionFilter}
          onChange={(e: ChangeEvent<HTMLSelectElement>) =>
            setDirectionFilter(e.target.value)
          }
        >
          <option value="ALL">All Directions</option>
          <option value="LONG">LONG</option>
          <option value="SHORT">SHORT</option>
        </select>

        <select
          className={selectClass}
          value={exitFilter}
          onChange={(e: ChangeEvent<HTMLSelectElement>) =>
            setExitFilter(e.target.value)
          }
        >
          <option value="ALL">All Exit Types</option>
          {exitReasons.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>

        <span className="ml-auto text-xs text-[color:var(--muted)]">
          {filtered.length} trades | WR {winRate.toFixed(1)}% |{" "}
          <span className={pnlTone(totalPnl)}>
            {totalPnl >= 0 ? "+" : ""}
            {totalPnl.toFixed(2)} USD
          </span>
        </span>
      </div>

      {/* ── Trade table ─────────────────────── */}
      <div className="overflow-x-auto rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)]">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-[var(--panel-border)] text-left text-[color:var(--muted)]">
              <th className="px-3 py-2">Symbol</th>
              <th className="px-3 py-2">Dir</th>
              <th className="px-3 py-2">Entry</th>
              <th className="px-3 py-2">Exit</th>
              <th className="px-3 py-2">PnL</th>
              <th className="px-3 py-2">PnL %</th>
              <th className="px-3 py-2">Exit Step</th>
              <th className="px-3 py-2">Peak %</th>
              <th className="px-3 py-2">Session</th>
              <th className="px-3 py-2">Duration</th>
              <th className="px-3 py-2">Entry Time</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((trade) => {
              const isExpanded = expanded === trade.id;
              return (
                <Fragment key={trade.id}>
                  <tr
                    className="cursor-pointer border-b border-[var(--panel-border)]/50 transition hover:bg-[var(--accent)]/5"
                    onClick={() =>
                      setExpanded(isExpanded ? null : trade.id)
                    }
                  >
                    <td className="px-3 py-2 font-medium text-[var(--foreground)]">
                      {trade.symbol}
                    </td>
                    <td
                      className={`px-3 py-2 font-semibold ${directionTone(trade.direction)}`}
                    >
                      {trade.direction}
                    </td>
                    <td className="px-3 py-2">{formatPrice(trade.entry_price)}</td>
                    <td className="px-3 py-2">
                      {formatPrice(trade.exit_price)}
                    </td>
                    <td className={`px-3 py-2 font-medium ${pnlTone(trade.pnl_usd)}`}>
                      {formatCompactUsd(trade.pnl_usd)}
                    </td>
                    <td className={`px-3 py-2 ${pnlTone(trade.pnl_pct)}`}>
                      {formatPct(trade.pnl_pct)}
                    </td>
                    <td className="px-3 py-2 text-[color:var(--muted)]">
                      {trade.exit_step ?? trade.exit_reason ?? "—"}
                    </td>
                    <td className="px-3 py-2">{formatPct(trade.peak_profit_pct)}</td>
                    <td className="px-3 py-2 text-[color:var(--muted)]">
                      {trade.session_window}
                    </td>
                    <td className="px-3 py-2 text-[color:var(--muted)]">
                      {toNumber(trade.duration_hours)?.toFixed(1) ?? "—"}h
                    </td>
                    <td className="px-3 py-2 text-[color:var(--muted)]">
                      {formatShortDateTime(trade.entry_time_utc)}
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr className="bg-[var(--accent)]/5">
                      <td colSpan={11} className="px-4 py-3">
                        <div className="grid gap-x-6 gap-y-1 text-xs sm:grid-cols-4">
                          <div>
                            <span className="text-[color:var(--muted)]">Bias: </span>
                            <span className={directionTone(trade.bias_direction)}>
                              {trade.bias_direction}
                            </span>
                            {trade.bias_tier && (
                              <span className="text-[color:var(--muted)]">
                                {" "}
                                (T{trade.bias_tier})
                              </span>
                            )}
                          </div>
                          <div>
                            <span className="text-[color:var(--muted)]">System: </span>
                            {trade.bias_system}
                          </div>
                          <div>
                            <span className="text-[color:var(--muted)]">Stop: </span>
                            {formatPrice(trade.stop_price)}
                          </div>
                          <div>
                            <span className="text-[color:var(--muted)]">Risk: </span>
                            {formatCompactUsd(trade.risk_usd)} ({formatPct(trade.risk_pct)})
                          </div>
                          <div>
                            <span className="text-[color:var(--muted)]">Milestones: </span>
                            {trade.reached_025 ? "+0.25" : ""}
                            {trade.reached_050 ? " +0.50" : ""}
                            {trade.reached_075 ? " +0.75" : ""}
                            {trade.reached_100 ? " +1.00" : ""}
                            {!trade.reached_025 && "none"}
                          </div>
                          <div>
                            <span className="text-[color:var(--muted)]">Asset: </span>
                            {trade.asset_class}
                          </div>
                          <div>
                            <span className="text-[color:var(--muted)]">Exit: </span>
                            {formatShortDateTime(trade.exit_time_utc)}
                          </div>
                          <div>
                            <span className="text-[color:var(--muted)]">Notional: </span>
                            {formatCompactUsd(trade.notional_usd)}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <p className="px-4 py-6 text-center text-xs text-[color:var(--muted)]">
            No trades match the selected filters.
          </p>
        )}
      </div>
    </div>
  );
}
