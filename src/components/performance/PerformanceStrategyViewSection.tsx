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
  seedStrategySessionPayload,
  useStrategySession,
} from "@/lib/performance/strategySessionStore";
import { getEntryStyle, getStrengthGate, getStrategy } from "@/lib/performance/strategyConfig";

type StrategyBootstrapEntry = {
  engineWeekMap: NonNullable<ComponentProps<typeof PerformanceViewSection>["engineWeekMap"]> | null;
  engineSimMap: NonNullable<ComponentProps<typeof PerformanceViewSection>["engineSimMap"]> | null;
  engineWeekResults?: Record<string, WeeklyHoldResult> | null;
  sidebarStats: EngineSidebarStats | null;
  weekOptions?: string[];
  currentWeekOpenUtc?: string;
  artifactMeta?: StrategyClientPayload["artifactMeta"];
};

type PerformanceStrategyViewSectionProps = Omit<
  ComponentProps<typeof PerformanceViewSection>,
  "engineWeekMap" | "engineSimMap"
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
  };
}

export default function PerformanceStrategyViewSection({
  initialSelection,
  initialEntry,
  ...performanceProps
}: PerformanceStrategyViewSectionProps) {
  const [selectedSelection, setSelectedSelection] = useState<RuntimeStrategySelection>(initialSelection);
  const selectedSelectionKey = buildStrategySelectionKey(selectedSelection);
  const session = useStrategySession(selectedSelection, { preload: true });
  const payload = session.payload;

  useEffect(() => {
    setSelectedSelection(initialSelection);
  }, [initialSelection]);

  useEffect(() => {
    if (!initialEntry) return;
    seedStrategySessionPayload(initialSelection, entryToPayload(initialEntry));
  }, [initialEntry, initialSelection]);

  useEffect(() => {
    const onSelectionCommit = (event: Event) => {
      const custom = event as CustomEvent<StrategySelectionCommitDetail>;
      setSelectedSelection(custom.detail.selection);
    };
    window.addEventListener(STRATEGY_SELECTION_COMMIT_EVENT, onSelectionCommit);
    return () => window.removeEventListener(STRATEGY_SELECTION_COMMIT_EVENT, onSelectionCommit);
  }, []);

  useEffect(() => {
    const detail: StrategySidebarStatsDetail = {
      selection: selectedSelection,
      stats: payload?.sidebarStats ?? null,
    };
    window.dispatchEvent(new CustomEvent(STRATEGY_SIDEBAR_STATS_EVENT, { detail }));
  }, [payload?.sidebarStats, selectedSelection]);

  const strategyDescription = getStrategy(selectedSelection.strategy)?.description ?? null;
  const strategyLabel = getStrategy(selectedSelection.strategy)?.label ?? selectedSelection.strategy;
  const entryStyleLabel = getEntryStyle(selectedSelection.f1)?.label ?? selectedSelection.f1;
  const riskOverlay = getStrengthGate(selectedSelection.f2);
  const selectionLabel = [
    strategyLabel,
    entryStyleLabel,
    riskOverlay && riskOverlay.id !== "none" ? riskOverlay.label : null,
  ].filter(Boolean).join(" · ");

  const hasRenderablePayload = Boolean(payload?.engineWeekMap || payload?.engineSimMap || payload?.sidebarStats);
  const currentReady = hasRenderablePayload || session.status === "missing" || session.status === "error";

  return (
    <StrategyArtifactLoadingGate
      currentReady={currentReady}
      pageLabel="Performance Page"
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

        {session.status === "missing" || session.status === "error" ? (
          <div className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] px-5 py-4 text-sm text-[color:var(--muted)] shadow-sm">
            Strategy data is not ready yet.
          </div>
        ) : (
          <PerformanceViewSection
            {...performanceProps}
            engineWeekMap={payload?.engineWeekMap ?? null}
            engineSimMap={payload?.engineSimMap ?? null}
            weekOptions={payload?.weekOptions ?? performanceProps.weekOptions}
            currentWeek={payload?.currentWeekOpenUtc ?? performanceProps.currentWeek}
            strategyDescription={strategyDescription}
            notesStorageKey={selectedSelectionKey}
          />
        )}
      </div>
    </StrategyArtifactLoadingGate>
  );
}
