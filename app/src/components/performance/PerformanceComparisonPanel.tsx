/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: PerformanceComparisonPanel.tsx
 *
 * Description:
 * Restored sidebar strategy selector for the Performance page, now
 * backed by the canonical performance report instead of the legacy
 * comparison API.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/
"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { DateTime } from "luxon";
import {
  PERFORMANCE_FAMILY_META,
  getPerformanceFamilyTabGroups,
  resolveActiveStrategyEntry,
} from "@/lib/performance/strategyRegistry";
import type { CanonicalFlagships } from "@/lib/performance/canonicalFlagships";
import type {
  CanonicalPerformanceApiModel,
  CanonicalPerformanceSystem,
} from "@/lib/performance/canonicalPerformanceReport";
import { getCanonicalWeekOpenUtc } from "@/lib/weekAnchor";

type SystemVersion = "v1" | "v2" | "v3";
type CanonicalPerformancePayload =
  | ({ unavailable?: false } & CanonicalPerformanceApiModel & { flagships: CanonicalFlagships })
  | { unavailable: true; reason: string; flagships: CanonicalFlagships };

type PerformanceComparisonPanelProps = {
  forcedFamily?: "universal" | "tiered";
  forcedSystemVersion?: SystemVersion;
  hideSelectors?: boolean;
  title?: string;
  flagshipOnly?: boolean;
  sidebarSurface?: boolean;
};

function parseRequestedSystem(value: string | null): SystemVersion {
  return value === "v2" || value === "v3" ? value : "v1";
}

function parseRequestedFamily(value: string | null): "universal" | "tiered" {
  return value === "universal" ? "universal" : "tiered";
}

function formatSignedPercent(value: number | null | undefined, digits = 2) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  const prefix = value >= 0 ? "+" : "";
  return `${prefix}${value.toFixed(digits)}%`;
}

function formatPercentOrDash(value: number | null | undefined, digits = 2) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return `${value.toFixed(digits)}%`;
}

function getSystem(
  payload: CanonicalPerformanceApiModel | null,
  family: "universal" | "tiered",
  version: SystemVersion,
  gated: boolean,
) {
  if (!payload) return null;
  const id = `${family}_${version}${gated ? "_gated" : ""}`;
  const source = gated ? payload.collections.composites.gated : payload.collections.composites.baseline;
  return source.find((entry) => entry.system === id) ?? null;
}

function buildSourceLabel(active: CanonicalPerformanceSystem | null) {
  if (!active) return "Canonical report unavailable";
  return active.isGated ? "Canonical gated reconstruction" : "Canonical baseline reconstruction";
}

function toTradeWinRate(system: CanonicalPerformanceSystem | null) {
  if (!system || system.totalTrades <= 0) return 0;
  return (system.totalWins / system.totalTrades) * 100;
}

type SidebarWeekMetrics = {
  strategyLabel: string;
  sourceLabel: string;
  returnPct: number | null;
  maxDrawdownPct: number | null;
  trades: number | null;
  winRatePct: number | null;
  weeks: number | null;
  badgeLabel: string;
};

function weekDisplayLabel(weekOpenUtc: string) {
  const parsed = DateTime.fromISO(weekOpenUtc, { zone: "utc" }).setZone("America/New_York");
  if (!parsed.isValid) return weekOpenUtc.slice(0, 10);
  const start = parsed.plus({ days: 1 }).startOf("day");
  const end = start.plus({ days: 4 });
  return `${start.toFormat("MMM dd")} - ${end.toFormat("MMM dd, yyyy")}`;
}

