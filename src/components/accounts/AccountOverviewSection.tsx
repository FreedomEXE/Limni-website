"use client";

import EquityCurveChart from "@/components/research/EquityCurveChart";
import SummaryCard from "@/components/accounts/SummaryCard";

type AccountOverviewSectionProps = {
  equity: {
    title: string;
    points: { ts_utc: string; equity_pct: number; lock_pct: number | null }[];
  };
  overview: {
    openPositions: number;
    plannedCount: number;
    mappingCount: number;
    plannedNote?: string | null;
  };
};

export default function AccountOverviewSection({
  equity,
  overview,
}: AccountOverviewSectionProps) {
  return (
    <div className="space-y-4">
      <EquityCurveChart points={equity.points} title={equity.title} interactive={false} />
      <div className="grid gap-4 md:grid-cols-3">
        <SummaryCard
          label="Open Positions"
          value={overview.openPositions}
          hint="Live positions right now"
        />
        <SummaryCard
          label="Planned Trades"
          value={overview.plannedCount}
          hint={overview.plannedNote ?? "Upcoming basket trades"}
        />
        <SummaryCard
          label="Mappings"
          value={overview.mappingCount}
          hint="Instrument availability"
        />
      </div>
    </div>
  );
}
