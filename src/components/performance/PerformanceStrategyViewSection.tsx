/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: PerformanceStrategyViewSection.tsx
 *
 * Description:
 * Client-side strategy switcher for Performance. Receives a preloaded
 * strategy artifact map and swaps the active engine payload locally
 * when the shared sidebar commits a new strategy selection.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/
"use client";

import { useEffect, useMemo, useState, type ComponentProps } from "react";
import PerformanceViewSection from "@/components/performance/PerformanceViewSection";
import type { EngineSidebarStats } from "@/lib/performance/engineAdapter";
import {
  buildStrategySelectionKey,
  STRATEGY_SELECTION_COMMIT_EVENT,
  STRATEGY_SIDEBAR_STATS_EVENT,
  type RuntimeStrategySelection,
  type StrategySelectionCommitDetail,
  type StrategySidebarStatsDetail,
} from "@/lib/performance/strategySelection";

type StrategyBootstrapEntry = {
  engineWeekMap: NonNullable<ComponentProps<typeof PerformanceViewSection>["engineWeekMap"]> | null;
  engineSimMap: NonNullable<ComponentProps<typeof PerformanceViewSection>["engineSimMap"]> | null;
  sidebarStats: EngineSidebarStats | null;
};

type PerformanceStrategyViewSectionProps = Omit<
  ComponentProps<typeof PerformanceViewSection>,
  "engineWeekMap" | "engineSimMap"
> & {
  initialSelection: RuntimeStrategySelection;
  strategyDataMap: Record<string, StrategyBootstrapEntry | null>;
};

export default function PerformanceStrategyViewSection({
  initialSelection,
  strategyDataMap,
  ...performanceProps
}: PerformanceStrategyViewSectionProps) {
  const [selectedSelection, setSelectedSelection] = useState<RuntimeStrategySelection>(initialSelection);
  const [stableEntry, setStableEntry] = useState<StrategyBootstrapEntry | null>(() => {
    const initialKey = buildStrategySelectionKey(initialSelection);
    return strategyDataMap[initialKey] ?? null;
  });

  useEffect(() => {
    setSelectedSelection(initialSelection);
  }, [initialSelection]);

  useEffect(() => {
    const onSelectionCommit = (event: Event) => {
      const custom = event as CustomEvent<StrategySelectionCommitDetail>;
      setSelectedSelection(custom.detail.selection);
    };
    window.addEventListener(STRATEGY_SELECTION_COMMIT_EVENT, onSelectionCommit);
    return () => window.removeEventListener(STRATEGY_SELECTION_COMMIT_EVENT, onSelectionCommit);
  }, []);

  const selectedEntry = useMemo(() => {
    const selectionKey = buildStrategySelectionKey(selectedSelection);
    return strategyDataMap[selectionKey] ?? null;
  }, [selectedSelection, strategyDataMap]);

  useEffect(() => {
    setStableEntry(selectedEntry ?? null);
  }, [selectedEntry]);

  useEffect(() => {
    const detail: StrategySidebarStatsDetail = {
      selection: selectedSelection,
      stats: stableEntry?.sidebarStats ?? null,
    };
    window.dispatchEvent(new CustomEvent(STRATEGY_SIDEBAR_STATS_EVENT, { detail }));
  }, [selectedSelection, stableEntry]);

  return (
    <PerformanceViewSection
      {...performanceProps}
      engineWeekMap={stableEntry?.engineWeekMap ?? null}
      engineSimMap={stableEntry?.engineSimMap ?? null}
    />
  );
}
