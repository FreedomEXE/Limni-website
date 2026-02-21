"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import type { ModelPerformance, PerformanceModel } from "@/lib/performanceLab";
import PerformanceModal from "@/components/performance/PerformanceModal";

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
  view?: "summary" | "simulation" | "basket" | "research" | "notes";
  allTime: {
    combined: Array<{
      model: PerformanceModel;
      totalPercent: number;
      weeks: number;
      winRate: number;
      avgWeekly: number;
    }>;
    perAsset: Record<
      string,
      Array<{
        model: PerformanceModel;
        totalPercent: number;
        weeks: number;
        winRate: number;
        avgWeekly: number;
      }>
    >;
  };
  calibration?: {
    accountId: string;
    accountLabel: string;
    weekOpenUtc: string;
    weekLabel: string;
    accountSize: number;
    netPnl: number;
    trades: number;
  };
  showAllTime?: boolean;
};

const MODEL_ORDER: PerformanceModel[] = [
  "antikythera",
  "antikythera_v2",
  "antikythera_v3",
  "blended",
  "dealer",
  "commercial",
  "sentiment",
];

function sortModels(models: ModelPerformance[]) {
  const order = new Map(MODEL_ORDER.map((model, index) => [model, index]));
  return [...models].sort((a, b) => {
    const aIndex = order.get(a.model) ?? MODEL_ORDER.length;
    const bIndex = order.get(b.model) ?? MODEL_ORDER.length;
    return aIndex - bIndex;
  });
}

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

