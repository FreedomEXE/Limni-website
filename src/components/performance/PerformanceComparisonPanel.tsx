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
import { useSearchParams } from "next/navigation";
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

type SystemVersion = "v1" | "v2" | "v3";
type CanonicalPerformancePayload =
  | ({ unavailable?: false } & CanonicalPerformanceApiModel & { flagships: CanonicalFlagships })
  | { unavailable: true; reason: string; flagships: CanonicalFlagships };

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

export default function PerformanceComparisonPanel() {
  const searchParams = useSearchParams();
  const [payload, setPayload] = useState<CanonicalPerformancePayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const requestedFamily = parseRequestedFamily(searchParams.get("style"));
  const requestedSystem = parseRequestedSystem(searchParams.get("system"));
  const [activeFamily, setActiveFamily] = useState<"universal" | "tiered">(requestedFamily);
  const [activeSystemVersion, setActiveSystemVersion] = useState<SystemVersion>(requestedSystem);

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

  const setFamily = (next: "universal" | "tiered") => {
    setActiveFamily(next);
    const url = new URL(window.location.href);
    url.searchParams.set("style", next);
    window.history.replaceState(window.history.state, "", `${url.pathname}?${url.searchParams.toString()}`);
    window.dispatchEvent(new CustomEvent("performance-style-change", { detail: next }));
  };

  const setSystemVersion = (next: SystemVersion) => {
    setActiveSystemVersion(next);
    const url = new URL(window.location.href);
    url.searchParams.set("system", next);
    url.searchParams.set("style", activeFamily);
    window.history.replaceState(window.history.state, "", `${url.pathname}?${url.searchParams.toString()}`);
    window.dispatchEvent(new CustomEvent("performance-system-change", { detail: next }));
  };

  return (
    <div className="flex-1 space-y-4 p-4">
      <div className="mb-2">
        <div className="text-[10px] uppercase tracking-[0.2em] text-[color:var(--muted)]">
          Strategy Breakdown
        </div>
      </div>

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

      <div className={activeTheme?.cardClass ?? "rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)]/80 p-4"}>
        <div className="mb-3 flex items-center justify-between">
          <div className={`text-sm font-semibold ${activeTheme?.valueClass ?? "text-[var(--foreground)]"}`}>
            {strategyLabel}
          </div>
          <div className={activeTheme?.badgeClass ?? "rounded-full bg-[var(--accent)]/10 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.15em] text-[var(--accent-strong)]"}>
            {isWeeklyFlagship ? "Flagship" : badgeLabel}
          </div>
        </div>
        <div className={`mb-2 text-[9px] uppercase tracking-[0.15em] ${activeTheme?.labelClass ?? "text-[color:var(--muted)]"}`}>
          {sourceLabel}
        </div>

        <div className="mb-4 space-y-3">
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
          <div className={`text-center text-2xl font-bold ${activeTheme?.valueClass ?? "text-[var(--foreground)]"}`}>
            {formatSignedPercent((activeGated ?? activeBaseline)?.simpleReturnPct)}
          </div>
          <div className={`text-center text-[10px] uppercase tracking-[0.2em] ${activeTheme?.labelClass ?? "text-[color:var(--muted)]"}`}>
            Headline simple return
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className={`text-sm font-semibold ${activeTheme?.valueClass ?? "text-[var(--foreground)]"}`}>
              {formatPercentOrDash((activeGated ?? activeBaseline)?.winRatePct)}
            </div>
            <div className={`text-[9px] uppercase tracking-[0.15em] ${activeTheme?.labelClass ?? "text-[color:var(--muted)]"}`}>
              Weekly Win
            </div>
          </div>
          <div>
            <div className={`text-sm font-semibold ${activeTheme?.valueClass ?? "text-[var(--foreground)]"}`}>
              {formatPercentOrDash((activeGated ?? activeBaseline)?.maxDrawdownSimplePct)}
            </div>
            <div className={`text-[9px] uppercase tracking-[0.15em] ${activeTheme?.labelClass ?? "text-[color:var(--muted)]"}`}>
              Max DD
            </div>
          </div>
          <div>
            <div className={`text-sm font-semibold ${activeTheme?.valueClass ?? "text-[var(--foreground)]"}`}>
              {(activeGated ?? activeBaseline)?.totalTrades ?? "—"}
            </div>
            <div className={`text-[9px] uppercase tracking-[0.15em] ${activeTheme?.labelClass ?? "text-[color:var(--muted)]"}`}>
              Trades
            </div>
          </div>
          <div>
            <div className={`text-sm font-semibold ${activeTheme?.valueClass ?? "text-[var(--foreground)]"}`}>
              {formatPercentOrDash(toTradeWinRate(activeGated ?? activeBaseline))}
            </div>
            <div className={`text-[9px] uppercase tracking-[0.15em] ${activeTheme?.labelClass ?? "text-[color:var(--muted)]"}`}>
              Trade Win
            </div>
          </div>
        </div>

        <div className="my-3 h-px bg-[var(--panel-border)]/70" />

        <div className="space-y-2 text-xs">
          <div className="flex items-center justify-between">
            <span className={activeTheme?.labelClass ?? "text-[color:var(--muted)]"}>Gated skip count</span>
            <span className={activeTheme?.valueClass ?? "text-[var(--foreground)]"}>
              {activeGated?.gateSkippedTrades ?? 0}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className={activeTheme?.labelClass ?? "text-[color:var(--muted)]"}>Weeks</span>
            <span className={activeTheme?.valueClass ?? "text-[var(--foreground)]"}>
              {(activeGated ?? activeBaseline)?.weeks ?? "—"}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className={activeTheme?.labelClass ?? "text-[color:var(--muted)]"}>Gated vs baseline</span>
            <span className={activeTheme?.valueClass ?? "text-[var(--foreground)]"}>
              {formatSignedPercent(returnDelta)}
            </span>
          </div>
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
