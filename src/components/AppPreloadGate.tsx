"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { LimniSpinner } from "@/components/LimniLoading";
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
  "loading-strategies": "Loading strategy data...",
  "computing-live-data": "Computing live week data...",
  ready: "Ready.",
};

function isBypassedRoute(pathname: string | null) {
  return pathname?.startsWith("/status") || pathname?.startsWith("/login") || false;
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
  const preload = usePreloadStatus();
  const bypassGate = isBypassedRoute(pathname);

  useEffect(() => {
    if (bypassGate) return;
    const activeSelection = deriveActiveSelectionFromParams(
      searchParams ? new URLSearchParams(searchParams.toString()) : null,
    );
    const manifest = buildPreloadManifest(activeSelection);
    void startStrategySessionPreload(manifest);
  }, [bypassGate, searchParams]);

  if (
    bypassGate ||
    preload.completedOnce ||
    preload.status === "ready" ||
    preload.status === "partial"
  ) {
    return <>{children}</>;
  }

  const progress = progressLabel(preload);
  const displayPhase = preload.status === "idle" ? "checking-updates" : preload.phase;
  const label = progress
    ? `${PHASE_LABELS[displayPhase]} (${progress})`
    : PHASE_LABELS[displayPhase];

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
                    (preload.readySelectionKeys.length
                      + Object.keys(preload.failedSelectionKeys).length)
                      / Math.max(
                        1,
                        preload.queuedSelectionKeys.length
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
