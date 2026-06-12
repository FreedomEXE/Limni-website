/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: AppTruthRouteGate.tsx
 *
 * Description:
 * Shared route gate for receipt-backed app-truth readiness.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import type { ReactNode } from "react";

import type {
  AppTruthActiveBaselineRouteReadiness,
  AppTruthRouteReadinessSlice,
} from "@/lib/appTruth/routeReadiness";

type GateRoute = "data" | "performance";

type AppTruthRouteGateProps = {
  route: GateRoute;
  readiness: AppTruthActiveBaselineRouteReadiness | null;
  readinessError?: string | null;
  children: ReactNode;
};

function routeSlice(
  route: GateRoute,
  readiness: AppTruthActiveBaselineRouteReadiness,
): AppTruthRouteReadinessSlice {
  return route === "data" ? readiness.data : readiness.performance;
}

export default function AppTruthRouteGate({
  route,
  readiness,
  readinessError = null,
  children,
}: AppTruthRouteGateProps) {
  const slice = readiness ? routeSlice(route, readiness) : null;
  const readyState = readinessError || !readiness || !slice ? "unknown" : String(slice.ready);

  return (
    <div
      data-app-truth-route={route}
      data-app-truth-route-ready={readyState}
      data-app-truth-route-status={slice?.status ?? "unknown"}
      data-app-truth-baseline={readiness?.baselineId ?? "unknown"}
      data-app-truth-ready-weeks={
        route === "data"
          ? readiness?.dataReadyWeekCount ?? 0
          : readiness?.performanceReadyWeekCount ?? 0
      }
      data-app-truth-expected-weeks={readiness?.closedExpectedWeekCount ?? 0}
      data-app-truth-readiness-error={readinessError ?? undefined}
      data-testid={`app-truth-${route}-ready`}
    >
      {children}
    </div>
  );
}
