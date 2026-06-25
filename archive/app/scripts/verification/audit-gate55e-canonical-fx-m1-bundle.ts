import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { loadEnvConfig } from "@next/env";
import { DateTime } from "luxon";
import { Pool, type PoolClient } from "pg";

import { getCanonicalWeekWindow } from "@/lib/canonicalPriceWindows";
import { PAIRS_BY_ASSET_CLASS } from "@/lib/cotPairs";
import { getCanonicalWeekOpenUtc, normalizeWeekOpenUtc } from "@/lib/weekAnchor";

loadEnvConfig(process.cwd());

type CliOptions = {
  fromWeek: string;
  toWeek: string;
  writeFill: boolean;
  outDir: string;
};

type PairCoverageRow = {
  weekOpenUtc: string;
  symbol: string;
  expectedBars: number;
  actualBars: number;
  missingBars: number;
  coveragePct: number;
  firstActiveUtc: string | null;
  lastActiveUtc: string | null;
  firstBarUtc: string | null;
  lastBarUtc: string | null;
  fillEligible: boolean;
  status: "complete" | "partial" | "missing" | "no_active_provider_minutes";
};

type WeekCoverage = {
  weekOpenUtc: string;
  openUtc: string;
  closeUtc: string;
  expectedBars: number;
  completePairs: number;
  partialPairs: number;
  missingPairs: number;
  missingBars: number;
  lowestCoveragePct: number;
  status: "full" | "partial" | "source_gap";
};

type FillResult = {
  weekOpenUtc: string;
  symbol: string;
  requestedMissingBars: number;
  insertedRows: number;
};

const FX_SYMBOLS = PAIRS_BY_ASSET_CLASS.fx.map((row) => row.pair.toUpperCase()).sort();
const DEFAULT_FROM_WEEK = "2018-12-17T00:00:00.000Z";
const DEFAULT_TO_WEEK = "2026-06-08T00:00:00.000Z";
const NO_TICK_QUALITY_STATUS = "derived_no_tick_forward_fill_v1";
const MAX_SESSION_EDGE_LAG_MINUTES_FOR_NO_TICK_FILL = 60;
const MAX_REOPEN_EDGE_LAG_MINUTES_FOR_NO_TICK_FILL = 360;
const MIN_COVERAGE_PCT_FOR_NO_TICK_FILL = 90;

function argValue(name: string): string | null {
  const prefix = `--${name}=`;
  return process.argv.slice(2).find((arg) => arg.startsWith(prefix))?.slice(prefix.length) ?? null;
}

function hasFlag(name: string) {
  return process.argv.slice(2).includes(`--${name}`);
}

function normalizeWeek(value: string, label: string) {
  const normalized = normalizeWeekOpenUtc(value);
  if (!normalized) throw new Error(`Invalid --${label}: ${value}`);
  return normalized;
}

function parseCli(): CliOptions {
  return {
    fromWeek: normalizeWeek(argValue("from-week") ?? DEFAULT_FROM_WEEK, "from-week"),
    toWeek: normalizeWeek(argValue("to-week") ?? DEFAULT_TO_WEEK, "to-week"),
    writeFill: hasFlag("write-fill"),
    outDir: argValue("out-dir") ?? path.join("app", "reports", "data-verification", "gate55"),
  };
}

function databaseSsl(databaseUrl: string) {
  return databaseUrl.includes("render.com") || databaseUrl.includes("sslmode=require")
    ? { rejectUnauthorized: false }
    : false;
}

function openPool() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required.");
  return new Pool({
    connectionString: databaseUrl,
    ssl: databaseSsl(databaseUrl),
    max: 1,
    connectionTimeoutMillis: 10_000,
    idleTimeoutMillis: 30_000,
    statement_timeout: 180_000,
  });
}

