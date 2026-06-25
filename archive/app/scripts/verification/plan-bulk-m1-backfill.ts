import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { loadEnvConfig } from "@next/env";
import { DateTime } from "luxon";
import {
  getCanonicalHourlyCoverage,
  type CanonicalHourlyCoverageRow,
  upsertCanonicalHourlyBarsForInstrumentWindow,
} from "../../src/lib/canonicalHourlyBars";
import { getCanonicalInstrument } from "../../src/lib/canonicalInstruments";
import { getCanonicalWeekWindow } from "../../src/lib/canonicalPriceWindows";
import { PAIRS_BY_ASSET_CLASS } from "../../src/lib/cotPairs";
import { getPool } from "../../src/lib/db";
import { formatTradingWeekLabelIsoDate, normalizeWeekOpenUtc } from "../../src/lib/weekAnchor";

loadEnvConfig(process.cwd());

const OUT_DIR = "app/reports/data-verification/canonical-m1-warehouse";
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

function summarizeWeakRows(rows: CanonicalHourlyCoverageRow[]) {
  return rows.filter((row) => row.status === "missing" || row.status === "partial");
}

function chunkWindow(weeks: string[]) {
  const windows = weeks.map((week) => getCanonicalWeekWindow(week, "fx"));
  const openUtc = windows.reduce((min, window) =>
    window.openUtc < min ? window.openUtc : min, windows[0]!.openUtc);
  const closeUtc = windows.reduce((max, window) =>
    window.closeUtc > max ? window.closeUtc : max, windows[0]!.closeUtc);
  return { openUtc, closeUtc };
}

async function buildChunkPlan(chunkIndex: number, weeks: string[]): Promise<{
  plan: PlannedChunk;
  weakRows: CanonicalHourlyCoverageRow[];
}> {
  const coverage = await getCanonicalHourlyCoverage({
    assetClass: "fx",
    symbols: FX_SYMBOLS,
    weeks,
    timeframe: "1m",
  });
  const weakRows = summarizeWeakRows(coverage.rows);
  const window = chunkWindow(weeks);
  const labels = weeks.map((week) => formatTradingWeekLabelIsoDate(week));
  const plan: PlannedChunk = {
    chunkIndex,
    weeks,
    firstWeekLabel: labels[0] ?? weeks[0] ?? "",
    lastWeekLabel: labels.at(-1) ?? weeks.at(-1) ?? "",
    openUtc: window.openUtc.toISO() ?? "",
    closeUtc: window.closeUtc.toISO() ?? "",
    rows: coverage.rows.length,
    complete: coverage.summary.complete,
    partial: coverage.summary.partial,
    missing: coverage.summary.missing,
    weakRows: weakRows.length,
    weakSymbols: [...new Set(weakRows.map((row) => row.symbol))].sort(),
    estimatedWeakBars: weakRows.reduce((sum, row) => sum + row.expectedBars, 0),
  };
  return { plan, weakRows };
}

function weakRowsBySymbol(weakRows: CanonicalHourlyCoverageRow[]) {
  const bySymbol = new Map<string, CanonicalHourlyCoverageRow[]>();
  for (const row of weakRows) {
    const list = bySymbol.get(row.symbol) ?? [];
    list.push(row);
    bySymbol.set(row.symbol, list);
  }
  return bySymbol;
}

