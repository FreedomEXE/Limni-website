/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: MaeScatterPlot.tsx
 *
 * Description:
 * SVG scatter plot of Maximum Adverse Excursion (MAE) vs. trade result.
 * Each dot is one trade — x-axis is MAE (worst intra-trade drawdown),
 * y-axis is final return. Helps visualize risk management quality and
 * whether losers are controlled or blow through stops.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/
"use client";

export type MaeTrade = {
  pair: string;
  returnPct: number;
  maePct: number;
};

export default function MaeScatterPlot({ trades }: { trades: MaeTrade[] }) {
  if (trades.length < 3) return null;

  const chartW = 600;
  const chartH = 320;
  const padL = 55;
  const padR = 20;
  const padT = 20;
  const padB = 45;
  const plotW = chartW - padL - padR;
  const plotH = chartH - padT - padB;

  const maeValues = trades.map((t) => t.maePct);
  const returnValues = trades.map((t) => t.returnPct);

  const maeMax = Math.max(...maeValues, 0.5);
  const retMin = Math.min(...returnValues, -0.5);
  const retMax = Math.max(...returnValues, 0.5);
  const retRange = retMax - retMin;

  const toX = (mae: number) => padL + (mae / maeMax) * plotW;
  const toY = (ret: number) => padT + plotH - ((ret - retMin) / retRange) * plotH;

  const zeroY = toY(0);
  const wins = trades.filter((t) => t.returnPct > 0).length;
  const avgMae = maeValues.reduce((s, v) => s + v, 0) / trades.length;

  return (
    <div className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)]/70 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-[color:var(--muted)]">
          MAE vs. Return
        </h3>
        <div className="flex gap-4 text-[10px] uppercase tracking-[0.08em] text-[color:var(--muted)]">
          <span>
            {trades.length} trades · {wins}W / {trades.length - wins}L
          </span>
          <span>
            Avg MAE: <strong className="text-red-400">{avgMae.toFixed(2)}%</strong>
          </span>
        </div>
      </div>
      <svg
        viewBox={`0 0 ${chartW} ${chartH}`}
        className="w-full"
        preserveAspectRatio="xMidYMid meet"
      >
        {/* Zero return line */}
        <line
          x1={padL}
          y1={zeroY}
          x2={padL + plotW}
          y2={zeroY}
          stroke="var(--muted)"
          strokeWidth={1}
          strokeDasharray="4,3"
          opacity={0.3}
        />

        {/* Average MAE vertical line */}
        <line
          x1={toX(avgMae)}
          y1={padT}
          x2={toX(avgMae)}
          y2={padT + plotH}
          stroke="#f43f5e"
          strokeWidth={1}
          strokeDasharray="3,2"
          opacity={0.4}
        />

        {/* Dots */}
        {trades.map((t, i) => {
          const cx = toX(t.maePct);
          const cy = toY(t.returnPct);
          const isWin = t.returnPct > 0;
          return (
            <circle
              key={i}
              cx={cx}
              cy={cy}
              r={4}
              fill={isWin ? "#10b981" : "#f43f5e"}
              opacity={0.65}
              stroke={isWin ? "#059669" : "#e11d48"}
              strokeWidth={0.5}
            >
              <title>
                {t.pair}: {t.returnPct >= 0 ? "+" : ""}{t.returnPct.toFixed(2)}% (MAE: {t.maePct.toFixed(2)}%)
              </title>
            </circle>
          );
        })}

        {/* Y-axis label */}
        <text
          x={14}
          y={padT + plotH / 2}
          textAnchor="middle"
          fill="var(--muted)"
          fontSize={10}
          transform={`rotate(-90, 14, ${padT + plotH / 2})`}
        >
          Return %
        </text>

        {/* X-axis label */}
        <text
          x={padL + plotW / 2}
          y={chartH - 5}
          textAnchor="middle"
          fill="var(--muted)"
          fontSize={10}
        >
          MAE % (worst intra-trade drawdown)
        </text>

        {/* Y-axis ticks */}
        {[retMin, retMin + retRange * 0.25, retMin + retRange * 0.5, retMin + retRange * 0.75, retMax].map(
          (val, i) => (
            <text
              key={i}
              x={padL - 6}
              y={toY(val) + 3}
              textAnchor="end"
              fill="var(--muted)"
              fontSize={9}
            >
              {val.toFixed(1)}%
            </text>
          ),
        )}

        {/* X-axis ticks */}
        {[0, maeMax * 0.25, maeMax * 0.5, maeMax * 0.75, maeMax].map((val, i) => (
          <text
            key={i}
            x={toX(val)}
            y={padT + plotH + 16}
            textAnchor="middle"
            fill="var(--muted)"
            fontSize={9}
          >
            {val.toFixed(1)}%
          </text>
        ))}
      </svg>
    </div>
  );
}
