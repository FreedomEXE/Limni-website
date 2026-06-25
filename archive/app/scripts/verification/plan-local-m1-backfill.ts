import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { loadEnvConfig } from "@next/env";
import { DateTime } from "luxon";

import { getCanonicalInstrument } from "@/lib/canonicalInstruments";
import { getCanonicalWeekWindow } from "@/lib/canonicalPriceWindows";
import { PAIRS_BY_ASSET_CLASS } from "@/lib/cotPairs";
import { fetchOandaMinuteSeries } from "@/lib/oandaPrices";
import {
  getLocalM1WarehousePath,
  openLocalM1Warehouse,
  readLocalM1CoverageRows,
  upsertLocalM1Bars,
  type LocalM1CoverageRow,
  type LocalM1WarehouseBar,
} from "@/lib/research/localM1Warehouse";
import { formatTradingWeekLabelIsoDate, normalizeWeekOpenUtc } from "@/lib/weekAnchor";

loadEnvConfig(process.cwd());

const OUT_DIR = "app/reports/data-verification/local-m1-warehouse";
const FX_SYMBOLS = PAIRS_BY_ASSET_CLASS.fx.map((row) => row.pair.toUpperCase());

type PlannedChunk = {
  chunkIndex: number;
  weeks: string[];
  firstWeekLabel: string;
  lastWeekLabel: string;
  openUtc: string;
  closeUtc: string;
  rows: number;
  complete: number;
  partial: number;
  missing: number;
  weakRows: number;
  weakSymbols: string[];
  estimatedWeakBars: number;
  postComplete?: number;
  postPartial?: number;
  postMissing?: number;
  postWeakRows?: number;
};

type ExecutionEvent = {
  chunkIndex: number;
  symbol: string;
  openUtc: string;
  closeUtc: string;
  barsFetched: number;
  barsUpserted: number;
  provider: string;
  error: string | null;
};

function argValue(name: string): string | null {
  const prefix = `--${name}=`;
  return process.argv
    .slice(2)
    .find((arg) => arg.startsWith(prefix))
    ?.slice(prefix.length) ?? null;
}

function hasFlag(name: string) {
  return process.argv.slice(2).includes(`--${name}`);
}

function parseIntegerArg(name: string, fallback: number) {
  const value = argValue(name);
  if (!value) return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) {
    throw new Error(`--${name} must be an integer`);
  }
  return parsed;
}

function parsePositiveIntegerArg(name: string, fallback: number) {
  const parsed = parseIntegerArg(name, fallback);
  if (parsed <= 0) {
    throw new Error(`--${name} must be > 0`);
  }
  return parsed;
}

function parseLatestDisplayWeek() {
  const raw = argValue("latest-display-week") ?? DateTime.utc().minus({ weeks: 1 }).toFormat("yyyy-MM-dd");
  const parsed = DateTime.fromISO(raw, { zone: "utc" });
  if (!parsed.isValid) {
    throw new Error(`Invalid --latest-display-week=${raw}`);
  }
  return parsed.startOf("day");
}

function buildDisplayWeeks(fromYear: number, toYear: number, latestDisplayWeek: DateTime) {
  const weeks: string[] = [];
  for (let year = fromYear; year <= toYear; year += 1) {
    let cursor = DateTime.utc(year, 1, 1).startOf("day");
    while (cursor.weekday !== 1) {
      cursor = cursor.plus({ days: 1 });
    }
    while (cursor.year === year && cursor.toMillis() <= latestDisplayWeek.toMillis()) {
      const weekOpenUtc = normalizeWeekOpenUtc(cursor.toISODate() ?? cursor.toISO() ?? "");
      if (weekOpenUtc) {
        weeks.push(weekOpenUtc);
      }
      cursor = cursor.plus({ weeks: 1 });
    }
  }
  return [...new Set(weeks)].sort();
}

