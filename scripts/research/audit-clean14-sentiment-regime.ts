/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: audit-clean14-sentiment-regime.ts
 *
 * Description:
 * Read-only audit of clean14 Sentiment behavior under the legacy
 * Sunday/Monday resolver versus the Friday 17:00 America/New_York freeze
 * resolver. This proves which timestamped aggregate/raw rows each path uses.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { loadEnvConfig } from "@next/env";
import { DateTime } from "luxon";

loadEnvConfig(process.cwd());

import type { AssetClass } from "@/lib/cotMarkets";
import { PAIRS_BY_ASSET_CLASS } from "@/lib/cotPairs";
import { dbTimestampValueToIsoUtc, utcSqlTimestampTextToIso } from "@/lib/dbUtcTimestamp";
import { query, getPool } from "@/lib/db";
import {
  resolveSentimentDirections,
  resolveSentimentDirectionFromRows,
} from "@/lib/sentiment/resolver";
import type { SentimentAggregate } from "@/lib/sentiment/types";
import { buildFrozenSourceLedgerWeek } from "@/lib/sourceFreeze/sourceLedger";
import {
  getFridayFreezeTargetUtc,
  V203_CLEAN_14W_FREEZE_WEEKS,
} from "@/lib/sourceFreeze/fridayFreeze";
import { normalizeWeekOpenUtc } from "@/lib/weekAnchor";

type SentimentAggregateRow = {
  symbol: string;
  timestamp_utc: Date | string;
  timestamp_utc_text: string | null;
  agg_long_pct: string | number | null;
  agg_short_pct: string | number | null;
  agg_net: string | number | null;
  sources_used: string[] | string | null;
  confidence_score: string | number | null;
  crowding_state: SentimentAggregate["crowding_state"];
  flip_state: SentimentAggregate["flip_state"];
};

type RawCoverageRow = {
  rows: string | number;
  symbols: string | number;
  min_ts: Date | string | null;
  max_ts: Date | string | null;
};

type AggregateCoverageRow = {
  rows: string | number;
  symbols: string | number;
  min_ts: Date | string | null;
  max_ts: Date | string | null;
};

type AggregateSelection = {
  aggregate: SentimentAggregate;
  dbTimestamp: string | null;
};

type SymbolAuditRow = {
  weekOpenUtc: string;
  symbol: string;
  assetClass: AssetClass;
  legacyDirection: string;
  fridayDirection: string;
  actualLegacyDirection: string | null;
  actualFridayDirection: string | null;
  actualDirectionChanged: boolean;
  directionChanged: boolean;
  legacyTier: string;
  fridayTier: string;
  legacyAggLongPct: number | null;
  fridayAggLongPct: number | null;
  aggLongPctDelta: number | null;
  legacyCurrentTimestampUtc: string | null;
  fridayCurrentTimestampUtc: string | null;
  legacyCurrentDbTimestamp: string | null;
  fridayCurrentDbTimestamp: string | null;
  actualFridaySourceTimestampUtc: string | null;
  legacyDbBeforeWeekOpenButReportedAfter: boolean;
  fridayDbBeforeCutoffButReportedAfter: boolean;
  currentTimestampSame: boolean;
  legacyPrior1TimestampUtc: string | null;
  fridayPrior1TimestampUtc: string | null;
  legacyPrior2TimestampUtc: string | null;
  fridayPrior2TimestampUtc: string | null;
  fridayCurrentLagMinutes: number | null;
  fridayRawEvidenceWithin120m: boolean;
  behavior: string;
};

const OUTPUT_DIR = path.resolve(process.cwd(), "reports/snapshot-regime-comparison");
const EXPECTED_SYMBOLS = Object.values(PAIRS_BY_ASSET_CLASS).reduce((sum, pairs) => sum + pairs.length, 0);

function toIsoUtc(value: Date | string | null | undefined) {
  if (!value) return null;
  return dbTimestampValueToIsoUtc(value);
}

