/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: backfill-canonical-price-layer.ts
 * Description: Seeds instruments and backfills canonical bars plus derived pair period returns.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { DateTime } from "luxon";

function loadEnvFileIntoProcess(filePath: string) {
  if (!existsSync(filePath)) return;
  const lines = readFileSync(filePath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIndex = trimmed.indexOf("=");
    if (eqIndex <= 0) continue;
    const key = trimmed.slice(0, eqIndex).trim();
    const value = trimmed.slice(eqIndex + 1);
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

const REPO_ROOT = path.resolve(__dirname, "..");
loadEnvFileIntoProcess(path.join(REPO_ROOT, ".env"));
loadEnvFileIntoProcess(path.join(REPO_ROOT, ".env.local"));

type Timeframe = "1h" | "1d";

type CanonicalBarRow = {
  symbol: string;
  assetClass: string;
  timeframe: Timeframe;
  barOpenUtc: string;
  barCloseUtc: string;
  openPrice: number;
  highPrice: number;
  lowPrice: number;
  closePrice: number;
  sourceProvider: string;
  qualityStatus: string;
};

type RawBarRow = {
  provider: string;
  providerSymbol: string;
  assetClass: string;
  timeframe: Timeframe;
  barOpenUtc: string;
  barCloseUtc: string;
  openPrice: number;
  highPrice: number;
  lowPrice: number;
  closePrice: number;
  volume: number | null;
  isFinal: boolean;
  sourceBatchKey: string;
};

type PairPeriodReturnRow = {
  symbol: string;
  assetClass: string;
  periodType: "weekly" | "daily";
  periodOpenUtc: string;
  periodCloseUtc: string;
  openPrice: number;
  closePrice: number;
  highPrice: number;
  lowPrice: number;
  returnPct: number;
  source: string;
  derivedFromTimeframe: Timeframe;
  derivationVersion: string;
};

type ScriptOptions = {
  seedInstruments: boolean;
  daily: boolean;
  weekly: boolean;
  intraday5m: boolean;
  symbols: Set<string> | null;
  fromUtc: DateTime | null;
  toUtc: DateTime | null;
};

function parseArgs(): ScriptOptions {
  const args = new Set(process.argv.slice(2));
  const explicitSeed = args.has("--seed-instruments");
  const explicitDaily = args.has("--daily");
  const explicitWeekly = args.has("--weekly");
  const explicitIntraday = args.has("--intraday-5m");
  const hasExplicitOps = explicitSeed || explicitDaily || explicitWeekly || explicitIntraday;

  const symbolsArg = process.argv.find((value) => value.startsWith("--symbols="));
  const symbols = symbolsArg
    ? new Set(
      symbolsArg
        .slice("--symbols=".length)
        .split(",")
        .map((symbol) => symbol.trim().toUpperCase())
        .filter(Boolean),
    )
    : null;

  const fromArg = process.argv.find((value) => value.startsWith("--from="));
  const toArg = process.argv.find((value) => value.startsWith("--to="));
  const fromUtc = fromArg ? DateTime.fromISO(fromArg.slice("--from=".length), { zone: "utc" }) : null;
  const toUtc = toArg ? DateTime.fromISO(toArg.slice("--to=".length), { zone: "utc" }) : null;

  if (fromUtc && !fromUtc.isValid) {
    throw new Error(`Invalid --from value: ${fromArg}`);
  }
  if (toUtc && !toUtc.isValid) {
    throw new Error(`Invalid --to value: ${toArg}`);
  }

  return {
    seedInstruments: hasExplicitOps ? explicitSeed : true,
    daily: hasExplicitOps ? explicitDaily : true,
    weekly: hasExplicitOps ? explicitWeekly : true,
    intraday5m: explicitIntraday,
    symbols,
    fromUtc,
    toUtc,
  };
}

function round(value: number, digits = 6) {
  return Number(value.toFixed(digits));
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildBatchKey(parts: string[]) {
  return parts.join(":");
}

function chunkRows<T>(rows: T[], size = 200) {
  const chunks: T[][] = [];
  for (let index = 0; index < rows.length; index += size) {
    chunks.push(rows.slice(index, index + size));
  }
  return chunks;
}

function computeReturnPct(openPrice: number, closePrice: number) {
  if (!Number.isFinite(openPrice) || !Number.isFinite(closePrice) || openPrice === 0) {
    throw new Error(`Cannot compute return for open=${openPrice} close=${closePrice}`);
  }
  return round(((closePrice - openPrice) / openPrice) * 100, 6);
}

function buildDailyCanonicalBarsFromBitgetHourly(
  symbol: string,
  assetClass: string,
  hourlyBars: CanonicalBarRow[],
  sourceProvider = "bitget",
  qualityStatus = "derived_from_1h",
): CanonicalBarRow[] {
  const grouped = new Map<string, CanonicalBarRow[]>();
  for (const bar of hourlyBars) {
    const key = DateTime.fromISO(bar.barOpenUtc, { zone: "utc" }).startOf("day").toISO()!;
    const list = grouped.get(key) ?? [];
    list.push(bar);
    grouped.set(key, list);
  }

  return [...grouped.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([dayOpenUtc, bars]) => {
      const ordered = bars.sort((left, right) => left.barOpenUtc.localeCompare(right.barOpenUtc));
      const first = ordered[0]!;
      const last = ordered[ordered.length - 1]!;
      return {
        symbol,
        assetClass,
        timeframe: "1d" as const,
        barOpenUtc: dayOpenUtc,
        barCloseUtc: DateTime.fromISO(dayOpenUtc, { zone: "utc" }).plus({ days: 1 }).toISO()!,
        openPrice: first.openPrice,
        highPrice: round(Math.max(...ordered.map((bar) => bar.highPrice)), 6),
        lowPrice: round(Math.min(...ordered.map((bar) => bar.lowPrice)), 6),
        closePrice: last.closePrice,
        sourceProvider,
        qualityStatus,
      };
    });
}

async function upsertInstrumentRegistry(
  query: <T = unknown>(text: string, params?: readonly unknown[]) => Promise<T[]>,
  instruments: Array<{
    symbol: string;
    assetClass: string;
    primaryProvider: string;
    oandaInstrument: string | null;
    bitgetBaseCoin: string | null;
    isActive: boolean;
  }>,
) {
  for (const batch of chunkRows(instruments, 100)) {
    const params: unknown[] = [];
    const valuesSql = batch.map((instrument, index) => {
      const offset = index * 6;
      params.push(
        instrument.symbol,
        instrument.assetClass,
        instrument.primaryProvider,
        instrument.oandaInstrument,
        instrument.bitgetBaseCoin,
        instrument.isActive,
      );
      return `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6})`;
    }).join(", ");

    await query(
      `INSERT INTO instrument_registry (
         symbol, asset_class, primary_provider, oanda_instrument, bitget_base_coin, is_active
       )
       VALUES ${valuesSql}
       ON CONFLICT (symbol)
       DO UPDATE SET
         asset_class = EXCLUDED.asset_class,
         primary_provider = EXCLUDED.primary_provider,
         oanda_instrument = EXCLUDED.oanda_instrument,
         bitget_base_coin = EXCLUDED.bitget_base_coin,
         is_active = EXCLUDED.is_active,
         updated_at = NOW()`,
      params,
    );
  }
}

async function upsertRawBars(
  query: <T = unknown>(text: string, params?: readonly unknown[]) => Promise<T[]>,
  rows: RawBarRow[],
) {
  for (const batch of chunkRows(rows, 100)) {
    const params: unknown[] = [];
    const valuesSql = batch.map((row, index) => {
      const offset = index * 12;
      params.push(
        row.provider,
        row.providerSymbol,
        row.assetClass,
        row.timeframe,
        row.barOpenUtc,
        row.barCloseUtc,
        row.openPrice,
        row.highPrice,
        row.lowPrice,
        row.closePrice,
        row.volume,
        row.sourceBatchKey,
      );
      return `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}::timestamptz, $${offset + 6}::timestamptz, $${offset + 7}, $${offset + 8}, $${offset + 9}, $${offset + 10}, $${offset + 11}, TRUE, $${offset + 12})`;
    }).join(", ");

    await query(
      `INSERT INTO raw_price_bars (
         provider, provider_symbol, asset_class, timeframe, bar_open_utc, bar_close_utc,
         open_price, high_price, low_price, close_price, volume, is_final, source_batch_key
       )
       VALUES ${valuesSql}
       ON CONFLICT (provider, provider_symbol, timeframe, bar_open_utc)
       DO UPDATE SET
         bar_close_utc = EXCLUDED.bar_close_utc,
         open_price = EXCLUDED.open_price,
         high_price = EXCLUDED.high_price,
         low_price = EXCLUDED.low_price,
         close_price = EXCLUDED.close_price,
         volume = EXCLUDED.volume,
         is_final = EXCLUDED.is_final,
         source_batch_key = EXCLUDED.source_batch_key,
         updated_at = NOW()`,
      params,
    );
  }
}

async function upsertCanonicalBars(
  query: <T = unknown>(text: string, params?: readonly unknown[]) => Promise<T[]>,
  rows: CanonicalBarRow[],
) {
  for (const batch of chunkRows(rows, 100)) {
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
  }
}

async function upsertPairPeriodReturns(
  query: <T = unknown>(text: string, params?: readonly unknown[]) => Promise<T[]>,
  rows: PairPeriodReturnRow[],
) {
  for (const batch of chunkRows(rows, 100)) {
    const params: unknown[] = [];
    const valuesSql = batch.map((row, index) => {
      const offset = index * 13;
      params.push(
        row.symbol,
        row.assetClass,
        row.periodType,
        row.periodOpenUtc,
        row.periodCloseUtc,
        row.openPrice,
        row.closePrice,
        row.highPrice,
        row.lowPrice,
        row.returnPct,
        row.source,
        row.derivedFromTimeframe,
        row.derivationVersion,
      );
      return `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}::timestamptz, $${offset + 5}::timestamptz, $${offset + 6}, $${offset + 7}, $${offset + 8}, $${offset + 9}, $${offset + 10}, $${offset + 11}, $${offset + 12}, $${offset + 13})`;
    }).join(", ");

    await query(
      `INSERT INTO pair_period_returns (
         symbol, asset_class, period_type, period_open_utc, period_close_utc,
         open_price, close_price, high_price, low_price, return_pct, source,
         derived_from_timeframe, derivation_version
       )
       VALUES ${valuesSql}
       ON CONFLICT (symbol, asset_class, period_type, period_open_utc)
       DO UPDATE SET
         period_close_utc = EXCLUDED.period_close_utc,
         open_price = EXCLUDED.open_price,
         close_price = EXCLUDED.close_price,
         high_price = EXCLUDED.high_price,
         low_price = EXCLUDED.low_price,
         return_pct = EXCLUDED.return_pct,
         source = EXCLUDED.source,
         derived_from_timeframe = EXCLUDED.derived_from_timeframe,
         derivation_version = EXCLUDED.derivation_version,
         updated_at = NOW()`,
      params,
    );
  }
}

async function loadCanonicalDailyBarsFromDb(
  query: <T = unknown>(text: string, params?: readonly unknown[]) => Promise<T[]>,
  symbol: string,
  fromUtc: string,
  toUtc: string,
): Promise<CanonicalBarRow[]> {
  const rows = await query<{
    symbol: string;
    asset_class: string;
    timeframe: Timeframe;
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
      WHERE symbol = $1
        AND timeframe = '1d'
        AND bar_open_utc >= $2::timestamptz
        AND bar_open_utc < $3::timestamptz
      ORDER BY bar_open_utc ASC`,
    [symbol, fromUtc, toUtc],
  );
  return rows.map((row) => ({
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
  }));
}

async function main() {
  const options = parseArgs();
  if (options.intraday5m) {
    throw new Error("--intraday-5m is not implemented in this phase. This pass builds the schema plus daily/weekly layer.");
  }

  const { query } = await import("../src/lib/db");
  const { CANONICAL_INSTRUMENTS } = await import("../src/lib/canonicalInstruments");
  const {
    CANONICAL_WEEKS,
    getCanonicalDailyBackfillRange,
    getCanonicalWeekWindow,
  } = await import("../src/lib/canonicalPriceWindows");
  const { fetchOandaDailySeries } = await import("../src/lib/oandaPrices");
  const { fetchBitgetCandleSeries, fetchBitgetSpotCandleSeries } = await import("../src/lib/bitget");

  const selectedInstruments = CANONICAL_INSTRUMENTS.filter((instrument) =>
    !options.symbols || options.symbols.has(instrument.symbol)
  );

  if (selectedInstruments.length === 0) {
    throw new Error("No canonical instruments selected for backfill.");
  }

  if (options.seedInstruments) {
    await upsertInstrumentRegistry(query, selectedInstruments);
    console.log(`Seeded instrument_registry for ${selectedInstruments.length} instruments`);
  }

  const dailyBarsBySymbol = new Map<string, CanonicalBarRow[]>();
  let rawBarsInserted = 0;
  let canonicalBarsInserted = 0;
  let dailyReturnsInserted = 0;

  if (options.daily) {
    for (const instrument of selectedInstruments) {
      const fallbackRange = getCanonicalDailyBackfillRange(instrument.assetClass, CANONICAL_WEEKS);
      const fromUtc = options.fromUtc ?? fallbackRange.fromUtc;
      const toUtc = options.toUtc ?? fallbackRange.toUtc;

      if (instrument.primaryProvider === "oanda") {
        const providerBars = await fetchOandaDailySeries(instrument.oandaInstrument ?? instrument.symbol, fromUtc, toUtc);
        const rawBars: RawBarRow[] = providerBars.map((bar) => ({
          provider: "oanda",
          providerSymbol: instrument.oandaInstrument ?? instrument.symbol,
          assetClass: instrument.assetClass,
          timeframe: "1d",
          barOpenUtc: DateTime.fromMillis(bar.ts, { zone: "utc" }).toISO()!,
          barCloseUtc: DateTime.fromMillis(bar.ts, { zone: "utc" }).plus({
            hours: instrument.assetClass === "indices" || instrument.assetClass === "commodities" ? 23 : 24,
          }).toISO()!,
          openPrice: round(bar.open, 6),
          highPrice: round(bar.high, 6),
          lowPrice: round(bar.low, 6),
          closePrice: round(bar.close, 6),
          volume: null,
          isFinal: true,
          sourceBatchKey: buildBatchKey(["oanda", instrument.symbol, "1d", fromUtc.toISO()!, toUtc.toISO()!]),
        }));
        const canonicalBars: CanonicalBarRow[] = rawBars.map((bar) => ({
          symbol: instrument.symbol,
          assetClass: instrument.assetClass,
          timeframe: "1d",
          barOpenUtc: bar.barOpenUtc,
          barCloseUtc: bar.barCloseUtc,
          openPrice: bar.openPrice,
          highPrice: bar.highPrice,
          lowPrice: bar.lowPrice,
          closePrice: bar.closePrice,
          sourceProvider: "oanda",
          qualityStatus: "provider_daily",
        }));

        await upsertRawBars(query, rawBars);
        await upsertCanonicalBars(query, canonicalBars);
        rawBarsInserted += rawBars.length;
        canonicalBarsInserted += canonicalBars.length;
        dailyBarsBySymbol.set(instrument.symbol, canonicalBars);
        await sleep(100);
      } else {
        const symbolBase = instrument.bitgetBaseCoin ?? instrument.symbol.replace("USD", "");
        const providerBars = instrument.assetClass === "crypto"
          ? await fetchBitgetSpotCandleSeries(symbolBase, {
            openUtc: fromUtc,
            closeUtc: toUtc,
          })
          : await fetchBitgetCandleSeries(symbolBase, {
            openUtc: fromUtc,
            closeUtc: toUtc,
          });
        const providerName = instrument.assetClass === "crypto" ? "bitget_spot" : "bitget";
        const rawBars: RawBarRow[] = providerBars.map((bar) => ({
          provider: providerName,
          providerSymbol: `${symbolBase}USDT`,
          assetClass: instrument.assetClass,
          timeframe: "1h",
          barOpenUtc: DateTime.fromMillis(bar.ts, { zone: "utc" }).toISO()!,
          barCloseUtc: DateTime.fromMillis(bar.ts, { zone: "utc" }).plus({ hours: 1 }).toISO()!,
          openPrice: round(bar.open, 6),
          highPrice: round(bar.high, 6),
          lowPrice: round(bar.low, 6),
          closePrice: round(bar.close, 6),
          volume: null,
          isFinal: true,
          sourceBatchKey: buildBatchKey([providerName, instrument.symbol, "1h", fromUtc.toISO()!, toUtc.toISO()!]),
        }));
        const canonicalHourlyBars: CanonicalBarRow[] = rawBars.map((bar) => ({
          symbol: instrument.symbol,
          assetClass: instrument.assetClass,
          timeframe: "1h",
          barOpenUtc: bar.barOpenUtc,
          barCloseUtc: bar.barCloseUtc,
          openPrice: bar.openPrice,
          highPrice: bar.highPrice,
          lowPrice: bar.lowPrice,
          closePrice: bar.closePrice,
          sourceProvider: providerName,
          qualityStatus: instrument.assetClass === "crypto" ? "provider_hourly_spot" : "provider_hourly",
        }));
        const canonicalDailyBars = buildDailyCanonicalBarsFromBitgetHourly(
          instrument.symbol,
          instrument.assetClass,
          canonicalHourlyBars,
          providerName,
          instrument.assetClass === "crypto" ? "derived_from_spot_1h" : "derived_from_1h",
        );

        await upsertRawBars(query, rawBars);
        await upsertCanonicalBars(query, canonicalHourlyBars);
        await upsertCanonicalBars(query, canonicalDailyBars);
        rawBarsInserted += rawBars.length;
        canonicalBarsInserted += canonicalHourlyBars.length + canonicalDailyBars.length;
        dailyBarsBySymbol.set(instrument.symbol, canonicalDailyBars);
        await sleep(100);
      }

      const dailyBars = dailyBarsBySymbol.get(instrument.symbol) ?? [];
      const dailyReturns = dailyBars.map<PairPeriodReturnRow>((bar) => ({
        symbol: instrument.symbol,
        assetClass: instrument.assetClass,
        periodType: "daily",
        periodOpenUtc: bar.barOpenUtc,
        periodCloseUtc: bar.barCloseUtc,
        openPrice: bar.openPrice,
        closePrice: bar.closePrice,
        highPrice: bar.highPrice,
        lowPrice: bar.lowPrice,
        returnPct: computeReturnPct(bar.openPrice, bar.closePrice),
        source: "canonical_price_bars",
        derivedFromTimeframe: "1d",
        derivationVersion: "v1",
      }));
      await upsertPairPeriodReturns(query, dailyReturns);
      dailyReturnsInserted += dailyReturns.length;
    }
  }

  let weeklyReturnsInserted = 0;
  if (options.weekly) {
    for (const instrument of selectedInstruments) {
      const fallbackRange = getCanonicalDailyBackfillRange(instrument.assetClass, CANONICAL_WEEKS);
      const fromUtc = options.fromUtc ?? fallbackRange.fromUtc;
      const toUtc = options.toUtc ?? fallbackRange.toUtc;

      const dailyBars = dailyBarsBySymbol.get(instrument.symbol)
        ?? await loadCanonicalDailyBarsFromDb(query, instrument.symbol, fromUtc.toISO()!, toUtc.toISO()!);

      const weeklyRows: PairPeriodReturnRow[] = [];
      for (const weekOpenUtc of CANONICAL_WEEKS) {
        const weeklyWindow = getCanonicalWeekWindow(weekOpenUtc, instrument.assetClass);
        const weekBars = dailyBars.filter((bar) => {
          const barOpen = DateTime.fromISO(bar.barOpenUtc, { zone: "utc" }).toMillis();
          return barOpen >= weeklyWindow.openUtc.toMillis() && barOpen < weeklyWindow.closeUtc.toMillis();
        });
        if (weekBars.length === 0) {
          continue;
        }
        const first = weekBars[0]!;
        const last = weekBars[weekBars.length - 1]!;
        weeklyRows.push({
          symbol: instrument.symbol,
          assetClass: instrument.assetClass,
          periodType: "weekly",
          periodOpenUtc: weekOpenUtc,
          periodCloseUtc: weeklyWindow.closeUtc.toISO()!,
          openPrice: first.openPrice,
          closePrice: last.closePrice,
          highPrice: round(Math.max(...weekBars.map((bar) => bar.highPrice)), 6),
          lowPrice: round(Math.min(...weekBars.map((bar) => bar.lowPrice)), 6),
          returnPct: computeReturnPct(first.openPrice, last.closePrice),
          source: "canonical_price_bars",
          derivedFromTimeframe: "1d",
          derivationVersion: "v1",
        });
      }

      await upsertPairPeriodReturns(query, weeklyRows);
      weeklyReturnsInserted += weeklyRows.length;
    }
  }

  console.log("Canonical price layer backfill complete");
  console.log(`  Instruments: ${selectedInstruments.length}`);
  console.log(`  Raw bars upserted: ${rawBarsInserted}`);
  console.log(`  Canonical bars upserted: ${canonicalBarsInserted}`);
  console.log(`  Daily returns upserted: ${dailyReturnsInserted}`);
  console.log(`  Weekly returns upserted: ${weeklyReturnsInserted}`);
}

main().catch((error) => {
  console.error("backfill-canonical-price-layer failed:", error);
  process.exitCode = 1;
});
