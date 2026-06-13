import { createHash } from "node:crypto";

import { DateTime } from "luxon";

import { derivePairDirectionsByBaseWithNeutral, derivePairDirectionsWithNeutral } from "@/lib/cotCompute";
import { COT_VARIANT, type AssetClass } from "@/lib/cotMarkets";
import { PAIRS_BY_ASSET_CLASS } from "@/lib/cotPairs";
import { readSnapshot } from "@/lib/cotStore";
import { deriveCotReportDate } from "@/lib/dataSectionWeeks";
import { dbTimestampValueToIsoUtc } from "@/lib/dbUtcTimestamp";
import { query, transaction } from "@/lib/db";
import type { BaseBasketModel, BasketDirection, CanonicalBasketSignal, CanonicalBasketWeek } from "@/lib/performance/basketSource";
import { resolveSentimentDirectionFromRows } from "@/lib/sentiment/resolver";
import type { SentimentAggregate } from "@/lib/sentiment/types";
import { readCanonicalStrengthDirectionsAtCutoff } from "@/lib/strength/canonicalDirection";
import { normalizeWeekOpenUtc } from "@/lib/weekAnchor";
import {
  getFridayFreezeTargetUtc,
  SENTIMENT_FRIDAY_CLOSE_SOURCE_VERSION,
  SOURCE_FREEZE_LOCAL_HOUR,
  SOURCE_FREEZE_ZONE,
  STRENGTH_FRIDAY_CLOSE_SOURCE_VERSION,
} from "./fridayFreeze";

export const FRIDAY_FREEZE_LEDGER_VERSION = "friday_close_v1";
export const COT_SOURCE_VERSION = "cot_report_date_v1";

export type SourceEvidenceClass = "cot_snapshot" | "aggregate_derived" | "computed_price_strength";
export type SourceTrustClass = "trusted_raw" | "trusted_aggregate_derived" | "trusted_computed" | "untrusted";

export type FrozenSourceSignal = CanonicalBasketSignal & {
  ledgerVersion: string;
  sourceVersion: string;
  freezeTargetUtc: string;
  sourceTimestampUtc: string | null;
  evidenceClass: SourceEvidenceClass;
  trustClass: SourceTrustClass;
  complete: boolean;
  trustedForFreeze: boolean;
  incidents: string[];
};

export type FrozenSourceSummary = {
  source: BaseBasketModel;
  sourceVersion: string;
  expectedRows: number;
  resolvedRows: number;
  evidenceClass: SourceEvidenceClass;
  trustClass: SourceTrustClass;
  complete: boolean;
  trustedForFreeze: boolean;
  incidents: string[];
};

export type FrozenSourceLedgerWeek = Omit<CanonicalBasketWeek, "signals"> & {
  ledgerVersion: string;
  releaseWindow: string;
  freezeTargetUtc: string;
  freezeZone: string;
  freezeLocalHour: number;
  complete: boolean;
  trustedForFreeze: boolean;
  sourceHash: string;
  summaries: FrozenSourceSummary[];
  signals: FrozenSourceSignal[];
};

export type FrozenSourceLedgerWeekSummary = {
  weekOpenUtc: string;
  ledgerVersion: string;
  releaseWindow: string;
  freezeTargetUtc: string;
  complete: boolean;
  trustedForFreeze: boolean;
  sourceHash: string;
  summaries: FrozenSourceSummary[];
};

type SentimentAggregateRow = {
  symbol: string;
  timestamp_utc: string;
  agg_long_pct: number | string | null;
  agg_short_pct: number | string | null;
  agg_net: number | string | null;
  sources_used: string[] | string | null;
  confidence_score: number | string | null;
  crowding_state: SentimentAggregate["crowding_state"];
  flip_state: SentimentAggregate["flip_state"];
};

type FrozenSignalRow = {
  week_open_utc: string;
  ledger_version: string;
  source: BaseBasketModel;
  symbol: string;
  asset_class: AssetClass;
  direction: BasketDirection;
  source_report_date: string | null;
  source_version: string;
  freeze_target_utc: string;
  source_timestamp_utc: string | null;
  evidence_class: SourceEvidenceClass;
  trust_class: SourceTrustClass;
  complete: boolean;
  trusted_for_freeze: boolean;
  incidents: string[] | null;
  metadata: Record<string, unknown> | null;
};

type FrozenWeekRow = {
  week_open_utc: string;
  ledger_version: string;
  release_window: string;
  freeze_target_utc: string;
  complete: boolean;
  trusted_for_freeze: boolean;
  source_hash: string;
  summaries: FrozenSourceSummary[] | null;
};

let ensuredSourceFreezeLedgerSchema = false;

