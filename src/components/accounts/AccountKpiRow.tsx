import KpiCard from "@/components/metrics/KpiCard";
import KpiGroup from "@/components/metrics/KpiGroup";
import { formatCurrencySafe } from "@/lib/formatters";
import Link from "next/link";

type AccountKpiRowProps = {
  weeklyPnlPct: number;
  maxDrawdownPct: number;
  tradesThisWeek: number;
  equity: number;
  balance: number;
  currency: string;
  scopeLabel: string;
  detailsHref?: string;
};

const percentFormatter = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function formatPercent(value: number) {
  if (!Number.isFinite(value)) {
    return "0.00%";
  }
  const sign = value > 0 ? "+" : value < 0 ? "" : "";
  return `${sign}${percentFormatter.format(value)}%`;
}

export default function AccountKpiRow({
  weeklyPnlPct,
  maxDrawdownPct,
  tradesThisWeek,
  equity,
  balance,
  currency,
  scopeLabel,
  detailsHref,
}: AccountKpiRowProps) {
  return (
    <KpiGroup title="Primary" description="Week-specific account highlights" columns={4}>
      {detailsHref ? (
        <Link href={detailsHref} className="block">
          <KpiCard
            label="Weekly PnL"
            value={formatPercent(weeklyPnlPct)}
            tone={weeklyPnlPct >= 0 ? "positive" : "negative"}
            emphasis="primary"
            hint={scopeLabel}
          />
        </Link>
      ) : (
        <KpiCard
          label="Weekly PnL"
          value={formatPercent(weeklyPnlPct)}
          tone={weeklyPnlPct >= 0 ? "positive" : "negative"}
          emphasis="primary"
          hint={scopeLabel}
        />
      )}
      {detailsHref ? (
        <Link href={detailsHref} className="block">
          <KpiCard
            label="Max DD (week)"
            value={formatPercent(maxDrawdownPct)}
            tone={maxDrawdownPct > 0 ? "negative" : "neutral"}
            hint={scopeLabel}
          />
        </Link>
      ) : (
        <KpiCard
          label="Max DD (week)"
          value={formatPercent(maxDrawdownPct)}
          tone={maxDrawdownPct > 0 ? "negative" : "neutral"}
          hint={scopeLabel}
        />
      )}
      {detailsHref ? (
        <Link href={detailsHref} className="block">
          <KpiCard label="Trades (week)" value={`${tradesThisWeek}`} hint={scopeLabel} />
        </Link>
      ) : (
        <KpiCard label="Trades (week)" value={`${tradesThisWeek}`} hint={scopeLabel} />
      )}
      {detailsHref ? (
        <Link href={detailsHref} className="block">
          <KpiCard
            label="Equity"
            value={formatCurrencySafe(equity, currency)}
            hint={`Balance ${formatCurrencySafe(balance, currency)}`}
          />
        </Link>
      ) : (
        <KpiCard
          label="Equity"
          value={formatCurrencySafe(equity, currency)}
          hint={`Balance ${formatCurrencySafe(balance, currency)}`}
        />
      )}
    </KpiGroup>
  );
}
