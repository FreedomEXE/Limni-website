/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: strategyArtifactVersions.ts
 *
 * Description:
 * Centralized version keys for strategy artifact shards and assembly.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import { SELECTOR_ENGINE_VERSION } from "@/lib/performance/selectorEngine";
import type { EntryStyleConfig, RiskOverlayConfig } from "@/lib/performance/strategyConfig";

// Shard engine version: bump only when raw per-week shard data changes.
// This covers direction resolution, entry engines, risk overlays, and path simulation.
//
// History:
// - strategy-artifact-v26: canonical weekly return source with path simulation v6.
// - strategy-artifact-v27: strategy P/L reads execution-anchored weekly rows.
// - strategy-artifact-v28: stores dual raw/normalized hourly path simulations.
// - strategy-artifact-v29: stores balance/equity/adverse-equity path accounting.
// - strategy-artifact-v30: New York execution close and ADR Grid no same-bar TP/rearm.
// - strategy-artifact-v31: Friday 9am NY entry cutoff and Friday 11am NY force close.
// - strategy-artifact-v32: ADR Grid fill return metadata, cap state, and grid adverse path.
// - strategy-artifact-v33: ADR Grid reset closes active fills and crypto uses Sunday-to-Sunday execution.
// - strategy-artifact-v34: institutional seed runtime returns to verified Friday execution anchor.
export const STRATEGY_SHARD_ENGINE_VERSION =
  process.env.STRATEGY_SHARD_ENGINE_VERSION?.trim() || "strategy-artifact-v34";

// Assembly version: bump when reading, aggregating, or displaying existing shard data changes.
// This invalidates monolithic assembled artifacts without forcing shard recomputation.
export const STRATEGY_ASSEMBLY_VERSION =
  process.env.STRATEGY_ASSEMBLY_VERSION?.trim() || "assembly-v8-reset-result-display";

// Update only the version for the artifact family touched by a code change.
// This keeps unrelated strategy pages on their existing persisted artifacts.
//
// ADR Grid:
// - v2 reset-entry-filter skips opening fills too close to the full 1 ADR reset close.
// - v3 pnl-unit-fix keeps cap exposure weights separate from raw/ADR P&L units.
// - v4 dd-contract persists fill/trade MAE for basket risk display.
// - v5 adverse-path adds synchronized basket balance/equity/adverse-equity paths.
// - v6 ordered-rearm prevents same-bar entry/TP and waits one bar before level reuse.
// - v7 friday-cutoff blocks new fills at Friday 9am NY and forces close at Friday 11am NY.
// - v8 fill-risk-metadata persists cap state and grid adverse path for Basket rows.
// - v9 reset-close-contract closes active fills at reset, keeps TP metadata, and flags 1H ambiguity.
const ENTRY_ENGINE_VERSIONS: Record<string, string> = {
  weekly_hold: "weekly-hold-engine-v4-friday-close",
  adr: "adr-pullback-engine-v2",
  adr_grid: "adr-grid-canonical-weekly-anchor-v9-reset-close-contract",
};

const RISK_OVERLAY_VERSIONS: Record<string, string> = {
  none: "risk-overlay-none-v1",
  exposure_cap: "risk-overlay-exposure-cap-v2",
  pair_fill_cap: "risk-overlay-pair-fill-cap-v1",
};

const PATH_SIMULATION_VERSION = "path-simulation-v11-grid-reset-close";
const SOURCE_FINGERPRINT_VERSION = "source-fingerprint-v6-frozen-ledger";

export function buildStrategyArtifactEngineVersion(options: {
  entryStyle: EntryStyleConfig | undefined;
  riskOverlay: RiskOverlayConfig | undefined;
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
  riskOverlay: RiskOverlayConfig | undefined;
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
