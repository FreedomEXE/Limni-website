/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: strategyRegistry.ts
 *
 * Description:
 * Typed strategy registry for backfill/live performance sources.
 * Defines per-variant market loaders and explicit fallback policy.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import {
  PERFORMANCE_SYSTEM_MODEL_MAP,
  PERFORMANCE_V1_MODELS,
  PERFORMANCE_V2_MODELS,
  PERFORMANCE_V3_MODELS,
} from "@/lib/performance/modelConfig";
import type { PerformanceModel } from "@/lib/performanceLab";

export type KataraktiRegistryVariant = "core" | "lite" | "v3";
export type KataraktiRegistryMarket = "crypto_futures" | "mt5_forex";
export type KataraktiRegistryMode = "legacy_core" | "db_first" | "unavailable";
export type PerformanceStrategyFamily = "universal" | "tiered" | "katarakti";

export type PerformanceStrategyTheme = {
  // Full Tailwind class strings; do not dynamically construct.
  cardClass: string;
  valueClass: string;
  labelClass: string;
  badgeClass: string;
  tabActiveClass: string;
  tabInactiveHoverClass: string;
};

export type PerformanceStrategyEntry = {
  entryId: string;
  label: string;
  badge: string;
  family: PerformanceStrategyFamily;
  tabId: string;
  tabLabel: string;
  tabOrder: number;
  theme: PerformanceStrategyTheme;
  dataMode:
    | "performance_snapshots"
    | "strategy_backtest_db"
    | "tiered_derived"
    | "katarakti_snapshot"
    | "unavailable";
  market?: KataraktiRegistryMarket;
  kataraktiVariant?: KataraktiRegistryVariant;
  systemVersion?: "v1" | "v2" | "v3";
  pending?: boolean;
  pendingLabel?: string;
  backtestBotId?: string;
  backtestVariant?: string;
  backtestMarket?: string;
  requiredMarket?: KataraktiRegistryMarket;
  forcesCryptoOnly?: boolean;
  displayModels?: readonly PerformanceModel[];
};

export type PerformanceFamilyMeta = {
  label: string;
  tabActiveClass: string;
};

export type StrategyFileFallback = {
  preferredEnvVar?: string;
  candidates: readonly string[];
};

export type StrategyLiveSource = {
  botId: string;
  dryRunOnly?: boolean;
};

export type KataraktiStrategyRegistryEntry = {
  variant: KataraktiRegistryVariant;
  market: KataraktiRegistryMarket;
  mode: KataraktiRegistryMode;
  selectedVariantId: string | null;
  backtestBotId?: string;
  backtestConfigKeyEnvVar?: string;
  fileFallback?: StrategyFileFallback;
  live?: StrategyLiveSource;
  pendingLabel?: string | null;
};

const KATARAKTI_STRATEGY_REGISTRY: readonly KataraktiStrategyRegistryEntry[] = [
  {
    variant: "core",
    market: "crypto_futures",
    mode: "legacy_core",
    selectedVariantId: "core",
  },
  {
    variant: "core",
    market: "mt5_forex",
    mode: "legacy_core",
    selectedVariantId: "core",
  },
  {
    variant: "lite",
    market: "crypto_futures",
    mode: "db_first",
    selectedVariantId: "lite",
    backtestBotId: "katarakti_crypto_lite",
    fileFallback: {
      preferredEnvVar: "KATARAKTI_LITE_CRYPTO_REPORT_PATH",
      candidates: ["reports/bitget-lite-entry-latest.json"],
    },
    live: {
      botId: "katarakti_crypto_lite",
      dryRunOnly: false,
    },
    pendingLabel: "Lite backtest pending",
  },
  {
    variant: "lite",
    market: "mt5_forex",
    mode: "db_first",
    selectedVariantId: "lite",
    backtestBotId: "katarakti_cfd_lite",
    fileFallback: {
      preferredEnvVar: "KATARAKTI_LITE_MT5_REPORT_PATH",
      candidates: [
        "reports/katarakti-lite-parameter-sweep-latest.json",
        "reports/katarakti-lite-ablation-latest.json",
      ],
    },
    live: {
      botId: "katarakti_cfd_lite",
    },
    pendingLabel: "Lite backtest pending",
  },
  {
    variant: "v3",
    market: "crypto_futures",
    mode: "db_first",
    selectedVariantId: "v3_liq_sweep",
    backtestBotId: "katarakti_v3_liq_sweep",
    fileFallback: {
      preferredEnvVar: "KATARAKTI_V3_LIQ_SWEEP_REPORT_PATH",
      candidates: ["reports/bitget-liq-sweep-simple-latest.json"],
    },
    live: {
      botId: "katarakti_v3_liq_sweep",
      dryRunOnly: false,
    },
    pendingLabel: "V3 backtest pending",
  },
  {
    variant: "v3",
    market: "mt5_forex",
    mode: "unavailable",
    selectedVariantId: null,
    pendingLabel: "CFD v3 pending",
  },
];