function toIsoUtc(value: Date | string | null): string | null {
  if (!value) return null;
  return dbTimestampValueToIsoUtc(value);
}

function toIsoDate(value: Date | string | null): string | null {
  if (!value) return null;
  const parsed = value instanceof Date
    ? DateTime.fromJSDate(value)
    : DateTime.fromISO(String(value), { zone: "utc" });
  if (parsed.isValid) return parsed.toISODate();
  return String(value).slice(0, 10);
}

function toNumber(value: number | string | null): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeSourcesUsed(value: string[] | string | null): SentimentAggregate["sources_used"] {
  if (Array.isArray(value)) return value as SentimentAggregate["sources_used"];
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return String(value).split(",").map((item) => item.trim()).filter(Boolean) as SentimentAggregate["sources_used"];
  }
}

function normalizeLedgerWeekOpen(weekOpenUtc: string) {
  return normalizeWeekOpenUtc(weekOpenUtc) ?? weekOpenUtc;
}

function previousWeekOpenUtc(weekOpenUtc: string, weeksBack: number) {
  const parsed = DateTime.fromISO(weekOpenUtc, { zone: "utc" });
  if (!parsed.isValid) return weekOpenUtc;
  return parsed.setZone(SOURCE_FREEZE_ZONE).minus({ weeks: weeksBack }).toUTC().toISO() ?? weekOpenUtc;
}

function lagMinutes(targetUtc: string, sourceUtc: string | null) {
  if (!sourceUtc) return null;
  const target = DateTime.fromISO(targetUtc, { zone: "utc" });
  const source = DateTime.fromISO(sourceUtc, { zone: "utc" });
  if (!target.isValid || !source.isValid) return null;
  return target.diff(source, "minutes").minutes;
}

function expectedPairDefinitions() {
  return (Object.entries(PAIRS_BY_ASSET_CLASS) as Array<[AssetClass, typeof PAIRS_BY_ASSET_CLASS[AssetClass]]>)
    .flatMap(([assetClass, pairs]) => pairs.map((pair) => ({ assetClass, pair })));
}

async function readCotSnapshotSavedUtc(assetClass: AssetClass, reportDate: string): Promise<string | null> {
  const rows = await query<{ saved_utc: string | null }>(
    `SELECT created_at::text AS saved_utc
       FROM cot_snapshots
      WHERE asset_class = $1
        AND variant = $2
        AND report_date = $3::date
      LIMIT 1`,
    [assetClass, COT_VARIANT, reportDate],
  );
  return toIsoUtc(rows[0]?.saved_utc ?? null);
}

function sourceHash(signals: FrozenSourceSignal[]) {
  const stable = signals
    .map((signal) => ({
      weekOpenUtc: signal.weekOpenUtc,
      model: signal.model,
      symbol: signal.symbol,
      assetClass: signal.assetClass,
      direction: signal.direction,
      sourceVersion: signal.sourceVersion,
      freezeTargetUtc: signal.freezeTargetUtc,
      sourceTimestampUtc: signal.sourceTimestampUtc,
      evidenceClass: signal.evidenceClass,
      trustClass: signal.trustClass,
      complete: signal.complete,
      trustedForFreeze: signal.trustedForFreeze,
      incidents: signal.incidents,
      metadata: signal.metadata ?? {},
    }))
    .sort((a, b) => `${a.weekOpenUtc}:${a.model}:${a.symbol}`.localeCompare(`${b.weekOpenUtc}:${b.model}:${b.symbol}`));
  return createHash("sha256").update(JSON.stringify(stable)).digest("hex");
}

