/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: PerformanceViewSection.tsx
 *
 * Description:
 * Performance body shell with Flagship or Legacy mode support. Summary,
 * basket, research, and notes use the restored grid; simulation uses
 * the shared equity-curve chart.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/
"use client";

import { useEffect, useMemo, useState, type ComponentProps, useCallback } from "react";
import type { PerformanceSystem } from "@/lib/performance/modelConfig";
import type { PerformanceView } from "@/lib/performance/pageState";
import PerformanceGrid from "@/components/performance/PerformanceGrid";
import PerformanceViewCards, {
  PERFORMANCE_VIEW_CARDS,
} from "@/components/performance/PerformanceViewCards";
import PerformanceSimulationSection, {
  type PerformanceSimulationGroup,
} from "@/components/performance/PerformanceSimulationSection";
import {
  resolveActiveStrategyEntry,
  resolveDisplayModelsForEntry,
  type PerformanceStrategyFamily,
} from "@/lib/performance/strategyRegistry";

type GridProps = Omit<ComponentProps<typeof PerformanceGrid>, "view" | "combined" | "perAsset"> & {
  combined: ComponentProps<typeof PerformanceGrid>["combined"];
  perAsset: ComponentProps<typeof PerformanceGrid>["perAsset"];
};

type WeeklyPerformanceFamily = Exclude<PerformanceStrategyFamily, "katarakti">;

type PerformanceViewSectionProps = {
  initialMode: "flagship" | "legacy";
  initialView: PerformanceView;
  initialSystem: PerformanceSystem;
  initialStyle?: WeeklyPerformanceFamily;
  universalGridPropsBySystem: Partial<Record<PerformanceSystem, GridProps>>;
  tieredGridPropsBySystem?: Partial<Record<PerformanceSystem, GridProps>>;
  universalSimulationBySystem?: Partial<Record<PerformanceSystem, PerformanceSimulationGroup>>;
  tieredSimulationBySystem?: Partial<Record<PerformanceSystem, PerformanceSimulationGroup>>;
  flagshipGridProps: GridProps | null;
  flagshipSimulation: PerformanceSimulationGroup | null;
};

type AdrTradeRow = {
  symbol: string;
  direction: string;
  entryTimeUtc: string | null;
  exitTimeUtc: string | null;
  entryPrice: number | null;
  exitPrice: number | null;
  pnlPct: number | null;
  exitReason: string | null;
  tradeNumber: number | null;
};