const THEME_DEFAULT: PerformanceStrategyTheme = {
  cardClass: "rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)]/80 p-4",
  valueClass: "text-[var(--foreground)]",
  labelClass: "text-[color:var(--muted)]",
  badgeClass: "rounded-full bg-[var(--accent)]/10 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.15em] text-[var(--accent-strong)]",
  tabActiveClass: "border-[var(--accent)]/40 bg-[var(--accent)]/10 text-[var(--accent-strong)]",
  tabInactiveHoverClass: "hover:border-[var(--accent)]/40",
};

const THEME_EMERALD: PerformanceStrategyTheme = {
  cardClass: "rounded-2xl border border-emerald-400/40 bg-emerald-500/10 p-4",
  valueClass: "text-emerald-900 dark:text-emerald-100",
  labelClass: "text-emerald-700 dark:text-emerald-300",
  badgeClass: "rounded-full bg-emerald-500/20 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.15em] text-emerald-800 dark:text-emerald-200",
  tabActiveClass: "border-emerald-400/50 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200",
  tabInactiveHoverClass: "hover:border-emerald-400/50",
};

const THEME_CYAN: PerformanceStrategyTheme = {
  cardClass: "rounded-2xl border border-cyan-400/40 bg-cyan-500/10 p-4",
  valueClass: "text-cyan-900 dark:text-cyan-100",
  labelClass: "text-cyan-700 dark:text-cyan-300",
  badgeClass: "rounded-full bg-cyan-500/20 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.15em] text-cyan-800 dark:text-cyan-200",
  tabActiveClass: "border-cyan-400/50 bg-cyan-500/10 text-cyan-800 dark:text-cyan-200",
  tabInactiveHoverClass: "hover:border-cyan-400/50",
};

const THEME_AMBER: PerformanceStrategyTheme = {
  cardClass: "rounded-2xl border border-amber-400/40 bg-amber-500/10 p-4",
  valueClass: "text-amber-900 dark:text-amber-100",
  labelClass: "text-amber-700 dark:text-amber-300",
  badgeClass: "rounded-full bg-amber-500/20 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.15em] text-amber-800 dark:text-amber-200",
  tabActiveClass: "border-amber-400/50 bg-amber-500/10 text-amber-800 dark:text-amber-200",
  tabInactiveHoverClass: "hover:border-amber-400/50",
};

const THEME_TEAL: PerformanceStrategyTheme = {
  cardClass: "rounded-2xl border border-teal-400/40 bg-teal-500/10 p-4",
  valueClass: "text-teal-900 dark:text-teal-100",
  labelClass: "text-teal-700 dark:text-teal-300",
  badgeClass: "rounded-full bg-teal-500/20 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.15em] text-teal-800 dark:text-teal-200",
  tabActiveClass: "border-teal-400/50 bg-teal-500/10 text-teal-800 dark:text-teal-200",
  tabInactiveHoverClass: "hover:border-teal-400/50",
};

const THEME_SKY: PerformanceStrategyTheme = {
  cardClass: "rounded-2xl border border-sky-400/40 bg-sky-500/10 p-4",
  valueClass: "text-sky-900 dark:text-sky-100",
  labelClass: "text-sky-700 dark:text-sky-300",
  badgeClass: "rounded-full bg-sky-500/20 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.15em] text-sky-800 dark:text-sky-200",
  tabActiveClass: "border-sky-400/50 bg-sky-500/10 text-sky-800 dark:text-sky-200",
  tabInactiveHoverClass: "hover:border-sky-400/50",
};