export async function ensureSourceFreezeLedgerSchema(): Promise<void> {
  if (ensuredSourceFreezeLedgerSchema) return;
  await query(`
    CREATE TABLE IF NOT EXISTS source_freeze_ledger_weeks (
      week_open_utc TIMESTAMP NOT NULL,
      ledger_version TEXT NOT NULL,
      release_window TEXT NOT NULL,
      freeze_target_utc TIMESTAMP NOT NULL,
      freeze_zone TEXT NOT NULL,
      freeze_local_hour INTEGER NOT NULL,
      complete BOOLEAN NOT NULL,
      trusted_for_freeze BOOLEAN NOT NULL,
      source_hash TEXT NOT NULL,
      summaries JSONB NOT NULL DEFAULT '[]'::jsonb,
      built_at_utc TIMESTAMP NOT NULL DEFAULT (NOW() AT TIME ZONE 'UTC'),
      updated_at_utc TIMESTAMP NOT NULL DEFAULT (NOW() AT TIME ZONE 'UTC'),
      PRIMARY KEY (week_open_utc, ledger_version)
    )
  `);
  await query(`
    CREATE TABLE IF NOT EXISTS source_freeze_ledger_signals (
      week_open_utc TIMESTAMP NOT NULL,
      ledger_version TEXT NOT NULL,
      source TEXT NOT NULL,
      symbol TEXT NOT NULL,
      asset_class TEXT NOT NULL,
      direction TEXT NOT NULL,
      source_report_date DATE,
      source_version TEXT NOT NULL,
      freeze_target_utc TIMESTAMP NOT NULL,
      source_timestamp_utc TIMESTAMP,
      evidence_class TEXT NOT NULL,
      trust_class TEXT NOT NULL,
      complete BOOLEAN NOT NULL,
      trusted_for_freeze BOOLEAN NOT NULL,
      incidents TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      updated_at_utc TIMESTAMP NOT NULL DEFAULT (NOW() AT TIME ZONE 'UTC'),
      PRIMARY KEY (week_open_utc, ledger_version, source, symbol)
    )
  `);
  await query(`
    CREATE INDEX IF NOT EXISTS idx_source_freeze_ledger_signals_week
      ON source_freeze_ledger_signals(week_open_utc DESC, ledger_version, source)
  `);
  ensuredSourceFreezeLedgerSchema = true;
}

async function buildCotSignals(
  weekOpenUtc: string,
  freezeTargetUtc: string,
  model: "dealer" | "commercial",
): Promise<{ signals: FrozenSourceSignal[]; summary: FrozenSourceSummary }> {
  const reportDate = deriveCotReportDate(weekOpenUtc);
  const signals: FrozenSourceSignal[] = [];
  const missingSnapshots: string[] = [];

  for (const assetClass of Object.keys(PAIRS_BY_ASSET_CLASS) as AssetClass[]) {
    const pairDefs = PAIRS_BY_ASSET_CLASS[assetClass] ?? [];
    const snapshot = await readSnapshot({ assetClass, reportDate });
    if (!snapshot) {
      missingSnapshots.push(assetClass);
      for (const pairDef of pairDefs) {
        signals.push({
          weekOpenUtc,
          ledgerVersion: FRIDAY_FREEZE_LEDGER_VERSION,
          freezeTargetUtc,
          model,
          symbol: pairDef.pair.toUpperCase(),
          assetClass,
          direction: "NEUTRAL",
          sourceReportDate: reportDate,
          sourceVersion: COT_SOURCE_VERSION,
          sourceTimestampUtc: null,
          evidenceClass: "cot_snapshot",
          trustClass: "untrusted",
          complete: false,
          trustedForFreeze: false,
          incidents: [`missing_cot_snapshot:${assetClass}:${reportDate}`],
          metadata: { freezePolicy: "friday_1700_america_new_york" },
        });
      }
      continue;
    }

    const snapshotSavedUtc = await readCotSnapshotSavedUtc(assetClass, reportDate);
    const derivedPairs = assetClass === "fx"
      ? derivePairDirectionsWithNeutral(snapshot.currencies, pairDefs, model)
      : derivePairDirectionsByBaseWithNeutral(snapshot.currencies, pairDefs, model);

    for (const pairDef of pairDefs) {
      const derived = derivedPairs[pairDef.pair];
      signals.push({
        weekOpenUtc,
        ledgerVersion: FRIDAY_FREEZE_LEDGER_VERSION,
        freezeTargetUtc,
        model,
        symbol: pairDef.pair.toUpperCase(),
        assetClass,
        direction: (derived?.direction as BasketDirection) ?? "NEUTRAL",
        sourceReportDate: reportDate,
        sourceVersion: COT_SOURCE_VERSION,
        sourceTimestampUtc: snapshotSavedUtc ?? snapshot.last_refresh_utc ?? null,
        evidenceClass: "cot_snapshot",
        trustClass: "trusted_raw",
        complete: true,
        trustedForFreeze: true,
        incidents: derived ? [] : [`no_cot_derivation:${pairDef.pair}`],
        metadata: {
          reportDate,
          lastRefreshUtc: snapshot.last_refresh_utc,
          savedAtUtc: snapshotSavedUtc,
          freezePolicy: "friday_1700_america_new_york",
        },
      });
    }
  }

  return {
    signals,
    summary: {
      source: model,
      sourceVersion: COT_SOURCE_VERSION,
      expectedRows: Object.keys(PAIRS_BY_ASSET_CLASS).length,
      resolvedRows: Object.keys(PAIRS_BY_ASSET_CLASS).length - missingSnapshots.length,
      evidenceClass: "cot_snapshot",
      trustClass: missingSnapshots.length === 0 ? "trusted_raw" : "untrusted",
      complete: missingSnapshots.length === 0,
      trustedForFreeze: missingSnapshots.length === 0,
      incidents: missingSnapshots.map((assetClass) => `missing_cot_snapshot:${assetClass}:${reportDate}`),
    },
  };
}

