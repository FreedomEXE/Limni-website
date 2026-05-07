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
import RiskBoard from "@/components/matrix/RiskBoard";
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
import {
  fetchStrategyClientPayload,
  getStrategyClientPayload,
  setStrategyClientPayload,
} from "@/lib/performance/strategyClientCache";

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
  initialStrategyData: {
    engineWeekResults: Record<string, WeeklyHoldResult> | null;
    sidebarStats: EngineSidebarStats | null;
  } | null;
  initialStrategyEntries?: Record<string, MatrixViewSectionProps["initialStrategyData"]>;
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
  initialStrategyData,
  initialStrategyEntries = {},
  allWeeklyReturns,
}: MatrixViewSectionProps) {
  const initialSelectionKey = buildStrategySelectionKey(initialSelection);
  const [selectedWeek, setSelectedWeek] = useState<string | null>(() => resolveSelectedWeek(initialWeek, weeks));
  const [selectedTab, setSelectedTab] = useState<MatrixTab>(initialTab);
  const [selectedSelection, setSelectedSelection] = useState<RuntimeStrategySelection>(initialSelection);
  const [strategyDataCache, setStrategyDataCache] = useState<Record<string, MatrixViewSectionProps["initialStrategyData"]>>(() => ({
    ...initialStrategyEntries,
    ...(initialStrategyData ? { [initialSelectionKey]: initialStrategyData } : {}),
  }));
  const [stableStrategyData, setStableStrategyData] = useState<MatrixViewSectionProps["initialStrategyData"]>(initialStrategyData);
  const [loadedSelectionKey, setLoadedSelectionKey] = useState(initialSelectionKey);

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
    if (!initialStrategyData) return;
    setStrategyDataCache((previous) => ({
      ...initialStrategyEntries,
      ...previous,
      [initialSelectionKey]: previous[initialSelectionKey] ?? initialStrategyData,
    }));
    setStableStrategyData((previous) => previous ?? initialStrategyData);
    setLoadedSelectionKey(initialSelectionKey);
    setStrategyClientPayload(initialSelection, {
      engineWeekMap: null,
      engineSimMap: null,
      engineWeekResults: initialStrategyData.engineWeekResults,
      sidebarStats: initialStrategyData.sidebarStats,
    });
    for (const [selectionKey, entry] of Object.entries(initialStrategyEntries)) {
      if (!entry) continue;
      const [strategy, f1, f2] = selectionKey.split(":");
      if (!strategy || !f1 || !f2) continue;
      setStrategyClientPayload({ strategy, f1, f2 }, {
        engineWeekMap: null,
        engineSimMap: null,
        engineWeekResults: entry.engineWeekResults,
        sidebarStats: entry.sidebarStats,
      });
    }
  }, [initialSelection, initialSelectionKey, initialStrategyData, initialStrategyEntries]);

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

    const ensureStrategyData = async () => {
      const cachedData = strategyDataCache[selectedSelectionKey];
      if (cachedData !== undefined) {
        setStableStrategyData(cachedData ?? null);
        setLoadedSelectionKey(selectedSelectionKey);
        return;
      }

      const payload = getStrategyClientPayload(selectedSelection);
      if (payload !== undefined) {
        const nextData = payload
          ? {
              engineWeekResults: payload.engineWeekResults,
              sidebarStats: payload.sidebarStats,
            }
          : null;
        if (!active) return;
        setStrategyDataCache((previous) => ({ ...previous, [selectedSelectionKey]: nextData }));
        setStableStrategyData(nextData);
        setLoadedSelectionKey(selectedSelectionKey);
        return;
      }

      const fetched = await fetchStrategyClientPayload(selectedSelection);
      if (!active) return;
      const nextData = fetched
        ? {
            engineWeekResults: fetched.engineWeekResults,
            sidebarStats: fetched.sidebarStats,
          }
        : null;
      setStrategyDataCache((previous) => ({ ...previous, [selectedSelectionKey]: nextData }));
      setStableStrategyData(nextData);
      setLoadedSelectionKey(selectedSelectionKey);
    };

    void ensureStrategyData();

    return () => {
      active = false;
    };
  }, [selectedSelection, selectedSelectionKey, strategyDataCache]);

  const engineWeekResults = stableStrategyData?.engineWeekResults ?? null;

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
      stats:
        loadedSelectionKey === selectedSelectionKey
          ? stableStrategyData?.sidebarStats ?? null
          : null,
    };
    window.dispatchEvent(new CustomEvent(STRATEGY_SIDEBAR_STATS_EVENT, { detail }));
  }, [loadedSelectionKey, selectedSelection, selectedSelectionKey, stableStrategyData]);

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
      {selectedTab === "risk" ? (
        <RiskBoard
          weekOpenUtc={selectedWeek}
          currentWeekOpenUtc={currentWeekOpenUtc}
          selection={selectedSelection}
          engineWeekResults={engineWeekResults}
          canonicalSignals={canonicalSignals}
          weeklyReturns={weeklyReturns}
        />
      ) : null}
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
