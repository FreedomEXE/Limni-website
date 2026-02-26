/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: MarketDataTab.tsx
 *
 * Description:
 * Market data tab for Bitget Bot v2 with custom SVG charts for open
 * interest and funding, trade-entry overlays, and liquidation summary cards.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

"use client";

import { useMemo } from "react";
import {
  toNumber,
  toIsoString,
  formatCompactUsd,
  type FundingSnapshotRow,
  type LiquidationSnapshotRow,
  type OiSnapshotRow,
  type BitgetTradeRow,
} from "@/components/bitget-bot/types";

type MarketDataTabProps = {
  oi: OiSnapshotRow[];
  funding: FundingSnapshotRow[];
  liquidation: LiquidationSnapshotRow[];
  trades: BitgetTradeRow[];
};

type SeriesPoint = {
  ts: number;
  value: number;
};

const SERIES_COLORS: Record<"BTC" | "ETH", string> = {
  BTC: "#f59e0b",
  ETH: "#60a5fa",
};

function parseSeries<T extends { symbol: string; snapshot_time_utc: unknown }>(
  rows: T[],
  getValue: (row: T) => number | null,
) {
  const out: Record<"BTC" | "ETH", SeriesPoint[]> = { BTC: [], ETH: [] };
  for (const row of rows) {
    if (row.symbol !== "BTC" && row.symbol !== "ETH") continue;
    const iso = toIsoString(row.snapshot_time_utc);
    const ts = iso ? Date.parse(iso) : NaN;
    const value = getValue(row);
    if (!Number.isFinite(ts) || value === null) continue;
    out[row.symbol].push({ ts, value });
  }
  out.BTC.sort((a, b) => a.ts - b.ts);
  out.ETH.sort((a, b) => a.ts - b.ts);
  return out;
}

function parseTradeEntryTimes(trades: BitgetTradeRow[]) {
  return trades
    .map((trade) => {
      const iso = toIsoString(trade.entry_time_utc);
      const ts = iso ? Date.parse(iso) : NaN;
      return Number.isFinite(ts) ? ts : null;
    })
    .filter((ts): ts is number => ts !== null)
    .sort((a, b) => a - b);
}

function fmtPercent(value: number, digits = 4) {
  return `${value.toFixed(digits)}%`;
}

