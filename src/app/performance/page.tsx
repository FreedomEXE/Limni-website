/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: src/app/performance/page.tsx
 *
 * Description:
 * Canonical Performance page backed by /api/performance/report.
 * Promotes the weekly flagship, keeps intraday in research, and shows
 * baseline vs gated comparisons side-by-side.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import DashboardLayout from "@/components/DashboardLayout";
import PerformanceAllSystemsTable, {
  type PerformanceSystemComparisonRow,
} from "@/components/performance/PerformanceAllSystemsTable";
import PerformanceFlagshipCard, {
  type PerformanceFlagshipCardData,
} from "@/components/performance/PerformanceFlagshipCard";
import type { CanonicalFlagships } from "@/lib/performance/canonicalFlagships";
import type {
  CanonicalPerformanceApiModel,
  CanonicalPerformanceSystem,
} from "@/lib/performance/canonicalPerformanceReport";
import { headers } from "next/headers";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type PerformanceReportPayload = CanonicalPerformanceApiModel & {
  flagships: CanonicalFlagships;
};

type GroupedComparisonRow = {
  id: string;
  strategyName: string;
  familyLabel: string;
  baseline: CanonicalPerformanceSystem | null;
  gated: CanonicalPerformanceSystem | null;
};

function getBaseSystemId(systemId: string) {
  return systemId.endsWith("_gated") ? systemId.slice(0, -"_gated".length) : systemId;
}

function formatWindow(weeks: string[]) {
  if (weeks.length === 0) return "No canonical weeks";
  return `${weeks[0]?.slice(0, 10)} to ${weeks[weeks.length - 1]?.slice(0, 10)}`;
}

function familyLabel(system: CanonicalPerformanceSystem | null) {
  if (!system) return "System";
  if (system.family === "universal") return "Universal";
  if (system.family === "tiered") return "Tiered";
  if (system.family === "model") return "Component Model";
  return system.family;
}

function buildGroupedRows(
  baselineSystems: CanonicalPerformanceSystem[],
  gatedSystems: CanonicalPerformanceSystem[],
): GroupedComparisonRow[] {
  const rows = new Map<string, GroupedComparisonRow>();

  for (const system of baselineSystems) {
    const baseId = getBaseSystemId(system.system);
    rows.set(baseId, {
      id: baseId,
      strategyName: system.strategyName.replace(/ Net Hold$/u, ""),
      familyLabel: familyLabel(system),
      baseline: system,
      gated: null,
    });
  }

  for (const system of gatedSystems) {
    const baseId = getBaseSystemId(system.system);
    const existing = rows.get(baseId);
    rows.set(baseId, {
      id: baseId,
      strategyName: existing?.strategyName ?? system.strategyName.replace(/ Net Hold Gated$/u, "").replace(/ Gated$/u, ""),
      familyLabel: existing?.familyLabel ?? familyLabel(system),
      baseline: existing?.baseline ?? null,
      gated: system,
    });
  }

  return [...rows.values()];
}

function toComparisonRows(
  rows: GroupedComparisonRow[],
  promotedSystemId: string | null,
): PerformanceSystemComparisonRow[] {
  const promotedBaseId = promotedSystemId ? getBaseSystemId(promotedSystemId) : null;
  return [...rows]
    .sort((left, right) => {
      const leftPromoted = left.id === promotedBaseId ? 1 : 0;
      const rightPromoted = right.id === promotedBaseId ? 1 : 0;
      if (leftPromoted !== rightPromoted) return rightPromoted - leftPromoted;

      const leftReturn = left.gated?.simpleReturnPct ?? left.baseline?.simpleReturnPct ?? Number.NEGATIVE_INFINITY;
      const rightReturn = right.gated?.simpleReturnPct ?? right.baseline?.simpleReturnPct ?? Number.NEGATIVE_INFINITY;
      return rightReturn - leftReturn;
    })
    .map((row) => ({
      id: row.id,
      strategyName: row.strategyName,
      familyLabel: row.familyLabel,
      promoted: row.id === promotedBaseId,
      baseline: row.baseline
        ? {
            returnPct: row.baseline.simpleReturnPct,
            winRatePct: row.baseline.winRatePct,
            maxDrawdownPct: row.baseline.maxDrawdownSimplePct,
            trades: row.baseline.totalTrades,
            weeks: row.baseline.weeks,
          }
        : null,
      gated: row.gated
        ? {
            returnPct: row.gated.simpleReturnPct,
            winRatePct: row.gated.winRatePct,
            maxDrawdownPct: row.gated.maxDrawdownSimplePct,
            trades: row.gated.totalTrades,
            weeks: row.gated.weeks,
          }
        : null,
    }));
}

