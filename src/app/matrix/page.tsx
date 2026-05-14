/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: matrix/page.tsx
 *
 * Description:
 * Consolidated matrix workspace hosting the CFD and Crypto boards.
 * Uses the shared StrategySelector in the sidebar (same pattern as
 * Performance section). Strategy selection drives both boards.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import DashboardLayout from "@/components/DashboardLayout";
import MatrixViewSection from "@/components/matrix/MatrixViewSection";
import { getDisplayWeekOpenUtc } from "@/lib/weekAnchor";
import { normalizeFilterSelection, resolveStrategyId } from "@/lib/performance/strategyConfig";
import {
  toRuntimeStrategySelection,
} from "@/lib/performance/strategySelection";

export const dynamic = "force-dynamic";

type MatrixPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function resolveTab(value: string | string[] | undefined) {
  if (typeof value !== "string") return "cfd" as const;
  const normalized = value.toLowerCase();
  if (normalized === "risk") return normalized;
  if (normalized === "crypto") return normalized;
  return "cfd" as const;
}

export default async function MatrixPage({ searchParams }: MatrixPageProps) {
  const resolvedSearchParams = (await Promise.resolve(searchParams)) ?? {};
  const selectedTab = resolveTab(resolvedSearchParams.tab);
  const weekParam = resolvedSearchParams.week;
  const weekValue = Array.isArray(weekParam) ? weekParam[0] : weekParam;

  // Read strategy selection from URL params
  const strategyParam = resolvedSearchParams.strategy ?? resolvedSearchParams.bias;
  const strategyId = resolveStrategyId(Array.isArray(strategyParam) ? strategyParam[0] : strategyParam);
  const f1Param = resolvedSearchParams.f1 ?? resolvedSearchParams.filter;
  const f1Value = Array.isArray(f1Param) ? f1Param[0] : f1Param;
  const f2Param = resolvedSearchParams.f2;
  const f2Value = Array.isArray(f2Param) ? f2Param[0] : f2Param;
  const normalizedFilters = normalizeFilterSelection({
    f1: f1Value,
    f2: f2Value,
  });
  const initialStrategySelection = {
    strategyId,
    f1: normalizedFilters.f1,
    f2: normalizedFilters.f2,
  };

  const currentWeekOpen = getDisplayWeekOpenUtc();
  const weeks = [currentWeekOpen];
  const initialWeek = weekValue ?? null;

  return (
    <DashboardLayout>
      <MatrixViewSection
        weeks={weeks}
        initialWeek={initialWeek}
        initialWeekExplicit={Boolean(weekValue)}
        currentWeekOpenUtc={currentWeekOpen}
        initialTab={selectedTab}
        initialSelection={toRuntimeStrategySelection(initialStrategySelection)}
        initialStrategyData={null}
        initialWeeklyReturns={{}}
      />
    </DashboardLayout>
  );
}
