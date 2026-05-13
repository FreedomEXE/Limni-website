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

import { useEffect, useMemo, useRef, useState } from "react";
import CryptoBoard from "@/components/flagship/CryptoBoard";
import FlagshipBoard from "@/components/flagship/FlagshipBoard";
import MatrixControls, { type MatrixTab } from "@/components/matrix/MatrixControls";
import RiskBoard from "@/components/matrix/RiskBoard";
import StrategyArtifactLoadingGate from "@/components/performance/StrategyArtifactLoadingGate";
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
  prefetchVisibleStrategyPayloads,
  requestStrategyArtifactWarm,
  setStrategyClientPayload,
} from "@/lib/performance/strategyClientCache";
import type { StrategyClientPayload } from "@/lib/performance/strategyClientPayload";

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

type MatrixStrategyData = {
    engineWeekResults: Record<string, WeeklyHoldResult> | null;
    sidebarStats: EngineSidebarStats | null;
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
  initialWeeklyReturns,
}: MatrixViewSectionProps) {
  const initialSelectionKey = buildStrategySelectionKey(initialSelection);
  const [selectedWeek, setSelectedWeek] = useState<string | null>(() => resolveSelectedWeek(initialWeek, weeks));
  const [selectedTab, setSelectedTab] = useState<MatrixTab>(initialTab);
  const [selectedSelection, setSelectedSelection] = useState<RuntimeStrategySelection>(initialSelection);
  const [strategyDataCache, setStrategyDataCache] = useState<Record<string, MatrixStrategyData | null>>(() => (
    initialStrategyData
      ? {
          [initialSelectionKey]: {
            engineWeekResults: initialStrategyData.engineWeekResults,
            sidebarStats: initialStrategyData.sidebarStats,
          },
        }
      : {}
  ));
  const [stableStrategyData, setStableStrategyData] = useState<MatrixStrategyData | null>(
    initialStrategyData
      ? {
          engineWeekResults: initialStrategyData.engineWeekResults,
          sidebarStats: initialStrategyData.sidebarStats,
        }
      : null,
  );
  const [weeklyReturnsByWeek, setWeeklyReturnsByWeek] = useState<Record<string, WeeklyReturnRow[]>>(initialWeeklyReturns);
  const [loadedSelectionKey, setLoadedSelectionKey] = useState(initialSelectionKey);
  const prefetchStartedRef = useRef(false);

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
    const initialData = {
      engineWeekResults: initialStrategyData.engineWeekResults,
      sidebarStats: initialStrategyData.sidebarStats,
    };
    setStrategyDataCache((previous) => ({
      ...previous,
      [initialSelectionKey]: previous[initialSelectionKey] ?? initialData,
    }));
    setStableStrategyData((previous) => previous ?? initialData);
    setLoadedSelectionKey(initialSelectionKey);
    setStrategyClientPayload(initialSelection, {
      engineWeekMap: initialStrategyData.engineWeekMap,
      engineSimMap: initialStrategyData.engineSimMap,
      engineWeekResults: initialStrategyData.engineWeekResults,
      sidebarStats: initialStrategyData.sidebarStats,
      weekOptions: initialStrategyData.weekOptions,
      currentWeekOpenUtc: initialStrategyData.currentWeekOpenUtc,
      artifactMeta: initialStrategyData.artifactMeta,
    });
  }, [initialSelection, initialSelectionKey, initialStrategyData]);

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

      const payload = getStrategyClientPayload(selectedSelection, "matrix");
      if (payload !== undefined) {
        const nextData = payload && (payload.engineWeekResults || payload.sidebarStats)
          ? {
              engineWeekResults: payload.engineWeekResults,
              sidebarStats: payload.sidebarStats,
            }
          : null;
        if (!active) return;
        if (nextData) {
          setStrategyDataCache((previous) => ({ ...previous, [selectedSelectionKey]: nextData }));
        }
        setStableStrategyData(nextData);
        setLoadedSelectionKey(selectedSelectionKey);
        return;
      }

      const fetched = await fetchStrategyClientPayload(selectedSelection, "matrix");
      if (!active) return;
      const nextData = fetched && (fetched.engineWeekResults || fetched.sidebarStats)
        ? {
            engineWeekResults: fetched.engineWeekResults,
            sidebarStats: fetched.sidebarStats,
          }
        : null;
      if (nextData) {
        setStrategyDataCache((previous) => ({ ...previous, [selectedSelectionKey]: nextData }));
      }
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
    () => (selectedWeek ? weeklyReturnsByWeek[selectedWeek] ?? [] : []),
    [selectedWeek, weeklyReturnsByWeek],
  );

  useEffect(() => {
    if (!selectedWeek || weeklyReturnsByWeek[selectedWeek]) return undefined;
    let active = true;
    const loadWeeklyReturns = async () => {
      try {
        const response = await fetch(`/api/matrix/weekly-returns?week=${encodeURIComponent(selectedWeek)}`, {
          cache: "no-store",
        });
        if (!response.ok) return;
        const payload = (await response.json()) as { rows?: WeeklyReturnRow[] };
        if (!active) return;
        setWeeklyReturnsByWeek((previous) => ({
          ...previous,
          [selectedWeek]: payload.rows ?? [],
        }));
      } catch {
        if (!active) return;
        setWeeklyReturnsByWeek((previous) => ({
          ...previous,
          [selectedWeek]: [],
        }));
      }
    };
    void loadWeeklyReturns();
    return () => {
      active = false;
    };
  }, [selectedWeek, weeklyReturnsByWeek]);

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
    if (loadedSelectionKey !== selectedSelectionKey || stableStrategyData) return undefined;
    let active = true;
    const poll = async () => {
      void requestStrategyArtifactWarm(selectedSelection);
      const fetched = await fetchStrategyClientPayload(selectedSelection, "matrix");
      if (!active || !(fetched?.engineWeekResults || fetched?.sidebarStats)) return;
      const nextData = {
        engineWeekResults: fetched.engineWeekResults,
        sidebarStats: fetched.sidebarStats,
      };
      setStrategyDataCache((previous) => ({ ...previous, [selectedSelectionKey]: nextData }));
      setStableStrategyData(nextData);
      setLoadedSelectionKey(selectedSelectionKey);
    };
    const intervalId = window.setInterval(() => {
      void poll();
    }, 10000);
    void poll();
    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, [loadedSelectionKey, selectedSelection, selectedSelectionKey, stableStrategyData]);

  useEffect(() => {
    if (prefetchStartedRef.current || loadedSelectionKey !== selectedSelectionKey || !stableStrategyData) {
      return undefined;
    }

    prefetchStartedRef.current = true;
    let active = true;
    void prefetchVisibleStrategyPayloads({
      currentSelection: selectedSelection,
      concurrency: 1,
      delayMs: 1500,
      scope: "matrix",
      shouldContinue: () => active,
    });

    return () => {
      active = false;
    };
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

  const currentReady = loadedSelectionKey === selectedSelectionKey && Boolean(stableStrategyData);

  return (
    <StrategyArtifactLoadingGate
      currentReady={currentReady}
      currentSelection={selectedSelection}
      pageLabel="Matrix Page"
    >
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
    </StrategyArtifactLoadingGate>
  );
}
