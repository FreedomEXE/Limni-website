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
import {
  buildStrategyArtifactEngineVersion,
  buildStrategyAssemblyVersion,
} from "@/lib/performance/strategyArtifactVersions";
import {
  assembleStrategyPageDataFromShards,
  overlayCurrentWeekOnStrategyPageData,
  type StrategyPageData,
} from "@/lib/performance/strategyPageData";
import {
  countWeekShardProgress,
  readWeekShards,
} from "@/lib/performance/strategyWeekShardCache";

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
  reason: "ready" | "missing" | "stale" | "stale_week" | "stale_options" | "stale_fingerprint";
  cachedAtUtc: string | null;
  payloadBytes: number | null;
  shardProgress?: {
    ready: number;
    total: number;
  } | null;
};

type ExpectedArtifactContext = {
  currentWeekOpenUtc: string;
  weekOptions: string[];
  expectedShardVersion: string;
  expectedAssemblyVersion: string;
  weekOptionsSignature: string;
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
  expected: ExpectedArtifactContext,
): StrategyArtifactReadiness {
  const key = buildStrategySelectionKey(selection);
  const actualEngineVersion = row?.fingerprint_json?.engineVersion ?? null;
  const reason = getArtifactStaleReason(row?.fingerprint_json, expected);
  const ready = reason === "ready";
  return {
    key,
    label: labelForStrategyArtifact(selection),
    strategy: selection.strategyId,
    f1: selection.f1,
    f2: selection.f2,
    expectedEngineVersion: expected.expectedAssemblyVersion,
    actualEngineVersion,
    ready,
    reason,
    cachedAtUtc: row?.cached_at_utc ?? null,
    payloadBytes: row?.payload_bytes ?? null,
  };
}

async function buildExpectedArtifactContext(selection: StrategyBootstrapSelection): Promise<ExpectedArtifactContext> {
  const entryStyle = getEntryStyle(selection.f1);
  const riskOverlay = getStrengthGate(selection.f2);
  const currentWeekOpenUtc = getDisplayWeekOpenUtc();
  const weekOptions = buildDataWeekOptions({
    historicalWeeks: await listDataSectionWeeks(),
    currentWeekOpenUtc,
  }).filter((weekOpenUtc): weekOpenUtc is string =>
    typeof weekOpenUtc === "string" && weekOpenUtc !== "all" && weekOpenUtc !== currentWeekOpenUtc,
  );
  const expectedShardVersion = buildStrategyArtifactEngineVersion({
    entryStyle,
    riskOverlay,
  });
  const expectedAssemblyVersion = buildStrategyAssemblyVersion({
    entryStyle,
    riskOverlay,
  });

  return {
    currentWeekOpenUtc,
    weekOptions,
    expectedShardVersion,
    expectedAssemblyVersion,
    weekOptionsSignature: weekOptions.join("|"),
  };
}

function getArtifactStaleReason(
  fingerprint: StrategyArtifactFingerprint | null | undefined,
  expected: ExpectedArtifactContext,
): StrategyArtifactReadiness["reason"] {
  if (!fingerprint) return "missing";
  if (fingerprint.engineVersion !== expected.expectedAssemblyVersion) return "stale";
  if (fingerprint.currentWeekOpenUtc !== expected.currentWeekOpenUtc) return "stale_week";
  if (fingerprint.weekOptionsSignature !== expected.weekOptionsSignature) return "stale_options";
  return "ready";
}

