/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: strategyArtifactReadiness.ts
 *
 * Description:
 * Readiness checks for versioned strategy artifact shards.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import { listDataSectionWeeks } from "@/lib/dataSectionWeeks";
import { getDisplayWeekOpenUtc } from "@/lib/weekAnchor";
import { buildDataWeekOptions } from "@/lib/weekOptions";
import {
  getEntryStyle,
  getRiskOverlay,
  getStrategy,
} from "@/lib/performance/strategyConfig";
import {
  buildStrategySelectionKey,
  listVisibleStrategyBootstrapSelections,
  type StrategyBootstrapSelection,
} from "@/lib/performance/strategySelection";
import { buildStrategyArtifactEngineVersion } from "@/lib/performance/strategyArtifactVersions";
import {
  loadStrategyPageData,
  type StrategyPageData,
} from "@/lib/performance/strategyPageData";
import {
  readWeekShards,
  type WeekShardEntry,
} from "@/lib/performance/strategyWeekShardCache";

export type StrategyArtifactReadiness = {
  key: string;
  label: string;
  strategy: string;
  f1: string;
  f2: string;
  expectedEngineVersion: string;
  actualEngineVersion: string | null;
  ready: boolean;
  reason: "ready" | "missing" | "stale" | "stale_week" | "stale_options" | "stale_fingerprint";
  cachedAtUtc: string | null;
  payloadBytes: number | null;
  shardProgress?: {
    ready: number;
    total: number;
  } | null;
  missingWeeks?: string[];
  staleWeeks?: string[];
};

type ExpectedShardContext = {
  currentWeekOpenUtc: string;
  expectedWeeks: string[];
  expectedEngineVersion: string;
};

type ReadReadyStrategyArtifactPayloadOptions = {
  includeCurrentWeek?: boolean;
};

const READINESS_CONCURRENCY = 3;

export function getExpectedStrategyArtifactEngineVersion(selection: StrategyBootstrapSelection) {
  return buildStrategyArtifactEngineVersion({
    entryStyle: getEntryStyle(selection.f1),
    riskOverlay: getRiskOverlay(selection.f2),
  });
}

export function labelForStrategyArtifact(selection: StrategyBootstrapSelection) {
  const strategy = getStrategy(selection.strategyId)?.label ?? selection.strategyId;
  const entry = getEntryStyle(selection.f1)?.label ?? selection.f1;
  const overlay = getRiskOverlay(selection.f2);
  return [
    strategy,
    entry,
    overlay && overlay.id !== "none" ? overlay.label : null,
  ].filter(Boolean).join(" · ");
}

function isUsableShard(shard: WeekShardEntry) {
  if (!shard.weekResult || !shard.sim) return false;
  const primarySeries = shard.sim.series?.[0];
  const primaryPointCount = primarySeries?.points.length ?? 0;
  const signalCount = shard.weekResult.signals?.length ?? 0;
  if (
    shard.weekResult.isRealized &&
    shard.weekResult.tradeCount <= 0 &&
    signalCount > 0 &&
    primaryPointCount <= 1
  ) {
    return false;
  }
  if (!shard.weekResult.isRealized || shard.weekResult.tradeCount <= 0) return true;
  return Boolean(primarySeries && primarySeries.points.length > 2);
}

function latestShardCachedAtUtc(shards: WeekShardEntry[]) {
  return shards
    .map((shard) => shard.cachedAtUtc)
    .filter(Boolean)
    .sort((left, right) => Date.parse(right) - Date.parse(left))[0] ?? null;
}

async function buildExpectedShardContext(selection: StrategyBootstrapSelection): Promise<ExpectedShardContext> {
  const currentWeekOpenUtc = getDisplayWeekOpenUtc();
  const expectedWeeks = buildDataWeekOptions({
    historicalWeeks: await listDataSectionWeeks(),
    currentWeekOpenUtc,
  }).filter((weekOpenUtc): weekOpenUtc is string =>
    typeof weekOpenUtc === "string" &&
    weekOpenUtc !== "all" &&
    weekOpenUtc !== currentWeekOpenUtc,
  );

  return {
    currentWeekOpenUtc,
    expectedWeeks,
    expectedEngineVersion: getExpectedStrategyArtifactEngineVersion(selection),
  };
}

async function readinessForSelection(
  selection: StrategyBootstrapSelection,
): Promise<StrategyArtifactReadiness> {
  const key = buildStrategySelectionKey(selection);
  const expected = await buildExpectedShardContext(selection);
  const shards = await readWeekShards(key, expected.expectedEngineVersion);
  const expectedSet = new Set(expected.expectedWeeks);
  const shardByWeek = new Map(
    shards
      .filter((shard) => expectedSet.has(shard.weekOpenUtc))
      .map((shard) => [shard.weekOpenUtc, shard]),
  );
  const missingWeeks: string[] = [];
  const staleWeeks: string[] = [];

  for (const weekOpenUtc of expected.expectedWeeks) {
    const shard = shardByWeek.get(weekOpenUtc);
    if (!shard) {
      missingWeeks.push(weekOpenUtc);
      continue;
    }
    if (!isUsableShard(shard)) {
      staleWeeks.push(weekOpenUtc);
    }
  }

  const readyCount = expected.expectedWeeks.length - missingWeeks.length - staleWeeks.length;
  const ready = readyCount === expected.expectedWeeks.length;

  return {
    key,
    label: labelForStrategyArtifact(selection),
    strategy: selection.strategyId,
    f1: selection.f1,
    f2: selection.f2,
    expectedEngineVersion: expected.expectedEngineVersion,
    actualEngineVersion: shards[0]?.engineVersion ?? null,
    ready,
    reason: ready ? "ready" : staleWeeks.length > 0 ? "stale_week" : "missing",
    cachedAtUtc: latestShardCachedAtUtc(shards),
    payloadBytes: null,
    shardProgress: ready
      ? null
      : {
          ready: readyCount,
          total: expected.expectedWeeks.length,
        },
    missingWeeks,
    staleWeeks,
  };
}

export async function listStrategyArtifactReadiness(
  selections: StrategyBootstrapSelection[] = listVisibleStrategyBootstrapSelections(),
) {
  const results: StrategyArtifactReadiness[] = [];
  let nextIndex = 0;
  const workerCount = Math.max(1, Math.min(READINESS_CONCURRENCY, selections.length));

  await Promise.all(Array.from({ length: workerCount }, async () => {
    while (nextIndex < selections.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      const selection = selections[currentIndex];
      if (!selection) return;
      results[currentIndex] = await readinessForSelection(selection);
    }
  }));

  return results;
}

export async function getStrategyArtifactReadiness(selection: StrategyBootstrapSelection) {
  const [readiness] = await listStrategyArtifactReadiness([selection]);
  return readiness ?? readinessForSelection(selection);
}

export async function readReadyStrategyArtifactPayload(
  selection: StrategyBootstrapSelection,
  options: ReadReadyStrategyArtifactPayloadOptions = {},
): Promise<StrategyPageData | null> {
  return loadStrategyPageData(selection, {
    includeCurrentWeek: options.includeCurrentWeek !== false,
  });
}
