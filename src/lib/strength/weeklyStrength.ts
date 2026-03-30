import type { Direction } from "@/lib/cotTypes";
import { PAIRS_BY_ASSET_CLASS } from "@/lib/cotPairs";
import { query } from "@/lib/db";
import type { AssetClass } from "@/lib/cotMarkets";
import { getOrSetRuntimeCache } from "@/lib/runtimeCache";

export type StrengthWindow = "1h" | "4h" | "24h";
export type StrengthRelation = "AGAINST" | "NEUTRAL" | "WITH";

export type PairStrengthWindowReading = {
  window: StrengthWindow;
  available: boolean;
  snapshotTimeUtc: string | null;
  baseSymbol: string;
  quoteSymbol: string;
  rawBase: number | null;
  rawQuote: number | null;
  normalizedBase: number | null;
  normalizedQuote: number | null;
  signedSpread: number | null;
  direction: Direction;
};

export type WeeklyPairStrength = {
  pair: string;
  assetClass: AssetClass;
  base: string;
  quote: string;
  latestSnapshotUtc: string | null;
  availableWindows: number;
  compositeScore: number;
  compositeDirection: Direction;
  windows: PairStrengthWindowReading[];
};

export type WeeklyPairStrengthGateWindow = PairStrengthWindowReading & {
  relation: StrengthRelation;
};

export type WeeklyPairStrengthGate = {
  pair: string;
  assetClass: AssetClass;
  biasDirection: Exclude<Direction, "NEUTRAL">;
  score: number;
  passes: boolean;
  windows: WeeklyPairStrengthGateWindow[];
};

export type WeeklyUnderlyingStrength = {
  id: string;
  assetClass: AssetClass;
  symbol: string;
  window: StrengthWindow;
  snapshotTimeUtc: string;
  raw: number;
  normalized: number;
  signedSpread: number;
  direction: Direction;
};

type CurrencyStrengthRow = {
  window: StrengthWindow;
  currency: string;
  snapshot_time_utc: Date | string;
  raw_strength: number | string;
  normalized_strength: number | string;
};

type AssetStrengthRow = {
  asset_class: AssetClass;
  window: StrengthWindow;
  asset: string;
  snapshot_time_utc: Date | string;
  raw_strength: number | string;
  normalized_strength: number | string;
};

const WINDOWS: StrengthWindow[] = ["1h", "4h", "24h"];
const STRENGTH_CACHE_TTL_MS = 30_000;
const SPREAD_THRESHOLD = 5;

const DIRECTION_SCORE: Record<Direction, number> = {
  LONG: 1,
  NEUTRAL: 0,
  SHORT: -1,
};

const RELATION_SCORE: Record<StrengthRelation, number> = {
  AGAINST: -1,
  NEUTRAL: 0,
  WITH: 1,
};

type WeeklyStrengthSource = {
  currencyRows: CurrencyStrengthRow[];
  assetRows: AssetStrengthRow[];
};

function toIsoUtc(value: Date | string): string {
  if (value instanceof Date) return value.toISOString();
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? String(value) : date.toISOString();
}

function toNumber(value: number | string): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function buildCacheKey(weekOpenUtc: string) {
  return `weeklyStrength:${weekOpenUtc}`;
}

function buildSourceCacheKey(weekOpenUtc: string) {
  return `weeklyStrengthSource:${weekOpenUtc}`;
}

function classifySpread(spread: number | null, threshold = SPREAD_THRESHOLD): Direction {
  if (spread === null || !Number.isFinite(spread)) return "NEUTRAL";
  if (spread > threshold) return "LONG";
  if (spread < -threshold) return "SHORT";
  return "NEUTRAL";
}

function classifyRelation(
  spread: number | null,
  biasDirection: Exclude<Direction, "NEUTRAL">,
  threshold = SPREAD_THRESHOLD,
): StrengthRelation {
  if (spread === null || !Number.isFinite(spread)) return "NEUTRAL";
  if (biasDirection === "LONG") {
    if (spread > threshold) return "WITH";
    if (spread < -threshold) return "AGAINST";
    return "NEUTRAL";
  }
  if (spread < -threshold) return "WITH";
  if (spread > threshold) return "AGAINST";
  return "NEUTRAL";
}

