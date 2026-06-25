import { DateTime } from "luxon";

import { getCanonicalWeekWindow } from "@/lib/canonicalPriceWindows";
import { MAJOR_CURRENCIES, type MajorCurrency } from "@/lib/currencyStrength";
import { PAIRS_BY_ASSET_CLASS } from "@/lib/cotPairs";
import type { Direction } from "@/lib/cotTypes";
import { query } from "@/lib/db";
import { getFridayFreezeTargetUtc } from "@/lib/sourceFreeze/fridayFreeze";
import { normalizeWeekOpenUtc } from "@/lib/weekAnchor";

export type HistoricalStrengthWindow = "15m" | "30m" | "1h" | "4h" | "24h" | "1w" | "1m";

export type FxStrengthHistorySnapshot = {
  snapshotTimeUtc: string;
  assetClass: "fx";
  sourceType: "currency";
  window: HistoricalStrengthWindow;
  key: MajorCurrency;
  rawStrength: number | null;
  normalizedStrength: number | null;
  coverageExpectedBars: number;
  coverageActualBars: number;
  coveragePct: number;
  contributingPairs: number;
  sourceTimeframe: "1m";
  sourceProvider: string;
  derivationVersion: string;
};

export type FxStrengthHistoryDerivationSummary = {
  fromUtc: string;
  toUtc: string;
  cadenceMinutes: number;
  windows: HistoricalStrengthWindow[];
  snapshotsGenerated: number;
  rowsGenerated: number;
  completeRows: number;
  incompleteRows: number;
  minCoveragePct: number;
  maxCoveragePct: number;
};

export type FxStrengthHistoryDerivationResult = {
  summary: FxStrengthHistoryDerivationSummary;
  snapshots: FxStrengthHistorySnapshot[];
};

export type FxStrengthHistoryIndex = {
  derivationVersion: string;
  windows: HistoricalStrengthWindow[];
  rowsByCurrencyWindow: Map<string, FxStrengthHistorySnapshot[]>;
};

export type FxStrengthHistoryLookupMode = "at_or_before" | "at_or_after";

export type FxPairStrengthWindowLookup = {
  pair: string;
  window: HistoricalStrengthWindow;
  timestampUtc: string;
  lookupMode: FxStrengthHistoryLookupMode;
  available: boolean;
  baseSymbol: MajorCurrency;
  quoteSymbol: MajorCurrency;
  baseSnapshotTimeUtc: string | null;
  quoteSnapshotTimeUtc: string | null;
  rawBase: number | null;
  rawQuote: number | null;
  normalizedBase: number | null;
  normalizedQuote: number | null;
  coverageBasePct: number | null;
  coverageQuotePct: number | null;
  signedSpread: number | null;
  direction: Direction;
};

export type FxWeeklyStrengthDecisionPointId = "friday_close" | "market_open_confirmation";

export type FxWeeklyStrengthDecisionPoint = {
  id: FxWeeklyStrengthDecisionPointId;
  requestedTimeUtc: string;
  lookupMode: FxStrengthHistoryLookupMode;
  maxForwardMinutes: number | null;
};

export type FxWeeklyPairStrengthDecision = {
  weekOpenUtc: string;
  pair: string;
  pointId: FxWeeklyStrengthDecisionPointId;
  requestedTimeUtc: string;
  resolvedTimeUtc: string | null;
  available: boolean;
  direction: Direction;
  compositeScore: number | null;
  availableWindows: number;
  windows: FxPairStrengthWindowLookup[];
  missingReason: string | null;
};

export type FxWeeklyStrengthContext = {
  weekOpenUtc: string;
  points: FxWeeklyStrengthDecisionPoint[];
  rows: FxWeeklyPairStrengthDecision[];
};

type CanonicalM1Bar = {
  symbol: string;
  openMs: number;
  closeMs: number;
  openPrice: number;
  closePrice: number;
  sourceProvider: string;
};

type PairWindowReturn = {
  pair: string;
  base: MajorCurrency;
  quote: MajorCurrency;
  returnPct: number | null;
  expectedBars: number;
  actualBars: number;
};

const FX_STRENGTH_SOURCE_PROVIDER = "canonical_price_bars";
export const FX_M1_STRENGTH_DERIVATION_VERSION = "fx_m1_currency_strength_v1";
export const DEFAULT_FX_STRENGTH_HISTORY_WINDOWS: HistoricalStrengthWindow[] = [
  "15m",
  "30m",
  "1h",
  "4h",
  "24h",
  "1w",
  "1m",
];

const WINDOW_MINUTES: Record<HistoricalStrengthWindow, number> = {
  "15m": 15,
  "30m": 30,
  "1h": 60,
  "4h": 240,
  "24h": 1440,
  "1w": 7200,
  "1m": 28800,
};

export const INSTITUTIONAL_M1_PAIR_COVERAGE_PCT = 100;
const DEFAULT_MIN_PAIR_COVERAGE_PCT = INSTITUTIONAL_M1_PAIR_COVERAGE_PCT;
const STRENGTH_DIRECTION_THRESHOLD = 5;
const WRITE_BATCH_SIZE = 500;
const MAX_SOURCE_FRESH_LAG_MS = 60_000;
const MAX_SESSION_REOPEN_LAG_MS = 360 * 60_000;
const DEFAULT_MARKET_OPEN_FORWARD_MINUTES = 180;

const FX_PAIR_MAP = PAIRS_BY_ASSET_CLASS.fx.map((pairDef) => ({
  pair: pairDef.pair.toUpperCase(),
  base: pairDef.base.toUpperCase() as MajorCurrency,
  quote: pairDef.quote.toUpperCase() as MajorCurrency,
}));

const FX_PAIR_BY_SYMBOL = new Map(FX_PAIR_MAP.map((row) => [row.pair, row]));

let ensuredStrengthHistorySchema = false;

