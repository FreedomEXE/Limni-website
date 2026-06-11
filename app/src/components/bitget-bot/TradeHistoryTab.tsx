/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: TradeHistoryTab.tsx
 *
 * Description:
 * Interactive trade history table for Bitget Bot v2 with symbol,
 * direction, and exit-reason filters plus expandable metadata rows.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

"use client";

import { Fragment, useMemo, useState, type ChangeEvent } from "react";
import {
  toIsoString,
  toNumber,
  type BitgetTradeRow,
} from "@/components/bitget-bot/types";
import { formatDateTimeET } from "@/lib/time";

type TradeHistoryTabProps = {
  trades: BitgetTradeRow[];
};

function fmtUtc(value: unknown) {
  const iso = toIsoString(value);
  if (!iso) return "—";
  return formatDateTimeET(iso, iso);
}

function fmtPrice(value: unknown) {
  const num = toNumber(value);
  if (num === null) return "—";
  return num.toLocaleString("en-US", { maximumFractionDigits: 4 });
}

function fmtPnl(value: unknown) {
  const num = toNumber(value);
  if (num === null) return "—";
  return `${num >= 0 ? "+" : ""}${num.toFixed(2)} USDT`;
}

export default function TradeHistoryTab({ trades }: TradeHistoryTabProps) {
  const [symbolFilter, setSymbolFilter] = useState<"ALL" | "BTC" | "ETH">("ALL");
  const [directionFilter, setDirectionFilter] = useState<"ALL" | "LONG" | "SHORT">("ALL");
  const [exitFilter, setExitFilter] = useState<
    "ALL" | "STOP_LOSS" | "BREAKEVEN_STOP" | "TRAILING_STOP" | "WEEK_CLOSE"
  >("ALL");
  const [expanded, setExpanded] = useState<number | null>(null);

  const filtered = useMemo(() => {
    return trades.filter((row) => {
      if (symbolFilter !== "ALL" && row.symbol !== symbolFilter) return false;
      if (directionFilter !== "ALL" && row.direction !== directionFilter) return false;
      if (exitFilter !== "ALL" && row.exit_reason !== exitFilter) return false;
      return true;
    });
  }, [trades, symbolFilter, directionFilter, exitFilter]);

  const totalPnl = filtered.reduce((sum, row) => sum + (toNumber(row.pnl_usd) ?? 0), 0);

  function onSymbolChange(e: ChangeEvent<HTMLSelectElement>) {
    setSymbolFilter(e.target.value as "ALL" | "BTC" | "ETH");
  }

  function onDirectionChange(e: ChangeEvent<HTMLSelectElement>) {
    setDirectionFilter(e.target.value as "ALL" | "LONG" | "SHORT");
  }

  function onExitChange(e: ChangeEvent<HTMLSelectElement>) {
    setExitFilter(
      e.target.value as "ALL" | "STOP_LOSS" | "BREAKEVEN_STOP" | "TRAILING_STOP" | "WEEK_CLOSE",
    );
  }

  return (
    <section className="space-y-4">
      <div className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-4">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">Total PnL</p>
            <p className={`mt-1 text-lg font-semibold ${totalPnl >= 0 ? "text-emerald-300" : "text-rose-300"}`}>
              {totalPnl >= 0 ? "+" : ""}{totalPnl.toFixed(2)} USDT
            </p>
          </div>
          <label className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
            Symbol
            <select
              value={symbolFilter}
              onChange={onSymbolChange}
              className="mt-1 w-full rounded-xl border border-[var(--panel-border)] bg-[var(--panel)] px-3 py-2 text-sm text-[var(--foreground)]"
            >
              <option value="ALL">All</option>
              <option value="BTC">BTC</option>
              <option value="ETH">ETH</option>
            </select>
          </label>
          <label className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
            Direction
            <select
              value={directionFilter}
              onChange={onDirectionChange}
              className="mt-1 w-full rounded-xl border border-[var(--panel-border)] bg-[var(--panel)] px-3 py-2 text-sm text-[var(--foreground)]"
            >
              <option value="ALL">All</option>
              <option value="LONG">LONG</option>
              <option value="SHORT">SHORT</option>
            </select>
          </label>
          <label className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
            Exit Reason
            <select
              value={exitFilter}
              onChange={onExitChange}
              className="mt-1 w-full rounded-xl border border-[var(--panel-border)] bg-[var(--panel)] px-3 py-2 text-sm text-[var(--foreground)]"
            >
              <option value="ALL">All</option>
              <option value="STOP_LOSS">STOP_LOSS</option>
              <option value="BREAKEVEN_STOP">BREAKEVEN_STOP</option>
              <option value="TRAILING_STOP">TRAILING_STOP</option>
              <option value="WEEK_CLOSE">WEEK_CLOSE</option>
            </select>
          </label>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] shadow-sm">
        <div className="max-h-[680px] overflow-auto">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 z-10 bg-[var(--panel)]/95 text-xs uppercase tracking-[0.2em] text-[color:var(--muted)] backdrop-blur">
              <tr>
                <th className="px-4 py-3">Symbol</th>
                <th className="px-4 py-3">Direction</th>
                <th className="px-4 py-3">Entry Time</th>
                <th className="px-4 py-3">Entry Price</th>
                <th className="px-4 py-3">Exit Time</th>
                <th className="px-4 py-3">Exit Price</th>
                <th className="px-4 py-3">PnL</th>
                <th className="px-4 py-3">Max Lev</th>
                <th className="px-4 py-3">Milestones</th>
                <th className="px-4 py-3">Exit Reason</th>
                <th className="px-4 py-3">Session</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--panel-border)]">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={11} className="px-4 py-6 text-center text-sm text-[color:var(--muted)]">
                    No trades for current filters.
                  </td>
                </tr>
              ) : (
                filtered.map((row) => {
                  const pnl = toNumber(row.pnl_usd);
                  const isExpanded = expanded === row.id;
                  return (
                    <Fragment key={row.id}>
                      <tr
                        className="cursor-pointer hover:bg-[var(--panel)]/80"
                        onClick={() => setExpanded(isExpanded ? null : row.id)}
                      >
                        <td className="px-4 py-3 font-semibold text-[var(--foreground)]">{row.symbol}</td>
                        <td className="px-4 py-3">
                          <span
                            className={`rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] ${
                              row.direction === "LONG"
                                ? "border-emerald-300/40 bg-emerald-500/10 text-emerald-200"
                                : "border-rose-300/40 bg-rose-500/10 text-rose-200"
                            }`}
                          >
                            {row.direction}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-[color:var(--muted)]">{fmtUtc(row.entry_time_utc)}</td>
                        <td className="px-4 py-3">{fmtPrice(row.entry_price)}</td>
                        <td className="px-4 py-3 text-[color:var(--muted)]">{fmtUtc(row.exit_time_utc)}</td>
                        <td className="px-4 py-3">{fmtPrice(row.exit_price)}</td>
                        <td className={`px-4 py-3 font-semibold ${pnl !== null && pnl >= 0 ? "text-emerald-300" : "text-rose-300"}`}>
                          {fmtPnl(row.pnl_usd)}
                        </td>
                        <td className="px-4 py-3">{fmtPrice(row.max_leverage_reached)}</td>
                        <td className="px-4 py-3">
                          {Array.isArray(row.milestones_hit) ? row.milestones_hit.map((m) => `+${m}%`).join(", ") || "—" : "—"}
                        </td>
                        <td className="px-4 py-3">{row.exit_reason ?? "OPEN"}</td>
                        <td className="px-4 py-3 text-xs text-[color:var(--muted)]">{row.session_window}</td>
                      </tr>
                      {isExpanded ? (
                        <tr>
                          <td colSpan={11} className="px-4 py-3">
                            <div className="rounded-xl border border-[var(--panel-border)] bg-[var(--panel)]/60 p-3">
                              <p className="mb-2 text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
                                Entry Metadata
                              </p>
                              <pre className="overflow-auto text-xs text-[var(--foreground)]">
                                {JSON.stringify(row.metadata ?? {}, null, 2)}
                              </pre>
                            </div>
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
