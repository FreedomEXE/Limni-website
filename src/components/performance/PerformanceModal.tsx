"use client";

import { useState, useEffect } from "react";
import type { ModelPerformance } from "@/lib/performanceLab";

type PerformanceModalProps = {
  sectionLabel: string;
  modelLabel: string;
  performance: ModelPerformance;
  onClose: () => void;
  accountSize: number;
  setAccountSize: (size: number) => void;
  calibration?: {
    accountId: string;
    accountLabel: string;
    weekOpenUtc: string;
    weekLabel: string;
    accountSize: number;
    netPnl: number;
    trades: number;
  };
};

const ACCOUNT_SIZES = [10000, 50000, 100000, 250000, 500000, 1000000];

type ViewMode = "home" | "summary" | "simulation" | "basket" | "research" | "notes";

function formatPercent(value: number) {
  const sign = value > 0 ? "+" : value < 0 ? "" : "";
  return `${sign}${value.toFixed(2)}%`;
}

function formatMoney(value: number) {
  const sign = value > 0 ? "+" : value < 0 ? "-" : "";
  const abs = Math.abs(value);
  return `${sign}$${abs.toFixed(0)}`;
}

function tone(value: number) {
  if (value > 0) return "text-emerald-700";
  if (value < 0) return "text-rose-700";
  return "text-[color:var(--muted)]";
}

