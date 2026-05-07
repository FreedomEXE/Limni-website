import { SELECTOR_ENGINE_VERSION } from "@/lib/performance/selectorEngine";
import type { EntryStyleConfig, StrengthGateConfig } from "@/lib/performance/strategyConfig";

const STRATEGY_ARTIFACT_SCHEMA_VERSION =
  process.env.STRATEGY_ARTIFACT_ENGINE_VERSION?.trim() || "strategy-artifact-v22";

// Update only the version for the artifact family touched by a code change.
// This keeps unrelated strategy pages on their existing persisted artifacts.
const ENTRY_ENGINE_VERSIONS: Record<string, string> = {
  weekly_hold: "weekly-hold-engine-v1",
  adr: "adr-pullback-engine-v1",
  adr_grid: "adr-grid-engine-v1",
};

const RISK_OVERLAY_VERSIONS: Record<string, string> = {
  none: "risk-overlay-none-v1",
  exposure_cap: "risk-overlay-exposure-cap-v1",
};

const PATH_SIMULATION_VERSION = "path-simulation-v1";
const SOURCE_FINGERPRINT_VERSION = "source-fingerprint-v1";

export function buildStrategyArtifactEngineVersion(options: {
  entryStyle: EntryStyleConfig | undefined;
  riskOverlay: StrengthGateConfig | undefined;
}) {
  const entryKey = options.entryStyle?.plModel ?? "weekly_hold";
  const overlayKey = options.riskOverlay?.id ?? "none";
  return [
    STRATEGY_ARTIFACT_SCHEMA_VERSION,
    SELECTOR_ENGINE_VERSION,
    ENTRY_ENGINE_VERSIONS[entryKey] ?? `entry-${entryKey}-v1`,
    RISK_OVERLAY_VERSIONS[overlayKey] ?? `risk-overlay-${overlayKey}-v1`,
    PATH_SIMULATION_VERSION,
    SOURCE_FINGERPRINT_VERSION,
  ].join(":");
}

export function buildStrategyRuntimeVersionKey() {
  return [
    STRATEGY_ARTIFACT_SCHEMA_VERSION,
    SELECTOR_ENGINE_VERSION,
    PATH_SIMULATION_VERSION,
    SOURCE_FINGERPRINT_VERSION,
  ].join(":");
}
