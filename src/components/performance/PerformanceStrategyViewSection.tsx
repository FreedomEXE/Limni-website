/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: PerformanceStrategyViewSection.tsx
 *
 * Description:
 * Performance page selector over the shared strategy session store.
 * The page no longer owns a strategy payload cache.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/
"use client";

import { useEffect, useState, type ComponentProps } from "react";
import PerformanceViewSection from "@/components/performance/PerformanceViewSection";
import StrategyArtifactLoadingGate from "@/components/performance/StrategyArtifactLoadingGate";
import { startCanonKernelSync, useCanonKernelStatus } from "@/lib/canon/canonKernelStore";
import type { EngineSidebarStats } from "@/lib/performance/engineAdapter";
import type { WeeklyHoldResult } from "@/lib/performance/weeklyHoldEngine";
import {
  buildStrategySelectionKey,
  STRATEGY_SELECTION_COMMIT_EVENT,
  STRATEGY_SIDEBAR_STATS_EVENT,
  type RuntimeStrategySelection,
  type StrategySelectionCommitDetail,
  type StrategySidebarStatsDetail,
} from "@/lib/performance/strategySelection";
import type { StrategyClientPayload } from "@/lib/performance/strategyClientPayload";
import {
  ensureCurrentWeekSession,
  seedStrategySessionPayload,
  useStrategySession,
} from "@/lib/performance/strategySessionStore";
import { getEntryStyle, getRiskOverlay, getStrategy } from "@/lib/performance/strategyConfig";

type StrategyBootstrapEntry = {
  engineWeekMap: NonNullable<ComponentProps<typeof PerformanceViewSection>["engineWeekMap"]> | null;
  engineSimMap: NonNullable<ComponentProps<typeof PerformanceViewSection>["engineSimMap"]> | null;
  engineWeekResults?: Record<string, WeeklyHoldResult> | null;
  sidebarStats: EngineSidebarStats | null;
  weekOptions?: string[];
  currentWeekOpenUtc?: string;
  artifactMeta?: StrategyClientPayload["artifactMeta"];
  selectedTradeRowsBundle?: StrategyClientPayload["selectedTradeRowsBundle"];
};

type PerformanceStrategyViewSectionProps = Omit<
  ComponentProps<typeof PerformanceViewSection>,
  "engineWeekMap" | "engineSimMap" | "engineWeekResults" | "selection" | "sidebarStats"
> & {
  initialSelection: RuntimeStrategySelection;
  initialEntry: StrategyBootstrapEntry | null;
};

function entryToPayload(entry: StrategyBootstrapEntry): StrategyClientPayload {
  return {
    engineWeekMap: entry.engineWeekMap,
    engineSimMap: entry.engineSimMap,
    engineWeekResults: entry.engineWeekResults ?? null,
    sidebarStats: entry.sidebarStats,
    weekOptions: entry.weekOptions,
    currentWeekOpenUtc: entry.currentWeekOpenUtc,
    artifactMeta: entry.artifactMeta,
    selectedTradeRowsBundle: entry.selectedTradeRowsBundle ?? null,
  };
}