function computeNormalizedDrawdown(options: {
  pairSeries: Record<string, Array<{ ts: number; driftPct: number }>>;
  weightsByPair: Map<string, number>;
}) {
  const timestamps = Array.from(
    new Set(
      Object.entries(options.pairSeries).flatMap(([, series]) => series.map((point) => point.ts)),
    ),
  ).sort((left, right) => left - right);
  if (timestamps.length === 0) return null;

  const latestByPair = new Map<string, number>();
  const cursorByPair = new Map<string, number>();
  let peak = 0;
  let maxDrawdown = 0;

  for (const timestamp of timestamps) {
    for (const [pair, series] of Object.entries(options.pairSeries)) {
      let index = cursorByPair.get(pair) ?? 0;
      while (index < series.length && series[index]!.ts <= timestamp) {
        latestByPair.set(pair, series[index]!.driftPct);
        index += 1;
      }
      cursorByPair.set(pair, index);
    }

    const equity = Array.from(latestByPair.entries()).reduce((sum, [pair, driftPct]) => {
      return sum + driftPct * (options.weightsByPair.get(pair) ?? 1);
    }, 0);
    if (equity > peak) {
      peak = equity;
      continue;
    }
    const drawdown = peak - equity;
    if (drawdown > maxDrawdown) {
      maxDrawdown = drawdown;
    }
  }

  return maxDrawdown;
}

