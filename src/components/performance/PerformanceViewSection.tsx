"use client";

import { useEffect, useState, type ComponentProps } from "react";
import type { PerformanceView } from "@/lib/performance/pageState";
import {
  PERFORMANCE_SYSTEM_MODEL_MAP,
  type PerformanceSystem,
} from "@/lib/performance/modelConfig";
import type { PerformanceModel } from "@/lib/performanceLab";
import PerformanceGrid from "@/components/performance/PerformanceGrid";
import StrategyPerformanceSummary, {
  type StrategySummary,
  type StrategyMarket,
} from "@/components/performance/StrategyPerformanceSummary";
import PerformanceViewCards, {
  PERFORMANCE_VIEW_CARDS,
} from "@/components/performance/PerformanceViewCards";

type PerformanceStyle = "universal" | "tiered" | "katarakti";

const TIERED_DISPLAY_MODELS: PerformanceModel[] = [
  "antikythera_v3",
  "dealer",
  "commercial",
];

type PerformanceViewSectionProps = {
  initialView: PerformanceView;
  initialSystem: PerformanceSystem;
  initialKataraktiMarket: StrategyMarket;
  botStrategies: StrategySummary[];
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
  initialKataraktiMarket,
  botStrategies,
  initialStyle = "universal",
  universalGridProps,
  tieredGridPropsBySystem,
}: PerformanceViewSectionProps) {
  const [view, setView] = useState<PerformanceView>(initialView);
  const [system, setSystem] = useState<PerformanceSystem>(initialSystem);
  const [style, setStyle] = useState<PerformanceStyle>(initialStyle);
  const [kataraktiMarket, setKataraktiMarket] = useState<StrategyMarket>(initialKataraktiMarket);

  useEffect(() => {
    const onSystemChange = (event: Event) => {
      const custom = event as CustomEvent<PerformanceSystem>;
      if (custom.detail === "v1" || custom.detail === "v2" || custom.detail === "v3") {
        setSystem(custom.detail);
      }
    };
    const onStyleChange = (event: Event) => {
      const custom = event as CustomEvent<PerformanceStyle>;
      if (custom.detail === "universal" || custom.detail === "tiered" || custom.detail === "katarakti") {
        setStyle(custom.detail);
      }
    };
    const onKataraktiMarketChange = (event: Event) => {
      const custom = event as CustomEvent<StrategyMarket>;
      if (custom.detail === "crypto_futures" || custom.detail === "mt5_forex") {
        setKataraktiMarket(custom.detail);
      }
    };
    window.addEventListener("performance-system-change", onSystemChange);
    window.addEventListener("performance-style-change", onStyleChange);
    window.addEventListener("performance-katarakti-market-change", onKataraktiMarketChange);
    return () => {
      window.removeEventListener("performance-system-change", onSystemChange);
      window.removeEventListener("performance-style-change", onStyleChange);
      window.removeEventListener("performance-katarakti-market-change", onKataraktiMarketChange);
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
    if (style === "katarakti") {
      url.searchParams.set("market", kataraktiMarket);
    } else {
      url.searchParams.delete("market");
    }
    window.history.replaceState(window.history.state, "", `${url.pathname}?${url.searchParams.toString()}`);
  }, [view, system, style, kataraktiMarket]);

  const selectedBotStrategies = botStrategies.filter((strategy) => strategy.market === kataraktiMarket);

  if (style === "katarakti") {
    return (
      <section className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] p-6 shadow-sm">
        {selectedBotStrategies.length > 0 ? (
          <StrategyPerformanceSummary strategies={selectedBotStrategies} />
        ) : (
          <p className="text-sm text-[color:var(--muted)]">
            No strategy snapshots are available for the selected Katarakti market yet.
          </p>
        )}
      </section>
    );
  }

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
      <PerformanceViewCards
        activeView={view}
        onViewChange={setView}
        views={PERFORMANCE_VIEW_CARDS}
      />
      <PerformanceGrid
        {...baseGridProps}
        combined={filteredCombined}
        perAsset={filteredPerAsset}
        view={view}
      />
    </>
  );
}
