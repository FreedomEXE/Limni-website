"use client";

import { useEffect, useMemo, useRef, type ReactNode } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { useCanonKernelStatus } from "@/lib/canon/canonKernelStore";
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

function isPerformanceRoute(pathname: string | null) {
  return pathname?.startsWith("/performance") ?? false;
}

function isBypassedRoute(pathname: string | null) {
  return (
    pathname?.startsWith("/status") ||
    pathname?.startsWith("/login") ||
    !isPerformanceRoute(pathname) ||
    false
  );
}

function activeSelectionFromRoute(options: {
  performanceRoute: boolean;
  strategyParam: string;
  f1Param: string;
  f2Param: string;
}) {
  if (!options.performanceRoute) return null;
  const params = new URLSearchParams();
  if (options.strategyParam) params.set("strategy", options.strategyParam);
  if (options.f1Param) params.set("f1", options.f1Param);
  if (options.f2Param) params.set("f2", options.f2Param);
  return deriveActiveSelectionFromParams(params) ?? FALLBACK_DEFAULT_SELECTION;
}

export default function AppPreloadGate({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const canonKernel = useCanonKernelStatus();
  const preload = usePreloadStatus();
  const backgroundWarmKeyRef = useRef<string | null>(null);
  const performanceRoute = isPerformanceRoute(pathname);
  const bypassGate = isBypassedRoute(pathname);
  const strategyParam = performanceRoute ? searchParams?.get("strategy") ?? "" : "";
  const f1Param = searchParams?.get("f1") ?? searchParams?.get("filter") ?? "";
  const f2Param = searchParams?.get("f2") ?? "";
  const activeKernelSelection = useMemo(
    () => activeSelectionFromRoute({
      performanceRoute,
      strategyParam,
      f1Param,
      f2Param,
    }),
    [f1Param, f2Param, performanceRoute, strategyParam],
  );
  const kernelReady = Boolean(activeKernelSelection && canonKernel.status === "ready");
  const useStrategyKernelPayload = Boolean(activeKernelSelection && performanceRoute);

  useEffect(() => {
    if (bypassGate) return;
    if (!performanceRoute) return;
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
    bypassGate,
    kernelReady,
    performanceRoute,
    preload.completedOnce,
    preload.status,
    useStrategyKernelPayload,
  ]);

  useEffect(() => {
    if (bypassGate) return;
    if (!performanceRoute) return;
    if (!kernelReady) return;
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
    bypassGate,
    canonKernel.cacheNamespace,
    kernelReady,
    performanceRoute,
  ]);

  return <>{children}</>;
}