function TimeSeriesChart({
  title,
  subtitle,
  series,
  entries,
  valueFormatter,
  zeroLine,
}: {
  title: string;
  subtitle: string;
  series: Record<"BTC" | "ETH", SeriesPoint[]>;
  entries: number[];
  valueFormatter: (value: number) => string;
  zeroLine?: boolean;
}) {
  const width = 940;
  const height = 280;
  const px = 46;
  const py = 24;
  const cw = width - px * 2;
  const ch = height - py * 2;

  const combined = [...series.BTC, ...series.ETH];
  if (!combined.length) {
    return (
      <article className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] p-4">
        <h4 className="text-sm font-semibold uppercase tracking-[0.2em] text-[color:var(--muted)]">{title}</h4>
        <p className="mt-1 text-xs text-[color:var(--muted)]">{subtitle}</p>
        <div className="mt-4 rounded-xl border border-dashed border-[var(--panel-border)] p-6 text-sm text-[color:var(--muted)]">
          No data available.
        </div>
      </article>
    );
  }

  const minTs = Math.min(...combined.map((point) => point.ts));
  const maxTs = Math.max(...combined.map((point) => point.ts));
  const spanTs = Math.max(1, maxTs - minTs);

  const minValue = Math.min(...combined.map((point) => point.value));
  const maxValue = Math.max(...combined.map((point) => point.value));
  const valueSpan = Math.max(1e-6, maxValue - minValue);
  const pad = valueSpan * 0.08;
  const domainMin = minValue - pad;
  const domainMax = maxValue + pad;
  const domainSpan = Math.max(1e-6, domainMax - domainMin);

  const toX = (ts: number) => px + ((ts - minTs) / spanTs) * cw;
  const toY = (value: number) => py + ((domainMax - value) / domainSpan) * ch;

  const linePath = (points: SeriesPoint[]) =>
    points
      .map((point, index) => `${index === 0 ? "M" : "L"} ${toX(point.ts).toFixed(2)} ${toY(point.value).toFixed(2)}`)
      .join(" ");

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((r) => {
    const v = domainMin + domainSpan * r;
    return { y: toY(v), value: v };
  });
  const xTicks = [0, 0.25, 0.5, 0.75, 1].map((r) => {
    const ts = minTs + spanTs * r;
    return { x: toX(ts), label: new Date(ts).toLocaleDateString() };
  });

  const zeroY = toY(0);
  const showZero = Boolean(zeroLine) && domainMin <= 0 && domainMax >= 0;

  const btcPath = linePath(series.BTC);
  const ethPath = linePath(series.ETH);

  const fundingCrossovers = zeroLine
    ? [series.BTC, series.ETH].flatMap((points) => {
      const crosses: SeriesPoint[] = [];
      for (let i = 1; i < points.length; i += 1) {
        const prev = points[i - 1];
        const curr = points[i];
        if ((prev.value <= 0 && curr.value > 0) || (prev.value >= 0 && curr.value < 0)) {
          crosses.push(curr);
        }
      }
      return crosses;
    })
    : [];

  return (
    <article className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h4 className="text-sm font-semibold uppercase tracking-[0.2em] text-[color:var(--muted)]">{title}</h4>
          <p className="text-xs text-[color:var(--muted)]">{subtitle}</p>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <span className="inline-flex items-center gap-2 text-[color:var(--muted)]">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: SERIES_COLORS.BTC }} />BTC
          </span>
          <span className="inline-flex items-center gap-2 text-[color:var(--muted)]">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: SERIES_COLORS.ETH }} />ETH
          </span>
        </div>
      </div>
      <div className="mt-3 overflow-hidden rounded-xl border border-[var(--panel-border)] bg-[var(--panel)]/70 p-2">
        <svg viewBox={`0 0 ${width} ${height}`} className="h-[240px] w-full">
          {yTicks.map((tick) => (
            <g key={`y-${tick.y}`}>
              <line x1={px} y1={tick.y} x2={width - px} y2={tick.y} stroke="rgba(148,163,184,0.18)" />
              <text x={px - 8} y={tick.y - 4} textAnchor="end" fill="rgba(148,163,184,0.9)" fontSize="10">
                {valueFormatter(tick.value)}
              </text>
            </g>
          ))}

          {xTicks.map((tick) => (
            <text key={`x-${tick.x}`} x={tick.x} y={height - 2} textAnchor="middle" fill="rgba(148,163,184,0.9)" fontSize="10">
              {tick.label}
            </text>
          ))}

          {showZero ? (
            <line x1={px} y1={zeroY} x2={width - px} y2={zeroY} stroke="rgba(244,63,94,0.5)" strokeDasharray="4 4" />
          ) : null}

          {entries.map((ts, idx) => {
            if (ts < minTs || ts > maxTs) return null;
            const x = toX(ts);
            return (
              <line
                key={`entry-${idx}-${ts}`}
                x1={x}
                y1={py}
                x2={x}
                y2={height - py}
                stroke="rgba(16,185,129,0.45)"
                strokeDasharray="3 5"
              />
            );
          })}

          {btcPath ? (
            <path d={btcPath} fill="none" stroke={SERIES_COLORS.BTC} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
          ) : null}
          {ethPath ? (
            <path d={ethPath} fill="none" stroke={SERIES_COLORS.ETH} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
          ) : null}

          {fundingCrossovers.map((point, idx) => (
            <circle
              key={`cross-${idx}-${point.ts}`}
              cx={toX(point.ts)}
              cy={toY(point.value)}
              r="3.5"
              fill="#f97316"
            />
          ))}
        </svg>
      </div>
    </article>
  );
}

