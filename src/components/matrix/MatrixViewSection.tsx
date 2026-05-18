/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: MatrixViewSection.tsx
 *
 * Description:
 * Matrix workspace selector over the shared strategy session store.
 * Strategy data is no longer cached separately from Performance.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

"use client";

import { useEffect, useMemo, useState } from "react";
import CryptoBoard from "@/components/flagship/CryptoBoard";
import FlagshipBoard from "@/components/flagship/FlagshipBoard";
import MatrixControls, { type MatrixTab } from "@/components/matrix/MatrixControls";
import RiskBoard from "@/components/matrix/RiskBoard";
import StrategyArtifactLoadingGate from "@/components/performance/StrategyArtifactLoadingGate";
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
  useWeeklyReturns,
  type WeeklyReturnRow,
} from "@/lib/performance/strategySessionStore";

type MatrixViewSectionProps = {
  weeks: string[];
  initialWeek: string | null;
  initialWeekExplicit: boolean;
  currentWeekOpenUtc: string;
  initialTab: MatrixTab;
  initialSelection: RuntimeStrategySelection;
  initialStrategyData: Pick<
    StrategyClientPayload,
    | "engineWeekMap"
    | "engineSimMap"
    | "engineWeekResults"
    | "sidebarStats"
    | "weekOptions"
    | "currentWeekOpenUtc"
    | "artifactMeta"
  > | null;
  initialWeeklyReturns: Record<string, WeeklyReturnRow[]>;
};

function resolveSelectedWeek(
  initialWeek: string | null,
  weeks: string[],
  currentWeekOpenUtc: string,
  engineWeekResults?: Record<string, { tradeCount: number; totalReturnPct: number }> | null,
) {
  const weekOptions = weeks.filter((week) => week !== "all");
  if (initialWeek && weekOptions.includes(initialWeek)) return initialWeek;
  const nonEmptyWeek = engineWeekResults
    ? weekOptions.find((week) => {
        if (week === currentWeekOpenUtc) return false;
        const result = engineWeekResults[week];
        return Boolean(result && (result.tradeCount > 0 || Math.abs(result.totalReturnPct) >= 1e-9));
      })
    : null;
  if (nonEmptyWeek) return nonEmptyWeek;
  return weekOptions.find((week) => week !== currentWeekOpenUtc) ?? weekOptions[0] ?? null;
}

