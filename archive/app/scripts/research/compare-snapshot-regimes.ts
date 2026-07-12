/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: compare-snapshot-regimes.ts
 *
 * Description:
 * Read-only evidence report comparing the legacy Sunday/Monday snapshot
 * regime against the Friday 17:00 America/New_York source-freeze regime.
 *
 * This script does not persist ledgers, regenerate canon, or patch app state.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { loadEnvConfig } from "@next/env";
import { DateTime } from "luxon";

loadEnvConfig(process.cwd());

import { derivePairDirectionsByBaseWithNeutral, derivePairDirectionsWithNeutral } from "@/lib/cotCompute";
import type { AssetClass } from "@/lib/cotMarkets";
import { PAIRS_BY_ASSET_CLASS } from "@/lib/cotPairs";
import { readSnapshot } from "@/lib/cotStore";
import { deriveCotReportDate } from "@/lib/dataSectionWeeks";
import { query, getPool } from "@/lib/db";
import type { BaseBasketModel, BasketDirection, CanonicalBasketSignal } from "@/lib/performance/basketSource";
import { EXECUTION_ANCHOR_VERSION as CURRENT_APP_EXECUTION_ANCHOR_VERSION } from "@/lib/pairReturns";
import { resolveSentimentDirections } from "@/lib/sentiment/resolver";
import {
  readCanonicalStrengthDirections,
  readCanonicalStrengthDirectionsAtCutoff,
} from "@/lib/strength/canonicalDirection";
import {
  readWeeklyPairStrengths,
  readWeeklyPairStrengthsAtCutoff,
  type WeeklyPairStrength,
} from "@/lib/strength/weeklyStrength";
import {
  buildFrozenSourceLedgerWeek,
  type FrozenSourceLedgerWeek,
  type FrozenSourceSignal,
} from "@/lib/sourceFreeze/sourceLedger";
import {
  getFridayFreezeTargetUtc,
  V203_CLEAN_14W_FREEZE_WEEKS,
} from "@/lib/sourceFreeze/fridayFreeze";
import { normalizeWeekOpenUtc } from "@/lib/weekAnchor";

type RegimeId = "sunday_monday" | "friday_1700_et";
type SourceId = BaseBasketModel;

type ReportSignal = {
  weekOpenUtc: string;
  source: SourceId;
  symbol: string;
  assetClass: AssetClass;
  direction: BasketDirection;
  sourceReportDate: string | null;
  sourceTimestampUtc: string | null;
  complete: boolean;
  trusted: boolean;
  incidents: string[];
  metadata: Record<string, unknown>;
};

type PairReturnRow = {
  symbol: string;
  asset_class: AssetClass;
  return_pct: string | number;
  source: string;
  anchor_version: string;
  window_open_utc: Date | string | null;
  window_close_utc: Date | string | null;
};

type ExecutionAnchorCoverageRow = {
  anchor_version: string;
  week_open_utc: Date | string;
  rows: string | number;
  sources: string | null;
  first_window_open_utc: Date | string | null;
  last_window_close_utc: Date | string | null;
};

type PerformanceSummary = {
  weekOpenUtc: string;
  source: SourceId;
  regime: RegimeId;
  signals: number;
  tradableSignals: number;
  pricedSignals: number;
  missingReturnRows: string[];
  returnPct: number | null;
};

type StrengthNumberDelta = {
  weekOpenUtc: string;
  symbol: string;
  assetClass: AssetClass;
  directionBefore: BasketDirection;
  directionAfter: BasketDirection;
  compositeBefore: number | null;
  compositeAfter: number | null;
  compositeDelta: number | null;
  raw1wBefore: number | null;
  raw1wAfter: number | null;
  raw1wDelta: number | null;
  raw1mBefore: number | null;
  raw1mAfter: number | null;
  raw1mDelta: number | null;
  latestSnapshotBefore: string | null;
  latestSnapshotAfter: string | null;
  windowDeltas: Array<{
    window: string;
    before: number | null;
    after: number | null;
    delta: number | null;
  }>;
};

const SOURCES: SourceId[] = ["dealer", "commercial", "sentiment", "strength"];
const ASSET_CLASSES = Object.keys(PAIRS_BY_ASSET_CLASS) as AssetClass[];
const OUTPUT_DIR = path.resolve(process.cwd(), "app/reports/snapshot-regime-comparison");
const DEFAULT_COMPARISON_EXECUTION_ANCHOR_VERSION = "execution_ny_fri9_entry_fri11_close_v1";
const ZERO_EPSILON = 1e-9;
const EXPECTED_WEEKLY_RETURN_ROWS = ASSET_CLASSES.reduce(
  (sum, assetClass) => sum + (PAIRS_BY_ASSET_CLASS[assetClass]?.length ?? 0),
  0,
);

function getArgValue(name: string) {
  const equalsPrefix = `--${name}=`;
  const equalsArg = process.argv.find((arg) => arg.startsWith(equalsPrefix));
  if (equalsArg) return equalsArg.slice(equalsPrefix.length).trim() || null;

  const flagIndex = process.argv.indexOf(`--${name}`);
  if (flagIndex >= 0) {
    return process.argv[flagIndex + 1]?.trim() || null;
  }
  return null;
}

const SELECTED_EXECUTION_ANCHOR_VERSION =
  getArgValue("anchor-version") ??
  process.env.SNAPSHOT_REGIME_EXECUTION_ANCHOR_VERSION ??
  DEFAULT_COMPARISON_EXECUTION_ANCHOR_VERSION;

function normalizeIso(value: Date | string | null | undefined) {
  if (!value) return null;
  const parsed = value instanceof Date
    ? DateTime.fromJSDate(value, { zone: "utc" })
    : DateTime.fromISO(String(value), { zone: "utc" });
  return parsed.isValid ? parsed.toUTC().toISO() : String(value);
}