const THEME_FUCHSIA: PerformanceStrategyTheme = {
  cardClass: "rounded-2xl border border-fuchsia-400/40 bg-fuchsia-500/10 p-4",
  valueClass: "text-fuchsia-900 dark:text-fuchsia-100",
  labelClass: "text-fuchsia-700 dark:text-fuchsia-300",
  badgeClass: "rounded-full bg-fuchsia-500/20 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.15em] text-fuchsia-800 dark:text-fuchsia-200",
  tabActiveClass: "border-fuchsia-400/50 bg-fuchsia-500/10 text-fuchsia-800 dark:text-fuchsia-200",
  tabInactiveHoverClass: "hover:border-fuchsia-400/50",
};

const THEME_VIOLET: PerformanceStrategyTheme = {
  cardClass: "rounded-2xl border border-violet-400/40 bg-violet-500/10 p-4",
  valueClass: "text-violet-900 dark:text-violet-100",
  labelClass: "text-violet-700 dark:text-violet-300",
  badgeClass: "rounded-full bg-violet-500/20 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.15em] text-violet-800 dark:text-violet-200",
  tabActiveClass: "border-violet-400/50 bg-violet-500/10 text-violet-800 dark:text-violet-200",
  tabInactiveHoverClass: "hover:border-violet-400/50",
};

const TIERED_DISPLAY_MODELS: readonly PerformanceModel[] = [
  "antikythera_v3",
  "dealer",
  "commercial",
];

const KATARAKTI_DISPLAY_MODELS: readonly PerformanceModel[] = ["antikythera_v3"];

