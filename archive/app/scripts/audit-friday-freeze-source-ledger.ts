import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import { pathToFileURL } from "node:url";

import { DateTime } from "luxon";

import { PAIRS_BY_ASSET_CLASS } from "../src/lib/cotPairs";
import type { AssetClass } from "../src/lib/cotMarkets";
import { query, getPool } from "../src/lib/db";
import { dbTimestampValueToIsoUtc } from "../src/lib/dbUtcTimestamp";
import { deriveCotReportDate } from "../src/lib/dataSectionWeeks";
import { CANONICAL_ANCHOR_VERSION } from "../src/lib/pairReturns";
import { derivePriorStrengthWeekOpenUtcs } from "../src/lib/strength/canonicalDirection";
import {
  getFridayFreezeTargetUtc,
  SENTIMENT_FRIDAY_CLOSE_SOURCE_VERSION,
  STRENGTH_FRIDAY_CLOSE_SOURCE_VERSION,
  V203_CLEAN_14W_FREEZE_WEEKS,
} from "../src/lib/sourceFreeze/fridayFreeze";

const SENTIMENT_MAX_LAG_MINUTES = 120;
const STRENGTH_WINDOWS = ["1h", "4h", "24h"] as const;

type SourceFamily = "dealer" | "commercial" | "sentiment" | "strength";

type Args = {
  json: boolean;
  releaseWindow: string;
};

type LedgerRow = {
  weekOpenUtc: string;
  freezeTargetUtc: string;
  source: SourceFamily;
  sourceVersion: string;
  expectedRows: number;
  resolvedRows: number;
  complete: boolean;
  trustedForFreeze: boolean;
  evidenceClass: "cot_snapshot" | "aggregate_derived" | "computed_price_strength";
  rawProviderRows?: number;
  maxLagMinutes?: number | null;
  incidents: string[];
};

function parseArgs(): Args {
  const args = process.argv.slice(2);
  return {
    json: args.includes("--json"),
    releaseWindow: args.find((arg) => arg.startsWith("--release-window="))?.slice("--release-window=".length)
      ?? "v2.0.3-clean-14w",
  };
}

function expectedPairs() {
  return Object.values(PAIRS_BY_ASSET_CLASS).flatMap((pairs) => pairs.map((pair) => pair.pair.toUpperCase())).sort();
}

function expectedStrengthAssetKeys() {
  return (["indices", "commodities", "crypto"] as AssetClass[]).flatMap((assetClass) =>
    PAIRS_BY_ASSET_CLASS[assetClass].flatMap((pair) =>
      STRENGTH_WINDOWS.map((window) => ({
        assetClass,
        window,
        key: pair.base.toUpperCase(),
      })),
    ),
  );
}

function expectedStrengthCurrencyKeys() {
  const currencies = new Set<string>();
  for (const pair of PAIRS_BY_ASSET_CLASS.fx) {
    currencies.add(pair.base.toUpperCase());
    currencies.add(pair.quote.toUpperCase());
  }
  return [...currencies].flatMap((currency) =>
    STRENGTH_WINDOWS.map((window) => ({ window, key: currency })),
  );
}

function lagMinutes(targetUtc: string, sourceUtc: Date | string | null | undefined) {
  if (!sourceUtc) return null;
  const target = DateTime.fromISO(targetUtc, { zone: "utc" });
  const sourceIso = dbTimestampValueToIsoUtc(sourceUtc);
  const source = sourceIso ? DateTime.fromISO(sourceIso, { zone: "utc" }) : DateTime.invalid("invalid source");
  if (!target.isValid || !source.isValid) return null;
  return target.diff(source, "minutes").minutes;
}

function maxFinite(values: Array<number | null>) {
  const finite = values.filter((value): value is number => value !== null && Number.isFinite(value));
  return finite.length > 0 ? Math.max(...finite) : null;
}

async function auditCotSource(weekOpenUtc: string, freezeTargetUtc: string, source: "dealer" | "commercial"): Promise<LedgerRow> {
  const reportDate = deriveCotReportDate(weekOpenUtc);
  const rows = await query<{ asset_class: string }>(
    `SELECT DISTINCT asset_class
       FROM cot_snapshots
      WHERE report_date = $1::date`,
    [reportDate],
  );
  const assetClasses = new Set(rows.map((row) => row.asset_class));
  const missing = (["fx", "indices", "commodities", "crypto"] as AssetClass[])
    .filter((assetClass) => !assetClasses.has(assetClass));

  return {
    weekOpenUtc,
    freezeTargetUtc,
    source,
    sourceVersion: "cot_report_date_v1",
    expectedRows: 4,
    resolvedRows: rows.length,
    complete: missing.length === 0,
    trustedForFreeze: missing.length === 0,
    evidenceClass: "cot_snapshot",
    incidents: missing.map((assetClass) => `missing_cot_snapshot:${assetClass}:${reportDate}`),
  };
}

