/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: materialize-fx-daily-adr-bars-from-hourly.ts
 *
 * Description:
 * Gate 34 verification utility. Fills missing FX 1d canonical_price_bars used
 * by ADR lookup from already trusted canonical 1h bars. Existing provider daily
 * bars are preserved.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { loadEnvConfig } from "@next/env";
import { DateTime } from "luxon";

import { getPool, query } from "@/lib/db";
import { PAIRS_BY_ASSET_CLASS } from "@/lib/cotPairs";

loadEnvConfig(process.cwd());

type HourlyBarRow = {
  bar_open_utc: Date;
  bar_close_utc: Date;
  open_price: number | string;
  high_price: number | string;
  low_price: number | string;
  close_price: number | string;
};

type DailyBar = {
  symbol: string;
  barOpenUtc: string;
  barCloseUtc: string;
  openPrice: number;
  highPrice: number;
  lowPrice: number;
  closePrice: number;
  bars: number;
};

function argValue(name: string): string | null {
  const direct = process.argv.find((arg) => arg.startsWith(`--${name}=`));
  if (direct) return direct.slice(name.length + 3);
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] ?? null : null;
}

function parseSymbols() {
  const raw = argValue("symbols");
  if (raw) {
    return raw.split(",").map((symbol) => symbol.trim().toUpperCase()).filter(Boolean);
  }
  return PAIRS_BY_ASSET_CLASS.fx.map((pair) => pair.pair.toUpperCase());
}

function parseDateArg(name: string, fallback: string) {
  const value = argValue(name) ?? fallback;
  const parsed = DateTime.fromISO(value, { zone: "utc" });
  if (!parsed.isValid) {
    throw new Error(`Invalid --${name}: ${value}`);
  }
  return parsed.toUTC().toISO() ?? value;
}

function round(value: number, digits = 6) {
  return Number(value.toFixed(digits));
}

function chunk<T>(rows: T[], size = 100) {
  const chunks: T[][] = [];
  for (let index = 0; index < rows.length; index += size) {
    chunks.push(rows.slice(index, index + size));
  }
  return chunks;
}

function fxSessionOpenUtc(barOpenUtc: string) {
  const ny = DateTime.fromISO(barOpenUtc, { zone: "utc" }).setZone("America/New_York");
  const sessionDate = ny.hour < 17 ? ny.minus({ days: 1 }) : ny;
  return sessionDate
    .startOf("day")
    .set({ hour: 17, minute: 0, second: 0, millisecond: 0 })
    .toUTC()
    .toISO()!;
}

async function loadHourlyBars(symbol: string, fromUtc: string, toUtc: string) {
  return query<HourlyBarRow>(
    `SELECT bar_open_utc, bar_close_utc, open_price, high_price, low_price, close_price
       FROM canonical_price_bars
      WHERE symbol = $1
        AND asset_class = 'fx'
        AND timeframe = '1h'
        AND bar_open_utc >= $2::timestamptz
        AND bar_open_utc < $3::timestamptz
      ORDER BY bar_open_utc ASC`,
    [symbol, fromUtc, toUtc],
  );
}

function buildDailyBars(symbol: string, rows: HourlyBarRow[]) {
  const grouped = new Map<string, Array<{
    barOpenUtc: string;
    barCloseUtc: string;
    open: number;
    high: number;
    low: number;
    close: number;
  }>>();

  for (const row of rows) {
    const barOpenUtc = row.bar_open_utc.toISOString();
    const key = fxSessionOpenUtc(barOpenUtc);
    const group = grouped.get(key) ?? [];
    group.push({
      barOpenUtc,
      barCloseUtc: row.bar_close_utc.toISOString(),
      open: Number(row.open_price),
      high: Number(row.high_price),
      low: Number(row.low_price),
      close: Number(row.close_price),
    });
    grouped.set(key, group);
  }

  return [...grouped.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([barOpenUtc, bars]): DailyBar => {
      const ordered = [...bars].sort((left, right) => left.barOpenUtc.localeCompare(right.barOpenUtc));
      const first = ordered[0]!;
      const last = ordered[ordered.length - 1]!;
      const close = DateTime.fromISO(barOpenUtc, { zone: "utc" }).plus({ hours: 24 }).toISO()!;
      return {
        symbol,
        barOpenUtc,
        barCloseUtc: close,
        openPrice: round(first.open),
        highPrice: round(Math.max(...ordered.map((bar) => bar.high))),
        lowPrice: round(Math.min(...ordered.map((bar) => bar.low))),
        closePrice: round(last.close),
        bars: ordered.length,
      };
    });
}

