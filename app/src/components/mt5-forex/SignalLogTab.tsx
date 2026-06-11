/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: SignalLogTab.tsx
 *
 * Description:
 * Read-only signal ledger for Katarakti showing sweep detections,
 * displacement confirmations, and filter reasons across all 36 pairs.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

"use client";

import { useMemo, useState, type ChangeEvent } from "react";
import {
  formatShortDateTime,
  toNumber,
  directionTone,
  formatPct,
  type KataraktiSignalRow,
} from "@/components/mt5-forex/types";

type SignalLogTabProps = {
  signals: KataraktiSignalRow[];
};

function triggerTone(triggered: boolean) {
  if (triggered) return "border-emerald-300/40 bg-emerald-500/10 text-emerald-200";
  return "border-[var(--panel-border)] bg-[var(--panel)]/70 text-[color:var(--muted)]";
}

export default function SignalLogTab({ signals }: SignalLogTabProps) {
  const [symbolFilter, setSymbolFilter] = useState("ALL");
  const [triggeredFilter, setTriggeredFilter] = useState("ALL");

  const symbols = useMemo(() => {
    const set = new Set(signals.map((s) => s.symbol));
    return Array.from(set).sort();
  }, [signals]);

  const { filtered, triggeredCount } = useMemo(() => {
    const rows: KataraktiSignalRow[] = [];
    let triggered = 0;

    for (const row of signals) {
      if (symbolFilter !== "ALL" && row.symbol !== symbolFilter) continue;
      if (triggeredFilter === "TRIGGERED" && !row.triggered_entry) continue;
      if (triggeredFilter === "FILTERED" && row.triggered_entry) continue;
      rows.push(row);
      if (row.triggered_entry) {
        triggered += 1;
      }
    }

    return {
      filtered: rows,
      triggeredCount: triggered,
    };
  }, [signals, symbolFilter, triggeredFilter]);

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
          value={triggeredFilter}
          onChange={(e: ChangeEvent<HTMLSelectElement>) =>
            setTriggeredFilter(e.target.value)
          }
        >
          <option value="ALL">All Signals</option>
          <option value="TRIGGERED">Triggered Only</option>
          <option value="FILTERED">Filtered Only</option>
        </select>

        <span className="ml-auto text-xs text-[color:var(--muted)]">
          {filtered.length} signals | {triggeredCount} triggered
        </span>
      </div>

      {/* ── Signal table ───────────────────── */}
      <div className="overflow-hidden rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)]">
        <div className="max-h-[760px] overflow-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0 z-10 bg-[var(--panel)]/95 backdrop-blur">
              <tr className="border-b border-[var(--panel-border)] text-left text-[color:var(--muted)]">
                <th className="px-3 py-2">Time</th>
                <th className="px-3 py-2">Symbol</th>
                <th className="px-3 py-2">Dir</th>
                <th className="px-3 py-2">Session</th>
                <th className="px-3 py-2">Sweep %</th>
                <th className="px-3 py-2">Disp %</th>
                <th className="px-3 py-2">Ref High</th>
                <th className="px-3 py-2">Ref Low</th>
                <th className="px-3 py-2">Sweep Px</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Filter</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td
                    colSpan={11}
                    className="px-4 py-6 text-center text-xs text-[color:var(--muted)]"
                  >
                    No signals match the selected filters.
                  </td>
                </tr>
              ) : (
                filtered.map((signal) => (
                  <tr
                    key={signal.id}
                    className={`border-b border-[var(--panel-border)]/50 ${
                      signal.triggered_entry
                        ? "border-l-4 border-l-emerald-400/40 bg-emerald-500/5"
                        : ""
                    }`}
                  >
                    <td className="px-3 py-2 text-[color:var(--muted)]">
                      {formatShortDateTime(signal.signal_time_utc)}
                    </td>
                    <td className="px-3 py-2 font-medium text-[var(--foreground)]">
                      {signal.symbol}
                    </td>
                    <td
                      className={`px-3 py-2 font-semibold ${directionTone(signal.direction)}`}
                    >
                      {signal.direction}
                    </td>
                    <td className="px-3 py-2 text-[color:var(--muted)]">
                      {signal.session_window}
                    </td>
                    <td className="px-3 py-2">
                      {formatPct(signal.sweep_pct, 3)}
                    </td>
                    <td className="px-3 py-2">
                      {formatPct(signal.displacement_pct, 3)}
                    </td>
                    <td className="px-3 py-2">
                      {toNumber(signal.ref_high)?.toFixed(5) ?? "—"}
                    </td>
                    <td className="px-3 py-2">
                      {toNumber(signal.ref_low)?.toFixed(5) ?? "—"}
                    </td>
                    <td className="px-3 py-2">
                      {toNumber(signal.sweep_price)?.toFixed(5) ?? "—"}
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.15em] ${triggerTone(signal.triggered_entry)}`}
                      >
                        {signal.triggered_entry ? "ENTRY" : "FILTERED"}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-[color:var(--muted)]">
                      {signal.filter_reason ?? "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
