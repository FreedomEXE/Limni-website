"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

type PerformanceStyle = "universal" | "tiered" | "katarakti";
type KataraktiMarket = "crypto_futures" | "mt5_forex";
type KataraktiVariant = "core" | "lite" | "v3";

type ComparisonMetrics = {
  totalReturn: number;
  weeks: number;
  winRate: number;
  sharpe: number;
  sharpeAnnualized?: boolean;
  avgWeekly: number;
  maxDrawdown: number | null;
  trades: number;
  tradeWinRate: number;
  avgTrade: number | null;
  profitFactor: number | null;
  profitFactorInfinite?: boolean;
};

const WEEKLY_SHARPE_GOOD_THRESHOLD = 1;
const ANNUALIZED_SHARPE_GOOD_THRESHOLD = 7;

type ComparisonData = {
  v1: ComparisonMetrics;
  v2: ComparisonMetrics;
  v3: ComparisonMetrics;
  universal?: {
    v1: ComparisonMetrics;
    v2: ComparisonMetrics;
    v3: ComparisonMetrics;
  };
  tiered?: {
    v1: ComparisonMetrics;
    v2: ComparisonMetrics;
    v3: ComparisonMetrics;
  };
  katarakti?: {
    core: {
      crypto_futures: ComparisonMetrics;
      mt5_forex: ComparisonMetrics;
    };
    lite: {
      crypto_futures: ComparisonMetrics;
      mt5_forex: ComparisonMetrics;
    };
    v3: {
      crypto_futures: ComparisonMetrics;
      mt5_forex: ComparisonMetrics;
    };
  };
};

function formatSignedPercent(value: number, digits = 2) {
  const prefix = value >= 0 ? "+" : "";
  return `${prefix}${value.toFixed(digits)}%`;
}

function formatPercentOrDash(value: number | null, digits = 2) {
  if (value === null || !Number.isFinite(value)) return "—";
  return `${value.toFixed(digits)}%`;
}

function formatProfitFactor(value: number | null, profitFactorInfinite?: boolean) {
  if (profitFactorInfinite) return "∞";
  if (value === null || Number.isNaN(value)) return "—";
  if (!Number.isFinite(value)) return "∞";
  return value.toFixed(2);
}

