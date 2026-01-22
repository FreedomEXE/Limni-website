"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import type { ModelPerformance, PerformanceModel } from "@/lib/performanceLab";

type Section = {
  id: string;
  label: string;
  description: string;
  models: ModelPerformance[];
};

type PerformanceGridProps = {
  combined: Section;
  perAsset: Section[];
  labels: Record<PerformanceModel, string>;
};

const ACCOUNT_SIZES = [10000, 50000, 100000, 250000, 500000, 1000000];

function formatPercent(value: number) {
  const sign = value > 0 ? "+" : value < 0 ? "" : "";
  return `${sign}${value.toFixed(2)}%`;
}

function tone(value: number) {
  if (value > 0) {
    return "text-emerald-700";
  }
  if (value < 0) {
    return "text-rose-700";
  }
  return "text-[color:var(--muted)]";
}

function formatMoney(value: number) {
  const sign = value > 0 ? "+" : value < 0 ? "-" : "";
  const abs = Math.abs(value);
  return `${sign}$${abs.toFixed(0)}`;
}

type PerformanceTier = {
  label: string;
  accent: string;
  card: string;
  emoji: string;
};

function getPerformanceTier(percent: number, winRate: number): PerformanceTier {
  if (percent > 5 && winRate > 60) {
    return {
      label: "Exceptional",
      accent: "text-[var(--accent-strong)]",
      card: "border-[var(--accent)]/30 bg-[var(--accent)]/10",
      emoji: "+++",
    };
  }
  if (percent > 3 && winRate > 55) {
    return {
      label: "Strong",
      accent: "text-[var(--foreground)]",
      card: "border-[var(--panel-border)] bg-[var(--panel)]",
      emoji: "++",
    };
  }
  if (percent > 0 && winRate > 50) {
    return {
      label: "Positive",
      accent: "text-[var(--accent-strong)]",
      card: "border-[var(--panel-border)] bg-[var(--panel)]/80",
      emoji: "+",
    };
  }
  if (percent > -2) {
    return {
      label: "Neutral",
      accent: "text-[color:var(--muted)]",
      card: "border-[var(--panel-border)] bg-[var(--panel)]/70",
      emoji: "-",
    };
  }
  return {
    label: "Weak",
    accent: "text-rose-700",
    card: "border-rose-200 bg-rose-50/70",
    emoji: "--",
  };
}

function getConfidenceBadge(performance: ModelPerformance) {
  const coverage = performance.total > 0 ? performance.priced / performance.total : 0;
  const score =
    (performance.stats.win_rate > 55 ? 30 : 0) +
    (performance.stats.volatility < 2 ? 20 : 0) +
    (coverage > 0.8 ? 25 : 0) +
    (performance.percent > 0 ? 25 : 0);
  if (score >= 80) {
    return { label: "High Confidence", badge: "border-[var(--accent)]/30 bg-[var(--accent)]/10 text-[var(--accent-strong)]", icon: "***" };
  }
  if (score >= 50) {
    return { label: "Medium Confidence", badge: "border-[var(--panel-border)] bg-[var(--panel)]/70 text-[var(--foreground)]/80", icon: "**" };
  }
  return { label: "Low Confidence", badge: "border-[var(--panel-border)] bg-[var(--panel)]/70 text-[color:var(--muted)]", icon: "*" };
}

function MetricPill({
  label,
  value,
  good,
}: {
  label: string;
  value: string;
  good: boolean;
}) {
  return (
    <div
      className={`rounded-lg border px-2 py-1.5 ${
        good
          ? "border-[var(--accent)]/30 bg-[var(--accent)]/10 text-[var(--accent-strong)]"
          : "border-[var(--panel-border)] bg-[var(--panel)]/70 text-[color:var(--muted)]"
      }`}
    >
      <div className="text-[10px] uppercase tracking-wider opacity-70">{label}</div>
      <div className="text-sm font-semibold">{value}</div>
    </div>
  );
}

