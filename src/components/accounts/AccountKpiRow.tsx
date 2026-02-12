import KpiCard from "@/components/metrics/KpiCard";
import KpiGroup from "@/components/metrics/KpiGroup";
import { formatCurrencySafe } from "@/lib/formatters";
import Link from "next/link";

type AccountKpiRowProps = {
  weeklyPnlPct: number;
  maxDrawdownPct: number;
  tradesThisWeek: number;
  openPositions?: number;
  equity: number;
  balance: number;
  currency: string;
  scopeLabel: string;
  detailsHref?: string;
  onOpenDetails?: () => void;
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
  openPositions,
  equity,
  balance,
  currency,
  scopeLabel,
  detailsHref,
  onOpenDetails,
}: AccountKpiRowProps) {
  const isAllScope = scopeLabel.toLowerCase().startsWith("all");
  const pnlLabel = isAllScope ? "All-time PnL" : "Weekly PnL";
  const activityLabel = isAllScope ? "Open Positions" : "Trades (week)";
  const activityValue =
    isAllScope && typeof openPositions === "number" ? openPositions : tradesThisWeek;
  const activityHint = isAllScope ? "Live snapshot" : scopeLabel;

  const CardWrapper = ({
    children,
  }: {
    children: React.ReactNode;
  }) => {
    if (onOpenDetails) {
      return (
        <button type="button" onClick={onOpenDetails} className="text-left">
          {children}
        </button>
      );
    }
    if (detailsHref) {
      return (
        <Link href={detailsHref} className="block">
          {children}
        </Link>
      );
    }
    return <>{children}</>;
  };
  return (
    <KpiGroup title="Primary" description="Week-specific account highlights" columns={4}>
      <CardWrapper>
        <KpiCard
          label={pnlLabel}
          value={formatPercent(weeklyPnlPct)}
          tone={weeklyPnlPct >= 0 ? "positive" : "negative"}
          emphasis="primary"
          hint={scopeLabel}
        />
      </CardWrapper>
      <CardWrapper>
        <KpiCard
          label="Max DD (week)"
          value={formatPercent(maxDrawdownPct)}
          tone={maxDrawdownPct > 0 ? "negative" : "neutral"}
          hint={scopeLabel}
        />
      </CardWrapper>
      <CardWrapper>
        <KpiCard label={activityLabel} value={`${activityValue}`} hint={activityHint} />
      </CardWrapper>
      <CardWrapper>
        <KpiCard
          label="Equity"
          value={formatCurrencySafe(equity, currency)}
          hint={`Balance ${formatCurrencySafe(balance, currency)}`}
        />
      </CardWrapper>
    </KpiGroup>
  );
}