export default function MarketDataTab({
  oi,
  funding,
  liquidation,
  trades,
}: MarketDataTabProps) {
  const oiSeries = useMemo(
    () => parseSeries(oi, (row) => toNumber(row.open_interest)),
    [oi],
  );
  const fundingSeries = useMemo(
    () => parseSeries(funding, (row) => toNumber(row.funding_rate)),
    [funding],
  );
  const entryMarkers = useMemo(() => parseTradeEntryTimes(trades), [trades]);

  const liqBySymbol = useMemo(() => {
    const out: Record<"BTC" | "ETH", LiquidationSnapshotRow | null> = { BTC: null, ETH: null };
    for (const row of liquidation) {
      if ((row.symbol === "BTC" || row.symbol === "ETH") && !out[row.symbol]) {
        out[row.symbol] = row;
      }
    }
    return out;
  }, [liquidation]);

  return (
    <div className="space-y-4">
      <TimeSeriesChart
        title="Open Interest (7d)"
        subtitle="BTC and ETH open interest snapshots with trade-entry markers."
        series={oiSeries}
        entries={entryMarkers}
        valueFormatter={(value) => value.toLocaleString("en-US", { maximumFractionDigits: 0 })}
      />

      <TimeSeriesChart
        title="Funding Rate (7d)"
        subtitle="Funding basis over time. Orange dots mark zero-cross transitions."
        series={fundingSeries}
        entries={entryMarkers}
        valueFormatter={(value) => fmtPercent(value, 4)}
        zeroLine
      />

      <section className="grid gap-4 lg:grid-cols-2">
        {(["BTC", "ETH"] as const).map((symbol) => {
          const row = liqBySymbol[symbol];
          const totalLong = toNumber(row?.total_long_usd) ?? 0;
          const totalShort = toNumber(row?.total_short_usd) ?? 0;
          const total = Math.max(1, totalLong + totalShort);
          const longPct = (totalLong / total) * 100;
          const shortPct = (totalShort / total) * 100;

          return (
            <article key={symbol} className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold uppercase tracking-[0.2em] text-[color:var(--muted)]">
                  {symbol} Liquidation Snapshot
                </h4>
                <span className="text-xs text-[color:var(--muted)]">
                  {toIsoString(row?.snapshot_time_utc) ? new Date(toIsoString(row?.snapshot_time_utc) as string).toLocaleString() : "—"}
                </span>
              </div>

              {!row ? (
                <div className="mt-3 rounded-xl border border-dashed border-[var(--panel-border)] p-4 text-sm text-[color:var(--muted)]">
                  No liquidation snapshot yet.
                </div>
              ) : (
                <>
                  <div className="mt-3 grid gap-2 text-sm text-[var(--foreground)] md:grid-cols-2">
                    <p>Dominant side: <span className="font-semibold">{row.dominant_side}</span></p>
                    <p>Reference: <span className="font-semibold">{toNumber(row.reference_price)?.toFixed(2) ?? "—"}</span></p>
                    <p>Largest above: <span className="font-semibold">{toNumber(row.largest_above_price)?.toFixed(2) ?? "—"}</span></p>
                    <p>Largest below: <span className="font-semibold">{toNumber(row.largest_below_price)?.toFixed(2) ?? "—"}</span></p>
                  </div>

                  <div className="mt-3 space-y-2">
                    <div className="flex items-center justify-between text-xs text-[color:var(--muted)]">
                      <span>Long {formatCompactUsd(totalLong)}</span>
                      <span>{longPct.toFixed(1)}%</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-[var(--panel-border)]/60">
                      <div className="h-full bg-emerald-400/70" style={{ width: `${longPct}%` }} />
                    </div>
                    <div className="flex items-center justify-between text-xs text-[color:var(--muted)]">
                      <span>Short {formatCompactUsd(totalShort)}</span>
                      <span>{shortPct.toFixed(1)}%</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-[var(--panel-border)]/60">
                      <div className="h-full bg-rose-400/70" style={{ width: `${shortPct}%` }} />
                    </div>
                  </div>
                </>
              )}
            </article>
          );
        })}
      </section>
    </div>
  );
}