function buildWeeks(fromWeek: string, toWeek: string) {
  const weeks: string[] = [];
  let cursor = DateTime.fromISO(fromWeek, { zone: "utc" });
  const end = DateTime.fromISO(toWeek, { zone: "utc" });
  if (!cursor.isValid || !end.isValid) throw new Error("Invalid week range.");
  if (cursor > end) throw new Error("--from-week must be <= --to-week.");

  for (let guard = 0; cursor <= end && guard < 600; guard += 1) {
    const week = normalizeWeekOpenUtc(cursor.toISO() ?? cursor.toUTC().toISO() ?? "");
    if (!week) throw new Error(`Failed to normalize week cursor ${cursor.toISO()}`);
    if (!weeks.includes(week)) weeks.push(week);
    const next = DateTime.fromISO(week, { zone: "utc" })
      .setZone("America/New_York")
      .plus({ weeks: 1 })
      .toUTC();
    cursor = DateTime.fromISO(getCanonicalWeekOpenUtc(next), { zone: "utc" });
  }

  return weeks;
}

function symbolValuesSql(offset: number) {
  return FX_SYMBOLS.map((_, index) => `($${offset + index}::text)`).join(",");
}

function round(value: number, digits = 6) {
  return Number(value.toFixed(digits));
}

async function auditWeek(client: PoolClient, weekOpenUtc: string): Promise<{
  week: WeekCoverage;
  pairs: PairCoverageRow[];
}> {
  const window = getCanonicalWeekWindow(weekOpenUtc, "fx");
  const openUtc = window.openUtc.toISO() ?? window.periodOpenUtc;
  const closeUtc = window.closeUtc.toISO() ?? weekOpenUtc;
  const values = symbolValuesSql(3);

  const result = await client.query<{
    expected_bars: string | number;
    first_active_utc: Date | null;
    last_active_utc: Date | null;
    symbol: string;
    actual_bars: string | number;
    missing_bars: string | number;
    first_bar_utc: Date | null;
    last_bar_utc: Date | null;
  }>(
    `WITH symbols(symbol) AS (VALUES ${values}),
      active AS (
        SELECT DISTINCT bar_open_utc
          FROM canonical_price_bars
         WHERE asset_class = 'fx'
           AND timeframe = '1m'
           AND source_provider = 'oanda'
           AND quality_status = 'provider_minute'
           AND bar_open_utc >= $1::timestamptz
           AND bar_open_utc < $2::timestamptz
      ),
      expected AS (
        SELECT COUNT(*)::int AS expected_bars,
               MIN(bar_open_utc) AS first_active_utc,
               MAX(bar_open_utc) AS last_active_utc
          FROM active
      ),
      actual AS (
        SELECT b.symbol,
               COUNT(DISTINCT b.bar_open_utc)::int AS actual_bars,
               MIN(b.bar_open_utc) AS first_bar_utc,
               MAX(b.bar_open_utc) AS last_bar_utc
          FROM canonical_price_bars b
          JOIN active a ON a.bar_open_utc = b.bar_open_utc
         WHERE b.asset_class = 'fx'
           AND b.timeframe = '1m'
           AND b.symbol IN (SELECT symbol FROM symbols)
         GROUP BY b.symbol
      )
      SELECT e.expected_bars,
             e.first_active_utc,
             e.last_active_utc,
             s.symbol,
             COALESCE(a.actual_bars, 0)::int AS actual_bars,
             (e.expected_bars - COALESCE(a.actual_bars, 0))::int AS missing_bars,
             a.first_bar_utc,
             a.last_bar_utc
        FROM symbols s
        CROSS JOIN expected e
        LEFT JOIN actual a ON a.symbol = s.symbol
       ORDER BY s.symbol`,
    [openUtc, closeUtc, ...FX_SYMBOLS],
  );

  const pairs = result.rows.map((row): PairCoverageRow => {
    const expectedBars = Number(row.expected_bars);
    const actualBars = Number(row.actual_bars);
    const missingBars = Number(row.missing_bars);
    const coveragePct = expectedBars > 0 ? round((actualBars / expectedBars) * 100, 6) : 0;
    const firstActiveUtc = row.first_active_utc?.toISOString() ?? null;
    const lastActiveUtc = row.last_active_utc?.toISOString() ?? null;
    const firstBarUtc = row.first_bar_utc?.toISOString() ?? null;
    const lastBarUtc = row.last_bar_utc?.toISOString() ?? null;
    const firstEdgeLagMinutes = firstActiveUtc && firstBarUtc
      ? (Date.parse(firstBarUtc) - Date.parse(firstActiveUtc)) / 60_000
      : Number.POSITIVE_INFINITY;
    const lastEdgeLagMinutes = lastActiveUtc && lastBarUtc
      ? (Date.parse(lastActiveUtc) - Date.parse(lastBarUtc)) / 60_000
      : Number.POSITIVE_INFINITY;
    const fillEligible = (
      expectedBars > 0
      && actualBars > 0
      && missingBars > 0
      && coveragePct >= MIN_COVERAGE_PCT_FOR_NO_TICK_FILL
      && firstEdgeLagMinutes >= 0
      && firstEdgeLagMinutes <= MAX_REOPEN_EDGE_LAG_MINUTES_FOR_NO_TICK_FILL
      && lastEdgeLagMinutes >= 0
      && lastEdgeLagMinutes <= MAX_SESSION_EDGE_LAG_MINUTES_FOR_NO_TICK_FILL
    );
    return {
      weekOpenUtc,
      symbol: row.symbol,
      expectedBars,
      actualBars,
      missingBars,
      coveragePct,
      firstActiveUtc,
      lastActiveUtc,
      firstBarUtc,
      lastBarUtc,
      fillEligible,
      status: expectedBars === 0
        ? "no_active_provider_minutes"
        : actualBars === 0
          ? "missing"
          : missingBars > 0
            ? "partial"
            : "complete",
    };
  });

  const expectedBars = pairs[0]?.expectedBars ?? 0;
  const completePairs = pairs.filter((row) => row.status === "complete").length;
  const partialPairs = pairs.filter((row) => row.status === "partial").length;
  const missingPairs = pairs.filter((row) => row.status === "missing").length;
  const missingBars = pairs.reduce((sum, row) => sum + row.missingBars, 0);
  const lowestCoveragePct = pairs.length > 0
    ? Math.min(...pairs.map((row) => row.coveragePct))
    : 100;

  return {
    week: {
      weekOpenUtc,
      openUtc,
      closeUtc,
      expectedBars,
      completePairs,
      partialPairs,
      missingPairs,
      missingBars,
      lowestCoveragePct,
      status: expectedBars === 0
        ? "source_gap"
        : missingBars > 0
          ? "partial"
          : "full",
    },
    pairs,
  };
}

