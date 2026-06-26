/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: pathBarLoader.ts
 *
 * Description:
 * Batch-load canonical path bars for a symbol set over a time range.
 * This wraps canonical_price_bars with one query and returns bars
 * grouped by uppercase symbol for the basket path engine.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import { query } from "@database/db/client";
import { getOrSetRuntimeCache } from "@engine/cache/runtimeCache";
import type { AssetClass } from "@engine/contracts/cotMarkets";
import type { CanonicalPriceBar } from "@engine/price/canonicalPriceBars";
import { CANONICAL_PATH_RESOLUTION } from "@engine/price/pathResolution";

export type PathBarMap = Map<string, CanonicalPriceBar[]>;
export type PathBarPoint = {
  barCloseUtc: string;
  highPrice: number;
  lowPrice: number;
  closePrice: number;
};
export type PathBarTimeline = {
  exactBars: Array<PathBarPoint | null>;
  markBars: Array<PathBarPoint | null>;
  markPrices: Array<number | null>;
};
export type PathBarTimelineMap = Map<string, PathBarTimeline>;
export type PathMarkPriceMatrix = {
  timestampsUtc: string[];
  timestampIndexByUtc: Map<string, number>;
  markPricesBySymbol: Map<string, Array<number | null>>;
  timelineBySymbol: PathBarTimelineMap;
};

type IndexedPathBarPoint = PathBarPoint & {
  closeMs: number;
};

type IndexedMarkPricePoint = {
  closeMs: number;
  closePrice: number;
};

const PATH_BAR_LOADER_CACHE_TTL_MS = Number(
  process.env.PATH_BAR_LOADER_CACHE_TTL_MS ?? "600000",
);
const PATH_MARK_TARGETED_LOOKUP_MAX_TIMESTAMPS = Number(
  process.env.PATH_MARK_TARGETED_LOOKUP_MAX_TIMESTAMPS ?? "1000",
);

function getPathBarLoaderCacheTtlMs() {
  if (
    Number.isFinite(PATH_BAR_LOADER_CACHE_TTL_MS)
    && PATH_BAR_LOADER_CACHE_TTL_MS >= 0
  ) {
    return Math.floor(PATH_BAR_LOADER_CACHE_TTL_MS);
  }
  return 600000;
}

function getPathMarkTargetedLookupMaxTimestamps() {
  if (
    Number.isFinite(PATH_MARK_TARGETED_LOOKUP_MAX_TIMESTAMPS)
    && PATH_MARK_TARGETED_LOOKUP_MAX_TIMESTAMPS > 0
  ) {
    return Math.floor(PATH_MARK_TARGETED_LOOKUP_MAX_TIMESTAMPS);
  }
  return 1000;
}

function pathBarSourceCacheKey(resolution: string) {
  return resolution === "1m" && process.env.LIMNI_M1_WAREHOUSE?.trim().toLowerCase() === "sqlite"
    ? `sqlite:${process.env.LIMNI_M1_SQLITE_PATH ?? "default"}`
    : "postgres";
}

async function tryLoadLocalM1PathBars(
  symbols: string[],
  fromUtc: string,
  toUtc: string,
  resolution: string,
): Promise<PathBarMap | null> {
  const warehouse = await import("@engine/price/localM1Warehouse");
  if (!warehouse.shouldUseLocalM1Warehouse(resolution)) return null;
  return warehouse.readLocalM1Bars(symbols, fromUtc, toUtc, resolution);
}

function normalizeSymbols(symbols: string[]) {
  return Array.from(
    new Set(
      symbols
        .map((symbol) => symbol.trim().toUpperCase())
        .filter((symbol) => symbol.length > 0),
    ),
  ).sort();
}

function normalizePathTimestamp(value: string) {
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? new Date(ms).toISOString() : value;
}

function mapCanonicalPriceBar(row: {
  symbol: string;
  asset_class: AssetClass;
  timeframe: string;
  bar_open_utc: Date;
  bar_close_utc: Date;
  open_price: number | string;
  high_price: number | string;
  low_price: number | string;
  close_price: number | string;
  source_provider: string;
  quality_status: string;
}): CanonicalPriceBar {
  return {
    symbol: row.symbol,
    assetClass: row.asset_class,
    timeframe: row.timeframe,
    barOpenUtc: row.bar_open_utc.toISOString(),
    barCloseUtc: row.bar_close_utc.toISOString(),
    openPrice: Number(row.open_price),
    highPrice: Number(row.high_price),
    lowPrice: Number(row.low_price),
    closePrice: Number(row.close_price),
    sourceProvider: row.source_provider,
    qualityStatus: row.quality_status,
  };
}

