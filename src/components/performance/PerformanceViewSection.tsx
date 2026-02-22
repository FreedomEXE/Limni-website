"use client";

import { useEffect, useState, type ComponentProps } from "react";
import type { PerformanceView } from "@/lib/performance/pageState";
import {
  PERFORMANCE_SYSTEM_MODEL_MAP,
  type PerformanceSystem,
} from "@/lib/performance/modelConfig";
import type { PerformanceModel } from "@/lib/performanceLab";
import PerformanceGrid from "@/components/performance/PerformanceGrid";
import PerformanceViewCards from "@/components/performance/PerformanceViewCards";

type PerformanceStyle = "universal" | "tiered";

const TIERED_DISPLAY_MODELS: PerformanceModel[] = [
  "antikythera_v3",
  "dealer",
  "commercial",
];

type PerformanceViewSectionProps = {
  initialView: PerformanceView;
  initialSystem: PerformanceSystem;
  initialStyle?: PerformanceStyle;
  universalGridProps: Omit<ComponentProps<typeof PerformanceGrid>, "view" | "combined" | "perAsset"> & {
    combined: ComponentProps<typeof PerformanceGrid>["combined"];
    perAsset: ComponentProps<typeof PerformanceGrid>["perAsset"];
  };
  tieredGridPropsBySystem?: Partial<Record<
    PerformanceSystem,
    Omit<ComponentProps<typeof PerformanceGrid>, "view" | "combined" | "perAsset"> & {
      combined: ComponentProps<typeof PerformanceGrid>["combined"];
      perAsset: ComponentProps<typeof PerformanceGrid>["perAsset"];
    }
  >>;
};

export default function PerformanceViewSection({
  initialView,
  initialSystem,
  initialStyle = "universal",
  universalGridProps,
  tieredGridPropsBySystem,
}: PerformanceViewSectionProps) {
  const [view, setView] = useState<PerformanceView>(initialView);
  const [system, setSystem] = useState<PerformanceSystem>(initialSystem);
  const [style, setStyle] = useState<PerformanceStyle>(initialStyle);

  useEffect(() => {
    const onSystemChange = (event: Event) => {
      const custom = event as CustomEvent<PerformanceSystem>;
      if (custom.detail === "v1" || custom.detail === "v2" || custom.detail === "v3") {
        setSystem(custom.detail);
      }
    };
    const onStyleChange = (event: Event) => {
      const custom = event as CustomEvent<PerformanceStyle>;
      if (custom.detail === "universal" || custom.detail === "tiered") {
        setStyle(custom.detail);
      }
    };
    window.addEventListener("performance-system-change", onSystemChange);
    window.addEventListener("performance-style-change", onStyleChange);
    return () => {
      window.removeEventListener("performance-system-change", onSystemChange);
      window.removeEventListener("performance-style-change", onStyleChange);
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const url = new URL(window.location.href);
    url.searchParams.set("view", view);
    url.searchParams.set("system", system);
    url.searchParams.set("style", style);
    window.history.replaceState(window.history.state, "", `${url.pathname}?${url.searchParams.toString()}`);
  }, [view, system, style]);

  const usingTiered = style === "tiered" && Boolean(tieredGridPropsBySystem?.[system]);
  const baseGridProps = usingTiered
    ? tieredGridPropsBySystem?.[system] ?? universalGridProps
    : universalGridProps;

  const activeModels = usingTiered ? TIERED_DISPLAY_MODELS : PERFORMANCE_SYSTEM_MODEL_MAP[system];
  const modelSet = new Set(activeModels);
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
      <PerformanceViewCards activeView={view} onViewChange={setView} />
      <PerformanceGrid
        {...baseGridProps}
        combined={filteredCombined}
        perAsset={filteredPerAsset}
        view={view}
      />
    </>
  );
}
