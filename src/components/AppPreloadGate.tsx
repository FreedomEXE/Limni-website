"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { LimniSpinner } from "@/components/LimniLoading";
import {
  startCanonPreload,
  useCanonPreloadStatus,
} from "@/lib/canon/canonStore";
import {
  startCanonKernelSync,
  useCanonKernelStatus,
} from "@/lib/canon/canonKernelStore";
import {
  buildPreloadManifest,
  deriveActiveSelectionFromParams,
  FALLBACK_DEFAULT_SELECTION,
} from "@/lib/preload/preloadRegistry";
import {
  startStrategySessionPreload,
  usePreloadStatus,
} from "@/lib/performance/strategySessionStore";
import { prefetchVisibleStrategyPayloads } from "@/lib/performance/strategyClientCache";

function isBypassedRoute(pathname: string | null) {
  return (
    pathname?.startsWith("/status") ||
    pathname?.startsWith("/login") ||
    false
  );
}

function isKernelRoute(pathname: string | null) {
  return pathname?.startsWith("/performance") ?? false;
}

export default function AppPreloadGate({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const canonPreload = useCanonPreloadStatus();
  const canonKernel = useCanonKernelStatus();
  const preload = usePreloadStatus();
  const backgroundWarmKeyRef = useRef<string | null>(null);
  const [hasReleasedAppGate, setHasReleasedAppGate] = useState(false);
  const [isSlowGate, setIsSlowGate] = useState(false);
  const performanceKernelRoute = isKernelRoute(pathname);
  const bypassGate = isBypassedRoute(pathname) || !performanceKernelRoute;
  const strategyParam = performanceKernelRoute ? searchParams?.get("strategy") ?? "" : "";
  const f1Param = searchParams?.get("f1") ?? searchParams?.get("filter") ?? "";
  const f2Param = searchParams?.get("f2") ?? "";
  const activeSelection = useMemo(
    () => {
      if (!performanceKernelRoute) return null;
      const params = new URLSearchParams();
      if (strategyParam) params.set("strategy", strategyParam);
      if (f1Param) params.set("f1", f1Param);
      if (f2Param) params.set("f2", f2Param);
      return deriveActiveSelectionFromParams(params);
    },
    [f1Param, f2Param, performanceKernelRoute, strategyParam],
  );
  const activeKernelSelection = useMemo(
    () => activeSelection ?? (performanceKernelRoute ? FALLBACK_DEFAULT_SELECTION : null),
    [activeSelection, performanceKernelRoute],
  );
  const kernelReady = Boolean(activeKernelSelection && canonKernel.status === "ready");
  const useStrategyKernelPayload = Boolean(activeKernelSelection && performanceKernelRoute);
  const kernelTerminalFailure = performanceKernelRoute
    && (canonKernel.status === "error" || canonKernel.status === "degraded" || canonPreload.status === "error");
  const shouldUseLegacyCanonGate = performanceKernelRoute && (!activeKernelSelection
    || canonKernel.status === "degraded"
    || canonKernel.status === "error");
  const appHistoricalReady = performanceKernelRoute || canonPreload.status === "ready" || kernelReady || kernelTerminalFailure;
  const appGateReleased = hasReleasedAppGate || appHistoricalReady;

  useEffect(() => {
    if (!hasReleasedAppGate && appHistoricalReady) {
      const timeout = window.setTimeout(() => setHasReleasedAppGate(true), 0);
      return () => window.clearTimeout(timeout);
    }
  }, [appHistoricalReady, hasReleasedAppGate]);

  useEffect(() => {
    const resetTimeout = window.setTimeout(() => setIsSlowGate(false), 0);
    if (bypassGate || appGateReleased) {
      return () => window.clearTimeout(resetTimeout);
    }
    const timeout = window.setTimeout(() => setIsSlowGate(true), 15_000);
    return () => {
      window.clearTimeout(resetTimeout);
      window.clearTimeout(timeout);
    };
  }, [activeKernelSelection, appGateReleased, bypassGate, pathname]);

  useEffect(() => {
    if (bypassGate) return;
    if (appGateReleased) return;
    if (!performanceKernelRoute) return;
    if (!activeKernelSelection) return;
    void startCanonKernelSync(activeKernelSelection);
  }, [activeKernelSelection, appGateReleased, bypassGate, performanceKernelRoute]);

  useEffect(() => {
    if (bypassGate) return;
    if (appGateReleased) return;
    if (!performanceKernelRoute) return;
    if (canonPreload.status === "ready" || canonPreload.status === "loading" || canonPreload.status === "error") return;
    if (!shouldUseLegacyCanonGate) return;
    void startCanonPreload();
  }, [appGateReleased, bypassGate, canonPreload.status, performanceKernelRoute, shouldUseLegacyCanonGate]);

  useEffect(() => {
    if (bypassGate) return;
    if (!performanceKernelRoute) return;
    if (!appHistoricalReady) return;
    if (!activeKernelSelection) return;
    if (preload.completedOnce || preload.status === "ready") return;
    const manifest = buildPreloadManifest(activeKernelSelection);
    const run = () => {
      void startStrategySessionPreload(manifest, {
        trustGlobalStamp: !kernelReady,
        includeBackgroundStrategyTasks: !useStrategyKernelPayload && !kernelReady,
        useKernelPayload: useStrategyKernelPayload,
      });
    };
    if (preload.status !== "partial") {
      run();
      return;
    }
    const timeout = window.setTimeout(run, 5000);
    return () => window.clearTimeout(timeout);
  }, [
    activeKernelSelection,
    appHistoricalReady,
    bypassGate,
    kernelReady,
    performanceKernelRoute,
    preload.completedOnce,
    preload.status,
    useStrategyKernelPayload,
  ]);

  useEffect(() => {
    if (bypassGate) return;
    if (!performanceKernelRoute) return;
    if (!appHistoricalReady || !kernelReady) return;
    const warmKey = `${canonKernel.cacheNamespace ?? "unknown"}:visible-strategy-artifacts`;
    if (backgroundWarmKeyRef.current === warmKey) return;
    backgroundWarmKeyRef.current = warmKey;
    void prefetchVisibleStrategyPayloads({
      currentSelection: activeKernelSelection ?? undefined,
      concurrency: 1,
      delayMs: 1200,
      scope: "full",
    });
  }, [
    activeKernelSelection,
    appHistoricalReady,
    bypassGate,
    canonKernel.cacheNamespace,
    kernelReady,
    performanceKernelRoute,
  ]);

  if (bypassGate || appGateReleased) {
    return <>{children}</>;
  }

  const canonProgress = canonPreload.total > 0
    ? `${canonPreload.completed}/${canonPreload.total}`
    : null;
  const kernelProgress = activeKernelSelection && canonKernel.totalWeeks > 0
    ? `${canonKernel.readyWeeks}/${canonKernel.totalWeeks}`
    : null;
  const progress = shouldUseLegacyCanonGate ? canonProgress : kernelProgress;
  const phaseLabel = shouldUseLegacyCanonGate && canonPreload.status === "error"
    ? `App update failed: ${canonPreload.error ?? "unknown error"}`
    : !shouldUseLegacyCanonGate && activeKernelSelection
    ? canonKernel.phase === "fetching-closed-week-deltas"
      ? "Updating closed weeks..."
      : canonKernel.phase === "hydrating-local-canon"
      ? "Restoring v2 history..."
      : canonKernel.phase === "composing-active-history"
      ? "Preparing performance history..."
      : "Checking closed weeks..."
    : canonPreload.phase === "idle" || canonPreload.phase === "checking-version"
      ? "Checking app version..."
      : canonPreload.phase === "loading-cache"
      ? `Restoring ${canonPreload.appVersion ?? "current version"}...`
      : `Updating to ${canonPreload.appVersion ?? "current version"}...`;
  const label = progress
    ? `${phaseLabel} (${progress})`
    : phaseLabel;
  const debugLines = [
    `route=${pathname ?? "unknown"}`,
    activeKernelSelection ? `variant=${activeKernelSelection.strategy}-${activeKernelSelection.f1}-${activeKernelSelection.f2}` : "variant=none",
    shouldUseLegacyCanonGate
      ? `legacyPhase=${canonPreload.phase}:${canonPreload.status}`
      : `kernelPhase=${canonKernel.phase}:${canonKernel.status}`,
    shouldUseLegacyCanonGate
      ? "blockedEndpoint=/api/canon/v2/historical"
      : "blockedEndpoint=/api/canon/v2/week",
  ];

  return (
    <div
      className="flex min-h-screen w-full items-center justify-center px-6 py-10"
      style={{ background: "var(--background, #f8f7f2)" }}
    >
      <div className="flex flex-col items-center gap-4">
        <LimniSpinner />
        <p
          className="text-xs uppercase tracking-[0.25em]"
          style={{ color: "var(--muted, #6b7280)" }}
        >
          {label}
        </p>
        {progress ? (
          <div className="h-1 w-48 overflow-hidden rounded-full bg-[var(--panel-border)]">
            <div
              className="h-full rounded-full bg-[var(--accent)] transition-all"
              style={{
                width: `${Math.max(
                  0,
                  Math.min(
                    100,
                    (shouldUseLegacyCanonGate
                      ? canonPreload.completed
                      : canonKernel.readyWeeks)
                      / Math.max(
                        1,
                        shouldUseLegacyCanonGate
                          ? canonPreload.total
                          : canonKernel.totalWeeks,
                      )
                      * 100,
                  ),
                )}%`,
              }}
            />
          </div>
        ) : null}
        {isSlowGate ? (
          <div
            className="max-w-xl space-y-1 rounded-md border border-[var(--panel-border)] bg-[var(--panel)] px-4 py-3 text-left text-[11px]"
            style={{ color: "var(--muted, #6b7280)" }}
          >
            {debugLines.map((line) => (
              <div key={line}>{line}</div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