function chunkArray<T>(items: T[], size: number) {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

function summarizeRows(rows: LocalM1CoverageRow[]) {
  const complete = rows.filter((row) => row.status === "complete").length;
  const partial = rows.filter((row) => row.status === "partial").length;
  const missing = rows.filter((row) => row.status === "missing").length;
  const weakRows = rows.filter((row) => row.status === "missing" || row.status === "partial");
  return {
    complete,
    partial,
    missing,
    weakRows,
    weakSymbols: [...new Set(weakRows.map((row) => row.symbol))].sort(),
    estimatedWeakBars: weakRows.reduce((sum, row) => sum + row.expectedBars, 0),
  };
}

function chunkWindow(weeks: string[]) {
  const windows = weeks.map((week) => getCanonicalWeekWindow(week, "fx"));
  const openUtc = windows.reduce((min, window) =>
    window.openUtc < min ? window.openUtc : min, windows[0]!.openUtc);
  const closeUtc = windows.reduce((max, window) =>
    window.closeUtc > max ? window.closeUtc : max, windows[0]!.closeUtc);
  return { openUtc, closeUtc };
}

async function buildChunkPlan(chunkIndex: number, weeks: string[], databasePath: string): Promise<{
  plan: PlannedChunk;
  weakRows: LocalM1CoverageRow[];
}> {
  const coverageRows = readLocalM1CoverageRows({
    assetClass: "fx",
    symbols: FX_SYMBOLS,
    weeks,
    databasePath,
  });
  const summary = summarizeRows(coverageRows);
  const window = chunkWindow(weeks);
  const labels = weeks.map((week) => formatTradingWeekLabelIsoDate(week));
  const plan: PlannedChunk = {
    chunkIndex,
    weeks,
    firstWeekLabel: labels[0] ?? weeks[0] ?? "",
    lastWeekLabel: labels.at(-1) ?? weeks.at(-1) ?? "",
    openUtc: window.openUtc.toISO() ?? "",
    closeUtc: window.closeUtc.toISO() ?? "",
    rows: coverageRows.length,
    complete: summary.complete,
    partial: summary.partial,
    missing: summary.missing,
    weakRows: summary.weakRows.length,
    weakSymbols: summary.weakSymbols,
    estimatedWeakBars: summary.estimatedWeakBars,
  };
  return { plan, weakRows: summary.weakRows };
}

function weakRowsBySymbol(weakRows: LocalM1CoverageRow[]) {
  const bySymbol = new Map<string, LocalM1CoverageRow[]>();
  for (const row of weakRows) {
    const list = bySymbol.get(row.symbol) ?? [];
    list.push(row);
    bySymbol.set(row.symbol, list);
  }
  return bySymbol;
}

function weakWindowForSymbol(rows: LocalM1CoverageRow[]) {
  const windows = rows.map((row) => getCanonicalWeekWindow(row.weekOpenUtc, row.assetClass));
  const openUtc = windows.reduce((min, window) =>
    window.openUtc < min ? window.openUtc : min, windows[0]!.openUtc);
  const closeUtc = windows.reduce((max, window) =>
    window.closeUtc > max ? window.closeUtc : max, windows[0]!.closeUtc);
  return { openUtc, closeUtc };
}

async function runWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>,
) {
  const results: R[] = [];
  let nextIndex = 0;
  const workerCount = Math.min(concurrency, items.length);
  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (nextIndex < items.length) {
        const index = nextIndex;
        nextIndex += 1;
        results[index] = await worker(items[index]!, index);
      }
    }),
  );
  return results;
}