async function fillWeekSymbol(client: PoolClient, options: {
  weekOpenUtc: string;
  symbol: string;
  requestedMissingBars: number;
}) {
  if (options.requestedMissingBars <= 0) {
    return {
      weekOpenUtc: options.weekOpenUtc,
      symbol: options.symbol,
      requestedMissingBars: 0,
      insertedRows: 0,
    };
  }

  const window = getCanonicalWeekWindow(options.weekOpenUtc, "fx");
  const openUtc = window.openUtc.toISO() ?? window.periodOpenUtc;
  const closeUtc = window.closeUtc.toISO() ?? options.weekOpenUtc;

  const result = await client.query(
    `WITH active AS (
       SELECT DISTINCT bar_open_utc
         FROM canonical_price_bars
        WHERE asset_class = 'fx'
          AND timeframe = '1m'
          AND source_provider = 'oanda'
          AND quality_status = 'provider_minute'
          AND bar_open_utc >= $2::timestamptz
          AND bar_open_utc < $3::timestamptz
     ),
     missing AS (
       SELECT a.bar_open_utc
         FROM active a
         LEFT JOIN canonical_price_bars existing
           ON existing.symbol = $1
          AND existing.timeframe = '1m'
          AND existing.bar_open_utc = a.bar_open_utc
        WHERE existing.id IS NULL
     ),
     fillable AS (
       SELECT m.bar_open_utc, previous.close_price
         FROM missing m
         CROSS JOIN LATERAL (
           SELECT p.close_price
             FROM canonical_price_bars p
            WHERE p.symbol = $1
              AND p.timeframe = '1m'
              AND p.bar_open_utc < m.bar_open_utc
            ORDER BY p.bar_open_utc DESC
            LIMIT 1
         ) previous
     )
     INSERT INTO canonical_price_bars (
       symbol, asset_class, timeframe, bar_open_utc, bar_close_utc,
       open_price, high_price, low_price, close_price, source_provider, quality_status
     )
     SELECT $1,
            'fx',
            '1m',
            f.bar_open_utc,
            f.bar_open_utc + interval '1 minute',
            f.close_price,
            f.close_price,
            f.close_price,
            f.close_price,
            'oanda',
            $4
       FROM fillable f
     ON CONFLICT (symbol, timeframe, bar_open_utc) DO NOTHING`,
    [options.symbol, openUtc, closeUtc, NO_TICK_QUALITY_STATUS],
  );

  return {
    weekOpenUtc: options.weekOpenUtc,
    symbol: options.symbol,
    requestedMissingBars: options.requestedMissingBars,
    insertedRows: result.rowCount ?? 0,
  };
}

