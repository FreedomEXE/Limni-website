import type { Direction } from "@/lib/cotTypes";
import { PAIRS_BY_ASSET_CLASS } from "@/lib/cotPairs";
import { getClient, query } from "@/lib/db";
import { dbTimestampValueToIsoUtc } from "@/lib/dbUtcTimestamp";
import type { AssetClass } from "@/lib/cotMarkets";
import { clearRuntimeCacheKey, getOrSetRuntimeCache } from "@/lib/runtimeCache";
import { normalizeWeekOpenUtc } from "@/lib/weekAnchor";

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

type StrengthWeeklySnapshotRow = {
  week_open_utc: Date | string;
  source_type: "currency" | "asset";
  window: StrengthWindow;
  key: string;
  asset_class: AssetClass | null;
  raw_strength: number | string | null;
  normalized_strength: number | string | null;
  source_snapshot_utc: Date | string | null;
  locked_at_utc: Date | string;
};

let ensuredStrengthWeeklySchema = false;

function toIsoUtc(value: Date | string): string {
  return dbTimestampValueToIsoUtc(value) ?? String(value);
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

export async function ensureStrengthWeeklySchema(): Promise<void> {
  if (ensuredStrengthWeeklySchema) {
    return;
  }
  await query(`
    CREATE TABLE IF NOT EXISTS strength_weekly_snapshots (
      week_open_utc TIMESTAMP NOT NULL,
      source_type VARCHAR(20) NOT NULL,
      "window" VARCHAR(10) NOT NULL,
      "key" VARCHAR(30) NOT NULL,
      asset_class VARCHAR(20),
      raw_strength DECIMAL(12, 6),
      normalized_strength DECIMAL(12, 6),
      source_snapshot_utc TIMESTAMP,
      locked_at_utc TIMESTAMP NOT NULL DEFAULT (NOW() AT TIME ZONE 'UTC'),
      PRIMARY KEY (week_open_utc, source_type, "window", "key")
    )
  `);
  await query(`
    CREATE INDEX IF NOT EXISTS idx_strength_weekly_snapshots_week
      ON strength_weekly_snapshots(week_open_utc DESC)
  `);
  ensuredStrengthWeeklySchema = true;
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
             snapshot_time_utc::text AS snapshot_time_utc,
             raw_strength,
             normalized_strength
        FROM currency_strength_snapshots
       WHERE snapshot_time_utc <= ($1::timestamptz AT TIME ZONE 'UTC')
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
             snapshot_time_utc::text AS snapshot_time_utc,
             raw_strength,
             normalized_strength
        FROM asset_strength_snapshots
       WHERE snapshot_time_utc <= ($1::timestamptz AT TIME ZONE 'UTC')
         AND asset_class IN ('crypto', 'commodities', 'indices')
         AND "window" IN ('1h', '4h', '24h')
       ORDER BY asset_class, "window", asset, snapshot_time_utc DESC
    `,
    [weekOpenUtc],
  );
}

function clearStrengthCaches(weekOpenUtc: string) {
  clearRuntimeCacheKey(buildSourceCacheKey(weekOpenUtc));
  clearRuntimeCacheKey(buildCacheKey(weekOpenUtc));
}

function normalizeStrengthWeekOpenUtc(weekOpenUtc: string) {
  return normalizeWeekOpenUtc(weekOpenUtc) ?? weekOpenUtc;
}

export async function lockStrengthForWeek(weekOpenUtc: string): Promise<void> {
  const normalizedWeekOpenUtc = normalizeStrengthWeekOpenUtc(weekOpenUtc);
  await ensureStrengthWeeklySchema();

  const [currencyRows, assetRows] = await Promise.all([
    readCurrencyStrengthRows(normalizedWeekOpenUtc),
    readAssetStrengthRows(normalizedWeekOpenUtc),
  ]);

  const client = await getClient();
  try {
    await client.query("BEGIN");

    for (const row of currencyRows) {
      await client.query(
        `
          INSERT INTO strength_weekly_snapshots (
            week_open_utc,
            source_type,
            "window",
            "key",
            asset_class,
            raw_strength,
            normalized_strength,
            source_snapshot_utc,
            locked_at_utc
          )
          VALUES (
            ($1::timestamptz AT TIME ZONE 'UTC'),
            'currency',
            $2,
            $3,
            NULL,
            $4,
            $5,
            ($6::timestamptz AT TIME ZONE 'UTC'),
            (NOW() AT TIME ZONE 'UTC')
          )
          ON CONFLICT (week_open_utc, source_type, "window", "key")
          DO UPDATE SET
            asset_class = EXCLUDED.asset_class,
            raw_strength = EXCLUDED.raw_strength,
            normalized_strength = EXCLUDED.normalized_strength,
            source_snapshot_utc = EXCLUDED.source_snapshot_utc,
            locked_at_utc = (NOW() AT TIME ZONE 'UTC')
        `,
        [
          normalizedWeekOpenUtc,
          row.window,
          row.currency.toUpperCase(),
          row.raw_strength,
          row.normalized_strength,
          row.snapshot_time_utc,
        ],
      );
    }

    for (const row of assetRows) {
      await client.query(
        `
          INSERT INTO strength_weekly_snapshots (
            week_open_utc,
            source_type,
            "window",
            "key",
            asset_class,
            raw_strength,
            normalized_strength,
            source_snapshot_utc,
            locked_at_utc
          )
          VALUES (
            ($1::timestamptz AT TIME ZONE 'UTC'),
            'asset',
            $2,
            $3,
            $4,
            $5,
            $6,
            ($7::timestamptz AT TIME ZONE 'UTC'),
            (NOW() AT TIME ZONE 'UTC')
          )
          ON CONFLICT (week_open_utc, source_type, "window", "key")
          DO UPDATE SET
            asset_class = EXCLUDED.asset_class,
            raw_strength = EXCLUDED.raw_strength,
            normalized_strength = EXCLUDED.normalized_strength,
            source_snapshot_utc = EXCLUDED.source_snapshot_utc,
            locked_at_utc = (NOW() AT TIME ZONE 'UTC')
        `,
        [
          normalizedWeekOpenUtc,
          row.window,
          row.asset.toUpperCase(),
          row.asset_class,
          row.raw_strength,
          row.normalized_strength,
          row.snapshot_time_utc,
        ],
      );
    }

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }

  clearStrengthCaches(normalizedWeekOpenUtc);
}

export async function readLockedStrengthForWeek(weekOpenUtc: string): Promise<WeeklyStrengthSource | null> {
  const normalizedWeekOpenUtc = normalizeStrengthWeekOpenUtc(weekOpenUtc);
  await ensureStrengthWeeklySchema();
  const rows = await query<StrengthWeeklySnapshotRow>(
    `
      SELECT
        week_open_utc::text AS week_open_utc,
        source_type,
        "window",
        "key",
        asset_class,
        raw_strength,
        normalized_strength,
        source_snapshot_utc::text AS source_snapshot_utc,
        locked_at_utc::text AS locked_at_utc
      FROM strength_weekly_snapshots
      WHERE week_open_utc = ($1::timestamptz AT TIME ZONE 'UTC')
      ORDER BY source_type ASC, asset_class ASC NULLS FIRST, "window" ASC, "key" ASC
    `,
    [normalizedWeekOpenUtc],
  );

  if (rows.length === 0) {
    return null;
  }

  const currencyRows: CurrencyStrengthRow[] = [];
  const assetRows: AssetStrengthRow[] = [];

  for (const row of rows) {
    const snapshotTimeUtc = row.source_snapshot_utc ?? row.locked_at_utc ?? row.week_open_utc;
    if (row.source_type === "currency") {
      currencyRows.push({
        window: row.window,
        currency: row.key.toUpperCase(),
        snapshot_time_utc: snapshotTimeUtc,
        raw_strength: row.raw_strength ?? 0,
        normalized_strength: row.normalized_strength ?? 50,
      });
      continue;
    }

    if (!row.asset_class) {
      continue;
    }

    assetRows.push({
      asset_class: row.asset_class,
      window: row.window,
      asset: row.key.toUpperCase(),
      snapshot_time_utc: snapshotTimeUtc,
      raw_strength: row.raw_strength ?? 0,
      normalized_strength: row.normalized_strength ?? 50,
    });
  }

  return { currencyRows, assetRows };
}

async function loadWeeklyStrengthSource(weekOpenUtc: string): Promise<WeeklyStrengthSource> {
  const normalizedWeekOpenUtc = normalizeStrengthWeekOpenUtc(weekOpenUtc);
  return getOrSetRuntimeCache(buildSourceCacheKey(normalizedWeekOpenUtc), STRENGTH_CACHE_TTL_MS, async () => {
    const locked = await readLockedStrengthForWeek(normalizedWeekOpenUtc);
    if (locked) {
      return locked;
    }
    const [currencyRows, assetRows] = await Promise.all([
      readCurrencyStrengthRows(normalizedWeekOpenUtc),
      readAssetStrengthRows(normalizedWeekOpenUtc),
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
  const normalizedWeekOpenUtc = normalizeStrengthWeekOpenUtc(weekOpenUtc);
  return getOrSetRuntimeCache(buildCacheKey(normalizedWeekOpenUtc), STRENGTH_CACHE_TTL_MS, async () => {
    const { currencyRows, assetRows } = await loadWeeklyStrengthSource(normalizedWeekOpenUtc);

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

export async function readWeeklyPairStrengthsAtCutoff(cutoffUtc: string): Promise<WeeklyPairStrength[]> {
  const [currencyRows, assetRows] = await Promise.all([
    readCurrencyStrengthRows(cutoffUtc),
    readAssetStrengthRows(cutoffUtc),
  ]);
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
}

export async function readWeeklyUnderlyingStrengths(
  weekOpenUtc: string,
  assetClass: AssetClass | "all" = "all",
): Promise<WeeklyUnderlyingStrength[]> {
  const { currencyRows, assetRows } = await loadWeeklyStrengthSource(
    normalizeStrengthWeekOpenUtc(weekOpenUtc),
  );
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
