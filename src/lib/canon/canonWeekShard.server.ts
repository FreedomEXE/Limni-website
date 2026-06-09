/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: canonWeekShard.server.ts
 *
 * Description:
 * Server-only helpers for deriving deterministic per-week canon shards from
 * immutable release canon artifacts without mutating the release files.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { ClosedHistoryRow } from "@/lib/basket/basketSummaryTypes";
import { buildClosedHistoryBundle } from "@/lib/basket/basketSummaries";
import {
  canonFileNameForStrategyVariant,
  type CanonArtifact,
} from "@/lib/canon/canonArtifact";
import {
  CANON_AGGREGATE_SHARD_SCHEMA_VERSION,
  CANON_INVENTORY_SCHEMA_VERSION,
  CANON_WEEK_KEY_SEMANTICS,
  CANON_WEEK_SHARD_SCHEMA_VERSION,
  type CanonAggregateInventoryEntry,
  type CanonInventoryManifest,
  type CanonShardSource,
  type CanonVariantInventory,
  type CanonWeekShard,
} from "@/lib/canon/canonShardTypes";
import { ALL_PERFORMANCE_ASSET_SELECTION } from "@/lib/performance/performanceAssetScope";
import { loadStrategyPageData, type StrategySelection } from "@/lib/performance/strategyPageData";
import type { WeeklyHoldTrade } from "@/lib/performance/weeklyHoldEngine";
import type { ReleaseManifest } from "@/lib/version/releaseManifest";
import type { AssetClass } from "@/lib/cotMarkets";

type ReleaseCanonArtifact = CanonArtifact & {
  bundle: CanonArtifact["bundle"] & {
    rows: ClosedHistoryRow[];
  };
};

const releaseCanonArtifactCache = new Map<string, Promise<ReleaseCanonArtifact>>();
const deltaWeeksCache = new Map<string, Promise<CanonVariantInventory["deltaWeeks"]>>();
const inventoryManifestCache = new Map<string, Promise<CanonInventoryManifest>>();

function sha256(value: string): `sha256:${string}` {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, nested]) => [key, stableValue(nested)]),
  );
}

function stableJson(value: unknown) {
  return JSON.stringify(stableValue(value));
}

function weekCloseUtc(weekOpenUtc: string) {
  const millis = Date.parse(weekOpenUtc);
  if (!Number.isFinite(millis)) return weekOpenUtc;
  return new Date(millis + 7 * 24 * 60 * 60 * 1000).toISOString();
}

function previousClosedWeekOpenUtc(currentWeekOpenUtc: string) {
  const millis = Date.parse(currentWeekOpenUtc);
  if (!Number.isFinite(millis)) return null;
  return new Date(millis - 7 * 24 * 60 * 60 * 1000).toISOString();
}

function rowKindOrder(rowKind: ClosedHistoryRow["rowKind"]) {
  if (rowKind === "grid") return 0;
  if (rowKind === "trade") return 1;
  return 2;
}

function sortRows(rows: ClosedHistoryRow[]) {
  return [...rows].sort((left, right) => {
    const weekDiff = left.weekOpenUtc.localeCompare(right.weekOpenUtc);
    if (weekDiff !== 0) return weekDiff;
    const symbolDiff = left.symbol.localeCompare(right.symbol);
    if (symbolDiff !== 0) return symbolDiff;
    const sourceDiff = (left.sourceModel ?? "").localeCompare(right.sourceModel ?? "");
    if (sourceDiff !== 0) return sourceDiff;
    const tierDiff = (left.tier ?? -1) - (right.tier ?? -1);
    if (tierDiff !== 0) return tierDiff;
    const directionDiff = (left.direction ?? "").localeCompare(right.direction ?? "");
    if (directionDiff !== 0) return directionDiff;
    const rowKindDiff = rowKindOrder(left.rowKind) - rowKindOrder(right.rowKind);
    if (rowKindDiff !== 0) return rowKindDiff;
    const entryDiff = (left.entryUtc ?? "").localeCompare(right.entryUtc ?? "");
    if (entryDiff !== 0) return entryDiff;
    const fillDiff = (left.fillSeq ?? Number.MAX_SAFE_INTEGER) - (right.fillSeq ?? Number.MAX_SAFE_INTEGER);
    if (fillDiff !== 0) return fillDiff;
    return (left.executionTradeId ?? left.canonicalTradeId ?? "").localeCompare(
      right.executionTradeId ?? right.canonicalTradeId ?? "",
    );
  });
}

