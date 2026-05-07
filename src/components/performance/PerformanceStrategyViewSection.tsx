/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: PerformanceStrategyViewSection.tsx
 *
 * Description:
 * Client-side strategy switcher for Performance. Receives the active
 * strategy payload from the server and caches subsequent selections
 * locally after the shared sidebar commits them.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/
"use client";

import { useEffect, useMemo, useState, type ComponentProps } from "react";
import PerformanceViewSection from "@/components/performance/PerformanceViewSection";
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
import {
  fetchStrategyClientPayload,
  getStrategyClientPayload,
  setStrategyClientPayload,
} from "@/lib/performance/strategyClientCache";
import { getEntryStyle, getStrategy } from "@/lib/performance/strategyConfig";

type StrategyBootstrapEntry = {
  engineWeekMap: NonNullable<ComponentProps<typeof PerformanceViewSection>["engineWeekMap"]> | null;
  engineSimMap: NonNullable<ComponentProps<typeof PerformanceViewSection>["engineSimMap"]> | null;
  engineWeekResults?: Record<string, WeeklyHoldResult> | null;
  sidebarStats: EngineSidebarStats | null;
};

type PerformanceStrategyViewSectionProps = Omit<
  ComponentProps<typeof PerformanceViewSection>,
  "engineWeekMap" | "engineSimMap"
> & {
  initialSelection: RuntimeStrategySelection;
  initialEntry: StrategyBootstrapEntry | null;
};

export default function PerformanceStrategyViewSection({
  initialSelection,
  initialEntry,
  ...performanceProps
}: PerformanceStrategyViewSectionProps) {
  const initialKey = buildStrategySelectionKey(initialSelection);
  const [selectedSelection, setSelectedSelection] = useState<RuntimeStrategySelection>(initialSelection);
  const [entryCache, setEntryCache] = useState<Record<string, StrategyBootstrapEntry | null>>(() => (
    initialEntry ? { [initialKey]: initialEntry } : {}
  ));
  const [stableEntry, setStableEntry] = useState<StrategyBootstrapEntry | null>(initialEntry);
  const [loadedSelectionKey, setLoadedSelectionKey] = useState(initialKey);

  useEffect(() => {
    setSelectedSelection(initialSelection);
  }, [initialSelection]);

  useEffect(() => {
    if (!initialEntry) return;
    setEntryCache((previous) => ({
      ...previous,
      [initialKey]: previous[initialKey] ?? initialEntry,
    }));
    setStableEntry((previous) => previous ?? initialEntry);
    setLoadedSelectionKey(initialKey);
    setStrategyClientPayload(initialSelection, {
      engineWeekMap: initialEntry.engineWeekMap,
      engineSimMap: initialEntry.engineSimMap,
      engineWeekResults: initialEntry.engineWeekResults ?? null,
      sidebarStats: initialEntry.sidebarStats,
    });
  }, [initialEntry, initialKey, initialSelection]);

  useEffect(() => {
    const onSelectionCommit = (event: Event) => {
      const custom = event as CustomEvent<StrategySelectionCommitDetail>;
      setSelectedSelection(custom.detail.selection);
    };
    window.addEventListener(STRATEGY_SELECTION_COMMIT_EVENT, onSelectionCommit);
    return () => window.removeEventListener(STRATEGY_SELECTION_COMMIT_EVENT, onSelectionCommit);
  }, []);

  const selectedSelectionKey = useMemo(
    () => buildStrategySelectionKey(selectedSelection),
    [selectedSelection],
  );

  useEffect(() => {
    let active = true;

    const ensureSelectionEntry = async () => {
      const cachedEntry = entryCache[selectedSelectionKey];
      if (cachedEntry !== undefined) {
        setStableEntry(cachedEntry ?? null);
        setLoadedSelectionKey(selectedSelectionKey);
        return;
      }

      const payload = getStrategyClientPayload(selectedSelection);
      if (payload !== undefined) {
        const nextEntry = payload
          ? {
              engineWeekMap: payload.engineWeekMap,
              engineSimMap: payload.engineSimMap,
              sidebarStats: payload.sidebarStats,
            }
          : null;
        if (!active) return;
        setEntryCache((previous) => ({ ...previous, [selectedSelectionKey]: nextEntry }));
        setStableEntry(nextEntry);
        setLoadedSelectionKey(selectedSelectionKey);
        return;
      }

      const fetched = await fetchStrategyClientPayload(selectedSelection);
      if (!active) return;
      const nextEntry = fetched
        ? {
            engineWeekMap: fetched.engineWeekMap,
            engineSimMap: fetched.engineSimMap,
            sidebarStats: fetched.sidebarStats,
          }
        : null;
      setEntryCache((previous) => ({ ...previous, [selectedSelectionKey]: nextEntry }));
      setStableEntry(nextEntry);
      setLoadedSelectionKey(selectedSelectionKey);
    };

    void ensureSelectionEntry();

    return () => {
      active = false;
    };
  }, [entryCache, selectedSelection, selectedSelectionKey]);

  useEffect(() => {
    const detail: StrategySidebarStatsDetail = {
      selection: selectedSelection,
      stats:
        loadedSelectionKey === selectedSelectionKey
          ? stableEntry?.sidebarStats ?? null
          : null,
    };
    window.dispatchEvent(new CustomEvent(STRATEGY_SIDEBAR_STATS_EVENT, { detail }));
  }, [loadedSelectionKey, selectedSelection, selectedSelectionKey, stableEntry]);

  const strategyDescription = getStrategy(selectedSelection.strategy)?.description ?? null;
  const strategyLabel = getStrategy(selectedSelection.strategy)?.label ?? selectedSelection.strategy;
  const entryStyleLabel = getEntryStyle(selectedSelection.f1)?.label ?? selectedSelection.f1;

  return (
    <div className="space-y-4">
      <header className="mb-8">
        <div>
          <h1 className="text-3xl font-semibold text-[var(--foreground)]">
            Performance
          </h1>
          <p className="mt-1 text-xs uppercase tracking-[0.18em] text-[color:var(--muted)]">
            {strategyLabel} · {entryStyleLabel}
          </p>
        </div>
      </header>
      <PerformanceViewSection
        {...performanceProps}
        engineWeekMap={stableEntry?.engineWeekMap ?? null}
        engineSimMap={stableEntry?.engineSimMap ?? null}
        strategyDescription={strategyDescription}
        notesStorageKey={selectedSelectionKey}
      />
    </div>
  );
}
