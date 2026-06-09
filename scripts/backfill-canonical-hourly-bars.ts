import { loadEnvConfig } from "@next/env";
import { DateTime } from "luxon";
import {
  backfillCanonicalHourlyBars,
  getCanonicalHourlyCoverage,
  upsertCanonicalHourlyBarsForInstrument,
} from "../src/lib/canonicalHourlyBars";
import { getCanonicalInstrument } from "../src/lib/canonicalInstruments";
import type { AssetClass } from "../src/lib/cotMarkets";
import { getPool } from "../src/lib/db";

loadEnvConfig(process.cwd());

type CliOptions = {
  assetClass: AssetClass | "all";
  symbols: string[];
  weeks: string[];
  fromWeek?: string;
  toWeek?: string;
  dryRun: boolean;
  coverageOnly: boolean;
  onlyGaps: boolean;
  delayMs: number;
};

function readArg(name: string) {
  const prefix = `--${name}=`;
  return process.argv
    .slice(2)
    .find((arg) => arg.startsWith(prefix))
    ?.slice(prefix.length);
}

function hasFlag(name: string) {
  return process.argv.slice(2).includes(`--${name}`);
}

function parseAssetClass(value?: string): AssetClass | "all" {
  if (!value || value === "all") return "all";
  if (value === "fx" || value === "indices" || value === "commodities" || value === "crypto") {
    return value;
  }
  throw new Error(`Unsupported --asset=${value}`);
}

function parseIsoWeek(value?: string) {
  if (!value) return undefined;
  const dt = DateTime.fromISO(value, { zone: "utc" });
  if (!dt.isValid) {
    throw new Error(`Invalid week timestamp: ${value}`);
  }
  return dt.toUTC().toISO() ?? value;
}

function parseIsoWeeks(value?: string) {
  return (value ?? "")
    .split(",")
    .map((week) => parseIsoWeek(week.trim()))
    .filter((week): week is string => Boolean(week));
}

function parseCli(): CliOptions {
  return {
    assetClass: parseAssetClass(readArg("asset")),
    symbols: (readArg("symbols") ?? "")
      .split(",")
      .map((symbol) => symbol.trim().toUpperCase())
      .filter(Boolean),
    weeks: parseIsoWeeks(readArg("weeks")),
    fromWeek: parseIsoWeek(readArg("from-week") ?? readArg("from")),
    toWeek: parseIsoWeek(readArg("to-week") ?? readArg("to")),
    dryRun: hasFlag("dry-run"),
    coverageOnly: hasFlag("coverage-only"),
    onlyGaps: hasFlag("only-gaps"),
    delayMs: Number(readArg("delay-ms") ?? "100"),
  };
}

async function main() {
  const options = parseCli();

  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required.");
  }

  if (!options.coverageOnly && options.onlyGaps) {
    const coverage = await getCanonicalHourlyCoverage({
        assetClass: options.assetClass,
        symbols: options.symbols,
        weeks: options.weeks,
        fromWeek: options.fromWeek,
        toWeek: options.toWeek,
      });
    const gaps = coverage.rows.filter(
      (row) => row.status === "missing" || row.status === "partial",
    );

    console.log(
      `Starting gap-only canonical hourly backfill: gaps=${gaps.length} dryRun=${options.dryRun}`,
    );

    let barsFetched = 0;
    let barsUpserted = 0;
    const errors: string[] = [];
    for (const gap of gaps) {
      const instrument = getCanonicalInstrument(gap.symbol);
      if (!instrument) {
        errors.push(`${gap.symbol} ${gap.weekOpenUtc}: instrument not found`);
        continue;
      }
      try {
        const result = await upsertCanonicalHourlyBarsForInstrument({
          instrument,
          weekOpenUtc: gap.weekOpenUtc,
          dryRun: options.dryRun,
        });
        barsFetched += result.barsFetched;
        barsUpserted += result.barsUpserted;
        console.log(
          `${gap.weekOpenUtc} ${gap.assetClass}:${gap.symbol} ${result.provider} ${result.barsUpserted}/${result.barsFetched}`,
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        errors.push(`${gap.symbol} ${gap.weekOpenUtc}: ${message}`);
        console.log(`${gap.weekOpenUtc} ${gap.assetClass}:${gap.symbol} ERROR ${message}`);
      }

      if (options.delayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, options.delayMs));
      }
    }

    console.log(`Gap-only backfill complete: fetched=${barsFetched} upserted=${barsUpserted} errors=${errors.length}`);
    if (errors.length > 0) {
      console.log(errors.join("\n"));
    }
  } else if (!options.coverageOnly) {
    console.log(
      [
        "Starting canonical hourly backfill",
        `asset=${options.assetClass}`,
        options.symbols.length ? `symbols=${options.symbols.join(",")}` : "symbols=all",
        options.weeks.length ? `weeks=${options.weeks.join(",")}` : "weeks=canonical range",
        options.fromWeek ? `from=${options.fromWeek}` : "from=first canonical week",
        options.toWeek ? `to=${options.toWeek}` : "to=current canonical week",
        options.dryRun ? "dryRun=true" : "dryRun=false",
        options.onlyGaps ? "onlyGaps=true" : "onlyGaps=false",
      ].join(" | "),
    );

    const result = await backfillCanonicalHourlyBars({
      assetClass: options.assetClass,
      symbols: options.symbols,
      weeks: options.weeks,
      fromWeek: options.fromWeek,
      toWeek: options.toWeek,
      dryRun: options.dryRun,
      delayMs: options.delayMs,
      onProgress: (event) => {
        const status = event.error ? `ERROR ${event.error}` : `${event.barsUpserted}/${event.barsFetched}`;
        console.log(`${event.weekOpenUtc} ${event.assetClass}:${event.symbol} ${event.provider} ${status}`);
      },
    });

    console.log(
      `Backfill complete: fetched=${result.barsFetched} upserted=${result.barsUpserted} errors=${result.errors.length}`,
    );
    if (result.errors.length > 0) {
      console.log(result.errors.join("\n"));
    }
  }

  const coverage = await getCanonicalHourlyCoverage({
    assetClass: options.assetClass,
    symbols: options.symbols,
    weeks: options.weeks,
    fromWeek: options.fromWeek,
    toWeek: options.toWeek,
  });

  console.log(
    [
      "Coverage summary",
      `complete=${coverage.summary.complete}`,
      `partial=${coverage.summary.partial}`,
      `missing=${coverage.summary.missing}`,
      `inProgress=${coverage.summary.inProgress}`,
      `lowest=${coverage.summary.lowestCoveragePct.toFixed(2)}%`,
    ].join(" | "),
  );

  const weakRows = coverage.rows
    .filter((row) => row.status === "missing" || row.status === "partial")
    .slice(0, 80);
  for (const row of weakRows) {
    console.log(
      `${row.status.toUpperCase()} ${row.weekOpenUtc} ${row.assetClass}:${row.symbol} ${row.actualBars}/${row.expectedBars} ${row.coveragePct}%`,
    );
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
      // Pool may not have been created if argument/env validation failed.
    }
  });