function rowCounts(rows: ClosedHistoryRow[]) {
  return {
    rows: rows.length,
    trades: rows.filter((row) => row.rowKind !== "grid").length,
    pairs: new Set(rows.map((row) => row.symbol)).size,
  };
}

function distinctSorted(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value)))).sort();
}

function resolveWeekOpenUtc(rows: ClosedHistoryRow[], requestedWeekOpenUtc: string) {
  if (rows.some((row) => row.weekOpenUtc === requestedWeekOpenUtc)) return requestedWeekOpenUtc;

  const requestedMillis = Date.parse(requestedWeekOpenUtc);
  if (!Number.isFinite(requestedMillis)) return requestedWeekOpenUtc;

  return rows.find((row) => Date.parse(row.weekOpenUtc) === requestedMillis)?.weekOpenUtc ?? requestedWeekOpenUtc;
}

function aggregateInventoryEntry(manifest: ReleaseManifest, strategyVariant: string): CanonAggregateInventoryEntry {
  return {
    key: `${manifest.canonVersion}::${strategyVariant}::aggregate`,
    schemaVersion: CANON_AGGREGATE_SHARD_SCHEMA_VERSION,
    status: "not-materialized",
    sha256: null,
    sizeBytes: 0,
    generatedAtUtc: null,
  };
}

function strategySelectionFromVariant(strategyVariant: string): StrategySelection {
  const [strategyId, f1, ...rest] = strategyVariant.split("-");
  return {
    strategyId: strategyId || "tandem",
    f1: f1 || "weekly_hold",
    f2: rest.join("-") || "none",
  };
}

function normalizeAssetClass(value: string): AssetClass {
  return value === "indices" || value === "commodities" || value === "crypto" || value === "fx"
    ? value
    : "fx";
}

function parentNaturalRefForArtifactTrade(options: {
  strategyVariant: string;
  weekOpenUtc: string;
  trade: WeeklyHoldTrade;
}) {
  return [
    "parent",
    "backtest",
    "adr_grid",
    options.strategyVariant,
    options.trade.symbol,
    options.weekOpenUtc,
    options.trade.source,
    options.trade.tier ?? -1,
    options.trade.direction,
  ].join("|");
}

function artifactTradeKey(weekOpenUtc: string, trade: WeeklyHoldTrade) {
  return [
    weekOpenUtc,
    trade.symbol,
    trade.source,
    trade.tier ?? -1,
    trade.direction,
    trade.detail?.tradeNumber ?? 0,
  ].join("|");
}