async function readCurrencyStrengthRows(weekOpenUtc: string) {
  return query<CurrencyStrengthRow>(
    `
      SELECT DISTINCT ON ("window", currency)
             "window",
             currency,
             snapshot_time_utc,
             raw_strength,
             normalized_strength
        FROM currency_strength_snapshots
       WHERE snapshot_time_utc <= $1::timestamptz
         AND "window" IN ('1h', '4h', '24h')
       ORDER BY "window", currency, snapshot_time_utc DESC
    `,
    [weekOpenUtc],
  );
}

async function readAssetStrengthRows(weekOpenUtc: string) {
  return query<AssetStrengthRow>(
    `
      SELECT DISTINCT ON (asset_class, "window", asset)
             asset_class,
             "window",
             asset,
             snapshot_time_utc,
             raw_strength,
             normalized_strength
        FROM asset_strength_snapshots
       WHERE snapshot_time_utc <= $1::timestamptz
         AND asset_class IN ('crypto', 'commodities', 'indices')
         AND "window" IN ('1h', '4h', '24h')
       ORDER BY asset_class, "window", asset, snapshot_time_utc DESC
    `,
    [weekOpenUtc],
  );
}

async function loadWeeklyStrengthSource(weekOpenUtc: string): Promise<WeeklyStrengthSource> {
  return getOrSetRuntimeCache(buildSourceCacheKey(weekOpenUtc), STRENGTH_CACHE_TTL_MS, async () => {
    const [currencyRows, assetRows] = await Promise.all([
      readCurrencyStrengthRows(weekOpenUtc),
      readAssetStrengthRows(weekOpenUtc),
    ]);
    return { currencyRows, assetRows };
  });
}

function buildFxWindowReading(
  pair: string,
  base: string,
  quote: string,
  window: StrengthWindow,
  byCurrency: Map<string, CurrencyStrengthRow>,
): PairStrengthWindowReading {
  const baseRow = byCurrency.get(`${window}:${base}`);
  const quoteRow = byCurrency.get(`${window}:${quote}`);
  const available = Boolean(baseRow && quoteRow);
  const normalizedBase = baseRow ? toNumber(baseRow.normalized_strength) : null;
  const normalizedQuote = quoteRow ? toNumber(quoteRow.normalized_strength) : null;
  const rawBase = baseRow ? toNumber(baseRow.raw_strength) : null;
  const rawQuote = quoteRow ? toNumber(quoteRow.raw_strength) : null;
  const signedSpread =
    normalizedBase !== null && normalizedQuote !== null ? normalizedBase - normalizedQuote : null;
  const snapshotTimeUtc = available
    ? [baseRow?.snapshot_time_utc, quoteRow?.snapshot_time_utc]
        .map((value) => (value ? toIsoUtc(value) : null))
        .sort()
        .at(-1) ?? null
    : null;

  return {
    window,
    available,
    snapshotTimeUtc,
    baseSymbol: base,
    quoteSymbol: quote,
    rawBase,
    rawQuote,
    normalizedBase,
    normalizedQuote,
    signedSpread,
    direction: classifySpread(signedSpread),
  };
}

function buildNonFxWindowReading(
  assetClass: Exclude<AssetClass, "fx">,
  pair: string,
  base: string,
  quote: string,
  window: StrengthWindow,
  byAsset: Map<string, AssetStrengthRow>,
): PairStrengthWindowReading {
  const assetRow = byAsset.get(`${assetClass}:${window}:${base}`);
  const available = Boolean(assetRow);
  const normalizedBase = assetRow ? toNumber(assetRow.normalized_strength) : null;
  const rawBase = assetRow ? toNumber(assetRow.raw_strength) : null;
  const signedSpread = normalizedBase !== null ? normalizedBase - 50 : null;

  return {
    window,
    available,
    snapshotTimeUtc: assetRow ? toIsoUtc(assetRow.snapshot_time_utc) : null,
    baseSymbol: base,
    quoteSymbol: quote,
    rawBase,
    rawQuote: 0,
    normalizedBase,
    normalizedQuote: 50,
    signedSpread,
    direction: classifySpread(signedSpread),
  };
}

