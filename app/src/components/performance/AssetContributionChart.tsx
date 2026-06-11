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
  id?: string;
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
  points: Array<{ ts_utc?: string; equity_pct: number }>;
};

export default function AssetContributionChart({
  series,
  bars: overrideBars,
}: {
  series: SimulationSeries[];
  bars?: Array<{ id: string; label: string; returnPct: number; color?: string }>;
}) {
  const assetSeries = series.filter((s) => s.id.startsWith("asset:"));
  if (assetSeries.length === 0 && (!overrideBars || overrideBars.length === 0)) return null;

  const bars: AssetBar[] = overrideBars?.map((bar) => {
    const assetId = bar.id.replace("asset:", "");
    return {
      id: bar.id,
      label: bar.label,
      returnPct: bar.returnPct,
      color: bar.color ?? ASSET_COLORS[assetId] ?? "#94a3b8",
    };
  }) ?? assetSeries.map((s) => {
    const assetId = s.id.replace("asset:", "");
    const lastPoint = filterMarketHours(s.points).at(-1);
    return {
      id: s.id,
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
            <div key={bar.id ?? bar.label}>
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

function isWeekendPoint(tsUtc: string): boolean {
  const d = new Date(tsUtc);
  const day = d.getUTCDay();
  if (day === 6) return true;
  if (day === 0 && d.getUTCHours() < 21) return true;
  return false;
}

function filterMarketHours<T extends { ts_utc?: string }>(points: T[]): T[] {
  const now = Date.now();
  const filtered = points.filter((point) => {
    if (!point.ts_utc) return true;
    const ts = new Date(point.ts_utc).getTime();
    return Number.isFinite(ts) && ts <= now && !isWeekendPoint(point.ts_utc);
  });
  if (filtered.length > 0) return filtered;
  const pastPoints = points.filter((point) => {
    if (!point.ts_utc) return true;
    const ts = new Date(point.ts_utc).getTime();
    return Number.isFinite(ts) && ts <= now;
  });
  if (pastPoints.length > 0) return pastPoints;
  return points.length > 0 ? [points[0] as T] : [];
}