function mapPathBarPoint(row: {
  bar_close_utc: Date;
  high_price: number | string;
  low_price: number | string;
  close_price: number | string;
}): IndexedPathBarPoint {
  const barCloseUtc = row.bar_close_utc.toISOString();
  return {
    barCloseUtc,
    closeMs: row.bar_close_utc.getTime(),
    highPrice: Number(row.high_price),
    lowPrice: Number(row.low_price),
    closePrice: Number(row.close_price),
  };
}

export async function loadPathBars(
  symbols: string[],
  fromUtc: string,
  toUtc: string,
  resolution = CANONICAL_PATH_RESOLUTION,
  priceBundleId = "unscoped",
): Promise<PathBarMap> {
  const normalizedSymbols = normalizeSymbols(symbols);
  const empty = new Map<string, CanonicalPriceBar[]>();
  for (const symbol of normalizedSymbols) {
    empty.set(symbol, []);
  }

  if (normalizedSymbols.length === 0) {
    return empty;
  }

  const cacheKey = [
    "pathBarLoader",
    priceBundleId,
    pathBarSourceCacheKey(resolution),
    resolution,
    fromUtc,
    toUtc,
    normalizedSymbols.join(","),
  ].join(":");

  return getOrSetRuntimeCache(cacheKey, getPathBarLoaderCacheTtlMs(), async () => {
    const localBars = await tryLoadLocalM1PathBars(normalizedSymbols, fromUtc, toUtc, resolution);
    if (localBars) {
      return localBars;
    }

    const rows = await query<{
      symbol: string;
      asset_class: AssetClass;
      timeframe: string;
      bar_open_utc: Date;
      bar_close_utc: Date;
      open_price: number | string;
      high_price: number | string;
      low_price: number | string;
      close_price: number | string;
      source_provider: string;
      quality_status: string;
    }>(
      `SELECT symbol, asset_class, timeframe, bar_open_utc, bar_close_utc,
              open_price, high_price, low_price, close_price, source_provider, quality_status
         FROM canonical_price_bars
        WHERE symbol = ANY($1::text[])
          AND timeframe = $2
          AND bar_open_utc >= $3::timestamptz
          AND bar_open_utc < $4::timestamptz
        ORDER BY symbol ASC, bar_open_utc ASC`,
      [normalizedSymbols, resolution, fromUtc, toUtc],
    );

    const bySymbol: PathBarMap = new Map();
    for (const symbol of normalizedSymbols) {
      bySymbol.set(symbol, []);
    }

    for (const row of rows) {
      const symbol = row.symbol.toUpperCase();
      const bars = bySymbol.get(symbol);
      if (!bars) continue;
      bars.push(mapCanonicalPriceBar(row));
    }

    return bySymbol;
  });
}

function buildPathBarTimelinesFromSeries(
  normalizedSymbols: string[],
  seriesBySymbol: Map<string, IndexedPathBarPoint[]>,
  timestampsUtc: string[],
): PathBarTimelineMap {
  const normalizedTimestamps = timestampsUtc.map(normalizePathTimestamp);
  const timestampMs = normalizedTimestamps.map((timestamp) => Date.parse(timestamp));
  const timelines: PathBarTimelineMap = new Map();

  for (const symbol of normalizedSymbols) {
    const series = (seriesBySymbol.get(symbol) ?? [])
      .filter((point) => Number.isFinite(point.closeMs))
      .sort((left, right) => left.closeMs - right.closeMs);
    const exactBars: Array<PathBarPoint | null> = [];
    const markBars: Array<PathBarPoint | null> = [];
    const markPrices: Array<number | null> = [];
    let cursor = 0;
    let last: IndexedPathBarPoint | null = null;

    for (let index = 0; index < normalizedTimestamps.length; index += 1) {
      const tsMs = timestampMs[index] ?? Number.NaN;
      let exact: IndexedPathBarPoint | null = null;
      while (cursor < series.length && (series[cursor]?.closeMs ?? Number.POSITIVE_INFINITY) <= tsMs) {
        const point = series[cursor] ?? null;
        if (point && point.closeMs === tsMs) {
          exact = point;
        }
        last = point;
        cursor += 1;
      }
      exactBars.push(exact);
      markBars.push(last);
      markPrices.push(last?.closePrice ?? null);
    }

    timelines.set(symbol, { exactBars, markBars, markPrices });
  }

  return timelines;
}