function PerformanceCard({
  label,
  performance,
  view = "summary",
  calibrationSize,
  calibrationLabel,
  isCotBased,
  onOpenDetails,
  style,
}: {
  label: string;
  performance: ModelPerformance;
  view?: "summary" | "simulation" | "basket" | "research" | "notes";
  calibrationSize?: number;
  calibrationLabel?: string;
  isCotBased: boolean;
  onOpenDetails: () => void;
  style?: CSSProperties;
}) {
  const tier = getPerformanceTier(performance.percent, performance.stats.win_rate);
  const badge = getConfidenceBadge(performance);
  const coverage = performance.total > 0 ? performance.priced / performance.total : 0;
  const sharpeProxy =
    performance.stats.volatility > 0 ? performance.stats.avg_return / performance.stats.volatility : 0;
  const displayPercent =
    view === "simulation" && performance.trailing
      ? performance.trailing.locked_percent
      : performance.percent;
  const displayNote = performance.note || "Notes will appear here.";
  const calibrationPnl =
    calibrationSize && Number.isFinite(calibrationSize)
      ? (calibrationSize * performance.percent) / 100
      : null;
  const topPairs = performance.pair_details.slice(0, 4);
  return (
    <button
      type="button"
      onClick={onOpenDetails}
      aria-label={`Open ${label} details`}
      style={style}
      data-cot-surface={isCotBased ? "true" : undefined}
      className={`relative rounded-2xl border-2 p-4 text-left transition duration-300 animate-fade-in hover:scale-[1.01] hover:shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 ${tier.card}`}
    >
      <div className="absolute right-4 top-3 text-4xl opacity-10">{tier.emoji}</div>
      <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
        {label}
      </p>
      <div className="mt-2 text-center">
        <div className={`text-3xl font-black ${tone(displayPercent)}`}>
          {formatPercent(displayPercent)}
        </div>
        <div className="text-[11px] uppercase tracking-[0.2em] text-[color:var(--muted)]">
          {view === "simulation" ? "Locked return" : "Total return"}
        </div>
      </div>

      {view === "summary" ? (
        <>
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
        </>
      ) : null}

      {view === "simulation" ? (
        <div className="mt-4 grid grid-cols-2 gap-2">
          <MetricPill
            label="Peak"
            value={`${performance.trailing?.peak_percent?.toFixed(2) ?? performance.percent.toFixed(2)}%`}
            good={(performance.trailing?.peak_percent ?? performance.percent) > 0}
          />
          <MetricPill
            label="Locked"
            value={`${performance.trailing?.locked_percent?.toFixed(2) ?? performance.percent.toFixed(2)}%`}
            good={(performance.trailing?.locked_percent ?? performance.percent) > 0}
          />
          <MetricPill
            label="Trail Hit"
            value={performance.trailing?.trailing_hit ? "Yes" : "No"}
            good={Boolean(performance.trailing?.trailing_hit)}
          />
          <MetricPill
            label="Max DD"
            value={`${performance.trailing?.max_drawdown?.toFixed(2) ?? "0.00"}%`}
            good={(performance.trailing?.max_drawdown ?? 0) < 5}
          />
        </div>
      ) : null}

      {view === "basket" ? (
        <div className="mt-4 space-y-2 text-xs text-[color:var(--muted)]">
          <div className="flex items-center justify-between">
            <span className="uppercase tracking-[0.2em]">Top pairs</span>
            <span>{performance.priced}/{performance.total} priced</span>
          </div>
          {topPairs.length === 0 ? (
            <div className="rounded-lg border border-dashed border-[var(--panel-border)] px-3 py-2 text-[color:var(--muted)]">
              No pair details available.
            </div>
          ) : (
            topPairs.map((pair) => (
              <div key={`${pair.pair}-${pair.direction}`} className="flex items-center justify-between">
                <span className="font-semibold text-[var(--foreground)]">{pair.pair}</span>
                <span className={pair.direction === "LONG" ? "text-emerald-600" : pair.direction === "SHORT" ? "text-rose-600" : ""}>
                  {pair.direction}
                </span>
              </div>
            ))
          )}
        </div>
      ) : null}

      {view === "research" ? (
        <div className="mt-4 space-y-3 text-xs text-[color:var(--muted)]">
          <div className="grid grid-cols-2 gap-2">
            <MetricPill
              label="Win Rate"
              value={`${performance.stats.win_rate.toFixed(0)}%`}
              good={performance.stats.win_rate > 55}
            />
            <MetricPill
              label="Avg Return"
              value={`${performance.stats.avg_return.toFixed(2)}%`}
              good={performance.stats.avg_return > 0}
            />
            <MetricPill
              label="Volatility"
              value={`${performance.stats.volatility.toFixed(2)}%`}
              good={performance.stats.volatility < 2}
            />
            <MetricPill
              label="Median"
              value={`${performance.stats.median_return.toFixed(2)}%`}
              good={performance.stats.median_return > 0}
            />
          </div>
          <div className="flex items-center justify-between">
            <span>Best</span>
            <span className="font-semibold text-[var(--foreground)]">
              {performance.stats.best_pair?.pair ?? "—"}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span>Worst</span>
            <span className="font-semibold text-[var(--foreground)]">
              {performance.stats.worst_pair?.pair ?? "—"}
            </span>
          </div>
        </div>
      ) : null}

      {view === "notes" ? (
        <div className="mt-4 rounded-xl border border-[var(--panel-border)] bg-[var(--panel)]/70 p-3 text-xs text-[var(--foreground)]">
          {displayNote}
        </div>
      ) : null}

      {calibrationPnl !== null ? (
        <div className="mt-3 text-center text-xs text-[color:var(--muted)]">
          {calibrationLabel ? `${calibrationLabel}: ` : ""} {formatMoney(calibrationPnl)}
        </div>
      ) : null}
      <div className="mt-3 text-center text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--muted)]">
        View details
      </div>
    </button>
  );
}

