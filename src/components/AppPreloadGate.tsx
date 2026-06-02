"use client";

import { useEffect, useMemo, type ReactNode } from "react";
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
  const bypassGate = isBypassedRoute(pathname);
  const strategyParam = searchParams?.get("strategy") ?? searchParams?.get("bias") ?? "";
  const f1Param = searchParams?.get("f1") ?? searchParams?.get("filter") ?? "";
  const f2Param = searchParams?.get("f2") ?? "";
  const activeSelection = useMemo(
    () => {
      const params = new URLSearchParams();
      if (strategyParam) params.set("strategy", strategyParam);
      if (f1Param) params.set("f1", f1Param);
      if (f2Param) params.set("f2", f2Param);
      return deriveActiveSelectionFromParams(params);
    },
    [f1Param, f2Param, strategyParam],
  );
  const activeKernelSelection = useMemo(
    () => activeSelection ?? (isKernelRoute(pathname) ? FALLBACK_DEFAULT_SELECTION : null),
    [activeSelection, pathname],
  );
  const kernelReady = Boolean(activeKernelSelection && canonKernel.status === "ready");
  const shouldUseLegacyCanonGate = !activeKernelSelection
    || canonKernel.status === "degraded"
    || canonKernel.status === "error";
  const appHistoricalReady = canonPreload.status === "ready" || kernelReady;

  useEffect(() => {
    if (bypassGate) return;
    if (!activeKernelSelection) return;
    void startCanonKernelSync(activeKernelSelection);
  }, [activeKernelSelection, bypassGate]);

  useEffect(() => {
    if (bypassGate) return;
    if (canonPreload.status === "ready") return;
    if (!shouldUseLegacyCanonGate) return;
    void startCanonPreload();
  }, [bypassGate, canonPreload.status, shouldUseLegacyCanonGate]);

  useEffect(() => {
    if (bypassGate) return;
    if (!appHistoricalReady) return;
    if (!activeKernelSelection) return;
    if (preload.completedOnce || preload.status === "ready") return;
    const manifest = buildPreloadManifest(activeKernelSelection);
    const run = () => {
      void startStrategySessionPreload(manifest, {
        trustGlobalStamp: !kernelReady,
        includeBackgroundStrategyTasks: !kernelReady,
        useKernelPayload: kernelReady,
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
    preload.completedOnce,
    preload.status,
  ]);

  if (bypassGate || appHistoricalReady) {
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
      </div>
    </div>
  );
}