export function buildPathBarTimelines(
  symbols: string[],
  barsBySymbol: PathBarMap,
  timestampsUtc: string[],
): PathBarTimelineMap {
  const normalizedSymbols = normalizeSymbols(symbols);
  const seriesBySymbol = new Map<string, IndexedPathBarPoint[]>();

  for (const symbol of normalizedSymbols) {
    seriesBySymbol.set(
      symbol,
      (barsBySymbol.get(symbol) ?? []).map((bar) => ({
        barCloseUtc: normalizePathTimestamp(bar.barCloseUtc),
        closeMs: Date.parse(bar.barCloseUtc),
        highPrice: bar.highPrice,
        lowPrice: bar.lowPrice,
        closePrice: bar.closePrice,
      })),
    );
  }

  return buildPathBarTimelinesFromSeries(normalizedSymbols, seriesBySymbol, timestampsUtc);
}

export async function loadPathBarTimelines(
  symbols: string[],
  fromUtc: string,
  toUtc: string,
  timestampsUtc: string[],
  resolution = CANONICAL_PATH_RESOLUTION,
  priceBundleId = "unscoped",
): Promise<PathBarTimelineMap> {
  const normalizedSymbols = normalizeSymbols(symbols);
  if (normalizedSymbols.length === 0) {
    return new Map();
  }

  const normalizedTimestamps = timestampsUtc.map(normalizePathTimestamp);
  const firstTimestamp = normalizedTimestamps[0] ?? "";
  const middleTimestamp = normalizedTimestamps[Math.floor(normalizedTimestamps.length / 2)] ?? "";
  const lastTimestamp = normalizedTimestamps[normalizedTimestamps.length - 1] ?? "";
  const cacheKey = [
    "pathBarTimelines",
    priceBundleId,
    pathBarSourceCacheKey(resolution),
    resolution,
    fromUtc,
    toUtc,
    normalizedTimestamps.length,
    firstTimestamp,
    middleTimestamp,
    lastTimestamp,
    normalizedSymbols.join(","),
  ].join(":");

  return getOrSetRuntimeCache(cacheKey, getPathBarLoaderCacheTtlMs(), async () => {
    const localBars = await tryLoadLocalM1PathBars(normalizedSymbols, fromUtc, toUtc, resolution);
    if (localBars) {
      const seriesBySymbol = new Map<string, IndexedPathBarPoint[]>();
      for (const symbol of normalizedSymbols) {
        seriesBySymbol.set(
          symbol,
          (localBars.get(symbol) ?? []).map((bar) => ({
            barCloseUtc: normalizePathTimestamp(bar.barCloseUtc),
            closeMs: Date.parse(bar.barCloseUtc),
            highPrice: bar.highPrice,
            lowPrice: bar.lowPrice,
            closePrice: bar.closePrice,
          })),
        );
      }
      return buildPathBarTimelinesFromSeries(normalizedSymbols, seriesBySymbol, timestampsUtc);
    }

    const rows = await query<{
      symbol: string;
      bar_close_utc: Date;
      high_price: number | string;
      low_price: number | string;
      close_price: number | string;
    }>(
      `SELECT symbol, bar_close_utc, high_price, low_price, close_price
         FROM canonical_price_bars
        WHERE symbol = ANY($1::text[])
          AND timeframe = $2
          AND bar_open_utc >= $3::timestamptz
          AND bar_open_utc < $4::timestamptz
        ORDER BY symbol ASC, bar_close_utc ASC`,
      [normalizedSymbols, resolution, fromUtc, toUtc],
    );

    const seriesBySymbol = new Map<string, IndexedPathBarPoint[]>();
    for (const symbol of normalizedSymbols) {
      seriesBySymbol.set(symbol, []);
    }
    for (const row of rows) {
      const symbol = row.symbol.toUpperCase();
      const series = seriesBySymbol.get(symbol);
      if (!series) continue;
      series.push(mapPathBarPoint(row));
    }

    return buildPathBarTimelinesFromSeries(normalizedSymbols, seriesBySymbol, timestampsUtc);
  });
}

