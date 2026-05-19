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
import { fetchOandaCandleSeries, type OandaHourlyCandle } from "@/lib/oandaPrices";

export type CanonicalHourlyBackfillOptions = {
  assetClass?: AssetClass | "all";
  symbols?: string[];
  weeks?: string[];
  fromWeek?: string;
  toWeek?: string;
  dryRun?: boolean;
  delayMs?: number;
  onProgress?: (event: CanonicalHourlyBackfillEvent) => void | Promise<void>;
};

export type CanonicalHourlyBackfillEvent = {
  symbol: string;
  assetClass: AssetClass;
  weekOpenUtc: string;
  provider: "oanda" | "bitget_spot";
  barsFetched: number;
  barsUpserted: number;
  dryRun: boolean;
  error?: string;
};

export type CanonicalHourlyBackfillResult = {
  startedAt: string;
  completedAt: string;
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
};

export type CanonicalHourlyCoverageRow = {
  symbol: string;
  assetClass: AssetClass;
  weekOpenUtc: string;
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

function round(value: number, digits = 6) {
  return Number(value.toFixed(digits));
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
    const requested = new Set(options.weeks.map((week) => week.trim()).filter(Boolean));
    return CANONICAL_WEEKS.filter((week) => requested.has(week));
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
) {
  const window = getCanonicalWeekWindow(weekOpenUtc, instrument.assetClass);
  if (instrument.primaryProvider === "oanda" && instrument.oandaInstrument) {
    return {
      provider: "oanda" as const,
      qualityStatus: "provider_hourly",
      bars: await fetchOandaCandleSeries(
        instrument.oandaInstrument,
        window.openUtc,
        window.closeUtc,
      ),
    };
  }

  if (instrument.primaryProvider === "bitget" && instrument.bitgetBaseCoin) {
    return {
      provider: "bitget_spot" as const,
      qualityStatus: "provider_hourly_spot",
      bars: await fetchBitgetSpotCandleSeries(instrument.bitgetBaseCoin, {
        openUtc: window.openUtc,
        closeUtc: window.closeUtc,
      }),
    };
  }

  return {
    provider: instrument.primaryProvider === "bitget" ? "bitget_spot" as const : "oanda" as const,
    qualityStatus: "unavailable",
    bars: [] as ProviderHourlyBar[],
  };
}

export async function upsertCanonicalHourlyBarsForInstrument(options: {
  instrument: CanonicalInstrument;
  weekOpenUtc: string;
  dryRun?: boolean;
}) {
  const { instrument, weekOpenUtc, dryRun = false } = options;
  const fetched = await fetchHourlyBarsForInstrument(instrument, weekOpenUtc);
  let barsUpserted = 0;

  if (!dryRun) {
    for (const bar of fetched.bars) {
      const openDt = DateTime.fromMillis(bar.ts, { zone: "utc" });
      await query(
        `INSERT INTO canonical_price_bars (
           symbol, asset_class, timeframe, bar_open_utc, bar_close_utc,
           open_price, high_price, low_price, close_price, source_provider, quality_status
         )
         VALUES ($1, $2, '1h', $3::timestamptz, $4::timestamptz, $5, $6, $7, $8, $9, $10)
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
        [
          instrument.symbol,
          instrument.assetClass,
          openDt.toISO(),
          openDt.plus({ hours: 1 }).toISO(),
          round(bar.open),
          round(bar.high),
          round(bar.low),
          round(bar.close),
          fetched.provider,
          fetched.qualityStatus,
        ],
      );
      barsUpserted += 1;
    }
  }

  return {
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
          dryRun,
        });
        barsFetched += result.barsFetched;
        barsUpserted += result.barsUpserted;
        event = {
          symbol: instrument.symbol,
          assetClass: instrument.assetClass,
          weekOpenUtc,
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
    dryRun,
    instruments: instruments.length,
    weeks: weeks.length,
    barsFetched,
    barsUpserted,
    errors,
    events,
  };
}

function expectedHourlyBars(weekOpenUtc: string, assetClass: AssetClass) {
  const window = getCanonicalWeekWindow(weekOpenUtc, assetClass);
  return Math.ceil(window.closeUtc.diff(window.openUtc, "hours").hours);
}

function coverageStatus(row: {
  weekOpenUtc: string;
  assetClass: AssetClass;
  coveragePct: number;
  actualBars: number;
}) {
  const closeUtc = getCanonicalWeekWindow(row.weekOpenUtc, row.assetClass).closeUtc;
  if (closeUtc > DateTime.utc().minus({ hours: 2 })) {
    return "in_progress" as const;
  }
  if (row.actualBars === 0) return "missing" as const;
  if (row.coveragePct >= 90) return "complete" as const;
  return "partial" as const;
}

export async function getCanonicalHourlyCoverage(
  options: CanonicalHourlyCoverageOptions = {},
): Promise<CanonicalHourlyCoverageResult> {
  const instruments = selectInstruments(options);
  const weeks = selectWeeks(options);
  const symbols = instruments.map((instrument) => instrument.symbol);

  if (instruments.length === 0 || weeks.length === 0) {
    return {
      generatedAt: DateTime.utc().toISO() ?? new Date().toISOString(),
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

  const windows = instruments.flatMap((instrument) =>
    weeks.map((weekOpenUtc) => getCanonicalWeekWindow(weekOpenUtc, instrument.assetClass)),
  );
  const minOpen = DateTime.fromMillis(Math.min(...windows.map((window) => window.openUtc.toMillis()))).toISO();
  const maxClose = DateTime.fromMillis(Math.max(...windows.map((window) => window.closeUtc.toMillis()))).toISO();

  const barRows = await query<{
    symbol: string;
    asset_class: AssetClass;
    bar_open_utc: Date;
    source_provider: string | null;
    quality_status: string | null;
  }>(
    `SELECT symbol, asset_class, bar_open_utc, source_provider, quality_status
       FROM canonical_price_bars
      WHERE timeframe = '1h'
        AND symbol = ANY($1::text[])
        AND bar_open_utc >= $2::timestamptz
        AND bar_open_utc < $3::timestamptz`,
    [symbols, minOpen, maxClose],
  );

  const rows: CanonicalHourlyCoverageRow[] = [];
  for (const instrument of instruments) {
    for (const weekOpenUtc of weeks) {
      const window = getCanonicalWeekWindow(weekOpenUtc, instrument.assetClass);
      const matching = barRows
        .filter((bar) => {
          if (bar.symbol.toUpperCase() !== instrument.symbol.toUpperCase()) return false;
          const ms = bar.bar_open_utc.getTime();
          return ms >= window.openUtc.toMillis() && ms < window.closeUtc.toMillis();
        })
        .sort((a, b) => a.bar_open_utc.getTime() - b.bar_open_utc.getTime());
      const expectedBars = expectedHourlyBars(weekOpenUtc, instrument.assetClass);
      const actualBars = matching.length;
      const coveragePct = expectedBars > 0 ? round((actualBars / expectedBars) * 100, 2) : 100;
      const row = {
        symbol: instrument.symbol,
        assetClass: instrument.assetClass,
        weekOpenUtc,
        sourceProvider: matching.at(-1)?.source_provider ?? null,
        qualityStatus: matching.at(-1)?.quality_status ?? null,
        expectedBars,
        actualBars,
        coveragePct,
        firstBarUtc: matching[0]?.bar_open_utc.toISOString() ?? null,
        lastBarUtc: matching.at(-1)?.bar_open_utc.toISOString() ?? null,
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
    instruments: instruments.length,
    weeks: weeks.length,
    rows,
    summary,
  };
}