async function auditSentimentSource(weekOpenUtc: string, freezeTargetUtc: string): Promise<LedgerRow> {
  const pairs = expectedPairs();
  const aggregateRows = await query<{ symbol: string; timestamp_utc: string }>(
    `SELECT DISTINCT ON (symbol) symbol, timestamp_utc::text AS timestamp_utc
       FROM sentiment_aggregates
      WHERE timestamp_utc <= ($1::timestamptz AT TIME ZONE 'UTC')
      ORDER BY symbol, timestamp_utc DESC`,
    [freezeTargetUtc],
  );
  const aggregateSymbols = new Set(aggregateRows.map((row) => row.symbol.toUpperCase()));
  const missingAggregateSymbols = pairs.filter((symbol) => !aggregateSymbols.has(symbol));
  const aggregateLags = aggregateRows.map((row) => lagMinutes(freezeTargetUtc, row.timestamp_utc));
  const maxLag = maxFinite(aggregateLags);
  const stale = maxLag !== null && maxLag > SENTIMENT_MAX_LAG_MINUTES;

  const rawRows = await query<{ symbol: string }>(
    `SELECT DISTINCT symbol
      FROM sentiment_data
      WHERE timestamp_utc <= ($1::timestamptz AT TIME ZONE 'UTC')
        AND timestamp_utc >= (($1::timestamptz AT TIME ZONE 'UTC') - ($2::int * INTERVAL '1 minute'))`,
    [freezeTargetUtc, SENTIMENT_MAX_LAG_MINUTES],
  );
  const rawProviderRows = new Set(rawRows.map((row) => row.symbol.toUpperCase())).size;

  const incidents = [
    ...missingAggregateSymbols.map((symbol) => `missing_friday_aggregate:${symbol}`),
    stale ? `stale_friday_aggregate:maxLagMinutes=${maxLag?.toFixed(1)}` : null,
    rawProviderRows < pairs.length ? `raw_provider_evidence_missing:${rawProviderRows}/${pairs.length}` : null,
  ].filter((value): value is string => Boolean(value));

  return {
    weekOpenUtc,
    freezeTargetUtc,
    source: "sentiment",
    sourceVersion: SENTIMENT_FRIDAY_CLOSE_SOURCE_VERSION,
    expectedRows: pairs.length,
    resolvedRows: aggregateSymbols.size,
    complete: missingAggregateSymbols.length === 0 && !stale,
    trustedForFreeze: missingAggregateSymbols.length === 0 && !stale,
    evidenceClass: "aggregate_derived",
    rawProviderRows,
    maxLagMinutes: maxLag,
    incidents,
  };
}