export function buildPathMarkPriceMatrix(
  timelines: PathBarTimelineMap,
  timestampsUtc: string[],
): PathMarkPriceMatrix {
  const normalizedTimestamps = timestampsUtc.map(normalizePathTimestamp);
  const timestampIndexByUtc = new Map<string, number>();
  for (let index = 0; index < normalizedTimestamps.length; index += 1) {
    const timestamp = normalizedTimestamps[index];
    if (timestamp) {
      timestampIndexByUtc.set(timestamp, index);
    }
  }

  const markPricesBySymbol = new Map<string, Array<number | null>>();
  for (const [symbol, timeline] of timelines.entries()) {
    markPricesBySymbol.set(symbol.toUpperCase(), timeline.markPrices);
  }

  return {
    timestampsUtc: normalizedTimestamps,
    timestampIndexByUtc,
    markPricesBySymbol,
    timelineBySymbol: timelines,
  };
}

function buildPathMarkPriceMatrixFromSeries(
  normalizedSymbols: string[],
  seriesBySymbol: Map<string, IndexedMarkPricePoint[]>,
  timestampsUtc: string[],
): PathMarkPriceMatrix {
  const normalizedTimestamps = timestampsUtc.map(normalizePathTimestamp);
  const timestampMs = normalizedTimestamps.map((timestamp) => Date.parse(timestamp));
  const timestampIndexByUtc = new Map<string, number>();
  for (let index = 0; index < normalizedTimestamps.length; index += 1) {
    const timestamp = normalizedTimestamps[index];
    if (timestamp) {
      timestampIndexByUtc.set(timestamp, index);
    }
  }

  const markPricesBySymbol = new Map<string, Array<number | null>>();
  const timelineBySymbol: PathBarTimelineMap = new Map();
  for (const symbol of normalizedSymbols) {
    const series = (seriesBySymbol.get(symbol) ?? [])
      .filter((point) => Number.isFinite(point.closeMs))
      .sort((left, right) => left.closeMs - right.closeMs);
    const markPrices: Array<number | null> = [];
    let cursor = 0;
    let last: IndexedMarkPricePoint | null = null;
    for (let index = 0; index < normalizedTimestamps.length; index += 1) {
      const tsMs = timestampMs[index] ?? Number.NaN;
      while (cursor < series.length && (series[cursor]?.closeMs ?? Number.POSITIVE_INFINITY) <= tsMs) {
        last = series[cursor] ?? null;
        cursor += 1;
      }
      markPrices.push(last?.closePrice ?? null);
    }
    markPricesBySymbol.set(symbol, markPrices);
    timelineBySymbol.set(symbol, {
      exactBars: new Array(normalizedTimestamps.length).fill(null),
      markBars: new Array(normalizedTimestamps.length).fill(null),
      markPrices,
    });
  }

  return {
    timestampsUtc: normalizedTimestamps,
    timestampIndexByUtc,
    markPricesBySymbol,
    timelineBySymbol,
  };
}

