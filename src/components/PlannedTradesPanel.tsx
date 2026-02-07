import { formatCurrencySafe } from "@/lib/formatters";
import { weekLabelFromOpen } from "@/lib/performanceSnapshots";
import type { PlannedPair } from "@/lib/plannedTrades";

type PlannedTradesPanelProps = {
  title?: string;
  weekOpenUtc: string;
  currency: string;
  accountBalance: number;
  pairs: PlannedPair[];
  note?: string | null;
  sizeLabel?: string;
  sizeBySymbol?: Record<string, number>;
  showOnePercent?: boolean;
  showLegDetails?: boolean;
  showLegCount?: boolean;
  headerMeta?: string;
  pairMeta?: Record<string, string>;
  openSymbols?: Record<string, boolean>;
};

function netLabel(net: number) {
  if (net > 0) return `+${net}`;
  if (net < 0) return `${net}`;
  return "0";
}

function netTone(net: number) {
  if (net > 0) return "text-emerald-700";
  if (net < 0) return "text-rose-700";
  return "text-[color:var(--muted)]";
}

export default function PlannedTradesPanel({
  title = "Planned trades",
  weekOpenUtc,
  currency,
  accountBalance,
  pairs,
  note,
  sizeLabel = "legs",
  sizeBySymbol,
  showOnePercent = true,
  showLegDetails = true,
  showLegCount,
  headerMeta,
  pairMeta,
  openSymbols,
}: PlannedTradesPanelProps) {
  const onePercentValue = accountBalance > 0 ? accountBalance * 0.01 : 0;
  const shouldShowLegCount = showLegCount ?? showLegDetails;
  return (
    <section className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] p-6 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-[var(--foreground)]">{title}</h2>
          <p className="text-sm text-[color:var(--muted)]">
            {weekLabelFromOpen(weekOpenUtc)} · {pairs.length} qualified pair{pairs.length !== 1 ? "s" : ""}
          </p>
        </div>
        {showOnePercent ? (
          <div className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
            1% move = {formatCurrencySafe(onePercentValue, currency)}
          </div>
        ) : headerMeta ? (
          <div className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
            {headerMeta}
          </div>
        ) : null}
      </div>

      {note ? (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50/60 p-3 text-xs text-amber-700">
          {note}
        </div>
      ) : null}

      {pairs.length === 0 ? (
        <div className="mt-6 rounded-xl border border-dashed border-[var(--panel-border)] bg-[var(--panel)]/60 p-6 text-center text-sm text-[color:var(--muted)]">
          No qualified trades this week.
        </div>
      ) : (
        <div className="mt-6 space-y-3">
          {pairs.map((pair) => (
            <details
              key={`${pair.assetClass}-${pair.symbol}`}
              className="rounded-xl border border-[var(--panel-border)] bg-[var(--panel)]/70"
            >
              {(() => {
                const isOpen = openSymbols?.[pair.symbol] ?? false;
                const stateLabel = isOpen ? "OPEN" : "PENDING";
                const stateTone = isOpen
                  ? "bg-emerald-100 text-emerald-700"
                  : "bg-amber-100 text-amber-700";
                return (
              <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3">
                <div className="flex items-center gap-4">
                  <span className="text-sm font-semibold text-[var(--foreground)]">
                    {pair.symbol}
                  </span>
                  <span className={`rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] ${stateTone}`}>
                    {stateLabel}
                  </span>
                  <span className={`text-sm font-semibold ${netTone(pair.net)}`}>
                    {sizeBySymbol
                      ? `Net ${sizeLabel} ${sizeBySymbol[pair.symbol]?.toFixed(2) ?? "0.00"}`
                      : `Net legs ${netLabel(pair.net)}`}
                  </span>
                  {shouldShowLegCount ? (
                    <span className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
                      {pair.legs.length} legs
                    </span>
                  ) : null}
                </div>
                {showOnePercent ? (
                  <span className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
                    1% move {formatCurrencySafe(onePercentValue, currency)}
                  </span>
                ) : pairMeta?.[pair.symbol] ? (
                  <span className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
                    {pairMeta[pair.symbol]}
                  </span>
                ) : null}
              </summary>
                );
              })()}
              {showLegDetails ? (
                <div className="border-t border-[var(--panel-border)] px-4 py-3">
                  <div className="grid gap-2 text-xs md:grid-cols-2">
                    {pair.legs.map((leg, index) => (
                      <div
                        key={`${pair.symbol}-${leg.model}-${index}`}
                        className="flex items-center justify-between rounded-lg border border-[var(--panel-border)] bg-[var(--panel)] px-3 py-2"
                      >
                        <div>
                          <p className="text-[10px] uppercase tracking-[0.2em] text-[color:var(--muted)]">
                            {leg.model}
                          </p>
                          <p
                            className={`text-sm font-semibold ${
                              leg.direction === "LONG"
                                ? "text-emerald-700"
                                : leg.direction === "SHORT"
                                  ? "text-rose-700"
                                  : "text-[color:var(--muted)]"
                            }`}
                          >
                            {leg.direction}
                          </p>
                        </div>
                        <div className="text-right">
                          {showOnePercent ? (
                            <>
                              <p className="text-[10px] uppercase tracking-[0.2em] text-[color:var(--muted)]">
                                1% move
                              </p>
                              <p className="text-sm font-semibold text-[var(--foreground)]">
                                {formatCurrencySafe(onePercentValue, currency)}
                              </p>
                            </>
                          ) : null}
                          {sizeBySymbol ? (
                            <p className="mt-1 text-[10px] uppercase tracking-[0.2em] text-[color:var(--muted)]">
                              Size {sizeBySymbol[pair.symbol]?.toFixed(2) ?? "0.00"} {sizeLabel}
                            </p>
                          ) : null}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </details>
          ))}
        </div>
      )}
    </section>
  );
}
