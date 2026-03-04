/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: PerformanceComparisonPanel.tsx
 *
 * Description:
 * Registry-driven comparison panel for Universal, Tiered, and Katarakti
 * strategies using the legacy comparison API response shape.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/
"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  PERFORMANCE_FAMILY_META,
  getPerformanceFamilyTabGroups,
  listPerformanceStrategyEntries,
  listPerformanceStrategyEntriesByFamily,
  resolveActiveStrategyEntry,
  resolveComparisonSourceKey,
  type PerformanceStrategyEntry,
  type PerformanceStrategyFamily,
} from "@/lib/performance/strategyRegistry";

type KataraktiMarket = "crypto_futures" | "mt5_forex";
type KataraktiVariant = "core" | "lite" | "v3";
type SystemVersion = "v1" | "v2" | "v3";

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

type ComparisonSourceMeta = {
  mode:
    | "strategy_backtest_db"
    | "performance_snapshots"
    | "tiered_derived"
    | "katarakti_snapshot"
    | "unavailable";
  sourcePath: string;
  fallbackLabel?: string | null;
  fallbackToAllTime?: boolean;
};

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
  sources?: {
    universal: {
      v1: ComparisonSourceMeta;
      v2: ComparisonSourceMeta;
      v3: ComparisonSourceMeta;
    };
    tiered: {
      v1: ComparisonSourceMeta;
      v2: ComparisonSourceMeta;
      v3: ComparisonSourceMeta;
    };
    katarakti: {
      core: {
        crypto_futures: ComparisonSourceMeta;
        mt5_forex: ComparisonSourceMeta;
      };
      lite: {
        crypto_futures: ComparisonSourceMeta;
        mt5_forex: ComparisonSourceMeta;
      };
      v3: {
        crypto_futures: ComparisonSourceMeta;
        mt5_forex: ComparisonSourceMeta;
      };
    };
  };
};

const WEEKLY_SHARPE_GOOD_THRESHOLD = 1;
const ANNUALIZED_SHARPE_GOOD_THRESHOLD = 7;

