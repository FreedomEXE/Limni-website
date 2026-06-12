import DashboardLayout from "@/components/DashboardLayout";
import AppTruthRouteGate from "@/components/appTruth/AppTruthRouteGate";
import { readActiveBaselineRouteReadiness } from "@/lib/appTruth/routeReadiness";
import type { AppTruthActiveBaselineRouteReadiness } from "@/lib/appTruth/routeReadiness";
import DashboardViewSection from "@/components/dashboard/DashboardViewSection";
import { resolveDashboardBias } from "@/lib/dashboard/dashboardSelection";
import { loadCachedMarketIntelligence } from "@/lib/dashboard/loadMarketIntelligence";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type DashboardPageProps = {
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

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const resolvedSearchParams = await Promise.resolve(searchParams);
  const rawAsset = firstParam(resolvedSearchParams?.asset);
  const reportParam = firstParam(resolvedSearchParams?.report);
  const biasParam = firstParam(resolvedSearchParams?.bias);
  const viewParam = firstParam(resolvedSearchParams?.view);
  let routeReadiness: AppTruthActiveBaselineRouteReadiness | null = null;
  let routeReadinessError: string | null = null;

  try {
    routeReadiness = await readActiveBaselineRouteReadiness();
  } catch (error) {
    routeReadinessError = errorMessage(error);
  }

  const payload = await loadCachedMarketIntelligence("all", {
    reportDate: reportParam,
  });

  const reportValues = new Set(payload.reportOptions.map((option) => option.value));
  const selectedReportDate =
    reportParam && reportValues.has(reportParam)
      ? reportParam
      : payload.reportOptions[0]?.value ?? "";
  const biasMode = resolveDashboardBias(biasParam);
  const view = viewParam === "list" || viewParam === "heatmap" ? viewParam : "heatmap";

  return (
    <DashboardLayout>
      <AppTruthRouteGate
        route="data"
        readiness={routeReadiness}
        readinessError={routeReadinessError}
      >
        <DashboardViewSection
          {...payload}
          initialAsset={rawAsset ?? "all"}
          initialReport={selectedReportDate}
          initialBias={biasMode}
          initialView={view}
        />
      </AppTruthRouteGate>
    </DashboardLayout>
  );
}
