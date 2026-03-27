/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: matrix/page.tsx
 *
 * Description:
 * Consolidated matrix workspace hosting the CFD, Crypto, and
 * Flagship pills on a single route. Uses the same shared week
 * switching logic as Sentiment/Antikythera/Performance sections.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import DashboardLayout from "@/components/DashboardLayout";
import CryptoBoard from "@/components/flagship/CryptoBoard";
import FlagshipBoard from "@/components/flagship/FlagshipBoard";
import SwingForwardBoard from "@/components/flagship/SwingForwardBoard";
import MatrixControls from "@/components/matrix/MatrixControls";
import { resolveCanonicalFlagships } from "@/lib/performance/canonicalFlagships";
import { resolveWeekSelection } from "@/lib/weekOptions";
import { getDisplayWeekOpenUtc } from "@/lib/weekAnchor";
import { listDataSectionWeeks } from "@/lib/dataSectionWeeks";

export const dynamic = "force-dynamic";

type MatrixPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function resolveTab(value: string | string[] | undefined) {
  if (typeof value !== "string") return "cfd" as const;
  const normalized = value.toLowerCase();
  if (normalized === "crypto" || normalized === "flagship") return normalized;
  return "cfd" as const;
}

async function resolveWeeklyFlagshipView() {
  try {
    const flagships = await resolveCanonicalFlagships();
    return {
      strategyName: flagships.weekly.strategyName,
      sourceLabel:
        flagships.weekly.status === "locked"
          ? flagships.weekly.sourceLabel
          : "Awaiting canonical flagship selection",
    };
  } catch {
    return {
      strategyName: "Awaiting canonical data",
      sourceLabel: "Awaiting canonical flagship selection",
    };
  }
}

export default async function MatrixPage({ searchParams }: MatrixPageProps) {
  const resolvedSearchParams = (await Promise.resolve(searchParams)) ?? {};
  const selectedTab = resolveTab(resolvedSearchParams.tab);
  const weekParam = resolvedSearchParams.week;
  const weekValue = Array.isArray(weekParam) ? weekParam[0] : weekParam;

  // Shared week switching — same logic as Sentiment/Antikythera
  const currentWeekOpen = getDisplayWeekOpenUtc();
  const weeks = await listDataSectionWeeks();
  const selectedWeek = resolveWeekSelection({
    requestedWeek: weekValue,
    weekOptions: weeks,
    currentWeekOpenUtc: currentWeekOpen,
    allowAll: false,
  }) as string | null;

  const weeklyFlagshipView = await resolveWeeklyFlagshipView();

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
          <FlagshipBoard strategy={weeklyFlagshipView.strategyName} weekOpenUtc={selectedWeek} />
        ) : null}
        {selectedTab === "flagship" && weeklyFlagshipView ? (
          <SwingForwardBoard
            strategyName={weeklyFlagshipView.strategyName}
            sourceLabel={weeklyFlagshipView.sourceLabel}
          />
        ) : null}
      </div>
    </DashboardLayout>
  );
}
