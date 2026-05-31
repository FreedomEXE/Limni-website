"use client";

import { useEffect, useMemo, type ReactNode } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { LimniSpinner } from "@/components/LimniLoading";
import {
  startCanonPreload,
  useCanonPreloadStatus,
} from "@/lib/canon/canonStore";
import {
  buildPreloadManifest,
  deriveActiveSelectionFromParams,
} from "@/lib/preload/preloadRegistry";
import {
  startStrategySessionPreload,
  usePreloadStatus,
  type PreloadPhase,
} from "@/lib/performance/strategySessionStore";

const PHASE_LABELS: Record<PreloadPhase, string> = {
  "checking-updates": "Checking for updates...",
  "loading-active": "Loading active strategy...",
  "loading-market-data": "Loading market data...",
  "loading-strategies": "Loading app data...",
  "computing-live-data": "Computing live week data...",
  ready: "Ready.",
};

function isBypassedRoute(pathname: string | null) {
  return (
    pathname?.startsWith("/status") ||
    pathname?.startsWith("/login") ||
    false
  );
}

function progressLabel(preload: ReturnType<typeof usePreloadStatus>) {
  if (preload.phase !== "loading-strategies") {
    return null;
  }

  const total =
    preload.queuedSelectionKeys.length +
    preload.loadingSelectionKeys.length +
    preload.readySelectionKeys.length +
    Object.keys(preload.failedSelectionKeys).length;

  if (total <= 0) return null;

  const completed =
    preload.readySelectionKeys.length + Object.keys(preload.failedSelectionKeys).length;

  return `${completed}/${total}`;
}

export default function AppPreloadGate({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const canonPreload = useCanonPreloadStatus();
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

  useEffect(() => {
    if (bypassGate) return;
    if (canonPreload.status === "ready") return;
    void startCanonPreload();
  }, [bypassGate, canonPreload.status]);

  useEffect(() => {
    if (bypassGate) return;
    if (canonPreload.status !== "ready") return;
    if (preload.completedOnce || preload.status === "ready") return;
    const manifest = buildPreloadManifest(activeSelection);
    const run = () => {
      void startStrategySessionPreload(manifest);
    };
    if (preload.status !== "partial") {
      run();
      return;
    }
    const timeout = window.setTimeout(run, 5000);
    return () => window.clearTimeout(timeout);
  }, [activeSelection, bypassGate, canonPreload.status, preload.completedOnce, preload.status]);

  if (
    bypassGate ||
    (canonPreload.status === "ready" && (preload.completedOnce || preload.status === "ready"))
  ) {
    return <>{children}</>;
  }

  const canonProgress = canonPreload.total > 0
    ? `${canonPreload.completed}/${canonPreload.total}`
    : null;
  const progress = canonPreload.status !== "ready" ? canonProgress : progressLabel(preload);
  const displayPhase = preload.status === "idle" ? "checking-updates" : preload.phase;
  const phaseLabel = canonPreload.status === "error"
    ? `App update failed: ${canonPreload.error ?? "unknown error"}`
    : canonPreload.status !== "ready"
      ? canonPreload.phase === "idle" || canonPreload.phase === "checking-version"
        ? "Checking app version..."
        : canonPreload.phase === "loading-cache"
        ? `Restoring cached app version ${canonPreload.appVersion ?? "v2"}...`
        : `Updating to app version ${canonPreload.appVersion ?? "v2"}...`
      : preload.status === "partial"
        ? "Rebuilding missing strategy data..."
        : PHASE_LABELS[displayPhase];
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
                    (canonPreload.status !== "ready"
                      ? canonPreload.completed
                      : preload.readySelectionKeys.length
                        + Object.keys(preload.failedSelectionKeys).length)
                      / Math.max(
                        1,
                        canonPreload.status !== "ready"
                          ? canonPreload.total
                          : preload.queuedSelectionKeys.length
                            + preload.loadingSelectionKeys.length
                            + preload.readySelectionKeys.length
                            + Object.keys(preload.failedSelectionKeys).length,
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