export default function PerformanceComparisonPanel({
  forcedFamily,
  forcedSystemVersion,
  hideSelectors = false,
  title = "Strategy Breakdown",
  flagshipOnly = false,
  sidebarSurface = false,
}: PerformanceComparisonPanelProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [payload, setPayload] = useState<CanonicalPerformancePayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedWeekMetrics, setSelectedWeekMetrics] = useState<SidebarWeekMetrics | null>(null);

  const requestedFamily = forcedFamily ?? parseRequestedFamily(searchParams.get("style"));
  const requestedSystem = forcedSystemVersion ?? parseRequestedSystem(searchParams.get("system"));
  const requestedWeek = searchParams.get("week");
  const [activeFamily, setActiveFamily] = useState<"universal" | "tiered">(requestedFamily);
  const [activeSystemVersion, setActiveSystemVersion] = useState<SystemVersion>(requestedSystem);

  useEffect(() => {
    setActiveFamily(requestedFamily);
  }, [requestedFamily]);

  useEffect(() => {
    setActiveSystemVersion(requestedSystem);
  }, [requestedSystem]);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch("/api/performance/report");
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        const json = await response.json();
        setPayload(json as CanonicalPerformancePayload);
      } catch (err) {
        console.error("PerformanceComparisonPanel error:", err);
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const canonicalPayload =
    payload && "unavailable" in payload && payload.unavailable
      ? null
      : (payload as CanonicalPerformanceApiModel & { flagships: CanonicalFlagships } | null);

  const activeGated = getSystem(canonicalPayload, activeFamily, activeSystemVersion, true);
  const activeBaseline = getSystem(canonicalPayload, activeFamily, activeSystemVersion, false);
  const activeSystem = activeGated ?? activeBaseline;
  const activeEntry = resolveActiveStrategyEntry({
    family: activeFamily,
    systemVersion: activeSystemVersion,
  });
  const activeTheme = activeEntry?.theme;
  const systemGroups = getPerformanceFamilyTabGroups(activeFamily);
  const returnDelta =
    activeGated && activeBaseline ? activeGated.simpleReturnPct - activeBaseline.simpleReturnPct : null;

  const sourceLabel = buildSourceLabel(activeSystem);
  const strategyLabel = activeSystem?.strategyName ?? activeEntry?.label ?? "Awaiting canonical data";
  const badgeLabel = activeSystem?.isGated ? "Gated" : "Baseline";
  const weeklyFlagshipId = canonicalPayload?.flagships.weekly.systemId ?? null;
  const activeCompositeId = activeGated?.system ?? activeBaseline?.system ?? null;
  const isWeeklyFlagship = weeklyFlagshipId === activeCompositeId;

  const cardClass = sidebarSurface
    ? "rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)]/95 p-4 shadow-sm"
    : activeTheme?.cardClass ?? "rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)]/80 p-4";
  const displayStrategyLabel = selectedWeekMetrics?.strategyLabel ?? strategyLabel;
  const displaySourceLabel = selectedWeekMetrics?.sourceLabel ?? sourceLabel;
  const displayBadgeLabel = selectedWeekMetrics?.badgeLabel ?? (isWeeklyFlagship ? "Flagship" : badgeLabel);
  const displayReturnPct = selectedWeekMetrics?.returnPct ?? (activeGated ?? activeBaseline)?.simpleReturnPct ?? null;
  const displayWinRatePct = selectedWeekMetrics?.winRatePct ?? (activeGated ?? activeBaseline)?.winRatePct ?? null;
  const displayMaxDrawdownPct = selectedWeekMetrics?.maxDrawdownPct ?? (activeGated ?? activeBaseline)?.maxDrawdownPct ?? null;
  const displayTrades = selectedWeekMetrics?.trades ?? (activeGated ?? activeBaseline)?.totalTrades ?? null;
  const displayWeeks = selectedWeekMetrics?.weeks ?? (activeGated ?? activeBaseline)?.weeks ?? null;

  useEffect(() => {
    let cancelled = false;

    async function resolveSelectedWeekMetrics() {
      if (!flagshipOnly || !requestedWeek || requestedWeek === "all") {
        setSelectedWeekMetrics(null);
        return;
      }

      const historicalWeek = activeGated?.weeklyReturns.find((row) => row.weekOpenUtc === requestedWeek) ?? null;
      if (historicalWeek) {
        setSelectedWeekMetrics({
          strategyLabel: activeGated?.strategyName ?? strategyLabel,
          sourceLabel: `Canonical gated reconstruction · week of ${weekDisplayLabel(historicalWeek.weekOpenUtc)}`,
          returnPct: historicalWeek.returnPct,
          maxDrawdownPct: historicalWeek.drawdownPct,
          trades: historicalWeek.trades,
          winRatePct:
            historicalWeek.trades > 0 ? (historicalWeek.wins / historicalWeek.trades) * 100 : null,
          weeks: 1,
          badgeLabel: "Week",
        });
        return;
      }

      const currentWeekOpenUtc = getCanonicalWeekOpenUtc();
      if (requestedWeek !== currentWeekOpenUtc) {
        setSelectedWeekMetrics(null);
        return;
      }

      try {
        const basketResponse = await fetch("/api/flagship/canonical-weekly-basket");
        if (!basketResponse.ok) {
          throw new Error(`Weekly basket HTTP ${basketResponse.status}`);
        }
        const basketPayload = await basketResponse.json() as {
          currentWeekOpenUtc: string;
          strategyName: string;
          signals: Array<{ pair: string; tier: string; direction: string; gateReasons: string[] }>;
        };
        if (basketPayload.currentWeekOpenUtc !== requestedWeek) {
          setSelectedWeekMetrics(null);
          return;
        }

        const summaryResponse = await fetch("/api/flagship/weekly-forward-summary", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            currentWeekOpenUtc: basketPayload.currentWeekOpenUtc,
            signals: basketPayload.signals,
          }),
        });
        if (!summaryResponse.ok) {
          throw new Error(`Weekly summary HTTP ${summaryResponse.status}`);
        }
        const summaryPayload = await summaryResponse.json() as {
          rows: Array<{ pair: string; tier: string; liveDriftPct: number | null }>;
          pairSeries?: Record<string, Array<{ ts: number; driftPct: number }>>;
        };

        const weightsByPair = new Map(
          basketPayload.signals.map((signal) => [signal.pair, 1]),
        );
        const normalizedReturn = summaryPayload.rows.reduce((sum, row) => {
          if (row.liveDriftPct === null) return sum;
          return sum + row.liveDriftPct * (weightsByPair.get(row.pair) ?? 1);
        }, 0);
        const pricedRows = summaryPayload.rows.filter((row) => row.liveDriftPct !== null);
        const normalizedWins = pricedRows.filter((row) => {
          const normalized = (row.liveDriftPct ?? 0) * (weightsByPair.get(row.pair) ?? 1);
          return normalized > 0;
        }).length;

        if (cancelled) return;
        setSelectedWeekMetrics({
          strategyLabel: basketPayload.strategyName,
          sourceLabel: `Frozen live weekly basket · normalized 1x · ${weekDisplayLabel(requestedWeek)}`,
          returnPct: normalizedReturn,
          maxDrawdownPct: computeNormalizedDrawdown({
            pairSeries: summaryPayload.pairSeries ?? {},
            weightsByPair,
          }),
          trades: basketPayload.signals.length,
          winRatePct: pricedRows.length > 0 ? (normalizedWins / pricedRows.length) * 100 : null,
          weeks: 1,
          badgeLabel: "Live Week",
        });
      } catch {
        if (!cancelled) {
          setSelectedWeekMetrics(null);
        }
      }
    }

    resolveSelectedWeekMetrics();

    return () => {
      cancelled = true;
    };
  }, [activeGated, flagshipOnly, requestedWeek, strategyLabel]);

  const setFamily = (next: "universal" | "tiered") => {
    if (forcedFamily) return;
    setActiveFamily(next);
    const url = new URL(window.location.href);
    url.searchParams.set("style", next);
    router.replace(`${pathname}?${url.searchParams.toString()}`, { scroll: false });
    window.dispatchEvent(new CustomEvent("performance-style-change", { detail: next }));
  };

  const setSystemVersion = (next: SystemVersion) => {
    if (forcedSystemVersion) return;
    setActiveSystemVersion(next);
    const url = new URL(window.location.href);
    url.searchParams.set("system", next);
    url.searchParams.set("style", activeFamily);
    router.replace(`${pathname}?${url.searchParams.toString()}`, { scroll: false });
    window.dispatchEvent(new CustomEvent("performance-system-change", { detail: next }));
  };

  return (
    <div className="flex-1 space-y-4 p-4">
      <div className="mb-2">
        <div className="text-[10px] uppercase tracking-[0.2em] text-[color:var(--muted)]">
          {title}
        </div>
      </div>

      {hideSelectors ? null : (
        <>
          <div className="grid grid-cols-2 gap-2">
            {(["universal", "tiered"] as const).map((family) => {
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

          <div className="grid grid-cols-3 gap-2">
            {systemGroups.map((group) => {
              const version = group.tabId as SystemVersion;
              const groupEntry = resolveActiveStrategyEntry({
                family: activeFamily,
                systemVersion: version,
              });
              const groupTheme = groupEntry?.theme ?? activeTheme;
              const isActive = activeSystemVersion === version;
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
        </>
      )}

      <div className={cardClass}>
        <div className="mb-3 flex items-center justify-between">
          <div className={`text-sm font-semibold ${activeTheme?.valueClass ?? "text-[var(--foreground)]"}`}>
            {displayStrategyLabel}
          </div>
          <div className={activeTheme?.badgeClass ?? "rounded-full bg-[var(--accent)]/10 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.15em] text-[var(--accent-strong)]"}>
            {displayBadgeLabel}
          </div>
        </div>
        <div className={`mb-2 text-[9px] uppercase tracking-[0.15em] ${activeTheme?.labelClass ?? "text-[color:var(--muted)]"}`}>
          {displaySourceLabel}
        </div>

        <div className="mb-4 space-y-3">
          {flagshipOnly ? null : (
            <div className="grid grid-cols-2 gap-3 text-[9px] uppercase tracking-[0.15em]">
              <div>
                <div className={activeTheme?.labelClass ?? "text-[color:var(--muted)]"}>Gated</div>
                <div className={`mt-1 text-sm font-semibold ${activeTheme?.valueClass ?? "text-[var(--foreground)]"}`}>
                  {formatSignedPercent(activeGated?.simpleReturnPct)}
                </div>
              </div>
              <div>
                <div className={activeTheme?.labelClass ?? "text-[color:var(--muted)]"}>Baseline</div>
                <div className={`mt-1 text-sm font-semibold ${activeTheme?.valueClass ?? "text-[var(--foreground)]"}`}>
                  {formatSignedPercent(activeBaseline?.simpleReturnPct)}
                </div>
              </div>
            </div>
          )}
          <div data-testid="comparison-return" className={`text-center text-2xl font-bold ${activeTheme?.valueClass ?? "text-[var(--foreground)]"}`}>
            {formatSignedPercent(displayReturnPct)}
          </div>
          <div className={`text-center text-[10px] uppercase tracking-[0.2em] ${activeTheme?.labelClass ?? "text-[color:var(--muted)]"}`}>
            Headline simple return
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <div data-testid="comparison-winrate" className={`text-sm font-semibold ${activeTheme?.valueClass ?? "text-[var(--foreground)]"}`}>
              {formatPercentOrDash(displayWinRatePct)}
            </div>
            <div className={`text-[9px] uppercase tracking-[0.15em] ${activeTheme?.labelClass ?? "text-[color:var(--muted)]"}`}>
              Weekly Win
            </div>
          </div>
          <div>
            <div data-testid="comparison-maxdd" className={`text-sm font-semibold ${activeTheme?.valueClass ?? "text-[var(--foreground)]"}`}>
              {formatPercentOrDash(displayMaxDrawdownPct)}
            </div>
            <div className={`text-[9px] uppercase tracking-[0.15em] ${activeTheme?.labelClass ?? "text-[color:var(--muted)]"}`}>
              Max DD
            </div>
          </div>
          <div>
            <div data-testid="comparison-trades" className={`text-sm font-semibold ${activeTheme?.valueClass ?? "text-[var(--foreground)]"}`}>
              {displayTrades ?? "—"}
            </div>
            <div className={`text-[9px] uppercase tracking-[0.15em] ${activeTheme?.labelClass ?? "text-[color:var(--muted)]"}`}>
              Trades
            </div>
          </div>
          <div>
            <div className={`text-sm font-semibold ${activeTheme?.valueClass ?? "text-[var(--foreground)]"}`}>
              {formatPercentOrDash(
                selectedWeekMetrics?.winRatePct ?? toTradeWinRate(activeGated ?? activeBaseline),
              )}
            </div>
            <div className={`text-[9px] uppercase tracking-[0.15em] ${activeTheme?.labelClass ?? "text-[color:var(--muted)]"}`}>
              Trade Win
            </div>
          </div>
        </div>

        <div className="my-3 h-px bg-[var(--panel-border)]/70" />

        <div className="space-y-2 text-xs">
          <div className="flex items-center justify-between">
            <span className={activeTheme?.labelClass ?? "text-[color:var(--muted)]"}>Weeks</span>
            <span className={activeTheme?.valueClass ?? "text-[var(--foreground)]"}>
              {displayWeeks ?? "—"}
            </span>
          </div>
          {flagshipOnly ? null : (
            <>
              <div className="flex items-center justify-between">
                <span className={activeTheme?.labelClass ?? "text-[color:var(--muted)]"}>Gated skip count</span>
                <span className={activeTheme?.valueClass ?? "text-[var(--foreground)]"}>
                  {activeGated?.gateSkippedTrades ?? 0}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className={activeTheme?.labelClass ?? "text-[color:var(--muted)]"}>Gated vs baseline</span>
                <span className={activeTheme?.valueClass ?? "text-[var(--foreground)]"}>
                  {formatSignedPercent(returnDelta)}
                </span>
              </div>
            </>
          )}
        </div>
      </div>

      {loading ? (
        <div className="rounded-2xl border border-[var(--panel-border)]/50 bg-[var(--panel)]/40 px-3 py-2 text-center">
          <div className="text-xs font-semibold text-[var(--foreground)]">Loading comparison...</div>
          <div className="text-[9px] uppercase tracking-[0.15em] text-[color:var(--muted)]">
            Fetching canonical metrics
          </div>
        </div>
      ) : null}

      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50/80 dark:bg-rose-900/20 px-3 py-2 text-center">
          <div className="text-xs font-semibold text-rose-700 dark:text-rose-300">Failed to load comparison data</div>
          <div className="text-[9px] uppercase tracking-[0.15em] text-rose-600 dark:text-rose-300">
            {error}
          </div>
        </div>
      ) : null}

      {payload && "unavailable" in payload && payload.unavailable ? (
        <div className="rounded-2xl border border-[var(--panel-border)]/50 bg-[var(--panel)]/40 px-3 py-2 text-center">
          <div className="text-xs font-semibold text-[var(--foreground)]">Canonical report unavailable</div>
          <div className="text-[9px] uppercase tracking-[0.15em] text-[color:var(--muted)]">
            {payload.reason}
          </div>
        </div>
      ) : null}
    </div>
  );
}
