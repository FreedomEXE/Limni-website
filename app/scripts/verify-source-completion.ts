/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: verify-source-completion.ts
 *
 * Description:
 * Audits source_direction_completion-v1-current and source readiness for
 * Dealer, Commercial, Sentiment, and Strength. Completion proves each source
 * emits one LONG/SHORT direction for the canonical 36-pair universe. Readiness
 * proves those directions came from expected, locked, non-backfilled source
 * data instead of silent operational fallback.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import { pathToFileURL } from "node:url";

import { DateTime } from "luxon";

import { listDataSectionWeeks } from "../src/lib/dataSectionWeeks";
import { PAIRS_BY_ASSET_CLASS, type PairDefinition } from "../src/lib/cotPairs";
import { readSnapshot } from "../src/lib/cotStore";
import { resolveMarketBias } from "../src/lib/cotCompute";
import type { AssetClass } from "../src/lib/cotMarkets";
import { query } from "../src/lib/db";
import {
  getCanonicalBasketWeek,
  type BaseBasketModel,
  type CanonicalBasketSignal,
} from "../src/lib/performance/basketSource";
import { CANONICAL_ANCHOR_VERSION } from "../src/lib/pairReturns";
import { getDisplayWeekOpenUtc, normalizeWeekOpenUtc } from "../src/lib/weekAnchor";
import { deriveCotReportDate } from "../src/lib/dataSectionWeeks";
import { derivePriorStrengthWeekOpenUtcs } from "../src/lib/strength/canonicalDirection";

const MODELS: BaseBasketModel[] = ["dealer", "commercial", "sentiment", "strength"];
const ASSET_CLASSES: AssetClass[] = ["fx", "indices", "commodities", "crypto"];
const STRENGTH_WINDOWS = ["1h", "4h", "24h"] as const;

export type ReleaseWindow = {
  from: string;
  to: string;
  description: string;
  expectedWeeks: string[];
};

const V203_BASELINE_WEEKS = [
  "2026-01-19T00:00:00.000Z",
  "2026-01-26T00:00:00.000Z",
  "2026-02-02T00:00:00.000Z",
  "2026-02-09T00:00:00.000Z",
  "2026-02-16T00:00:00.000Z",
  "2026-02-23T00:00:00.000Z",
  "2026-03-02T00:00:00.000Z",
  "2026-03-08T23:00:00.000Z",
  "2026-03-15T23:00:00.000Z",
  "2026-03-22T23:00:00.000Z",
  "2026-03-29T23:00:00.000Z",
  "2026-04-05T23:00:00.000Z",
  "2026-04-12T23:00:00.000Z",
  "2026-04-19T23:00:00.000Z",
  "2026-04-26T23:00:00.000Z",
  "2026-05-03T23:00:00.000Z",
  "2026-05-10T23:00:00.000Z",
  "2026-05-17T23:00:00.000Z",
  "2026-05-24T23:00:00.000Z",
];

const V203_TRUSTED_12W_WEEKS = V203_BASELINE_WEEKS.slice(7);
const V203_CLEAN_14W_WEEKS = V203_BASELINE_WEEKS.slice(5);

const RELEASE_WINDOWS: Record<string, ReleaseWindow> = {
  "v2.0.3": {
    from: "2026-01-19T00:00:00.000Z",
    to: "2026-05-24T23:00:00.000Z",
    description: "v2.0.3 active 19-week app/reporting baseline.",
    expectedWeeks: V203_BASELINE_WEEKS,
  },
  "v2.0.3-trusted-12w": {
    from: "2026-03-08T23:00:00.000Z",
    to: "2026-05-24T23:00:00.000Z",
    description: "v2.0.3 clean 12-week source-readiness subset; not the active 19-week app baseline.",
    expectedWeeks: V203_TRUSTED_12W_WEEKS,
  },
  "v2.0.3-clean-14w": {
    from: "2026-02-23T00:00:00.000Z",
    to: "2026-05-24T23:00:00.000Z",
    description: "v2.0.3 longest consecutive all-source-trusted provisional comparison baseline; not release approval.",
    expectedWeeks: V203_CLEAN_14W_WEEKS,
  },
};

const EXPECTED_PAIRS = Object.values(PAIRS_BY_ASSET_CLASS)
  .flat()
  .map((pair) => pair.pair.toUpperCase())
  .sort();
const EXPECTED_PAIR_SET = new Set(EXPECTED_PAIRS);

type Args = {
  week: string | null;
  weeks: number;
  failOnCurrentWeek: boolean;
  json: boolean;
  verbose: boolean;
  allowUntrusted: boolean;
  from: string | null;
  to: string | null;
  releaseWindow: string | null;
};