async function tryLoadLocalFxM1BarsByPair(fromUtc: string, toUtc: string): Promise<Map<string, CanonicalM1Bar[]> | null> {
  const warehouse = await import("@/lib/research/localM1Warehouse");
  if (!warehouse.shouldUseLocalM1Warehouse("1m")) return null;
  const symbols = FX_PAIR_MAP.map((row) => row.pair);
  const localBars = warehouse.readLocalM1Bars(symbols, fromUtc, toUtc, "1m");
  const byPair = new Map<string, CanonicalM1Bar[]>();
  for (const symbol of symbols) {
    byPair.set(
      symbol,
      (localBars.get(symbol) ?? []).map((bar) => ({
        symbol,
        openMs: Date.parse(bar.barOpenUtc),
        closeMs: Date.parse(bar.barCloseUtc),
        openPrice: bar.openPrice,
        closePrice: bar.closePrice,
        sourceProvider: bar.sourceProvider,
      })),
    );
  }
  return byPair;
}

async function tryWriteLocalFxStrengthHistorySnapshots(rows: FxStrengthHistorySnapshot[]): Promise<number | null> {
  const warehouse = await import("@/lib/research/localM1Warehouse");
  if (!warehouse.shouldUseLocalStrengthWarehouse()) return null;
  return warehouse.writeLocalStrengthHistorySnapshots(rows);
}

async function tryReadLocalFxStrengthHistoryIndex(options: {
  fromUtc: string;
  toUtc: string;
  windows?: HistoricalStrengthWindow[];
  derivationVersion?: string;
}): Promise<FxStrengthHistoryIndex | null> {
  const warehouse = await import("@/lib/research/localM1Warehouse");
  if (!warehouse.shouldUseLocalStrengthWarehouse()) return null;
  const windows = normalizeWindows(options.windows);
  const derivationVersion = options.derivationVersion ?? FX_M1_STRENGTH_DERIVATION_VERSION;
  const rows = warehouse.readLocalStrengthHistorySnapshots({
    fromUtc: options.fromUtc,
    toUtc: options.toUtc,
    windows,
    derivationVersion,
  });
  return buildFxStrengthHistoryIndex(
    rows.map((row) => ({
      snapshotTimeUtc: toIsoUtc(row.snapshotTimeUtc),
      assetClass: "fx",
      sourceType: "currency",
      window: row.window as HistoricalStrengthWindow,
      key: row.key as MajorCurrency,
      rawStrength: row.rawStrength,
      normalizedStrength: row.normalizedStrength,
      coverageExpectedBars: row.coverageExpectedBars,
      coverageActualBars: row.coverageActualBars,
      coveragePct: row.coveragePct,
      contributingPairs: row.contributingPairs,
      sourceTimeframe: row.sourceTimeframe,
      sourceProvider: row.sourceProvider,
      derivationVersion: row.derivationVersion,
    })),
    derivationVersion,
  );
}

function toIsoUtc(value: string | Date): string {
  if (value instanceof Date) return value.toISOString();
  const parsed = DateTime.fromISO(value, { zone: "utc" });
  return parsed.isValid ? parsed.toUTC().toISO() ?? value : value;
}

function parseUtc(value: string, label: string): DateTime {
  const parsed = DateTime.fromISO(value, { zone: "utc" });
  if (!parsed.isValid) {
    throw new Error(`Invalid ${label}: ${value}`);
  }
  return parsed.toUTC();
}

function round(value: number, digits = 6): number {
  return Number(value.toFixed(digits));
}

function normalizeWindows(windows?: HistoricalStrengthWindow[]): HistoricalStrengthWindow[] {
  const requested = windows && windows.length > 0 ? windows : DEFAULT_FX_STRENGTH_HISTORY_WINDOWS;
  return [...new Set(requested)].sort(
    (left, right) => WINDOW_MINUTES[left] - WINDOW_MINUTES[right],
  );
}

function normalizeCadenceMinutes(cadenceMinutes: number): number {
  if (!Number.isFinite(cadenceMinutes) || cadenceMinutes <= 0) {
    return 15;
  }
  return Math.max(1, Math.floor(cadenceMinutes));
}

function buildSnapshotTimes(fromUtc: DateTime, toUtc: DateTime, cadenceMinutes: number): DateTime[] {
  const times: DateTime[] = [];
  let cursor = fromUtc.plus({ minutes: cadenceMinutes });
  while (cursor <= toUtc) {
    times.push(cursor);
    cursor = cursor.plus({ minutes: cadenceMinutes });
  }
  return times;
}