const PERFORMANCE_STRATEGY_REGISTRY: readonly PerformanceStrategyEntry[] = [
  {
    entryId: "universal_v1",
    label: "Universal V1",
    badge: "5 Baskets",
    family: "universal",
    tabId: "v1",
    tabLabel: "Universal V1",
    tabOrder: 1,
    theme: THEME_DEFAULT,
    dataMode: "strategy_backtest_db",
    systemVersion: "v1",
    backtestBotId: "universal_v1_tp1_friday_carry_aligned",
    backtestVariant: "v1",
    backtestMarket: "multi_asset",
    displayModels: PERFORMANCE_V1_MODELS,
  },
  {
    entryId: "universal_v2",
    label: "Universal V2",
    badge: "3 Baskets",
    family: "universal",
    tabId: "v2",
    tabLabel: "Universal V2",
    tabOrder: 2,
    theme: THEME_EMERALD,
    dataMode: "performance_snapshots",
    systemVersion: "v2",
    displayModels: PERFORMANCE_V2_MODELS,
  },
  {
    entryId: "universal_v3",
    label: "Universal V3",
    badge: "4 Baskets",
    family: "universal",
    tabId: "v3",
    tabLabel: "Universal V3",
    tabOrder: 3,
    theme: THEME_CYAN,
    dataMode: "performance_snapshots",
    systemVersion: "v3",
    displayModels: PERFORMANCE_V3_MODELS,
  },
  {
    entryId: "tiered_v1",
    label: "Tiered V1",
    badge: "Tiered (3 tiers)",
    family: "tiered",
    tabId: "v1",
    tabLabel: "Tiered V1",
    tabOrder: 1,
    theme: THEME_DEFAULT,
    dataMode: "tiered_derived",
    systemVersion: "v1",
    displayModels: TIERED_DISPLAY_MODELS,
  },
  {
    entryId: "tiered_v2",
    label: "Tiered V2",
    badge: "Tiered (2 tiers)",
    family: "tiered",
    tabId: "v2",
    tabLabel: "Tiered V2",
    tabOrder: 2,
    theme: THEME_EMERALD,
    dataMode: "tiered_derived",
    systemVersion: "v2",
    displayModels: TIERED_DISPLAY_MODELS,
  },
  {
    entryId: "tiered_v3",
    label: "Tiered V3",
    badge: "Tiered (3 tiers)",
    family: "tiered",
    tabId: "v3",
    tabLabel: "Tiered V3",
    tabOrder: 3,
    theme: THEME_CYAN,
    dataMode: "tiered_derived",
    systemVersion: "v3",
    displayModels: TIERED_DISPLAY_MODELS,
  },
  {
    entryId: "katarakti_core_crypto",
    label: "Katarakti (Crypto Futures)",
    badge: "Crypto Futures Core",
    family: "katarakti",
    tabId: "core",
    tabLabel: "Core",
    tabOrder: 1,
    theme: THEME_AMBER,
    dataMode: "katarakti_snapshot",
    market: "crypto_futures",
    kataraktiVariant: "core",
    displayModels: KATARAKTI_DISPLAY_MODELS,
  },
  {
    entryId: "katarakti_core_mt5",
    label: "Katarakti (CFD)",
    badge: "CFD Core",
    family: "katarakti",
    tabId: "core",
    tabLabel: "Core",
    tabOrder: 1,
    theme: THEME_TEAL,
    dataMode: "katarakti_snapshot",
    market: "mt5_forex",
    kataraktiVariant: "core",
    displayModels: KATARAKTI_DISPLAY_MODELS,
  },
  {
    entryId: "katarakti_lite_crypto",
    label: "Katarakti Crypto Lite",
    badge: "Crypto Futures Lite",
    family: "katarakti",
    tabId: "lite",
    tabLabel: "Lite",
    tabOrder: 2,
    theme: THEME_SKY,
    dataMode: "katarakti_snapshot",
    market: "crypto_futures",
    kataraktiVariant: "lite",
    displayModels: KATARAKTI_DISPLAY_MODELS,
  },
  {
    entryId: "katarakti_lite_mt5",
    label: "Katarakti CFD Lite",
    badge: "CFD Lite",
    family: "katarakti",
    tabId: "lite",
    tabLabel: "Lite",
    tabOrder: 2,
    theme: THEME_CYAN,
    dataMode: "katarakti_snapshot",
    market: "mt5_forex",
    kataraktiVariant: "lite",
    displayModels: KATARAKTI_DISPLAY_MODELS,
  },
  {
    entryId: "katarakti_v3_crypto",
    label: "Katarakti v3 (Liq Sweep)",
    badge: "Crypto Futures v3",
    family: "katarakti",
    tabId: "v3",
    tabLabel: "v3",
    tabOrder: 3,
    theme: THEME_FUCHSIA,
    dataMode: "katarakti_snapshot",
    market: "crypto_futures",
    kataraktiVariant: "v3",
    forcesCryptoOnly: true,
    displayModels: KATARAKTI_DISPLAY_MODELS,
  },
  {
    entryId: "katarakti_v3_mt5",
    label: "Katarakti CFD v3 (Pending)",
    badge: "CFD v3",
    family: "katarakti",
    tabId: "v3",
    tabLabel: "v3",
    tabOrder: 3,
    theme: THEME_VIOLET,
    dataMode: "unavailable",
    market: "mt5_forex",
    kataraktiVariant: "v3",
    pending: true,
    pendingLabel: "CFD v3 pending",
    requiredMarket: "mt5_forex",
    displayModels: KATARAKTI_DISPLAY_MODELS,
  },
];

export const PERFORMANCE_FAMILY_META: Readonly<Record<PerformanceStrategyFamily, PerformanceFamilyMeta>> = {
  universal: {
    label: "Universal",
    tabActiveClass: THEME_DEFAULT.tabActiveClass,
  },
  tiered: {
    label: "Tiered",
    tabActiveClass: THEME_SKY.tabActiveClass,
  },
  katarakti: {
    label: "Katarakti",
    tabActiveClass: THEME_AMBER.tabActiveClass,
  },
};

export type PerformanceComparisonSourceKey = {
  family: PerformanceStrategyFamily;
  systemVersion?: "v1" | "v2" | "v3";
  kataraktiVariant?: KataraktiRegistryVariant;
  kataraktiMarket?: KataraktiRegistryMarket;
};

function normalizeMarket(value: KataraktiRegistryMarket | undefined) {
  return value === "mt5_forex" ? "mt5_forex" : "crypto_futures";
}

function sortByTabOrder(entries: PerformanceStrategyEntry[]) {
  return [...entries].sort(
    (left, right) =>
      left.tabOrder - right.tabOrder
      || left.tabLabel.localeCompare(right.tabLabel),
  );
}

export function getPerformanceStrategyEntry(entryId: string): PerformanceStrategyEntry | null {
  return PERFORMANCE_STRATEGY_REGISTRY.find((entry) => entry.entryId === entryId) ?? null;
}