function getPerformanceTier(percent: number, winRate: number) {
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

export default function PerformanceModal({
  sectionLabel,
  modelLabel,
  performance,
  onClose,
  accountSize,
  setAccountSize,
  calibration,
}: PerformanceModalProps) {
  const [view, setView] = useState<ViewMode>("home");
  const [simulationMode, setSimulationMode] = useState<"hold" | "trailing">("hold");
  const [notes, setNotes] = useState("");
  const [isEditingNotes, setIsEditingNotes] = useState(false);

  const stats = performance.stats;
  const tier = getPerformanceTier(performance.percent, stats.win_rate);
  const badge = getConfidenceBadge(performance);
  const sharpeProxy = stats.volatility > 0 ? stats.avg_return / stats.volatility : 0;

  const pnl = (accountSize * performance.percent) / 100;
  const trailingPnl = performance.trailing
    ? (accountSize * performance.trailing.locked_percent) / 100
    : pnl;
  const displayedPnl = simulationMode === "trailing" ? trailingPnl : pnl;
  const displayedPercent = simulationMode === "trailing"
    ? (performance.trailing?.locked_percent ?? performance.percent)
    : performance.percent;

  const calibrationPnl =
    calibration && calibration.accountSize
      ? (calibration.accountSize * performance.percent) / 100
      : null;

  const notesKey = `limni-notes-${sectionLabel}-${modelLabel}`;

  useEffect(() => {
    const saved = localStorage.getItem(notesKey);
    if (saved) {
      setNotes(saved);
    }
  }, [notesKey]);

  const saveNotes = () => {
    localStorage.setItem(notesKey, notes);
    setIsEditingNotes(false);
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (view === "home") {
          onClose();
        } else {
          setView("home");
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [view, onClose]);

  const HomeCard = ({
    title,
    icon,
    description,
    onClick
  }: {
    title: string;
    icon: string;
    description: string;
    onClick: () => void;
  }) => (
    <button
      type="button"
      onClick={onClick}
      className="group rounded-2xl border-2 border-[var(--panel-border)] bg-[var(--panel)] p-6 text-left transition duration-200 hover:scale-[1.02] hover:border-[var(--accent)] hover:shadow-xl"
    >
      <div className="mb-3 text-4xl">{icon}</div>
      <h3 className="text-lg font-semibold text-[var(--foreground)]">{title}</h3>
      <p className="mt-2 text-sm text-[color:var(--muted)]">{description}</p>
    </button>
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--foreground)]/30 p-6"
      onClick={() => view === "home" ? onClose() : setView("home")}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-5xl overflow-hidden rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        {/* Header */}
        <div className={`relative bg-gradient-to-br from-white to-[var(--panel)] p-6 ${tier.accent}`}>
          <div className="absolute right-6 top-6 text-6xl opacity-10">{tier.emoji}</div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
                {sectionLabel}
              </p>
              <h3 className="mt-1 text-2xl font-semibold text-[var(--foreground)]">
                {modelLabel}
              </h3>
            </div>
            <button
              type="button"
              onClick={onClose}
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

        {/* Navigation Bar */}
        {view !== "home" && (
          <div className="border-b border-[var(--panel-border)] bg-[var(--panel)]/80 px-6 py-3">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setView("home")}
                className="rounded-lg border border-[var(--panel-border)] bg-[var(--panel)] px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-[color:var(--muted)] transition hover:border-[var(--accent)] hover:text-[var(--accent-strong)]"
              >
                ← Home
              </button>
              <div className="h-4 w-px bg-[var(--panel-border)]" />
              <button
                type="button"
                onClick={() => setView("summary")}
                className={`rounded-lg border px-3 py-1.5 text-xs font-semibold uppercase tracking-wider transition ${
                  view === "summary"
                    ? "border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent-strong)]"
                    : "border-transparent text-[color:var(--muted)] hover:border-[var(--panel-border)] hover:text-[var(--foreground)]"
                }`}
              >
                L Summary
              </button>
              <button
                type="button"
                onClick={() => setView("simulation")}
                className={`rounded-lg border px-3 py-1.5 text-xs font-semibold uppercase tracking-wider transition ${
                  view === "simulation"
                    ? "border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent-strong)]"
                    : "border-transparent text-[color:var(--muted)] hover:border-[var(--panel-border)] hover:text-[var(--foreground)]"
                }`}
              >
                I Simulation
              </button>
              <button
                type="button"
                onClick={() => setView("basket")}
                className={`rounded-lg border px-3 py-1.5 text-xs font-semibold uppercase tracking-wider transition ${
                  view === "basket"
                    ? "border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent-strong)]"
                    : "border-transparent text-[color:var(--muted)] hover:border-[var(--panel-border)] hover:text-[var(--foreground)]"
                }`}
              >
                M Basket
              </button>
              <button
                type="button"
                onClick={() => setView("research")}
                className={`rounded-lg border px-3 py-1.5 text-xs font-semibold uppercase tracking-wider transition ${
                  view === "research"
                    ? "border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent-strong)]"
                    : "border-transparent text-[color:var(--muted)] hover:border-[var(--panel-border)] hover:text-[var(--foreground)]"
                }`}
              >
                N Research
              </button>
              <button
                type="button"
                onClick={() => setView("notes")}
                className={`rounded-lg border px-3 py-1.5 text-xs font-semibold uppercase tracking-wider transition ${
                  view === "notes"
                    ? "border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent-strong)]"
                    : "border-transparent text-[color:var(--muted)] hover:border-[var(--panel-border)] hover:text-[var(--foreground)]"
                }`}
              >
                I Notes
              </button>
            </div>
          </div>
        )}

        {/* Content */}
        <div className="max-h-[70vh] overflow-y-auto p-6">
          {view === "home" && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <HomeCard
                title="Summary"
                icon="L"
                description="Executive summary with key performance metrics"
                onClick={() => setView("summary")}
              />
              <HomeCard
                title="Simulation"
                icon="I"
                description="Account size simulation with trailing stop comparison"
                onClick={() => setView("simulation")}
              />
              <HomeCard
                title="Basket"
                icon="M"
                description="All pairs in the basket with directions and returns"
                onClick={() => setView("basket")}
              />
              <HomeCard
                title="Research"
                icon="N"
                description="Outliers, risk metrics, and statistical analysis"
                onClick={() => setView("research")}
              />
              <HomeCard
                title="Notes"
                icon="I"
                description="Weekly summary and key observations"
                onClick={() => setView("notes")}
              />
            </div>
          )}

          {view === "summary" && (
            <div className="space-y-4">
              <div className="rounded-xl border border-[var(--panel-border)] bg-[var(--panel)]/70 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
                  Key Metrics
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
                  <MetricPill
                    label="Avg Return"
                    value={`${stats.avg_return.toFixed(2)}%`}
                    good={stats.avg_return > 0.5}
                  />
                  <MetricPill
                    label="Median Return"
                    value={`${stats.median_return.toFixed(2)}%`}
                    good={stats.median_return > 0}
                  />
                </div>
              </div>
              <div className="rounded-xl border border-[var(--panel-border)] bg-[var(--panel)]/70 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
                  Return Distribution
                </p>
                <div className="mt-4">
                  <MiniHistogram returns={performance.returns} />
                </div>
              </div>
            </div>
          )}

          {view === "simulation" && (
            <div className="space-y-4">
              <div className="rounded-xl border border-[var(--panel-border)] bg-[var(--panel)] p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
                  Simulation Mode
                </p>
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setSimulationMode("hold")}
                    className={`flex-1 rounded-lg border px-4 py-2 text-sm font-semibold transition ${
                      simulationMode === "hold"
                        ? "border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent-strong)]"
                        : "border-[var(--panel-border)] bg-[var(--panel)] text-[color:var(--muted)]"
                    }`}
                  >
                    Hold to End
                  </button>
                  <button
                    type="button"
                    onClick={() => setSimulationMode("trailing")}
                    disabled={!performance.trailing}
                    className={`flex-1 rounded-lg border px-4 py-2 text-sm font-semibold transition ${
                      simulationMode === "trailing"
                        ? "border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent-strong)]"
                        : "border-[var(--panel-border)] bg-[var(--panel)] text-[color:var(--muted)]"
                    } disabled:opacity-30 disabled:cursor-not-allowed`}
                  >
                    Trailing Stop {performance.trailing ? "" : "(N/A)"}
                  </button>
                </div>
              </div>

              <div className="rounded-xl border border-[var(--panel-border)] bg-[var(--panel)] p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
                  Account Size
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
                  {calibration ? (
                    <button
                      type="button"
                      onClick={() => setAccountSize(calibration.accountSize)}
                      className={`rounded-full border px-3 py-1 ${
                        Math.abs(accountSize - calibration.accountSize) < 1
                          ? "border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent-strong)]"
                          : "border-[var(--panel-border)] bg-[var(--panel)] text-[color:var(--muted)]"
                      }`}
                    >
                      MT5 ${calibration.accountSize.toFixed(0)}
                    </button>
                  ) : null}
                </div>
              </div>

              <div className="rounded-xl bg-[var(--foreground)] px-4 py-6 text-center text-[var(--background)]">
                <div className="text-4xl font-bold">{formatMoney(displayedPnl)}</div>
                <div className="mt-1 text-sm opacity-70">
                  {simulationMode === "trailing" ? "Trailing Stop" : "Hold to End"} · {formatPercent(displayedPercent)}
                </div>
                <div className="mt-1 text-xs uppercase tracking-[0.2em] opacity-50">
                  Simulated PnL
                </div>
              </div>

              {simulationMode === "trailing" && performance.trailing && (
                <div className="rounded-xl border border-[var(--panel-border)] bg-[var(--panel)]/70 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
                    Trailing Stop Details
                  </p>
                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <MetricPill
                      label="Peak %"
                      value={formatPercent(performance.trailing.peak_percent)}
                      good={performance.trailing.peak_percent > performance.percent}
                    />
                    <MetricPill
                      label="Max Drawdown"
                      value={formatPercent(performance.trailing.max_drawdown)}
                      good={performance.trailing.max_drawdown > -5}
                    />
                  </div>
                  {performance.trailing.peak_day && (
                    <p className="mt-3 text-xs text-[color:var(--muted)]">
                      Peak reached: {performance.trailing.peak_day}
                    </p>
                  )}
                  <div className="mt-3 text-sm text-[color:var(--muted)]">
                    {performance.trailing.locked_percent > performance.percent ? (
                      <p className="text-emerald-700">
                        ✓ Trailing improved returns by {formatPercent(performance.trailing.locked_percent - performance.percent)}
                      </p>
                    ) : (
                      <p>Hold-to-end was optimal</p>
                    )}
                  </div>
                </div>
              )}

              {calibration && (
                <div className="rounded-xl border border-[var(--panel-border)] bg-[var(--panel)]/70 p-4 text-sm text-[color:var(--muted)]">
                  <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
                    MT5 Calibration
                  </p>
                  <p className="mt-2 text-sm text-[var(--foreground)]">
                    {calibration.accountLabel} · {calibration.weekLabel}
                  </p>
                  <p className="mt-2 text-xs">
                    Closed trades: {calibration.trades} · Net {formatMoney(calibration.netPnl)}
                  </p>
                  {calibrationPnl !== null && (
                    <p className="mt-1 text-xs">
                      MT5 sized PnL: {formatMoney(calibrationPnl)}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {view === "basket" && (
            <div className="rounded-xl border border-[var(--panel-border)] bg-[var(--panel)] p-4">
              <div className="flex items-center justify-between">
                <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
                  All Pairs
                </p>
                <span className="text-xs text-[color:var(--muted)]">
                  {performance.pair_details.length} pairs
                </span>
              </div>
              <div className="mt-3 max-h-[50vh] space-y-3 overflow-y-auto text-xs text-[color:var(--muted)]">
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
                            : detail.direction === "SHORT"
                            ? "text-rose-700"
                            : "text-[color:var(--muted)]"
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
          )}

          {view === "research" && (
            <div className="space-y-4">
              <div className="rounded-xl border border-[var(--panel-border)] bg-[var(--panel)] p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
                  Outliers
                </p>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-lg border border-[var(--accent)]/30 bg-[var(--accent)]/10 p-3">
                    <p className="text-xs uppercase tracking-[0.2em] text-[var(--accent-strong)]">
                      Best Performer
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
                      Worst Performer
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
              <div className="rounded-xl border border-[var(--panel-border)] bg-[var(--panel)]/70 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
                  Risk Analysis
                </p>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <MetricPill
                    label="Volatility"
                    value={`${stats.volatility.toFixed(2)}%`}
                    good={stats.volatility < 2}
                  />
                  <MetricPill
                    label="Sharpe Proxy"
                    value={sharpeProxy.toFixed(2)}
                    good={sharpeProxy > 1}
                  />
                  {performance.trailing && (
                    <MetricPill
                      label="Max Drawdown"
                      value={formatPercent(performance.trailing.max_drawdown)}
                      good={performance.trailing.max_drawdown > -5}
                    />
                  )}
                  <MetricPill
                    label="Win Rate"
                    value={`${stats.win_rate.toFixed(0)}%`}
                    good={stats.win_rate > 55}
                  />
                </div>
              </div>
              <div className="text-xs text-[color:var(--muted)]">
                Assumptions: equal-weighted basket, single-week move, no fees or slippage.
              </div>
            </div>
          )}

          {view === "notes" && (
            <div className="space-y-4">
              <div className="rounded-xl border border-[var(--panel-border)] bg-[var(--panel)]/70 p-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
                    Weekly Summary
                  </p>
                  {!isEditingNotes ? (
                    <button
                      type="button"
                      onClick={() => setIsEditingNotes(true)}
                      className="rounded-lg border border-[var(--panel-border)] bg-[var(--panel)] px-3 py-1 text-xs font-semibold uppercase tracking-wider text-[color:var(--muted)] transition hover:border-[var(--accent)] hover:text-[var(--accent-strong)]"
                    >
                      Edit
                    </button>
                  ) : (
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={saveNotes}
                        className="rounded-lg border border-[var(--accent)] bg-[var(--accent)]/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-[var(--accent-strong)] transition hover:bg-[var(--accent)]/20"
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const saved = localStorage.getItem(notesKey);
                          setNotes(saved ?? "");
                          setIsEditingNotes(false);
                        }}
                        className="rounded-lg border border-[var(--panel-border)] bg-[var(--panel)] px-3 py-1 text-xs font-semibold uppercase tracking-wider text-[color:var(--muted)] transition hover:border-rose-400 hover:text-rose-700"
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </div>
                {isEditingNotes ? (
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Add weekly observations, key insights, notable events, trading decisions, etc."
                    className="mt-4 w-full rounded-lg border border-[var(--panel-border)] bg-[var(--panel)] p-3 text-sm text-[var(--foreground)] placeholder:text-[color:var(--muted)] focus:border-[var(--accent)] focus:outline-none"
                    rows={8}
                  />
                ) : notes ? (
                  <div className="mt-4 whitespace-pre-wrap rounded-lg border border-[var(--panel-border)] bg-[var(--panel)] p-3 text-sm text-[var(--foreground)]">
                    {notes}
                  </div>
                ) : (
                  <div className="mt-4 rounded-lg border border-dashed border-[var(--panel-border)] bg-[var(--panel)] p-6 text-center text-[color:var(--muted)]">
                    <p className="text-sm">No notes yet.</p>
                    <p className="mt-2 text-xs">
                      Click Edit to add weekly observations, key insights, and notable events.
                    </p>
                  </div>
                )}
              </div>
              <div className="rounded-xl border border-[var(--panel-border)] bg-[var(--panel)]/70 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
                  Key Observations
                </p>
                <div className="mt-3 space-y-2 text-sm text-[color:var(--muted)]">
                  <p>• Model: {modelLabel}</p>
                  <p>• Total return: {formatPercent(performance.percent)}</p>
                  <p>• Pairs tracked: {performance.total} ({performance.priced} priced)</p>
                  <p>• Win rate: {stats.win_rate.toFixed(0)}%</p>
                  {performance.trailing && (
                    <p>• Peak return: {formatPercent(performance.trailing.peak_percent)}</p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