async function executeChunk(
  chunkIndex: number,
  weakRows: LocalM1CoverageRow[],
  options: { concurrency: number; dryRun: boolean; databasePath: string },
) {
  const groups = [...weakRowsBySymbol(weakRows).entries()];
  const db = options.dryRun ? null : openLocalM1Warehouse({ databasePath: options.databasePath });
  return runWithConcurrency(groups, options.concurrency, async ([symbol, rows]) => {
    const instrument = getCanonicalInstrument(symbol);
    if (!instrument?.oandaInstrument) {
      return {
        chunkIndex,
        symbol,
        openUtc: "",
        closeUtc: "",
        barsFetched: 0,
        barsUpserted: 0,
        provider: "",
        error: "oanda instrument not found",
      };
    }

    const window = weakWindowForSymbol(rows);
    const openUtc = window.openUtc.toISO() ?? "";
    const closeUtc = window.closeUtc.toISO() ?? "";
    try {
      const bars = await fetchOandaMinuteSeries(instrument.oandaInstrument, window.openUtc, window.closeUtc);
      const localRows = bars.map((bar): LocalM1WarehouseBar => {
        const openDt = DateTime.fromMillis(bar.ts, { zone: "utc" });
        return {
          symbol,
          assetClass: "fx",
          timeframe: "1m",
          barOpenUtc: openDt.toISO() ?? "",
          barCloseUtc: openDt.plus({ minutes: 1 }).toISO() ?? "",
          openPrice: round(bar.open),
          highPrice: round(bar.high),
          lowPrice: round(bar.low),
          closePrice: round(bar.close),
          sourceProvider: "oanda",
          qualityStatus: "provider_minute",
        };
      });
      const barsUpserted = options.dryRun ? 0 : upsertLocalM1Bars(localRows, db ?? undefined);
      return {
        chunkIndex,
        symbol,
        openUtc,
        closeUtc,
        barsFetched: bars.length,
        barsUpserted,
        provider: "oanda",
        error: null,
      };
    } catch (error) {
      return {
        chunkIndex,
        symbol,
        openUtc,
        closeUtc,
        barsFetched: 0,
        barsUpserted: 0,
        provider: "oanda",
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });
}

function renderMarkdown(options: {
  generatedAt: string;
  fromYear: number;
  toYear: number;
  latestDisplayWeek: string;
  chunkWeeks: number;
  execute: boolean;
  dryRun: boolean;
  sqlitePath: string;
  chunks: PlannedChunk[];
}) {
  const rows = options.chunks.map((chunk) => [
    chunk.chunkIndex,
    `${chunk.firstWeekLabel}..${chunk.lastWeekLabel}`,
    `${chunk.openUtc}..${chunk.closeUtc}`,
    chunk.complete,
    chunk.partial,
    chunk.missing,
    chunk.weakRows,
    chunk.postComplete ?? "",
    chunk.postPartial ?? "",
    chunk.postMissing ?? "",
    chunk.postWeakRows ?? "",
    chunk.weakSymbols.length,
    chunk.estimatedWeakBars,
  ]);
  return `# Local Canonical M1 Warehouse Backfill Plan

Generated: ${options.generatedAt}

## Scope

- Local SQLite M1 market-data layer only.
- No Render/Postgres raw M1 writes.
- No Strength derivation.
- No source or receipt checks.
- No strategy simulation or optimization.

Years: ${options.fromYear}-${options.toYear}
Latest display week: ${options.latestDisplayWeek}
Chunk weeks: ${options.chunkWeeks}
Execute: ${options.execute}
Dry run: ${options.dryRun}
SQLite path: ${options.sqlitePath}

## Chunk Summary

| Chunk | Weeks | Window | Complete | Partial | Missing | Weak Rows | Post Complete | Post Partial | Post Missing | Post Weak Rows | Weak Symbols | Est Weak Bars |
|---:|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
${rows.map((row) => `| ${row.join(" | ")} |`).join("\n")}
`;
}

async function writePlan(options: {
  fromYear: number;
  toYear: number;
  latestDisplayWeek: string;
  chunkWeeks: number;
  execute: boolean;
  dryRun: boolean;
  sqlitePath: string;
  chunks: PlannedChunk[];
  events: ExecutionEvent[];
}) {
  await mkdir(OUT_DIR, { recursive: true });
  const generatedAt = DateTime.utc().toISO() ?? new Date().toISOString();
  const stamp = DateTime.utc().toFormat("yyyyMMdd-HHmmss");
  const base = path.join(OUT_DIR, `local-m1-backfill-plan-${options.fromYear}-${options.toYear}-${stamp}`);
  const payload = {
    generatedAt,
    ...options,
  };
  await writeFile(`${base}.json`, JSON.stringify(payload, null, 2));
  await writeFile(`${base}.md`, renderMarkdown({ generatedAt, ...options }));
  return { json: `${base}.json`, markdown: `${base}.md` };
}

async function main() {
  const fromYear = parseIntegerArg("from-year", 2019);
  const toYear = parseIntegerArg("to-year", fromYear);
  if (toYear < fromYear) throw new Error("--to-year must be >= --from-year");
  const latestDisplayWeek = parseLatestDisplayWeek();
  const chunkWeeks = parsePositiveIntegerArg("chunk-weeks", 4);
  const fromChunk = parsePositiveIntegerArg("from-chunk", 1);
  const toChunk = parseIntegerArg("to-chunk", Number.MAX_SAFE_INTEGER);
  const concurrency = parsePositiveIntegerArg("concurrency", 4);
  const execute = hasFlag("execute");
  const dryRun = hasFlag("dry-run") || !execute;
  const write = hasFlag("write");
  const sqlitePath = argValue("sqlite-path") ?? getLocalM1WarehousePath();

  if (!dryRun) {
    openLocalM1Warehouse({ databasePath: sqlitePath });
  }

  const weeks = buildDisplayWeeks(fromYear, toYear, latestDisplayWeek);
  const allChunks = chunkArray(weeks, chunkWeeks)
    .map((chunkWeeksList, index) => ({ chunkIndex: index + 1, weeks: chunkWeeksList }))
    .filter((chunk) => chunk.chunkIndex >= fromChunk && chunk.chunkIndex <= toChunk);

  const chunks: PlannedChunk[] = [];
  const events: ExecutionEvent[] = [];

  for (const chunk of allChunks) {
    const { plan, weakRows } = await buildChunkPlan(chunk.chunkIndex, chunk.weeks, sqlitePath);
    chunks.push(plan);
    console.log(
      `chunk=${plan.chunkIndex} | ${plan.firstWeekLabel}..${plan.lastWeekLabel} | complete=${plan.complete} | partial=${plan.partial} | missing=${plan.missing} | weakRows=${plan.weakRows} | weakSymbols=${plan.weakSymbols.length}`,
    );

    if (execute && weakRows.length > 0) {
      const chunkEvents = await executeChunk(plan.chunkIndex, weakRows, { concurrency, dryRun, databasePath: sqlitePath });
      events.push(...chunkEvents);
      for (const event of chunkEvents) {
        console.log(
          `  ${event.symbol} ${event.error ? `ERROR ${event.error}` : `${event.barsFetched}/${event.barsUpserted}`}`,
        );
      }
      if (!dryRun) {
        const post = readLocalM1CoverageRows({
          assetClass: "fx",
          symbols: FX_SYMBOLS,
          weeks: chunk.weeks,
          databasePath: sqlitePath,
        });
        const postSummary = summarizeRows(post);
        plan.postComplete = postSummary.complete;
        plan.postPartial = postSummary.partial;
        plan.postMissing = postSummary.missing;
        plan.postWeakRows = postSummary.weakRows.length;
        console.log(
          `postCoverage chunk=${plan.chunkIndex} | complete=${plan.postComplete} | partial=${plan.postPartial} | missing=${plan.postMissing} | weakRows=${plan.postWeakRows}`,
        );
      }
    }
  }

  if (write) {
    const receipt = await writePlan({
      fromYear,
      toYear,
      latestDisplayWeek: latestDisplayWeek.toISODate() ?? latestDisplayWeek.toISO() ?? "",
      chunkWeeks,
      execute,
      dryRun,
      sqlitePath,
      chunks,
      events,
    });
    console.log(`Plan JSON: ${receipt.json}`);
    console.log(`Plan Markdown: ${receipt.markdown}`);
  }
}

function round(value: number, digits = 6) {
  return Number(value.toFixed(digits));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