async function readSentimentAggregateMapAtCutoff(cutoffUtc: string): Promise<Map<string, SentimentAggregate>> {
  const rows = await query<SentimentAggregateRow>(
    `SELECT DISTINCT ON (symbol)
            symbol,
            timestamp_utc::text AS timestamp_utc,
            agg_long_pct,
            agg_short_pct,
            agg_net,
            sources_used,
            confidence_score,
            crowding_state,
            flip_state
       FROM sentiment_aggregates
      WHERE timestamp_utc <= ($1::timestamptz AT TIME ZONE 'UTC')
      ORDER BY symbol, timestamp_utc DESC`,
    [cutoffUtc],
  );

  return new Map(rows.map((row) => [
    row.symbol.toUpperCase(),
    {
      symbol: row.symbol.toUpperCase(),
      timestamp_utc: toIsoUtc(row.timestamp_utc) ?? cutoffUtc,
      agg_long_pct: toNumber(row.agg_long_pct),
      agg_short_pct: toNumber(row.agg_short_pct),
      agg_net: toNumber(row.agg_net),
      sources_used: normalizeSourcesUsed(row.sources_used),
      confidence_score: toNumber(row.confidence_score),
      crowding_state: row.crowding_state,
      flip_state: row.flip_state,
    } satisfies SentimentAggregate,
  ] as const));
}

async function readRawProviderSymbolCount(cutoffUtc: string) {
  const rows = await query<{ symbol: string }>(
    `SELECT DISTINCT symbol
       FROM sentiment_data
      WHERE timestamp_utc <= ($1::timestamptz AT TIME ZONE 'UTC')
        AND timestamp_utc >= (($1::timestamptz AT TIME ZONE 'UTC') - INTERVAL '120 minutes')`,
    [cutoffUtc],
  );
  return new Set(rows.map((row) => row.symbol.toUpperCase()));
}

async function buildSentimentSignals(
  weekOpenUtc: string,
  freezeTargetUtc: string,
): Promise<{ signals: FrozenSourceSignal[]; summary: FrozenSourceSummary }> {
  const current = await readSentimentAggregateMapAtCutoff(freezeTargetUtc);
  const prior1WeekOpenUtc = previousWeekOpenUtc(weekOpenUtc, 1);
  const prior2WeekOpenUtc = previousWeekOpenUtc(weekOpenUtc, 2);
  const prior1 = await readSentimentAggregateMapAtCutoff(getFridayFreezeTargetUtc(prior1WeekOpenUtc));
  const prior2 = await readSentimentAggregateMapAtCutoff(getFridayFreezeTargetUtc(prior2WeekOpenUtc));
  const rawSymbols = await readRawProviderSymbolCount(freezeTargetUtc);
  const signals: FrozenSourceSignal[] = [];
  const missingAggregateSymbols: string[] = [];
  const staleAggregateSymbols: string[] = [];

  for (const { assetClass, pair } of expectedPairDefinitions()) {
    const symbol = pair.pair.toUpperCase();
    const currentAgg = current.get(symbol) ?? null;
    const prior1Agg = prior1.get(symbol) ?? null;
    const prior2Agg = prior2.get(symbol) ?? null;
    if (!currentAgg) {
      missingAggregateSymbols.push(symbol);
    }
    const currentLagMinutes = lagMinutes(freezeTargetUtc, currentAgg?.timestamp_utc ?? null);
    const stale = currentLagMinutes !== null && currentLagMinutes > 120;
    if (stale) {
      staleAggregateSymbols.push(symbol);
    }
    const resolved = resolveSentimentDirectionFromRows({
      symbol,
      assetClass,
      currentAgg,
      prior1Agg,
      prior2Agg,
    });
    const hasRawProviderEvidence = rawSymbols.has(symbol);
    const complete = Boolean(currentAgg) && !stale;

    signals.push({
      weekOpenUtc,
      ledgerVersion: FRIDAY_FREEZE_LEDGER_VERSION,
      freezeTargetUtc,
      model: "sentiment",
      symbol,
      assetClass,
      direction: complete ? resolved.direction : "SHORT",
      sourceReportDate: null,
      sourceVersion: SENTIMENT_FRIDAY_CLOSE_SOURCE_VERSION,
      sourceTimestampUtc: currentAgg?.timestamp_utc ?? null,
      evidenceClass: "aggregate_derived",
      trustClass: complete ? "trusted_aggregate_derived" : "untrusted",
      complete,
      trustedForFreeze: complete,
      incidents: [
        currentAgg ? null : `missing_friday_aggregate:${symbol}`,
        stale ? `stale_friday_aggregate:${symbol}:lagMinutes=${currentLagMinutes?.toFixed(1)}` : null,
        hasRawProviderEvidence ? null : `raw_provider_evidence_missing:${symbol}`,
      ].filter((value): value is string => Boolean(value)),
      metadata: {
        tier: resolved.tier,
        tierFSubStep: resolved.tierFSubStep ?? null,
        aggLongPct: resolved.aggLongPct,
        crowdingState: resolved.crowdingState,
        flipState: resolved.flipState,
        sourceTiming: "friday_1700_america_new_york",
        evidenceNote: "aggregate_derived_not_raw_myfxbook_recovery",
        lagMinutes: currentLagMinutes,
        rawProviderEvidencePresent: hasRawProviderEvidence,
        prior1WeekOpenUtc,
        prior2WeekOpenUtc,
        prior1TimestampUtc: prior1Agg?.timestamp_utc ?? null,
        prior2TimestampUtc: prior2Agg?.timestamp_utc ?? null,
      },
    });
  }

  const missingRawCount = expectedPairDefinitions().length - rawSymbols.size;
  const complete = missingAggregateSymbols.length === 0 && staleAggregateSymbols.length === 0;

  return {
    signals,
    summary: {
      source: "sentiment",
      sourceVersion: SENTIMENT_FRIDAY_CLOSE_SOURCE_VERSION,
      expectedRows: expectedPairDefinitions().length,
      resolvedRows: current.size,
      evidenceClass: "aggregate_derived",
      trustClass: complete ? "trusted_aggregate_derived" : "untrusted",
      complete,
      trustedForFreeze: complete,
      incidents: [
        ...missingAggregateSymbols.map((symbol) => `missing_friday_aggregate:${symbol}`),
        ...staleAggregateSymbols.map((symbol) => `stale_friday_aggregate:${symbol}`),
        missingRawCount > 0 ? `raw_provider_evidence_missing:${rawSymbols.size}/${expectedPairDefinitions().length}` : null,
      ].filter((value): value is string => Boolean(value)),
    },
  };
}

