import { SELECTOR_ENGINE_VERSION } from "@/lib/performance/selectorEngine";
import type { EntryStyleConfig, StrengthGateConfig } from "@/lib/performance/strategyConfig";

// Shard engine version: bump only when raw per-week shard data changes.
// This covers direction resolution, entry engines, risk overlays, and path simulation.
const STRATEGY_SHARD_ENGINE_VERSION =
  process.env.STRATEGY_SHARD_ENGINE_VERSION?.trim() || "strategy-artifact-v24";

// Assembly version: bump when reading, aggregating, or displaying existing shard data changes.
// This invalidates monolithic assembled artifacts without forcing shard recomputation.
const STRATEGY_ASSEMBLY_VERSION =
  process.env.STRATEGY_ASSEMBLY_VERSION?.trim() || "assembly-v3";

// Update only the version for the artifact family touched by a code change.
// This keeps unrelated strategy pages on their existing persisted artifacts.
const ENTRY_ENGINE_VERSIONS: Record<string, string> = {
  weekly_hold: "weekly-hold-engine-v1",
  adr: "adr-pullback-engine-v2",
  adr_grid: "adr-grid-engine-v3",
};

const RISK_OVERLAY_VERSIONS: Record<string, string> = {
  none: "risk-overlay-none-v1",
  exposure_cap: "risk-overlay-exposure-cap-v2",
};

const PATH_SIMULATION_VERSION = "path-simulation-v5";
const SOURCE_FINGERPRINT_VERSION = "source-fingerprint-v1";

export function buildStrategyArtifactEngineVersion(options: {
  entryStyle: EntryStyleConfig | undefined;
  riskOverlay: StrengthGateConfig | undefined;
}) {
  const entryKey = options.entryStyle?.plModel ?? "weekly_hold";
  const overlayKey = options.riskOverlay?.id ?? "none";
  return [
    STRATEGY_SHARD_ENGINE_VERSION,
    SELECTOR_ENGINE_VERSION,
    ENTRY_ENGINE_VERSIONS[entryKey] ?? `entry-${entryKey}-v1`,
    RISK_OVERLAY_VERSIONS[overlayKey] ?? `risk-overlay-${overlayKey}-v1`,
    PATH_SIMULATION_VERSION,
    SOURCE_FINGERPRINT_VERSION,
  ].join(":");
}

export function buildStrategyAssemblyVersion(options: {
  entryStyle: EntryStyleConfig | undefined;
  riskOverlay: StrengthGateConfig | undefined;
}) {
  return `${buildStrategyArtifactEngineVersion(options)}:${STRATEGY_ASSEMBLY_VERSION}`;
}

export function buildStrategyRuntimeVersionKey() {
  return [
    STRATEGY_SHARD_ENGINE_VERSION,
    SELECTOR_ENGINE_VERSION,
    PATH_SIMULATION_VERSION,
    SOURCE_FINGERPRINT_VERSION,
    STRATEGY_ASSEMBLY_VERSION,
  ].join(":");
}
