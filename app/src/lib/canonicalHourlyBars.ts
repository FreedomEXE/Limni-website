import { DateTime } from "luxon";
import { fetchBitgetSpotCandleSeries, type BitgetHourlyCandle } from "@/lib/bitget";
import {
  CANONICAL_INSTRUMENTS,
  type CanonicalInstrument,
} from "@/lib/canonicalInstruments";
import {
  CANONICAL_WEEKS,
  getCanonicalWeekWindow,
} from "@/lib/canonicalPriceWindows";
import type { AssetClass } from "@/lib/cotMarkets";
import { query } from "@/lib/db";
import {
  fetchOandaCandleSeries,
  fetchOandaMinuteSeries,
  type OandaHourlyCandle,
} from "@/lib/oandaPrices";
import { normalizeWeekOpenUtc } from "@/lib/weekAnchor";

export type CanonicalPathBackfillTimeframe = "1h" | "1m";

export type CanonicalHourlyBackfillOptions = {
  assetClass?: AssetClass | "all";
  symbols?: string[];
  weeks?: string[];
  fromWeek?: string;
  toWeek?: string;
  timeframe?: CanonicalPathBackfillTimeframe;
  dryRun?: boolean;
  delayMs?: number;
  onProgress?: (event: CanonicalHourlyBackfillEvent) => void | Promise<void>;
};

export type CanonicalHourlyBackfillEvent = {
  symbol: string;
  assetClass: AssetClass;
  weekOpenUtc: string;
  timeframe: CanonicalPathBackfillTimeframe;
  provider: "oanda" | "bitget_spot";
  barsFetched: number;
  barsUpserted: number;
  dryRun: boolean;
  error?: string;
};

export type CanonicalHourlyBackfillResult = {
  startedAt: string;
  completedAt: string;
  timeframe: CanonicalPathBackfillTimeframe;
  dryRun: boolean;
  instruments: number;
  weeks: number;
  barsFetched: number;
  barsUpserted: number;
  errors: string[];
  events: CanonicalHourlyBackfillEvent[];
};

export type CanonicalHourlyCoverageOptions = {
  assetClass?: AssetClass | "all";
  symbols?: string[];
  weeks?: string[];
  fromWeek?: string;
  toWeek?: string;
  timeframe?: CanonicalPathBackfillTimeframe;
};

export type CanonicalHourlyCoverageRow = {
  symbol: string;
  assetClass: AssetClass;
  weekOpenUtc: string;
  timeframe: CanonicalPathBackfillTimeframe;
  sourceProvider: string | null;
  qualityStatus: string | null;
  expectedBars: number;
  actualBars: number;
  coveragePct: number;
  firstBarUtc: string | null;
  lastBarUtc: string | null;
  status: "complete" | "partial" | "missing" | "in_progress";
};

export type CanonicalHourlyCoverageResult = {
  generatedAt: string;
  timeframe: CanonicalPathBackfillTimeframe;
  instruments: number;
  weeks: number;
  rows: CanonicalHourlyCoverageRow[];
  summary: {
    complete: number;
    partial: number;
    missing: number;
    inProgress: number;
    lowestCoveragePct: number;
  };
};

type ProviderHourlyBar = OandaHourlyCandle | BitgetHourlyCandle;

type CanonicalPathBarUpsertRow = {
  symbol: string;
  assetClass: AssetClass;
  timeframe: CanonicalPathBackfillTimeframe;
  barOpenUtc: string;
  barCloseUtc: string;
  openPrice: number;
  highPrice: number;
  lowPrice: number;
  closePrice: number;
  sourceProvider: "oanda" | "bitget_spot";
  qualityStatus: string;
};

const CANONICAL_PATH_BAR_UPSERT_BATCH_SIZE = 500;

function normalizeTimeframe(timeframe?: CanonicalPathBackfillTimeframe): CanonicalPathBackfillTimeframe {
  return timeframe === "1m" ? "1m" : "1h";
}

function timeframeMinutes(timeframe: CanonicalPathBackfillTimeframe) {
  return timeframe === "1m" ? 1 : 60;
}

function timeframeQualityStatus(timeframe: CanonicalPathBackfillTimeframe, provider: "oanda" | "bitget_spot") {
  if (timeframe === "1m") return provider === "oanda" ? "provider_minute" : "unavailable";
  return provider === "bitget_spot" ? "provider_hourly_spot" : "provider_hourly";
}

function round(value: number, digits = 6) {
  return Number(value.toFixed(digits));
}