function getReadPathArtifactStaleReason(
  fingerprint: StrategyArtifactFingerprint | null | undefined,
  selection: StrategyBootstrapSelection,
): StrategyArtifactReadiness["reason"] {
  if (!fingerprint) return "missing";
  const entryStyle = getEntryStyle(selection.f1);
  const riskOverlay = getStrengthGate(selection.f2);
  const expectedAssemblyVersion = buildStrategyAssemblyVersion({
    entryStyle,
    riskOverlay,
  });
  if (fingerprint.engineVersion !== expectedAssemblyVersion) return "stale";
  if (fingerprint.currentWeekOpenUtc !== getDisplayWeekOpenUtc()) return "stale_week";
  return "ready";
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
  const readiness = await Promise.all(
    selections.map(async (selection) => {
      const expected = await buildExpectedArtifactContext(selection);
      return {
        readiness: readinessForRow(selection, rowByKey.get(buildStrategySelectionKey(selection)), expected),
        expected,
      };
    }),
  );
  return Promise.all(
    readiness.map(({ readiness: rowReadiness, expected }) =>
      addShardProgressIfNeeded(rowReadiness, expected),
    ),
  );
}

export async function getStrategyArtifactReadiness(selection: StrategyBootstrapSelection) {
  const [readiness] = await listStrategyArtifactReadiness([selection]);
  if (readiness) return readiness;
  const expected = await buildExpectedArtifactContext(selection);
  return readinessForRow(selection, undefined, expected);
}

export async function readReadyStrategyArtifactPayload(selection: StrategyBootstrapSelection) {
  const selectionKey = buildStrategySelectionKey(selection);
  const entry = await readStrategyArtifactEntry<StrategyPageData>(selectionKey);
  if (entry) {
    const staleReason = getReadPathArtifactStaleReason(entry.fingerprint, selection);
    return overlayCurrentWeekOnStrategyPageData(selection, entry.payload, {
      status: "hit",
      selectionKey,
      cachedAtUtc: entry.cachedAtUtc,
      refreshedWeeks: [],
      removedWeeks: [],
      missingWeeks: [],
      stale: staleReason !== "ready",
      staleReason: staleReason === "ready" ? null : staleReason,
    });
  }

  const biasSource = getStrategy(selection.strategyId);
  if (!biasSource) return null;
  const entryStyle = getEntryStyle(selection.f1);
  const riskOverlay = getStrengthGate(selection.f2);
  const expectedShardVersion = buildStrategyArtifactEngineVersion({
    entryStyle,
    riskOverlay,
  });
  const shards = await readWeekShards(selectionKey, expectedShardVersion);
  if (shards.length > 0) {
    const currentWeekOpenUtc = getDisplayWeekOpenUtc();
    const weekOptions = shards
      .map((shard) => shard.weekOpenUtc)
      .filter((weekOpenUtc) => weekOpenUtc !== currentWeekOpenUtc)
      .sort((left, right) => Date.parse(right) - Date.parse(left));
    const payload = assembleStrategyPageDataFromShards({
      biasSource,
      currentWeekOpenUtc,
      entryStyle,
      riskOverlay,
      weekOptions,
      shards,
    });
    const latestShardCachedAtUtc = shards
      .map((shard) => shard.cachedAtUtc)
      .sort((left, right) => Date.parse(right) - Date.parse(left))[0] ?? null;
    return overlayCurrentWeekOnStrategyPageData(selection, payload, {
      status: "hit",
      selectionKey,
      cachedAtUtc: latestShardCachedAtUtc,
      refreshedWeeks: [],
      removedWeeks: [],
      missingWeeks: [],
      stale: true,
      staleReason: "missing",
    });
  }

  return null;
}

async function addShardProgressIfNeeded(
  readiness: StrategyArtifactReadiness,
  expected: ExpectedArtifactContext,
) {
  if (readiness.ready) {
    return {
      ...readiness,
      shardProgress: null,
    };
  }

  try {
    const shardProgress = await countWeekShardProgress(
      readiness.key,
      expected.expectedShardVersion,
      expected.weekOptions,
    );

    if (
      shardProgress.total > 0 &&
      shardProgress.ready === shardProgress.total
    ) {
      return {
        ...readiness,
        ready: true,
        reason: "ready" as const,
        shardProgress,
      };
    }

    return {
      ...readiness,
      shardProgress,
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