export default function PerformanceComparisonPanel() {
  const searchParams = useSearchParams();
  const [data, setData] = useState<ComparisonData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const requestedSystem = searchParams.get("system");
  const requestedStyle = searchParams.get("style");
  const requestedMarket = searchParams.get("market");
  const requestedVariant = searchParams.get("variant");
  const requestedWeek = searchParams.get("week") ?? "all";
  const initialTab = requestedSystem === "v2" || requestedSystem === "v3" ? requestedSystem : "v1";
  const initialStyle: PerformanceStyle =
    requestedStyle === "tiered" || requestedStyle === "katarakti" ? requestedStyle : "universal";
  const initialMarket: KataraktiMarket =
    requestedMarket === "mt5_forex" ? "mt5_forex" : "crypto_futures";
  const initialVariant: KataraktiVariant =
    requestedVariant === "lite" ? "lite" : requestedVariant === "v3" ? "v3" : "core";
  const [activeTab, setActiveTab] = useState<"v1" | "v2" | "v3">(initialTab);
  const [activeStyle, setActiveStyle] = useState<PerformanceStyle>(initialStyle);
  const [activeMarket, setActiveMarket] = useState<KataraktiMarket>(initialMarket);
  const [activeVariant, setActiveVariant] = useState<KataraktiVariant>(initialVariant);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/performance/comparison?week=${encodeURIComponent(requestedWeek)}`);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        const json = await response.json();
        if (json.error) {
          throw new Error(json.error);
        }
        setData(json);
      } catch (err) {
        console.error("PerformanceComparisonPanel error:", err);
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [requestedWeek]);

  const universalMetrics = data?.universal ?? {
    v1: data?.v1 ?? { totalReturn: 0, weeks: 0, winRate: 0, sharpe: 0, avgWeekly: 0, maxDrawdown: null, trades: 0, tradeWinRate: 0, avgTrade: null, profitFactor: null },
    v2: data?.v2 ?? { totalReturn: 0, weeks: 0, winRate: 0, sharpe: 0, avgWeekly: 0, maxDrawdown: null, trades: 0, tradeWinRate: 0, avgTrade: null, profitFactor: null },
    v3: data?.v3 ?? { totalReturn: 0, weeks: 0, winRate: 0, sharpe: 0, avgWeekly: 0, maxDrawdown: null, trades: 0, tradeWinRate: 0, avgTrade: null, profitFactor: null },
  };
  const tieredMetrics = data?.tiered ?? {
    v1: { totalReturn: 0, weeks: 0, winRate: 0, sharpe: 0, avgWeekly: 0, maxDrawdown: null, trades: 0, tradeWinRate: 0, avgTrade: null, profitFactor: null },
    v2: { totalReturn: 0, weeks: 0, winRate: 0, sharpe: 0, avgWeekly: 0, maxDrawdown: null, trades: 0, tradeWinRate: 0, avgTrade: null, profitFactor: null },
    v3: { totalReturn: 0, weeks: 0, winRate: 0, sharpe: 0, avgWeekly: 0, maxDrawdown: null, trades: 0, tradeWinRate: 0, avgTrade: null, profitFactor: null },
  };
  const kataraktiMetrics = data?.katarakti ?? {
    core: {
      crypto_futures: { totalReturn: 0, weeks: 0, winRate: 0, sharpe: 0, avgWeekly: 0, maxDrawdown: null, trades: 0, tradeWinRate: 0, avgTrade: null, profitFactor: null },
      mt5_forex: { totalReturn: 0, weeks: 0, winRate: 0, sharpe: 0, avgWeekly: 0, maxDrawdown: null, trades: 0, tradeWinRate: 0, avgTrade: null, profitFactor: null },
    },
    lite: {
      crypto_futures: { totalReturn: 0, weeks: 0, winRate: 0, sharpe: 0, avgWeekly: 0, maxDrawdown: null, trades: 0, tradeWinRate: 0, avgTrade: null, profitFactor: null },
      mt5_forex: { totalReturn: 0, weeks: 0, winRate: 0, sharpe: 0, avgWeekly: 0, maxDrawdown: null, trades: 0, tradeWinRate: 0, avgTrade: null, profitFactor: null },
    },
    v3: {
      crypto_futures: { totalReturn: 0, weeks: 0, winRate: 0, sharpe: 0, avgWeekly: 0, maxDrawdown: null, trades: 0, tradeWinRate: 0, avgTrade: null, profitFactor: null },
      mt5_forex: { totalReturn: 0, weeks: 0, winRate: 0, sharpe: 0, avgWeekly: 0, maxDrawdown: null, trades: 0, tradeWinRate: 0, avgTrade: null, profitFactor: null },
    },
  };
  const metricSet = activeStyle === "tiered" ? tieredMetrics : universalMetrics;
  const v1Metrics = metricSet.v1;
  const v2Metrics = metricSet.v2;
  const v3Metrics = metricSet.v3;
  const activeMetrics = activeStyle === "katarakti"
    ? kataraktiMetrics[activeVariant][activeMarket]
    : activeTab === "v1"
      ? v1Metrics
      : activeTab === "v2"
        ? v2Metrics
        : v3Metrics;
  const activeVersionLabel = activeTab === "v1" ? "V1" : activeTab === "v2" ? "V2" : "V3";
  const activeLabel = activeStyle === "katarakti"
    ? activeMarket === "crypto_futures"
      ? activeVariant === "lite"
        ? "Katarakti Crypto Lite"
        : activeVariant === "v3"
          ? "Katarakti v3 (Liq Sweep)"
          : "Katarakti (Crypto Futures)"
      : activeVariant === "lite"
        ? "Katarakti CFD Lite"
        : activeVariant === "v3"
          ? "Katarakti CFD v3 (Pending)"
          : "Katarakti (CFD)"
    : activeStyle === "tiered"
      ? `Tiered ${activeVersionLabel}`
      : `Universal ${activeVersionLabel}`;
  const activeBadge = activeStyle === "katarakti"
    ? `${activeMarket === "crypto_futures" ? "Crypto Futures" : "CFD"} ${activeVariant === "lite" ? "Lite" : activeVariant === "v3" ? "v3" : "Core"}`
    : activeStyle === "tiered"
      ? activeTab === "v2"
        ? "Tiered (2 tiers)"
        : "Tiered (3 tiers)"
      : activeTab === "v1"
        ? "5 Baskets"
        : activeTab === "v2"
          ? "3 Baskets"
          : "4 Baskets";
  const activeCardClass =
    activeStyle === "katarakti"
      ? activeMarket === "crypto_futures"
        ? activeVariant === "lite"
          ? "rounded-2xl border border-sky-400/40 bg-sky-500/10 p-4"
          : activeVariant === "v3"
            ? "rounded-2xl border border-fuchsia-400/40 bg-fuchsia-500/10 p-4"
          : "rounded-2xl border border-amber-400/40 bg-amber-500/10 p-4"
        : activeVariant === "lite"
          ? "rounded-2xl border border-cyan-400/40 bg-cyan-500/10 p-4"
          : activeVariant === "v3"
            ? "rounded-2xl border border-violet-400/40 bg-violet-500/10 p-4"
          : "rounded-2xl border border-teal-400/40 bg-teal-500/10 p-4"
      : activeTab === "v1"
      ? "rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)]/80 p-4"
      : activeTab === "v2"
        ? "rounded-2xl border border-emerald-400/40 bg-emerald-500/10 p-4"
        : "rounded-2xl border border-cyan-400/40 bg-cyan-500/10 p-4";
  const valueClass =
    activeStyle === "katarakti"
      ? activeMarket === "crypto_futures"
        ? activeVariant === "lite"
          ? "text-sky-900 dark:text-sky-100"
          : activeVariant === "v3"
            ? "text-fuchsia-900 dark:text-fuchsia-100"
          : "text-amber-900 dark:text-amber-100"
        : activeVariant === "lite"
          ? "text-cyan-900 dark:text-cyan-100"
          : activeVariant === "v3"
            ? "text-violet-900 dark:text-violet-100"
          : "text-teal-900 dark:text-teal-100"
      : activeTab === "v1"
      ? "text-[var(--foreground)]"
      : activeTab === "v2"
        ? "text-emerald-900 dark:text-emerald-100"
        : "text-cyan-900 dark:text-cyan-100";
  const labelClass =
    activeStyle === "katarakti"
      ? activeMarket === "crypto_futures"
        ? activeVariant === "lite"
          ? "text-sky-700 dark:text-sky-300"
          : activeVariant === "v3"
            ? "text-fuchsia-700 dark:text-fuchsia-300"
          : "text-amber-700 dark:text-amber-300"
        : activeVariant === "lite"
          ? "text-cyan-700 dark:text-cyan-300"
          : activeVariant === "v3"
            ? "text-violet-700 dark:text-violet-300"
          : "text-teal-700 dark:text-teal-300"
      : activeTab === "v1"
      ? "text-[color:var(--muted)]"
      : activeTab === "v2"
        ? "text-emerald-700 dark:text-emerald-300"
        : "text-cyan-700 dark:text-cyan-300";
  const badgeClass =
    activeStyle === "katarakti"
      ? activeMarket === "crypto_futures"
        ? activeVariant === "lite"
          ? "rounded-full bg-sky-500/20 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.15em] text-sky-800 dark:text-sky-200"
          : activeVariant === "v3"
            ? "rounded-full bg-fuchsia-500/20 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.15em] text-fuchsia-800 dark:text-fuchsia-200"
          : "rounded-full bg-amber-500/20 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.15em] text-amber-800 dark:text-amber-200"
        : activeVariant === "lite"
          ? "rounded-full bg-cyan-500/20 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.15em] text-cyan-800 dark:text-cyan-200"
          : activeVariant === "v3"
            ? "rounded-full bg-violet-500/20 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.15em] text-violet-800 dark:text-violet-200"
          : "rounded-full bg-teal-500/20 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.15em] text-teal-800 dark:text-teal-200"
      : activeTab === "v1"
      ? "rounded-full bg-[var(--accent)]/10 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.15em] text-[var(--accent-strong)]"
      : activeTab === "v2"
        ? "rounded-full bg-emerald-500/20 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.15em] text-emerald-800 dark:text-emerald-200"
        : "rounded-full bg-cyan-500/20 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.15em] text-cyan-800 dark:text-cyan-200";
  const hasHistoricalData =
    v1Metrics.weeks > 0 ||
    v2Metrics.weeks > 0 ||
    v3Metrics.weeks > 0 ||
    kataraktiMetrics.core.crypto_futures.weeks > 0 ||
    kataraktiMetrics.core.mt5_forex.weeks > 0 ||
    kataraktiMetrics.lite.crypto_futures.weeks > 0 ||
    kataraktiMetrics.lite.mt5_forex.weeks > 0 ||
    kataraktiMetrics.v3.crypto_futures.weeks > 0 ||
    kataraktiMetrics.v3.mt5_forex.weeks > 0;
  const sharpeLabel = activeMetrics.sharpeAnnualized ? "Sharpe (Ann.)" : "Sharpe (Wk)";
  const sharpeGoodThreshold = activeMetrics.sharpeAnnualized
    ? ANNUALIZED_SHARPE_GOOD_THRESHOLD
    : WEEKLY_SHARPE_GOOD_THRESHOLD;
  const sharpeValueClass =
    activeMetrics.sharpe > sharpeGoodThreshold
      ? "text-emerald-700 dark:text-emerald-300"
      : valueClass;
  const setStyle = (next: PerformanceStyle) => {
    setActiveStyle(next);
    const url = new URL(window.location.href);
    url.searchParams.set("style", next);
    if (next === "katarakti") {
      url.searchParams.set("market", activeMarket);
      url.searchParams.set("variant", activeVariant);
    } else {
      url.searchParams.delete("market");
      url.searchParams.delete("variant");
    }
    window.history.replaceState(window.history.state, "", `${url.pathname}?${url.searchParams.toString()}`);
    window.dispatchEvent(new CustomEvent("performance-style-change", { detail: next }));
  };
  const setSystem = (next: "v1" | "v2" | "v3") => {
    setActiveTab(next);
    const url = new URL(window.location.href);
    url.searchParams.set("system", next);
    url.searchParams.set("style", activeStyle);
    window.history.replaceState(window.history.state, "", `${url.pathname}?${url.searchParams.toString()}`);
    window.dispatchEvent(new CustomEvent("performance-system-change", { detail: next }));
  };
  const setMarket = (next: KataraktiMarket) => {
    setActiveMarket(next);
    const url = new URL(window.location.href);
    url.searchParams.set("style", "katarakti");
    url.searchParams.set("market", next);
    url.searchParams.set("variant", activeVariant);
    window.history.replaceState(window.history.state, "", `${url.pathname}?${url.searchParams.toString()}`);
    window.dispatchEvent(new CustomEvent("performance-katarakti-market-change", { detail: next }));
  };
  const setVariant = (next: KataraktiVariant) => {
    setActiveVariant(next);
    const url = new URL(window.location.href);
    url.searchParams.set("style", "katarakti");
    url.searchParams.set("market", activeMarket);
    url.searchParams.set("variant", next);
    window.history.replaceState(window.history.state, "", `${url.pathname}?${url.searchParams.toString()}`);
    window.dispatchEvent(new CustomEvent("performance-katarakti-variant-change", { detail: next }));
  };

  return (
    <div className="flex-1 space-y-4 p-4">
      <div className="mb-2">
        <div className="text-[10px] uppercase tracking-[0.2em] text-[color:var(--muted)]">
          System Comparison
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <button
          type="button"
          onClick={() => setStyle("universal")}
          className={`rounded-xl border px-3 py-2 text-left text-xs font-semibold transition ${
            activeStyle === "universal"
              ? "border-[var(--accent)]/40 bg-[var(--accent)]/10 text-[var(--accent-strong)]"
              : "border-[var(--panel-border)] bg-[var(--panel)]/70 text-[var(--foreground)]/80"
          }`}
        >
          Universal
        </button>
        <button
          type="button"
          onClick={() => setStyle("tiered")}
          className={`rounded-xl border px-3 py-2 text-left text-xs font-semibold transition ${
            activeStyle === "tiered"
              ? "border-sky-400/50 bg-sky-500/10 text-sky-800 dark:text-sky-200"
              : "border-[var(--panel-border)] bg-[var(--panel)]/70 text-[var(--foreground)]/80"
          }`}
        >
          Tiered
        </button>
        <button
          type="button"
          onClick={() => setStyle("katarakti")}
          className={`rounded-xl border px-3 py-2 text-left text-xs font-semibold transition ${
            activeStyle === "katarakti"
              ? "border-amber-400/50 bg-amber-500/10 text-amber-800 dark:text-amber-200"
              : "border-[var(--panel-border)] bg-[var(--panel)]/70 text-[var(--foreground)]/80"
          }`}
        >
          Katarakti
        </button>
      </div>

      {activeStyle === "katarakti" ? (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setMarket("crypto_futures")}
              className={`rounded-xl border px-3 py-2 text-left text-xs font-semibold transition ${
                activeMarket === "crypto_futures"
                  ? "border-amber-400/50 bg-amber-500/10 text-amber-800 dark:text-amber-200"
                  : "border-[var(--panel-border)] bg-[var(--panel)]/70 text-[var(--foreground)]/80 hover:border-amber-400/50"
              }`}
            >
              Crypto Futures
            </button>
            <button
              type="button"
              onClick={() => setMarket("mt5_forex")}
              className={`rounded-xl border px-3 py-2 text-left text-xs font-semibold transition ${
                activeMarket === "mt5_forex"
                  ? "border-teal-400/50 bg-teal-500/10 text-teal-800 dark:text-teal-200"
                  : "border-[var(--panel-border)] bg-[var(--panel)]/70 text-[var(--foreground)]/80 hover:border-teal-400/50"
              }`}
            >
              CFD
            </button>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => setVariant("core")}
              className={`rounded-xl border px-3 py-2 text-left text-xs font-semibold transition ${
                activeVariant === "core"
                  ? "border-[var(--accent)]/40 bg-[var(--accent)]/10 text-[var(--accent-strong)]"
                  : "border-[var(--panel-border)] bg-[var(--panel)]/70 text-[var(--foreground)]/80 hover:border-[var(--accent)]/40"
              }`}
            >
              Core
            </button>
            <button
              type="button"
              onClick={() => setVariant("lite")}
              className={`rounded-xl border px-3 py-2 text-left text-xs font-semibold transition ${
                activeVariant === "lite"
                  ? "border-sky-400/50 bg-sky-500/10 text-sky-800 dark:text-sky-200"
                  : "border-[var(--panel-border)] bg-[var(--panel)]/70 text-[var(--foreground)]/80 hover:border-sky-400/50"
              }`}
            >
              Lite
            </button>
            <button
              type="button"
              onClick={() => setVariant("v3")}
              className={`rounded-xl border px-3 py-2 text-left text-xs font-semibold transition ${
                activeVariant === "v3"
                  ? "border-fuchsia-400/50 bg-fuchsia-500/10 text-fuchsia-800 dark:text-fuchsia-200"
                  : "border-[var(--panel-border)] bg-[var(--panel)]/70 text-[var(--foreground)]/80 hover:border-fuchsia-400/50"
              }`}
            >
              v3
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={() => setSystem("v1")}
            className={`rounded-xl border px-3 py-2 text-left text-xs font-semibold transition ${
              activeTab === "v1"
                ? "border-[var(--accent)]/40 bg-[var(--accent)]/10 text-[var(--accent-strong)]"
                : "border-[var(--panel-border)] bg-[var(--panel)]/70 text-[var(--foreground)]/80 hover:border-[var(--accent)]/40"
            }`}
          >
            Universal V1
          </button>
          <button
            type="button"
            onClick={() => setSystem("v2")}
            className={`rounded-xl border px-3 py-2 text-left text-xs font-semibold transition ${
              activeTab === "v2"
                ? "border-emerald-400/50 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200"
                : "border-[var(--panel-border)] bg-[var(--panel)]/70 text-[var(--foreground)]/80 hover:border-emerald-400/50"
            }`}
          >
            Universal V2
          </button>
          <button
            type="button"
            onClick={() => setSystem("v3")}
            className={`rounded-xl border px-3 py-2 text-left text-xs font-semibold transition ${
              activeTab === "v3"
                ? "border-cyan-400/50 bg-cyan-500/10 text-cyan-800 dark:text-cyan-200"
                : "border-[var(--panel-border)] bg-[var(--panel)]/70 text-[var(--foreground)]/80 hover:border-cyan-400/50"
            }`}
          >
            Universal V3
          </button>
        </div>
      )}

      <div className={activeCardClass}>
        <div className="mb-3 flex items-center justify-between">
          <div className={`text-sm font-semibold ${valueClass}`}>{activeLabel}</div>
          <div className={badgeClass}>{activeBadge}</div>
        </div>

        <div className="mb-4 space-y-3">
          <div className="grid grid-cols-2 gap-3 text-[9px] uppercase tracking-[0.15em]">
            <div>
              <div className={labelClass}>Total Return</div>
              <div className={`mt-1 text-sm font-semibold ${valueClass}`}>
                {formatSignedPercent(activeMetrics.totalReturn)}
              </div>
            </div>
            <div>
              <div className={labelClass}>Max DD</div>
              <div className={`mt-1 text-sm font-semibold ${valueClass}`}>
                {formatPercentOrDash(activeMetrics.maxDrawdown)}
              </div>
            </div>
          </div>
          <div className={`text-center text-2xl font-bold ${valueClass}`}>
            {formatSignedPercent(activeMetrics.totalReturn)}
          </div>
          <div className={`text-center text-[10px] uppercase tracking-[0.2em] ${labelClass}`}>
            Total return
          </div>
          {activeStyle === "tiered" ? (
            <div className={`text-center text-[9px] uppercase tracking-[0.15em] ${labelClass}`}>
              Scaled to universal margin
            </div>
          ) : null}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className={`text-sm font-semibold ${valueClass}`}>
              {activeMetrics.winRate.toFixed(0)}%
            </div>
            <div className={`text-[9px] uppercase tracking-[0.15em] ${labelClass}`}>
              Weekly Win
            </div>
          </div>
          <div>
            <div className={`text-sm font-semibold ${valueClass}`}>
              {activeMetrics.weeks}
            </div>
            <div className={`text-[9px] uppercase tracking-[0.15em] ${labelClass}`}>
              Weeks
            </div>
          </div>
          <div>
            <div className={`text-sm font-semibold ${sharpeValueClass}`}>
              {activeMetrics.sharpe.toFixed(2)}
            </div>
            <div className={`text-[9px] uppercase tracking-[0.15em] ${labelClass}`}>
              {sharpeLabel}
            </div>
          </div>
          <div>
            <div className={`text-sm font-semibold ${valueClass}`}>
              {formatSignedPercent(activeMetrics.avgWeekly)}
            </div>
            <div className={`text-[9px] uppercase tracking-[0.15em] ${labelClass}`}>
              Avg Weekly
            </div>
          </div>
        </div>

        <div className="my-3 h-px bg-[var(--panel-border)]/70" />

        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className={`text-sm font-semibold ${valueClass}`}>
              {activeMetrics.tradeWinRate.toFixed(1)}%
            </div>
            <div className={`text-[9px] uppercase tracking-[0.15em] ${labelClass}`}>
              Trade Win
            </div>
          </div>
          <div>
            <div className={`text-sm font-semibold ${valueClass}`}>
              {activeMetrics.avgTrade !== null
                ? formatSignedPercent(activeMetrics.avgTrade, 2)
                : "—"}
            </div>
            <div className={`text-[9px] uppercase tracking-[0.15em] ${labelClass}`}>
              Avg Trade
            </div>
          </div>
          <div>
            <div className={`text-sm font-semibold ${valueClass}`}>
              {activeMetrics.trades}
            </div>
            <div className={`text-[9px] uppercase tracking-[0.15em] ${labelClass}`}>
              Trades
            </div>
          </div>
          <div>
            <div className={`text-sm font-semibold ${valueClass}`}>
              {formatProfitFactor(activeMetrics.profitFactor, activeMetrics.profitFactorInfinite)}
            </div>
            <div className={`text-[9px] uppercase tracking-[0.15em] ${labelClass}`}>
              Profit Factor
            </div>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="rounded-2xl border border-[var(--panel-border)]/50 bg-[var(--panel)]/40 px-3 py-2 text-center">
          <div className="text-xs font-semibold text-[var(--foreground)]">Loading comparison...</div>
          <div className="text-[9px] uppercase tracking-[0.15em] text-[color:var(--muted)]">
            Fetching snapshot metrics
          </div>
        </div>
      ) : null}

      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50/80 px-3 py-2 text-center">
          <div className="text-xs font-semibold text-rose-700">Failed to load comparison data</div>
          <div className="text-[9px] uppercase tracking-[0.15em] text-rose-600">
            {error}
          </div>
        </div>
      ) : null}

      {!loading && !error && !hasHistoricalData ? (
        <div className="rounded-2xl border border-[var(--panel-border)]/50 bg-[var(--panel)]/40 px-3 py-2 text-center">
          <div className="text-xs font-semibold text-[var(--foreground)]">No closed weeks available yet</div>
          <div className="text-[9px] uppercase tracking-[0.15em] text-[color:var(--muted)]">
            Waiting for historical snapshots
          </div>
        </div>
      ) : null}

      {!loading && !error && activeStyle !== "katarakti" && activeTab !== "v1" ? (
        <div className="rounded-2xl border border-[var(--panel-border)]/50 bg-[var(--panel)]/40 px-3 py-2 text-center">
          <div className="text-xs font-semibold text-[var(--foreground)]">
            {activeMetrics.totalReturn > v1Metrics.totalReturn ? "↑" : "↓"}{" "}
            {Math.abs(activeMetrics.totalReturn - v1Metrics.totalReturn).toFixed(2)}%
          </div>
          <div className="text-[9px] uppercase tracking-[0.15em] text-[color:var(--muted)]">
            {activeTab.toUpperCase()} vs V1 Delta
          </div>
        </div>
      ) : null}
    </div>
  );
}