function chunkRows<T>(rows: T[], size = CANONICAL_PATH_BAR_UPSERT_BATCH_SIZE): T[][] {
  const chunkSize = Number.isFinite(size) && size > 0 ? Math.floor(size) : CANONICAL_PATH_BAR_UPSERT_BATCH_SIZE;
  const chunks: T[][] = [];
  for (let index = 0; index < rows.length; index += chunkSize) {
    chunks.push(rows.slice(index, index + chunkSize));
  }
  return chunks;
}

function normalizeSymbols(symbols?: string[]) {
  return new Set(
    (symbols ?? [])
      .map((symbol) => symbol.trim().toUpperCase())
      .filter(Boolean),
  );
}

function selectInstruments(options: {
  assetClass?: AssetClass | "all";
  symbols?: string[];
}) {
  const symbolSet = normalizeSymbols(options.symbols);
  return CANONICAL_INSTRUMENTS.filter((instrument) => {
    if (!instrument.isActive) return false;
    if (options.assetClass && options.assetClass !== "all" && instrument.assetClass !== options.assetClass) {
      return false;
    }
    if (symbolSet.size > 0 && !symbolSet.has(instrument.symbol.toUpperCase())) {
      return false;
    }
    return true;
  });
}

function selectWeeks(options: {
  weeks?: string[];
  fromWeek?: string;
  toWeek?: string;
}) {
  if (options.weeks && options.weeks.length > 0) {
    return [...new Set(
      options.weeks
        .map((week) => normalizeWeekOpenUtc(week.trim()) ?? week.trim())
        .filter(Boolean),
    )].sort();
  }

  const fromMs = options.fromWeek
    ? DateTime.fromISO(options.fromWeek, { zone: "utc" }).toMillis()
    : Number.NEGATIVE_INFINITY;
  const toMs = options.toWeek
    ? DateTime.fromISO(options.toWeek, { zone: "utc" }).toMillis()
    : Number.POSITIVE_INFINITY;

  return CANONICAL_WEEKS.filter((week) => {
    const ms = DateTime.fromISO(week, { zone: "utc" }).toMillis();
    return ms >= fromMs && ms <= toMs;
  });
}

async function fetchHourlyBarsForInstrument(
  instrument: CanonicalInstrument,
  weekOpenUtc: string,
  timeframe: CanonicalPathBackfillTimeframe,
) {
  const window = getCanonicalWeekWindow(weekOpenUtc, instrument.assetClass);
  return fetchBarsForInstrumentWindow(instrument, window.openUtc, window.closeUtc, timeframe);
}

async function fetchBarsForInstrumentWindow(
  instrument: CanonicalInstrument,
  openUtc: DateTime,
  closeUtc: DateTime,
  timeframe: CanonicalPathBackfillTimeframe,
) {
  if (instrument.primaryProvider === "oanda" && instrument.oandaInstrument) {
    const bars = timeframe === "1m"
      ? await fetchOandaMinuteSeries(
          instrument.oandaInstrument,
          openUtc,
          closeUtc,
        )
      : await fetchOandaCandleSeries(
          instrument.oandaInstrument,
          openUtc,
          closeUtc,
        );
    return {
      provider: "oanda" as const,
      qualityStatus: timeframeQualityStatus(timeframe, "oanda"),
      bars,
    };
  }

  if (instrument.primaryProvider === "bitget" && instrument.bitgetBaseCoin) {
    if (timeframe === "1m") {
      return {
        provider: "bitget_spot" as const,
        qualityStatus: "unavailable",
        bars: [] as ProviderHourlyBar[],
      };
    }
    return {
      provider: "bitget_spot" as const,
      qualityStatus: timeframeQualityStatus(timeframe, "bitget_spot"),
      bars: await fetchBitgetSpotCandleSeries(instrument.bitgetBaseCoin, {
        openUtc,
        closeUtc,
      }),
    };
  }

  return {
    provider: instrument.primaryProvider === "bitget" ? "bitget_spot" as const : "oanda" as const,
    qualityStatus: "unavailable",
    bars: [] as ProviderHourlyBar[],
  };
}

function normalizeUtcDateTime(value: string | DateTime, label: string) {
  const parsed = typeof value === "string"
    ? DateTime.fromISO(value, { zone: "utc" })
    : value.toUTC();
  if (!parsed.isValid) {
    throw new Error(`Invalid ${label}: ${value}`);
  }
  return parsed;
}