function MatrixPerformanceView() {
  const [trades, setTrades] = useState<AdrTradeRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/flagship/adr-trades")
      .then((r) => r.json())
      .then((d) => { setTrades(d.trades ?? []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return <div className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] px-5 py-4 text-sm text-[color:var(--muted)]">Loading ADR trades...</div>;

  const byPair = new Map<string, AdrTradeRow[]>();
  for (const t of trades) {
    const list = byPair.get(t.symbol) ?? [];
    list.push(t);
    byPair.set(t.symbol, list);
  }
  const pairs = [...byPair.entries()].sort((a, b) => b[1].length - a[1].length);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] px-5 py-4 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-[color:var(--muted)]">
          ADR Forward Test — This Week
        </h2>
        <p className="mt-1 text-xs text-[color:var(--muted)]">
          Fresh Start · 1x ADR Entry · 0.25x ADR TP · {trades.length} trades across {byPair.size} pairs
        </p>
      </div>

      <div className="overflow-x-auto rounded-xl border border-[var(--panel-border)]">
        <table className="min-w-full border-separate border-spacing-0 text-xs">
          <thead>
            <tr className="bg-[var(--panel)]/80 text-[10px] font-semibold uppercase tracking-[0.12em] text-[color:var(--muted)]">
              <th className="border-b border-r border-[var(--panel-border)] px-3 py-2 text-left">Pair</th>
              <th className="border-b border-r border-[var(--panel-border)] px-3 py-2 text-left">Dir</th>
              <th className="border-b border-r border-[var(--panel-border)] px-3 py-2 text-left">#</th>
              <th className="border-b border-r border-[var(--panel-border)] px-3 py-2 text-right">Entry</th>
              <th className="border-b border-r border-[var(--panel-border)] px-3 py-2 text-right">Exit</th>
              <th className="border-b border-r border-[var(--panel-border)] px-3 py-2 text-right">P&L</th>
              <th className="border-b border-[var(--panel-border)] px-3 py-2 text-left">Status</th>
            </tr>
          </thead>
          <tbody>
            {pairs.map(([pair, pairTrades]) =>
              pairTrades.map((t, i) => (
                <tr key={`${pair}-${i}`} className="border-b border-[var(--panel-border)] hover:bg-[var(--panel)]/50">
                  <td className="border-b border-r border-[var(--panel-border)] px-3 py-2 font-semibold">{t.symbol}</td>
                  <td className={`border-b border-r border-[var(--panel-border)] px-3 py-2 font-semibold ${t.direction === "LONG" ? "text-lime-400" : "text-red-400"}`}>
                    {t.direction}
                  </td>
                  <td className="border-b border-r border-[var(--panel-border)] px-3 py-2">{t.tradeNumber ?? "—"}</td>
                  <td className="border-b border-r border-[var(--panel-border)] px-3 py-2 text-right font-mono">{t.entryPrice?.toFixed(5) ?? "—"}</td>
                  <td className="border-b border-r border-[var(--panel-border)] px-3 py-2 text-right font-mono">{t.exitPrice?.toFixed(5) ?? "—"}</td>
                  <td className={`border-b border-r border-[var(--panel-border)] px-3 py-2 text-right font-semibold ${(t.pnlPct ?? 0) >= 0 ? "text-lime-400" : "text-red-400"}`}>
                    {t.pnlPct !== null ? `${t.pnlPct >= 0 ? "+" : ""}${t.pnlPct.toFixed(2)}%` : "—"}
                  </td>
                  <td className="border-b border-[var(--panel-border)] px-3 py-2">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
                      t.exitReason === "tp" ? "bg-lime-500/15 text-lime-400" :
                      t.exitReason === "active" ? "bg-yellow-500/15 text-yellow-400" :
                      "bg-gray-500/15 text-gray-400"
                    }`}>
                      {t.exitReason === "tp" ? "TP Hit" : t.exitReason === "active" ? "Active" : t.exitReason ?? "—"}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function PerformanceViewSection({
  initialMode,
  initialView,
  initialSystem,
  initialStyle = "tiered",
  universalGridPropsBySystem,
  tieredGridPropsBySystem,
  universalSimulationBySystem,
  tieredSimulationBySystem,
  flagshipGridProps,
  flagshipSimulation,
}: PerformanceViewSectionProps) {
  const [mode, setMode] = useState<"flagship" | "legacy" | "matrix">(initialMode);
  const [view, setView] = useState<PerformanceView>(initialView);
  const [system, setSystem] = useState<PerformanceSystem>(initialSystem);
  const [style, setStyle] = useState<WeeklyPerformanceFamily>(initialStyle);

  useEffect(() => {
    setMode(initialMode);
  }, [initialMode]);

  useEffect(() => {
    setView(initialView);
  }, [initialView]);

  useEffect(() => {
    setSystem(initialSystem);
  }, [initialSystem]);

  useEffect(() => {
    setStyle(initialStyle);
  }, [initialStyle]);

  useEffect(() => {
    const onSystemChange = (event: Event) => {
      const custom = event as CustomEvent<PerformanceSystem>;
      if (custom.detail === "v1" || custom.detail === "v2" || custom.detail === "v3") {
        setSystem(custom.detail);
      }
    };
    const onStyleChange = (event: Event) => {
      const custom = event as CustomEvent<PerformanceStrategyFamily>;
      if (custom.detail === "universal" || custom.detail === "tiered") {
        setStyle(custom.detail);
      }
    };
    const onModeChange = (event: Event) => {
      const custom = event as CustomEvent<string>;
      const nextMode = custom.detail === "legacy" ? "legacy" : custom.detail === "matrix" ? "matrix" : "flagship";
      setMode(nextMode);
      if (nextMode === "flagship") {
        setStyle("tiered");
        setSystem("v3");
      }
    };
    window.addEventListener("performance-system-change", onSystemChange);
    window.addEventListener("performance-style-change", onStyleChange);
    window.addEventListener("performance-mode-change", onModeChange);
    return () => {
      window.removeEventListener("performance-system-change", onSystemChange);
      window.removeEventListener("performance-style-change", onStyleChange);
      window.removeEventListener("performance-mode-change", onModeChange);
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    url.searchParams.set("mode", mode);
    url.searchParams.set("view", view);
    if (mode === "flagship") {
      url.searchParams.set("style", "tiered");
      url.searchParams.set("system", "v3");
    } else {
      url.searchParams.set("style", style);
      url.searchParams.set("system", system);
    }
    window.history.replaceState(window.history.state, "", `${url.pathname}?${url.searchParams.toString()}`);
  }, [mode, view, system, style]);

  const activeEntry =
    mode === "flagship"
      ? resolveActiveStrategyEntry({ family: "tiered", systemVersion: "v3" })
      : resolveActiveStrategyEntry({
          family: style,
          systemVersion: system,
        });

  const baseGridProps = useMemo(() => {
    if (mode === "flagship") {
      return flagshipGridProps;
    }
    const preferred =
      style === "tiered"
        ? tieredGridPropsBySystem?.[system] ?? universalGridPropsBySystem[system]
        : universalGridPropsBySystem[system];
    return preferred ?? universalGridPropsBySystem.v3 ?? universalGridPropsBySystem.v1 ?? null;
  }, [mode, flagshipGridProps, style, system, tieredGridPropsBySystem, universalGridPropsBySystem]);

  const simulationGroup = useMemo(() => {
    if (mode === "flagship") {
      return flagshipSimulation;
    }
    return style === "tiered"
      ? tieredSimulationBySystem?.[system] ?? null
      : universalSimulationBySystem?.[system] ?? null;
  }, [mode, flagshipSimulation, style, system, tieredSimulationBySystem, universalSimulationBySystem]);

  if (mode === "matrix") {
    return <MatrixPerformanceView />;
  }

  if (!baseGridProps) {
    return (
      <div className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] px-5 py-4 text-sm text-[color:var(--muted)] shadow-sm">
        No canonical component breakdown is available for this strategy yet.
      </div>
    );
  }

  const modelSet = new Set(resolveDisplayModelsForEntry(activeEntry));
  const filteredCombined = {
    ...baseGridProps.combined,
    models: baseGridProps.combined.models.filter((entry) => modelSet.has(entry.model)),
  };
  const filteredPerAsset = baseGridProps.perAsset.map((section) => ({
    ...section,
    models: section.models.filter((entry) => modelSet.has(entry.model)),
  }));

  return (
    <>
      <PerformanceViewCards
        activeView={view}
        onViewChange={setView}
        views={PERFORMANCE_VIEW_CARDS}
      />
      {view === "simulation" ? (
        <PerformanceSimulationSection group={simulationGroup} />
      ) : (
        <PerformanceGrid
          {...baseGridProps}
          combined={filteredCombined}
          perAsset={filteredPerAsset}
          view={view}
        />
      )}
    </>
  );
}