async function insertMissingDailyBars(rows: DailyBar[]) {
  let inserted = 0;
  for (const batch of chunk(rows, 100)) {
    const params: unknown[] = [];
    const values = batch.map((row, index) => {
      const offset = index * 10;
      params.push(
        row.symbol,
        "fx",
        "1d",
        row.barOpenUtc,
        row.barCloseUtc,
        row.openPrice,
        row.highPrice,
        row.lowPrice,
        row.closePrice,
        row.bars >= 20 ? "derived_from_1h" : "derived_from_partial_1h",
      );
      return `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7}, $${offset + 8}, $${offset + 9}, 'canonical_1h_rollup', $${offset + 10})`;
    }).join(", ");

    const result = await query<{ symbol: string }>(
      `INSERT INTO canonical_price_bars (
         symbol, asset_class, timeframe, bar_open_utc, bar_close_utc,
         open_price, high_price, low_price, close_price, source_provider, quality_status
       )
       VALUES ${values}
       ON CONFLICT (symbol, timeframe, bar_open_utc) DO NOTHING
       RETURNING symbol`,
      params,
    );
    inserted += result.length;
  }
  return inserted;
}

async function main() {
  const symbols = parseSymbols();
  const fromUtc = parseDateArg("from", "2023-12-15T00:00:00.000Z");
  const toUtc = parseDateArg("to", DateTime.utc().toISO() ?? new Date().toISOString());
  const outDir = path.resolve(
    process.cwd(),
    argValue("out-dir") ?? "app/reports/data-verification/weekly-hold-audit",
  );
  await mkdir(outDir, { recursive: true });

  const perSymbol: Array<{
    symbol: string;
    hourlyRows: number;
    dailyBarsBuilt: number;
    dailyBarsInserted: number;
  }> = [];

  for (const symbol of symbols) {
    const hourly = await loadHourlyBars(symbol, fromUtc, toUtc);
    const daily = buildDailyBars(symbol, hourly);
    const inserted = await insertMissingDailyBars(daily);
    perSymbol.push({
      symbol,
      hourlyRows: hourly.length,
      dailyBarsBuilt: daily.length,
      dailyBarsInserted: inserted,
    });
  }

  const generatedAtUtc = DateTime.utc().toISO() ?? new Date().toISOString();
  const stamp = DateTime.utc().toFormat("yyyyLLdd-HHmmss");
  const jsonPath = path.join(outDir, `fx-daily-adr-bars-from-hourly-${stamp}.json`);
  await writeFile(
    jsonPath,
    `${JSON.stringify({ generatedAtUtc, fromUtc, toUtc, symbols, perSymbol }, null, 2)}\n`,
    "utf8",
  );

  const totalHourly = perSymbol.reduce((sum, row) => sum + row.hourlyRows, 0);
  const totalBuilt = perSymbol.reduce((sum, row) => sum + row.dailyBarsBuilt, 0);
  const totalInserted = perSymbol.reduce((sum, row) => sum + row.dailyBarsInserted, 0);
  console.log("FX daily ADR bars materialized from 1H canonical bars");
  console.log(`Symbols: ${symbols.length}`);
  console.log(`Hourly rows read: ${totalHourly}`);
  console.log(`Daily bars built: ${totalBuilt}`);
  console.log(`Daily bars inserted: ${totalInserted}`);
  console.log(`JSON: ${jsonPath}`);
}

main().catch(async (error) => {
  console.error(error);
  try {
    await getPool().end();
  } catch {}
  process.exit(1);
}).finally(async () => {
  await getPool().end();
});