async function upsertCanonicalPathBars(rows: CanonicalPathBarUpsertRow[]) {
  let barsUpserted = 0;

  for (const batch of chunkRows(rows)) {
    const params: unknown[] = [];
    const valuesSql = batch.map((row, index) => {
      const offset = index * 11;
      params.push(
        row.symbol,
        row.assetClass,
        row.timeframe,
        row.barOpenUtc,
        row.barCloseUtc,
        row.openPrice,
        row.highPrice,
        row.lowPrice,
        row.closePrice,
        row.sourceProvider,
        row.qualityStatus,
      );
      return `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}::timestamptz, $${offset + 5}::timestamptz, $${offset + 6}, $${offset + 7}, $${offset + 8}, $${offset + 9}, $${offset + 10}, $${offset + 11})`;
    }).join(", ");

    await query(
      `INSERT INTO canonical_price_bars (
         symbol, asset_class, timeframe, bar_open_utc, bar_close_utc,
         open_price, high_price, low_price, close_price, source_provider, quality_status
       )
       VALUES ${valuesSql}
       ON CONFLICT (symbol, timeframe, bar_open_utc)
       DO UPDATE SET
         asset_class = EXCLUDED.asset_class,
         bar_close_utc = EXCLUDED.bar_close_utc,
         open_price = EXCLUDED.open_price,
         high_price = EXCLUDED.high_price,
         low_price = EXCLUDED.low_price,
         close_price = EXCLUDED.close_price,
         source_provider = EXCLUDED.source_provider,
         quality_status = EXCLUDED.quality_status,
         updated_at = NOW()`,
      params,
    );
    barsUpserted += batch.length;
  }

  return barsUpserted;
}

export async function upsertCanonicalHourlyBarsForInstrument(options: {
  instrument: CanonicalInstrument;
  weekOpenUtc: string;
  timeframe?: CanonicalPathBackfillTimeframe;
  dryRun?: boolean;
}) {
  const { instrument, weekOpenUtc, dryRun = false } = options;
  const timeframe = normalizeTimeframe(options.timeframe);
  const fetched = await fetchHourlyBarsForInstrument(instrument, weekOpenUtc, timeframe);
  let barsUpserted = 0;

  if (!dryRun) {
    const minutes = timeframeMinutes(timeframe);
    const rows = fetched.bars.map((bar) => {
      const openDt = DateTime.fromMillis(bar.ts, { zone: "utc" });
      return {
        symbol: instrument.symbol,
        assetClass: instrument.assetClass,
        timeframe,
        barOpenUtc: openDt.toISO()!,
        barCloseUtc: openDt.plus({ minutes }).toISO()!,
        openPrice: round(bar.open),
        highPrice: round(bar.high),
        lowPrice: round(bar.low),
        closePrice: round(bar.close),
        sourceProvider: fetched.provider,
        qualityStatus: fetched.qualityStatus,
      };
    });
    barsUpserted = await upsertCanonicalPathBars(rows);
  }

  return {
    timeframe,
    provider: fetched.provider,
    qualityStatus: fetched.qualityStatus,
    barsFetched: fetched.bars.length,
    barsUpserted,
  };
}

export async function upsertCanonicalHourlyBarsForInstrumentWindow(options: {
  instrument: CanonicalInstrument;
  openUtc: string | DateTime;
  closeUtc: string | DateTime;
  timeframe?: CanonicalPathBackfillTimeframe;
  dryRun?: boolean;
}) {
  const { instrument, dryRun = false } = options;
  const timeframe = normalizeTimeframe(options.timeframe);
  const openUtc = normalizeUtcDateTime(options.openUtc, "openUtc");
  const closeUtc = normalizeUtcDateTime(options.closeUtc, "closeUtc");
  if (closeUtc.toMillis() <= openUtc.toMillis()) {
    throw new Error(`Invalid backfill window for ${instrument.symbol}: closeUtc must be after openUtc`);
  }

  const fetched = await fetchBarsForInstrumentWindow(instrument, openUtc, closeUtc, timeframe);
  let barsUpserted = 0;

  if (!dryRun) {
    const minutes = timeframeMinutes(timeframe);
    const rows = fetched.bars.map((bar) => {
      const openDt = DateTime.fromMillis(bar.ts, { zone: "utc" });
      return {
        symbol: instrument.symbol,
        assetClass: instrument.assetClass,
        timeframe,
        barOpenUtc: openDt.toISO()!,
        barCloseUtc: openDt.plus({ minutes }).toISO()!,
        openPrice: round(bar.open),
        highPrice: round(bar.high),
        lowPrice: round(bar.low),
        closePrice: round(bar.close),
        sourceProvider: fetched.provider,
        qualityStatus: fetched.qualityStatus,
      };
    });
    barsUpserted = await upsertCanonicalPathBars(rows);
  }

  return {
    timeframe,
    provider: fetched.provider,
    qualityStatus: fetched.qualityStatus,
    barsFetched: fetched.bars.length,
    barsUpserted,
  };
}