export function listPerformanceStrategyEntries(): PerformanceStrategyEntry[] {
  return [...PERFORMANCE_STRATEGY_REGISTRY];
}

export function listPerformanceStrategyEntriesByFamily(family: PerformanceStrategyFamily): PerformanceStrategyEntry[] {
  return sortByTabOrder(
    PERFORMANCE_STRATEGY_REGISTRY.filter((entry) => entry.family === family),
  );
}

export function getPerformanceFamilyTabGroups(
  family: PerformanceStrategyFamily,
): { tabId: string; tabLabel: string; tabOrder: number }[] {
  const dedup = new Map<string, { tabId: string; tabLabel: string; tabOrder: number }>();
  for (const entry of PERFORMANCE_STRATEGY_REGISTRY) {
    if (entry.family !== family) continue;
    const prev = dedup.get(entry.tabId);
    if (!prev || entry.tabOrder < prev.tabOrder) {
      dedup.set(entry.tabId, {
        tabId: entry.tabId,
        tabLabel: entry.tabLabel,
        tabOrder: entry.tabOrder,
      });
    }
  }
  return [...dedup.values()].sort((left, right) => left.tabOrder - right.tabOrder);
}

export function resolveActiveStrategyEntry(options: {
  family: PerformanceStrategyFamily;
  systemVersion?: "v1" | "v2" | "v3";
  kataraktiVariant?: KataraktiRegistryVariant;
  kataraktiMarket?: KataraktiRegistryMarket;
}): PerformanceStrategyEntry | null {
  if (options.family === "universal" || options.family === "tiered") {
    const systemVersion = options.systemVersion ?? "v1";
    return (
      PERFORMANCE_STRATEGY_REGISTRY.find(
        (entry) =>
          entry.family === options.family
          && entry.systemVersion === systemVersion,
      )
      ?? PERFORMANCE_STRATEGY_REGISTRY.find((entry) => entry.family === options.family)
      ?? null
    );
  }

  const variant = options.kataraktiVariant ?? "core";
  const providedMarket = options.kataraktiMarket;
  // Default v3 to crypto only when market is not explicitly provided.
  const market =
    variant === "v3"
      ? (providedMarket === undefined ? "crypto_futures" : normalizeMarket(providedMarket))
      : normalizeMarket(providedMarket);
  return (
    PERFORMANCE_STRATEGY_REGISTRY.find(
      (entry) =>
        entry.family === "katarakti"
        && entry.kataraktiVariant === variant
        && entry.market === market,
    )
    ?? PERFORMANCE_STRATEGY_REGISTRY.find(
      (entry) =>
        entry.family === "katarakti"
        && entry.kataraktiVariant === variant
        && entry.market === "crypto_futures",
    )
    ?? PERFORMANCE_STRATEGY_REGISTRY.find((entry) => entry.family === "katarakti")
    ?? null
  );
}

export function resolveComparisonSourceKey(
  entry: PerformanceStrategyEntry,
): PerformanceComparisonSourceKey | null {
  if (entry.family === "universal" || entry.family === "tiered") {
    return entry.systemVersion
      ? {
          family: entry.family,
          systemVersion: entry.systemVersion,
        }
      : null;
  }
  if (!entry.kataraktiVariant || !entry.market) return null;
  return {
    family: "katarakti",
    kataraktiVariant: entry.kataraktiVariant,
    kataraktiMarket: entry.market,
  };
}

export function resolveDisplayModelsForEntry(
  entry: PerformanceStrategyEntry | null,
): readonly PerformanceModel[] {
  if (entry?.displayModels && entry.displayModels.length > 0) {
    return entry.displayModels;
  }
  if (entry?.systemVersion) {
    return PERFORMANCE_SYSTEM_MODEL_MAP[entry.systemVersion];
  }
  return PERFORMANCE_V1_MODELS;
}

export function getKataraktiStrategyRegistryEntry(
  variant: KataraktiRegistryVariant,
  market: KataraktiRegistryMarket,
): KataraktiStrategyRegistryEntry | null {
  return (
    KATARAKTI_STRATEGY_REGISTRY.find(
      (entry) => entry.variant === variant && entry.market === market,
    ) ?? null
  );
}

export function listKataraktiStrategyRegistryEntries() {
  return [...KATARAKTI_STRATEGY_REGISTRY];
}