function WinRateDonut({ winRate }: { winRate: number }) {
  const radius = 22;
  const circumference = 2 * Math.PI * radius;
  const dash = (Math.min(Math.max(winRate, 0), 100) / 100) * circumference;
  return (
    <svg width="56" height="56" viewBox="0 0 56 56">
      <circle cx="28" cy="28" r={radius} fill="none" stroke="#e5e7eb" strokeWidth="6" />
      <circle
        cx="28"
        cy="28"
        r={radius}
        fill="none"
        stroke={winRate >= 55 ? "#006b5e" : "#b45309"}
        strokeWidth="6"
        strokeDasharray={`${dash} ${circumference - dash}`}
        strokeLinecap="round"
        transform="rotate(-90 28 28)"
      />
      <text x="28" y="32" textAnchor="middle" className="text-xs font-semibold fill-[var(--foreground)]">
        {winRate.toFixed(0)}%
      </text>
    </svg>
  );
}

function MiniHistogram({ returns }: { returns: Array<{ pair: string; percent: number }> }) {
  if (returns.length === 0) {
    return <div className="h-8 rounded bg-[var(--panel-border)]/30" />;
  }
  const sample = returns.slice(0, 12);
  const max = Math.max(...sample.map((item) => Math.abs(item.percent)), 0.1);
  return (
    <div className="flex h-10 items-end gap-1">
      {sample.map((item) => (
        <div
          key={item.pair}
          className={`${item.percent >= 0 ? "bg-emerald-400" : "bg-rose-400"} flex-1 rounded-sm`}
          style={{ height: `${Math.max(10, (Math.abs(item.percent) / max) * 100)}%` }}
        />
      ))}
    </div>
  );
}

type ActiveCard = {
  sectionLabel: string;
  modelLabel: string;
  performance: ModelPerformance;
};

function PerformanceCard({
  label,
  performance,
  onOpen,
  style,
}: {
  label: string;
  performance: ModelPerformance;
  onOpen: () => void;
  style?: CSSProperties;
}) {
  const tier = getPerformanceTier(performance.percent, performance.stats.win_rate);
  const badge = getConfidenceBadge(performance);
  const coverage = performance.total > 0 ? performance.priced / performance.total : 0;
  const sharpeProxy =
    performance.stats.volatility > 0 ? performance.stats.avg_return / performance.stats.volatility : 0;
  return (
    <button
      type="button"
      onClick={onOpen}
      style={style}
      className={`group relative rounded-2xl border-2 p-4 text-left transition duration-300 hover:scale-[1.02] hover:shadow-xl animate-fade-in ${tier.card}`}
    >
      <div className="absolute right-4 top-3 text-4xl opacity-10">{tier.emoji}</div>
      <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
        {label}
      </p>
      <div className="mt-2 text-center">
        <div className={`text-3xl font-black ${tone(performance.percent)}`}>
          {formatPercent(performance.percent)}
        </div>
        <div className="text-[11px] uppercase tracking-[0.2em] text-[color:var(--muted)]">
          Total return
        </div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <MetricPill
          label="Win Rate"
          value={`${performance.stats.win_rate.toFixed(0)}%`}
          good={performance.stats.win_rate > 55}
        />
        <MetricPill
          label="Sharpe"
          value={sharpeProxy.toFixed(2)}
          good={sharpeProxy > 1}
        />
        <MetricPill
          label="Coverage"
          value={`${Math.round(coverage * 100)}%`}
          good={coverage > 0.8}
        />
        <MetricPill
          label="Volatility"
          value={`${performance.stats.volatility.toFixed(1)}%`}
          good={performance.stats.volatility < 2}
        />
      </div>
      <div className="mt-4 flex items-center justify-between gap-2">
        <WinRateDonut winRate={performance.stats.win_rate} />
        <div className="flex-1">
          <p className="text-[10px] uppercase tracking-[0.2em] text-[color:var(--muted)]">
            Return spread
          </p>
          <MiniHistogram returns={performance.returns} />
        </div>
      </div>
      <div className={`mt-4 rounded-full border px-3 py-1 text-center text-xs font-semibold ${badge.badge}`}>
        {badge.icon} {badge.label}
      </div>
    </button>
  );
}

