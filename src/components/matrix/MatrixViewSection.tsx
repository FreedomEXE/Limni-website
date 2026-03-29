/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: MatrixViewSection.tsx
 *
 * Description:
 * Client-side Matrix workspace shell. Receives pre-computed week maps
 * from the server once, then switches week and tab state locally so
 * Matrix behaves like Performance.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

"use client";

import { useEffect, useMemo, useState } from "react";
import CryptoBoard from "@/components/flagship/CryptoBoard";
import FlagshipBoard from "@/components/flagship/FlagshipBoard";
import MatrixControls, { type MatrixTab } from "@/components/matrix/MatrixControls";
import type { AssetClass } from "@/lib/cotMarkets";
import type { EngineSidebarStats } from "@/lib/performance/engineAdapter";
import {
  buildStrategySelectionKey,
  STRATEGY_SELECTION_COMMIT_EVENT,
  STRATEGY_SIDEBAR_STATS_EVENT,
  type RuntimeStrategySelection,
  type StrategySelectionCommitDetail,
  type StrategySidebarStatsDetail,
} from "@/lib/performance/strategySelection";
import type { WeeklyHoldResult } from "@/lib/performance/weeklyHoldEngine";

type WeeklyReturnRow = {
  symbol: string;
  assetClass: AssetClass;
  returnPct: number;
  openPrice: number;
  closePrice: number;
};

type MatrixViewSectionProps = {
  weeks: string[];
  initialWeek: string | null;
  currentWeekOpenUtc: string;
  initialTab: MatrixTab;
  initialSelection: RuntimeStrategySelection;
  strategyDataMap: Record<string, {
    engineWeekResults: Record<string, WeeklyHoldResult> | null;
    sidebarStats: EngineSidebarStats | null;
  } | null>;
  allWeeklyReturns: Record<string, WeeklyReturnRow[]>;
};

function resolveSelectedWeek(initialWeek: string | null, weeks: string[]) {
  if (initialWeek && weeks.includes(initialWeek)) return initialWeek;
  return weeks[0] ?? null;
}

export default function MatrixViewSection({
  weeks,
  initialWeek,
  currentWeekOpenUtc,
  initialTab,
  initialSelection,
  strategyDataMap,
  allWeeklyReturns,
}: MatrixViewSectionProps) {
  const [selectedWeek, setSelectedWeek] = useState<string | null>(() => resolveSelectedWeek(initialWeek, weeks));
  const [selectedTab, setSelectedTab] = useState<MatrixTab>(initialTab);
  const [selectedSelection, setSelectedSelection] = useState<RuntimeStrategySelection>(initialSelection);

  const initialSelectionKey = useMemo(
    () => buildStrategySelectionKey(initialSelection),
    [initialSelection],
  );

  useEffect(() => {
    setSelectedWeek(resolveSelectedWeek(initialWeek, weeks));
  }, [initialWeek, weeks]);

  useEffect(() => {
    setSelectedTab(initialTab);
  }, [initialTab]);

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

  const selectedStrategyData = useMemo(() => {
    const selectionKey = buildStrategySelectionKey(selectedSelection);
    return strategyDataMap[selectionKey] ?? strategyDataMap[initialSelectionKey] ?? null;
  }, [initialSelectionKey, selectedSelection, strategyDataMap]);

  const engineWeekResults = selectedStrategyData?.engineWeekResults ?? null;

  const canonicalSignals = useMemo(
    () => (selectedWeek ? engineWeekResults?.[selectedWeek]?.signals ?? [] : []),
    [engineWeekResults, selectedWeek],
  );

  const weeklyReturns = useMemo(
    () => (selectedWeek ? allWeeklyReturns[selectedWeek] ?? [] : []),
    [allWeeklyReturns, selectedWeek],
  );

  useEffect(() => {
    const detail: StrategySidebarStatsDetail = {
      selection: selectedSelection,
      stats: selectedStrategyData?.sidebarStats ?? null,
    };
    window.dispatchEvent(new CustomEvent(STRATEGY_SIDEBAR_STATS_EVENT, { detail }));
  }, [selectedSelection, selectedStrategyData]);

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
      },
    }));
  }, [engineWeekResults, selectedWeek]);

  return (
    <div className="space-y-4">
      <MatrixControls
        weeks={weeks}
        selectedWeek={selectedWeek}
        currentWeekOpen={currentWeekOpenUtc}
        selectedTab={selectedTab}
        onWeekChange={setSelectedWeek}
        onTabChange={setSelectedTab}
      />

      {selectedTab === "crypto" ? <CryptoBoard weekOpenUtc={selectedWeek} /> : null}
      {selectedTab === "cfd" ? (
        <FlagshipBoard
          weekOpenUtc={selectedWeek}
          currentWeekOpenUtc={currentWeekOpenUtc}
          selection={selectedSelection}
          engineWeekResults={engineWeekResults}
          canonicalSignals={canonicalSignals}
          weeklyReturns={weeklyReturns}
        />
      ) : null}
    </div>
  );
}
