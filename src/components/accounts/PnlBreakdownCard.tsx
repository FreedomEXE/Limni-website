"use client";

type PnlBreakdownCardProps = {
  grossProfit: number;
  swap: number;
  commission: number;
  net: number;
  currency: string;
};

export default function PnlBreakdownCard({
  grossProfit,
  swap,
  commission,
  net,
  currency,
}: PnlBreakdownCardProps) {
  const formatCurrency = (val: number) => {
    const sign = val >= 0 ? "+" : "";
    return `${sign}${val.toFixed(2)}`;
  };

  const getColorClass = (val: number) => {
    if (val > 0) return "text-emerald-700";
    if (val < 0) return "text-rose-700";
    return "text-[color:var(--muted)]";
  };

  return (
    <div className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)]/80 p-6">
      <div className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--foreground)]/80">
        P&L Breakdown
      </div>
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-[color:var(--muted)]">Gross Profit</span>
          <span className={`text-lg font-semibold ${getColorClass(grossProfit)}`}>
            {currency}
            {formatCurrency(grossProfit)}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-[color:var(--muted)]">Swap</span>
          <span className={`text-lg font-semibold ${getColorClass(swap)}`}>
            {currency}
            {formatCurrency(swap)}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-[color:var(--muted)]">Commission</span>
          <span className={`text-lg font-semibold ${getColorClass(commission)}`}>
            {currency}
            {formatCurrency(commission)}
          </span>
        </div>
        <div className="border-t border-[var(--panel-border)] pt-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-[var(--foreground)]">Net P&L</span>
            <span className={`text-xl font-bold ${getColorClass(net)}`}>
              {currency}
              {formatCurrency(net)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