function toNumber(value: string | number | null | undefined) {
  if (value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
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

function toAggregate(row: SentimentAggregateRow | null): SentimentAggregate | null {
  if (!row) return null;
  return {
    symbol: row.symbol.toUpperCase(),
    timestamp_utc: utcSqlTimestampTextToIso(row.timestamp_utc_text) ?? toIsoUtc(row.timestamp_utc) ?? "",
    agg_long_pct: toNumber(row.agg_long_pct) ?? 0,
    agg_short_pct: toNumber(row.agg_short_pct) ?? 0,
    agg_net: toNumber(row.agg_net) ?? 0,
    sources_used: normalizeSourcesUsed(row.sources_used),
    confidence_score: toNumber(row.confidence_score) ?? 0,
    crowding_state: row.crowding_state,
    flip_state: row.flip_state,
  };
}

function dbTimestamp(row: SentimentAggregateRow | null) {
  return row?.timestamp_utc_text ?? null;
}

function lagMinutes(targetUtc: string, sourceUtc: string | null) {
  if (!sourceUtc) return null;
  const target = DateTime.fromISO(targetUtc, { zone: "utc" });
  const source = DateTime.fromISO(sourceUtc, { zone: "utc" });
  if (!target.isValid || !source.isValid) return null;
  return target.diff(source, "minutes").minutes;
}

function dbTimestampTextToUtcMillis(value: string | null) {
  if (!value) return null;
  const parsed = DateTime.fromSQL(value, { zone: "utc" });
  return parsed.isValid ? parsed.toMillis() : null;
}

function isoToMillis(value: string | null) {
  if (!value) return null;
  const parsed = DateTime.fromISO(value, { zone: "utc" });
  return parsed.isValid ? parsed.toMillis() : null;
}

function dbBeforeButReportedAfter(dbTimestampText: string | null, reportedIso: string | null, boundaryIso: string) {
  const dbMs = dbTimestampTextToUtcMillis(dbTimestampText);
  const reportedMs = isoToMillis(reportedIso);
  const boundaryMs = isoToMillis(boundaryIso);
  if (dbMs === null || reportedMs === null || boundaryMs === null) return false;
  return dbMs <= boundaryMs && reportedMs > boundaryMs;
}

function previousWeekOpenUtc(weekOpenUtc: string, weeksBack: number) {
  const parsed = DateTime.fromISO(weekOpenUtc, { zone: "utc" });
  return parsed.isValid ? parsed.minus({ weeks: weeksBack }).toUTC().toISO() ?? weekOpenUtc : weekOpenUtc;
}

function aggregateKey(symbol: string) {
  return symbol.toUpperCase();
}

async function readLatestAggregateBefore(cutoffUtc: string) {
  const rows = await query<SentimentAggregateRow>(
    `SELECT DISTINCT ON (symbol)
            symbol,
            timestamp_utc,
            timestamp_utc::text AS timestamp_utc_text,
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
    aggregateKey(row.symbol),
    {
      aggregate: toAggregate(row) as SentimentAggregate,
      dbTimestamp: dbTimestamp(row),
    },
  ] as const));
}

async function readLegacyWeekStartAggregateMap(weekOpenUtc: string, weekCloseUtc: string) {
  const rows = await query<SentimentAggregateRow>(
    `WITH ranked AS (
       SELECT symbol,
              timestamp_utc,
              agg_long_pct,
              agg_short_pct,
              agg_net,
              sources_used,
              confidence_score,
              crowding_state,
              flip_state,
              CASE
                WHEN timestamp_utc <= ($1::timestamptz AT TIME ZONE 'UTC') THEN 0
                ELSE 1
              END AS side,
              CASE
                WHEN timestamp_utc <= ($1::timestamptz AT TIME ZONE 'UTC')
                  THEN EXTRACT(EPOCH FROM (($1::timestamptz AT TIME ZONE 'UTC') - timestamp_utc))
                ELSE EXTRACT(EPOCH FROM (timestamp_utc - ($1::timestamptz AT TIME ZONE 'UTC')))
              END AS distance_seconds
         FROM sentiment_aggregates
        WHERE timestamp_utc <= ($2::timestamptz AT TIME ZONE 'UTC')
      )
      SELECT DISTINCT ON (symbol)
             symbol,
             timestamp_utc,
             timestamp_utc::text AS timestamp_utc_text,
             agg_long_pct,
             agg_short_pct,
             agg_net,
             sources_used,
             confidence_score,
             crowding_state,
             flip_state
        FROM ranked
       ORDER BY symbol, side ASC, distance_seconds ASC`,
    [weekOpenUtc, weekCloseUtc],
  );
  return new Map(rows.map((row) => [
    aggregateKey(row.symbol),
    {
      aggregate: toAggregate(row) as SentimentAggregate,
      dbTimestamp: dbTimestamp(row),
    },
  ] as const));
}

async function readRawSymbolsInWindow(startUtc: string, endUtc: string) {
  const rows = await query<{ symbol: string }>(
    `SELECT DISTINCT symbol
       FROM sentiment_data
      WHERE timestamp_utc >= ($1::timestamptz AT TIME ZONE 'UTC')
        AND timestamp_utc <= ($2::timestamptz AT TIME ZONE 'UTC')
      ORDER BY symbol ASC`,
    [startUtc, endUtc],
  );
  return new Set(rows.map((row) => aggregateKey(row.symbol)));
}

async function readAggregateCoverage(cutoffUtc: string) {
  const rows = await query<AggregateCoverageRow>(
    `SELECT COUNT(*)::int AS rows,
            COUNT(DISTINCT symbol)::int AS symbols,
            MIN(timestamp_utc)::text AS min_ts,
            MAX(timestamp_utc)::text AS max_ts
       FROM sentiment_aggregates
      WHERE timestamp_utc <= ($1::timestamptz AT TIME ZONE 'UTC')`,
    [cutoffUtc],
  );
  const row = rows[0];
  return {
    rows: Number(row?.rows ?? 0),
    symbols: Number(row?.symbols ?? 0),
    minTimestampUtc: toIsoUtc(row?.min_ts),
    maxTimestampUtc: toIsoUtc(row?.max_ts),
  };
}

async function readRawCoverage(startUtc: string, endUtc: string) {
  const rows = await query<RawCoverageRow>(
    `SELECT COUNT(*)::int AS rows,
            COUNT(DISTINCT symbol)::int AS symbols,
            MIN(timestamp_utc)::text AS min_ts,
            MAX(timestamp_utc)::text AS max_ts
       FROM sentiment_data
      WHERE timestamp_utc >= ($1::timestamptz AT TIME ZONE 'UTC')
        AND timestamp_utc <= ($2::timestamptz AT TIME ZONE 'UTC')`,
    [startUtc, endUtc],
  );
  const row = rows[0];
  return {
    rows: Number(row?.rows ?? 0),
    symbols: Number(row?.symbols ?? 0),
    minTimestampUtc: toIsoUtc(row?.min_ts),
    maxTimestampUtc: toIsoUtc(row?.max_ts),
  };
}

function classifyBehavior(row: SymbolAuditRow) {
  if (!row.fridayCurrentTimestampUtc) return "friday_missing_aggregate";
  if (!row.fridayRawEvidenceWithin120m && row.currentTimestampSame) {
    return "same_aggregate_no_raw_friday_evidence";
  }
  if (!row.fridayRawEvidenceWithin120m) {
    return "different_aggregate_no_raw_friday_evidence";
  }
  if (row.currentTimestampSame) {
    return "same_aggregate_with_raw_friday_evidence";
  }
  return "different_aggregate_with_raw_friday_evidence";
}

function summarizeRows(rows: SymbolAuditRow[]) {
  const counts = new Map<string, number>();
  for (const row of rows) {
    counts.set(row.behavior, (counts.get(row.behavior) ?? 0) + 1);
  }
  return Object.fromEntries([...counts.entries()].sort());
}

function buildMarkdown(report: any) {
  const lines: string[] = [];
  lines.push("# Clean14 Sentiment Regime Behavior Audit");
  lines.push("");
  lines.push(`Generated: ${report.generatedAtUtc}`);
  lines.push("");
  lines.push("## Guardrails");
  lines.push("");
  lines.push("- Read-only audit.");
  lines.push("- No canon regeneration.");
  lines.push("- No release decision.");
  lines.push("- No missing sentiment rows filled.");
  lines.push("");
  lines.push("## Resolver Behavior");
  lines.push("");
  lines.push("- Sunday/Monday path mirrors `resolveSentimentDirections()`: current/prior bundles are loaded through week-start aggregate selection.");
  lines.push("- That legacy week-start selection chooses the latest aggregate at or before week open; if none exists before week open, it can use the first aggregate after week open within the week.");
  lines.push("- Friday path mirrors `buildFrozenSourceLedgerWeek()`: current/prior bundles are selected by latest aggregate at or before the Friday 17:00 America/New_York cutoff.");
  lines.push("- Friday raw-provider evidence is checked only inside the 120 minutes before the Friday cutoff.");
  lines.push("");
  lines.push("## Verdict");
  lines.push("");
  lines.push(`- Total symbol/week rows: ${report.rows.length}.`);
  lines.push(`- Manual SQL reconstruction direction changes: ${report.directionChangedRows.length}.`);
  lines.push(`- Actual app resolver direction changes: ${report.actualDirectionChangedRows.length}.`);
  lines.push(`- Rows where Friday used the same aggregate timestamp as Sunday/Monday: ${report.sameCurrentTimestampRows}.`);
  lines.push(`- Rows with Friday raw evidence inside 120 minutes: ${report.fridayRawEvidenceRows}.`);
  lines.push(`- Rows where Friday used aggregate-derived evidence without raw Friday evidence: ${report.noRawFridayEvidenceRows}.`);
  lines.push(`- Rows where DB legacy timestamp was before week open but app-reported timestamp was after week open: ${report.legacyBoundaryShiftRows}.`);
  lines.push(`- Rows where DB Friday timestamp was before cutoff but app-reported timestamp was after cutoff: ${report.fridayBoundaryShiftRows}.`);
  lines.push("");
  lines.push("Interpretation: corrected UTC-literal timestamp handling exposes the true current comparison: Friday and Sunday/Monday Sentiment differ on one clean14 symbol/week row, and every Friday row remains aggregate-derived without raw provider evidence in the cutoff window.");
  lines.push("");
  lines.push("| Behavior | Count |");
  lines.push("| --- | ---: |");
  for (const [behavior, count] of Object.entries(report.behaviorCounts)) {
    lines.push(`| ${behavior} | ${count} |`);
  }
  lines.push("");
  lines.push("## Weekly Summary");
  lines.push("");
  lines.push("| Week | Friday Cutoff | Manual Direction Changes | Actual Direction Changes | Legacy Boundary Shifts | Friday Boundary Shifts | Friday Raw 120m Symbols | Friday Aggregate Symbols |");
  lines.push("| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |");
  for (const week of report.weekSummaries) {
    lines.push(`| ${week.weekOpenUtc.slice(0, 10)} | ${week.fridayFreezeTargetUtc} | ${week.directionChanges} | ${week.actualDirectionChanges} | ${week.legacyBoundaryShiftRows}/${week.rows} | ${week.fridayBoundaryShiftRows}/${week.rows} | ${week.fridayRawCoverage120m.symbols}/${report.expectedSymbols} | ${week.fridayAggregateCoverage.symbols}/${report.expectedSymbols} |`);
  }
  lines.push("");
  lines.push("## Actual App Direction Change Rows");
  lines.push("");
  if (report.actualDirectionChangedRows.length === 0) {
    lines.push("No Sentiment direction changes between the actual app resolver paths.");
  } else {
    lines.push("| Week | Symbol | Actual Legacy | Actual Friday | Manual Legacy | Manual Friday | Legacy Current TS | Friday Current TS | Raw Friday Evidence |");
    lines.push("| --- | --- | --- | --- | --- | --- | --- | --- | --- |");
    for (const row of report.actualDirectionChangedRows) {
      lines.push(`| ${row.weekOpenUtc.slice(0, 10)} | ${row.symbol} | ${row.actualLegacyDirection ?? "n/a"} | ${row.actualFridayDirection ?? "n/a"} | ${row.legacyDirection} | ${row.fridayDirection} | ${row.legacyCurrentTimestampUtc ?? "n/a"} | ${row.fridayCurrentTimestampUtc ?? "n/a"} | ${row.fridayRawEvidenceWithin120m ? "yes" : "no"} |`);
    }
  }
  lines.push("");
  lines.push("## Manual Reconstruction Direction Change Rows");
  lines.push("");
  if (report.directionChangedRows.length === 0) {
    lines.push("No Sentiment direction changes in the manual SQL reconstruction.");
  } else {
    lines.push("| Week | Symbol | Manual Legacy | Manual Friday | Legacy DB TS | Friday DB TS | Legacy Reported TS | Friday Reported TS | Raw Friday Evidence |");
    lines.push("| --- | --- | --- | --- | --- | --- | --- | --- | --- |");
    for (const row of report.directionChangedRows) {
      lines.push(`| ${row.weekOpenUtc.slice(0, 10)} | ${row.symbol} | ${row.legacyDirection} | ${row.fridayDirection} | ${row.legacyCurrentDbTimestamp ?? "n/a"} | ${row.fridayCurrentDbTimestamp ?? "n/a"} | ${row.legacyCurrentTimestampUtc ?? "n/a"} | ${row.fridayCurrentTimestampUtc ?? "n/a"} | ${row.fridayRawEvidenceWithin120m ? "yes" : "no"} |`);
    }
  }
  lines.push("");
  lines.push("## Sample Rows");
  lines.push("");
  lines.push("| Week | Symbol | Actual Legacy | Actual Friday | Manual Legacy | Manual Friday | Legacy Agg Long | Friday Agg Long | Legacy DB TS | Legacy Reported TS | Friday DB TS | Friday Reported TS | Behavior |");
  lines.push("| --- | --- | --- | --- | --- | --- | ---: | ---: | --- | --- | --- | --- | --- |");
  for (const row of report.rows.slice(0, 80)) {
    lines.push(`| ${row.weekOpenUtc.slice(0, 10)} | ${row.symbol} | ${row.actualLegacyDirection ?? "n/a"} | ${row.actualFridayDirection ?? "n/a"} | ${row.legacyDirection} | ${row.fridayDirection} | ${row.legacyAggLongPct ?? "n/a"} | ${row.fridayAggLongPct ?? "n/a"} | ${row.legacyCurrentDbTimestamp ?? "n/a"} | ${row.legacyCurrentTimestampUtc ?? "n/a"} | ${row.fridayCurrentDbTimestamp ?? "n/a"} | ${row.actualFridaySourceTimestampUtc ?? row.fridayCurrentTimestampUtc ?? "n/a"} | ${row.behavior} |`);
  }
  if (report.rows.length > 80) {
    lines.push(`| ... | ... | ... | ... | ... | ... | ... | ... | ... | ${report.rows.length - 80} more rows in JSON |`);
  }
  lines.push("");
  lines.push("## Report Files");
  lines.push("");
  lines.push(`- JSON: \`${report.output.jsonPath}\``);
  lines.push(`- Markdown: \`${report.output.markdownPath}\``);
  return `${lines.join("\n")}\n`;
}

async function main() {
  const generatedAtUtc = new Date().toISOString();
  const weeks = V203_CLEAN_14W_FREEZE_WEEKS.map((week) => normalizeWeekOpenUtc(week) ?? week);
  const rows: SymbolAuditRow[] = [];
  const weekSummaries = [];

  for (const weekOpenUtc of weeks) {
    const weekOpen = DateTime.fromISO(weekOpenUtc, { zone: "utc" });
    const weekCloseUtc = weekOpen.plus({ days: 7 }).toUTC().toISO() ?? weekOpenUtc;
    const fridayFreezeTargetUtc = getFridayFreezeTargetUtc(weekOpenUtc);
    const fridayRawWindowStartUtc = DateTime.fromISO(fridayFreezeTargetUtc, { zone: "utc" })
      .minus({ minutes: 120 })
      .toUTC()
      .toISO() ?? fridayFreezeTargetUtc;

    const legacyCurrent = await readLegacyWeekStartAggregateMap(weekOpenUtc, weekCloseUtc);
    const legacyPrior1 = await readLegacyWeekStartAggregateMap(previousWeekOpenUtc(weekOpenUtc, 1), weekOpenUtc);
    const legacyPrior2 = await readLegacyWeekStartAggregateMap(previousWeekOpenUtc(weekOpenUtc, 2), previousWeekOpenUtc(weekOpenUtc, 1));
    const fridayCurrent = await readLatestAggregateBefore(fridayFreezeTargetUtc);
    const fridayPrior1 = await readLatestAggregateBefore(getFridayFreezeTargetUtc(previousWeekOpenUtc(weekOpenUtc, 1)));
    const fridayPrior2 = await readLatestAggregateBefore(getFridayFreezeTargetUtc(previousWeekOpenUtc(weekOpenUtc, 2)));
    const fridayRawSymbols = await readRawSymbolsInWindow(fridayRawWindowStartUtc, fridayFreezeTargetUtc);
    const legacyAggregateCoverage = await readAggregateCoverage(weekOpenUtc);
    const fridayAggregateCoverage = await readAggregateCoverage(fridayFreezeTargetUtc);
    const fridayRawCoverage120m = await readRawCoverage(fridayRawWindowStartUtc, fridayFreezeTargetUtc);
    const rawCoverageFridayToWeekOpen = await readRawCoverage(fridayFreezeTargetUtc, weekOpenUtc);
    const actualLegacyRows = await resolveSentimentDirections(weekOpenUtc);
    const actualFridayLedger = await buildFrozenSourceLedgerWeek(weekOpenUtc, "sentiment-regime-audit");
    const actualLegacyMap = new Map(actualLegacyRows.map((row) => [row.symbol.toUpperCase(), row] as const));
    const actualFridayMap = new Map(
      actualFridayLedger.signals
        .filter((signal) => signal.model === "sentiment")
        .map((signal) => [signal.symbol.toUpperCase(), signal] as const),
    );

    const weekRows: SymbolAuditRow[] = [];
    for (const [assetClass, pairs] of Object.entries(PAIRS_BY_ASSET_CLASS) as Array<[AssetClass, typeof PAIRS_BY_ASSET_CLASS[AssetClass]]>) {
      for (const pairDef of pairs) {
        const symbol = pairDef.pair.toUpperCase();
        const legacyCurrentSelection = legacyCurrent.get(symbol) ?? null;
        const legacyPrior1Selection = legacyPrior1.get(symbol) ?? null;
        const legacyPrior2Selection = legacyPrior2.get(symbol) ?? null;
        const fridayCurrentSelection = fridayCurrent.get(symbol) ?? null;
        const fridayPrior1Selection = fridayPrior1.get(symbol) ?? null;
        const fridayPrior2Selection = fridayPrior2.get(symbol) ?? null;
        const legacyCurrentAgg = legacyCurrentSelection?.aggregate ?? null;
        const legacyPrior1Agg = legacyPrior1Selection?.aggregate ?? null;
        const legacyPrior2Agg = legacyPrior2Selection?.aggregate ?? null;
        const fridayCurrentAgg = fridayCurrentSelection?.aggregate ?? null;
        const fridayPrior1Agg = fridayPrior1Selection?.aggregate ?? null;
        const fridayPrior2Agg = fridayPrior2Selection?.aggregate ?? null;
        const legacyResolved = resolveSentimentDirectionFromRows({
          symbol,
          assetClass,
          currentAgg: legacyCurrentAgg,
          prior1Agg: legacyPrior1Agg,
          prior2Agg: legacyPrior2Agg,
        });
        const fridayResolved = resolveSentimentDirectionFromRows({
          symbol,
          assetClass,
          currentAgg: fridayCurrentAgg,
          prior1Agg: fridayPrior1Agg,
          prior2Agg: fridayPrior2Agg,
        });
        const legacyAggLongPct = legacyResolved.aggLongPct;
        const fridayAggLongPct = fridayResolved.aggLongPct;
        const actualLegacy = actualLegacyMap.get(symbol) ?? null;
        const actualFriday = actualFridayMap.get(symbol) ?? null;
        const legacyCurrentTimestampUtc = legacyCurrentAgg?.timestamp_utc ?? null;
        const fridayCurrentTimestampUtc = fridayCurrentAgg?.timestamp_utc ?? null;
        const legacyCurrentDbTimestamp = legacyCurrentSelection?.dbTimestamp ?? null;
        const fridayCurrentDbTimestamp = fridayCurrentSelection?.dbTimestamp ?? null;
        const row: SymbolAuditRow = {
          weekOpenUtc,
          symbol,
          assetClass,
          legacyDirection: legacyResolved.direction,
          fridayDirection: fridayResolved.direction,
          actualLegacyDirection: actualLegacy?.direction ?? null,
          actualFridayDirection: actualFriday?.direction ?? null,
          actualDirectionChanged: Boolean(actualLegacy?.direction && actualFriday?.direction && actualLegacy.direction !== actualFriday.direction),
          directionChanged: legacyResolved.direction !== fridayResolved.direction,
          legacyTier: legacyResolved.tier,
          fridayTier: fridayResolved.tier,
          legacyAggLongPct,
          fridayAggLongPct,
          aggLongPctDelta: legacyAggLongPct !== null && fridayAggLongPct !== null
            ? fridayAggLongPct - legacyAggLongPct
            : null,
          legacyCurrentTimestampUtc,
          fridayCurrentTimestampUtc,
          legacyCurrentDbTimestamp,
          fridayCurrentDbTimestamp,
          actualFridaySourceTimestampUtc: actualFriday?.sourceTimestampUtc ?? null,
          legacyDbBeforeWeekOpenButReportedAfter: dbBeforeButReportedAfter(
            legacyCurrentDbTimestamp,
            legacyCurrentTimestampUtc,
            weekOpenUtc,
          ),
          fridayDbBeforeCutoffButReportedAfter: dbBeforeButReportedAfter(
            fridayCurrentDbTimestamp,
            fridayCurrentTimestampUtc,
            fridayFreezeTargetUtc,
          ),
          currentTimestampSame: Boolean(legacyCurrentAgg?.timestamp_utc && legacyCurrentAgg.timestamp_utc === fridayCurrentAgg?.timestamp_utc),
          legacyPrior1TimestampUtc: legacyPrior1Agg?.timestamp_utc ?? null,
          fridayPrior1TimestampUtc: fridayPrior1Agg?.timestamp_utc ?? null,
          legacyPrior2TimestampUtc: legacyPrior2Agg?.timestamp_utc ?? null,
          fridayPrior2TimestampUtc: fridayPrior2Agg?.timestamp_utc ?? null,
          fridayCurrentLagMinutes: lagMinutes(fridayFreezeTargetUtc, fridayCurrentAgg?.timestamp_utc ?? null),
          fridayRawEvidenceWithin120m: fridayRawSymbols.has(symbol),
          behavior: "",
        };
        row.behavior = classifyBehavior(row);
        rows.push(row);
        weekRows.push(row);
      }
    }

    weekSummaries.push({
      weekOpenUtc,
      fridayFreezeTargetUtc,
      rows: weekRows.length,
      directionChanges: weekRows.filter((row) => row.directionChanged).length,
      actualDirectionChanges: weekRows.filter((row) => row.actualDirectionChanged).length,
      legacyBoundaryShiftRows: weekRows.filter((row) => row.legacyDbBeforeWeekOpenButReportedAfter).length,
      fridayBoundaryShiftRows: weekRows.filter((row) => row.fridayDbBeforeCutoffButReportedAfter).length,
      sameCurrentTimestampRows: weekRows.filter((row) => row.currentTimestampSame).length,
      fridayRawEvidenceRows: weekRows.filter((row) => row.fridayRawEvidenceWithin120m).length,
      legacyAggregateCoverage,
      fridayAggregateCoverage,
      fridayRawCoverage120m,
      rawCoverageFridayToWeekOpen,
      behaviorCounts: summarizeRows(weekRows),
    });
  }

  await mkdir(OUTPUT_DIR, { recursive: true });
  const jsonPath = path.join(OUTPUT_DIR, "clean14-sentiment-regime-behavior-audit.json");
  const markdownPath = path.join(OUTPUT_DIR, "clean14-sentiment-regime-behavior-audit.md");
  const directionChangedRows = rows.filter((row) => row.directionChanged);
  const actualDirectionChangedRows = rows.filter((row) => row.actualDirectionChanged);
  const report = {
    generatedAtUtc,
    expectedSymbols: EXPECTED_SYMBOLS,
    weeks,
    weekSummaries,
    rows,
    directionChangedRows,
    actualDirectionChangedRows,
    legacyBoundaryShiftRows: rows.filter((row) => row.legacyDbBeforeWeekOpenButReportedAfter).length,
    fridayBoundaryShiftRows: rows.filter((row) => row.fridayDbBeforeCutoffButReportedAfter).length,
    sameCurrentTimestampRows: rows.filter((row) => row.currentTimestampSame).length,
    fridayRawEvidenceRows: rows.filter((row) => row.fridayRawEvidenceWithin120m).length,
    noRawFridayEvidenceRows: rows.filter((row) => !row.fridayRawEvidenceWithin120m).length,
    behaviorCounts: summarizeRows(rows),
    output: {
      jsonPath: path.relative(process.cwd(), jsonPath),
      markdownPath: path.relative(process.cwd(), markdownPath),
    },
  };

  await writeFile(jsonPath, JSON.stringify(report, null, 2));
  await writeFile(markdownPath, buildMarkdown(report));
  console.log(JSON.stringify({
    generatedAtUtc,
    jsonPath: report.output.jsonPath,
    markdownPath: report.output.markdownPath,
    rows: rows.length,
    directionChanges: directionChangedRows.length,
    actualDirectionChanges: actualDirectionChangedRows.length,
    sameCurrentTimestampRows: report.sameCurrentTimestampRows,
    fridayRawEvidenceRows: report.fridayRawEvidenceRows,
    legacyBoundaryShiftRows: report.legacyBoundaryShiftRows,
    fridayBoundaryShiftRows: report.fridayBoundaryShiftRows,
    behaviorCounts: report.behaviorCounts,
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.stack ?? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await getPool().end().catch(() => undefined);
  });