function buildPairStrength(
  assetClass: AssetClass,
  pair: string,
  base: string,
  quote: string,
  byCurrency: Map<string, CurrencyStrengthRow>,
  byAsset: Map<string, AssetStrengthRow>,
): WeeklyPairStrength {
  const windows = WINDOWS.map((window) =>
    assetClass === "fx"
      ? buildFxWindowReading(pair, base, quote, window, byCurrency)
      : buildNonFxWindowReading(assetClass, pair, base, quote, window, byAsset),
  );

  const compositeScore = windows.reduce((sum, row) => sum + DIRECTION_SCORE[row.direction], 0);
  const latestSnapshotUtc = windows
    .map((row) => row.snapshotTimeUtc)
    .filter((value): value is string => Boolean(value))
    .sort()
    .at(-1) ?? null;

  return {
    pair,
    assetClass,
    base,
    quote,
    latestSnapshotUtc,
    availableWindows: windows.filter((row) => row.available).length,
    compositeScore,
    compositeDirection: classifySpread(compositeScore, 0),
    windows,
  };
}

export async function readWeeklyPairStrengths(weekOpenUtc: string): Promise<WeeklyPairStrength[]> {
  return getOrSetRuntimeCache(buildCacheKey(weekOpenUtc), STRENGTH_CACHE_TTL_MS, async () => {
    const { currencyRows, assetRows } = await loadWeeklyStrengthSource(weekOpenUtc);

    const byCurrency = new Map<string, CurrencyStrengthRow>(
      currencyRows.map((row) => [`${row.window}:${row.currency.toUpperCase()}`, row]),
    );
    const byAsset = new Map<string, AssetStrengthRow>(
      assetRows.map((row) => [`${row.asset_class}:${row.window}:${row.asset.toUpperCase()}`, row]),
    );

    return (Object.entries(PAIRS_BY_ASSET_CLASS) as Array<[AssetClass, typeof PAIRS_BY_ASSET_CLASS[AssetClass]]>)
      .flatMap(([assetClass, pairDefs]) =>
        pairDefs.map((pairDef) =>
          buildPairStrength(
            assetClass,
            pairDef.pair.toUpperCase(),
            pairDef.base.toUpperCase(),
            pairDef.quote.toUpperCase(),
            byCurrency,
            byAsset,
          ),
        ),
      );
  });
}

export async function readWeeklyUnderlyingStrengths(
  weekOpenUtc: string,
  assetClass: AssetClass | "all" = "all",
): Promise<WeeklyUnderlyingStrength[]> {
  const { currencyRows, assetRows } = await loadWeeklyStrengthSource(weekOpenUtc);
  const currencyItems: WeeklyUnderlyingStrength[] = currencyRows.map((row) => {
    const normalized = toNumber(row.normalized_strength);
    const signedSpread = normalized - 50;
    return {
      id: `fx:${row.window}:${row.currency.toUpperCase()}`,
      assetClass: "fx",
      symbol: row.currency.toUpperCase(),
      window: row.window,
      snapshotTimeUtc: toIsoUtc(row.snapshot_time_utc),
      raw: toNumber(row.raw_strength),
      normalized,
      signedSpread,
      direction: classifySpread(signedSpread),
    };
  });
  const assetItems: WeeklyUnderlyingStrength[] = assetRows.map((row) => {
    const normalized = toNumber(row.normalized_strength);
    const signedSpread = normalized - 50;
    return {
      id: `${row.asset_class}:${row.window}:${row.asset.toUpperCase()}`,
      assetClass: row.asset_class,
      symbol: row.asset.toUpperCase(),
      window: row.window,
      snapshotTimeUtc: toIsoUtc(row.snapshot_time_utc),
      raw: toNumber(row.raw_strength),
      normalized,
      signedSpread,
      direction: classifySpread(signedSpread),
    };
  });
  const all = [...currencyItems, ...assetItems];
  if (assetClass === "all") return all;
  return all.filter((row) => row.assetClass === assetClass);
}

export async function readWeeklyPairStrengthsForAsset(
  weekOpenUtc: string,
  assetClass: AssetClass | "all",
): Promise<WeeklyPairStrength[]> {
  const rows = await readWeeklyPairStrengths(weekOpenUtc);
  if (assetClass === "all") return rows;
  return rows.filter((row) => row.assetClass === assetClass);
}

export function evaluateStrengthGate(
  row: WeeklyPairStrength,
  biasDirection: Exclude<Direction, "NEUTRAL">,
): WeeklyPairStrengthGate {
  const windows = row.windows.map((windowRow) => {
    const relation = classifyRelation(windowRow.signedSpread, biasDirection);
    return {
      ...windowRow,
      relation,
    };
  });
  const score = windows.reduce((sum, windowRow) => sum + RELATION_SCORE[windowRow.relation], 0);
  return {
    pair: row.pair,
    assetClass: row.assetClass,
    biasDirection,
    score,
    passes: score < 0,
    windows,
  };
}
