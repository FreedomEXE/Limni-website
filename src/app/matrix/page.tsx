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
import { buildDataWeekOptions, resolveWeekSelection } from "@/lib/weekOptions";
import { getDisplayWeekOpenUtc } from "@/lib/weekAnchor";
import { listDataSectionWeeks } from "@/lib/dataSectionWeeks";
import { getWeeklyPairReturns } from "@/lib/pairReturns";
import { getEntryStyle, getStrengthGate, normalizeFilterSelection, resolveStrategyId } from "@/lib/performance/strategyConfig";
import {
  buildStrategySelectionKey,
  toRuntimeStrategySelection,
} from "@/lib/performance/strategySelection";
import { readStrategyArtifactEntry } from "@/lib/performance/strategyArtifactCache";
import { buildStrategyArtifactEngineVersion } from "@/lib/performance/strategyArtifactVersions";
import { loadStrategyPageData } from "@/lib/performance/strategyPageData";
import { toMatrixClientPayload } from "@/lib/performance/strategyClientPayload";

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
  const initialEntryStyle = getEntryStyle(initialStrategySelection.f1);
  const initialRiskOverlay = getStrengthGate(initialStrategySelection.f2);
  const initialSelectionKey = buildStrategySelectionKey(initialStrategySelection);
  const initialExpectedEngineVersion = buildStrategyArtifactEngineVersion({
    entryStyle: initialEntryStyle,
    riskOverlay: initialRiskOverlay,
  });

  // Shared week switching — same logic as Sentiment/Antikythera
  const currentWeekOpen = getDisplayWeekOpenUtc();
  const historicalWeeks = await listDataSectionWeeks();
  const weeks = buildDataWeekOptions({
    historicalWeeks,
    currentWeekOpenUtc: currentWeekOpen,
  }) as string[];
  const selectedWeek = resolveWeekSelection({
    requestedWeek: weekValue,
    weekOptions: weeks,
    currentWeekOpenUtc: currentWeekOpen,
    allowAll: false,
  }) as string | null;

  const [initialStrategyData, weeklyReturnEntries] = await Promise.all([
    initialEntryStyle?.plModel === "adr_grid"
      ? readStrategyArtifactEntry(initialSelectionKey).then((entry) => (
          entry?.fingerprint.engineVersion === initialExpectedEngineVersion
            ? loadStrategyPageData(initialStrategySelection)
            : null
        ))
      : loadStrategyPageData(initialStrategySelection),
    Promise.all(
      weeks.map(async (week) => [week, await getWeeklyPairReturns(week)] as const),
    ),
  ]);
  const allWeeklyReturns = Object.fromEntries(weeklyReturnEntries);

  return (
    <DashboardLayout>
      <MatrixViewSection
        weeks={weeks}
        initialWeek={selectedWeek}
        currentWeekOpenUtc={currentWeekOpen}
        initialTab={selectedTab}
        initialSelection={toRuntimeStrategySelection(initialStrategySelection)}
        initialStrategyData={
          initialStrategyData
            ? {
                engineWeekResults: toMatrixClientPayload(initialStrategyData).engineWeekResults,
                sidebarStats: initialStrategyData.sidebarStats ?? null,
              }
            : null
        }
        allWeeklyReturns={allWeeklyReturns}
      />
    </DashboardLayout>
  );
}
