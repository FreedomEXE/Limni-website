/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: FillsTable.tsx
 *
 * Description:
 * Fill-level table for ADR Grid parent trades.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import type { Trade } from "@/lib/trades/tradeTypes";
import TradeIdBadge from "@/components/common/trades/TradeIdBadge";

type FillsTableProps = {
  fills: Trade[];
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

export default function FillsTable({ fills }: FillsTableProps) {
  const sorted = [...fills].sort((left, right) => (left.fillSeq ?? 0) - (right.fillSeq ?? 0));

  if (sorted.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-(--panel-border) px-3 py-3 text-xs text-(--muted)">
        No fill rows found for this parent trade.
      </div>
    );
  }

  return (
    <div data-testid="fills-table" className="overflow-x-auto rounded-lg border border-(--panel-border)">
      <table className="min-w-[980px] text-left text-xs">
        <thead className="bg-(--panel)/80 uppercase tracking-[0.12em] text-(--muted)">
          <tr>
            <th className="px-3 py-2">Fill</th>
            <th className="px-3 py-2">ID</th>
            <th className="px-3 py-2">Entry UTC</th>
            <th className="px-3 py-2">Exit UTC</th>
            <th className="px-3 py-2">Entry</th>
            <th className="px-3 py-2">Exit</th>
            <th className="px-3 py-2">Raw</th>
            <th className="px-3 py-2">ADR Norm</th>
            <th className="px-3 py-2">Reason</th>
            <th className="px-3 py-2">Active</th>
            <th className="px-3 py-2">Cap</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-(--panel-border)">
          {sorted.map((fill) => (
            <tr
              key={fill.tradeId}
              data-testid="fill-row"
              className={fill.capViolated ? "bg-rose-500/10 text-rose-300" : "bg-(--panel)/35 text-(--foreground)"}
            >
              <td data-testid="fill-seq" className="px-3 py-2 font-mono">{fill.fillSeq ?? "--"}</td>
              <td className="px-3 py-2"><TradeIdBadge trade={fill} /></td>
              <td className="px-3 py-2 font-mono text-[11px]">{formatDateTime(fill.entryUtc)}</td>
              <td className="px-3 py-2 font-mono text-[11px]">{formatDateTime(fill.exitUtc)}</td>
              <td className="px-3 py-2 font-mono">{formatNumber(fill.entryPrice, 5)}</td>
              <td className="px-3 py-2 font-mono">{formatNumber(fill.exitPrice, 5)}</td>
              <td data-testid="fill-raw-pct" className="px-3 py-2 font-mono">{formatNumber(fill.rawPct, 4, "%")}</td>
              <td data-testid="fill-adr-norm-pct" className="px-3 py-2 font-mono">{formatNumber(fill.adrNormalizedPct, 4, "%")}</td>
              <td data-testid="fill-exit-reason" className="px-3 py-2 uppercase">{fill.exitReason ?? "--"}</td>
              <td className="px-3 py-2 font-mono">{fill.activeFillsAtEntry ?? "--"}</td>
              <td className="px-3 py-2">
                <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase ${
                  fill.capViolated
                    ? "border-rose-500/45 bg-rose-500/10 text-rose-300"
                    : "border-emerald-500/35 bg-emerald-500/10 text-emerald-300"
                }`}>
                  {fill.capViolated ? "violation" : "clean"}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