function summarize(pairRows: PairCoverageRow[], weeks: WeekCoverage[]) {
  const parentPairWeeks = pairRows.length;
  const completePairWeeks = pairRows.filter((row) => row.status === "complete").length;
  const partialPairWeeks = pairRows.filter((row) => row.status === "partial").length;
  const missingPairWeeks = pairRows.filter((row) => row.status === "missing").length;
  const sourceGapPairWeeks = pairRows.filter((row) => row.status === "no_active_provider_minutes").length;
  const totalMissingBars = pairRows.reduce((sum, row) => sum + row.missingBars, 0);
  const totalExpectedBars = pairRows.reduce((sum, row) => sum + row.expectedBars, 0);
  const totalActualBars = pairRows.reduce((sum, row) => sum + row.actualBars, 0);

  return {
    parentPairWeeks,
    completePairWeeks,
    partialPairWeeks,
    missingPairWeeks,
    sourceGapPairWeeks,
    fullWeeks: weeks.filter((row) => row.status === "full").length,
    partialWeeks: weeks.filter((row) => row.status === "partial").length,
    sourceGapWeeks: weeks.filter((row) => row.status === "source_gap").length,
    totalExpectedBars,
    totalActualBars,
    totalMissingBars,
    lowestCoveragePct: pairRows.length > 0
      ? Math.min(...pairRows.map((row) => row.coveragePct))
      : 100,
  };
}

