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

function routeLabel(route: GateRoute) {
  return route === "data" ? "Data" : "Performance";
}

function routeSlice(
  route: GateRoute,
  readiness: AppTruthActiveBaselineRouteReadiness,
): AppTruthRouteReadinessSlice {
  return route === "data" ? readiness.data : readiness.performance;
}

function BlockedRouteState({
  route,
  readiness,
  readinessError,
}: {
  route: GateRoute;
  readiness: AppTruthActiveBaselineRouteReadiness | null;
  readinessError: string | null;
}) {
  const label = routeLabel(route);
  const slice = readiness ? routeSlice(route, readiness) : null;
  const blockers = slice?.blockers ?? [];

  return (
    <div
      className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:px-8"
      data-app-truth-route={route}
      data-app-truth-route-ready="false"
      data-app-truth-baseline={readiness?.baselineId ?? "unknown"}
      data-testid={`app-truth-${route}-blocked`}
    >
      <section className="rounded-lg border border-amber-400/50 bg-neutral-950/90 p-5 text-neutral-100 shadow-sm">
        <div className="space-y-4">
          <div>
            <p className="text-sm font-medium text-amber-200">App truth route gate</p>
            <h1 className="mt-1 text-2xl font-semibold text-white">
              {label} is waiting for certified baseline receipts
            </h1>
            <p className="mt-2 max-w-3xl text-sm text-neutral-300">
              {readinessError
                ? `Route readiness could not be read: ${readinessError}`
                : slice?.detail ?? "Route readiness is unavailable."}
            </p>
          </div>

          <div className="grid gap-3 text-sm sm:grid-cols-3">
            <div>
              <p className="text-neutral-500">Baseline</p>
              <p className="font-mono text-neutral-100">{readiness?.baselineId ?? "unknown"}</p>
            </div>
            <div>
              <p className="text-neutral-500">Expected weeks</p>
              <p className="font-mono text-neutral-100">
                {readiness?.closedExpectedWeekCount ?? 0}
              </p>
            </div>
            <div>
              <p className="text-neutral-500">Status</p>
              <p className="font-mono text-neutral-100">{slice?.status ?? "unknown"}</p>
            </div>
          </div>

          {blockers.length > 0 ? (
            <div className="space-y-2">
              <p className="text-sm font-medium text-neutral-200">First blockers</p>
              <ul className="space-y-1 text-sm text-neutral-300">
                {blockers.slice(0, 8).map((blocker) => (
                  <li key={blocker}>{blocker}</li>
                ))}
              </ul>
            </div>
          ) : null}

          <a
            className="inline-flex rounded-md border border-neutral-700 px-3 py-2 text-sm font-medium text-neutral-100 hover:border-neutral-500 hover:bg-neutral-900"
            href="/status"
          >
            Open Status
          </a>
        </div>
      </section>
    </div>
  );
}

export default function AppTruthRouteGate({
  route,
  readiness,
  readinessError = null,
  children,
}: AppTruthRouteGateProps) {
  const slice = readiness ? routeSlice(route, readiness) : null;

  if (!readiness || !slice?.ready || readinessError) {
    return (
      <BlockedRouteState
        route={route}
        readiness={readiness}
        readinessError={readinessError}
      />
    );
  }

  return (
    <div
      data-app-truth-route={route}
      data-app-truth-route-ready="true"
      data-app-truth-baseline={readiness.baselineId}
      data-app-truth-ready-weeks={
        route === "data"
          ? readiness.dataReadyWeekCount
          : readiness.performanceReadyWeekCount
      }
      data-app-truth-expected-weeks={readiness.closedExpectedWeekCount}
      data-testid={`app-truth-${route}-ready`}
    >
      {children}
    </div>
  );
}
