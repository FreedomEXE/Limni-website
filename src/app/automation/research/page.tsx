/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: page.tsx
 *
 * Description:
 * Simplified research hub centered on canonical equity curves and
 * drilldown links rather than the old brittle lab-first workflow.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import DashboardLayout from "@/components/DashboardLayout";
import ViewModeControls from "@/components/common/ViewModeControls";
import AutomationResearchCards from "@/components/automation/AutomationResearchCards";
import AutomationResearchHubClient from "@/components/automation/AutomationResearchHubClient";
import {
  getCanonicalCompositeSystems,
  getCanonicalStandaloneModels,
} from "@/lib/performance/canonicalPerformanceReport";
import { resolveCanonicalFlagships } from "@/lib/performance/canonicalFlagships";

export const dynamic = "force-dynamic";

function buildSeriesColor(index: number) {
  const colors = [
    "#10b981",
    "#06b6d4",
    "#f59e0b",
    "#6366f1",
    "#ef4444",
    "#14b8a6",
    "#8b5cf6",
    "#f97316",
    "#84cc16",
    "#ec4899",
    "#3b82f6",
    "#22c55e",
  ];
  return colors[index % colors.length];
}

function buildSimpleCurveSeries(
  systems: Array<{
    system: string;
    strategyName: string;
    weeklyReturns: Array<{ weekOpenUtc: string; returnPct: number }>;
  }>,
) {
  return systems.map((system, index) => {
    let running = 0;
    return {
      id: system.system,
      label: system.strategyName,
      color: buildSeriesColor(index),
      points: system.weeklyReturns.map((row) => {
        running += row.returnPct;
        return {
          ts_utc: row.weekOpenUtc,
          equity_pct: running,
          lock_pct: null,
        };
      }),
    };
  });
}

export default async function AutomationResearchIndexPage() {
  let baselineSystems: Awaited<ReturnType<typeof getCanonicalCompositeSystems>> = [];
  let gatedSystems: Awaited<ReturnType<typeof getCanonicalCompositeSystems>> = [];
  let standaloneSystems: Awaited<ReturnType<typeof getCanonicalStandaloneModels>> = [];
  let standaloneGatedSystems: Awaited<ReturnType<typeof getCanonicalStandaloneModels>> = [];
  let flagships: Awaited<ReturnType<typeof resolveCanonicalFlagships>>;

  try {
    [baselineSystems, gatedSystems, standaloneSystems, standaloneGatedSystems, flagships] =
      await Promise.all([
        getCanonicalCompositeSystems({ isGated: false }),
        getCanonicalCompositeSystems({ isGated: true }),
        getCanonicalStandaloneModels({ isGated: false }),
        getCanonicalStandaloneModels({ isGated: true }),
        resolveCanonicalFlagships(),
      ]);
  } catch {
    flagships = await resolveCanonicalFlagships();
  }

  const flagshipSystemId = flagships.weekly.systemId ?? null;
  const flagshipBaseId = flagshipSystemId?.replace(/_gated$/, "") ?? null;
  const flagship = gatedSystems.find((entry) => entry.system === flagshipSystemId) ?? null;
  const strongestBaseline =
    [...baselineSystems].sort((a, b) => b.simpleReturnPct - a.simpleReturnPct)[0] ?? null;
  const strongestGated =
    [...gatedSystems].sort((a, b) => b.simpleReturnPct - a.simpleReturnPct)[0] ?? null;

  const componentModels = flagship
    ? standaloneSystems.filter((entry) => flagship.config.models.includes(entry.system.replace(/^model_/, "")))
    : [];
  const componentGatedModels = flagship
    ? standaloneGatedSystems.filter((entry) =>
        flagship.config.models.includes(entry.system.replace(/^model_/, "").replace(/_gated$/, "")),
      )
    : [];

  const compositeSeries = buildSimpleCurveSeries([
    ...baselineSystems,
    ...gatedSystems,
  ]);
  const flagshipFocusSeries = buildSimpleCurveSeries(
    [
      baselineSystems.find((entry) => entry.system === flagshipBaseId) ?? null,
      flagship,
      ...componentModels,
      ...componentGatedModels,
    ].filter((entry): entry is NonNullable<typeof entry> => Boolean(entry)),
  );

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-3">
            <h1 className="text-3xl font-semibold text-[var(--foreground)]">
              Research
            </h1>
            <p className="max-w-3xl text-sm leading-6 text-[color:var(--muted)]">
              Canonical research hub for strategy curves and drilldowns. This replaces the old
              lab-first entry point with a stable view of the systems that actually matter now.
            </p>
          </div>
          <ViewModeControls surface="research" size="sm" />
        </header>

        <AutomationResearchCards active="overview" />

        <section className="grid gap-4 md:grid-cols-3">
          <article className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--muted)]">
              Weekly Flagship
            </p>
            <p className="mt-3 text-xl font-semibold text-[var(--foreground)]">
              {flagships.weekly.strategyName}
            </p>
            <p className="mt-2 text-sm text-[color:var(--muted)]">
              {flagships.weekly.reason}
            </p>
          </article>
          <article className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--muted)]">
              Strongest Baseline
            </p>
            <p className="mt-3 text-xl font-semibold text-[var(--foreground)]">
              {strongestBaseline?.strategyName ?? "—"}
            </p>
            <p className="mt-2 text-sm text-[color:var(--muted)]">
              {strongestBaseline ? `${strongestBaseline.simpleReturnPct.toFixed(2)}% simple return` : "No baseline data."}
            </p>
          </article>
          <article className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--muted)]">
              Strongest Gated
            </p>
            <p className="mt-3 text-xl font-semibold text-[var(--foreground)]">
              {strongestGated?.strategyName ?? "—"}
            </p>
            <p className="mt-2 text-sm text-[color:var(--muted)]">
              {strongestGated ? `${strongestGated.simpleReturnPct.toFixed(2)}% simple return` : "No gated data."}
            </p>
          </article>
        </section>

        <AutomationResearchHubClient
          compositeSeries={compositeSeries}
          flagshipFocusSeries={flagshipFocusSeries}
          canonicalWeeks={flagships.canonicalWeeks.length}
          flagshipLabel={flagships.weekly.strategyName}
        />
      </div>
    </DashboardLayout>
  );
}