export default function MatrixViewSection({
  weeks,
  initialWeek,
  initialWeekExplicit,
  currentWeekOpenUtc,
  initialTab,
  initialSelection,
  initialStrategyData,
}: MatrixViewSectionProps) {
  const [selectedWeek, setSelectedWeek] = useState<string | null>(() => (
    initialWeek ? resolveSelectedWeek(initialWeek, weeks, currentWeekOpenUtc) : null
  ));
  const [selectedTab, setSelectedTab] = useState<MatrixTab>(initialTab);
  const [selectedSelection, setSelectedSelection] = useState<RuntimeStrategySelection>(initialSelection);
  const selectedSelectionKey = buildStrategySelectionKey(selectedSelection);
  const session = useStrategySession(selectedSelection);
  const payload = session.payload;
  const engineWeekResults = payload?.engineWeekResults ?? null;
  const availableWeeks = useMemo(() => {
    const payloadWeeks = (payload?.weekOptions ?? []).filter((week) => week !== "all");
    if (payloadWeeks.length > 0) return payloadWeeks;
    const merged = Array.from(new Set([...weeks.filter((week) => week !== "all"), currentWeekOpenUtc]));
    return merged.length > 0 ? merged : weeks.filter((week) => week !== "all");
  }, [currentWeekOpenUtc, payload?.weekOptions, weeks]);
  const { rows: weeklyReturns } = useWeeklyReturns(engineWeekResults ? selectedWeek : null);

  useEffect(() => {
    if (!initialWeek && !engineWeekResults) return;
    setSelectedWeek(resolveSelectedWeek(initialWeek, availableWeeks, currentWeekOpenUtc, engineWeekResults));
  }, [availableWeeks, currentWeekOpenUtc, engineWeekResults, initialWeek]);

  useEffect(() => {
    setSelectedTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    setSelectedSelection(initialSelection);
  }, [initialSelection]);

  useEffect(() => {
    if (!initialStrategyData) return;
    seedStrategySessionPayload(initialSelection, initialStrategyData);
  }, [initialSelection, initialStrategyData]);

  useEffect(() => {
    const onSelectionCommit = (event: Event) => {
      const custom = event as CustomEvent<StrategySelectionCommitDetail>;
      setSelectedSelection(custom.detail.selection);
    };
    window.addEventListener(STRATEGY_SELECTION_COMMIT_EVENT, onSelectionCommit);
    return () => window.removeEventListener(STRATEGY_SELECTION_COMMIT_EVENT, onSelectionCommit);
  }, []);

  useEffect(() => {
    if (!engineWeekResults || !selectedWeek || engineWeekResults[selectedWeek]) return;
    if (selectedWeek === currentWeekOpenUtc) return;
    const fallbackWeek = availableWeeks.find((week) => engineWeekResults[week]);
    if (fallbackWeek && fallbackWeek !== selectedWeek) {
      setSelectedWeek(fallbackWeek);
    }
  }, [availableWeeks, currentWeekOpenUtc, engineWeekResults, selectedWeek]);

  useEffect(() => {
    if (initialWeekExplicit || !engineWeekResults || !selectedWeek) return;
    if (selectedWeek === currentWeekOpenUtc) return;
    const selectedResult = engineWeekResults[selectedWeek];
    const selectedIsEmpty = !selectedResult || (
      selectedResult.tradeCount === 0 &&
      Math.abs(selectedResult.totalReturnPct) < 1e-9
    );
    if (!selectedIsEmpty) return;

    const nonEmptyWeek = availableWeeks.find((week) => {
      if (week === currentWeekOpenUtc) return false;
      const result = engineWeekResults[week];
      return Boolean(result && (result.tradeCount > 0 || Math.abs(result.totalReturnPct) >= 1e-9));
    });
    if (nonEmptyWeek && nonEmptyWeek !== selectedWeek) {
      setSelectedWeek(nonEmptyWeek);
    }
  }, [availableWeeks, currentWeekOpenUtc, engineWeekResults, initialWeekExplicit, selectedWeek]);

  const canonicalSignals = useMemo(
    () => (selectedWeek ? engineWeekResults?.[selectedWeek]?.signals ?? [] : []),
    [engineWeekResults, selectedWeek],
  );

  useEffect(() => {
    const detail: StrategySidebarStatsDetail = {
      selection: selectedSelection,
      stats: payload?.sidebarStats ?? null,
    };
    window.dispatchEvent(new CustomEvent(STRATEGY_SIDEBAR_STATS_EVENT, { detail }));
  }, [payload?.sidebarStats, selectedSelection]);

  useEffect(() => {
    const selectedWeekResult = selectedWeek ? engineWeekResults?.[selectedWeek] ?? null : null;
    if (!selectedWeekResult) return;
    window.dispatchEvent(new CustomEvent("performance-week-stats", {
      detail: {
        weekKey: selectedWeekResult.weekOpenUtc,
        returnPct: selectedWeekResult.totalReturnPct,
        tradeCount: selectedWeekResult.tradeCount,
        winCount: selectedWeekResult.winCount,
        lossCount: selectedWeekResult.lossCount,
        winRate: selectedWeekResult.winRate,
        empty: selectedWeekResult.tradeCount === 0 && Math.abs(selectedWeekResult.totalReturnPct) < 1e-9,
      },
    }));
  }, [engineWeekResults, selectedWeek]);

  const currentReady = Boolean(engineWeekResults) || session.status === "error";
  const loadingPhase = session.currentWeekStatus === "current-loading"
    ? "current-week"
    : session.status === "loading"
      ? "loading"
      : null;

  return (
    <StrategyArtifactLoadingGate
      currentReady={currentReady}
      pageLabel="Matrix Page"
      phase={loadingPhase}
    >
      <div className="space-y-4">
        <MatrixControls
          weeks={availableWeeks}
          selectedWeek={selectedWeek}
          currentWeekOpen={currentWeekOpenUtc}
          selectedTab={selectedTab}
          onWeekChange={setSelectedWeek}
          onTabChange={setSelectedTab}
        />

        {session.status === "missing" || session.status === "error" ? (
          <div className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] px-5 py-4 text-sm text-[color:var(--muted)] shadow-sm">
            Strategy data is not ready yet.
          </div>
        ) : null}

        {selectedTab === "crypto" && selectedWeek ? <CryptoBoard weekOpenUtc={selectedWeek} /> : null}
        {selectedTab === "risk" && selectedWeek ? (
          <RiskBoard
            weekOpenUtc={selectedWeek}
            currentWeekOpenUtc={currentWeekOpenUtc}
            selection={selectedSelection}
            engineWeekResults={engineWeekResults}
            canonicalSignals={canonicalSignals}
            weeklyReturns={weeklyReturns}
          />
        ) : null}
        {selectedTab === "cfd" && selectedWeek ? (
          <FlagshipBoard
            key={selectedSelectionKey}
            weekOpenUtc={selectedWeek}
            currentWeekOpenUtc={currentWeekOpenUtc}
            selection={selectedSelection}
            engineWeekResults={engineWeekResults}
            canonicalSignals={canonicalSignals}
            weeklyReturns={weeklyReturns}
          />
        ) : null}
      </div>
    </StrategyArtifactLoadingGate>
  );
}
