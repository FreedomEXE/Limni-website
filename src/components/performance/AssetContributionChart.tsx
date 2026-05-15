/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: AssetContributionChart.tsx
 *
 * Description:
 * Horizontal bar chart showing return contribution by asset class
 * (FX, Indices, Commodities, Crypto). Derives data from simulation
 * series with "asset:" prefixed IDs.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/
"use client";

type AssetBar = {
  label: string;
  returnPct: number;
  color: string;
};

const ASSET_COLORS: Record<string, string> = {
  fx: "#10b981",
  indices: "#6366f1",
  commodities: "#f59e0b",
  crypto: "#8b5cf6",
};

export type SimulationSeries = {
  id: string;
  label: string;
  color?: string;
  points: Array<{ equity_pct: number }>;
};

export default function AssetContributionChart({ series }: { series: SimulationSeries[] }) {
  const assetSeries = series.filter((s) => s.id.startsWith("asset:"));
  if (assetSeries.length === 0) return null;

  const bars: AssetBar[] = assetSeries.map((s) => {
    const assetId = s.id.replace("asset:", "");
    const lastPoint = s.points.at(-1);
    return {
      label: s.label,
      returnPct: lastPoint?.equity_pct ?? 0,
      color: ASSET_COLORS[assetId] ?? s.color ?? "#94a3b8",
    };
  });

  const maxAbs = Math.max(...bars.map((b) => Math.abs(b.returnPct)), 0.01);
  const totalReturn = bars.reduce((s, b) => s + b.returnPct, 0);

  return (
    <div className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)]/70 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-[color:var(--muted)]">
          Asset Contribution
        </h3>
        <span
          className={`text-sm font-bold ${totalReturn >= 0 ? "text-lime-400" : "text-red-400"}`}
        >
          {totalReturn >= 0 ? "+" : ""}
          {totalReturn.toFixed(2)}%
        </span>
      </div>
      <div className="space-y-2.5">
        {bars.map((bar) => {
          const widthPct = Math.min((Math.abs(bar.returnPct) / maxAbs) * 100, 100);
          const isPositive = bar.returnPct >= 0;
          return (
            <div key={bar.label}>
              <div className="mb-1 flex items-center justify-between text-xs">
                <span className="font-semibold text-[var(--foreground)]">{bar.label}</span>
                <span className={`font-bold ${isPositive ? "text-lime-400" : "text-red-400"}`}>
                  {isPositive ? "+" : ""}
                  {bar.returnPct.toFixed(2)}%
                </span>
              </div>
              <div className="h-2.5 w-full overflow-hidden rounded-full bg-[var(--panel-border)]">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${widthPct}%`,
                    backgroundColor: isPositive ? bar.color : "#f43f5e",
                    opacity: isPositive ? 1 : 0.7,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