function buildPathMarkPriceMatrixFromMarks(
  normalizedSymbols: string[],
  timestampsUtc: string[],
  marks: Array<{
    symbol: string;
    timestamp_index: number | string;
    close_price: number | string | null;
  }>,
): PathMarkPriceMatrix {
  const normalizedTimestamps = timestampsUtc.map(normalizePathTimestamp);
  const timestampIndexByUtc = new Map<string, number>();
  for (let index = 0; index < normalizedTimestamps.length; index += 1) {
    const timestamp = normalizedTimestamps[index];
    if (timestamp) {
      timestampIndexByUtc.set(timestamp, index);
    }
  }

  const markPricesBySymbol = new Map<string, Array<number | null>>();
  const timelineBySymbol: PathBarTimelineMap = new Map();
  for (const symbol of normalizedSymbols) {
    const markPrices = new Array<number | null>(normalizedTimestamps.length).fill(null);
    markPricesBySymbol.set(symbol, markPrices);
    timelineBySymbol.set(symbol, {
      exactBars: new Array(normalizedTimestamps.length).fill(null),
      markBars: new Array(normalizedTimestamps.length).fill(null),
      markPrices,
    });
  }

  for (const row of marks) {
    const symbol = row.symbol.toUpperCase();
    const index = Number(row.timestamp_index) - 1;
    if (!Number.isInteger(index) || index < 0 || index >= normalizedTimestamps.length) continue;
    const markPrices = markPricesBySymbol.get(symbol);
    if (!markPrices) continue;
    markPrices[index] = row.close_price === null ? null : Number(row.close_price);
  }

  return {
    timestampsUtc: normalizedTimestamps,
    timestampIndexByUtc,
    markPricesBySymbol,
    timelineBySymbol,
  };
}

export function getPathMarkPriceAtIndex(
  matrix: PathMarkPriceMatrix,
  symbol: string,
  index: number,
) {
  if (!Number.isInteger(index) || index < 0) return null;
  return matrix.markPricesBySymbol.get(symbol.toUpperCase())?.[index] ?? null;
}

export function getPathTimestampIndex(
  matrix: PathMarkPriceMatrix,
  timestampUtc: string,
) {
  return matrix.timestampIndexByUtc.get(normalizePathTimestamp(timestampUtc)) ?? null;
}

export function getPathMarkPriceSeries(
  matrix: PathMarkPriceMatrix,
  symbol: string,
): ReadonlyArray<number | null> {
  return matrix.markPricesBySymbol.get(symbol.toUpperCase()) ?? [];
}

export function getPathMarkPriceAtTimestamp(
  matrix: PathMarkPriceMatrix,
  symbol: string,
  timestampUtc: string,
) {
  const timestampIndex = matrix.timestampIndexByUtc.get(normalizePathTimestamp(timestampUtc));
  if (timestampIndex === undefined) return null;
  return getPathMarkPriceAtIndex(matrix, symbol, timestampIndex);
}