function toNumber(value: string | number | null | undefined) {
  if (value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function signalKey(signal: Pick<ReportSignal, "weekOpenUtc" | "source" | "symbol">) {
  return `${signal.weekOpenUtc}|${signal.source}|${signal.symbol.toUpperCase()}`;
}

function strengthKey(row: Pick<WeeklyPairStrength, "pair">) {
  return row.pair.toUpperCase();
}

function signedReturn(direction: BasketDirection, returnPct: number) {
  if (direction === "LONG") return returnPct;
  if (direction === "SHORT") return -returnPct;
  return 0;
}

function formatSigned(value: number | null, digits = 4) {
  if (value === null || !Number.isFinite(value)) return "n/a";
  const normalized = Math.abs(value) < ZERO_EPSILON ? 0 : value;
  return `${normalized >= 0 ? "+" : ""}${normalized.toFixed(digits)}%`;
}

function formatCount(value: number) {
  return value.toLocaleString("en-US");
}

function numberDelta(before: number | null, after: number | null) {
  if (before === null || after === null) return null;
  return after - before;
}

function cleanFloat(value: number) {
  return Math.abs(value) < ZERO_EPSILON ? 0 : value;
}

function toReportSignal(signal: CanonicalBasketSignal, sourceTimestampUtc: string | null = null): ReportSignal {
  return {
    weekOpenUtc: normalizeWeekOpenUtc(signal.weekOpenUtc) ?? signal.weekOpenUtc,
    source: signal.model,
    symbol: signal.symbol.toUpperCase(),
    assetClass: signal.assetClass as AssetClass,
    direction: signal.direction,
    sourceReportDate: signal.sourceReportDate ?? null,
    sourceTimestampUtc,
    complete: !(signal.metadata && typeof signal.metadata.reason === "string"),
    trusted: !(signal.metadata && typeof signal.metadata.reason === "string"),
    incidents: signal.metadata && typeof signal.metadata.reason === "string"
      ? [String(signal.metadata.reason)]
      : [],
    metadata: signal.metadata ?? {},
  };
}

function frozenToReportSignal(signal: FrozenSourceSignal): ReportSignal {
  return {
    weekOpenUtc: signal.weekOpenUtc,
    source: signal.model,
    symbol: signal.symbol.toUpperCase(),
    assetClass: signal.assetClass as AssetClass,
    direction: signal.direction,
    sourceReportDate: signal.sourceReportDate ?? null,
    sourceTimestampUtc: signal.sourceTimestampUtc,
    complete: signal.complete,
    trusted: signal.trustedForFreeze,
    incidents: signal.incidents,
    metadata: signal.metadata ?? {},
  };
}

async function resolveLegacyCotSignals(
  model: "dealer" | "commercial",
  weekOpenUtc: string,
): Promise<ReportSignal[]> {
  const reportDate = deriveCotReportDate(weekOpenUtc);
  const signals: ReportSignal[] = [];

  for (const assetClass of ASSET_CLASSES) {
    const pairDefs = PAIRS_BY_ASSET_CLASS[assetClass] ?? [];
    const snapshot = await readSnapshot({ assetClass, reportDate });
    if (!snapshot) {
      for (const pairDef of pairDefs) {
        signals.push({
          weekOpenUtc,
          source: model,
          symbol: pairDef.pair.toUpperCase(),
          assetClass,
          direction: "NEUTRAL",
          sourceReportDate: reportDate,
          sourceTimestampUtc: null,
          complete: false,
          trusted: false,
          incidents: [`missing_cot_snapshot:${assetClass}:${reportDate}`],
          metadata: { reason: "missing_snapshot" },
        });
      }
      continue;
    }

    const derivedPairs = assetClass === "fx"
      ? derivePairDirectionsWithNeutral(snapshot.currencies, pairDefs, model)
      : derivePairDirectionsByBaseWithNeutral(snapshot.currencies, pairDefs, model);

    for (const pairDef of pairDefs) {
      const derived = derivedPairs[pairDef.pair];
      signals.push({
        weekOpenUtc,
        source: model,
        symbol: pairDef.pair.toUpperCase(),
        assetClass,
        direction: (derived?.direction as BasketDirection) ?? "NEUTRAL",
        sourceReportDate: reportDate,
        sourceTimestampUtc: snapshot.last_refresh_utc ?? null,
        complete: Boolean(derived),
        trusted: Boolean(derived),
        incidents: derived ? [] : [`no_cot_derivation:${pairDef.pair}`],
        metadata: {
          reportDate,
          lastRefreshUtc: snapshot.last_refresh_utc,
          regime: "sunday_monday",
        },
      });
    }
  }

  return signals;
}

async function resolveLegacySentimentSignals(weekOpenUtc: string): Promise<ReportSignal[]> {
  const rows = await resolveSentimentDirections(weekOpenUtc);
  return rows.map((row) =>
    toReportSignal({
      weekOpenUtc,
      model: "sentiment",
      symbol: row.symbol,
      assetClass: row.assetClass,
      direction: row.direction,
      sourceReportDate: null,
      metadata: {
        tier: row.tier,
        tierFSubStep: row.tierFSubStep ?? null,
        aggLongPct: row.aggLongPct,
        crowdingState: row.crowdingState,
        flipState: row.flipState,
        regime: "sunday_monday",
      },
    })
  );
}

async function resolveLegacyStrengthSignals(weekOpenUtc: string): Promise<ReportSignal[]> {
  const rows = await readCanonicalStrengthDirections(weekOpenUtc);
  return rows.map((row) =>
    toReportSignal({
      weekOpenUtc,
      model: "strength",
      symbol: row.pair,
      assetClass: row.assetClass,
      direction: row.direction,
      sourceReportDate: null,
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
        regime: "sunday_monday",
      },
    }, row.latestSnapshotUtc)
  );
}

async function buildLegacyWeekSignals(weekOpenUtc: string) {
  const normalizedWeekOpenUtc = normalizeWeekOpenUtc(weekOpenUtc) ?? weekOpenUtc;
  const [dealer, commercial, sentiment, strength] = await Promise.all([
    resolveLegacyCotSignals("dealer", normalizedWeekOpenUtc),
    resolveLegacyCotSignals("commercial", normalizedWeekOpenUtc),
    resolveLegacySentimentSignals(normalizedWeekOpenUtc),
    resolveLegacyStrengthSignals(normalizedWeekOpenUtc),
  ]);
  return [...dealer, ...commercial, ...sentiment, ...strength];
}

async function buildFridayWeekSignals(weekOpenUtc: string) {
  const ledger = await buildFrozenSourceLedgerWeek(weekOpenUtc, "v2.0.3-clean-14w-comparison");
  return {
    ledger,
    signals: ledger.signals.map(frozenToReportSignal),
  };
}

async function loadExecutionReturns(weekOpenUtc: string, anchorVersion = SELECTED_EXECUTION_ANCHOR_VERSION) {
  const rows = await query<PairReturnRow>(
    `SELECT symbol,
            asset_class,
            return_pct,
            source,
            anchor_version,
            window_open_utc,
            window_close_utc
       FROM pair_period_returns
      WHERE period_type = 'weekly'
        AND period_open_utc = $1::timestamptz
        AND anchor_type = 'execution'
        AND anchor_version = $2
      ORDER BY symbol ASC`,
    [weekOpenUtc, anchorVersion],
  );

  return new Map(rows.map((row) => [
    row.symbol.toUpperCase(),
    {
      symbol: row.symbol.toUpperCase(),
      assetClass: row.asset_class,
      returnPct: Number(row.return_pct),
      source: row.source,
      anchorVersion: row.anchor_version,
      windowOpenUtc: normalizeIso(row.window_open_utc),
      windowCloseUtc: normalizeIso(row.window_close_utc),
    },
  ]));
}

async function loadExecutionAnchorCoverage(weeks: string[]) {
  const rows = await query<ExecutionAnchorCoverageRow>(
    `SELECT anchor_version,
            period_open_utc AS week_open_utc,
            COUNT(*)::int AS rows,
            string_agg(DISTINCT source, ', ' ORDER BY source) AS sources,
            MIN(window_open_utc) AS first_window_open_utc,
            MAX(window_close_utc) AS last_window_close_utc
       FROM pair_period_returns
      WHERE period_type = 'weekly'
        AND anchor_type = 'execution'
        AND period_open_utc = ANY($1::timestamptz[])
      GROUP BY anchor_version, period_open_utc
      ORDER BY anchor_version ASC, period_open_utc ASC`,
    [weeks],
  );

  const byAnchor = new Map<string, {
    anchorVersion: string;
    weeksCovered: number;
    rows: number;
    completeWeeks: number;
    sourceNames: Set<string>;
    weekRows: Array<{
      weekOpenUtc: string;
      rows: number;
      complete: boolean;
      sources: string[];
      firstWindowOpenUtc: string | null;
      lastWindowCloseUtc: string | null;
    }>;
  }>();

  for (const row of rows) {
    const anchor = row.anchor_version;
    const coverage = byAnchor.get(anchor) ?? {
      anchorVersion: anchor,
      weeksCovered: 0,
      rows: 0,
      completeWeeks: 0,
      sourceNames: new Set<string>(),
      weekRows: [],
    };
    const rowCount = Number(row.rows);
    const sources = (row.sources ?? "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
    for (const source of sources) {
      coverage.sourceNames.add(source);
    }
    coverage.weeksCovered += 1;
    coverage.rows += rowCount;
    coverage.completeWeeks += rowCount === EXPECTED_WEEKLY_RETURN_ROWS ? 1 : 0;
    coverage.weekRows.push({
      weekOpenUtc: normalizeIso(row.week_open_utc) ?? String(row.week_open_utc),
      rows: rowCount,
      complete: rowCount === EXPECTED_WEEKLY_RETURN_ROWS,
      sources,
      firstWindowOpenUtc: normalizeIso(row.first_window_open_utc),
      lastWindowCloseUtc: normalizeIso(row.last_window_close_utc),
    });
    byAnchor.set(anchor, coverage);
  }

  const coveredAnchors = [...byAnchor.values()].map((coverage) => ({
    anchorVersion: coverage.anchorVersion,
    weeksCovered: coverage.weeksCovered,
    rows: coverage.rows,
    completeWeeks: coverage.completeWeeks,
    expectedWeeks: weeks.length,
    expectedRowsPerWeek: EXPECTED_WEEKLY_RETURN_ROWS,
    completeForClean14: coverage.weeksCovered === weeks.length && coverage.completeWeeks === weeks.length,
    sources: [...coverage.sourceNames].sort(),
    weekRows: coverage.weekRows,
  }));

  const selectedCoverage = coveredAnchors.find(
    (coverage) => coverage.anchorVersion === SELECTED_EXECUTION_ANCHOR_VERSION,
  ) ?? {
    anchorVersion: SELECTED_EXECUTION_ANCHOR_VERSION,
    weeksCovered: 0,
    rows: 0,
    completeWeeks: 0,
    expectedWeeks: weeks.length,
    expectedRowsPerWeek: EXPECTED_WEEKLY_RETURN_ROWS,
    completeForClean14: false,
    sources: [],
    weekRows: [],
  };

  const currentAppCoverage = coveredAnchors.find(
    (coverage) => coverage.anchorVersion === CURRENT_APP_EXECUTION_ANCHOR_VERSION,
  ) ?? {
    anchorVersion: CURRENT_APP_EXECUTION_ANCHOR_VERSION,
    weeksCovered: 0,
    rows: 0,
    completeWeeks: 0,
    expectedWeeks: weeks.length,
    expectedRowsPerWeek: EXPECTED_WEEKLY_RETURN_ROWS,
    completeForClean14: false,
    sources: [],
    weekRows: [],
  };

  return {
    expectedRowsPerWeek: EXPECTED_WEEKLY_RETURN_ROWS,
    selectedCoverage,
    currentAppCoverage,
    anchors: coveredAnchors.sort((a, b) => a.anchorVersion.localeCompare(b.anchorVersion)),
  };
}

function summarizePerformance(
  weekOpenUtc: string,
  source: SourceId,
  regime: RegimeId,
  signals: ReportSignal[],
  returns: Awaited<ReturnType<typeof loadExecutionReturns>>,
): PerformanceSummary {
  const scoped = signals.filter((signal) => signal.source === source);
  const tradable = scoped.filter((signal) => signal.direction !== "NEUTRAL");
  const missingReturnRows: string[] = [];
  let total = 0;
  let priced = 0;

  for (const signal of tradable) {
    const row = returns.get(signal.symbol);
    if (!row) {
      missingReturnRows.push(signal.symbol);
      continue;
    }
    total += signedReturn(signal.direction, row.returnPct);
    priced += 1;
  }

  return {
    weekOpenUtc,
    source,
    regime,
    signals: scoped.length,
    tradableSignals: tradable.length,
    pricedSignals: priced,
    missingReturnRows,
    returnPct: missingReturnRows.length === 0 ? total : null,
  };
}

function summarizeSourceCompleteness(signals: ReportSignal[]) {
  const rows: Array<{
    weekOpenUtc: string;
    source: SourceId;
    rows: number;
    completeRows: number;
    trustedRows: number;
    incidentRows: number;
    incidentCount: number;
  }> = [];
  for (const weekOpenUtc of V203_CLEAN_14W_FREEZE_WEEKS) {
    const normalizedWeek = normalizeWeekOpenUtc(weekOpenUtc) ?? weekOpenUtc;
    for (const source of SOURCES) {
      const scoped = signals.filter((signal) => signal.weekOpenUtc === normalizedWeek && signal.source === source);
      rows.push({
        weekOpenUtc: normalizedWeek,
        source,
        rows: scoped.length,
        completeRows: scoped.filter((signal) => signal.complete).length,
        trustedRows: scoped.filter((signal) => signal.trusted).length,
        incidentRows: scoped.filter((signal) => signal.incidents.length > 0).length,
        incidentCount: scoped.reduce((sum, signal) => sum + signal.incidents.length, 0),
      });
    }
  }
  return rows;
}

function buildSignalChanges(beforeSignals: ReportSignal[], afterSignals: ReportSignal[]) {
  const before = new Map(beforeSignals.map((signal) => [signalKey(signal), signal]));
  const after = new Map(afterSignals.map((signal) => [signalKey(signal), signal]));
  const keys = Array.from(new Set([...before.keys(), ...after.keys()])).sort();

  return keys
    .map((key) => {
      const left = before.get(key) ?? null;
      const right = after.get(key) ?? null;
      if (left?.direction === right?.direction) return null;
      return {
        weekOpenUtc: left?.weekOpenUtc ?? right?.weekOpenUtc ?? "",
        source: left?.source ?? right?.source ?? "dealer",
        symbol: left?.symbol ?? right?.symbol ?? "",
        assetClass: left?.assetClass ?? right?.assetClass ?? "fx",
        before: left?.direction ?? "MISSING",
        after: right?.direction ?? "MISSING",
        beforeIncidents: left?.incidents ?? ["missing_before_signal"],
        afterIncidents: right?.incidents ?? ["missing_after_signal"],
      };
    })
    .filter((row): row is NonNullable<typeof row> => Boolean(row));
}

function buildPerformanceDeltas(beforeRows: PerformanceSummary[], afterRows: PerformanceSummary[]) {
  const before = new Map(beforeRows.map((row) => [`${row.weekOpenUtc}|${row.source}`, row]));
  const after = new Map(afterRows.map((row) => [`${row.weekOpenUtc}|${row.source}`, row]));
  return Array.from(new Set([...before.keys(), ...after.keys()]))
    .sort()
    .map((key) => {
      const left = before.get(key) ?? null;
      const right = after.get(key) ?? null;
      return {
        weekOpenUtc: left?.weekOpenUtc ?? right?.weekOpenUtc ?? "",
        source: left?.source ?? right?.source ?? "dealer",
        beforeReturnPct: left?.returnPct ?? null,
        afterReturnPct: right?.returnPct ?? null,
        deltaReturnPct: left?.returnPct !== null && left?.returnPct !== undefined && right?.returnPct !== null && right?.returnPct !== undefined
          ? cleanFloat(right.returnPct - left.returnPct)
          : null,
        beforePricedSignals: left?.pricedSignals ?? 0,
        afterPricedSignals: right?.pricedSignals ?? 0,
        missingReturnRowsBefore: left?.missingReturnRows ?? [],
        missingReturnRowsAfter: right?.missingReturnRows ?? [],
      };
    });
}

function aggregatePerformance(rows: ReturnType<typeof buildPerformanceDeltas>) {
  return SOURCES.map((source) => {
    const scoped = rows.filter((row) => row.source === source);
    const valid = scoped.filter((row) => row.deltaReturnPct !== null);
    const before = scoped
      .map((row) => row.beforeReturnPct)
      .filter((value): value is number => value !== null);
    const after = scoped
      .map((row) => row.afterReturnPct)
      .filter((value): value is number => value !== null);
    return {
      source,
      weeks: scoped.length,
      comparableWeeks: valid.length,
      beforeReturnPct: before.length === scoped.length ? before.reduce((sum, value) => sum + value, 0) : null,
      afterReturnPct: after.length === scoped.length ? after.reduce((sum, value) => sum + value, 0) : null,
      deltaReturnPct: valid.length === scoped.length
        ? cleanFloat(valid.reduce((sum, row) => sum + (row.deltaReturnPct ?? 0), 0))
        : null,
    };
  });
}

function buildStrengthNumberDeltas(
  beforeDirections: ReportSignal[],
  afterDirections: ReportSignal[],
  beforePairStrengths: Map<string, WeeklyPairStrength[]>,
  afterPairStrengths: Map<string, WeeklyPairStrength[]>,
): StrengthNumberDelta[] {
  const beforeDirectionMap = new Map(
    beforeDirections.filter((signal) => signal.source === "strength").map((signal) => [signalKey(signal), signal]),
  );
  const afterDirectionMap = new Map(
    afterDirections.filter((signal) => signal.source === "strength").map((signal) => [signalKey(signal), signal]),
  );
  const rows: StrengthNumberDelta[] = [];

  for (const weekOpenUtc of V203_CLEAN_14W_FREEZE_WEEKS) {
    const normalizedWeek = normalizeWeekOpenUtc(weekOpenUtc) ?? weekOpenUtc;
    const beforeStrength = new Map((beforePairStrengths.get(normalizedWeek) ?? []).map((row) => [strengthKey(row), row]));
    const afterStrength = new Map((afterPairStrengths.get(normalizedWeek) ?? []).map((row) => [strengthKey(row), row]));
    for (const assetClass of ASSET_CLASSES) {
      for (const pairDef of PAIRS_BY_ASSET_CLASS[assetClass]) {
        const symbol = pairDef.pair.toUpperCase();
        const key = `${normalizedWeek}|strength|${symbol}`;
        const beforeSignal = beforeDirectionMap.get(key) ?? null;
        const afterSignal = afterDirectionMap.get(key) ?? null;
        const before = beforeStrength.get(symbol) ?? null;
        const after = afterStrength.get(symbol) ?? null;
        const beforeMeta = beforeSignal?.metadata ?? {};
        const afterMeta = afterSignal?.metadata ?? {};
        const raw1wBefore = toNumber(beforeMeta.raw1w as number | string | null | undefined);
        const raw1wAfter = toNumber(afterMeta.raw1w as number | string | null | undefined);
        const raw1mBefore = toNumber(beforeMeta.raw1m as number | string | null | undefined);
        const raw1mAfter = toNumber(afterMeta.raw1m as number | string | null | undefined);
        const compositeBefore = toNumber(beforeMeta.compositeScore as number | string | null | undefined);
        const compositeAfter = toNumber(afterMeta.compositeScore as number | string | null | undefined);
        rows.push({
          weekOpenUtc: normalizedWeek,
          symbol,
          assetClass,
          directionBefore: beforeSignal?.direction ?? "NEUTRAL",
          directionAfter: afterSignal?.direction ?? "NEUTRAL",
          compositeBefore,
          compositeAfter,
          compositeDelta: numberDelta(compositeBefore, compositeAfter),
          raw1wBefore,
          raw1wAfter,
          raw1wDelta: numberDelta(raw1wBefore, raw1wAfter),
          raw1mBefore,
          raw1mAfter,
          raw1mDelta: numberDelta(raw1mBefore, raw1mAfter),
          latestSnapshotBefore: before?.latestSnapshotUtc ?? null,
          latestSnapshotAfter: after?.latestSnapshotUtc ?? null,
          windowDeltas: ["1h", "4h", "24h"].map((window) => {
            const beforeWindow = before?.windows.find((row) => row.window === window);
            const afterWindow = after?.windows.find((row) => row.window === window);
            const beforeValue = beforeWindow?.signedSpread ?? null;
            const afterValue = afterWindow?.signedSpread ?? null;
            return {
              window,
              before: beforeValue,
              after: afterValue,
              delta: numberDelta(beforeValue, afterValue),
            };
          }),
        });
      }
    }
  }

  return rows;
}

function changedStrengthNumberRows(rows: StrengthNumberDelta[]) {
  return rows.filter((row) => (
    row.directionBefore !== row.directionAfter ||
    row.compositeDelta !== 0 ||
    row.raw1wDelta !== 0 ||
    row.raw1mDelta !== 0 ||
    row.windowDeltas.some((item) => item.delta !== 0)
  ));
}

function summarizeBy<T extends string>(
  rows: Array<Record<T, string>>,
  key: T,
) {
  const counts = new Map<string, number>();
  for (const row of rows) {
    counts.set(row[key], (counts.get(row[key]) ?? 0) + 1);
  }
  return Object.fromEntries([...counts.entries()].sort());
}

function summarizeMissingOrStaleNotes(notes: string[]) {
  const counts = new Map<string, number>();
  for (const note of notes) {
    const issue = note.includes("raw_provider_evidence_missing")
      ? "raw_provider_evidence_missing"
      : note.includes("Current app execution anchor")
        ? "current_app_execution_anchor_not_used"
        : note.includes("Selected execution anchor")
          ? "selected_execution_anchor_incomplete"
          : note.includes("missing execution returns")
            ? "missing_execution_returns"
            : "other";
    counts.set(issue, (counts.get(issue) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([issue, count]) => ({ issue, count }));
}

function buildMarkdown(report: any) {
  const lines: string[] = [];
  lines.push("# Snapshot Regime Comparison Evidence");
  lines.push("");
  lines.push(`Generated: ${report.generatedAtUtc}`);
  lines.push("");
  lines.push("## Guardrails");
  lines.push("");
  lines.push("- Read-only evidence report.");
  lines.push("- No canon regeneration.");
  lines.push("- No 19-week baseline retirement.");
  lines.push("- No UI refactor or app patching.");
  lines.push("- `v2.0.2` remains a usable app-shell reference only; its data is not treated as truth here.");
  lines.push("- Current `v2.0.3` app state remains evidence/quarantine, not release base.");
  lines.push("");
  lines.push("## Scope");
  lines.push("");
  lines.push(`- Window: clean14, ${report.scope.weeks[0]} through ${report.scope.weeks.at(-1)}.`);
  lines.push("- Sources: Dealer, Commercial, Sentiment, Strength.");
  lines.push(`- Performance return source: \`pair_period_returns\`, weekly, \`anchor_type=execution\`, \`anchor_version=${report.scope.executionAnchorVersion}\`.`);
  lines.push(`- Current app execution anchor: \`${report.scope.currentAppExecutionAnchorVersion}\`.`);
  lines.push("- Performance calculation: source-model standalone basket sum using the same execution return rows for both regimes. Missing return rows produce `null`, not filled values.");
  lines.push("");
  lines.push("## Regimes");
  lines.push("");
  lines.push("- Sunday/Monday regime: legacy/current weekly basket source path, using COT report-date snapshots, sentiment week-start resolver, and locked/week-open strength snapshots where available.");
  lines.push("- Friday 5 PM ET regime: in-memory `buildFrozenSourceLedgerWeek()` at Friday 17:00 America/New_York, not persisted by this report.");
  lines.push("");
  lines.push("## Execution Return Anchor Coverage");
  lines.push("");
  lines.push(`Selected comparison anchor: \`${report.executionAnchorCoverage.selectedCoverage.anchorVersion}\` (${report.executionAnchorCoverage.selectedCoverage.completeForClean14 ? "complete" : "incomplete"} for clean14).`);
  lines.push(`Current app anchor: \`${report.executionAnchorCoverage.currentAppCoverage.anchorVersion}\` (${report.executionAnchorCoverage.currentAppCoverage.completeForClean14 ? "complete" : "incomplete"} for clean14).`);
  lines.push("Selection rationale: the selected anchor is complete for clean14; incomplete/absent anchors are reported but not used for aggregate deltas.");
  lines.push("");
  lines.push("| Anchor | Weeks Covered | Complete Weeks | Rows | Sources | Complete Clean14 |");
  lines.push("| --- | ---: | ---: | ---: | --- | --- |");
  for (const row of report.executionAnchorCoverage.anchors) {
    lines.push(`| ${row.anchorVersion} | ${row.weeksCovered}/${row.expectedWeeks} | ${row.completeWeeks}/${row.expectedWeeks} | ${formatCount(row.rows)} | ${row.sources.join(", ") || "-"} | ${row.completeForClean14 ? "yes" : "no"} |`);
  }
  if (!report.executionAnchorCoverage.anchors.some((row: any) => row.anchorVersion === report.scope.currentAppExecutionAnchorVersion)) {
    lines.push(`| ${report.scope.currentAppExecutionAnchorVersion} | 0/${report.scope.weeks.length} | 0/${report.scope.weeks.length} | 0 | - | no |`);
  }
  lines.push("");
  lines.push("## Source Completeness");
  lines.push("");
  lines.push("| Regime | Rows | Complete | Trusted | Incident Rows | Incidents |");
  lines.push("| --- | ---: | ---: | ---: | ---: | ---: |");
  for (const row of report.sourceCompletenessTotals) {
    lines.push(`| ${row.regime} | ${formatCount(row.rows)} | ${formatCount(row.completeRows)} | ${formatCount(row.trustedRows)} | ${formatCount(row.incidentRows)} | ${formatCount(row.incidentCount)} |`);
  }
  lines.push("");
  lines.push("## Signal Changes");
  lines.push("");
  lines.push(`Total changed pair/source signals: ${formatCount(report.signalChanges.length)}.`);
  lines.push("");
  lines.push("| Source | Changed Signals |");
  lines.push("| --- | ---: |");
  for (const [source, count] of Object.entries(report.signalChangeCountsBySource)) {
    lines.push(`| ${source} | ${count} |`);
  }
  lines.push("");
  lines.push("Top changed signal rows:");
  lines.push("");
  lines.push("| Week | Source | Symbol | Asset | Sunday/Monday | Friday 5 PM ET |");
  lines.push("| --- | --- | --- | --- | --- | --- |");
  for (const row of report.signalChanges.slice(0, 80)) {
    lines.push(`| ${row.weekOpenUtc.slice(0, 10)} | ${row.source} | ${row.symbol} | ${row.assetClass} | ${row.before} | ${row.after} |`);
  }
  if (report.signalChanges.length > 80) {
    lines.push(`| ... | ... | ... | ... | ... | ${report.signalChanges.length - 80} more rows in JSON |`);
  }
  lines.push("");
  lines.push("## Strength Number Deltas");
  lines.push("");
  lines.push(`Strength rows with any numeric/direction delta: ${formatCount(report.changedStrengthNumberRows.length)} of ${formatCount(report.strengthNumberDeltas.length)}.`);
  lines.push("");
  lines.push("| Week | Symbol | Asset | Direction Before | Direction After | Composite Delta | Raw 1W Delta | Raw 1M Delta | Latest Before | Latest After |");
  lines.push("| --- | --- | --- | --- | --- | ---: | ---: | ---: | --- | --- |");
  for (const row of report.changedStrengthNumberRows.slice(0, 80)) {
    lines.push(`| ${row.weekOpenUtc.slice(0, 10)} | ${row.symbol} | ${row.assetClass} | ${row.directionBefore} | ${row.directionAfter} | ${row.compositeDelta ?? "n/a"} | ${row.raw1wDelta ?? "n/a"} | ${row.raw1mDelta ?? "n/a"} | ${row.latestSnapshotBefore ?? "n/a"} | ${row.latestSnapshotAfter ?? "n/a"} |`);
  }
  if (report.changedStrengthNumberRows.length > 80) {
    lines.push(`| ... | ... | ... | ... | ... | ... | ... | ... | ... | ${report.changedStrengthNumberRows.length - 80} more rows in JSON |`);
  }
  lines.push("");
  lines.push("## Performance Deltas");
  lines.push("");
  lines.push("| Source | Weeks | Comparable Weeks | Sunday/Monday Return | Friday 5 PM ET Return | Delta |");
  lines.push("| --- | ---: | ---: | ---: | ---: | ---: |");
  for (const row of report.performanceAggregateDeltas) {
    lines.push(`| ${row.source} | ${row.weeks} | ${row.comparableWeeks} | ${formatSigned(row.beforeReturnPct)} | ${formatSigned(row.afterReturnPct)} | ${formatSigned(row.deltaReturnPct)} |`);
  }
  lines.push("");
  lines.push("Per-week performance delta rows with non-zero or missing delta:");
  lines.push("");
  lines.push("| Week | Source | Sunday/Monday | Friday 5 PM ET | Delta | Missing Before | Missing After |");
  lines.push("| --- | --- | ---: | ---: | ---: | --- | --- |");
  for (const row of report.performanceDeltas.filter((item: any) => item.deltaReturnPct !== 0 || item.beforeReturnPct === null || item.afterReturnPct === null).slice(0, 120)) {
    lines.push(`| ${row.weekOpenUtc.slice(0, 10)} | ${row.source} | ${formatSigned(row.beforeReturnPct)} | ${formatSigned(row.afterReturnPct)} | ${formatSigned(row.deltaReturnPct)} | ${(row.missingReturnRowsBefore ?? []).join(", ") || "-" } | ${(row.missingReturnRowsAfter ?? []).join(", ") || "-" } |`);
  }
  lines.push("");
  lines.push("## Missing Or Stale Data Notes");
  lines.push("");
  lines.push("| Issue | Count |");
  lines.push("| --- | ---: |");
  for (const row of report.missingOrStaleSummary) {
    lines.push(`| ${row.issue} | ${formatCount(row.count)} |`);
  }
  lines.push("");
  lines.push("Full notes:");
  lines.push("");
  for (const note of report.missingOrStaleNotes) {
    lines.push(`- ${note}`);
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
  const beforeSignals: ReportSignal[] = [];
  const afterSignals: ReportSignal[] = [];
  const frozenLedgers: FrozenSourceLedgerWeek[] = [];
  const performanceBefore: PerformanceSummary[] = [];
  const performanceAfter: PerformanceSummary[] = [];
  const beforePairStrengths = new Map<string, WeeklyPairStrength[]>();
  const afterPairStrengths = new Map<string, WeeklyPairStrength[]>();
  const missingOrStaleNotes = new Set<string>();
  const executionAnchorCoverage = await loadExecutionAnchorCoverage(weeks);

  if (!executionAnchorCoverage.selectedCoverage.completeForClean14) {
    missingOrStaleNotes.add(
      `Selected execution anchor ${SELECTED_EXECUTION_ANCHOR_VERSION} is incomplete for clean14: ` +
      `${executionAnchorCoverage.selectedCoverage.completeWeeks}/${weeks.length} complete weeks, ` +
      `${executionAnchorCoverage.selectedCoverage.weeksCovered}/${weeks.length} weeks covered.`,
    );
  }
  if (CURRENT_APP_EXECUTION_ANCHOR_VERSION !== SELECTED_EXECUTION_ANCHOR_VERSION) {
    missingOrStaleNotes.add(
      `Current app execution anchor ${CURRENT_APP_EXECUTION_ANCHOR_VERSION} is not used for this report; ` +
      `clean14 coverage is ${executionAnchorCoverage.currentAppCoverage.weeksCovered}/${weeks.length} weeks and ` +
      `${executionAnchorCoverage.currentAppCoverage.completeWeeks}/${weeks.length} complete weeks. ` +
      `Comparison anchor is ${SELECTED_EXECUTION_ANCHOR_VERSION}.`,
    );
  }

  for (const weekOpenUtc of weeks) {
    const freezeTargetUtc = getFridayFreezeTargetUtc(weekOpenUtc);
    const [legacySignals, friday, returns, legacyStrengthRows, fridayStrengthRows] = await Promise.all([
      buildLegacyWeekSignals(weekOpenUtc),
      buildFridayWeekSignals(weekOpenUtc),
      loadExecutionReturns(weekOpenUtc),
      readWeeklyPairStrengths(weekOpenUtc),
      readWeeklyPairStrengthsAtCutoff(freezeTargetUtc),
    ]);

    beforeSignals.push(...legacySignals);
    afterSignals.push(...friday.signals);
    frozenLedgers.push(friday.ledger);
    beforePairStrengths.set(weekOpenUtc, legacyStrengthRows);
    afterPairStrengths.set(weekOpenUtc, fridayStrengthRows);

    if (returns.size === 0) {
      missingOrStaleNotes.add(`${weekOpenUtc.slice(0, 10)} has no execution weekly return rows for anchor ${SELECTED_EXECUTION_ANCHOR_VERSION}.`);
    }

    for (const source of SOURCES) {
      performanceBefore.push(summarizePerformance(weekOpenUtc, source, "sunday_monday", legacySignals, returns));
      performanceAfter.push(summarizePerformance(weekOpenUtc, source, "friday_1700_et", friday.signals, returns));
    }

    const fridayFailed = friday.ledger.summaries.filter((summary) => !summary.complete || !summary.trustedForFreeze);
    for (const summary of fridayFailed) {
      missingOrStaleNotes.add(`${weekOpenUtc.slice(0, 10)} Friday ${summary.source} incomplete/untrusted: ${summary.incidents.join("; ") || "no incident detail"}.`);
    }
  }

  const sourceCompletenessBefore = summarizeSourceCompleteness(beforeSignals);
  const sourceCompletenessAfter = summarizeSourceCompleteness(afterSignals);
  const sourceCompletenessTotals = [
    {
      regime: "sunday_monday",
      rows: sourceCompletenessBefore.reduce((sum, row) => sum + row.rows, 0),
      completeRows: sourceCompletenessBefore.reduce((sum, row) => sum + row.completeRows, 0),
      trustedRows: sourceCompletenessBefore.reduce((sum, row) => sum + row.trustedRows, 0),
      incidentRows: sourceCompletenessBefore.reduce((sum, row) => sum + row.incidentRows, 0),
      incidentCount: sourceCompletenessBefore.reduce((sum, row) => sum + row.incidentCount, 0),
    },
    {
      regime: "friday_1700_et",
      rows: sourceCompletenessAfter.reduce((sum, row) => sum + row.rows, 0),
      completeRows: sourceCompletenessAfter.reduce((sum, row) => sum + row.completeRows, 0),
      trustedRows: sourceCompletenessAfter.reduce((sum, row) => sum + row.trustedRows, 0),
      incidentRows: sourceCompletenessAfter.reduce((sum, row) => sum + row.incidentRows, 0),
      incidentCount: sourceCompletenessAfter.reduce((sum, row) => sum + row.incidentCount, 0),
    },
  ];
  const signalChanges = buildSignalChanges(beforeSignals, afterSignals);
  const performanceDeltas = buildPerformanceDeltas(performanceBefore, performanceAfter);
  const strengthNumberDeltas = buildStrengthNumberDeltas(
    beforeSignals,
    afterSignals,
    beforePairStrengths,
    afterPairStrengths,
  );
  const changedStrengthRows = changedStrengthNumberRows(strengthNumberDeltas);

  for (const signal of [...beforeSignals, ...afterSignals]) {
    for (const incident of signal.incidents) {
      missingOrStaleNotes.add(`${signal.weekOpenUtc.slice(0, 10)} ${signal.source} ${signal.symbol}: ${incident}.`);
    }
  }
  for (const row of [...performanceBefore, ...performanceAfter]) {
    if (row.missingReturnRows.length > 0) {
      missingOrStaleNotes.add(`${row.weekOpenUtc.slice(0, 10)} ${row.regime} ${row.source} missing execution returns: ${row.missingReturnRows.join(", ")}.`);
    }
  }

  await mkdir(OUTPUT_DIR, { recursive: true });
  const jsonPath = path.join(OUTPUT_DIR, "clean14-sunday-vs-friday-regime-report.json");
  const markdownPath = path.join(OUTPUT_DIR, "clean14-sunday-vs-friday-regime-report.md");
  const sortedMissingOrStaleNotes = [...missingOrStaleNotes].sort();

  const report = {
    generatedAtUtc,
    scope: {
      releaseWindow: "v2.0.3-clean-14w",
      weeks,
      sources: SOURCES,
      executionAnchorVersion: SELECTED_EXECUTION_ANCHOR_VERSION,
      defaultComparisonExecutionAnchorVersion: DEFAULT_COMPARISON_EXECUTION_ANCHOR_VERSION,
      currentAppExecutionAnchorVersion: CURRENT_APP_EXECUTION_ANCHOR_VERSION,
      notes: [
        "v2.0.2 is a usable app-shell reference only; this report does not trust v2.0.2 data blindly.",
        "current v2.0.3 app state is evidence/quarantine, not release base.",
        "Friday regime uses in-memory buildFrozenSourceLedgerWeek and does not persist rows.",
        "Performance deltas use a single selected execution return anchor for both regimes.",
      ],
    },
    regimes: {
      sunday_monday: {
        label: "Sunday/Monday legacy weekly basket source path",
        persisted: false,
      },
      friday_1700_et: {
        label: "Friday 17:00 America/New_York source-freeze path",
        persisted: false,
      },
    },
    sourceCompletenessBefore,
    sourceCompletenessAfter,
    sourceCompletenessTotals,
    signalChanges,
    signalChangeCountsBySource: summarizeBy(signalChanges as Array<Record<"source", string>>, "source"),
    strengthNumberDeltas,
    changedStrengthNumberRows: changedStrengthRows,
    performanceBefore,
    performanceAfter,
    performanceDeltas,
    performanceAggregateDeltas: aggregatePerformance(performanceDeltas),
    executionAnchorCoverage,
    frozenLedgerSummaries: frozenLedgers.map((ledger) => ({
      weekOpenUtc: ledger.weekOpenUtc,
      freezeTargetUtc: ledger.freezeTargetUtc,
      complete: ledger.complete,
      trustedForFreeze: ledger.trustedForFreeze,
      sourceHash: ledger.sourceHash,
      summaries: ledger.summaries,
    })),
    missingOrStaleSummary: summarizeMissingOrStaleNotes(sortedMissingOrStaleNotes),
    missingOrStaleNotes: sortedMissingOrStaleNotes,
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
    signalChanges: signalChanges.length,
    changedStrengthNumberRows: changedStrengthRows.length,
    performanceAggregateDeltas: report.performanceAggregateDeltas,
    missingOrStaleNotes: report.missingOrStaleNotes.length,
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