async function auditStrengthSource(weekOpenUtc: string, freezeTargetUtc: string): Promise<LedgerRow> {
  const currencyKeys = expectedStrengthCurrencyKeys();
  const assetKeys = expectedStrengthAssetKeys();
  const [currencyRows, assetRows, priorReturnRows] = await Promise.all([
    query<{ window: string; key: string; snapshot_time_utc: string }>(
      `SELECT DISTINCT ON ("window", currency) "window", currency AS key, snapshot_time_utc::text AS snapshot_time_utc
         FROM currency_strength_snapshots
        WHERE snapshot_time_utc <= ($1::timestamptz AT TIME ZONE 'UTC')
          AND "window" IN ('1h', '4h', '24h')
        ORDER BY "window", currency, snapshot_time_utc DESC`,
      [freezeTargetUtc],
    ),
    query<{ asset_class: AssetClass; window: string; key: string; snapshot_time_utc: string }>(
      `SELECT DISTINCT ON (asset_class, "window", asset) asset_class, "window", asset AS key, snapshot_time_utc::text AS snapshot_time_utc
         FROM asset_strength_snapshots
        WHERE snapshot_time_utc <= ($1::timestamptz AT TIME ZONE 'UTC')
          AND asset_class IN ('crypto', 'commodities', 'indices')
          AND "window" IN ('1h', '4h', '24h')
        ORDER BY asset_class, "window", asset, snapshot_time_utc DESC`,
      [freezeTargetUtc],
    ),
    query<{ symbol: string; period_open_utc: Date }>(
      `SELECT symbol, period_open_utc
         FROM pair_period_returns
        WHERE period_type = 'weekly'
          AND anchor_type = 'canonical'
          AND anchor_version = $1
          AND symbol = ANY($2::text[])
          AND period_open_utc = ANY($3::timestamptz[])`,
      [CANONICAL_ANCHOR_VERSION, expectedPairs(), derivePriorStrengthWeekOpenUtcs(weekOpenUtc)],
    ),
  ]);

  const actualCurrency = new Set(currencyRows.map((row) => `${row.window}:${row.key.toUpperCase()}`));
  const actualAssets = new Set(assetRows.map((row) => `${row.asset_class}:${row.window}:${row.key.toUpperCase()}`));
  const missingCurrency = currencyKeys.filter((row) => !actualCurrency.has(`${row.window}:${row.key}`));
  const missingAssets = assetKeys.filter((row) => !actualAssets.has(`${row.assetClass}:${row.window}:${row.key}`));
  const expectedPriorReturns = expectedPairs().length * derivePriorStrengthWeekOpenUtcs(weekOpenUtc).length;
  const maxLag = maxFinite([
    ...currencyRows.map((row) => lagMinutes(freezeTargetUtc, row.snapshot_time_utc)),
    ...assetRows.map((row) => lagMinutes(freezeTargetUtc, row.snapshot_time_utc)),
  ]);
  const missingPriorReturnRows = expectedPriorReturns - priorReturnRows.length;
  const complete = missingCurrency.length === 0 && missingAssets.length === 0 && missingPriorReturnRows === 0;

  return {
    weekOpenUtc,
    freezeTargetUtc,
    source: "strength",
    sourceVersion: STRENGTH_FRIDAY_CLOSE_SOURCE_VERSION,
    expectedRows: currencyKeys.length + assetKeys.length,
    resolvedRows: currencyRows.length + assetRows.length,
    complete,
    trustedForFreeze: complete,
    evidenceClass: "computed_price_strength",
    maxLagMinutes: maxLag,
    incidents: [
      ...missingCurrency.map((row) => `missing_currency_strength:${row.window}:${row.key}`),
      ...missingAssets.map((row) => `missing_asset_strength:${row.assetClass}:${row.window}:${row.key}`),
      missingPriorReturnRows > 0 ? `missing_prior_returns:${priorReturnRows.length}/${expectedPriorReturns}` : null,
    ].filter((value): value is string => Boolean(value)),
  };
}

async function auditWeeks(weeks: readonly string[]) {
  const rows: LedgerRow[] = [];
  for (const weekOpenUtc of weeks) {
    const freezeTargetUtc = getFridayFreezeTargetUtc(weekOpenUtc);
    rows.push(await auditCotSource(weekOpenUtc, freezeTargetUtc, "dealer"));
    rows.push(await auditCotSource(weekOpenUtc, freezeTargetUtc, "commercial"));
    rows.push(await auditSentimentSource(weekOpenUtc, freezeTargetUtc));
    rows.push(await auditStrengthSource(weekOpenUtc, freezeTargetUtc));
  }
  return rows;
}

function printRows(rows: LedgerRow[]) {
  console.log("Friday Freeze Source Ledger Audit");
  console.log("=================================");
  console.log("Scope: v2.0.3-clean-14w Friday 17:00 America/New_York freeze probe");
  console.log(`Rows: ${rows.length}`);
  console.log("");
  console.log("week | freeze | source | sourceVersion | evidence | complete | trustedForFreeze | rows | incidents");
  for (const row of rows) {
    console.log([
      row.weekOpenUtc.slice(0, 10),
      row.freezeTargetUtc,
      row.source.padEnd(10),
      row.sourceVersion,
      row.evidenceClass,
      String(row.complete),
      String(row.trustedForFreeze),
      `${row.resolvedRows}/${row.expectedRows}`,
      row.incidents.length,
    ].join(" | "));
    for (const incident of row.incidents) {
      console.log(`  - ${incident}`);
    }
  }
  console.log("=================================");
}

async function main() {
  const args = parseArgs();
  if (args.releaseWindow !== "v2.0.3-clean-14w") {
    throw new Error("Only --release-window=v2.0.3-clean-14w is supported in this first Friday-freeze audit.");
  }
  const rows = await auditWeeks(V203_CLEAN_14W_FREEZE_WEEKS);
  if (args.json) {
    console.log(JSON.stringify({ schema: "friday-freeze-source-ledger-audit-v1", rows }, null, 2));
  } else {
    printRows(rows);
  }

  const failed = rows.filter((row) => !row.complete || !row.trustedForFreeze);
  if (failed.length > 0) {
    throw new Error(`Friday-freeze source ledger audit failed with ${failed.length} incomplete/untrusted row(s).`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main()
    .catch((error) => {
      console.error(error instanceof Error ? error.stack ?? error.message : String(error));
      process.exit(1);
    })
    .finally(async () => {
      await getPool().end().catch(() => undefined);
    });
}