export async function loadPathMarkPriceMatrix(
  symbols: string[],
  fromUtc: string,
  toUtc: string,
  timestampsUtc: string[],
  resolution = CANONICAL_PATH_RESOLUTION,
  priceBundleId = "unscoped",
) {
  const normalizedSymbols = normalizeSymbols(symbols);
  if (normalizedSymbols.length === 0) {
    return buildPathMarkPriceMatrixFromSeries([], new Map(), timestampsUtc);
  }

  const normalizedTimestamps = timestampsUtc.map(normalizePathTimestamp);
  const firstTimestamp = normalizedTimestamps[0] ?? "";
  const middleTimestamp = normalizedTimestamps[Math.floor(normalizedTimestamps.length / 2)] ?? "";
  const lastTimestamp = normalizedTimestamps[normalizedTimestamps.length - 1] ?? "";
  const cacheKey = [
    "pathMarkPriceMatrix",
    priceBundleId,
    pathBarSourceCacheKey(resolution),
    resolution,
    fromUtc,
    toUtc,
    normalizedTimestamps.length,
    firstTimestamp,
    middleTimestamp,
    lastTimestamp,
    normalizedSymbols.join(","),
  ].join(":");

  return getOrSetRuntimeCache(cacheKey, getPathBarLoaderCacheTtlMs(), async () => {
    const localBars = await tryLoadLocalM1PathBars(normalizedSymbols, fromUtc, toUtc, resolution);
    if (localBars) {
      const seriesBySymbol = new Map<string, IndexedMarkPricePoint[]>();
      for (const symbol of normalizedSymbols) {
        seriesBySymbol.set(
          symbol,
          (localBars.get(symbol) ?? []).map((bar) => ({
            closeMs: Date.parse(bar.barCloseUtc),
            closePrice: bar.closePrice,
          })),
        );
      }
      return buildPathMarkPriceMatrixFromSeries(normalizedSymbols, seriesBySymbol, timestampsUtc);
    }

    if (normalizedTimestamps.length > getPathMarkTargetedLookupMaxTimestamps()) {
      const rows = await query<{
        symbol: string;
        bar_close_utc: Date;
        close_price: number | string;
      }>(
        `SELECT symbol, bar_close_utc, close_price
           FROM canonical_price_bars
          WHERE symbol = ANY($1::text[])
            AND timeframe = $2
            AND bar_open_utc >= $3::timestamptz
            AND bar_open_utc < $4::timestamptz
          ORDER BY symbol ASC, bar_close_utc ASC`,
        [normalizedSymbols, resolution, fromUtc, toUtc],
      );

      const seriesBySymbol = new Map<string, IndexedMarkPricePoint[]>();
      for (const symbol of normalizedSymbols) {
        seriesBySymbol.set(symbol, []);
      }
      for (const row of rows) {
        const symbol = row.symbol.toUpperCase();
        const series = seriesBySymbol.get(symbol);
        if (!series) continue;
        series.push({
          closeMs: row.bar_close_utc.getTime(),
          closePrice: Number(row.close_price),
        });
      }

      return buildPathMarkPriceMatrixFromSeries(normalizedSymbols, seriesBySymbol, timestampsUtc);
    }

    const rows = await query<{
      symbol: string;
      timestamp_index: number | string;
      close_price: number | string | null;
    }>(
      `WITH requested_symbols AS (
          SELECT unnest($1::text[]) AS symbol
        ),
        requested_timestamps AS (
          SELECT timestamp_utc, ordinal::integer AS timestamp_index
          FROM unnest($5::timestamptz[]) WITH ORDINALITY AS ts(timestamp_utc, ordinal)
        )
        SELECT symbols.symbol,
               timestamps.timestamp_index,
               mark.close_price
          FROM requested_symbols symbols
          CROSS JOIN requested_timestamps timestamps
          LEFT JOIN LATERAL (
            SELECT bars.close_price
              FROM canonical_price_bars bars
             WHERE bars.symbol = symbols.symbol
               AND bars.timeframe = $2
               AND bars.bar_open_utc >= $3::timestamptz
               AND bars.bar_open_utc < $4::timestamptz
               AND bars.bar_open_utc < timestamps.timestamp_utc
               AND bars.bar_close_utc <= timestamps.timestamp_utc
             ORDER BY bars.bar_open_utc DESC
             LIMIT 1
          ) mark ON true
         ORDER BY symbols.symbol ASC, timestamps.timestamp_index ASC`,
      [normalizedSymbols, resolution, fromUtc, toUtc, normalizedTimestamps],
    );

    return buildPathMarkPriceMatrixFromMarks(normalizedSymbols, timestampsUtc, rows);
  });
}

export function buildPathMarkPriceLookup(
  symbols: string[],
  barsBySymbol: PathBarMap,
  timestampsUtc: string[],
): Map<string, Map<string, number | null>> {
  const timelines = buildPathBarTimelines(symbols, barsBySymbol, timestampsUtc);
  const lookup = new Map<string, Map<string, number | null>>();

  for (const [symbol, timeline] of timelines.entries()) {
    const marks = new Map<string, number | null>();
    for (let index = 0; index < timestampsUtc.length; index += 1) {
      const timestamp = timestampsUtc[index];
      if (timestamp) {
        marks.set(timestamp, timeline.markPrices[index] ?? null);
      }
    }
    lookup.set(symbol, marks);
  }

  return lookup;
}

export async function loadPathMarkPriceLookup(
  symbols: string[],
  fromUtc: string,
  toUtc: string,
  timestampsUtc: string[],
  resolution = CANONICAL_PATH_RESOLUTION,
): Promise<Map<string, Map<string, number | null>>> {
  const matrix = await loadPathMarkPriceMatrix(symbols, fromUtc, toUtc, timestampsUtc, resolution);
  const lookup = new Map<string, Map<string, number | null>>();

  for (const [symbol, markPrices] of matrix.markPricesBySymbol.entries()) {
    const marks = new Map<string, number | null>();
    for (let index = 0; index < timestampsUtc.length; index += 1) {
      const timestamp = timestampsUtc[index];
      if (timestamp) {
        marks.set(timestamp, markPrices[index] ?? null);
      }
    }
    lookup.set(symbol, marks);
  }

  return lookup;
}