export type SourceIncident = {
  pair?: string;
  severity: "info" | "warning" | "error";
  code: string;
  message: string;
  metadata?: Record<string, unknown>;
};

export type SourceReadinessStatus =
  | "ready"
  | "completion_failed"
  | "missing_source"
  | "stale_or_late_source"
  | "fallback_used"
  | "untrusted";

export type SourceReadinessAuditRow = {
  weekOpenUtc: string;
  source: BaseBasketModel;
  resolvedDirectional: number;
  expectedPairs: number;
  completion: string;
  readiness: SourceReadinessStatus;
  trusted: boolean;
  incidents: SourceIncident[];
  metadata?: Record<string, unknown>;
};

type SentimentAggregateAuditRow = {
  symbol: string;
  timestamp_utc: Date | string;
  agg_long_pct: number | string | null;
  crowding_state: string | null;
  flip_state: string | null;
};

type StrengthLockAuditRow = {
  source_type: "currency" | "asset";
  window: string;
  key: string;
  asset_class: AssetClass | null;
  source_snapshot_utc: Date | string | null;
  locked_at_utc: Date | string | null;
};

type PairReturnAuditRow = {
  symbol: string;
  period_open_utc: Date | string;
};

function parseArgs(): Args {
  const args = process.argv.slice(2);
  const parsed: Args = {
    week: null,
    weeks: 12,
    failOnCurrentWeek: false,
    json: false,
    verbose: false,
    allowUntrusted: false,
    from: null,
    to: null,
    releaseWindow: null,
  };

  for (const arg of args) {
    if (arg.startsWith("--week=")) {
      parsed.week = normalizeWeekOpenUtc(arg.slice("--week=".length)) ?? arg.slice("--week=".length);
    } else if (arg.startsWith("--weeks=")) {
      const value = Number(arg.slice("--weeks=".length));
      if (Number.isFinite(value) && value > 0) parsed.weeks = Math.floor(value);
    } else if (arg === "--fail-current-week") {
      parsed.failOnCurrentWeek = true;
    } else if (arg === "--json") {
      parsed.json = true;
    } else if (arg === "--verbose") {
      parsed.verbose = true;
    } else if (arg === "--allow-untrusted") {
      parsed.allowUntrusted = true;
    } else if (arg.startsWith("--from=")) {
      parsed.from = arg.slice("--from=".length);
    } else if (arg.startsWith("--to=")) {
      parsed.to = arg.slice("--to=".length);
    } else if (arg.startsWith("--release-window=")) {
      parsed.releaseWindow = arg.slice("--release-window=".length);
    }
  }

  return parsed;
}