export async function backfillCanonicalHourlyBars(
  options: CanonicalHourlyBackfillOptions = {},
): Promise<CanonicalHourlyBackfillResult> {
  const startedAt = DateTime.utc().toISO() ?? new Date().toISOString();
  const dryRun = options.dryRun ?? false;
  const timeframe = normalizeTimeframe(options.timeframe);
  const delayMs = Math.max(0, options.delayMs ?? 100);
  const instruments = selectInstruments(options);
  const weeks = selectWeeks(options);
  const events: CanonicalHourlyBackfillEvent[] = [];
  const errors: string[] = [];
  let barsFetched = 0;
  let barsUpserted = 0;

  for (const instrument of instruments) {
    for (const weekOpenUtc of weeks) {
      let event: CanonicalHourlyBackfillEvent;
      try {
        const result = await upsertCanonicalHourlyBarsForInstrument({
          instrument,
          weekOpenUtc,
          timeframe,
          dryRun,
        });
        barsFetched += result.barsFetched;
        barsUpserted += result.barsUpserted;
        event = {
          symbol: instrument.symbol,
          assetClass: instrument.assetClass,
          weekOpenUtc,
          timeframe,
          provider: result.provider,
          barsFetched: result.barsFetched,
          barsUpserted: result.barsUpserted,
          dryRun,
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        errors.push(`${instrument.symbol} ${weekOpenUtc}: ${message}`);
        event = {
          symbol: instrument.symbol,
          assetClass: instrument.assetClass,
          weekOpenUtc,
          timeframe,
          provider: instrument.primaryProvider === "bitget" ? "bitget_spot" : "oanda",
          barsFetched: 0,
          barsUpserted: 0,
          dryRun,
          error: message,
        };
      }

      events.push(event);
      await options.onProgress?.(event);
      if (delayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }

  return {
    startedAt,
    completedAt: DateTime.utc().toISO() ?? new Date().toISOString(),
    timeframe,
    dryRun,
    instruments: instruments.length,
    weeks: weeks.length,
    barsFetched,
    barsUpserted,
    errors,
    events,
  };
}

function expectedHourlyBars(
  weekOpenUtc: string,
  assetClass: AssetClass,
  timeframe: CanonicalPathBackfillTimeframe,
) {
  const window = getCanonicalWeekWindow(weekOpenUtc, assetClass);
  return Math.ceil(window.closeUtc.diff(window.openUtc, "minutes").minutes / timeframeMinutes(timeframe));
}

function coverageStatus(row: {
  weekOpenUtc: string;
  assetClass: AssetClass;
  timeframe: CanonicalPathBackfillTimeframe;
  coveragePct: number;
  actualBars: number;
}) {
  const closeUtc = getCanonicalWeekWindow(row.weekOpenUtc, row.assetClass).closeUtc;
  const settleMinutes = row.timeframe === "1m" ? 5 : 120;
  if (closeUtc > DateTime.utc().minus({ minutes: settleMinutes })) {
    return "in_progress" as const;
  }
  if (row.actualBars === 0) return "missing" as const;
  if (row.coveragePct >= 90) return "complete" as const;
  return "partial" as const;
}

export async function getCanonicalHourlyCoverage(
  options: CanonicalHourlyCoverageOptions = {},
): Promise<CanonicalHourlyCoverageResult> {
  const timeframe = normalizeTimeframe(options.timeframe);
  const instruments = selectInstruments(options);
  const weeks = selectWeeks(options);

  if (instruments.length === 0 || weeks.length === 0) {
    return {
      generatedAt: DateTime.utc().toISO() ?? new Date().toISOString(),
      timeframe,
      instruments: instruments.length,
      weeks: weeks.length,
      rows: [],
      summary: {
        complete: 0,
        partial: 0,
        missing: 0,
        inProgress: 0,
        lowestCoveragePct: 100,
      },
    };
  }

  const requests = instruments.flatMap((instrument) =>
    weeks.map((weekOpenUtc) => {
      const window = getCanonicalWeekWindow(weekOpenUtc, instrument.assetClass);
      return {
        symbol: instrument.symbol,
        assetClass: instrument.assetClass,
        weekOpenUtc,
        openUtc: window.openUtc.toISO(),
        closeUtc: window.closeUtc.toISO(),
      };
    }),
  );

  const coverageRows = await query<{
    symbol: string;
    asset_class: AssetClass;
    week_open_utc: string;
    actual_bars: string | number;
    first_bar_utc: Date | null;
    last_bar_utc: Date | null;
    source_provider: string | null;
    quality_status: string | null;
  }>(
    `WITH requested AS (
       SELECT *
         FROM jsonb_to_recordset($1::jsonb) AS r(
           symbol text,
           asset_class text,
           week_open_utc text,
           open_utc timestamptz,
           close_utc timestamptz
         )
     )
     SELECT
       r.symbol,
       r.asset_class::text AS asset_class,
       r.week_open_utc,
       a.actual_bars,
       a.first_bar_utc,
       a.last_bar_utc,
       l.source_provider,
       l.quality_status
     FROM requested r
     CROSS JOIN LATERAL (
       SELECT
         COUNT(b.bar_open_utc) AS actual_bars,
         MIN(b.bar_open_utc) AS first_bar_utc,
         MAX(b.bar_open_utc) AS last_bar_utc
       FROM canonical_price_bars b
       WHERE b.symbol = r.symbol
         AND b.asset_class = r.asset_class
         AND b.timeframe = $2
         AND b.bar_open_utc >= r.open_utc
         AND b.bar_open_utc < r.close_utc
     ) a
     LEFT JOIN LATERAL (
       SELECT b.source_provider, b.quality_status
       FROM canonical_price_bars b
       WHERE b.symbol = r.symbol
         AND b.asset_class = r.asset_class
         AND b.timeframe = $2
         AND b.bar_open_utc >= r.open_utc
         AND b.bar_open_utc < r.close_utc
       ORDER BY b.bar_open_utc DESC
       LIMIT 1
     ) l ON true`,
    [
      JSON.stringify(
        requests.map((request) => ({
          symbol: request.symbol,
          asset_class: request.assetClass,
          week_open_utc: request.weekOpenUtc,
          open_utc: request.openUtc,
          close_utc: request.closeUtc,
        })),
      ),
      timeframe,
    ],
  );
  const coverageByKey = new Map(
    coverageRows.map((row) => [
      `${row.symbol.toUpperCase()}|${row.asset_class}|${row.week_open_utc}`,
      row,
    ]),
  );

  const rows: CanonicalHourlyCoverageRow[] = [];
  for (const instrument of instruments) {
    for (const weekOpenUtc of weeks) {
      const coverage = coverageByKey.get(`${instrument.symbol.toUpperCase()}|${instrument.assetClass}|${weekOpenUtc}`);
      const expectedBars = expectedHourlyBars(weekOpenUtc, instrument.assetClass, timeframe);
      const actualBars = Number(coverage?.actual_bars ?? 0);
      const coveragePct = expectedBars > 0 ? round((actualBars / expectedBars) * 100, 2) : 100;
      const row = {
        symbol: instrument.symbol,
        assetClass: instrument.assetClass,
        weekOpenUtc,
        timeframe,
        sourceProvider: coverage?.source_provider ?? null,
        qualityStatus: coverage?.quality_status ?? null,
        expectedBars,
        actualBars,
        coveragePct,
        firstBarUtc: coverage?.first_bar_utc?.toISOString() ?? null,
        lastBarUtc: coverage?.last_bar_utc?.toISOString() ?? null,
        status: "missing" as CanonicalHourlyCoverageRow["status"],
      };
      row.status = coverageStatus(row);
      rows.push(row);
    }
  }

  const summary = rows.reduce(
    (acc, row) => {
      if (row.status === "complete") acc.complete += 1;
      if (row.status === "partial") acc.partial += 1;
      if (row.status === "missing") acc.missing += 1;
      if (row.status === "in_progress") acc.inProgress += 1;
      if (row.status !== "in_progress") {
        acc.lowestCoveragePct = Math.min(acc.lowestCoveragePct, row.coveragePct);
      }
      return acc;
    },
    {
      complete: 0,
      partial: 0,
      missing: 0,
      inProgress: 0,
      lowestCoveragePct: 100,
    },
  );

  return {
    generatedAt: DateTime.utc().toISO() ?? new Date().toISOString(),
    timeframe,
    instruments: instruments.length,
    weeks: weeks.length,
    rows,
    summary,
  };
}