function writeReceipt(options: {
  outDir: string;
  receipt: Record<string, unknown>;
  beforeSummary: ReturnType<typeof summarize>;
  afterSummary: ReturnType<typeof summarize> | null;
  weeks: WeekCoverage[];
  pairRows: PairCoverageRow[];
}) {
  fs.mkdirSync(options.outDir, { recursive: true });
  const stamp = DateTime.utc().toFormat("yyyyMMdd'T'HHmmss'Z'");
  const jsonPath = path.join(options.outDir, `gate55e-canonical-fx-m1-bundle-${stamp}.json`);
  const mdPath = path.join(options.outDir, `gate55e-canonical-fx-m1-bundle-${stamp}.md`);

  fs.writeFileSync(jsonPath, JSON.stringify(options.receipt, null, 2) + "\n");

  const weakWeeks = options.weeks.filter((row) => row.status !== "full").slice(0, 40);
  const weakPairs = options.pairRows.filter((row) => row.status !== "complete").slice(0, 80);
  const md = [
    "# Gate 55E Canonical FX M1 Bundle Audit",
    "",
    `- Generated: ${options.receipt.generatedAt}`,
    `- Status: ${options.receipt.status}`,
    `- Write fill: ${options.receipt.writeFill}`,
    `- Input hash: ${options.receipt.inputHash}`,
    "",
    "## Before",
    "",
    `- Parent pair-weeks: ${options.beforeSummary.parentPairWeeks}`,
    `- Complete pair-weeks: ${options.beforeSummary.completePairWeeks}`,
    `- Partial pair-weeks: ${options.beforeSummary.partialPairWeeks}`,
    `- Missing pair-weeks: ${options.beforeSummary.missingPairWeeks}`,
    `- Source-gap pair-weeks: ${options.beforeSummary.sourceGapPairWeeks}`,
    `- Full weeks: ${options.beforeSummary.fullWeeks}`,
    `- Partial weeks: ${options.beforeSummary.partialWeeks}`,
    `- Source-gap weeks: ${options.beforeSummary.sourceGapWeeks}`,
    `- Missing active pair-minute rows: ${options.beforeSummary.totalMissingBars}`,
    `- Lowest coverage: ${options.beforeSummary.lowestCoveragePct.toFixed(6)}%`,
    "",
    ...(options.afterSummary ? [
      "## After",
      "",
      `- Complete pair-weeks: ${options.afterSummary.completePairWeeks}`,
      `- Partial pair-weeks: ${options.afterSummary.partialPairWeeks}`,
      `- Missing active pair-minute rows: ${options.afterSummary.totalMissingBars}`,
      `- Full weeks: ${options.afterSummary.fullWeeks}`,
      `- Partial weeks: ${options.afterSummary.partialWeeks}`,
      `- Lowest coverage: ${options.afterSummary.lowestCoveragePct.toFixed(6)}%`,
      "",
    ] : []),
    "## Weak Week Sample",
    "",
    ...weakWeeks.map((row) => (
      `- ${row.weekOpenUtc}: status=${row.status}, expected=${row.expectedBars}, completePairs=${row.completePairs}, partialPairs=${row.partialPairs}, missingBars=${row.missingBars}, lowest=${row.lowestCoveragePct.toFixed(6)}%`
    )),
    "",
    "## Weak Pair Sample",
    "",
    ...weakPairs.map((row) => (
      `- ${row.weekOpenUtc} ${row.symbol}: status=${row.status}, actual=${row.actualBars}/${row.expectedBars}, missing=${row.missingBars}, coverage=${row.coveragePct.toFixed(6)}%`
    )),
    "",
    "## Governance",
    "",
    "- Active FX minutes are provider-observed OANDA `provider_minute` rows inside the canonical New York 5pm week window.",
    "- Pair coverage requires 100% of active provider minutes.",
    `- No-tick repair rows, when written, require at least ${MIN_COVERAGE_PCT_FOR_NO_TICK_FILL}% observed pair coverage, the close edge within ${MAX_SESSION_EDGE_LAG_MINUTES_FOR_NO_TICK_FILL} minutes, and bounded holiday/reopen lag within ${MAX_REOPEN_EDGE_LAG_MINUTES_FOR_NO_TICK_FILL} minutes.`,
    `- No-tick repair rows use prior same-symbol close only and quality_status=${NO_TICK_QUALITY_STATUS}.`,
    "- The repair path does not use future bars, outcomes, COT, Strength, regimes, execution optimization, or risk overlays.",
    "",
  ].join("\n");
  fs.writeFileSync(mdPath, md);
  return { jsonPath, mdPath };
}

async function runAudit(client: PoolClient, weeks: string[]) {
  const weekRows: WeekCoverage[] = [];
  const pairRows: PairCoverageRow[] = [];
  const started = Date.now();

  for (const [index, weekOpenUtc] of weeks.entries()) {
    const audited = await auditWeek(client, weekOpenUtc);
    weekRows.push(audited.week);
    pairRows.push(...audited.pairs);
    console.log(
      [
        `audit ${index + 1}/${weeks.length}`,
        weekOpenUtc,
        `status=${audited.week.status}`,
        `expected=${audited.week.expectedBars}`,
        `completePairs=${audited.week.completePairs}`,
        `missingBars=${audited.week.missingBars}`,
        `elapsed=${((Date.now() - started) / 1000).toFixed(1)}s`,
      ].join(" | "),
    );
  }

  return { weekRows, pairRows };
}