function lowerBoundOpenMs(rows: CanonicalM1Bar[], targetMs: number): number {
  let lo = 0;
  let hi = rows.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if ((rows[mid]?.openMs ?? Number.POSITIVE_INFINITY) < targetMs) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

function lowerBoundNumber(values: number[], target: number): number {
  let lo = 0;
  let hi = values.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if ((values[mid] ?? Number.POSITIVE_INFINITY) < target) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

function isKnownFxHolidayClosure(openMs: number): boolean {
  const openUtc = DateTime.fromMillis(openMs, { zone: "utc" });
  for (const year of [openUtc.year - 1, openUtc.year]) {
    const christmasStart = DateTime.utc(year, 12, 24, 22, 0).toMillis();
    const christmasEnd = DateTime.utc(year, 12, 26, 22, 0).toMillis();
    const newYearStart = DateTime.utc(year, 12, 31, 22, 0).toMillis();
    const newYearEnd = DateTime.utc(year + 1, 1, 2, 22, 0).toMillis();
    if (
      (openMs >= christmasStart && openMs < christmasEnd) ||
      (openMs >= newYearStart && openMs < newYearEnd)
    ) {
      return true;
    }
  }
  return false;
}

function isRegularFxTradingMinute(openMs: number): boolean {
  const openNy = DateTime.fromMillis(openMs, { zone: "utc" }).setZone("America/New_York");
  const minuteOfDay = openNy.hour * 60 + openNy.minute;
  if (openNy.weekday === 6) return false;
  if (openNy.weekday === 7) return minuteOfDay >= 17 * 60;
  if (openNy.weekday === 5) return minuteOfDay < 17 * 60;
  return true;
}

function buildSessionMinuteIndex(barsByPair: Map<string, CanonicalM1Bar[]>): number[] {
  const openCounts = new Map<number, number>();
  for (const bars of barsByPair.values()) {
    let lastOpenMs: number | null = null;
    for (const bar of bars) {
      if (!Number.isFinite(bar.openMs) || bar.openMs === lastOpenMs) continue;
      openCounts.set(bar.openMs, (openCounts.get(bar.openMs) ?? 0) + 1);
      lastOpenMs = bar.openMs;
    }
  }
  const requiredPairs = barsByPair.size;
  return [...openCounts.entries()]
    .filter(([, count]) => count === requiredPairs)
    .map(([openMs]) => openMs)
    .sort((left, right) => left - right);
}

function firstExpectedFxTradingMinuteOnOrAfter(fromMs: number, toMs: number): number | null {
  const firstMinuteMs = Math.ceil(fromMs / 60_000) * 60_000;
  for (let openMs = firstMinuteMs; openMs < toMs; openMs += 60_000) {
    if (isRegularFxTradingMinute(openMs) && !isKnownFxHolidayClosure(openMs)) {
      return openMs;
    }
  }
  return null;
}

function hasWarmupCoverage(sessionOpenMs: number[], fromMs: number, toMs: number): boolean {
  const firstExpectedOpenMs = firstExpectedFxTradingMinuteOnOrAfter(fromMs, toMs);
  if (firstExpectedOpenMs === null) return true;
  const firstSessionIndex = lowerBoundNumber(sessionOpenMs, firstExpectedOpenMs);
  const firstSessionOpenMs = sessionOpenMs[firstSessionIndex];
  if (!Number.isFinite(firstSessionOpenMs)) return false;
  return firstSessionOpenMs <= firstExpectedOpenMs ||
    firstSessionOpenMs - firstExpectedOpenMs <= MAX_SESSION_REOPEN_LAG_MS;
}

function countSessionMinutes(sessionOpenMs: number[], fromMs: number, toMs: number): number {
  if (toMs <= fromMs || sessionOpenMs.length === 0) return 0;
  const startIndex = lowerBoundNumber(sessionOpenMs, fromMs);
  const endExclusive = lowerBoundNumber(sessionOpenMs, toMs);
  return Math.max(0, endExclusive - startIndex);
}

function classifySpread(spread: number | null): Direction {
  if (spread === null || !Number.isFinite(spread)) return "NEUTRAL";
  if (spread > STRENGTH_DIRECTION_THRESHOLD) return "LONG";
  if (spread < -STRENGTH_DIRECTION_THRESHOLD) return "SHORT";
  return "NEUTRAL";
}

function historyKey(window: HistoricalStrengthWindow, currency: string) {
  return `${window}:${currency.toUpperCase()}`;
}

function floorSnapshot(
  rows: FxStrengthHistorySnapshot[],
  timestampMs: number,
): FxStrengthHistorySnapshot | null {
  let lo = 0;
  let hi = rows.length - 1;
  let best = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const row = rows[mid];
    const rowMs = row ? Date.parse(row.snapshotTimeUtc) : Number.NaN;
    if (Number.isFinite(rowMs) && rowMs <= timestampMs) {
      best = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  for (let index = best; index >= 0; index -= 1) {
    const row = rows[index] ?? null;
    if (row?.rawStrength !== null && row?.normalizedStrength !== null) {
      return row;
    }
  }
  return null;
}

function ceilSnapshot(
  rows: FxStrengthHistorySnapshot[],
  timestampMs: number,
  maxForwardMinutes: number,
): FxStrengthHistorySnapshot | null {
  const maxMs = timestampMs + Math.max(0, maxForwardMinutes) * 60_000;
  let lo = 0;
  let hi = rows.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    const rowMs = Date.parse(rows[mid]?.snapshotTimeUtc ?? "");
    if (Number.isFinite(rowMs) && rowMs < timestampMs) lo = mid + 1;
    else hi = mid;
  }

  for (let index = lo; index < rows.length; index += 1) {
    const row = rows[index] ?? null;
    if (!row) continue;
    const rowMs = Date.parse(row.snapshotTimeUtc);
    if (!Number.isFinite(rowMs) || rowMs > maxMs) return null;
    if (row.rawStrength !== null && row.normalizedStrength !== null) {
      return row;
    }
  }
  return null;
}

function findSnapshotForLookup(
  rows: FxStrengthHistorySnapshot[],
  timestampMs: number,
  lookupMode: FxStrengthHistoryLookupMode,
  maxForwardMinutes: number,
): FxStrengthHistorySnapshot | null {
  return lookupMode === "at_or_after"
    ? ceilSnapshot(rows, timestampMs, maxForwardMinutes)
    : floorSnapshot(rows, timestampMs);
}

function mostRecentResolvedTime(rows: FxPairStrengthWindowLookup[]): string | null {
  const times = rows
    .flatMap((row) => [row.baseSnapshotTimeUtc, row.quoteSnapshotTimeUtc])
    .filter((value): value is string => Boolean(value))
    .map((value) => Date.parse(value))
    .filter((value) => Number.isFinite(value));
  if (times.length === 0) return null;
  return new Date(Math.max(...times)).toISOString();
}

function classifyCompositeStrength(rows: FxPairStrengthWindowLookup[]): {
  direction: Direction;
  compositeScore: number | null;
  availableWindows: number;
  missingReason: string | null;
} {
  let score = 0;
  let signedSpreadSum = 0;
  let availableWindows = 0;
  for (const row of rows) {
    if (!row.available) continue;
    availableWindows += 1;
    if (row.direction === "LONG") score += 1;
    else if (row.direction === "SHORT") score -= 1;
    if (row.signedSpread !== null && Number.isFinite(row.signedSpread)) {
      signedSpreadSum += row.signedSpread;
    }
  }
  if (availableWindows === 0) {
    return {
      direction: "NEUTRAL",
      compositeScore: null,
      availableWindows,
      missingReason: "missing_strength_windows",
    };
  }
  if (score > 0) {
    return { direction: "LONG", compositeScore: score, availableWindows, missingReason: null };
  }
  if (score < 0) {
    return { direction: "SHORT", compositeScore: score, availableWindows, missingReason: null };
  }
  if (signedSpreadSum > 0) {
    return { direction: "LONG", compositeScore: score, availableWindows, missingReason: null };
  }
  if (signedSpreadSum < 0) {
    return { direction: "SHORT", compositeScore: score, availableWindows, missingReason: null };
  }
  return {
    direction: "LONG",
    compositeScore: score,
    availableWindows,
    missingReason: null,
  };
}

async function loadFxM1BarsByPair(fromUtc: string, toUtc: string): Promise<Map<string, CanonicalM1Bar[]>> {
  const localBars = await tryLoadLocalFxM1BarsByPair(fromUtc, toUtc);
  if (localBars) return localBars;

  const symbols = FX_PAIR_MAP.map((row) => row.pair);
  const rows = await query<{
    symbol: string;
    bar_open_utc: Date;
    bar_close_utc: Date;
    open_price: number | string;
    close_price: number | string;
    source_provider: string;
  }>(
    `SELECT symbol, bar_open_utc, bar_close_utc, open_price, close_price, source_provider
       FROM canonical_price_bars
      WHERE asset_class = 'fx'
        AND timeframe = '1m'
        AND symbol = ANY($1::text[])
        AND bar_open_utc >= $2::timestamptz
        AND bar_open_utc < $3::timestamptz
      ORDER BY symbol ASC, bar_open_utc ASC`,
    [symbols, fromUtc, toUtc],
  );

  const byPair = new Map<string, CanonicalM1Bar[]>();
  for (const symbol of symbols) {
    byPair.set(symbol, []);
  }

  for (const row of rows) {
    const symbol = row.symbol.toUpperCase();
    const bars = byPair.get(symbol);
    if (!bars) continue;
    bars.push({
      symbol,
      openMs: row.bar_open_utc.getTime(),
      closeMs: row.bar_close_utc.getTime(),
      openPrice: Number(row.open_price),
      closePrice: Number(row.close_price),
      sourceProvider: row.source_provider,
    });
  }

  return byPair;
}

function computePairWindowReturn(options: {
  pair: string;
  base: MajorCurrency;
  quote: MajorCurrency;
  bars: CanonicalM1Bar[];
  snapshotMs: number;
  windowMinutes: number;
  expectedBars: number;
  warmupComplete: boolean;
  minPairCoveragePct: number;
}): PairWindowReturn {
  const windowStartMs = options.snapshotMs - options.windowMinutes * 60_000;
  const startIndex = lowerBoundOpenMs(options.bars, windowStartMs);
  const endExclusive = lowerBoundOpenMs(options.bars, options.snapshotMs);
  const actualBars = Math.max(0, endExclusive - startIndex);
  const rawExpectedBars = options.warmupComplete
    ? Math.max(0, options.expectedBars)
    : Math.max(0, options.expectedBars, actualBars + 1);
  const expectedBars = options.warmupComplete && actualBars > 0
    ? Math.min(rawExpectedBars, actualBars)
    : rawExpectedBars;
  const coveragePct = expectedBars > 0 ? Math.min(100, (actualBars / expectedBars) * 100) : 0;
  const first = options.bars[startIndex];
  const last = options.bars[endExclusive - 1];

  if (
    !options.warmupComplete ||
    expectedBars <= 0 ||
    !first ||
    !last ||
    !(first.openPrice > 0) ||
    options.snapshotMs - last.closeMs > MAX_SOURCE_FRESH_LAG_MS ||
    coveragePct < options.minPairCoveragePct
  ) {
    return {
      pair: options.pair,
      base: options.base,
      quote: options.quote,
      returnPct: null,
      expectedBars,
      actualBars,
    };
  }

  return {
    pair: options.pair,
    base: options.base,
    quote: options.quote,
    returnPct: ((last.closePrice - first.openPrice) / first.openPrice) * 100,
    expectedBars,
    actualBars,
  };
}

function buildCurrencySnapshotsForWindow(options: {
  snapshotTimeUtc: string;
  window: HistoricalStrengthWindow;
  pairReturns: PairWindowReturn[];
  derivationVersion: string;
  minCoveragePct: number;
}): FxStrengthHistorySnapshot[] {
  const rows = MAJOR_CURRENCIES.map((currency) => {
    const related = options.pairReturns.filter((row) => row.base === currency || row.quote === currency);
    const values = related
      .map((row) => {
        if (row.returnPct === null) return null;
        return row.base === currency ? row.returnPct : -row.returnPct;
      })
      .filter((value): value is number => value !== null && Number.isFinite(value));
    const coverageExpectedBars = related.reduce((sum, row) => sum + row.expectedBars, 0);
    const coverageActualBars = related.reduce((sum, row) => sum + row.actualBars, 0);
    const coveragePct = coverageExpectedBars > 0
      ? Math.min(100, (coverageActualBars / coverageExpectedBars) * 100)
      : 0;
    const rawStrength = values.length > 0 && coveragePct >= options.minCoveragePct
      ? values.reduce((sum, value) => sum + value, 0) / values.length
      : null;

    return {
      snapshotTimeUtc: options.snapshotTimeUtc,
      assetClass: "fx" as const,
      sourceType: "currency" as const,
      window: options.window,
      key: currency,
      rawStrength,
      normalizedStrength: null as number | null,
      coverageExpectedBars,
      coverageActualBars,
      coveragePct: round(coveragePct, 4),
      contributingPairs: values.length,
      sourceTimeframe: "1m" as const,
      sourceProvider: FX_STRENGTH_SOURCE_PROVIDER,
      derivationVersion: options.derivationVersion,
    };
  });

  const rawValues = rows
    .map((row) => row.rawStrength)
    .filter((value): value is number => value !== null && Number.isFinite(value));
  const minRaw = rawValues.length > 0 ? Math.min(...rawValues) : null;
  const maxRaw = rawValues.length > 0 ? Math.max(...rawValues) : null;
  const span = minRaw !== null && maxRaw !== null ? maxRaw - minRaw : 0;

  return rows.map((row) => {
    if (row.rawStrength === null || minRaw === null || maxRaw === null) {
      return row;
    }
    return {
      ...row,
      rawStrength: round(row.rawStrength),
      normalizedStrength: span > 1e-12
        ? round(((row.rawStrength - minRaw) / span) * 100, 4)
        : 50,
    };
  });
}

export function estimateFxStrengthHistoryStorage(options: {
  cadenceMinutes: number;
  windows?: HistoricalStrengthWindow[];
  years?: number;
}) {
  const cadenceMinutes = normalizeCadenceMinutes(options.cadenceMinutes);
  const windows = normalizeWindows(options.windows);
  const years = Math.max(1, options.years ?? 7);
  const fxMinutesPerWeek = 5 * 24 * 60;
  const weeks = Math.ceil(years * 52);
  const snapshotsPerWeek = Math.ceil(fxMinutesPerWeek / cadenceMinutes);
  const snapshotCount = snapshotsPerWeek * weeks;
  const currencySnapshotRows = snapshotCount * windows.length * MAJOR_CURRENCIES.length;
  const pairSpreadCells = snapshotCount * windows.length * FX_PAIR_MAP.length;

  return {
    years,
    cadenceMinutes,
    windows,
    snapshotsPerWeek,
    snapshotCount,
    currencySnapshotRows,
    pairSpreadCells,
  };
}

export async function ensureStrengthHistorySchema(): Promise<void> {
  if (ensuredStrengthHistorySchema) return;
  await query(`
    CREATE TABLE IF NOT EXISTS strength_history_snapshots (
      snapshot_time_utc TIMESTAMPTZ NOT NULL,
      asset_class TEXT NOT NULL,
      source_type TEXT NOT NULL,
      "window" TEXT NOT NULL,
      "key" TEXT NOT NULL,
      raw_strength DOUBLE PRECISION,
      normalized_strength DOUBLE PRECISION,
      coverage_expected_bars INTEGER NOT NULL,
      coverage_actual_bars INTEGER NOT NULL,
      coverage_pct DOUBLE PRECISION NOT NULL,
      contributing_pairs INTEGER NOT NULL,
      source_timeframe TEXT NOT NULL,
      source_provider TEXT NOT NULL,
      derivation_version TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (
        snapshot_time_utc,
        asset_class,
        source_type,
        "window",
        "key",
        derivation_version
      )
    )
  `);
  await query(`
    CREATE INDEX IF NOT EXISTS idx_strength_history_lookup
      ON strength_history_snapshots (
        asset_class,
        source_type,
        "window",
        "key",
        derivation_version,
        snapshot_time_utc DESC
      )
  `);
  await query(`
    CREATE INDEX IF NOT EXISTS idx_strength_history_snapshot
      ON strength_history_snapshots (
        asset_class,
        derivation_version,
        snapshot_time_utc DESC
      )
  `);
  ensuredStrengthHistorySchema = true;
}

export async function deriveFxStrengthHistoryFromM1(options: {
  fromUtc: string;
  toUtc: string;
  cadenceMinutes?: number;
  windows?: HistoricalStrengthWindow[];
  minPairCoveragePct?: number;
  derivationVersion?: string;
}): Promise<FxStrengthHistoryDerivationResult> {
  const from = parseUtc(options.fromUtc, "fromUtc");
  const to = parseUtc(options.toUtc, "toUtc");
  if (to <= from) {
    throw new Error(`toUtc must be after fromUtc. from=${options.fromUtc} to=${options.toUtc}`);
  }

  const windows = normalizeWindows(options.windows);
  const cadenceMinutes = normalizeCadenceMinutes(options.cadenceMinutes ?? 15);
  const minPairCoveragePct = Math.max(0, Math.min(100, options.minPairCoveragePct ?? DEFAULT_MIN_PAIR_COVERAGE_PCT));
  const derivationVersion = options.derivationVersion ?? FX_M1_STRENGTH_DERIVATION_VERSION;
  const maxWindowMinutes = Math.max(...windows.map((window) => WINDOW_MINUTES[window]));
  const loadFrom = from.minus({ minutes: maxWindowMinutes }).toISO() ?? options.fromUtc;
  const barsByPair = await loadFxM1BarsByPair(loadFrom, to.toISO() ?? options.toUtc);
  const sessionOpenMs = buildSessionMinuteIndex(barsByPair);
  const snapshotTimes = buildSnapshotTimes(from, to, cadenceMinutes);
  const snapshots: FxStrengthHistorySnapshot[] = [];

  for (const snapshotTime of snapshotTimes) {
    const snapshotMs = snapshotTime.toMillis();
    for (const window of windows) {
      const windowMinutes = WINDOW_MINUTES[window];
      const windowStartMs = snapshotMs - windowMinutes * 60_000;
      const expectedBars = countSessionMinutes(sessionOpenMs, windowStartMs, snapshotMs);
      const warmupComplete = hasWarmupCoverage(sessionOpenMs, windowStartMs, snapshotMs);
      const pairReturns = FX_PAIR_MAP.map((pairDef) =>
        computePairWindowReturn({
          pair: pairDef.pair,
          base: pairDef.base,
          quote: pairDef.quote,
          bars: barsByPair.get(pairDef.pair) ?? [],
          snapshotMs,
          windowMinutes,
          expectedBars,
          warmupComplete,
          minPairCoveragePct,
        }),
      );
      snapshots.push(
        ...buildCurrencySnapshotsForWindow({
          snapshotTimeUtc: snapshotTime.toISO() ?? new Date(snapshotMs).toISOString(),
          window,
          pairReturns,
          derivationVersion,
          minCoveragePct: minPairCoveragePct,
        }),
      );
    }
  }

  let completeRows = 0;
  let minCoveragePct = Number.POSITIVE_INFINITY;
  let maxCoveragePct = Number.NEGATIVE_INFINITY;
  for (const row of snapshots) {
    if (row.rawStrength !== null && row.normalizedStrength !== null) completeRows += 1;
    minCoveragePct = Math.min(minCoveragePct, row.coveragePct);
    maxCoveragePct = Math.max(maxCoveragePct, row.coveragePct);
  }

  return {
    summary: {
      fromUtc: from.toISO() ?? options.fromUtc,
      toUtc: to.toISO() ?? options.toUtc,
      cadenceMinutes,
      windows,
      snapshotsGenerated: snapshotTimes.length,
      rowsGenerated: snapshots.length,
      completeRows,
      incompleteRows: snapshots.length - completeRows,
      minCoveragePct: snapshots.length ? round(minCoveragePct, 4) : 0,
      maxCoveragePct: snapshots.length ? round(maxCoveragePct, 4) : 0,
    },
    snapshots,
  };
}

export async function deriveFxStrengthHistoryAtTimesFromM1(options: {
  snapshotTimesUtc: string[];
  windows?: HistoricalStrengthWindow[];
  minPairCoveragePct?: number;
  derivationVersion?: string;
}): Promise<FxStrengthHistoryDerivationResult> {
  const snapshotTimes = [...new Set(options.snapshotTimesUtc)]
    .map((value) => parseUtc(value, "snapshotTimesUtc"))
    .sort((left, right) => left.toMillis() - right.toMillis());
  if (snapshotTimes.length === 0) {
    return {
      summary: {
        fromUtc: "",
        toUtc: "",
        cadenceMinutes: 0,
        windows: normalizeWindows(options.windows),
        snapshotsGenerated: 0,
        rowsGenerated: 0,
        completeRows: 0,
        incompleteRows: 0,
        minCoveragePct: 0,
        maxCoveragePct: 0,
      },
      snapshots: [],
    };
  }

  const windows = normalizeWindows(options.windows);
  const minPairCoveragePct = Math.max(0, Math.min(100, options.minPairCoveragePct ?? DEFAULT_MIN_PAIR_COVERAGE_PCT));
  const derivationVersion = options.derivationVersion ?? FX_M1_STRENGTH_DERIVATION_VERSION;
  const maxWindowMinutes = Math.max(...windows.map((window) => WINDOW_MINUTES[window]));
  const from = snapshotTimes[0]!;
  const to = snapshotTimes.at(-1)!;
  const loadFrom = from.minus({ minutes: maxWindowMinutes }).toISO() ?? from.toISO() ?? options.snapshotTimesUtc[0]!;
  const barsByPair = await loadFxM1BarsByPair(loadFrom, to.toISO() ?? options.snapshotTimesUtc.at(-1)!);
  const sessionOpenMs = buildSessionMinuteIndex(barsByPair);
  const snapshots: FxStrengthHistorySnapshot[] = [];

  for (const snapshotTime of snapshotTimes) {
    const snapshotMs = snapshotTime.toMillis();
    for (const window of windows) {
      const windowMinutes = WINDOW_MINUTES[window];
      const windowStartMs = snapshotMs - windowMinutes * 60_000;
      const expectedBars = countSessionMinutes(sessionOpenMs, windowStartMs, snapshotMs);
      const warmupComplete = hasWarmupCoverage(sessionOpenMs, windowStartMs, snapshotMs);
      const pairReturns = FX_PAIR_MAP.map((pairDef) =>
        computePairWindowReturn({
          pair: pairDef.pair,
          base: pairDef.base,
          quote: pairDef.quote,
          bars: barsByPair.get(pairDef.pair) ?? [],
          snapshotMs,
          windowMinutes,
          expectedBars,
          warmupComplete,
          minPairCoveragePct,
        }),
      );
      snapshots.push(
        ...buildCurrencySnapshotsForWindow({
          snapshotTimeUtc: snapshotTime.toISO() ?? new Date(snapshotMs).toISOString(),
          window,
          pairReturns,
          derivationVersion,
          minCoveragePct: minPairCoveragePct,
        }),
      );
    }
  }

  let completeRows = 0;
  let minCoveragePct = Number.POSITIVE_INFINITY;
  let maxCoveragePct = Number.NEGATIVE_INFINITY;
  for (const row of snapshots) {
    if (row.rawStrength !== null && row.normalizedStrength !== null) completeRows += 1;
    minCoveragePct = Math.min(minCoveragePct, row.coveragePct);
    maxCoveragePct = Math.max(maxCoveragePct, row.coveragePct);
  }

  return {
    summary: {
      fromUtc: from.toISO() ?? options.snapshotTimesUtc[0]!,
      toUtc: to.toISO() ?? options.snapshotTimesUtc.at(-1)!,
      cadenceMinutes: 0,
      windows,
      snapshotsGenerated: snapshotTimes.length,
      rowsGenerated: snapshots.length,
      completeRows,
      incompleteRows: snapshots.length - completeRows,
      minCoveragePct: snapshots.length ? round(minCoveragePct, 4) : 0,
      maxCoveragePct: snapshots.length ? round(maxCoveragePct, 4) : 0,
    },
    snapshots,
  };
}

export async function writeFxStrengthHistorySnapshots(rows: FxStrengthHistorySnapshot[]): Promise<number> {
  if (rows.length === 0) return 0;
  const localWritten = await tryWriteLocalFxStrengthHistorySnapshots(rows);
  if (localWritten !== null) return localWritten;
  await ensureStrengthHistorySchema();
  let written = 0;

  for (let start = 0; start < rows.length; start += WRITE_BATCH_SIZE) {
    const batch = rows.slice(start, start + WRITE_BATCH_SIZE);
    const params: unknown[] = [];
    const values = batch.map((row, index) => {
      const offset = index * 14;
      params.push(
        row.snapshotTimeUtc,
        row.assetClass,
        row.sourceType,
        row.window,
        row.key,
        row.rawStrength,
        row.normalizedStrength,
        row.coverageExpectedBars,
        row.coverageActualBars,
        row.coveragePct,
        row.contributingPairs,
        row.sourceTimeframe,
        row.sourceProvider,
        row.derivationVersion,
      );
      return `($${offset + 1}::timestamptz, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7}, $${offset + 8}, $${offset + 9}, $${offset + 10}, $${offset + 11}, $${offset + 12}, $${offset + 13}, $${offset + 14})`;
    }).join(", ");

    await query(
      `INSERT INTO strength_history_snapshots (
         snapshot_time_utc,
         asset_class,
         source_type,
         "window",
         "key",
         raw_strength,
         normalized_strength,
         coverage_expected_bars,
         coverage_actual_bars,
         coverage_pct,
         contributing_pairs,
         source_timeframe,
         source_provider,
         derivation_version
       )
       VALUES ${values}
       ON CONFLICT (
         snapshot_time_utc,
         asset_class,
         source_type,
         "window",
         "key",
         derivation_version
       )
       DO UPDATE SET
         raw_strength = EXCLUDED.raw_strength,
         normalized_strength = EXCLUDED.normalized_strength,
         coverage_expected_bars = EXCLUDED.coverage_expected_bars,
         coverage_actual_bars = EXCLUDED.coverage_actual_bars,
         coverage_pct = EXCLUDED.coverage_pct,
         contributing_pairs = EXCLUDED.contributing_pairs,
         source_timeframe = EXCLUDED.source_timeframe,
         source_provider = EXCLUDED.source_provider,
         updated_at = NOW()`,
      params,
    );
    written += batch.length;
  }

  return written;
}

export function buildFxStrengthHistoryIndex(
  snapshots: FxStrengthHistorySnapshot[],
  derivationVersion = FX_M1_STRENGTH_DERIVATION_VERSION,
): FxStrengthHistoryIndex {
  const rowsByCurrencyWindow = new Map<string, FxStrengthHistorySnapshot[]>();
  const windows = new Set<HistoricalStrengthWindow>();

  for (const row of snapshots) {
    windows.add(row.window);
    const key = historyKey(row.window, row.key);
    const rows = rowsByCurrencyWindow.get(key) ?? [];
    rows.push(row);
    rowsByCurrencyWindow.set(key, rows);
  }

  for (const rows of rowsByCurrencyWindow.values()) {
    rows.sort((left, right) => Date.parse(left.snapshotTimeUtc) - Date.parse(right.snapshotTimeUtc));
  }

  return {
    derivationVersion,
    windows: [...windows].sort((left, right) => WINDOW_MINUTES[left] - WINDOW_MINUTES[right]),
    rowsByCurrencyWindow,
  };
}

export async function readFxStrengthHistoryIndex(options: {
  fromUtc: string;
  toUtc: string;
  windows?: HistoricalStrengthWindow[];
  derivationVersion?: string;
}): Promise<FxStrengthHistoryIndex> {
  const windows = normalizeWindows(options.windows);
  const derivationVersion = options.derivationVersion ?? FX_M1_STRENGTH_DERIVATION_VERSION;
  const localIndex = await tryReadLocalFxStrengthHistoryIndex({
    ...options,
    windows,
    derivationVersion,
  });
  if (localIndex) return localIndex;

  await ensureStrengthHistorySchema();
  const rows = await query<{
    snapshot_time_utc: Date | string;
    window: HistoricalStrengthWindow;
    key: MajorCurrency;
    raw_strength: number | string | null;
    normalized_strength: number | string | null;
    coverage_expected_bars: number | string;
    coverage_actual_bars: number | string;
    coverage_pct: number | string;
    contributing_pairs: number | string;
    source_timeframe: "1m";
    source_provider: string;
    derivation_version: string;
  }>(
    `SELECT snapshot_time_utc::text AS snapshot_time_utc,
            "window",
            "key",
            raw_strength,
            normalized_strength,
            coverage_expected_bars,
            coverage_actual_bars,
            coverage_pct,
            contributing_pairs,
            source_timeframe,
            source_provider,
            derivation_version
       FROM strength_history_snapshots
      WHERE asset_class = 'fx'
        AND source_type = 'currency'
        AND derivation_version = $1
        AND "window" = ANY($2::text[])
        AND snapshot_time_utc >= $3::timestamptz
        AND snapshot_time_utc <= $4::timestamptz
      ORDER BY "window" ASC, "key" ASC, snapshot_time_utc ASC`,
    [derivationVersion, windows, options.fromUtc, options.toUtc],
  );

  return buildFxStrengthHistoryIndex(
    rows.map((row) => ({
      snapshotTimeUtc: toIsoUtc(row.snapshot_time_utc),
      assetClass: "fx",
      sourceType: "currency",
      window: row.window,
      key: row.key,
      rawStrength: row.raw_strength === null ? null : Number(row.raw_strength),
      normalizedStrength: row.normalized_strength === null ? null : Number(row.normalized_strength),
      coverageExpectedBars: Number(row.coverage_expected_bars),
      coverageActualBars: Number(row.coverage_actual_bars),
      coveragePct: Number(row.coverage_pct),
      contributingPairs: Number(row.contributing_pairs),
      sourceTimeframe: row.source_timeframe,
      sourceProvider: row.source_provider,
      derivationVersion: row.derivation_version,
    })),
    derivationVersion,
  );
}

export function lookupFxPairStrengthAt(
  index: FxStrengthHistoryIndex,
  pair: string,
  timestampUtc: string,
  window: HistoricalStrengthWindow,
  options?: {
    lookupMode?: FxStrengthHistoryLookupMode;
    maxForwardMinutes?: number;
  },
): FxPairStrengthWindowLookup {
  const normalizedPair = pair.trim().toUpperCase();
  const pairDef = FX_PAIR_BY_SYMBOL.get(normalizedPair);
  if (!pairDef) {
    throw new Error(`Unsupported FX pair for Strength history lookup: ${pair}`);
  }
  const timestamp = parseUtc(timestampUtc, "timestampUtc");
  const timestampMs = timestamp.toMillis();
  const lookupMode = options?.lookupMode ?? "at_or_before";
  const maxForwardMinutes = options?.maxForwardMinutes ?? DEFAULT_MARKET_OPEN_FORWARD_MINUTES;
  const baseRows = index.rowsByCurrencyWindow.get(historyKey(window, pairDef.base)) ?? [];
  const quoteRows = index.rowsByCurrencyWindow.get(historyKey(window, pairDef.quote)) ?? [];
  const base = findSnapshotForLookup(baseRows, timestampMs, lookupMode, maxForwardMinutes);
  const quote = findSnapshotForLookup(quoteRows, timestampMs, lookupMode, maxForwardMinutes);
  const normalizedBase = base?.normalizedStrength ?? null;
  const normalizedQuote = quote?.normalizedStrength ?? null;
  const signedSpread = normalizedBase !== null && normalizedQuote !== null
    ? normalizedBase - normalizedQuote
    : null;

  return {
    pair: normalizedPair,
    window,
    timestampUtc: timestamp.toISO() ?? timestampUtc,
    lookupMode,
    available: signedSpread !== null,
    baseSymbol: pairDef.base,
    quoteSymbol: pairDef.quote,
    baseSnapshotTimeUtc: base?.snapshotTimeUtc ?? null,
    quoteSnapshotTimeUtc: quote?.snapshotTimeUtc ?? null,
    rawBase: base?.rawStrength ?? null,
    rawQuote: quote?.rawStrength ?? null,
    normalizedBase,
    normalizedQuote,
    coverageBasePct: base?.coveragePct ?? null,
    coverageQuotePct: quote?.coveragePct ?? null,
    signedSpread,
    direction: classifySpread(signedSpread),
  };
}

export function lookupFxPairStrengthWindowsAt(
  index: FxStrengthHistoryIndex,
  pair: string,
  timestampUtc: string,
  windows = index.windows,
): FxPairStrengthWindowLookup[] {
  return windows.map((window) => lookupFxPairStrengthAt(index, pair, timestampUtc, window));
}

export function getFxWeeklyStrengthDecisionPoints(
  weekOpenUtc: string,
  options?: {
    marketOpenForwardMinutes?: number;
  },
): FxWeeklyStrengthDecisionPoint[] {
  const normalizedWeekOpenUtc = normalizeWeekOpenUtc(weekOpenUtc) ?? weekOpenUtc;
  const marketOpen = getCanonicalWeekWindow(normalizedWeekOpenUtc, "fx").openUtc;
  return [
    {
      id: "friday_close",
      requestedTimeUtc: getFridayFreezeTargetUtc(normalizedWeekOpenUtc),
      lookupMode: "at_or_before",
      maxForwardMinutes: null,
    },
    {
      id: "market_open_confirmation",
      requestedTimeUtc: marketOpen.toUTC().toISO() ?? normalizedWeekOpenUtc,
      lookupMode: "at_or_after",
      maxForwardMinutes: Math.max(
        0,
        Math.floor(options?.marketOpenForwardMinutes ?? DEFAULT_MARKET_OPEN_FORWARD_MINUTES),
      ),
    },
  ];
}

export function buildFxWeeklyStrengthContextFromIndex(options: {
  weekOpenUtc: string;
  index: FxStrengthHistoryIndex;
  pairs?: string[];
  windows?: HistoricalStrengthWindow[];
  marketOpenForwardMinutes?: number;
}): FxWeeklyStrengthContext {
  const normalizedWeekOpenUtc = normalizeWeekOpenUtc(options.weekOpenUtc) ?? options.weekOpenUtc;
  const pairs = options.pairs && options.pairs.length > 0
    ? [...new Set(options.pairs.map((pair) => pair.trim().toUpperCase()).filter(Boolean))]
    : FX_PAIR_MAP.map((row) => row.pair);
  const windows = normalizeWindows(options.windows ?? options.index.windows);
  const points = getFxWeeklyStrengthDecisionPoints(normalizedWeekOpenUtc, {
    marketOpenForwardMinutes: options.marketOpenForwardMinutes,
  });
  const rows: FxWeeklyPairStrengthDecision[] = [];

  for (const point of points) {
    for (const pair of pairs) {
      const windowRows = windows.map((window) =>
        lookupFxPairStrengthAt(options.index, pair, point.requestedTimeUtc, window, {
          lookupMode: point.lookupMode,
          maxForwardMinutes: point.maxForwardMinutes ?? 0,
        }),
      );
      const composite = classifyCompositeStrength(windowRows);
      rows.push({
        weekOpenUtc: normalizedWeekOpenUtc,
        pair,
        pointId: point.id,
        requestedTimeUtc: point.requestedTimeUtc,
        resolvedTimeUtc: mostRecentResolvedTime(windowRows),
        available: composite.missingReason === null,
        direction: composite.direction,
        compositeScore: composite.compositeScore,
        availableWindows: composite.availableWindows,
        windows: windowRows,
        missingReason: composite.missingReason,
      });
    }
  }

  return {
    weekOpenUtc: normalizedWeekOpenUtc,
    points,
    rows,
  };
}

export async function readFxWeeklyStrengthContexts(options: {
  weekOpenUtcs: string[];
  pairs?: string[];
  windows?: HistoricalStrengthWindow[];
  marketOpenForwardMinutes?: number;
  derivationVersion?: string;
}): Promise<FxWeeklyStrengthContext[]> {
  const weekOpenUtcs = [...new Set(
    options.weekOpenUtcs
      .map((weekOpenUtc) => normalizeWeekOpenUtc(weekOpenUtc) ?? weekOpenUtc)
      .filter(Boolean),
  )].sort();
  if (weekOpenUtcs.length === 0) return [];

  const windows = normalizeWindows(options.windows);
  const pointTimes = weekOpenUtcs.flatMap((weekOpenUtc) =>
    getFxWeeklyStrengthDecisionPoints(weekOpenUtc, {
      marketOpenForwardMinutes: options.marketOpenForwardMinutes,
    }),
  );
  const millis = pointTimes.map((point) => Date.parse(point.requestedTimeUtc)).filter(Number.isFinite);
  const maxForward = Math.max(0, Math.floor(options.marketOpenForwardMinutes ?? DEFAULT_MARKET_OPEN_FORWARD_MINUTES));
  const fromUtc = new Date(Math.min(...millis) - 7 * 24 * 60 * 60_000).toISOString();
  const toUtc = new Date(Math.max(...millis) + maxForward * 60_000).toISOString();
  const index = await readFxStrengthHistoryIndex({
    fromUtc,
    toUtc,
    windows,
    derivationVersion: options.derivationVersion,
  });

  return weekOpenUtcs.map((weekOpenUtc) =>
    buildFxWeeklyStrengthContextFromIndex({
      weekOpenUtc,
      index,
      pairs: options.pairs,
      windows,
      marketOpenForwardMinutes: options.marketOpenForwardMinutes,
    }),
  );
}
