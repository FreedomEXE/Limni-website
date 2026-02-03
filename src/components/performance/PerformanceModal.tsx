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

const PAGES = [
  { id: "summary", label: "Executive Summary" },
  { id: "simulation", label: "Account Simulation" },
  { id: "trailing", label: "Trailing Stop Analysis" },
  { id: "pairs", label: "Basket Pairs" },
  { id: "outliers", label: "Outliers & Risk" },
] as const;

type PageId = typeof PAGES[number]["id"];

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
  const [currentPage, setCurrentPage] = useState<PageId>("summary");
  const stats = performance.stats;
  const tier = getPerformanceTier(performance.percent, stats.win_rate);
  const badge = getConfidenceBadge(performance);
  const pnl = (accountSize * performance.percent) / 100;
  const sharpeProxy = stats.volatility > 0 ? stats.avg_return / stats.volatility : 0;
  const calibrationPnl =
    calibration && calibration.accountSize
      ? (calibration.accountSize * performance.percent) / 100
      : null;

  const currentPageIndex = PAGES.findIndex((p) => p.id === currentPage);
  const canGoNext = currentPageIndex < PAGES.length - 1;
  const canGoPrev = currentPageIndex > 0;

  const handleNext = () => {
    if (canGoNext) {
      setCurrentPage(PAGES[currentPageIndex + 1].id);
    }
  };

  const handlePrev = () => {
    if (canGoPrev) {
      setCurrentPage(PAGES[currentPageIndex - 1].id);
    }
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      } else if (event.key === "ArrowRight") {
        handleNext();
      } else if (event.key === "ArrowLeft") {
        handlePrev();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentPageIndex, onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--foreground)]/30 p-6"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-4xl overflow-hidden rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        {/* Header */}
        <div className={`relative bg-gradient-to-br from-white to-[var(--panel)] p-6 ${tier.accent}`}>
          <div className="absolute right-6 top-6 text-6xl opacity-10">{tier.emoji}</div>
          <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
            {sectionLabel}
          </p>
          <div className="mt-2 flex items-center justify-between">
            <h3 className="text-2xl font-semibold text-[var(--foreground)]">
              {modelLabel}
            </h3>
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

        {/* Page Indicator */}
        <div className="flex items-center justify-center gap-2 border-b border-[var(--panel-border)] bg-[var(--panel)]/50 px-6 py-3">
          {PAGES.map((page, index) => (
            <button
              key={page.id}
              type="button"
              onClick={() => setCurrentPage(page.id)}
              className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] transition ${
                currentPage === page.id
                  ? "border border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent-strong)]"
                  : "text-[color:var(--muted)] hover:text-[var(--foreground)]"
              }`}
            >
              {index + 1}
            </button>
          ))}
        </div>

        {/* Content Area */}
        <div className="max-h-[70vh] overflow-y-auto p-6">
          {currentPage === "summary" && (
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
                  Return distribution
                </p>
                <div className="mt-4">
                  <MiniHistogram returns={performance.returns} />
                </div>
              </div>
            </div>
          )}

          {currentPage === "simulation" && (
            <div className="space-y-4">
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
                <div className="mt-4 rounded-xl bg-[var(--foreground)] px-4 py-6 text-center text-[var(--background)]">
                  <div className="text-3xl font-semibold">{formatMoney(pnl)}</div>
                  <div className="text-xs uppercase tracking-[0.2em] text-[var(--background)]/70">
                    Simulated PnL
                  </div>
                </div>
              </div>
              {calibration ? (
                <div className="rounded-xl border border-[var(--panel-border)] bg-[var(--panel)]/70 p-4 text-sm text-[color:var(--muted)]">
                  <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
                    MT5 calibration
                  </p>
                  <p className="mt-2 text-sm text-[var(--foreground)]">
                    {calibration.accountLabel} · {calibration.weekLabel}
                  </p>
                  <p className="mt-2 text-xs">
                    Closed trades: {calibration.trades} · Net{" "}
                    {formatMoney(calibration.netPnl)}
                  </p>
                  <p className="mt-1 text-xs">
                    Implied size: ${calibration.accountSize.toFixed(0)}
                  </p>
                  {calibrationPnl !== null ? (
                    <p className="mt-2 text-xs text-[color:var(--muted)]">
                      MT5 sized PnL: {formatMoney(calibrationPnl)}
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>
          )}

          {currentPage === "trailing" && (
            <div className="space-y-4">
              {performance.trailing ? (
                <>
                  <div className="rounded-xl border border-[var(--panel-border)] bg-[var(--panel)]/70 p-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
                      Trailing Stop Analysis (20% lock / 10% offset)
                    </p>
                    <div className="mt-4 grid grid-cols-2 gap-3">
                      <MetricPill
                        label="Peak %"
                        value={formatPercent(performance.trailing.peak_percent)}
                        good={performance.trailing.peak_percent > performance.percent}
                      />
                      <MetricPill
                        label="Locked %"
                        value={formatPercent(performance.trailing.locked_percent)}
                        good={performance.trailing.locked_percent > 0}
                      />
                      <MetricPill
                        label="Max Drawdown"
                        value={formatPercent(performance.trailing.max_drawdown)}
                        good={performance.trailing.max_drawdown > -5}
                      />
                      <MetricPill
                        label="Trailing Hit"
                        value={performance.trailing.trailing_hit ? "Yes" : "No"}
                        good={performance.trailing.trailing_hit}
                      />
                    </div>
                  </div>
                  <div className="rounded-xl border border-[var(--panel-border)] bg-[var(--panel)] p-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
                      Performance comparison
                    </p>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <div className="rounded-lg border border-[var(--panel-border)] bg-[var(--panel)]/70 p-3">
                        <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
                          Hold to End
                        </p>
                        <p className={`mt-2 text-2xl font-semibold ${tone(performance.percent)}`}>
                          {formatPercent(performance.percent)}
                        </p>
                      </div>
                      <div className="rounded-lg border border-[var(--accent)]/30 bg-[var(--accent)]/10 p-3">
                        <p className="text-xs uppercase tracking-[0.2em] text-[var(--accent-strong)]">
                          Trailing Lock
                        </p>
                        <p className={`mt-2 text-2xl font-semibold ${tone(performance.trailing.locked_percent)}`}>
                          {formatPercent(performance.trailing.locked_percent)}
                        </p>
                        {performance.trailing.peak_day ? (
                          <p className="mt-1 text-xs text-[color:var(--muted)]">
                            Peak: {performance.trailing.peak_day}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  </div>
                  <div className="rounded-xl border border-[var(--panel-border)] bg-[var(--panel)]/70 p-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
                      Insights
                    </p>
                    <div className="mt-3 space-y-2 text-sm text-[color:var(--muted)]">
                      {performance.trailing.locked_percent > performance.percent ? (
                        <p className="text-emerald-700">
                          ✓ Trailing stop would have improved returns by {formatPercent(performance.trailing.locked_percent - performance.percent)}
                        </p>
                      ) : (
                        <p>
                          Hold-to-end was optimal for this week
                        </p>
                      )}
                      {performance.trailing.peak_percent > performance.percent + 5 ? (
                        <p>
                          Peak was significantly higher at {formatPercent(performance.trailing.peak_percent)}, suggesting volatility
                        </p>
                      ) : null}
                      {performance.trailing.max_drawdown < -10 ? (
                        <p className="text-rose-700">
                          Large drawdown of {formatPercent(performance.trailing.max_drawdown)} observed
                        </p>
                      ) : null}
                    </div>
                  </div>
                </>
              ) : (
                <div className="rounded-xl border border-[var(--panel-border)] bg-[var(--panel)]/70 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
                    Trailing Stop Analysis
                  </p>
                  <div className="mt-4 rounded-xl border border-dashed border-[var(--panel-border)] bg-[var(--panel)] p-6 text-center text-[color:var(--muted)]">
                    <p className="text-xs">Trailing stop data not available for this basket</p>
                    <p className="mt-2 text-xs">Requires intraday price series for simulation</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {currentPage === "pairs" && (
            <div className="rounded-xl border border-[var(--panel-border)] bg-[var(--panel)] p-4">
              <div className="flex items-center justify-between">
                <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
                  Basket pairs
                </p>
                <span className="text-xs text-[color:var(--muted)]">
                  {performance.pair_details.length} pairs
                </span>
              </div>
              <div className="mt-3 max-h-96 space-y-3 overflow-y-auto text-xs text-[color:var(--muted)]">
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
          )}

          {currentPage === "outliers" && (
            <div className="space-y-4">
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
              <div className="rounded-xl border border-[var(--panel-border)] bg-[var(--panel)]/70 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
                  Risk Metrics
                </p>
                <p className="mt-2 text-sm text-[color:var(--muted)]">
                  Coming soon: Max drawdown, consecutive losses, and risk-adjusted metrics
                </p>
              </div>
              <div className="text-xs text-[color:var(--muted)]">
                Assumptions: equal-weighted basket, single-week move, no fees or slippage.
              </div>
            </div>
          )}
        </div>

        {/* Navigation Footer */}
        <div className="flex items-center justify-between border-t border-[var(--panel-border)] bg-[var(--panel)]/50 px-6 py-4">
          <button
            type="button"
            onClick={handlePrev}
            disabled={!canGoPrev}
            className="rounded-full border border-[var(--panel-border)] bg-[var(--panel)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--muted)] transition hover:border-[var(--accent)] hover:text-[var(--accent-strong)] disabled:opacity-30 disabled:hover:border-[var(--panel-border)] disabled:hover:text-[color:var(--muted)]"
          >
            ← Previous
          </button>
          <div className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
            {PAGES[currentPageIndex].label}
          </div>
          <button
            type="button"
            onClick={handleNext}
            disabled={!canGoNext}
            className="rounded-full border border-[var(--panel-border)] bg-[var(--panel)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--muted)] transition hover:border-[var(--accent)] hover:text-[var(--accent-strong)] disabled:opacity-30 disabled:hover:border-[var(--panel-border)] disabled:hover:text-[color:var(--muted)]"
          >
            Next →
          </button>
        </div>
      </div>
    </div>
  );
}