function buildWeeklyCardData(
  weeklySystem: CanonicalPerformanceSystem | null,
  baselineSystem: CanonicalPerformanceSystem | null,
  flagships: CanonicalFlagships,
): PerformanceFlagshipCardData {
  return {
    id: "weekly-hold",
    heading: "Weekly Hold",
    strategyName: weeklySystem?.strategyName ?? flagships.weekly.strategyName,
    sourceLabel: flagships.weekly.sourceLabel,
    reason: flagships.weekly.reason,
    statusLabel: flagships.weekly.status === "locked" ? "Flagship" : "Provisional",
    statusTone: flagships.weekly.status === "locked" ? "positive" : "warning",
    returnPct: weeklySystem?.simpleReturnPct ?? flagships.weekly.metrics.simpleReturnPct,
    winRatePct: weeklySystem?.winRatePct ?? flagships.weekly.metrics.winRatePct,
    maxDrawdownPct:
      weeklySystem?.maxDrawdownSimplePct ?? flagships.weekly.metrics.maxDrawdownSimplePct,
    trades: weeklySystem?.totalTrades ?? flagships.weekly.metrics.trades,
    weeksCovered: weeklySystem?.weeks ?? flagships.weekly.sampleWeeks,
    weeklyRows: (weeklySystem?.weeklyReturns ?? []).map((row) => ({
      weekOpenUtc: row.weekOpenUtc,
      returnPercent: row.returnPct,
      pricedTrades: row.trades,
      wins: row.wins,
    })),
    comparison: baselineSystem
      ? {
          label: "Baseline comparison",
          returnPct: baselineSystem.simpleReturnPct,
          winRatePct: baselineSystem.winRatePct,
          maxDrawdownPct: baselineSystem.maxDrawdownSimplePct,
          trades: baselineSystem.totalTrades,
        }
      : null,
  };
}

function buildIntradayCardData(flagships: CanonicalFlagships): PerformanceFlagshipCardData {
  return {
    id: "intraday",
    heading: "Intraday",
    strategyName: flagships.intraday.strategyName,
    sourceLabel: flagships.intraday.sourceLabel,
    reason: flagships.intraday.reason,
    statusLabel: "Research",
    statusTone: "neutral",
    returnPct: null,
    winRatePct: null,
    maxDrawdownPct: null,
    trades: null,
    weeksCovered: null,
    weeklyRows: [],
    comparison: null,
  };
}

async function readPerformanceReportPayload(): Promise<PerformanceReportPayload> {
  const headerBag = await headers();
  const host = headerBag.get("x-forwarded-host") ?? headerBag.get("host");
  if (!host) {
    throw new Error("Unable to resolve host for /api/performance/report");
  }
  const protocol = headerBag.get("x-forwarded-proto") ?? (host.includes("localhost") ? "http" : "https");
  const response = await fetch(`${protocol}://${host}/api/performance/report`, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Performance report request failed with status ${response.status}`);
  }

  return response.json() as Promise<PerformanceReportPayload>;
}

export default async function PerformancePage() {
  let payload: PerformanceReportPayload | null = null;
  let loadError: string | null = null;

  try {
    payload = await readPerformanceReportPayload();
  } catch (error) {
    loadError = error instanceof Error ? error.message : "Unknown error";
  }

  if (!payload) {
    return (
      <DashboardLayout>
        <div className="rounded-2xl border border-amber-400/30 bg-amber-500/10 px-5 py-4 text-sm text-amber-200">
          Failed to load `/api/performance/report`. {loadError ?? "Canonical performance payload is unavailable."}
        </div>
      </DashboardLayout>
    );
  }

  const compositeRows = buildGroupedRows(
    payload.collections.composites.baseline,
    payload.collections.composites.gated,
  );
  const modelRows = buildGroupedRows(
    payload.collections.models.baseline,
    payload.collections.models.gated,
  );

  const weeklySystem =
    payload.collections.composites.gated.find(
      (entry) => entry.system === payload.flagships.weekly.systemId,
    ) ?? null;
  const weeklyBaselineSystem =
    payload.flagships.weekly.systemId
      ? payload.collections.composites.baseline.find(
          (entry) => entry.system === getBaseSystemId(payload.flagships.weekly.systemId ?? ""),
        ) ?? null
      : null;

  const weeklyCard = buildWeeklyCardData(weeklySystem, weeklyBaselineSystem, payload.flagships);
  const intradayCard = buildIntradayCardData(payload.flagships);

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <header className="space-y-3">
          <div>
            <h1 className="text-3xl font-semibold text-[var(--foreground)]">
              Strategy Performance
            </h1>
            <p className="mt-2 text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
              Canonical Weekly Window · {formatWindow(payload.meta.canonicalWeeks)}
            </p>
          </div>
          <div className="rounded-2xl border border-[var(--accent)]/25 bg-[var(--accent)]/8 px-4 py-3 text-sm leading-6 text-[var(--foreground)]/88">
            Simple return is the headline methodology. Gated and baseline composite systems are shown side-by-side, and the current weekly flagship is promoted with the `9-week sample` caveat intact.
          </div>
        </header>

        <div className="grid gap-6 xl:grid-cols-2">
          <PerformanceFlagshipCard data={weeklyCard} />
          <PerformanceFlagshipCard data={intradayCard} />
        </div>

        <PerformanceAllSystemsTable
          rows={toComparisonRows(compositeRows, payload.flagships.weekly.systemId)}
          id="all-systems"
          title="Composite Systems"
          description="Composite weekly systems with baseline and gated variants visible together. The promoted weekly flagship is pinned to the top."
        />

        <PerformanceAllSystemsTable
          rows={toComparisonRows(modelRows, null)}
          id="component-models"
          title="Component Models"
          description="Standalone component models remain public, but they sit behind the composite system headlines."
        />

        <footer className="rounded-2xl border border-[var(--panel-border)]/70 bg-[var(--panel)]/70 px-4 py-3 text-xs uppercase tracking-[0.18em] text-[color:var(--muted)]">
          Canonical report generated {payload.meta.generatedUtc} · methodology {payload.meta.returnMethodology} · compounded shown only as secondary in downstream views
        </footer>
      </div>
    </DashboardLayout>
  );
}
