import { query } from "@/lib/db";
import { listDataSectionWeeks } from "@/lib/dataSectionWeeks";
import { getDisplayWeekOpenUtc } from "@/lib/weekAnchor";
import { buildDataWeekOptions } from "@/lib/weekOptions";
import {
  getEntryStyle,
  getStrengthGate,
  getStrategy,
} from "@/lib/performance/strategyConfig";
import {
  buildStrategySelectionKey,
  listVisibleStrategyBootstrapSelections,
  type StrategyBootstrapSelection,
} from "@/lib/performance/strategySelection";
import {
  readStrategyArtifactEntry,
  type StrategyArtifactFingerprint,
} from "@/lib/performance/strategyArtifactCache";
import { buildStrategyArtifactEngineVersion } from "@/lib/performance/strategyArtifactVersions";
import type { StrategyPageData } from "@/lib/performance/strategyPageData";
import { readWeekShards } from "@/lib/performance/strategyWeekShardCache";

type ArtifactRow = {
  selection_key: string;
  cached_at_utc: string;
  fingerprint_json: StrategyArtifactFingerprint;
  payload_bytes: number;
};

export type StrategyArtifactReadiness = {
  key: string;
  label: string;
  strategy: string;
  f1: string;
  f2: string;
  expectedEngineVersion: string;
  actualEngineVersion: string | null;
  ready: boolean;
  reason: "ready" | "missing" | "stale";
  cachedAtUtc: string | null;
  payloadBytes: number | null;
  shardProgress?: {
    ready: number;
    total: number;
  } | null;
};

export function getExpectedStrategyArtifactEngineVersion(selection: StrategyBootstrapSelection) {
  return buildStrategyArtifactEngineVersion({
    entryStyle: getEntryStyle(selection.f1),
    riskOverlay: getStrengthGate(selection.f2),
  });
}

export function labelForStrategyArtifact(selection: StrategyBootstrapSelection) {
  const strategy = getStrategy(selection.strategyId)?.label ?? selection.strategyId;
  const entry = getEntryStyle(selection.f1)?.label ?? selection.f1;
  const overlay = getStrengthGate(selection.f2);
  return [
    strategy,
    entry,
    overlay && overlay.id !== "none" ? overlay.label : null,
  ].filter(Boolean).join(" · ");
}

function readinessForRow(
  selection: StrategyBootstrapSelection,
  row: ArtifactRow | undefined,
): StrategyArtifactReadiness {
  const key = buildStrategySelectionKey(selection);
  const expectedEngineVersion = getExpectedStrategyArtifactEngineVersion(selection);
  const actualEngineVersion = row?.fingerprint_json?.engineVersion ?? null;
  const ready = Boolean(row) && actualEngineVersion === expectedEngineVersion;
  const reason: StrategyArtifactReadiness["reason"] = ready
    ? "ready"
    : !row
      ? "missing"
      : "stale";
  return {
    key,
    label: labelForStrategyArtifact(selection),
    strategy: selection.strategyId,
    f1: selection.f1,
    f2: selection.f2,
    expectedEngineVersion,
    actualEngineVersion,
    ready,
    reason,
    cachedAtUtc: row?.cached_at_utc ?? null,
    payloadBytes: row?.payload_bytes ?? null,
  };
}

export async function listStrategyArtifactReadiness(
  selections: StrategyBootstrapSelection[] = listVisibleStrategyBootstrapSelections(),
) {
  const keys = selections.map(buildStrategySelectionKey);
  const rows = keys.length > 0
    ? await query<ArtifactRow>(
        `SELECT selection_key,
                cached_at_utc::text AS cached_at_utc,
                fingerprint_json,
                pg_column_size(payload_json)::int AS payload_bytes
           FROM strategy_artifacts
          WHERE selection_key = ANY($1::text[])`,
        [keys],
      )
    : [];
  const rowByKey = new Map(rows.map((row) => [row.selection_key, row]));
  const readiness = selections.map((selection) =>
    readinessForRow(selection, rowByKey.get(buildStrategySelectionKey(selection))),
  );
  return Promise.all(readiness.map(addShardProgressIfNeeded));
}

export async function getStrategyArtifactReadiness(selection: StrategyBootstrapSelection) {
  const [readiness] = await listStrategyArtifactReadiness([selection]);
  return readiness ?? readinessForRow(selection, undefined);
}

export async function readReadyStrategyArtifactPayload(selection: StrategyBootstrapSelection) {
  const entry = await readStrategyArtifactEntry<StrategyPageData>(buildStrategySelectionKey(selection));
  if (!entry) return null;
  const expectedEngineVersion = getExpectedStrategyArtifactEngineVersion(selection);
  if (entry.fingerprint.engineVersion !== expectedEngineVersion) return null;
  return {
    ...entry.payload,
    artifactMeta: {
      status: "hit" as const,
      selectionKey: buildStrategySelectionKey(selection),
      cachedAtUtc: entry.cachedAtUtc,
      refreshedWeeks: [],
      removedWeeks: [],
      missingWeeks: [],
    },
  };
}

async function addShardProgressIfNeeded(readiness: StrategyArtifactReadiness) {
  if (readiness.ready) {
    return {
      ...readiness,
      shardProgress: null,
    };
  }

  try {
    const currentWeekOpenUtc = getDisplayWeekOpenUtc();
    const weekOptions = buildDataWeekOptions({
      historicalWeeks: await listDataSectionWeeks(),
      currentWeekOpenUtc,
      limit: 16,
    }).filter((weekOpenUtc): weekOpenUtc is string =>
      typeof weekOpenUtc === "string" && weekOpenUtc !== "all" && weekOpenUtc !== currentWeekOpenUtc,
    );
    const shards = await readWeekShards(readiness.key, readiness.expectedEngineVersion);
    const expectedWeeks = new Set(weekOptions);
    const ready = new Set(
      shards
        .map((shard) => shard.weekOpenUtc)
        .filter((weekOpenUtc) => expectedWeeks.has(weekOpenUtc)),
    );

    return {
      ...readiness,
      shardProgress: {
        ready: ready.size,
        total: weekOptions.length,
      },
    };
  } catch (error) {
    console.error(
      `[strategyArtifactReadiness] Failed to load shard progress for ${readiness.key}:`,
      error instanceof Error ? error.message : error,
    );
    return {
      ...readiness,
      shardProgress: null,
    };
  }
}