function weakWindowForSymbol(rows: CanonicalHourlyCoverageRow[]) {
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
  weakRows: CanonicalHourlyCoverageRow[],
  options: { concurrency: number; dryRun: boolean },
) {
  const groups = [...weakRowsBySymbol(weakRows).entries()];
  return runWithConcurrency(groups, options.concurrency, async ([symbol, rows]) => {
    const instrument = getCanonicalInstrument(symbol);
    if (!instrument) {
      return {
        chunkIndex,
        symbol,
        openUtc: "",
        closeUtc: "",
        barsFetched: 0,
        barsUpserted: 0,
        provider: "",
        error: "instrument not found",
      };
    }

    const window = weakWindowForSymbol(rows);
    try {
      const result = await upsertCanonicalHourlyBarsForInstrumentWindow({
        instrument,
        openUtc: window.openUtc,
        closeUtc: window.closeUtc,
        timeframe: "1m",
        dryRun: options.dryRun,
      });
      return {
        chunkIndex,
        symbol,
        openUtc: window.openUtc.toISO() ?? "",
        closeUtc: window.closeUtc.toISO() ?? "",
        barsFetched: result.barsFetched,
        barsUpserted: result.barsUpserted,
        provider: result.provider,
        error: null,
      };
    } catch (error) {
      return {
        chunkIndex,
        symbol,
        openUtc: window.openUtc.toISO() ?? "",
        closeUtc: window.closeUtc.toISO() ?? "",
        barsFetched: 0,
        barsUpserted: 0,
        provider: instrument.primaryProvider,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });
}

function buildMarkdown(report: {
  generatedAtUtc: string;
  fromYear: number;
  toYear: number;
  latestDisplayWeek: string;
  chunkWeeks: number;
  execute: boolean;
  dryRun: boolean;
  chunks: PlannedChunk[];
  events: ExecutionEvent[];
}) {
  const lines = [
    "# Canonical M1 Warehouse Bulk Backfill Plan",
    "",
    `Generated: ${report.generatedAtUtc}`,
    "",
    "## Scope",
    "",
    "- M1 market-data layer only.",
    "- No Strength derivation.",
    "- No source or receipt checks.",
    "- No strategy simulation or optimization.",
    "",
    `Years: ${report.fromYear}-${report.toYear}`,
    `Latest display week: ${report.latestDisplayWeek}`,
    `Chunk weeks: ${report.chunkWeeks}`,
    `Execute: ${report.execute}`,
    `Dry run: ${report.dryRun}`,
    "",
    "## Chunk Summary",
    "",
    "| Chunk | Weeks | Window | Complete | Partial | Missing | Weak Rows | Post Complete | Post Partial | Post Missing | Post Weak Rows | Weak Symbols | Est Weak Bars |",
    "|---:|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|",
    ...report.chunks.map((chunk) =>
      `| ${chunk.chunkIndex} | ${chunk.firstWeekLabel}..${chunk.lastWeekLabel} | ${chunk.openUtc}..${chunk.closeUtc} | ${chunk.complete} | ${chunk.partial} | ${chunk.missing} | ${chunk.weakRows} | ${chunk.postComplete ?? ""} | ${chunk.postPartial ?? ""} | ${chunk.postMissing ?? ""} | ${chunk.postWeakRows ?? ""} | ${chunk.weakSymbols.length} | ${chunk.estimatedWeakBars} |`),
  ];

  if (report.events.length > 0) {
    lines.push(
      "",
      "## Execution Events",
      "",
      "| Chunk | Symbol | Window | Fetched | Upserted | Error |",
      "|---:|---|---|---:|---:|---|",
      ...report.events.map((event) =>
        `| ${event.chunkIndex} | ${event.symbol} | ${event.openUtc}..${event.closeUtc} | ${event.barsFetched} | ${event.barsUpserted} | ${event.error ?? ""} |`),
    );
  }

  return `${lines.join("\n")}\n`;
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required.");
  }

  const fromYear = parseIntegerArg("from-year", 2019);
  const toYear = parseIntegerArg("to-year", 2026);
  const latestDisplayWeek = parseLatestDisplayWeek();
  const chunkWeeks = parsePositiveIntegerArg("chunk-weeks", 8);
  const maxChunks = parseIntegerArg("max-chunks", 0);
  const onlyChunk = parseIntegerArg("chunk-index", 0);
  const fromChunk = parsePositiveIntegerArg("from-chunk", 1);
  const toChunk = parseIntegerArg("to-chunk", Number.MAX_SAFE_INTEGER);
  const concurrency = parsePositiveIntegerArg("concurrency", 2);
  const execute = hasFlag("execute");
  const dryRun = hasFlag("dry-run");
  const write = hasFlag("write");

  const weeks = buildDisplayWeeks(fromYear, toYear, latestDisplayWeek);
  const rawChunks = chunkArray(weeks, chunkWeeks)
    .map((chunk, index) => ({ chunkIndex: index + 1, weeks: chunk }))
    .filter((chunk) => onlyChunk === 0 || chunk.chunkIndex === onlyChunk)
    .filter((chunk) => onlyChunk !== 0 || (chunk.chunkIndex >= fromChunk && chunk.chunkIndex <= toChunk))
    .slice(0, maxChunks > 0 ? maxChunks : undefined);

  const chunks: PlannedChunk[] = [];
  const events: ExecutionEvent[] = [];
  for (const chunk of rawChunks) {
    const { plan, weakRows } = await buildChunkPlan(chunk.chunkIndex, chunk.weeks);
    chunks.push(plan);
    console.log(
      [
        `chunk=${plan.chunkIndex}`,
        `${plan.firstWeekLabel}..${plan.lastWeekLabel}`,
        `complete=${plan.complete}`,
        `partial=${plan.partial}`,
        `missing=${plan.missing}`,
        `weakRows=${plan.weakRows}`,
        `weakSymbols=${plan.weakSymbols.length}`,
      ].join(" | "),
    );

    if (execute && weakRows.length > 0) {
      const chunkEvents = await executeChunk(plan.chunkIndex, weakRows, { concurrency, dryRun });
      events.push(...chunkEvents);
      for (const event of chunkEvents) {
        const status = event.error ? `ERROR ${event.error}` : `${event.barsUpserted}/${event.barsFetched}`;
        console.log(`  ${event.symbol} ${status}`);
      }
      if (!dryRun) {
        const postCoverage = await getCanonicalHourlyCoverage({
          assetClass: "fx",
          symbols: FX_SYMBOLS,
          weeks: chunk.weeks,
          timeframe: "1m",
        });
        const postWeakRows = summarizeWeakRows(postCoverage.rows);
        plan.postComplete = postCoverage.summary.complete;
        plan.postPartial = postCoverage.summary.partial;
        plan.postMissing = postCoverage.summary.missing;
        plan.postWeakRows = postWeakRows.length;
        console.log(
          [
            `postCoverage chunk=${plan.chunkIndex}`,
            `complete=${plan.postComplete}`,
            `partial=${plan.postPartial}`,
            `missing=${plan.postMissing}`,
            `weakRows=${plan.postWeakRows}`,
          ].join(" | "),
        );
      }
    }
  }

  const report = {
    generatedAtUtc: DateTime.utc().toISO() ?? new Date().toISOString(),
    fromYear,
    toYear,
    latestDisplayWeek: latestDisplayWeek.toFormat("yyyy-MM-dd"),
    chunkWeeks,
    execute,
    dryRun,
    chunks,
    events,
  };

  if (write) {
    const outDir = path.resolve(process.cwd(), argValue("out-dir") ?? OUT_DIR);
    await mkdir(outDir, { recursive: true });
    const stamp = DateTime.utc().toFormat("yyyyLLdd-HHmmss");
    const jsonPath = path.join(outDir, `canonical-m1-backfill-plan-${fromYear}-${toYear}-${stamp}.json`);
    const mdPath = jsonPath.replace(/\.json$/, ".md");
    await writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
    await writeFile(mdPath, buildMarkdown(report), "utf8");
    console.log(`Plan JSON: ${jsonPath}`);
    console.log(`Plan Markdown: ${mdPath}`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await getPool().end();
    } catch {
      // The pool may not exist if env validation failed early.
    }
  });