async function buildStrengthSignals(
  weekOpenUtc: string,
  freezeTargetUtc: string,
): Promise<{ signals: FrozenSourceSignal[]; summary: FrozenSourceSummary }> {
  const rows = await readCanonicalStrengthDirectionsAtCutoff(weekOpenUtc, freezeTargetUtc);
  const signals = rows.map((row): FrozenSourceSignal => {
    const complete = row.availableWindows === 3 && Boolean(row.latestSnapshotUtc);
    return {
      weekOpenUtc,
      ledgerVersion: FRIDAY_FREEZE_LEDGER_VERSION,
      freezeTargetUtc,
      model: "strength",
      symbol: row.pair,
      assetClass: row.assetClass,
      direction: row.direction,
      sourceReportDate: null,
      sourceVersion: STRENGTH_FRIDAY_CLOSE_SOURCE_VERSION,
      sourceTimestampUtc: row.latestSnapshotUtc,
      evidenceClass: "computed_price_strength",
      trustClass: complete ? "trusted_computed" : "untrusted",
      complete,
      trustedForFreeze: complete,
      incidents: [
        row.availableWindows < 3 ? `missing_strength_windows:${row.availableWindows}/3` : null,
        row.latestSnapshotUtc ? null : "missing_strength_snapshot",
      ].filter((value): value is string => Boolean(value)),
      metadata: {
        availableWindows: row.availableWindows,
        compositeScore: row.compositeScore,
        latestSnapshotUtc: row.latestSnapshotUtc,
        raw1w: row.raw1w,
        raw1m: row.raw1m,
        missingStoredPriorWeeks: row.missingStoredPriorWeeks,
        providerFallbackAttempted: row.providerFallbackAttempted,
        providerFallbackUsed: row.providerFallbackUsed,
        fallbackBranch: row.fallbackBranch,
        sourceTiming: "friday_1700_america_new_york",
      },
    };
  });
  const incidents = signals.flatMap((signal) => signal.incidents.map((incident) => `${signal.symbol}:${incident}`));
  const complete = signals.length === expectedPairDefinitions().length && incidents.length === 0;

  return {
    signals,
    summary: {
      source: "strength",
      sourceVersion: STRENGTH_FRIDAY_CLOSE_SOURCE_VERSION,
      expectedRows: expectedPairDefinitions().length,
      resolvedRows: signals.length,
      evidenceClass: "computed_price_strength",
      trustClass: complete ? "trusted_computed" : "untrusted",
      complete,
      trustedForFreeze: complete,
      incidents,
    },
  };
}

