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
import CryptoBoard from "@/components/flagship/CryptoBoard";
import FlagshipBoard from "@/components/flagship/FlagshipBoard";
import MatrixControls from "@/components/matrix/MatrixControls";
import { buildDataWeekOptions, resolveWeekSelection } from "@/lib/weekOptions";
import { getDisplayWeekOpenUtc } from "@/lib/weekAnchor";
import { listDataSectionWeeks } from "@/lib/dataSectionWeeks";

export const dynamic = "force-dynamic";

type MatrixPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function resolveTab(value: string | string[] | undefined) {
  if (typeof value !== "string") return "cfd" as const;
  const normalized = value.toLowerCase();
  if (normalized === "crypto") return normalized;
  return "cfd" as const;
}

export default async function MatrixPage({ searchParams }: MatrixPageProps) {
  const resolvedSearchParams = (await Promise.resolve(searchParams)) ?? {};
  const selectedTab = resolveTab(resolvedSearchParams.tab);
  const weekParam = resolvedSearchParams.week;
  const weekValue = Array.isArray(weekParam) ? weekParam[0] : weekParam;

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

  return (
    <DashboardLayout>
      <div className="space-y-4">
        <MatrixControls
          weeks={weeks}
          selectedWeek={selectedWeek}
          currentWeekOpen={currentWeekOpen}
          selectedTab={selectedTab}
        />

        {selectedTab === "crypto" ? <CryptoBoard weekOpenUtc={selectedWeek} /> : null}
        {selectedTab === "cfd" ? (
          <FlagshipBoard weekOpenUtc={selectedWeek} currentWeekOpenUtc={currentWeekOpen} />
        ) : null}
      </div>
    </DashboardLayout>
  );
}