const EMPTY_METRICS: ComparisonMetrics = {
  totalReturn: 0,
  weeks: 0,
  winRate: 0,
  sharpe: 0,
  avgWeekly: 0,
  maxDrawdown: null,
  trades: 0,
  tradeWinRate: 0,
  avgTrade: null,
  profitFactor: null,
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

function buildSourceLabel(source: ComparisonSourceMeta | null | undefined) {
  if (!source) return "Source unavailable";
  const fallbackSuffix = source.fallbackToAllTime ? " (all-time fallback)" : "";
  if (source.mode === "strategy_backtest_db") {
    return `Source: backtest DB${fallbackSuffix}`;
  }
  if (source.mode === "tiered_derived") {
    return "Source: derived from performance snapshots";
  }
  if (source.mode === "katarakti_snapshot") {
    if (source.fallbackLabel && source.fallbackLabel.trim().length > 0) {
      return `Source: ${source.fallbackLabel}`;
    }
    return "Source: Katarakti snapshot";
  }
  if (source.mode === "performance_snapshots") {
    return "Source: performance snapshots";
  }
  return "Source unavailable";
}

function parseRequestedSystem(value: string | null): SystemVersion {
  return value === "v2" || value === "v3" ? value : "v1";
}

function parseRequestedFamily(value: string | null): PerformanceStrategyFamily {
  if (value === "tiered" || value === "katarakti") return value;
  return "universal";
}

function parseRequestedKataraktiVariant(value: string | null): KataraktiVariant {
  if (value === "lite" || value === "v3") return value;
  return "core";
}

function parseRequestedKataraktiMarket(value: string | null): KataraktiMarket | undefined {
  if (value === "crypto_futures" || value === "mt5_forex") return value;
  return undefined;
}

function getMetricsForEntry(data: ComparisonData | null, entry: PerformanceStrategyEntry | null): ComparisonMetrics {
  if (!data || !entry) return EMPTY_METRICS;
  const key = resolveComparisonSourceKey(entry);
  if (!key) return EMPTY_METRICS;
  if (key.family === "universal" && key.systemVersion) {
    return data.universal?.[key.systemVersion] ?? data[key.systemVersion] ?? EMPTY_METRICS;
  }
  if (key.family === "tiered" && key.systemVersion) {
    return data.tiered?.[key.systemVersion] ?? EMPTY_METRICS;
  }
  if (key.family === "katarakti" && key.kataraktiVariant && key.kataraktiMarket) {
    return data.katarakti?.[key.kataraktiVariant]?.[key.kataraktiMarket] ?? EMPTY_METRICS;
  }
  return EMPTY_METRICS;
}

function getSourceForEntry(data: ComparisonData | null, entry: PerformanceStrategyEntry | null) {
  if (!data || !entry) return null;
  const key = resolveComparisonSourceKey(entry);
  if (!key) return null;
  if (key.family === "universal" && key.systemVersion) {
    return data.sources?.universal?.[key.systemVersion] ?? null;
  }
  if (key.family === "tiered" && key.systemVersion) {
    return data.sources?.tiered?.[key.systemVersion] ?? null;
  }
  if (key.family === "katarakti" && key.kataraktiVariant && key.kataraktiMarket) {
    return data.sources?.katarakti?.[key.kataraktiVariant]?.[key.kataraktiMarket] ?? null;
  }
  return null;
}

function marketLabel(market: KataraktiMarket) {
  return market === "mt5_forex" ? "CFD" : "Crypto Futures";
}

function marketSort(a: KataraktiMarket, b: KataraktiMarket) {
  if (a === b) return 0;
  if (a === "crypto_futures") return -1;
  return 1;
}

export default function PerformanceComparisonPanel() {
  const searchParams = useSearchParams();
  const [data, setData] = useState<ComparisonData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const requestedWeek = searchParams.get("week") ?? "all";
  const initialFamily = parseRequestedFamily(searchParams.get("style"));
  const initialSystemVersion = parseRequestedSystem(searchParams.get("system"));
  const initialVariant = parseRequestedKataraktiVariant(searchParams.get("variant"));
  const initialMarket = parseRequestedKataraktiMarket(searchParams.get("market"));
  const initialKataraktiEntry = resolveActiveStrategyEntry({
    family: "katarakti",
    kataraktiVariant: initialVariant,
    // Explicitly pass market only when provided in URL so v3 defaults to crypto.
    kataraktiMarket: initialMarket,
  });

  const [activeFamily, setActiveFamily] = useState<PerformanceStrategyFamily>(initialFamily);
  const [activeSystemVersion, setActiveSystemVersion] = useState<SystemVersion>(initialSystemVersion);
  const [activeKataraktiVariant, setActiveKataraktiVariant] = useState<KataraktiVariant>(
    initialKataraktiEntry?.kataraktiVariant ?? initialVariant,
  );
  const [activeKataraktiMarket, setActiveKataraktiMarket] = useState<KataraktiMarket>(
    initialKataraktiEntry?.market ?? "crypto_futures",
  );

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
        setData(json as ComparisonData);
      } catch (err) {
        console.error("PerformanceComparisonPanel error:", err);
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [requestedWeek]);

  const familyEntriesByFamily = useMemo(
    () => ({
      universal: listPerformanceStrategyEntriesByFamily("universal"),
      tiered: listPerformanceStrategyEntriesByFamily("tiered"),
      katarakti: listPerformanceStrategyEntriesByFamily("katarakti"),
    }),
    [],
  );

  const activeEntry = resolveActiveStrategyEntry({
    family: activeFamily,
    systemVersion: activeSystemVersion,
    kataraktiVariant: activeKataraktiVariant,
    kataraktiMarket: activeKataraktiMarket,
  });
  const activeMetrics = getMetricsForEntry(data, activeEntry);
  const activeSourceLabel = buildSourceLabel(getSourceForEntry(data, activeEntry));

  const hasHistoricalData = listPerformanceStrategyEntries().some(
    (entry) => getMetricsForEntry(data, entry).weeks > 0,
  );
  const sharpeLabel = activeMetrics.sharpeAnnualized ? "Sharpe (Ann.)" : "Sharpe (Wk)";
  const sharpeGoodThreshold = activeMetrics.sharpeAnnualized
    ? ANNUALIZED_SHARPE_GOOD_THRESHOLD
    : WEEKLY_SHARPE_GOOD_THRESHOLD;
  const sharpeValueClass =
    activeMetrics.sharpe > sharpeGoodThreshold
      ? "text-emerald-700 dark:text-emerald-300"
      : activeEntry?.theme.valueClass ?? "text-[var(--foreground)]";

  const baselineEntry =
    activeFamily === "katarakti" || activeEntry?.systemVersion === "v1"
      ? null
      : resolveActiveStrategyEntry({
          family: activeFamily,
          systemVersion: "v1",
        });
  const baselineMetrics = getMetricsForEntry(data, baselineEntry);
  const showDelta = Boolean(
    !loading
    && !error
    && activeFamily !== "katarakti"
    && activeEntry?.systemVersion
    && activeEntry.systemVersion !== "v1",
  );

  const setFamily = (next: PerformanceStrategyFamily) => {
    setActiveFamily(next);
    const url = new URL(window.location.href);
    url.searchParams.set("style", next);
    if (next === "katarakti") {
      const resolved = resolveActiveStrategyEntry({
        family: "katarakti",
        kataraktiVariant: activeKataraktiVariant,
        kataraktiMarket: activeKataraktiMarket,
      });
      const market = resolved?.market ?? activeKataraktiMarket;
      const variant = resolved?.kataraktiVariant ?? activeKataraktiVariant;
      setActiveKataraktiMarket(market);
      setActiveKataraktiVariant(variant);
      url.searchParams.set("market", market);
      url.searchParams.set("variant", variant);
    } else {
      url.searchParams.delete("market");
      url.searchParams.delete("variant");
    }
    window.history.replaceState(window.history.state, "", `${url.pathname}?${url.searchParams.toString()}`);
    window.dispatchEvent(new CustomEvent("performance-style-change", { detail: next }));
  };

  const setSystemVersion = (next: SystemVersion) => {
    setActiveSystemVersion(next);
    const url = new URL(window.location.href);
    url.searchParams.set("style", activeFamily);
    url.searchParams.set("system", next);
    window.history.replaceState(window.history.state, "", `${url.pathname}?${url.searchParams.toString()}`);
    window.dispatchEvent(new CustomEvent("performance-system-change", { detail: next }));
  };

  const setKataraktiMarket = (next: KataraktiMarket) => {
    const resolved = resolveActiveStrategyEntry({
      family: "katarakti",
      kataraktiVariant: activeKataraktiVariant,
      kataraktiMarket: next,
    });
    const market = resolved?.market ?? next;
    const variant = resolved?.kataraktiVariant ?? activeKataraktiVariant;
    setActiveKataraktiMarket(market);
    setActiveKataraktiVariant(variant);
    const url = new URL(window.location.href);
    url.searchParams.set("style", "katarakti");
    url.searchParams.set("market", market);
    url.searchParams.set("variant", variant);
    window.history.replaceState(window.history.state, "", `${url.pathname}?${url.searchParams.toString()}`);
    window.dispatchEvent(new CustomEvent("performance-katarakti-market-change", { detail: market }));
    window.dispatchEvent(new CustomEvent("performance-katarakti-variant-change", { detail: variant }));
  };

  const setKataraktiVariant = (next: KataraktiVariant) => {
    const resolved = resolveActiveStrategyEntry({
      family: "katarakti",
      kataraktiVariant: next,
      kataraktiMarket: activeKataraktiMarket,
    });
    const market = resolved?.market ?? activeKataraktiMarket;
    const variant = resolved?.kataraktiVariant ?? next;
    setActiveKataraktiMarket(market);
    setActiveKataraktiVariant(variant);
    const url = new URL(window.location.href);
    url.searchParams.set("style", "katarakti");
    url.searchParams.set("market", market);
    url.searchParams.set("variant", variant);
    window.history.replaceState(window.history.state, "", `${url.pathname}?${url.searchParams.toString()}`);
    window.dispatchEvent(new CustomEvent("performance-katarakti-market-change", { detail: market }));
    window.dispatchEvent(new CustomEvent("performance-katarakti-variant-change", { detail: variant }));
  };

  const activeTheme = activeEntry?.theme;
  const activeLabel = activeEntry?.label ?? "Strategy";
  const activeBadge = activeEntry?.badge ?? "N/A";
  const familyTabs: PerformanceStrategyFamily[] = ["universal", "tiered", "katarakti"];
  const systemGroups = getPerformanceFamilyTabGroups(activeFamily === "katarakti" ? "universal" : activeFamily);
  const kataraktiMarkets = Array.from(
    new Set(
      familyEntriesByFamily.katarakti
        .map((entry) => entry.market)
        .filter((market): market is KataraktiMarket => market === "crypto_futures" || market === "mt5_forex"),
    ),
  ).sort(marketSort);
  const kataraktiTabs = getPerformanceFamilyTabGroups("katarakti");

  return (
    <div className="flex-1 space-y-4 p-4">
      <div className="mb-2">
        <div className="text-[10px] uppercase tracking-[0.2em] text-[color:var(--muted)]">
          System Comparison
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {familyTabs.map((family) => {
          const meta = PERFORMANCE_FAMILY_META[family];
          const isActive = activeFamily === family;
          return (
            <button
              key={family}
              type="button"
              onClick={() => setFamily(family)}
              className={`rounded-xl border px-3 py-2 text-left text-xs font-semibold transition ${
                isActive
                  ? meta.tabActiveClass
                  : "border-[var(--panel-border)] bg-[var(--panel)]/70 text-[var(--foreground)]/80"
              }`}
            >
              {meta.label}
            </button>
          );
        })}
      </div>

      {activeFamily === "katarakti" ? (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            {kataraktiMarkets.map((market) => {
              const marketEntry = resolveActiveStrategyEntry({
                family: "katarakti",
                kataraktiVariant: activeKataraktiVariant,
                kataraktiMarket: market,
              });
              const marketTheme = marketEntry?.theme ?? activeTheme;
              const isActive = market === activeKataraktiMarket;
              return (
                <button
                  key={market}
                  type="button"
                  onClick={() => setKataraktiMarket(market)}
                  className={`rounded-xl border px-3 py-2 text-left text-xs font-semibold transition ${
                    isActive
                      ? marketTheme?.tabActiveClass ?? "border-[var(--accent)]/40 bg-[var(--accent)]/10 text-[var(--accent-strong)]"
                      : "border-[var(--panel-border)] bg-[var(--panel)]/70 text-[var(--foreground)]/80"
                  } ${marketTheme?.tabInactiveHoverClass ?? ""}`}
                >
                  {marketLabel(market)}
                </button>
              );
            })}
          </div>
          <div className="grid grid-cols-3 gap-2">
            {kataraktiTabs.map((tab) => {
              const tabVariant = tab.tabId as KataraktiVariant;
              const tabEntry = resolveActiveStrategyEntry({
                family: "katarakti",
                kataraktiVariant: tabVariant,
                kataraktiMarket: activeKataraktiMarket,
              });
              const isActive = activeKataraktiVariant === tabVariant;
              const tabTheme = tabEntry?.theme ?? activeTheme;
              return (
                <button
                  key={tab.tabId}
                  type="button"
                  onClick={() => setKataraktiVariant(tabVariant)}
                  className={`rounded-xl border px-3 py-2 text-left text-xs font-semibold transition ${
                    isActive
                      ? tabTheme?.tabActiveClass ?? "border-[var(--accent)]/40 bg-[var(--accent)]/10 text-[var(--accent-strong)]"
                      : "border-[var(--panel-border)] bg-[var(--panel)]/70 text-[var(--foreground)]/80"
                  } ${tabTheme?.tabInactiveHoverClass ?? ""}`}
                >
                  {tab.tabLabel}
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {systemGroups.map((group) => {
            const version = group.tabId as SystemVersion;
            const groupEntry = resolveActiveStrategyEntry({
              family: activeFamily,
              systemVersion: version,
            });
            const isActive = activeSystemVersion === version;
            const groupTheme = groupEntry?.theme ?? activeTheme;
            return (
              <button
                key={group.tabId}
                type="button"
                onClick={() => setSystemVersion(version)}
                className={`rounded-xl border px-3 py-2 text-left text-xs font-semibold transition ${
                  isActive
                    ? groupTheme?.tabActiveClass ?? "border-[var(--accent)]/40 bg-[var(--accent)]/10 text-[var(--accent-strong)]"
                    : "border-[var(--panel-border)] bg-[var(--panel)]/70 text-[var(--foreground)]/80"
                } ${groupTheme?.tabInactiveHoverClass ?? ""}`}
              >
                {group.tabLabel}
              </button>
            );
          })}
        </div>
      )}

      <div className={activeTheme?.cardClass ?? "rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)]/80 p-4"}>
        <div className="mb-3 flex items-center justify-between">
          <div className={`text-sm font-semibold ${activeTheme?.valueClass ?? "text-[var(--foreground)]"}`}>{activeLabel}</div>
          <div className={activeTheme?.badgeClass ?? "rounded-full bg-[var(--accent)]/10 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.15em] text-[var(--accent-strong)]"}>{activeBadge}</div>
        </div>
        <div className={`mb-2 text-[9px] uppercase tracking-[0.15em] ${activeTheme?.labelClass ?? "text-[color:var(--muted)]"}`}>
          {activeSourceLabel}
        </div>

        <div className="mb-4 space-y-3">
          <div className="grid grid-cols-2 gap-3 text-[9px] uppercase tracking-[0.15em]">
            <div>
              <div className={activeTheme?.labelClass ?? "text-[color:var(--muted)]"}>Total Return</div>
              <div className={`mt-1 text-sm font-semibold ${activeTheme?.valueClass ?? "text-[var(--foreground)]"}`}>
                {formatSignedPercent(activeMetrics.totalReturn)}
              </div>
            </div>
            <div>
              <div className={activeTheme?.labelClass ?? "text-[color:var(--muted)]"}>Max DD</div>
              <div className={`mt-1 text-sm font-semibold ${activeTheme?.valueClass ?? "text-[var(--foreground)]"}`}>
                {formatPercentOrDash(activeMetrics.maxDrawdown)}
              </div>
            </div>
          </div>
          <div className={`text-center text-2xl font-bold ${activeTheme?.valueClass ?? "text-[var(--foreground)]"}`}>
            {formatSignedPercent(activeMetrics.totalReturn)}
          </div>
          <div className={`text-center text-[10px] uppercase tracking-[0.2em] ${activeTheme?.labelClass ?? "text-[color:var(--muted)]"}`}>
            Total return
          </div>
          {activeFamily === "tiered" ? (
            <div className={`text-center text-[9px] uppercase tracking-[0.15em] ${activeTheme?.labelClass ?? "text-[color:var(--muted)]"}`}>
              Scaled to universal margin
            </div>
          ) : null}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className={`text-sm font-semibold ${activeTheme?.valueClass ?? "text-[var(--foreground)]"}`}>
              {activeMetrics.winRate.toFixed(0)}%
            </div>
            <div className={`text-[9px] uppercase tracking-[0.15em] ${activeTheme?.labelClass ?? "text-[color:var(--muted)]"}`}>
              Weekly Win
            </div>
          </div>
          <div>
            <div className={`text-sm font-semibold ${activeTheme?.valueClass ?? "text-[var(--foreground)]"}`}>
              {activeMetrics.weeks}
            </div>
            <div className={`text-[9px] uppercase tracking-[0.15em] ${activeTheme?.labelClass ?? "text-[color:var(--muted)]"}`}>
              Weeks
            </div>
          </div>
          <div>
            <div className={`text-sm font-semibold ${sharpeValueClass}`}>
              {activeMetrics.sharpe.toFixed(2)}
            </div>
            <div className={`text-[9px] uppercase tracking-[0.15em] ${activeTheme?.labelClass ?? "text-[color:var(--muted)]"}`}>
              {sharpeLabel}
            </div>
          </div>
          <div>
            <div className={`text-sm font-semibold ${activeTheme?.valueClass ?? "text-[var(--foreground)]"}`}>
              {formatSignedPercent(activeMetrics.avgWeekly)}
            </div>
            <div className={`text-[9px] uppercase tracking-[0.15em] ${activeTheme?.labelClass ?? "text-[color:var(--muted)]"}`}>
              Avg Weekly
            </div>
          </div>
        </div>

        <div className="my-3 h-px bg-[var(--panel-border)]/70" />

        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className={`text-sm font-semibold ${activeTheme?.valueClass ?? "text-[var(--foreground)]"}`}>
              {activeMetrics.tradeWinRate.toFixed(1)}%
            </div>
            <div className={`text-[9px] uppercase tracking-[0.15em] ${activeTheme?.labelClass ?? "text-[color:var(--muted)]"}`}>
              Trade Win
            </div>
          </div>
          <div>
            <div className={`text-sm font-semibold ${activeTheme?.valueClass ?? "text-[var(--foreground)]"}`}>
              {activeMetrics.avgTrade !== null
                ? formatSignedPercent(activeMetrics.avgTrade, 2)
                : "—"}
            </div>
            <div className={`text-[9px] uppercase tracking-[0.15em] ${activeTheme?.labelClass ?? "text-[color:var(--muted)]"}`}>
              Avg Trade
            </div>
          </div>
          <div>
            <div className={`text-sm font-semibold ${activeTheme?.valueClass ?? "text-[var(--foreground)]"}`}>
              {activeMetrics.trades}
            </div>
            <div className={`text-[9px] uppercase tracking-[0.15em] ${activeTheme?.labelClass ?? "text-[color:var(--muted)]"}`}>
              Trades
            </div>
          </div>
          <div>
            <div className={`text-sm font-semibold ${activeTheme?.valueClass ?? "text-[var(--foreground)]"}`}>
              {formatProfitFactor(activeMetrics.profitFactor, activeMetrics.profitFactorInfinite)}
            </div>
            <div className={`text-[9px] uppercase tracking-[0.15em] ${activeTheme?.labelClass ?? "text-[color:var(--muted)]"}`}>
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

      {showDelta ? (
        <div className="rounded-2xl border border-[var(--panel-border)]/50 bg-[var(--panel)]/40 px-3 py-2 text-center">
          <div className="text-xs font-semibold text-[var(--foreground)]">
            {activeMetrics.totalReturn > baselineMetrics.totalReturn ? "↑" : "↓"}{" "}
            {Math.abs(activeMetrics.totalReturn - baselineMetrics.totalReturn).toFixed(2)}%
          </div>
          <div className="text-[9px] uppercase tracking-[0.15em] text-[color:var(--muted)]">
            {(activeEntry?.systemVersion ?? "v2").toUpperCase()} vs V1 Delta
          </div>
        </div>
      ) : null}
    </div>
  );
}