export async function buildFrozenSourceLedgerWeek(
  weekOpenUtc: string,
  releaseWindow = "v2.0.3-clean-14w",
): Promise<FrozenSourceLedgerWeek> {
  const normalizedWeekOpenUtc = normalizeLedgerWeekOpen(weekOpenUtc);
  const freezeTargetUtc = getFridayFreezeTargetUtc(normalizedWeekOpenUtc);
  const [dealer, commercial, sentiment, strength] = await Promise.all([
    buildCotSignals(normalizedWeekOpenUtc, freezeTargetUtc, "dealer"),
    buildCotSignals(normalizedWeekOpenUtc, freezeTargetUtc, "commercial"),
    buildSentimentSignals(normalizedWeekOpenUtc, freezeTargetUtc),
    buildStrengthSignals(normalizedWeekOpenUtc, freezeTargetUtc),
  ]);
  const signals = [...dealer.signals, ...commercial.signals, ...sentiment.signals, ...strength.signals]
    .sort((a, b) => `${a.model}:${a.assetClass}:${a.symbol}`.localeCompare(`${b.model}:${b.assetClass}:${b.symbol}`));
  const summaries = [dealer.summary, commercial.summary, sentiment.summary, strength.summary];
  const complete = summaries.every((summary) => summary.complete);
  const trustedForFreeze = summaries.every((summary) => summary.trustedForFreeze);
  const hash = sourceHash(signals);

  return {
    weekOpenUtc: normalizedWeekOpenUtc,
    ledgerVersion: FRIDAY_FREEZE_LEDGER_VERSION,
    releaseWindow,
    freezeTargetUtc,
    freezeZone: SOURCE_FREEZE_ZONE,
    freezeLocalHour: SOURCE_FREEZE_LOCAL_HOUR,
    complete,
    trustedForFreeze,
    sourceHash: hash,
    summaries,
    signals,
  };
}

export async function persistFrozenSourceLedgerWeek(ledger: FrozenSourceLedgerWeek): Promise<void> {
  await ensureSourceFreezeLedgerSchema();
  await transaction(async (client) => {
    await client.query(
      `DELETE FROM source_freeze_ledger_signals
        WHERE week_open_utc = ($1::timestamptz AT TIME ZONE 'UTC')
          AND ledger_version = $2`,
      [ledger.weekOpenUtc, ledger.ledgerVersion],
    );

    for (const signal of ledger.signals) {
      await client.query(
        `INSERT INTO source_freeze_ledger_signals (
           week_open_utc,
           ledger_version,
           source,
           symbol,
           asset_class,
           direction,
           source_report_date,
           source_version,
           freeze_target_utc,
           source_timestamp_utc,
           evidence_class,
           trust_class,
           complete,
           trusted_for_freeze,
           incidents,
           metadata,
           updated_at_utc
         )
         VALUES (
           ($1::timestamptz AT TIME ZONE 'UTC'),
           $2,
           $3,
           $4,
           $5,
           $6,
           $7::date,
           $8,
           ($9::timestamptz AT TIME ZONE 'UTC'),
           ($10::timestamptz AT TIME ZONE 'UTC'),
           $11,
           $12,
           $13,
           $14,
           $15::text[],
           $16::jsonb,
           (NOW() AT TIME ZONE 'UTC')
         )`,
        [
          ledger.weekOpenUtc,
          ledger.ledgerVersion,
          signal.model,
          signal.symbol,
          signal.assetClass,
          signal.direction,
          signal.sourceReportDate ?? null,
          signal.sourceVersion,
          signal.freezeTargetUtc,
          signal.sourceTimestampUtc,
          signal.evidenceClass,
          signal.trustClass,
          signal.complete,
          signal.trustedForFreeze,
          signal.incidents,
          JSON.stringify(signal.metadata ?? {}),
        ],
      );
    }

    await client.query(
      `INSERT INTO source_freeze_ledger_weeks (
         week_open_utc,
         ledger_version,
         release_window,
         freeze_target_utc,
         freeze_zone,
         freeze_local_hour,
         complete,
         trusted_for_freeze,
         source_hash,
         summaries,
         built_at_utc,
         updated_at_utc
       )
       VALUES (
         ($1::timestamptz AT TIME ZONE 'UTC'),
         $2,
         $3,
         ($4::timestamptz AT TIME ZONE 'UTC'),
         $5,
         $6,
         $7,
         $8,
         $9,
         $10::jsonb,
         (NOW() AT TIME ZONE 'UTC'),
         (NOW() AT TIME ZONE 'UTC')
       )
       ON CONFLICT (week_open_utc, ledger_version)
       DO UPDATE SET
         release_window = EXCLUDED.release_window,
         freeze_target_utc = EXCLUDED.freeze_target_utc,
         freeze_zone = EXCLUDED.freeze_zone,
         freeze_local_hour = EXCLUDED.freeze_local_hour,
         complete = EXCLUDED.complete,
         trusted_for_freeze = EXCLUDED.trusted_for_freeze,
         source_hash = EXCLUDED.source_hash,
         summaries = EXCLUDED.summaries,
         updated_at_utc = (NOW() AT TIME ZONE 'UTC')`,
      [
        ledger.weekOpenUtc,
        ledger.ledgerVersion,
        ledger.releaseWindow,
        ledger.freezeTargetUtc,
        ledger.freezeZone,
        ledger.freezeLocalHour,
        ledger.complete,
        ledger.trustedForFreeze,
        ledger.sourceHash,
        JSON.stringify(ledger.summaries),
      ],
    );
  });
}

