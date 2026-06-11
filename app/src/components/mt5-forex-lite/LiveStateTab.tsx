/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: LiveStateTab.tsx
 *
 * Description:
 * Live state view for Katarakti — shows current week's bias grid,
 * active positions, and session sweep status for all 36 pairs.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import {
  directionTone,
  formatPrice,
  formatPct,
  formatShortDateTime,
  type KataraktiTradeRow,
  type KataraktiBiasRow,
} from "@/components/mt5-forex-lite/types";

type LiveStateTabProps = {
  botState: Record<string, unknown> | null;
  trades: KataraktiTradeRow[];
  weeklyBias: KataraktiBiasRow[];
};

export default function LiveStateTab({
  botState,
  trades,
  weeklyBias,
}: LiveStateTabProps) {
  const lifecycle = String(
    (botState as Record<string, unknown> | null)?.lifecycle ?? "IDLE",
  );
  const openTrades = trades.filter((t) => !t.exit_time_utc);
  const uniqueBiasBySymbol = new Map<string, KataraktiBiasRow>();
  for (const bias of weeklyBias) {
    if (!uniqueBiasBySymbol.has(bias.symbol)) {
      uniqueBiasBySymbol.set(bias.symbol, bias);
    }
  }
  const currentWeekBias = Array.from(uniqueBiasBySymbol.values()).sort((a, b) =>
    a.symbol.localeCompare(b.symbol),
  );

  return (
    <div className="space-y-6">
      {/* ── Status card ─────────────────────── */}
      <div className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] p-5">
        <div className="flex items-center gap-4">
          <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-[color:var(--muted)]">
            System Status
          </h3>
          <span className="text-xs text-[color:var(--muted)]">
            {lifecycle}
          </span>
        </div>
        <div className="mt-3 grid gap-4 sm:grid-cols-3">
          <div>
            <p className="text-xs text-[color:var(--muted)]">Open Positions</p>
            <p className="text-lg font-semibold text-[var(--foreground)]">
              {openTrades.length}
            </p>
          </div>
          <div>
            <p className="text-xs text-[color:var(--muted)]">Bias Pairs This Week</p>
            <p className="text-lg font-semibold text-[var(--foreground)]">
              {currentWeekBias.filter((b) => b.direction === "LONG" || b.direction === "SHORT").length}
            </p>
          </div>
          <div>
            <p className="text-xs text-[color:var(--muted)]">Strategy</p>
            <p className="text-lg font-semibold text-[var(--foreground)]">
              Katarakti v1
            </p>
          </div>
        </div>
      </div>

      {/* ── Active positions ────────────────── */}
      {openTrades.length > 0 && (
        <div className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] p-5">
          <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-[color:var(--muted)]">
            Active Positions
          </h3>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[var(--panel-border)] text-left text-[color:var(--muted)]">
                  <th className="pb-2 pr-4">Symbol</th>
                  <th className="pb-2 pr-4">Dir</th>
                  <th className="pb-2 pr-4">Entry</th>
                  <th className="pb-2 pr-4">Stop</th>
                  <th className="pb-2 pr-4">Risk %</th>
                  <th className="pb-2 pr-4">Entry Time</th>
                </tr>
              </thead>
              <tbody>
                {openTrades.map((trade) => (
                  <tr
                    key={trade.id}
                    className="border-b border-[var(--panel-border)]/50"
                  >
                    <td className="py-2 pr-4 font-medium text-[var(--foreground)]">
                      {trade.symbol}
                    </td>
                    <td className={`py-2 pr-4 font-semibold ${directionTone(trade.direction)}`}>
                      {trade.direction}
                    </td>
                    <td className="py-2 pr-4">{formatPrice(trade.entry_price)}</td>
                    <td className="py-2 pr-4">{formatPrice(trade.stop_price)}</td>
                    <td className="py-2 pr-4">{formatPct(trade.risk_pct)}</td>
                    <td className="py-2 pr-4 text-[color:var(--muted)]">
                      {formatShortDateTime(trade.entry_time_utc)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Bias grid ───────────────────────── */}
      <div className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] p-5">
        <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-[color:var(--muted)]">
          Weekly Bias Grid
        </h3>
        {currentWeekBias.length === 0 ? (
          <p className="mt-3 text-xs text-[color:var(--muted)]">
            No bias data for current week.
          </p>
        ) : (
          <div className="mt-3 grid gap-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-9">
            {currentWeekBias.map((bias) => (
              <div
                key={`${bias.symbol}-${bias.bias_system}`}
                className="rounded-lg border border-[var(--panel-border)]/50 bg-[var(--panel)]/50 p-2 text-center"
              >
                <p className="text-[10px] font-semibold text-[var(--foreground)]">
                  {bias.symbol}
                </p>
                <p
                  className={`text-xs font-bold ${directionTone(bias.direction)}`}
                >
                  {bias.direction}
                </p>
                {bias.tier && (
                  <p className="text-[9px] text-[color:var(--muted)]">
                    T{bias.tier}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

