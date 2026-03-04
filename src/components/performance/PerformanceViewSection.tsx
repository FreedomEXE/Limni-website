"use client";

import { useEffect, useState, type ComponentProps } from "react";
import type { PerformanceView } from "@/lib/performance/pageState";
import type { PerformanceSystem } from "@/lib/performance/modelConfig";
import PerformanceGrid from "@/components/performance/PerformanceGrid";
import PerformanceViewCards, {
  PERFORMANCE_VIEW_CARDS,
} from "@/components/performance/PerformanceViewCards";
import type { KataraktiMarket, KataraktiVariant } from "@/lib/performance/kataraktiHistory";
import {
  resolveActiveStrategyEntry,
  resolveDisplayModelsForEntry,
  type PerformanceStrategyFamily,
} from "@/lib/performance/strategyRegistry";

type PerformanceViewSectionProps = {
  initialView: PerformanceView;
  initialSystem: PerformanceSystem;
  initialKataraktiMarket: KataraktiMarket;
  initialKataraktiVariant: KataraktiVariant;
  initialStyle?: PerformanceStrategyFamily;
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
  kataraktiGridPropsByVariantAndMarket?: Partial<Record<
    KataraktiVariant,
    Partial<Record<
      KataraktiMarket,
      Omit<ComponentProps<typeof PerformanceGrid>, "view" | "combined" | "perAsset"> & {
        combined: ComponentProps<typeof PerformanceGrid>["combined"];
        perAsset: ComponentProps<typeof PerformanceGrid>["perAsset"];
      }
    >>
  >>;
};

export default function PerformanceViewSection({
  initialView,
  initialSystem,
  initialKataraktiMarket,
  initialKataraktiVariant,
  initialStyle = "universal",
  universalGridProps,
  tieredGridPropsBySystem,
  kataraktiGridPropsByVariantAndMarket,
}: PerformanceViewSectionProps) {
  const [view, setView] = useState<PerformanceView>(initialView);
  const [system, setSystem] = useState<PerformanceSystem>(initialSystem);
  const [style, setStyle] = useState<PerformanceStrategyFamily>(initialStyle);
  const initialEntry = resolveActiveStrategyEntry({
    family: "katarakti",
    kataraktiVariant: initialKataraktiVariant,
    kataraktiMarket: initialKataraktiMarket,
  });
  const [kataraktiMarket, setKataraktiMarket] = useState<KataraktiMarket>(
    initialEntry?.market ?? initialKataraktiMarket,
  );
  const [kataraktiVariant, setKataraktiVariant] = useState<KataraktiVariant>(
    initialEntry?.kataraktiVariant ?? initialKataraktiVariant,
  );

  useEffect(() => {
    const onSystemChange = (event: Event) => {
      const custom = event as CustomEvent<PerformanceSystem>;
      if (custom.detail === "v1" || custom.detail === "v2" || custom.detail === "v3") {
        setSystem(custom.detail);
      }
    };
    const onStyleChange = (event: Event) => {
      const custom = event as CustomEvent<PerformanceStrategyFamily>;
      if (custom.detail === "universal" || custom.detail === "tiered" || custom.detail === "katarakti") {
        setStyle(custom.detail);
      }
    };
    const onKataraktiMarketChange = (event: Event) => {
      const custom = event as CustomEvent<KataraktiMarket>;
      if (custom.detail === "crypto_futures" || custom.detail === "mt5_forex") {
        const resolved = resolveActiveStrategyEntry({
          family: "katarakti",
          kataraktiVariant,
          kataraktiMarket: custom.detail,
        });
        setKataraktiMarket(resolved?.market ?? custom.detail);
        setKataraktiVariant(resolved?.kataraktiVariant ?? kataraktiVariant);
      }
    };
    const onKataraktiVariantChange = (event: Event) => {
      const custom = event as CustomEvent<KataraktiVariant>;
      if (custom.detail === "core" || custom.detail === "lite" || custom.detail === "v3") {
        const resolved = resolveActiveStrategyEntry({
          family: "katarakti",
          kataraktiVariant: custom.detail,
          kataraktiMarket,
        });
        setKataraktiVariant(resolved?.kataraktiVariant ?? custom.detail);
        setKataraktiMarket(resolved?.market ?? kataraktiMarket);
      }
    };
    window.addEventListener("performance-system-change", onSystemChange);
    window.addEventListener("performance-style-change", onStyleChange);
    window.addEventListener("performance-katarakti-market-change", onKataraktiMarketChange);
    window.addEventListener("performance-katarakti-variant-change", onKataraktiVariantChange);
    return () => {
      window.removeEventListener("performance-system-change", onSystemChange);
      window.removeEventListener("performance-style-change", onStyleChange);
      window.removeEventListener("performance-katarakti-market-change", onKataraktiMarketChange);
      window.removeEventListener("performance-katarakti-variant-change", onKataraktiVariantChange);
    };
  }, [kataraktiMarket, kataraktiVariant]);

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
      url.searchParams.set("variant", kataraktiVariant);
    } else {
      url.searchParams.delete("market");
      url.searchParams.delete("variant");
    }
    window.history.replaceState(window.history.state, "", `${url.pathname}?${url.searchParams.toString()}`);
  }, [view, system, style, kataraktiMarket, kataraktiVariant]);

  const usingTiered = style === "tiered" && Boolean(tieredGridPropsBySystem?.[system]);
  const usingKatarakti = style === "katarakti";
  const activeEntry = resolveActiveStrategyEntry({
    family: style,
    systemVersion: system,
    kataraktiVariant,
    kataraktiMarket,
  });
  const baseGridProps = usingKatarakti
    ? kataraktiGridPropsByVariantAndMarket?.[kataraktiVariant]?.[kataraktiMarket] ?? {
        ...universalGridProps,
        combined: { ...universalGridProps.combined, models: [] },
        perAsset: [],
      }
    : usingTiered
      ? tieredGridPropsBySystem?.[system] ?? universalGridProps
      : universalGridProps;

  const activeModels = resolveDisplayModelsForEntry(activeEntry);
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