export async function buildAndPersistFrozenSourceLedgerWeeks(
  weekOpenUtcs: readonly string[],
  releaseWindow = "v2.0.3-clean-14w",
): Promise<FrozenSourceLedgerWeek[]> {
  const ledgers: FrozenSourceLedgerWeek[] = [];
  for (const weekOpenUtc of weekOpenUtcs) {
    const ledger = await buildFrozenSourceLedgerWeek(weekOpenUtc, releaseWindow);
    await persistFrozenSourceLedgerWeek(ledger);
    ledgers.push(ledger);
  }
  return ledgers;
}

export async function readFrozenSourceLedgerWeek(
  weekOpenUtc: string,
  ledgerVersion = FRIDAY_FREEZE_LEDGER_VERSION,
): Promise<FrozenSourceLedgerWeek | null> {
  const normalizedWeekOpenUtc = normalizeLedgerWeekOpen(weekOpenUtc);
  await ensureSourceFreezeLedgerSchema();
  const weeks = await query<FrozenWeekRow>(
    `SELECT week_open_utc::text AS week_open_utc,
            ledger_version,
            release_window,
            freeze_target_utc::text AS freeze_target_utc,
            complete,
            trusted_for_freeze,
            source_hash,
            summaries
       FROM source_freeze_ledger_weeks
      WHERE week_open_utc = ($1::timestamptz AT TIME ZONE 'UTC')
        AND ledger_version = $2`,
    [normalizedWeekOpenUtc, ledgerVersion],
  );
  const week = weeks[0];
  if (!week || !week.complete || !week.trusted_for_freeze) {
    return null;
  }

  const rows = await query<FrozenSignalRow>(
    `SELECT week_open_utc::text AS week_open_utc,
            ledger_version,
            source,
            symbol,
            asset_class,
            direction,
            source_report_date::text AS source_report_date,
            source_version,
            freeze_target_utc::text AS freeze_target_utc,
            source_timestamp_utc::text AS source_timestamp_utc,
            evidence_class,
            trust_class,
            complete,
            trusted_for_freeze,
            incidents,
            metadata
       FROM source_freeze_ledger_signals
      WHERE week_open_utc = ($1::timestamptz AT TIME ZONE 'UTC')
        AND ledger_version = $2
      ORDER BY source ASC, asset_class ASC, symbol ASC`,
    [normalizedWeekOpenUtc, ledgerVersion],
  );
  if (rows.length !== expectedPairDefinitions().length * 4) {
    return null;
  }

  const signals = rows.map((row): FrozenSourceSignal => ({
    weekOpenUtc: toIsoUtc(row.week_open_utc) ?? normalizedWeekOpenUtc,
    ledgerVersion: row.ledger_version,
    freezeTargetUtc: toIsoUtc(row.freeze_target_utc) ?? "",
    model: row.source,
    symbol: row.symbol.toUpperCase(),
    assetClass: row.asset_class,
    direction: row.direction,
    sourceReportDate: toIsoDate(row.source_report_date),
    sourceVersion: row.source_version,
    sourceTimestampUtc: toIsoUtc(row.source_timestamp_utc),
    evidenceClass: row.evidence_class,
    trustClass: row.trust_class,
    complete: row.complete,
    trustedForFreeze: row.trusted_for_freeze,
    incidents: row.incidents ?? [],
    metadata: {
      ...(row.metadata ?? {}),
      ledgerVersion: row.ledger_version,
      sourceVersion: row.source_version,
      freezeTargetUtc: toIsoUtc(row.freeze_target_utc),
      sourceTimestampUtc: toIsoUtc(row.source_timestamp_utc),
      latestSnapshotUtc: toIsoUtc(row.source_timestamp_utc),
      evidenceClass: row.evidence_class,
      trustClass: row.trust_class,
      complete: row.complete,
      trustedForFreeze: row.trusted_for_freeze,
      incidents: row.incidents ?? [],
    },
  }));

  return {
    weekOpenUtc: toIsoUtc(week.week_open_utc) ?? normalizedWeekOpenUtc,
    ledgerVersion: week.ledger_version,
    releaseWindow: week.release_window,
    freezeTargetUtc: toIsoUtc(week.freeze_target_utc) ?? "",
    freezeZone: SOURCE_FREEZE_ZONE,
    freezeLocalHour: SOURCE_FREEZE_LOCAL_HOUR,
    complete: week.complete,
    trustedForFreeze: week.trusted_for_freeze,
    sourceHash: week.source_hash,
    summaries: week.summaries ?? [],
    signals,
  };
}

