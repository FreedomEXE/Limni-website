"use client";

import { useEffect, useState, type ComponentProps } from "react";
import type { PerformanceView } from "@/lib/performance/pageState";
import {
  PERFORMANCE_SYSTEM_MODEL_MAP,
  type PerformanceSystem,
} from "@/lib/performance/modelConfig";
import PerformanceGrid from "@/components/performance/PerformanceGrid";
import PerformanceViewCards from "@/components/performance/PerformanceViewCards";

type PerformanceViewSectionProps = {
  initialView: PerformanceView;
  initialSystem: PerformanceSystem;
  gridProps: Omit<ComponentProps<typeof PerformanceGrid>, "view" | "combined" | "perAsset"> & {
    combined: ComponentProps<typeof PerformanceGrid>["combined"];
    perAsset: ComponentProps<typeof PerformanceGrid>["perAsset"];
  };
};

export default function PerformanceViewSection({
  initialView,
  initialSystem,
  gridProps,
}: PerformanceViewSectionProps) {
  const [view, setView] = useState<PerformanceView>(initialView);
  const [system, setSystem] = useState<PerformanceSystem>(initialSystem);

  useEffect(() => {
    const onSystemChange = (event: Event) => {
      const custom = event as CustomEvent<PerformanceSystem>;
      if (custom.detail === "v1" || custom.detail === "v2" || custom.detail === "v3") {
        setSystem(custom.detail);
      }
    };
    window.addEventListener("performance-system-change", onSystemChange);
    return () => {
      window.removeEventListener("performance-system-change", onSystemChange);
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const url = new URL(window.location.href);
    url.searchParams.set("view", view);
    url.searchParams.set("system", system);
    window.history.replaceState(window.history.state, "", `${url.pathname}?${url.searchParams.toString()}`);
  }, [view, system]);

  const activeModels = PERFORMANCE_SYSTEM_MODEL_MAP[system];
  const modelSet = new Set(activeModels);
  const filteredCombined = {
    ...gridProps.combined,
    models: gridProps.combined.models.filter((entry) => modelSet.has(entry.model)),
  };
  const filteredPerAsset = gridProps.perAsset.map((section) => ({
    ...section,
    models: section.models.filter((entry) => modelSet.has(entry.model)),
  }));

  return (
    <>
      <PerformanceViewCards activeView={view} onViewChange={setView} />
      <PerformanceGrid
        {...gridProps}
        combined={filteredCombined}
        perAsset={filteredPerAsset}
        view={view}
      />
    </>
  );
}
