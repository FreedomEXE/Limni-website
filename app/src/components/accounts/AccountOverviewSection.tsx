"use client";

import EquityCurveChart from "@/components/research/EquityCurveChart";
import SummaryCard from "@/components/accounts/SummaryCard";
import PnlBreakdownCard from "@/components/accounts/PnlBreakdownCard";

type AccountOverviewSectionProps = {
  equity: {
    title: string;
    points: {
      ts_utc: string;
      equity_pct: number;
      lock_pct: number | null;
      equity_usd?: number;
      static_baseline_usd?: number | null;
      static_drawdown_pct?: number;
      trailing_drawdown_pct?: number;
    }[];
    watermarkText?: string;
  };
  overview: {
    openPositions: number;
    closedTrades: number;
    secondaryCount: number;
    secondaryLabel: string;
    secondaryHint?: string | null;
  };
  pnlBreakdown?: {
    grossProfit: number;
    swap: number;
    commission: number;
    net: number;
    currency: string;
  } | null;
};

export default function AccountOverviewSection({
  equity,
  overview,
  pnlBreakdown,
}: AccountOverviewSectionProps) {
  return (
    <div className="space-y-4">
      <EquityCurveChart
        points={equity.points}
        title={equity.title}
        interactive={false}
        watermarkText={equity.watermarkText}
      />
      <div className="grid gap-4 md:grid-cols-3">
        <SummaryCard
          label="Open Positions"
          value={overview.openPositions}
          hint="Live positions right now"
        />
        <SummaryCard
          label="Closed Trades"
          value={overview.closedTrades}
          hint="Closed trades in the selected period"
        />
        <SummaryCard
          label={overview.secondaryLabel}
          value={overview.secondaryCount}
          hint={overview.secondaryHint ?? "Additional reporting context"}
        />
      </div>
      {pnlBreakdown ? (
        <PnlBreakdownCard
          grossProfit={pnlBreakdown.grossProfit}
          swap={pnlBreakdown.swap}
          commission={pnlBreakdown.commission}
          net={pnlBreakdown.net}
          currency={pnlBreakdown.currency}
        />
      ) : null}
    </div>
  );
}