function finiteOrNull(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function riskMatrixFromRisk(
  maeRawPct: number | null,
  pathDrawdownRawPct: number | null,
  adrPct: number | null,
): ClosedHistoryRow["riskMatrix"] {
  return {
    canonical: {
      maeRawPct,
      pathDrawdownRawPct,
    },
    execution: {
      maeRawPct,
      pathDrawdownRawPct,
    },
    adrPct,
  };
}

function riskMatrixFromMae(maeRawPct: number | null, adrPct: number | null): ClosedHistoryRow["riskMatrix"] {
  return riskMatrixFromRisk(maeRawPct, null, adrPct);
}

function closedRowsFromStrategyTrades(options: {
  strategyVariant: string;
  weekOpenUtc: string;
  trades: WeeklyHoldTrade[];
}): ClosedHistoryRow[] {
  const strategyFamily = options.strategyVariant.includes("-adr_grid-") ? "adr_grid" : "weekly_hold";
  const rows: ClosedHistoryRow[] = [];
  const gridGroups = new Map<string, WeeklyHoldTrade[]>();

  for (const trade of options.trades) {
    const assetClass = normalizeAssetClass(trade.assetClass);
    const rawPct = typeof trade.rawReturnPct === "number" && Number.isFinite(trade.rawReturnPct)
      ? trade.rawReturnPct
      : trade.returnPct;
    const adrPct = finiteOrNull(trade.adrPct);
    const maeRawPct = finiteOrNull(trade.detail?.maePct);
    const rowKind = strategyFamily === "adr_grid" ? "fill" : "trade";
    const parentNaturalRef = strategyFamily === "adr_grid"
      ? parentNaturalRefForArtifactTrade({
          strategyVariant: options.strategyVariant,
          weekOpenUtc: options.weekOpenUtc,
          trade,
        })
      : null;
    const stableTradeId = [
      "strategy-artifact-delta",
      options.strategyVariant,
      artifactTradeKey(options.weekOpenUtc, trade),
    ].join("|");

    rows.push({
      rowKind,
      origin: "backtest",
      strategyFamily,
      strategyVariant: options.strategyVariant,
      symbol: trade.symbol,
      assetClass,
      weekOpenUtc: options.weekOpenUtc,
      sourceModel: trade.source,
      tier: trade.tier,
      direction: trade.direction,
      fillSeq: strategyFamily === "adr_grid" ? trade.detail?.tradeNumber ?? null : null,
      parentNaturalRef,
      canonicalTradeId: `${stableTradeId}|canonical`,
      executionTradeId: `${stableTradeId}|execution`,
      entryUtc: trade.detail?.entryTimeUtc ?? null,
      exitUtc: trade.detail?.exitTimeUtc ?? null,
      entryPrice: trade.openPrice,
      exitPrice: trade.closePrice,
      returnMatrix: {
        canonical: { rawPct },
        execution: { rawPct },
        adrPct,
      },
      riskMatrix: riskMatrixFromRisk(maeRawPct, null, adrPct),
      exitReason: trade.detail?.exitReason ?? null,
      capActiveFillsAtEntry: trade.detail?.capActiveFillsAtEntry ?? null,
      capThresholdAtEntry: trade.detail?.capThresholdAtEntry ?? null,
      capViolated: trade.detail?.capViolated ?? false,
      warnings: [],
    });

    if (strategyFamily === "adr_grid") {
      const groupKey = parentNaturalRef ?? artifactTradeKey(options.weekOpenUtc, trade);
      const group = gridGroups.get(groupKey) ?? [];
      group.push(trade);
      gridGroups.set(groupKey, group);
    }
  }

  for (const [parentRef, trades] of gridGroups) {
    const first = trades[0];
    if (!first) continue;
    const rawPct = trades.reduce((sum, trade) => {
      const value = typeof trade.rawReturnPct === "number" && Number.isFinite(trade.rawReturnPct)
        ? trade.rawReturnPct
        : trade.returnPct;
      return sum + value;
    }, 0);
    const adrPct = finiteOrNull(first.adrPct);
    const maxFillMaeRawPct = trades.reduce<number | null>((max, trade) => {
      const mae = finiteOrNull(trade.detail?.maePct);
      if (mae === null) return max;
      return max === null ? mae : Math.max(max, mae);
    }, null);
    const maxPathDrawdownRawPct = trades.reduce<number | null>((max, trade) => {
      const drawdown = finiteOrNull(trade.detail?.gridPathDrawdownRawPct);
      if (drawdown === null) return max;
      return max === null ? drawdown : Math.max(max, drawdown);
    }, null);
    const maxActiveFillsAtEntry = trades.reduce<number | null>((max, trade) => {
      const active = finiteOrNull(trade.detail?.capActiveFillsAtEntry);
      if (active === null) return max;
      return max === null ? active : Math.max(max, active);
    }, null);
    const capThresholdAtEntry = trades.find((trade) => trade.detail?.capThresholdAtEntry != null)
      ?.detail?.capThresholdAtEntry ?? null;
    const stableTradeId = [
      "strategy-artifact-delta",
      options.strategyVariant,
      options.weekOpenUtc,
      first.symbol,
      first.source,
      first.tier ?? -1,
      first.direction,
      "grid",
    ].join("|");
    rows.push({
      rowKind: "grid",
      origin: "backtest",
      strategyFamily: "adr_grid",
      strategyVariant: options.strategyVariant,
      symbol: first.symbol,
      assetClass: normalizeAssetClass(first.assetClass),
      weekOpenUtc: options.weekOpenUtc,
      sourceModel: first.source,
      tier: first.tier,
      direction: first.direction,
      fillSeq: null,
      parentNaturalRef: null,
      canonicalTradeId: `${stableTradeId}|canonical`,
      executionTradeId: `${stableTradeId}|execution`,
      entryUtc: trades.map((trade) => trade.detail?.entryTimeUtc).filter(Boolean).sort()[0] ?? null,
      exitUtc: trades.map((trade) => trade.detail?.exitTimeUtc).filter(Boolean).sort().at(-1) ?? null,
      entryPrice: first.openPrice,
      exitPrice: trades.at(-1)?.closePrice ?? first.closePrice,
      returnMatrix: {
        canonical: { rawPct },
        execution: { rawPct },
        adrPct,
      },
      riskMatrix: riskMatrixFromRisk(maxFillMaeRawPct, maxPathDrawdownRawPct, adrPct),
      exitReason: null,
      capActiveFillsAtEntry: maxActiveFillsAtEntry,
      capThresholdAtEntry,
      capViolated: trades.some((trade) => trade.detail?.capViolated),
      warnings: [],
    });

    for (const row of rows) {
      if (row.parentNaturalRef === parentRef) {
        row.parentNaturalRef = parentRef;
      }
    }
  }

  return rows;
}

function strategyVariantNeedsArtifactCorrection(strategyVariant: string) {
  return strategyVariant.includes("-adr_grid-");
}

async function buildStrategyArtifactRowsForWeek(options: {
  strategyVariant: string;
  weekOpenUtc: string;
  currentWeekOpenUtc: string;
}) {
  if (!strategyVariantNeedsArtifactCorrection(options.strategyVariant)) return [];
  if (options.weekOpenUtc >= options.currentWeekOpenUtc) return [];
  const data = await loadStrategyPageData(strategySelectionFromVariant(options.strategyVariant), {
    includeCurrentWeek: false,
  });
  const result = data?.weekResults?.[options.weekOpenUtc];
  if (!result?.isRealized || result.trades.length === 0) return [];
  return closedRowsFromStrategyTrades({
    strategyVariant: options.strategyVariant,
    weekOpenUtc: options.weekOpenUtc,
    trades: result.trades,
  });
}

export async function buildStrategyArtifactCorrectionShard(options: {
  manifest: ReleaseManifest;
  strategyVariant: string;
  weekOpenUtc: string;
  currentWeekOpenUtc: string;
}): Promise<CanonWeekShard | null> {
  const rows = sortRows(await buildStrategyArtifactRowsForWeek({
    strategyVariant: options.strategyVariant,
    weekOpenUtc: options.weekOpenUtc,
    currentWeekOpenUtc: options.currentWeekOpenUtc,
  }));
  if (rows.length === 0) return null;
  const sourceHash = sha256(stableJson({
    source: "strategy-artifact-correction",
    strategyVariant: options.strategyVariant,
    weekOpenUtc: options.weekOpenUtc,
    rows,
  }));
  const artifact = artifactForRows({
    manifest: options.manifest,
    strategyVariant: options.strategyVariant,
    rows,
    sourceHash,
    generatedAtUtc: new Date().toISOString(),
  });
  return buildCanonWeekShard({
    manifest: options.manifest,
    artifact,
    strategyVariant: options.strategyVariant,
    weekOpenUtc: options.weekOpenUtc,
    source: "strategy-artifact-correction",
  });
}

async function buildStrategyArtifactCorrectionWeeks(options: {
  manifest: ReleaseManifest;
  strategyVariant: string;
  weekOpenUtcs: string[];
  currentWeekOpenUtc: string;
}): Promise<CanonVariantInventory["deltaWeeks"]> {
  if (!strategyVariantNeedsArtifactCorrection(options.strategyVariant)) return [];
  const entries: CanonVariantInventory["deltaWeeks"] = [];
  const data = await loadStrategyPageData(strategySelectionFromVariant(options.strategyVariant), {
    includeCurrentWeek: false,
  });
  for (const weekOpenUtc of options.weekOpenUtcs) {
    if (weekOpenUtc >= options.currentWeekOpenUtc) continue;
    const result = data?.weekResults?.[weekOpenUtc];
    if (!result?.isRealized || result.trades.length === 0) continue;
    const rows = sortRows(closedRowsFromStrategyTrades({
      strategyVariant: options.strategyVariant,
      weekOpenUtc,
      trades: result.trades,
    }));
    if (rows.length === 0) continue;
    const sourceHash = sha256(stableJson({
      source: "strategy-artifact-correction",
      strategyVariant: options.strategyVariant,
      weekOpenUtc,
      rows,
    }));
    const artifact = artifactForRows({
      manifest: options.manifest,
      strategyVariant: options.strategyVariant,
      rows,
      sourceHash,
      generatedAtUtc: new Date().toISOString(),
    });
    const shard = buildCanonWeekShard({
      manifest: options.manifest,
      artifact,
      strategyVariant: options.strategyVariant,
      weekOpenUtc,
      source: "strategy-artifact-correction",
    });
    const payloadRaw = stableJson(shard.payload);
    entries.push({
      weekOpenUtc,
      source: "strategy-artifact-correction",
      schemaVersion: CANON_WEEK_SHARD_SCHEMA_VERSION,
      sha256: shard.metadata.payloadHash,
      sizeBytes: Buffer.byteLength(payloadRaw, "utf8"),
      generatedAtUtc: shard.metadata.generatedAtUtc,
      rowCounts: rowCounts(shard.payload.closedHistoryRows),
    });
  }
  return entries;
}

async function buildStrategyArtifactDeltaRows(options: {
  strategyVariant: string;
  baselineLatestClosedWeekOpenUtc: string | null;
  currentWeekOpenUtc: string;
}) {
  const data = await loadStrategyPageData(strategySelectionFromVariant(options.strategyVariant), {
    includeCurrentWeek: false,
  });
  const rowsByWeek = new Map<string, ClosedHistoryRow[]>();
  for (const [weekOpenUtc, result] of Object.entries(data?.weekResults ?? {})) {
    if (
      (options.baselineLatestClosedWeekOpenUtc && weekOpenUtc <= options.baselineLatestClosedWeekOpenUtc) ||
      weekOpenUtc >= options.currentWeekOpenUtc ||
      !result.isRealized ||
      result.trades.length === 0
    ) {
      continue;
    }
    rowsByWeek.set(weekOpenUtc, closedRowsFromStrategyTrades({
      strategyVariant: options.strategyVariant,
      weekOpenUtc,
      trades: result.trades,
    }));
  }
  return rowsByWeek;
}

function artifactForRows(options: {
  manifest: ReleaseManifest;
  strategyVariant: string;
  rows: ClosedHistoryRow[];
  sourceHash: `sha256:${string}`;
  generatedAtUtc: string;
}): ReleaseCanonArtifact {
  return {
    metadata: {
      releaseLine: options.manifest.releaseLine,
      appVersion: options.manifest.appVersion,
      semanticVersion: options.manifest.semanticVersion,
      canonVersion: options.manifest.canonVersion,
      preparedAt: options.manifest.preparedAt,
      releasedAt: options.manifest.releasedAt,
      canonGeneratedAt: options.generatedAtUtc,
      strategyVariant: options.strategyVariant,
      sourceLedgerRowCount: options.rows.length,
      sourceHash: options.sourceHash,
    },
    bundle: {
      rows: options.rows,
      strategyVariant: options.strategyVariant,
      scope: [...ALL_PERFORMANCE_ASSET_SELECTION],
      generatedAt: options.generatedAtUtc,
    },
  };
}

export function buildCanonWeekShard(options: {
  manifest: ReleaseManifest;
  artifact: ReleaseCanonArtifact;
  strategyVariant: string;
  weekOpenUtc: string;
  source?: CanonShardSource;
}): CanonWeekShard {
  const weekOpenUtc = resolveWeekOpenUtc(options.artifact.bundle.rows, options.weekOpenUtc);
  const rows = sortRows(options.artifact.bundle.rows.filter((row) => row.weekOpenUtc === weekOpenUtc));
  const payload = {
    weekOptions: [weekOpenUtc],
    closedHistoryRows: rows,
  };
  const payloadHash = sha256(stableJson(payload));
  return {
    metadata: {
      schemaVersion: CANON_WEEK_SHARD_SCHEMA_VERSION,
      canonVersion: options.manifest.canonVersion,
      releaseLine: options.manifest.releaseLine,
      appVersionPreparedFrom: options.artifact.metadata.appVersion,
      strategyVariant: options.strategyVariant,
      weekOpenUtc,
      weekCloseUtc: weekCloseUtc(weekOpenUtc),
      weekKeySemantics: CANON_WEEK_KEY_SEMANTICS,
      source: options.source ?? "release-canon",
      generatedAtUtc: options.artifact.metadata.canonGeneratedAt,
      sourceHash: options.artifact.metadata.sourceHash as `sha256:${string}`,
      payloadHash,
      rowCounts: {
        ...rowCounts(rows),
        weekResults: 0,
      },
      anchors: {
        canonicalAnchorVersion: options.manifest.components.canonicalAnchorVersion,
        executionAnchorVersion: options.manifest.components.anchorVersion,
        canonicalWeeks: [weekOpenUtc],
        executionWeeks: [weekOpenUtc],
      },
    },
    payload,
  };
}

export async function buildClosedWeekDeltaShard(options: {
  manifest: ReleaseManifest;
  strategyVariant: string;
  weekOpenUtc: string;
  currentWeekOpenUtc: string;
  baselineLatestClosedWeekOpenUtc?: string | null;
}): Promise<CanonWeekShard | null> {
  const bundle = await buildClosedHistoryBundle({
    strategyVariant: options.strategyVariant,
    scope: ALL_PERFORMANCE_ASSET_SELECTION,
  });
  const weekOpenUtc = resolveWeekOpenUtc(bundle.rows, options.weekOpenUtc);
  if (weekOpenUtc >= options.currentWeekOpenUtc) return null;

  let rows = sortRows(bundle.rows.filter((row) => row.weekOpenUtc === weekOpenUtc));
  if (rows.length === 0) {
    const artifactRowsByWeek = await buildStrategyArtifactDeltaRows({
      strategyVariant: options.strategyVariant,
      baselineLatestClosedWeekOpenUtc: options.baselineLatestClosedWeekOpenUtc ?? null,
      currentWeekOpenUtc: options.currentWeekOpenUtc,
    });
    rows = sortRows(artifactRowsByWeek.get(weekOpenUtc) ?? []);
  }
  if (rows.length === 0) return null;

  const sourceHash = sha256(stableJson({
    source: "closed-week-delta",
    strategyVariant: options.strategyVariant,
    weekOpenUtc,
    rows,
  }));
  const artifact = artifactForRows({
    manifest: options.manifest,
    strategyVariant: options.strategyVariant,
    rows,
    sourceHash,
    generatedAtUtc: bundle.generatedAt,
  });

  return buildCanonWeekShard({
    manifest: options.manifest,
    artifact,
    strategyVariant: options.strategyVariant,
    weekOpenUtc,
    source: "closed-week-delta",
  });
}

export function buildCanonVariantInventory(options: {
  manifest: ReleaseManifest;
  artifact: ReleaseCanonArtifact;
  strategyVariant: string;
}): CanonVariantInventory {
  const weeks = distinctSorted(options.artifact.bundle.rows.map((row) => row.weekOpenUtc));
  const baselineWeeks = weeks.map((weekOpenUtc) => {
    const shard = buildCanonWeekShard({
      manifest: options.manifest,
      artifact: options.artifact,
      strategyVariant: options.strategyVariant,
      weekOpenUtc,
    });
    const payloadRaw = stableJson(shard.payload);
    return {
      weekOpenUtc,
      source: "release-canon" as const,
      schemaVersion: CANON_WEEK_SHARD_SCHEMA_VERSION,
      sha256: shard.metadata.payloadHash,
      sizeBytes: Buffer.byteLength(payloadRaw, "utf8"),
      generatedAtUtc: shard.metadata.generatedAtUtc,
      rowCounts: rowCounts(shard.payload.closedHistoryRows),
    };
  });

  return {
    strategyVariant: options.strategyVariant,
    baselineWeeks,
    deltaWeeks: [],
    aggregate: aggregateInventoryEntry(options.manifest, options.strategyVariant),
    latestClosedWeekOpenUtc: weeks.at(-1) ?? null,
  };
}

export async function buildDeltaWeeksForVariant(options: {
  manifest: ReleaseManifest;
  strategyVariant: string;
  baselineLatestClosedWeekOpenUtc: string | null;
  currentWeekOpenUtc: string;
}) {
  const latestClosedWeekOpenUtc = previousClosedWeekOpenUtc(options.currentWeekOpenUtc);
  if (options.baselineLatestClosedWeekOpenUtc && latestClosedWeekOpenUtc) {
    const baselineMillis = Date.parse(options.baselineLatestClosedWeekOpenUtc);
    const latestClosedMillis = Date.parse(latestClosedWeekOpenUtc);
    if (Number.isFinite(baselineMillis) && Number.isFinite(latestClosedMillis) && baselineMillis >= latestClosedMillis) {
      return [];
    }
  }

  const cacheKey = [
    options.manifest.cacheNamespace,
    options.strategyVariant,
    options.baselineLatestClosedWeekOpenUtc ?? "none",
    options.currentWeekOpenUtc,
  ].join(":");
  const cached = deltaWeeksCache.get(cacheKey);
  if (cached) return cached;

  const request = buildDeltaWeeksForVariantUncached(options);
  deltaWeeksCache.set(cacheKey, request);
  return request;
}

async function buildDeltaWeeksForVariantUncached(options: {
  manifest: ReleaseManifest;
  strategyVariant: string;
  baselineLatestClosedWeekOpenUtc: string | null;
  currentWeekOpenUtc: string;
}): Promise<CanonVariantInventory["deltaWeeks"]> {
  const bundle = await buildClosedHistoryBundle({
    strategyVariant: options.strategyVariant,
    scope: ALL_PERFORMANCE_ASSET_SELECTION,
  });
  const weeks = distinctSorted(bundle.rows.map((row) => row.weekOpenUtc))
    .filter((weekOpenUtc) =>
      (!options.baselineLatestClosedWeekOpenUtc || weekOpenUtc > options.baselineLatestClosedWeekOpenUtc) &&
      weekOpenUtc < options.currentWeekOpenUtc,
    );
  const artifactRowsByWeek = await buildStrategyArtifactDeltaRows({
    strategyVariant: options.strategyVariant,
    baselineLatestClosedWeekOpenUtc: options.baselineLatestClosedWeekOpenUtc,
    currentWeekOpenUtc: options.currentWeekOpenUtc,
  });
  const allWeeks = distinctSorted([
    ...weeks,
    ...Array.from(artifactRowsByWeek.keys()),
  ]);

  return allWeeks.map((weekOpenUtc) => {
    const bundleRows = sortRows(bundle.rows.filter((row) => row.weekOpenUtc === weekOpenUtc));
    const rows = bundleRows.length > 0
      ? bundleRows
      : sortRows(artifactRowsByWeek.get(weekOpenUtc) ?? []);
    const sourceHash = sha256(stableJson({
      source: "closed-week-delta",
      strategyVariant: options.strategyVariant,
      weekOpenUtc,
      rows,
    }));
    const artifact = artifactForRows({
      manifest: options.manifest,
      strategyVariant: options.strategyVariant,
      rows,
      sourceHash,
      generatedAtUtc: bundle.generatedAt,
    });
    const shard = buildCanonWeekShard({
      manifest: options.manifest,
      artifact,
      strategyVariant: options.strategyVariant,
      weekOpenUtc,
      source: "closed-week-delta",
    });
    const payloadRaw = stableJson(shard.payload);
    return {
      weekOpenUtc,
      source: "closed-week-delta" as const,
      schemaVersion: CANON_WEEK_SHARD_SCHEMA_VERSION,
      sha256: shard.metadata.payloadHash,
      sizeBytes: Buffer.byteLength(payloadRaw, "utf8"),
      generatedAtUtc: shard.metadata.generatedAtUtc,
      rowCounts: rowCounts(shard.payload.closedHistoryRows),
    };
  });
}

export async function readReleaseCanonArtifact(
  manifest: ReleaseManifest,
  strategyVariant: string,
): Promise<ReleaseCanonArtifact> {
  const manifestEntry = manifest.canon.variants.find((entry) => entry.strategyVariant === strategyVariant);
  if (!manifestEntry) {
    throw new Error(`Canon variant not found: ${strategyVariant}`);
  }
  const cacheKey = `${manifest.canonVersion}:${strategyVariant}:${manifestEntry.sha256}`;
  const cached = releaseCanonArtifactCache.get(cacheKey);
  if (cached) return cached;

  const fileName = canonFileNameForStrategyVariant(strategyVariant);
  if (fileName !== manifestEntry.file) {
    throw new Error(`Canon manifest file mapping mismatch for ${strategyVariant}`);
  }
  const filePath = path.join(process.cwd(), "releases", manifest.canonVersion, "canon", fileName);
  const request = readFile(filePath, "utf8")
    .then((raw) => JSON.parse(raw) as ReleaseCanonArtifact);
  releaseCanonArtifactCache.set(cacheKey, request);
  return request;
}

export async function buildCanonInventoryManifest(options: {
  manifest: ReleaseManifest;
  currentWeekOpenUtc: string;
  strategyVariants?: string[];
}): Promise<CanonInventoryManifest> {
  const requestedVariants = new Set(options.strategyVariants?.filter(Boolean) ?? []);
  const variantKey = requestedVariants.size > 0
    ? Array.from(requestedVariants).sort().join(",")
    : "all";
  const cacheKey = `${options.manifest.cacheNamespace}:${options.currentWeekOpenUtc}:${variantKey}`;
  const cached = inventoryManifestCache.get(cacheKey);
  if (cached) return cached;

  const request = buildCanonInventoryManifestUncached({
    manifest: options.manifest,
    currentWeekOpenUtc: options.currentWeekOpenUtc,
    strategyVariants: Array.from(requestedVariants),
  });
  inventoryManifestCache.set(cacheKey, request);
  return request;
}

async function buildCanonInventoryManifestUncached(options: {
  manifest: ReleaseManifest;
  currentWeekOpenUtc: string;
  strategyVariants?: string[];
}): Promise<CanonInventoryManifest> {
  const variants: Record<string, CanonVariantInventory> = {};
  const requestedVariants = new Set(options.strategyVariants?.filter(Boolean) ?? []);
  const manifestVariants = options.manifest.canon.variants.filter((variant) =>
    requestedVariants.size === 0 || requestedVariants.has(variant.strategyVariant),
  );
  for (const variant of manifestVariants) {
    const artifact = await readReleaseCanonArtifact(options.manifest, variant.strategyVariant);
    const inventory = buildCanonVariantInventory({
      manifest: options.manifest,
      artifact,
      strategyVariant: variant.strategyVariant,
    });
    const correctedBaselineWeeks = await buildStrategyArtifactCorrectionWeeks({
      manifest: options.manifest,
      strategyVariant: variant.strategyVariant,
      weekOpenUtcs: inventory.baselineWeeks.map((week) => week.weekOpenUtc),
      currentWeekOpenUtc: options.currentWeekOpenUtc,
    });
    const correctedBaselineSet = new Set(correctedBaselineWeeks.map((week) => week.weekOpenUtc));
    if (correctedBaselineSet.size > 0) {
      inventory.baselineWeeks = inventory.baselineWeeks.filter((week) => !correctedBaselineSet.has(week.weekOpenUtc));
    }
    inventory.deltaWeeks = await buildDeltaWeeksForVariant({
      manifest: options.manifest,
      strategyVariant: variant.strategyVariant,
      baselineLatestClosedWeekOpenUtc: inventory.latestClosedWeekOpenUtc,
      currentWeekOpenUtc: options.currentWeekOpenUtc,
    });
    inventory.deltaWeeks = [...correctedBaselineWeeks, ...inventory.deltaWeeks]
      .sort((left, right) => left.weekOpenUtc.localeCompare(right.weekOpenUtc));
    inventory.latestClosedWeekOpenUtc =
      inventory.deltaWeeks.at(-1)?.weekOpenUtc ?? inventory.latestClosedWeekOpenUtc;
    variants[variant.strategyVariant] = inventory;
  }

  const latestClosedWeekOpenUtc = distinctSorted(
    Object.values(variants).map((variant) => variant.latestClosedWeekOpenUtc),
  ).at(-1) ?? null;

  return {
    schemaVersion: CANON_INVENTORY_SCHEMA_VERSION,
    releaseLine: options.manifest.releaseLine,
    appVersion: options.manifest.appVersion,
    canonVersion: options.manifest.canonVersion,
    cacheNamespace: options.manifest.cacheNamespace,
    currentWeekOpenUtc: options.currentWeekOpenUtc,
    latestClosedWeekOpenUtc,
    weekKeySemantics: CANON_WEEK_KEY_SEMANTICS,
    variants,
    generatedAtUtc: new Date().toISOString(),
  };
}