export default function PerformanceStrategyViewSection({
  initialSelection,
  initialEntry,
  ...performanceProps
}: PerformanceStrategyViewSectionProps) {
  const [selectedSelection, setSelectedSelection] = useState<RuntimeStrategySelection>(initialSelection);
  const selectedSelectionKey = buildStrategySelectionKey(selectedSelection);
  const session = useStrategySession(selectedSelection, { kernel: true, currentWeek: true });
  const canonKernel = useCanonKernelStatus();
  const payload = session.payload;

  useEffect(() => {
    setSelectedSelection(initialSelection);
  }, [initialSelection]);

  useEffect(() => {
    if (!initialEntry) return;
    seedStrategySessionPayload(initialSelection, entryToPayload(initialEntry));
  }, [initialEntry, initialSelection]);

  useEffect(() => {
    void startCanonKernelSync(selectedSelection);
  }, [selectedSelection]);

  useEffect(() => {
    const onSelectionCommit = (event: Event) => {
      const custom = event as CustomEvent<StrategySelectionCommitDetail>;
      setSelectedSelection(custom.detail.selection);
    };
    window.addEventListener(STRATEGY_SELECTION_COMMIT_EVENT, onSelectionCommit);
    return () => window.removeEventListener(STRATEGY_SELECTION_COMMIT_EVENT, onSelectionCommit);
  }, []);

  const strategyDescription = getStrategy(selectedSelection.strategy)?.description ?? null;
  const strategyLabel = getStrategy(selectedSelection.strategy)?.label ?? selectedSelection.strategy;
  const entryStyleLabel = getEntryStyle(selectedSelection.f1)?.label ?? selectedSelection.f1;
  const riskOverlay = getRiskOverlay(selectedSelection.f2);
  const selectionLabel = [
    strategyLabel,
    entryStyleLabel,
    riskOverlay && riskOverlay.id !== "none" ? riskOverlay.label : null,
  ].filter(Boolean).join(" · ");

  const hasRenderablePayload = Boolean(payload?.engineWeekMap || payload?.engineSimMap || payload?.sidebarStats);
  const performanceCanonReady = canonKernel.status === "ready" && canonKernel.totalWeeks >= 14;
  const activeRuntimeReady = Boolean(
    hasRenderablePayload &&
    payload?.artifactMeta?.historyWindow === "active-baseline" &&
    (payload.artifactMeta.expectedWeeks ?? 0) >= 14 &&
    (payload.artifactMeta.missingWeeks?.length ?? 0) === 0,
  );
  const blockDeprecatedPerformance = !performanceCanonReady && !activeRuntimeReady;
  const showUnavailableMessage =
    session.status === "missing" ||
    session.status === "error" ||
    (blockDeprecatedPerformance && session.status === "ready");
  const currentReady = hasRenderablePayload || session.status === "missing" || session.status === "error";
  const loadingPhase = session.currentWeekStatus === "current-loading"
    ? "current-week"
    : session.status === "loading"
      ? "loading"
      : null;

  useEffect(() => {
    if (!activeRuntimeReady) return;
    void ensureCurrentWeekSession(selectedSelection);
  }, [activeRuntimeReady, selectedSelection]);

  useEffect(() => {
    if (!showUnavailableMessage) return;
    const detail: StrategySidebarStatsDetail = {
      selection: selectedSelection,
      stats: null,
    };
    window.dispatchEvent(new CustomEvent(STRATEGY_SIDEBAR_STATS_EVENT, { detail }));
  }, [selectedSelection, showUnavailableMessage]);

  return (
    <StrategyArtifactLoadingGate
      currentReady={currentReady}
      pageLabel="Performance Page"
      phase={loadingPhase}
    >
      <div className="space-y-4">
        <header className="mb-8">
          <div>
            <h1 className="text-3xl font-semibold text-[var(--foreground)]">
              Performance
            </h1>
            <p className="mt-1 text-xs uppercase tracking-[0.18em] text-[color:var(--muted)]">
              {selectionLabel}
            </p>
          </div>
        </header>

        {showUnavailableMessage ? (
          <div className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] px-5 py-4 text-sm text-[color:var(--muted)] shadow-sm">
            <p className="font-semibold text-[var(--foreground)]">Active Performance runtime is not ready.</p>
            <p className="mt-2">
              {canonKernel.error ?? session.error ?? "Strategy data is not ready yet."}
            </p>
            <p className="mt-2">
              Active runtime window: {payload?.artifactMeta?.historyWindow ?? "unknown"}; expected weeks: {payload?.artifactMeta?.expectedWeeks ?? 0}; missing weeks: {payload?.artifactMeta?.missingWeeks?.length ?? 0}. Current app comparison baseline is receipt-backed active closed-week history. Do not treat deprecated broad-history Performance data as v2.0.3 canon.
            </p>
          </div>
        ) : (
          <PerformanceViewSection
            {...performanceProps}
            engineWeekMap={payload?.engineWeekMap ?? null}
            engineSimMap={payload?.engineSimMap ?? null}
            engineWeekResults={payload?.engineWeekResults ?? null}
            selection={selectedSelection}
            sidebarStats={payload?.sidebarStats ?? null}
            weekOptions={payload?.weekOptions ?? performanceProps.weekOptions}
            currentWeek={payload?.currentWeekOpenUtc ?? performanceProps.currentWeek}
            selectedTradeRowsBundle={payload?.selectedTradeRowsBundle ?? null}
            strategyDescription={strategyDescription}
            notesStorageKey={selectedSelectionKey}
          />
        )}
      </div>
    </StrategyArtifactLoadingGate>
  );
}
