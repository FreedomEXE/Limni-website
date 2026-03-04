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

export type KataraktiRegistryVariant = "core" | "lite" | "v3";
export type KataraktiRegistryMarket = "crypto_futures" | "mt5_forex";
export type KataraktiRegistryMode = "legacy_core" | "db_first" | "unavailable";

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