function toIsoUtc(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function metadataReason(row: CanonicalBasketSignal) {
  const reason = row.metadata?.reason;
  return typeof reason === "string" ? reason : null;
}

function getMetadataString(row: CanonicalBasketSignal, key: string) {
  const value = row.metadata?.[key];
  return typeof value === "string" ? value : null;
}

function getMetadataNumber(row: CanonicalBasketSignal, key: string) {
  const value = row.metadata?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function getMetadataBoolean(row: CanonicalBasketSignal, key: string) {
  const value = row.metadata?.[key];
  return typeof value === "boolean" ? value : null;
}

function getMetadataStringArray(row: CanonicalBasketSignal, key: string) {
  const value = row.metadata?.[key];
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function isDirectional(row: CanonicalBasketSignal | null) {
  return row?.direction === "LONG" || row?.direction === "SHORT";
}

function formatSignal(row: CanonicalBasketSignal | null, pair: string) {
  if (!row) return `${pair}:missing_row`;
  const reason = metadataReason(row);
  const reportDate = row.sourceReportDate ? ` report=${row.sourceReportDate}` : "";
  const reasonText = reason ? ` reason=${reason}` : "";
  return `${pair}:${row.direction}${reasonText}${reportDate}`;
}

export function collectCompletionIncidents(rows: CanonicalBasketSignal[]): SourceIncident[] {
  const byPair = new Map(rows.map((row) => [row.symbol.toUpperCase(), row] as const));
  const incidents: SourceIncident[] = [];

  for (const pair of EXPECTED_PAIRS) {
    const row = byPair.get(pair) ?? null;
    if (!isDirectional(row)) {
      incidents.push({
        pair,
        severity: "error",
        code: row ? "unresolved_direction" : "missing_source_row",
        message: formatSignal(row, pair),
        metadata: row
          ? {
              direction: row.direction,
              reason: metadataReason(row),
              sourceReportDate: row.sourceReportDate ?? null,
            }
          : undefined,
      });
    }
  }

  for (const row of rows) {
    const pair = row.symbol.toUpperCase();
    if (!EXPECTED_PAIR_SET.has(pair)) {
      incidents.push({
        pair,
        severity: "error",
        code: "unexpected_pair",
        message: `${pair}:unexpected_pair`,
        metadata: { direction: row.direction, model: row.model },
      });
    }
  }

  return incidents;
}

export function collectModelIssues(rows: CanonicalBasketSignal[]) {
  return collectCompletionIncidents(rows).map((incident) => incident.message);
}

function blockingIncidents(incidents: SourceIncident[]) {
  return incidents.filter((incident) => incident.severity !== "info");
}

function summarizeReadiness(incidents: SourceIncident[]): SourceReadinessStatus {
  const blocking = blockingIncidents(incidents);
  if (blocking.length === 0) return "ready";
  if (blocking.some((incident) =>
    incident.code === "missing_source_row" ||
    incident.code === "unresolved_direction" ||
    incident.code === "unexpected_pair"
  )) {
    return "completion_failed";
  }
  if (blocking.some((incident) => incident.code.includes("missing"))) return "missing_source";
  if (blocking.some((incident) => incident.code.includes("stale") || incident.code.includes("late"))) {
    return "stale_or_late_source";
  }
  if (blocking.some((incident) =>
    incident.code.includes("fallback") ||
    incident.code.includes("backfill") ||
    incident.code.includes("branch")
  )) {
    return "fallback_used";
  }
  return "untrusted";
}

export function buildSourceReadinessAuditRow(options: {
  weekOpenUtc: string;
  source: BaseBasketModel;
  rows: CanonicalBasketSignal[];
  incidents?: SourceIncident[];
  metadata?: Record<string, unknown>;
}): SourceReadinessAuditRow {
  const completionIncidents = collectCompletionIncidents(options.rows);
  const incidents = [...completionIncidents, ...(options.incidents ?? [])];
  const resolvedDirectional = options.rows.filter(isDirectional).length;
  const trusted = blockingIncidents(incidents).length === 0;

  return {
    weekOpenUtc: options.weekOpenUtc,
    source: options.source,
    resolvedDirectional,
    expectedPairs: EXPECTED_PAIRS.length,
    completion: `${resolvedDirectional}/${EXPECTED_PAIRS.length}`,
    readiness: summarizeReadiness(incidents),
    trusted,
    incidents,
    metadata: options.metadata,
  };
}

function countBy(values: string[]) {
  return values.reduce<Record<string, number>>((counts, value) => {
    counts[value] = (counts[value] ?? 0) + 1;
    return counts;
  }, {});
}

function classifyCotPairResolution(
  model: "dealer" | "commercial",
  assetClass: AssetClass,
  pairDef: PairDefinition,
  row: CanonicalBasketSignal | null,
  currencies: Record<string, unknown>,
): { forced: boolean; code: string | null; metadata: Record<string, unknown> } {
  const base = currencies[pairDef.base] as Parameters<typeof resolveMarketBias>[0] | undefined;
  const quote = currencies[pairDef.quote] as Parameters<typeof resolveMarketBias>[0] | undefined;
  const baseBias = base ? resolveMarketBias(base, model) : null;
  const quoteBias = quote ? resolveMarketBias(quote, model) : null;

  const metadata = {
    assetClass,
    base: pairDef.base,
    quote: pairDef.quote,
    direction: row?.direction ?? null,
    baseBias: baseBias?.bias ?? null,
    quoteBias: quoteBias?.bias ?? null,
  };

  if (!isDirectional(row)) {
    return { forced: false, code: null, metadata };
  }

  if (!base || !baseBias || (assetClass === "fx" && (!quote || !quoteBias))) {
    return { forced: false, code: "cot_missing_market_input", metadata };
  }

  if (assetClass !== "fx") {
    return {
      forced: false,
      code: baseBias.bias === "NEUTRAL" ? "cot_neutral_base_market" : null,
      metadata,
    };
  }

  const neutralOrMatchingBias =
    baseBias.bias === "NEUTRAL" ||
    quoteBias?.bias === "NEUTRAL" ||
    baseBias.bias === quoteBias?.bias;

  if (!neutralOrMatchingBias) {
    return { forced: false, code: null, metadata };
  }

  return {
    forced: true,
    code: model === "dealer" ? "cot_dealer_forced_neutral_logic" : "cot_commercial_forced_raw_logic",
    metadata,
  };
}

async function collectCotReadinessIncidents(
  weekOpenUtc: string,
  model: "dealer" | "commercial",
  rows: CanonicalBasketSignal[],
): Promise<{ incidents: SourceIncident[]; metadata: Record<string, unknown> }> {
  const expectedReportDate = deriveCotReportDate(weekOpenUtc);
  const rowByPair = new Map(rows.map((row) => [row.symbol.toUpperCase(), row] as const));
  const incidents: SourceIncident[] = [];
  const snapshotDetails: Array<Record<string, unknown>> = [];
  const forcedPairs: Array<Record<string, unknown>> = [];

  for (const assetClass of ASSET_CLASSES) {
    const pairDefs = PAIRS_BY_ASSET_CLASS[assetClass] ?? [];
    let snapshot: Awaited<ReturnType<typeof readSnapshot>> = null;

    try {
      snapshot = await readSnapshot({ assetClass, reportDate: expectedReportDate });
    } catch (error) {
      incidents.push({
        severity: "error",
        code: "cot_snapshot_error",
        message: `${model} ${assetClass} COT snapshot read failed for ${expectedReportDate}.`,
        metadata: { assetClass, expectedReportDate, error: error instanceof Error ? error.message : String(error) },
      });
      continue;
    }

    if (!snapshot) {
      incidents.push({
        severity: "error",
        code: "cot_missing_snapshot",
        message: `${model} ${assetClass} COT snapshot is missing for expected report ${expectedReportDate}.`,
        metadata: { assetClass, expectedReportDate },
      });
      continue;
    }

    snapshotDetails.push({
      assetClass,
      expectedReportDate,
      actualReportDate: snapshot.report_date,
      fetchedAtUtc: snapshot.last_refresh_utc ?? null,
    });

    if (snapshot.report_date !== expectedReportDate) {
      incidents.push({
        severity: "error",
        code: "cot_stale_snapshot_report_date",
        message: `${model} ${assetClass} COT snapshot used ${snapshot.report_date}, expected ${expectedReportDate}.`,
        metadata: { assetClass, expectedReportDate, actualReportDate: snapshot.report_date },
      });
    }

    for (const pairDef of pairDefs) {
      const pair = pairDef.pair.toUpperCase();
      const row = rowByPair.get(pair) ?? null;

      if (row?.sourceReportDate && row.sourceReportDate !== expectedReportDate) {
        incidents.push({
          pair,
          severity: "error",
          code: "cot_row_report_date_mismatch",
          message: `${pair} ${model} row used report ${row.sourceReportDate}, expected ${expectedReportDate}.`,
          metadata: { expectedReportDate, sourceReportDate: row.sourceReportDate, assetClass },
        });
      }

      const classified = classifyCotPairResolution(model, assetClass, pairDef, row, snapshot.currencies);
      if (classified.code === "cot_missing_market_input" || classified.code === "cot_neutral_base_market") {
        incidents.push({
          pair,
          severity: "error",
          code: classified.code,
          message: `${pair} ${model} COT row resolved with invalid or missing market inputs.`,
          metadata: classified.metadata,
        });
      } else if (classified.forced && classified.code) {
        forcedPairs.push({ pair, code: classified.code, ...classified.metadata });
      }
    }
  }

  if (forcedPairs.length > 0) {
    incidents.push({
      severity: "info",
      code: "cot_forced_direction_logic_used",
      message: `${model} used documented forced COT direction logic for ${forcedPairs.length} pair(s).`,
      metadata: {
        expectedReportDate,
        count: forcedPairs.length,
        pairs: forcedPairs,
      },
    });
  }

  return {
    incidents,
    metadata: {
      expectedReportDate,
      snapshots: snapshotDetails,
      forcedPairCount: forcedPairs.length,
    },
  };
}

async function loadSentimentAggregateMaps(weekOpenUtc: string) {
  const open = DateTime.fromISO(weekOpenUtc, { zone: "utc" });
  const lowerBound = open.minus({ days: 7 }).toUTC().toISO();
  const close = open.plus({ days: 7 }).toUTC().toISO();
  const openIso = open.toUTC().toISO() ?? weekOpenUtc;

  const [properRows, lateRows, latestRows] = await Promise.all([
    query<SentimentAggregateAuditRow>(
      `
        SELECT DISTINCT ON (symbol)
               symbol, timestamp_utc, agg_long_pct, crowding_state, flip_state
          FROM sentiment_aggregates
         WHERE symbol = ANY($1::text[])
           AND timestamp_utc >= $2::timestamptz
           AND timestamp_utc <= $3::timestamptz
         ORDER BY symbol, timestamp_utc DESC
      `,
      [EXPECTED_PAIRS, lowerBound, openIso],
    ),
    query<SentimentAggregateAuditRow>(
      `
        SELECT DISTINCT ON (symbol)
               symbol, timestamp_utc, agg_long_pct, crowding_state, flip_state
          FROM sentiment_aggregates
         WHERE symbol = ANY($1::text[])
           AND timestamp_utc > $2::timestamptz
           AND timestamp_utc <= $3::timestamptz
         ORDER BY symbol, timestamp_utc ASC
      `,
      [EXPECTED_PAIRS, openIso, close],
    ),
    query<SentimentAggregateAuditRow>(
      `
        SELECT DISTINCT ON (symbol)
               symbol, timestamp_utc, agg_long_pct, crowding_state, flip_state
          FROM sentiment_aggregates
         WHERE symbol = ANY($1::text[])
         ORDER BY symbol, timestamp_utc DESC
      `,
      [EXPECTED_PAIRS],
    ),
  ]);

  const toMap = (rows: SentimentAggregateAuditRow[]) =>
    new Map(rows.map((row) => [row.symbol.toUpperCase(), row] as const));

  return {
    proper: toMap(properRows),
    late: toMap(lateRows),
    latest: toMap(latestRows),
  };
}

async function collectSentimentReadinessIncidents(
  weekOpenUtc: string,
  rows: CanonicalBasketSignal[],
): Promise<{ incidents: SourceIncident[]; metadata: Record<string, unknown> }> {
  const rowByPair = new Map(rows.map((row) => [row.symbol.toUpperCase(), row] as const));
  const aggregates = await loadSentimentAggregateMaps(weekOpenUtc);
  const incidents: SourceIncident[] = [];
  const branchByPair: Record<string, string> = {};
  let properAggregateCount = 0;
  let staleOrBackfillCount = 0;

  for (const pair of EXPECTED_PAIRS) {
    const row = rowByPair.get(pair) ?? null;
    const tier = row ? getMetadataString(row, "tier") ?? "unknown" : "missing_row";
    const subStep = row ? getMetadataString(row, "tierFSubStep") : null;
    branchByPair[pair] = subStep ? `${tier}:${subStep}` : tier;

    const proper = aggregates.proper.get(pair) ?? null;
    if (proper) {
      properAggregateCount += 1;
      continue;
    }

    staleOrBackfillCount += 1;
    const late = aggregates.late.get(pair) ?? null;
    const latest = aggregates.latest.get(pair) ?? null;
    if (late) {
      incidents.push({
        pair,
        severity: "warning",
        code: "sentiment_late_aggregate_used",
        message: `${pair} sentiment has no proper week-start aggregate; first in-week aggregate exists after week open.`,
        metadata: {
          weekOpenUtc,
          aggregateTimestampUtc: toIsoUtc(late.timestamp_utc),
          tier: branchByPair[pair],
        },
      });
      continue;
    }

    if (latest) {
      incidents.push({
        pair,
        severity: "warning",
        code: "sentiment_backfill_used",
        message: `${pair} sentiment has no week-start aggregate; resolver may use latest/backfilled aggregate.`,
        metadata: {
          weekOpenUtc,
          latestAggregateTimestampUtc: toIsoUtc(latest.timestamp_utc),
          tier: branchByPair[pair],
        },
      });
      continue;
    }

    incidents.push({
      pair,
      severity: "error",
      code: "sentiment_missing_aggregate",
      message: `${pair} sentiment has no aggregate data for readiness verification.`,
      metadata: { weekOpenUtc, tier: branchByPair[pair] },
    });
  }

  incidents.push({
    severity: "info",
    code: "sentiment_resolution_branches",
    message: "Sentiment completion branch distribution.",
    metadata: {
      branchCounts: countBy(Object.values(branchByPair)),
      branchByPair,
    },
  });

  return {
    incidents,
    metadata: {
      properAggregateCount,
      staleOrBackfillCount,
      branchCounts: countBy(Object.values(branchByPair)),
    },
  };
}

function buildStrengthExpectedLockKeys() {
  const keys = new Map<string, Record<string, unknown>>();

  function add(sourceType: "currency" | "asset", window: string, key: string, assetClass: AssetClass | null) {
    const normalizedKey = key.toUpperCase();
    const id = `${sourceType}:${assetClass ?? "fx"}:${window}:${normalizedKey}`;
    keys.set(id, {
      id,
      sourceType,
      window,
      key: normalizedKey,
      assetClass,
    });
  }

  for (const [assetClass, pairDefs] of Object.entries(PAIRS_BY_ASSET_CLASS) as Array<[AssetClass, PairDefinition[]]>) {
    for (const pairDef of pairDefs) {
      for (const window of STRENGTH_WINDOWS) {
        if (assetClass === "fx") {
          add("currency", window, pairDef.base, null);
          add("currency", window, pairDef.quote, null);
        } else {
          add("asset", window, pairDef.base, assetClass);
        }
      }
    }
  }

  return keys;
}

function strengthLockKey(row: StrengthLockAuditRow) {
  const sourceType = row.source_type;
  const assetClass = sourceType === "currency" ? "fx" : row.asset_class ?? "unknown";
  return `${sourceType}:${assetClass}:${row.window}:${row.key.toUpperCase()}`;
}

async function loadStoredPriorReturnKeys(weekOpenUtc: string) {
  const priorWeeks = derivePriorStrengthWeekOpenUtcs(weekOpenUtc);

  const rows = await query<PairReturnAuditRow>(
    `
      SELECT symbol, period_open_utc
        FROM pair_period_returns
       WHERE period_type = 'weekly'
         AND anchor_type = 'canonical'
         AND anchor_version = $1
         AND symbol = ANY($2::text[])
         AND period_open_utc = ANY($3::timestamptz[])
    `,
    [CANONICAL_ANCHOR_VERSION, EXPECTED_PAIRS, priorWeeks],
  );

  return new Set(rows.map((row) => `${row.symbol.toUpperCase()}:${toIsoUtc(row.period_open_utc)}`));
}

async function collectStrengthReadinessIncidents(
  weekOpenUtc: string,
  rows: CanonicalBasketSignal[],
): Promise<{ incidents: SourceIncident[]; metadata: Record<string, unknown> }> {
  const incidents: SourceIncident[] = [];
  const lockRows = await query<StrengthLockAuditRow>(
    `
      SELECT source_type, "window", "key", asset_class, source_snapshot_utc, locked_at_utc
        FROM strength_weekly_snapshots
       WHERE week_open_utc = $1::timestamp
       ORDER BY source_type ASC, asset_class ASC NULLS FIRST, "window" ASC, "key" ASC
    `,
    [weekOpenUtc],
  );
  const expectedLocks = buildStrengthExpectedLockKeys();
  const actualLockKeys = new Set(lockRows.map(strengthLockKey));
  const missingLockKeys = [...expectedLocks.entries()]
    .filter(([id]) => !actualLockKeys.has(id))
    .map(([, value]) => value);

  if (lockRows.length === 0) {
    incidents.push({
      severity: "error",
      code: "strength_missing_weekly_lock",
      message: "Strength has no locked weekly snapshot rows for this week.",
      metadata: { weekOpenUtc, expectedLockRows: expectedLocks.size, actualLockRows: 0 },
    });
  } else if (missingLockKeys.length > 0) {
    incidents.push({
      severity: "warning",
      code: "strength_incomplete_weekly_lock",
      message: `Strength weekly lock is missing ${missingLockKeys.length} expected underlying row(s).`,
      metadata: {
        weekOpenUtc,
        expectedLockRows: expectedLocks.size,
        actualLockRows: lockRows.length,
        missingLocks: missingLockKeys,
      },
    });
  }

  const storedPriorReturnKeys = await loadStoredPriorReturnKeys(weekOpenUtc);
  const priorWeeks = derivePriorStrengthWeekOpenUtcs(weekOpenUtc);
  const branchByPair: Record<string, string> = {};
  const availableWindowsByPair: Record<string, number | null> = {};
  let providerFallbackPairs = 0;
  let missingPriorReturnPairs = 0;

  for (const row of rows) {
    const pair = row.symbol.toUpperCase();
    const availableWindows = getMetadataNumber(row, "availableWindows");
    const latestSnapshotUtc = getMetadataString(row, "latestSnapshotUtc");
    const fallbackBranch = getMetadataString(row, "fallbackBranch") ?? "unknown";
    const providerFallbackUsed = getMetadataBoolean(row, "providerFallbackUsed") ?? false;
    const providerFallbackAttempted = getMetadataBoolean(row, "providerFallbackAttempted") ?? false;
    const missingStoredPriorWeeksFromMetadata = getMetadataStringArray(row, "missingStoredPriorWeeks");
    const missingStoredPriorWeeks = missingStoredPriorWeeksFromMetadata.length > 0
      ? missingStoredPriorWeeksFromMetadata
      : priorWeeks.filter((priorWeek) => !storedPriorReturnKeys.has(`${pair}:${priorWeek}`));

    branchByPair[pair] = fallbackBranch;
    availableWindowsByPair[pair] = availableWindows;

    if (availableWindows === null || availableWindows < STRENGTH_WINDOWS.length) {
      incidents.push({
        pair,
        severity: "warning",
        code: "strength_incomplete_windows",
        message: `${pair} strength has ${availableWindows ?? 0}/${STRENGTH_WINDOWS.length} available windows.`,
        metadata: { availableWindows, expectedWindows: STRENGTH_WINDOWS.length, latestSnapshotUtc },
      });
    }

    if (!latestSnapshotUtc) {
      incidents.push({
        pair,
        severity: "warning",
        code: "strength_missing_latest_snapshot",
        message: `${pair} strength has no latest snapshot timestamp.`,
        metadata: { availableWindows },
      });
    }

    if (missingStoredPriorWeeks.length > 0) {
      missingPriorReturnPairs += 1;
      incidents.push({
        pair,
        severity: "warning",
        code: "strength_missing_exact_prior_returns",
        message: `${pair} strength is missing exact stored prior return(s).`,
        metadata: { missingStoredPriorWeeks, anchorVersion: CANONICAL_ANCHOR_VERSION },
      });
    }

    if (providerFallbackAttempted) {
      incidents.push({
        pair,
        severity: "warning",
        code: providerFallbackUsed ? "strength_provider_fallback_used" : "strength_provider_fallback_attempted",
        message: providerFallbackUsed
          ? `${pair} strength used provider fallback for missing prior return data.`
          : `${pair} strength attempted provider fallback for missing prior return data.`,
        metadata: { fallbackBranch, missingStoredPriorWeeks },
      });
      if (providerFallbackUsed) providerFallbackPairs += 1;
    }
  }

  incidents.push({
    severity: "info",
    code: "strength_resolution_branches",
    message: "Strength completion branch distribution.",
    metadata: {
      branchCounts: countBy(Object.values(branchByPair)),
      branchByPair,
      availableWindowsByPair,
    },
  });

  return {
    incidents,
    metadata: {
      expectedLockRows: expectedLocks.size,
      actualLockRows: lockRows.length,
      missingLockRows: missingLockKeys.length,
      latestStrengthSnapshotUtc: lockRows
        .map((row) => toIsoUtc(row.source_snapshot_utc ?? row.locked_at_utc))
        .filter((value): value is string => Boolean(value))
        .sort()
        .at(-1) ?? null,
      providerFallbackPairs,
      missingPriorReturnPairs,
      branchCounts: countBy(Object.values(branchByPair)),
    },
  };
}

async function collectReadinessForModel(
  weekOpenUtc: string,
  model: BaseBasketModel,
  rows: CanonicalBasketSignal[],
): Promise<{ incidents: SourceIncident[]; metadata?: Record<string, unknown> }> {
  if (model === "dealer" || model === "commercial") {
    return collectCotReadinessIncidents(weekOpenUtc, model, rows);
  }
  if (model === "sentiment") {
    return collectSentimentReadinessIncidents(weekOpenUtc, rows);
  }
  if (model === "strength") {
    return collectStrengthReadinessIncidents(weekOpenUtc, rows);
  }
  return { incidents: [] };
}

async function auditModel(
  weekOpenUtc: string,
  model: BaseBasketModel,
  rows: CanonicalBasketSignal[],
) {
  const readiness = await collectReadinessForModel(weekOpenUtc, model, rows);
  return buildSourceReadinessAuditRow({
    weekOpenUtc,
    source: model,
    rows,
    incidents: readiness.incidents,
    metadata: readiness.metadata,
  });
}

async function resolveWeeks(args: Args) {
  if (args.week) return [args.week];

  const currentWeek = normalizeWeekOpenUtc(getDisplayWeekOpenUtc()) ?? getDisplayWeekOpenUtc();
  const allWeeks = (await listDataSectionWeeks())
    .map((week) => normalizeWeekOpenUtc(week) ?? week)
    .filter((week) => args.failOnCurrentWeek || week < currentWeek)
    .sort();

  const releaseWindow = args.releaseWindow ? RELEASE_WINDOWS[args.releaseWindow] : null;
  if (args.releaseWindow && !releaseWindow) {
    throw new Error(`Unknown release window "${args.releaseWindow}". Known windows: ${Object.keys(RELEASE_WINDOWS).join(", ")}`);
  }

  const from = resolveWeekBound(args.from ?? releaseWindow?.from ?? null, allWeeks);
  const to = resolveWeekBound(args.to ?? releaseWindow?.to ?? null, allWeeks);

  if (from || to) {
    return allWeeks.filter((week) => (!from || week >= from) && (!to || week <= to));
  }

  const weeks = allWeeks
    .sort((a, b) => b.localeCompare(a))
    .slice(0, args.weeks)
    .sort();

  return weeks;
}

export function validateResolvedWeeks(input: {
  weeks: string[];
  releaseWindowName?: string | null;
  releaseWindow?: ReleaseWindow | null;
  from?: string | null;
  to?: string | null;
}) {
  const { weeks, releaseWindowName, releaseWindow, from, to } = input;

  if (weeks.length === 0) {
    const scope = releaseWindowName
      ? `release window "${releaseWindowName}"`
      : `range from ${from ?? "start"} to ${to ?? "end"}`;
    throw new Error(`Source readiness audit selected zero weeks for ${scope}. Refusing to pass an empty audit.`);
  }

  if (!releaseWindow) return;

  const selected = new Set(weeks);
  const expected = releaseWindow.expectedWeeks;
  const expectedSet = new Set(expected);
  const missing = expected.filter((week) => !selected.has(week));
  const extra = weeks.filter((week) => !expectedSet.has(week));

  if (missing.length > 0 || extra.length > 0 || weeks.length !== expected.length) {
    const detail = [
      `expected ${expected.length} week(s)`,
      `selected ${weeks.length}`,
      missing.length > 0 ? `missing: ${missing.join(", ")}` : null,
      extra.length > 0 ? `extra: ${extra.join(", ")}` : null,
    ].filter(Boolean).join("; ");
    throw new Error(`Release window "${releaseWindowName}" resolved to the wrong week set (${detail}).`);
  }
}

function resolveWeekBound(input: string | null, availableWeeks: string[]) {
  if (!input) return null;
  const exact = availableWeeks.find((week) => week === input);
  if (exact) return exact;
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(input)
    ? availableWeeks.find((week) => week.startsWith(input))
    : null;
  if (dateOnly) return dateOnly;
  return normalizeWeekOpenUtc(input) ?? input;
}

export function describeAuditScope(args: Pick<Args, "week" | "from" | "to" | "releaseWindow" | "weeks">) {
  if (args.releaseWindow) {
    const releaseGate = args.releaseWindow === "v2.0.3";
    return {
      label: `release-window:${args.releaseWindow}`,
      releaseGate,
      warning: releaseGate ? null : `Named source window "${args.releaseWindow}" is a probe only. For release approval use --release-window=v2.0.3.`,
    };
  }

  if (args.week) {
    return {
      label: `single-week:${args.week}`,
      releaseGate: false,
      warning: "Single-week source probe only. Do not cite as release approval.",
    };
  }

  if (args.from || args.to) {
    return {
      label: `explicit-range:${args.from ?? "start"}..${args.to ?? "end"}`,
      releaseGate: false,
      warning: "Explicit-range source probe only unless tied to a named release window. Do not cite as release approval.",
    };
  }

  return {
    label: `latest-${args.weeks}-closed-weeks`,
    releaseGate: false,
    warning: `Latest-${args.weeks} closed-week source probe only. For release approval use --release-window=v2.0.3.`,
  };
}

function printHumanSummary(rows: SourceReadinessAuditRow[], verbose: boolean, scope: ReturnType<typeof describeAuditScope>) {
  console.log("Source Completion + Readiness Verification");
  console.log("==========================================");
  console.log(`Scope: ${scope.label}${scope.releaseGate ? " (release gate)" : " (probe)"}`);
  if (scope.warning) {
    console.log(`Warning: ${scope.warning}`);
  }
  console.log(`Universe: ${EXPECTED_PAIRS.length} pairs`);
  console.log(`Rows: ${rows.length}`);
  console.log("");
  console.log("week | source | completion | readiness | trusted | incidents");

  for (const row of rows) {
    const incidents = verbose ? row.incidents : blockingIncidents(row.incidents);
    console.log(
      `${row.weekOpenUtc.slice(0, 10)} | ${row.source.padEnd(10)} | ${row.completion} | ${row.readiness} | ${row.trusted} | ${incidents.length}`,
    );
    for (const incident of incidents) {
      const pair = incident.pair ? `${incident.pair} ` : "";
      console.log(`  - [${incident.severity}] ${incident.code} ${pair}${incident.message}`);
    }
  }

  console.log("==========================================");
}

async function main() {
  const args = parseArgs();
  const weeks = await resolveWeeks(args);
  const releaseWindow = args.releaseWindow ? RELEASE_WINDOWS[args.releaseWindow] : null;
  validateResolvedWeeks({
    weeks,
    releaseWindowName: args.releaseWindow,
    releaseWindow,
    from: args.from,
    to: args.to,
  });
  const scope = describeAuditScope(args);
  const rows: SourceReadinessAuditRow[] = [];

  for (const weekOpenUtc of weeks) {
    const basket = await getCanonicalBasketWeek(weekOpenUtc);
    for (const model of MODELS) {
      const modelRows = basket.signals.filter((row) => row.model === model);
      rows.push(await auditModel(weekOpenUtc, model, modelRows));
    }
  }

  if (args.json) {
    console.log(JSON.stringify({ schema: "source-readiness-audit-v1", scope, rows }, null, 2));
  } else {
    printHumanSummary(rows, args.verbose, scope);
  }

  const untrusted = rows.filter((row) => !row.trusted);
  if (untrusted.length > 0 && !args.allowUntrusted) {
    throw new Error(`Source readiness audit failed with ${untrusted.length} untrusted source row(s).`);
  }

  if (!args.json) {
    console.log("All audited sources are complete and trusted.");
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.stack ?? error.message : String(error));
    process.exit(1);
  });
}
