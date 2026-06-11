/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: ReturnDistribution.tsx
 *
 * Description:
 * SVG histogram of weekly return distribution. Bins returns into
 * equal-width buckets and renders a bar chart with green/red coloring.
 * Shows mean, median, and standard deviation overlay.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/
"use client";

type WeekReturn = {
  weekOpenUtc: string;
  returnPct: number;
};

function computeBins(returns: number[], binCount: number) {
  if (returns.length === 0) return { bins: [], binWidth: 0, min: 0 };
  const min = Math.min(...returns);
  const max = Math.max(...returns);
  const range = max - min;
  if (range === 0) return { bins: [{ start: min, end: min, count: returns.length }], binWidth: 0, min };
  const binWidth = range / binCount;
  const bins = Array.from({ length: binCount }, (_, i) => ({
    start: min + i * binWidth,
    end: min + (i + 1) * binWidth,
    count: 0,
  }));
  for (const r of returns) {
    const idx = Math.min(Math.floor((r - min) / binWidth), binCount - 1);
    bins[idx].count += 1;
  }
  return { bins, binWidth, min };
}

export default function ReturnDistribution({ weeks }: { weeks: WeekReturn[] }) {
  if (weeks.length < 4) return null;

  const returns = weeks.map((w) => w.returnPct).sort((a, b) => a - b);
  const binCount = Math.min(Math.max(Math.ceil(Math.sqrt(returns.length)), 6), 20);
  const { bins } = computeBins(returns, binCount);
  if (bins.length === 0) return null;

  const maxCount = Math.max(...bins.map((b) => b.count), 1);
  const mean = returns.reduce((s, r) => s + r, 0) / returns.length;
  const median = returns.length % 2 === 0
    ? (returns[returns.length / 2 - 1] + returns[returns.length / 2]) / 2
    : returns[Math.floor(returns.length / 2)];
  const variance = returns.reduce((s, r) => s + (r - mean) ** 2, 0) / (returns.length - 1);
  const stdDev = Math.sqrt(variance);

  const chartW = 600;
  const chartH = 200;
  const padL = 50;
  const padR = 20;
  const padT = 10;
  const padB = 40;
  const plotW = chartW - padL - padR;
  const plotH = chartH - padT - padB;
  const barGap = 1;
  const barW = (plotW - barGap * (bins.length - 1)) / bins.length;

  const globalMin = bins[0].start;
  const globalMax = bins[bins.length - 1].end;
  const toX = (v: number) => padL + ((v - globalMin) / (globalMax - globalMin)) * plotW;
  const meanX = toX(mean);

  return (
    <div className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)]/70 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-[color:var(--muted)]">
          Return Distribution
        </h3>
        <div className="flex gap-4 text-[10px] uppercase tracking-[0.08em] text-[color:var(--muted)]">
          <span>
            Mean:{" "}
            <strong className={mean >= 0 ? "text-lime-400" : "text-red-400"}>
              {mean >= 0 ? "+" : ""}{mean.toFixed(2)}%
            </strong>
          </span>
          <span>
            Median:{" "}
            <strong className={median >= 0 ? "text-lime-400" : "text-red-400"}>
              {median >= 0 ? "+" : ""}{median.toFixed(2)}%
            </strong>
          </span>
          <span>
            StdDev: <strong>{stdDev.toFixed(2)}</strong>
          </span>
        </div>
      </div>
      <svg
        viewBox={`0 0 ${chartW} ${chartH}`}
        className="w-full"
        preserveAspectRatio="xMidYMid meet"
      >
        {bins.map((bin, i) => {
          const x = padL + i * (barW + barGap);
          const h = (bin.count / maxCount) * plotH;
          const y = padT + plotH - h;
          const midVal = (bin.start + bin.end) / 2;
          const fill = midVal >= 0 ? "#10b981" : "#f43f5e";
          return (
            <g key={i}>
              <rect
                x={x}
                y={y}
                width={barW}
                height={h}
                rx={2}
                fill={fill}
                opacity={0.7}
              />
              {bin.count > 0 && (
                <text
                  x={x + barW / 2}
                  y={y - 4}
                  textAnchor="middle"
                  fill="var(--muted)"
                  fontSize={9}
                >
                  {bin.count}
                </text>
              )}
            </g>
          );
        })}

        {/* Zero line */}
        {globalMin < 0 && globalMax > 0 && (
          <line
            x1={toX(0)}
            y1={padT}
            x2={toX(0)}
            y2={padT + plotH}
            stroke="var(--muted)"
            strokeWidth={1}
            strokeDasharray="4,3"
            opacity={0.4}
          />
        )}

        {/* Mean line */}
        <line
          x1={meanX}
          y1={padT}
          x2={meanX}
          y2={padT + plotH + 4}
          stroke="#60a5fa"
          strokeWidth={1.5}
          strokeDasharray="3,2"
        />
        <text
          x={meanX}
          y={padT + plotH + 16}
          textAnchor="middle"
          fill="#60a5fa"
          fontSize={9}
        >
          μ
        </text>

        {/* X-axis labels — show a few bin edges */}
        {bins
          .filter((_, i) => i % Math.max(1, Math.floor(bins.length / 5)) === 0 || i === bins.length - 1)
          .map((bin, i) => {
            const x = toX(bin.start);
            return (
              <text
                key={i}
                x={x}
                y={padT + plotH + 28}
                textAnchor="middle"
                fill="var(--muted)"
                fontSize={9}
              >
                {bin.start.toFixed(1)}%
              </text>
            );
          })}
      </svg>
    </div>
  );
}