export default function PerformanceGrid({
  combined,
  perAsset,
  labels,
}: PerformanceGridProps) {
  const [active, setActive] = useState<ActiveCard | null>(null);
  const [accountSize, setAccountSize] = useState(100000);

  useEffect(() => {
    if (!active) {
      return;
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setActive(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [active]);

  const modal = useMemo(() => {
    if (!active) {
      return null;
    }
    const { performance } = active;
    const stats = performance.stats;
    const pnl = (accountSize * performance.percent) / 100;
    const badge = getConfidenceBadge(performance);
    const tier = getPerformanceTier(performance.percent, performance.stats.win_rate);
    const sharpeProxy =
      stats.volatility > 0 ? stats.avg_return / stats.volatility : 0;
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--foreground)]/30 p-6"
        onClick={() => setActive(null)}
      >
        <div
          role="dialog"
          aria-modal="true"
          className="w-full max-w-3xl overflow-hidden rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] shadow-2xl"
          onClick={(event) => event.stopPropagation()}
        >
          <div className={`relative bg-gradient-to-br from-white to-[var(--panel)] p-6 ${tier.accent}`}>
            <div className="absolute right-6 top-6 text-6xl opacity-10">{tier.emoji}</div>
            <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
              {active.sectionLabel}
            </p>
            <div className="mt-2 flex items-center justify-between">
              <h3 className="text-2xl font-semibold text-[var(--foreground)]">
                {active.modelLabel}
              </h3>
              <button
                type="button"
                onClick={() => setActive(null)}
                className="relative z-10 rounded-full border border-[var(--panel-border)] bg-[var(--panel)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--muted)] transition hover:border-[var(--accent)] hover:text-[var(--accent-strong)]"
                aria-label="Close details"
              >
                Close
              </button>
            </div>
            <div className="mt-4 text-5xl font-black text-[var(--foreground)]">
              {formatPercent(performance.percent)}
            </div>
            <div className={`mt-3 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${badge.badge}`}>
              {badge.icon} {badge.label}
            </div>
          </div>

          <div className="grid gap-6 p-6 lg:grid-cols-2">
            <div className="space-y-4">
              <div className="rounded-xl border border-[var(--panel-border)] bg-[var(--panel)]/70 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
                  Executive summary
                </p>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <MetricPill
                    label="Win Rate"
                    value={`${stats.win_rate.toFixed(0)}%`}
                    good={stats.win_rate > 55}
                  />
                  <MetricPill
                    label="Sharpe"
                    value={sharpeProxy.toFixed(2)}
                    good={sharpeProxy > 1}
                  />
                  <MetricPill
                    label="Coverage"
                    value={`${performance.priced}/${performance.total}`}
                    good={performance.priced / performance.total > 0.8}
                  />
                  <MetricPill
                    label="Volatility"
                    value={`${stats.volatility.toFixed(2)}%`}
                    good={stats.volatility < 2}
                  />
                </div>
              </div>

              <div className="rounded-xl border border-[var(--panel-border)] bg-[var(--panel)] p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
                  Account simulation
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-[color:var(--muted)]">
                  {ACCOUNT_SIZES.map((size) => (
                    <button
                      key={size}
                      type="button"
                      onClick={() => setAccountSize(size)}
                      className={`rounded-full border px-3 py-1 ${
                        accountSize === size
                          ? "border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent-strong)]"
                          : "border-[var(--panel-border)] bg-[var(--panel)] text-[color:var(--muted)]"
                      }`}
                    >
                      ${size.toLocaleString()}
                    </button>
                  ))}
                </div>
                <div className="mt-4 rounded-xl bg-[var(--foreground)] px-4 py-6 text-center text-[var(--background)]">
                  <div className="text-3xl font-semibold">{formatMoney(pnl)}</div>
                  <div className="text-xs uppercase tracking-[0.2em] text-[var(--background)]/70">
                    Simulated PnL
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-xl border border-[var(--panel-border)] bg-[var(--panel)]/70 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
                  Return distribution
                </p>
                <div className="mt-4">
                  <MiniHistogram returns={performance.returns} />
                </div>
              </div>
              <div className="rounded-xl border border-[var(--panel-border)] bg-[var(--panel)] p-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
                    Basket pairs
                  </p>
                  <span className="text-xs text-[color:var(--muted)]">
                    {performance.pair_details.length} pairs
                  </span>
                </div>
                <div className="mt-3 max-h-64 space-y-3 overflow-y-auto text-xs text-[color:var(--muted)]">
                  {performance.pair_details.map((detail) => (
                    <div
                      key={detail.pair}
                      className="rounded-lg border border-[var(--panel-border)] bg-[var(--panel)]/70 px-3 py-2"
                    >
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-semibold text-[var(--foreground)]">
                          {detail.pair}
                        </span>
                        <span
                          className={`text-xs font-semibold ${
                            detail.direction === "LONG"
                              ? "text-emerald-700"
                              : "text-rose-700"
                          }`}
                        >
                          {detail.direction}
                        </span>
                      </div>
                      <div className="mt-1 text-xs text-[color:var(--muted)]">
                        {detail.percent === null
                          ? "No price data yet."
                          : `Return: ${formatPercent(detail.percent)}`}
                      </div>
                      <ul className="mt-1 text-[11px] text-[color:var(--muted)]">
                        {detail.reason.map((item) => (
                          <li key={`${detail.pair}-${item}`}>- {item}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-xl border border-[var(--panel-border)] bg-[var(--panel)] p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
                  Outliers
                </p>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-lg border border-[var(--accent)]/30 bg-[var(--accent)]/10 p-3">
                    <p className="text-xs uppercase tracking-[0.2em] text-[var(--accent-strong)]">
                      Best
                    </p>
                    <p className="mt-2 text-lg font-semibold text-[var(--foreground)]">
                      {stats.best_pair ? stats.best_pair.pair : "N/A"}
                    </p>
                    <p className="text-sm text-[var(--accent-strong)]">
                      {stats.best_pair ? formatPercent(stats.best_pair.percent) : "--"}
                    </p>
                  </div>
                  <div className="rounded-lg border border-rose-200 bg-rose-50/70 p-3">
                    <p className="text-xs uppercase tracking-[0.2em] text-rose-700">
                      Worst
                    </p>
                    <p className="mt-2 text-lg font-semibold text-[var(--foreground)]">
                      {stats.worst_pair ? stats.worst_pair.pair : "N/A"}
                    </p>
                    <p className="text-sm text-rose-700">
                      {stats.worst_pair ? formatPercent(stats.worst_pair.percent) : "--"}
                    </p>
                  </div>
                </div>
              </div>
              <div className="text-xs text-[color:var(--muted)]">
                Assumptions: equal-weighted basket, single-week move, no fees or slippage.
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }, [active, accountSize]);

  return (
    <>
      <section className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-[var(--foreground)]">
              {combined.label}
            </h2>
            <p className="text-sm text-[color:var(--muted)]">
              {combined.description}
            </p>
          </div>
          <span className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
            Latest week
          </span>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          {combined.models.map((result, index) => (
            <PerformanceCard
              key={`combined-${result.model}`}
              label={labels[result.model]}
              performance={result}
              onOpen={() =>
                setActive({
                  sectionLabel: combined.label,
                  modelLabel: labels[result.model],
                  performance: result,
                })
              }
              style={{ animationDelay: `${index * 50}ms` }}
            />
          ))}
        </div>
      </section>

      <section className="space-y-6">
        {perAsset.map((section) => (
          <div
            key={section.id}
            className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] p-6 shadow-sm"
          >
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-[var(--foreground)]">
                {section.label} Basket
              </h2>
              <p className="text-sm text-[color:var(--muted)]">
                {section.description}
              </p>
            </div>
            {section.models.length === 0 ? (
              <p className="text-sm text-[color:var(--muted)]">
                No snapshots available.
              </p>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
                {section.models.map((result, index) => (
                  <PerformanceCard
                    key={`${section.id}-${result.model}`}
                    label={labels[result.model]}
                    performance={result}
                    onOpen={() =>
                      setActive({
                        sectionLabel: section.label,
                        modelLabel: labels[result.model],
                        performance: result,
                      })
                    }
                    style={{ animationDelay: `${index * 50}ms` }}
                  />
                ))}
              </div>
            )}
          </div>
        ))}
      </section>
      {modal}
    </>
  );
}