export default function PerformanceGrid({
  combined,
  perAsset,
  labels,
  allTime,
  calibration,
  view = "summary",
  showAllTime = true,
}: PerformanceGridProps) {
  const sections = useMemo(() => {
    return [combined, ...perAsset].map((section) => ({
      ...section,
      models: sortModels(section.models),
    }));
  }, [combined, perAsset]);
  const [selectedSectionId, setSelectedSectionId] = useState(
    sections[0]?.id ?? "combined",
  );
  const [modalAccountSize, setModalAccountSize] = useState(calibration?.accountSize ?? 100000);
  const [selectedModel, setSelectedModel] = useState<{
    sectionLabel: string;
    modelLabel: string;
    performance: ModelPerformance;
  } | null>(null);

  useEffect(() => {
    if (calibration?.accountSize && Number.isFinite(calibration.accountSize)) {
      setModalAccountSize(calibration.accountSize);
    }
  }, [calibration?.accountSize]);

  const resolvedSectionId = sections.find((section) => section.id === selectedSectionId)
    ? selectedSectionId
    : sections[0]?.id ?? "combined";
  const selectedAllTime =
    resolvedSectionId === "combined"
      ? allTime.combined
      : allTime.perAsset[resolvedSectionId] ?? allTime.combined;
  const selectedSection =
    sections.find((section) => section.id === resolvedSectionId) ?? sections[0];

  return (
    <>
      <section className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] p-6 shadow-sm">
        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <h2 className="text-lg font-semibold text-[var(--foreground)]">
            Basket performance
          </h2>
          <div className="flex flex-wrap items-center gap-2">
            {sections.map((section) => (
              <button
                key={section.id}
                type="button"
                onClick={() => setSelectedSectionId(section.id)}
                className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] ${
                  resolvedSectionId === section.id
                    ? "border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent-strong)]"
                    : "border-[var(--panel-border)] bg-[var(--panel)] text-[color:var(--muted)]"
                }`}
              >
                {section.id === "combined" ? "All" : section.label}
              </button>
            ))}
          </div>
        </div>
        {sections.map((section) =>
          section.id === selectedSectionId ? (
            <div key={section.id}>
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
                      view={view}
                      isCotBased={result.model !== "sentiment"}
                      calibrationSize={calibration?.accountSize}
                      calibrationLabel={calibration ? "MT5 sized" : undefined}
                      onOpenDetails={() =>
                        setSelectedModel({
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
          ) : null,
        )}
      </section>
      {showAllTime && selectedAllTime.length > 0 ? (
        <section className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] p-6 shadow-sm">
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-[var(--foreground)]">
              All-time performance
            </h2>
            <p className="text-sm text-[color:var(--muted)]">
              Aggregated weekly totals for{" "}
              {selectedSection?.id === "combined" ? "all asset classes" : selectedSection?.label}.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            {selectedAllTime.map((stat) => (
              <div
                key={`alltime-${selectedSectionId}-${stat.model}`}
                data-cot-surface={stat.model !== "sentiment" ? "true" : undefined}
                className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)]/80 p-4 text-left"
              >
                <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
                  {labels[stat.model]}
                </p>
                <p
                  className={`mt-2 text-2xl font-semibold ${
                    stat.totalPercent > 0
                      ? "text-emerald-700"
                      : stat.totalPercent < 0
                        ? "text-rose-700"
                        : "text-[var(--foreground)]"
                  }`}
                >
                  {stat.totalPercent.toFixed(2)}%
                </p>
                <div className="mt-2 space-y-1 text-xs text-[color:var(--muted)]">
                  <p>{stat.weeks} weeks tracked</p>
                  <p>Win rate {stat.winRate.toFixed(0)}%</p>
                  <p>Avg weekly {stat.avgWeekly.toFixed(2)}%</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}
      {selectedModel ? (
        <PerformanceModal
          sectionLabel={selectedModel.sectionLabel}
          modelLabel={selectedModel.modelLabel}
          performance={selectedModel.performance}
          onClose={() => setSelectedModel(null)}
          accountSize={modalAccountSize}
          setAccountSize={setModalAccountSize}
          initialView={view}
          calibration={calibration}
        />
      ) : null}
    </>
  );
}
