"use client";

import { useEffect, useState, type ComponentProps } from "react";
import { useSearchParams } from "next/navigation";
import type { PerformanceView } from "@/lib/performance/pageState";
import type { PerformanceSystem } from "@/lib/performance/modelConfig";
import PerformanceGrid from "@/components/performance/PerformanceGrid";
import PerformanceViewCards, {
  PERFORMANCE_VIEW_CARDS,
} from "@/components/performance/PerformanceViewCards";
import PerformanceGatedSetups from "@/components/performance/PerformanceGatedSetups";
import type { KataraktiMarket, KataraktiVariant } from "@/lib/performance/kataraktiHistory";
import {
  resolveActiveStrategyEntry,
  resolveDisplayModelsForEntry,
  type PerformanceStrategyEntry,
  type PerformanceStrategyFamily,
} from "@/lib/performance/strategyRegistry";
type StatsViewMode = "standard" | "gated";

type ComparisonMetricsLite = {
  totalReturn: number;
  winRate: number;
  sharpe: number;
  maxDrawdown: number | null;
  profitFactor: number | null;
  tradeWinRate: number;
  avgWeekly: number;
  trades: number;
};

type ComparisonApiPayload = {
  strategies?: Record<string, { metrics: ComparisonMetricsLite }>;
  gating?: {
    available: boolean;
    byStrategy: Record<string, {
      standard: ComparisonMetricsLite;
      gated: ComparisonMetricsLite;
      delta: {
        totalReturnPct: number;
        maxDrawdownPct: number;
        winRatePct: number;
        tradeWinRatePct: number;
        trades: number;
      };
      gateActivity: {
        skippedTrades: number;
        reducedTrades: number;
        passedOrNoDataTrades: number;
      } | null;
    }>;
  };
};

function parseStatsView(value: string | null): StatsViewMode {
  return value === "gated" ? "gated" : "standard";
}

function getOverlayForEntry(
  payload: ComparisonApiPayload | null,
  entry: PerformanceStrategyEntry | null,
) {
  if (!payload || !entry) return null;
  const base = payload.strategies?.[entry.entryId]?.metrics ?? null;
  if (!base) return null;
  const gate = payload.gating?.byStrategy?.[entry.entryId] ?? null;
  return {
    standard: gate?.standard ?? base,
    gated: gate?.gated ?? null,
    delta: gate?.delta ?? null,
    gateActivity: gate?.gateActivity ?? null,
    gateAvailable: Boolean(payload.gating?.available && gate),
  };
}

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
  const searchParams = useSearchParams();
  const [view, setView] = useState<PerformanceView>(initialView);
  const [system, setSystem] = useState<PerformanceSystem>(initialSystem);
  const [style, setStyle] = useState<PerformanceStrategyFamily>(initialStyle);
  const requestedWeek = searchParams.get("week") ?? "all";
  const requestedStatsView = parseStatsView(searchParams.get("stats"));
  const [statsView, setStatsView] = useState<StatsViewMode>(requestedStatsView);
  const [comparisonPayload, setComparisonPayload] = useState<ComparisonApiPayload | null>(null);
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
    setStatsView(requestedStatsView);
  }, [requestedStatsView]);

  useEffect(() => {
    let cancelled = false;
    async function fetchComparison() {
      try {
        const response = await fetch(
          `/api/performance/comparison?week=${encodeURIComponent(requestedWeek)}`,
        );
        if (!response.ok) return;
        const json = (await response.json()) as ComparisonApiPayload & { error?: string };
        if (cancelled || json.error) return;
        setComparisonPayload(json);
      } catch {
        if (!cancelled) {
          setComparisonPayload(null);
        }
      }
    }
    fetchComparison();
    return () => {
      cancelled = true;
    };
  }, [requestedWeek]);

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
    const onKataraktiSelectionChange = (
      event: Event,
    ) => {
      const custom = event as CustomEvent<{ market: KataraktiMarket; variant: KataraktiVariant }>;
      const market = custom.detail?.market;
      const variant = custom.detail?.variant;
      if (
        (market === "crypto_futures" || market === "mt5_forex")
        && (variant === "core" || variant === "lite" || variant === "v3")
      ) {
        const resolved = resolveActiveStrategyEntry({
          family: "katarakti",
          kataraktiVariant: variant,
          kataraktiMarket: market,
        });
        setKataraktiMarket(resolved?.market ?? market);
        setKataraktiVariant(resolved?.kataraktiVariant ?? variant);
      }
    };
    const onStatsViewChange = (event: Event) => {
      const custom = event as CustomEvent<StatsViewMode>;
      if (custom.detail === "standard" || custom.detail === "gated") {
        setStatsView(custom.detail);
      }
    };
    window.addEventListener("performance-system-change", onSystemChange);
    window.addEventListener("performance-style-change", onStyleChange);
    window.addEventListener("performance-katarakti-selection-change", onKataraktiSelectionChange);
    window.addEventListener("performance-stats-view-change", onStatsViewChange);
    return () => {
      window.removeEventListener("performance-system-change", onSystemChange);
      window.removeEventListener("performance-style-change", onStyleChange);
      window.removeEventListener("performance-katarakti-selection-change", onKataraktiSelectionChange);
      window.removeEventListener("performance-stats-view-change", onStatsViewChange);
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
      url.searchParams.set("variant", kataraktiVariant);
      url.searchParams.delete("stats");
    } else {
      url.searchParams.delete("market");
      url.searchParams.delete("variant");
      url.searchParams.set("stats", statsView);
    }
    window.history.replaceState(window.history.state, "", `${url.pathname}?${url.searchParams.toString()}`);
  }, [view, system, style, kataraktiMarket, kataraktiVariant, statsView]);

  const usingTiered = style === "tiered" && Boolean(tieredGridPropsBySystem?.[system]);
  const usingKatarakti = style === "katarakti";
  const activeEntry = resolveActiveStrategyEntry({
    family: style,
    systemVersion: system,
    kataraktiVariant,
    kataraktiMarket,
  });
  const activeOverlay = getOverlayForEntry(comparisonPayload, activeEntry);
  const activeComparisonMode: StatsViewMode =
    style === "katarakti" ? "standard" : statsView;
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
      {view === "setups" ? (
        <PerformanceGatedSetups />
      ) : (
        <PerformanceGrid
          {...baseGridProps}
          combined={filteredCombined}
          perAsset={filteredPerAsset}
          view={view}
          comparisonOverlay={
            activeOverlay
              ? {
                  mode: activeComparisonMode,
                  standard: activeOverlay.standard,
                  gated: activeOverlay.gated,
                  gateAvailable: activeOverlay.gateAvailable,
                  delta: activeOverlay.delta,
                  gateActivity: activeOverlay.gateActivity,
                }
              : undefined
          }
        />
      )}
    </>
  );
}