export async function readRecentFrozenSourceLedgerWeekSummaries(limit = 8): Promise<FrozenSourceLedgerWeekSummary[]> {
  await ensureSourceFreezeLedgerSchema();
  const safeLimit = Math.max(1, Math.min(52, Math.floor(limit)));
  const rows = await query<FrozenWeekRow>(
    `SELECT week_open_utc::text AS week_open_utc,
            ledger_version,
            release_window,
            freeze_target_utc::text AS freeze_target_utc,
            complete,
            trusted_for_freeze,
            source_hash,
            summaries
       FROM source_freeze_ledger_weeks
      ORDER BY week_open_utc DESC
      LIMIT $1`,
    [safeLimit],
  );

  return rows.map((row) => ({
    weekOpenUtc: toIsoUtc(row.week_open_utc) ?? "",
    ledgerVersion: row.ledger_version,
    releaseWindow: row.release_window,
    freezeTargetUtc: toIsoUtc(row.freeze_target_utc) ?? "",
    complete: row.complete,
    trustedForFreeze: row.trusted_for_freeze,
    sourceHash: row.source_hash,
    summaries: row.summaries ?? [],
  }));
}

export async function readFrozenSourceLedgerWeekSummariesForReleaseWindow(
  releaseWindow: string,
  limit = 52,
): Promise<FrozenSourceLedgerWeekSummary[]> {
  await ensureSourceFreezeLedgerSchema();
  const safeLimit = Math.max(1, Math.min(52, Math.floor(limit)));
  const rows = await query<FrozenWeekRow>(
    `SELECT week_open_utc::text AS week_open_utc,
            ledger_version,
            release_window,
            freeze_target_utc::text AS freeze_target_utc,
            complete,
            trusted_for_freeze,
            source_hash,
            summaries
       FROM source_freeze_ledger_weeks
      WHERE release_window = $1
      ORDER BY week_open_utc ASC
      LIMIT $2`,
    [releaseWindow, safeLimit],
  );

  return rows.map((row) => ({
    weekOpenUtc: toIsoUtc(row.week_open_utc) ?? "",
    ledgerVersion: row.ledger_version,
    releaseWindow: row.release_window,
    freezeTargetUtc: toIsoUtc(row.freeze_target_utc) ?? "",
    complete: row.complete,
    trustedForFreeze: row.trusted_for_freeze,
    sourceHash: row.source_hash,
    summaries: row.summaries ?? [],
  }));
}

export async function readFrozenSourceLedgerWeekSummariesForWeeks(
  weekOpenUtcs: readonly string[],
): Promise<FrozenSourceLedgerWeekSummary[]> {
  await ensureSourceFreezeLedgerSchema();
  const weeks = Array.from(new Set(
    weekOpenUtcs
      .map(normalizeLedgerWeekOpen)
      .filter(Boolean),
  ));
  if (weeks.length === 0) return [];

  const rows = await query<FrozenWeekRow>(
    `SELECT week_open_utc::text AS week_open_utc,
            ledger_version,
            release_window,
            freeze_target_utc::text AS freeze_target_utc,
            complete,
            trusted_for_freeze,
            source_hash,
            summaries
       FROM source_freeze_ledger_weeks
      WHERE week_open_utc = ANY($1::timestamptz[])
      ORDER BY week_open_utc ASC`,
    [weeks],
  );

  return rows.map((row) => ({
    weekOpenUtc: toIsoUtc(row.week_open_utc) ?? "",
    ledgerVersion: row.ledger_version,
    releaseWindow: row.release_window,
    freezeTargetUtc: toIsoUtc(row.freeze_target_utc) ?? "",
    complete: row.complete,
    trustedForFreeze: row.trusted_for_freeze,
    sourceHash: row.source_hash,
    summaries: row.summaries ?? [],
  }));
}
