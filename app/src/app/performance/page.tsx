/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: page.tsx
 *
 * Description:
 * Fast Performance route shell. Strategy artifacts own the heavy data path;
 * this server component only resolves URL state and mounts the client gate.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import DashboardLayout from "@/components/DashboardLayout";
import AppTruthRouteGate from "@/components/appTruth/AppTruthRouteGate";
import { getActiveBaselineSelectableWeeks } from "@/lib/appTruth/activeBaseline";
import { readActiveBaselineRouteReadiness } from "@/lib/appTruth/routeReadiness";
import type { AppTruthActiveBaselineRouteReadiness } from "@/lib/appTruth/routeReadiness";
import PerformanceStrategyViewSection from "@/components/performance/PerformanceStrategyViewSection";
import { resolvePerformanceView } from "@/lib/performance/pageState";
import {
  normalizeFilterSelection,
  resolveBiasSourceId,
} from "@/lib/performance/strategyConfig";
import { toRuntimeStrategySelection } from "@/lib/performance/strategySelection";
import { parsePerformanceAssetSelection } from "@/lib/performance/performanceAssetScope";
import { getDisplayWeekOpenUtc } from "@/lib/weekAnchor";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type PerformancePageProps = {
  searchParams?:
    | Record<string, string | string[] | undefined>
    | Promise<Record<string, string | string[] | undefined>>;
};

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

export default async function PerformancePage({ searchParams }: PerformancePageProps) {
  const resolvedSearchParams = (await Promise.resolve(searchParams)) ?? {};
  const viewParamValue = firstParam(resolvedSearchParams.view);
  const weekParamValue = firstParam(resolvedSearchParams.week);
  const scopeParamValue = firstParam(resolvedSearchParams.scope);
  const strategyParamValue = firstParam(resolvedSearchParams.strategy ?? resolvedSearchParams.bias);
  const f1Value = firstParam(resolvedSearchParams.f1 ?? resolvedSearchParams.filter);
  const f2Value = firstParam(resolvedSearchParams.f2);
  const normalizedFilters = normalizeFilterSelection({
    f1: f1Value,
    f2: f2Value,
  });
  let routeReadiness: AppTruthActiveBaselineRouteReadiness | null = null;
  let routeReadinessError: string | null = null;

  try {
    routeReadiness = await readActiveBaselineRouteReadiness();
  } catch (error) {
    routeReadinessError = errorMessage(error);
  }

  const currentWeekOpenUtc = getDisplayWeekOpenUtc();
  const selectableWeeks = getActiveBaselineSelectableWeeks(currentWeekOpenUtc);
  const initialStrategySelection = {
    strategyId: resolveBiasSourceId(strategyParamValue),
    f1: normalizedFilters.f1,
    f2: normalizedFilters.f2,
  };
  return (
    <DashboardLayout>
      <AppTruthRouteGate
        route="performance"
        readiness={routeReadiness}
        readinessError={routeReadinessError}
      >
        <div className="space-y-8">
          <PerformanceStrategyViewSection
            initialMode="legacy"
            initialView={resolvePerformanceView(viewParamValue)}
            initialSystem="v3"
            initialStyle="tiered"
            universalGridPropsBySystem={{}}
            tieredGridPropsBySystem={{}}
            universalSimulationBySystem={{}}
            tieredSimulationBySystem={{}}
            flagshipGridProps={null}
            flagshipSimulation={null}
            initialSelection={toRuntimeStrategySelection(initialStrategySelection)}
            initialEntry={null}
            weekOptions={["all", ...selectableWeeks]}
            currentWeek={currentWeekOpenUtc}
            initialWeek={weekParamValue ?? "all"}
            initialAssetScope={parsePerformanceAssetSelection(scopeParamValue)}
          />
        </div>
      </AppTruthRouteGate>
    </DashboardLayout>
  );
}