async function main() {
  const options = parseCli();
  const weeks = buildWeeks(options.fromWeek, options.toWeek);
  const inputHash = createHash("sha256")
    .update(JSON.stringify({
      gate: "Gate 55E",
      rule: "fx_m1_provider_active_minute_requires_100pct_pair_rows",
      fromWeek: options.fromWeek,
      toWeek: options.toWeek,
      symbols: FX_SYMBOLS,
      weeks,
      noTickQualityStatus: NO_TICK_QUALITY_STATUS,
    }))
    .digest("hex")
    .toUpperCase();

  const pool = openPool();
  const client = await pool.connect();
  const generatedAt = DateTime.utc().toISO() ?? new Date().toISOString();
  try {
    console.log(
      [
        "Gate55E canonical FX M1 bundle audit",
        `fromWeek=${options.fromWeek}`,
        `toWeek=${options.toWeek}`,
        `weeks=${weeks.length}`,
        `symbols=${FX_SYMBOLS.length}`,
        `writeFill=${options.writeFill}`,
        `inputHash=${inputHash}`,
      ].join(" | "),
    );

    const before = await runAudit(client, weeks);
    const beforeSummary = summarize(before.pairRows, before.weekRows);
    const fillResults: FillResult[] = [];
    let afterSummary: ReturnType<typeof summarize> | null = null;
    let afterRows = before;

    if (options.writeFill && beforeSummary.totalMissingBars > 0) {
      const weakRows = before.pairRows.filter((row) => row.fillEligible);
      for (const [index, row] of weakRows.entries()) {
        const fill = await fillWeekSymbol(client, {
          weekOpenUtc: row.weekOpenUtc,
          symbol: row.symbol,
          requestedMissingBars: row.missingBars,
        });
        fillResults.push(fill);
        console.log(
          [
            `fill ${index + 1}/${weakRows.length}`,
            row.weekOpenUtc,
            row.symbol,
            `requested=${fill.requestedMissingBars}`,
            `inserted=${fill.insertedRows}`,
          ].join(" | "),
        );
      }

      await client.query("ANALYZE canonical_price_bars");
      afterRows = await runAudit(client, weeks);
      afterSummary = summarize(afterRows.pairRows, afterRows.weekRows);
    }

    const finalSummary = afterSummary ?? beforeSummary;
    const status = finalSummary.totalMissingBars === 0 && finalSummary.sourceGapWeeks === 0
      ? "PASS_CANONICAL_FX_M1_100_PERCENT"
      : "BLOCKED_CANONICAL_FX_M1_GAPS_REMAIN";

    const receipt = {
      generatedAt,
      status,
      writeFill: options.writeFill,
      inputHash,
      fromWeek: options.fromWeek,
      toWeek: options.toWeek,
      weeks: weeks.length,
      symbols: FX_SYMBOLS,
      noTickQualityStatus: NO_TICK_QUALITY_STATUS,
      beforeSummary,
      afterSummary,
      fillSummary: {
        fillRows: fillResults.length,
        requestedMissingBars: fillResults.reduce((sum, row) => sum + row.requestedMissingBars, 0),
        insertedRows: fillResults.reduce((sum, row) => sum + row.insertedRows, 0),
        unfilledRows: fillResults.reduce((sum, row) => sum + row.requestedMissingBars - row.insertedRows, 0),
        maxSessionEdgeLagMinutesForNoTickFill: MAX_SESSION_EDGE_LAG_MINUTES_FOR_NO_TICK_FILL,
        maxReopenEdgeLagMinutesForNoTickFill: MAX_REOPEN_EDGE_LAG_MINUTES_FOR_NO_TICK_FILL,
        minCoveragePctForNoTickFill: MIN_COVERAGE_PCT_FOR_NO_TICK_FILL,
        blockedWeakPairRows: before.pairRows.filter((row) => (
          row.missingBars > 0
          && !row.fillEligible
        )).length,
        blockedWeakMissingBars: before.pairRows
          .filter((row) => row.missingBars > 0 && !row.fillEligible)
          .reduce((sum, row) => sum + row.missingBars, 0),
      },
      weekRows: afterRows.weekRows,
      weakPairRows: afterRows.pairRows.filter((row) => row.status !== "complete"),
      fillResults,
      statements: {
        noLookahead: true,
        noFutureBarsForFill: true,
        noOutcomeDataUsed: true,
        noCotStrengthCombination: true,
        noRegimeFilters: true,
        activeMinuteRule: "provider OANDA provider_minute active minute inside canonical FX New York 5pm week window",
        passRule: "each FX pair must have a canonical 1m row for 100% of active provider minutes",
      },
    };

    const paths = writeReceipt({
      outDir: options.outDir,
      receipt,
      beforeSummary,
      afterSummary,
      weeks: afterRows.weekRows,
      pairRows: afterRows.pairRows,
    });

    console.log(`status=${status}`);
    console.log(`json=${paths.jsonPath}`);
    console.log(`md=${paths.mdPath}`);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
