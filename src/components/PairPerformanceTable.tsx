"use client";

import type { Direction } from "@/lib/cotTypes";
import type { PairPerformance } from "@/lib/priceStore";

type PairRow = {
  pair: string;
  direction: Direction;
  performance?: PairPerformance | null;
};

type PairPerformanceTableProps = {
  rows: PairRow[];
  note?: string;
  missingPairs?: string[];
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

export default function PairPerformanceTable({
  rows,
  note,
  missingPairs,
}: PairPerformanceTableProps) {
  const totals = rows.reduce(
    (acc, row) => {
      if (row.performance) {
        const directionFactor = row.direction === "LONG" ? 1 : -1;
        acc.percent += row.performance.percent * directionFactor;
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
                const pnlPercent = perf ? perf.percent * directionFactor : 0;
                const rowTone = perf
                  ? pnlPercent > 0
                    ? "bg-emerald-50/60"
                    : pnlPercent < 0
                      ? "bg-rose-50/60"
                      : ""
                  : "";
                return (
                  <tr
                    key={row.pair}
                    className={`border-t border-[var(--panel-border)] ${rowTone}`}
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
                        perf ? valueTone(perf.percent) : "text-[color:var(--muted)]"
                      }`}
                    >
                      {perf ? formatSigned(perf.percent, 2, "%") : "--"}
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
                      ? "bg-emerald-100/70"
                      : totals.percent < 0
                        ? "bg-rose-100/70"
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
        {note ?? "Performance is relative to Sunday 7:00 PM ET open."}
      </p>
      {missingPairs && missingPairs.length > 0 ? (
        <div className="mt-3 rounded-lg border border-[var(--accent)]/30 bg-[var(--accent)]/10 px-3 py-2 text-xs text-[var(--accent-strong)]">
          Missing prices for: {missingPairs.join(", ")}
        </div>
      ) : null}
    </div>
  );
}
