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

import { useEffect, useMemo, useState, type ComponentProps } from "react";
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

function parseMode(value: string | null | undefined) {
  return value === "legacy" ? "legacy" : "flagship";
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
  const [mode, setMode] = useState<"flagship" | "legacy">(initialMode);
  const [view, setView] = useState<PerformanceView>(initialView);
  const [system, setSystem] = useState<PerformanceSystem>(initialSystem);
  const [style, setStyle] = useState<WeeklyPerformanceFamily>(initialStyle);

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
      const custom = event as CustomEvent<"flagship" | "legacy">;
      const nextMode = custom.detail === "legacy" ? "legacy" : "flagship";
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
