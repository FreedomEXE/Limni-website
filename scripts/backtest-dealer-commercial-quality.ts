import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { DateTime } from "luxon";

import { fetchLatestReportDate } from "../src/lib/cotFetch";
import { listAssetClasses, type AssetClass } from "../src/lib/cotMarkets";
import { refreshSnapshotForClass, readSnapshot } from "../src/lib/cotStore";
import { PAIRS_BY_ASSET_CLASS } from "../src/lib/cotPairs";
import type { PairSnapshot } from "../src/lib/cotTypes";
import { computeModelPerformance, type PerformanceModel } from "../src/lib/performanceLab";
import {
  getPairPerformance,
  getPerformanceWindow,
  getPriceSymbolCandidates,
} from "../src/lib/pricePerformance";
import { computeTrailingDrawdownPct } from "../src/lib/risk/drawdown";
import { fetchOandaCandle } from "../src/lib/oandaPrices";
import type { PairPerformance } from "../src/lib/priceStore";

type QualityRow = {
  assetClass: AssetClass;
  reportDate: string;
  weekOpenUtc: string;
  model: PerformanceModel;
  returnPct: number;
  priced: number;
  total: number;
  pricedRatio: number;
  missingCount: number;
  maxOpenDriftHours: number;
  maxCloseDriftHours: number;
  coveragePass: boolean;
  timingPass: boolean;
  qualityPass: boolean;
  note: string;
};

type WeekAggregate = {
  weekOpenUtc: string;
  reportDate: string;
  model: PerformanceModel;
  strictQualified: boolean;
  strictReturnPct: number;
  looseReturnPct: number;
  qualifiedAssets: number;
  totalAssets: number;
};

type ModelSummary = {
  model: PerformanceModel;
  weeksRequested: number;
  weeksWithRows: number;
  strictQualifiedWeeks: number;
  totalReturnStrictPct: number;
  totalReturnLoosePct: number;
  winRateStrictPct: number;
  winRateLoosePct: number;
  trailingDrawdownStrictPct: number;
  trailingDrawdownLoosePct: number;
  staticDrawdownStrictPct: number;
  staticDrawdownLoosePct: number;
};

type BacktestOutput = {
  generatedAtUtc: string;
  params: {
    lookbackDays: number;
    minCoverageRatio: number;
    maxTimeDriftHours: number;
  };
  dataHealth: {
    requestedReportDates: number;
    cotBackfilledByAsset: Record<AssetClass, number>;
    evaluationRows: number;
    rowsPassingQuality: number;
    rowsFailingCoverage: number;
    rowsFailingTiming: number;
    rowsFailingAny: number;
  };
  summaries: ModelSummary[];
  weekly: WeekAggregate[];
  diagnostics: QualityRow[];
};

const MODELS: PerformanceModel[] = ["dealer", "commercial"];

const CFTC_DATASET_URLS = [
  "https://publicreporting.cftc.gov/resource/gpe5-46if.json",
  "https://publicreporting.cftc.gov/resource/6dca-aqww.json",
  "https://publicreporting.cftc.gov/resource/72hh-3qpy.json",
];

function parseArg(name: string, fallback: string): string {
  const prefix = `--${name}=`;
  const arg = process.argv.find((entry) => entry.startsWith(prefix));
  return arg ? arg.slice(prefix.length) : fallback;
}

function loadEnvFromFile() {
  for (const filename of [".env.local", ".env"]) {
    const fullPath = path.join(process.cwd(), filename);
    try {
      const text = readFileSync(fullPath, "utf8");
      for (const rawLine of text.split(/\r?\n/)) {
        const line = rawLine.trim();
        if (!line || line.startsWith("#")) continue;
        const eq = line.indexOf("=");
        if (eq <= 0) continue;
        const key = line.slice(0, eq).trim();
        let value = line.slice(eq + 1).trim();
        if (!key || process.env[key]) continue;
        if (
          (value.startsWith("\"") && value.endsWith("\"")) ||
          (value.startsWith("'") && value.endsWith("'"))
        ) {
          value = value.slice(1, -1);
        }
        process.env[key] = value;
      }
    } catch {
      // ignore missing env files
    }
  }
}

function asDateOnly(raw: string): string {
  const [datePart] = raw.split("T");
  return datePart;
}

async function fetchReportDatesFromDataset(
  baseUrl: string,
  minDateIso: string,
  maxDateIso: string,
): Promise<string[]> {
  const url = new URL(baseUrl);
  url.searchParams.set("$select", "distinct report_date_as_yyyy_mm_dd");
  url.searchParams.set(
    "$where",
    `report_date_as_yyyy_mm_dd >= '${minDateIso}T00:00:00.000' AND report_date_as_yyyy_mm_dd <= '${maxDateIso}T00:00:00.000'`,
  );
  url.searchParams.set("$limit", "10000");

  const res = await fetch(url.toString(), { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`CFTC dates fetch failed (${res.status}) ${baseUrl}`);
  }

  const data = (await res.json()) as Array<{ report_date_as_yyyy_mm_dd?: string }>;
  return data
    .map((row) => row.report_date_as_yyyy_mm_dd ?? "")
    .filter(Boolean)
    .map(asDateOnly);
}

async function listReportDatesLastPeriod(lookbackDays: number): Promise<string[]> {
  const latest = await fetchLatestReportDate("tff");
  const latestDt = DateTime.fromISO(latest, { zone: "utc" });
  if (!latestDt.isValid) {
    throw new Error(`Invalid latest report date from CFTC: ${latest}`);
  }
  const minDt = latestDt.minus({ days: lookbackDays });
  const minDate = minDt.toISODate();
  const maxDate = latestDt.toISODate();
  if (!minDate || !maxDate) {
    throw new Error("Failed to build report date range.");
  }

  const sets = await Promise.all(
    CFTC_DATASET_URLS.map((url) => fetchReportDatesFromDataset(url, minDate, maxDate)),
  );
  const deduped = new Set<string>();
  for (const rows of sets) {
    for (const date of rows) deduped.add(date);
  }
  return Array.from(deduped.values()).sort((a, b) => a.localeCompare(b));
}

function reportDateToWeekOpenUtc(reportDate: string): string {
  const report = DateTime.fromISO(reportDate, { zone: "America/New_York" });
  if (!report.isValid) return reportDate;
  const daysUntilSunday = (7 - (report.weekday % 7)) % 7;
  const sundayOpen = report.plus({ days: daysUntilSunday }).set({
    hour: 19,
    minute: 0,
    second: 0,
    millisecond: 0,
  });
  return sundayOpen.toUTC().toISO() ?? reportDate;
}

function buildAllPairs(assetClass: AssetClass): Record<string, PairSnapshot> {
  const pairs: Record<string, PairSnapshot> = {};
  for (const pairDef of PAIRS_BY_ASSET_CLASS[assetClass]) {
    pairs[pairDef.pair] = {
      direction: "LONG",
      base_bias: "NEUTRAL",
      quote_bias: "NEUTRAL",
    };
  }
  return pairs;
}

function driftHours(fromIso: string, to: DateTime): number {
  const from = DateTime.fromISO(fromIso, { zone: "utc" });
  if (!from.isValid || !to.isValid) return Number.POSITIVE_INFINITY;
  return Math.abs(from.diff(to, "hours").hours);
}

function staticDrawdownFromReturns(weeklyReturns: number[]): number {
  let equity = 0;
  let minEquity = 0;
  for (const ret of weeklyReturns) {
    equity += ret;
    if (equity < minEquity) minEquity = equity;
  }
  return Math.abs(minEquity);
}

function summarizeModel(
  model: PerformanceModel,
  weeksRequested: number,
  weeklyRows: WeekAggregate[],
): ModelSummary {
  const rows = weeklyRows.filter((row) => row.model === model);
  const strictSeries = rows.filter((row) => row.strictQualified).map((row) => row.strictReturnPct);
  const looseSeries = rows.map((row) => row.looseReturnPct);

  const strictCurve: number[] = [];
  const looseCurve: number[] = [];
  let strictCum = 0;
  let looseCum = 0;
  for (const value of strictSeries) {
    strictCum += value;
    strictCurve.push(strictCum);
  }
  for (const value of looseSeries) {
    looseCum += value;
    looseCurve.push(looseCum);
  }

  const strictWins = strictSeries.filter((value) => value > 0).length;
  const looseWins = looseSeries.filter((value) => value > 0).length;

  return {
    model,
    weeksRequested,
    weeksWithRows: rows.length,
    strictQualifiedWeeks: strictSeries.length,
    totalReturnStrictPct: Number(strictSeries.reduce((sum, value) => sum + value, 0).toFixed(4)),
    totalReturnLoosePct: Number(looseSeries.reduce((sum, value) => sum + value, 0).toFixed(4)),
    winRateStrictPct:
      strictSeries.length > 0 ? Number(((strictWins / strictSeries.length) * 100).toFixed(2)) : 0,
    winRateLoosePct:
      looseSeries.length > 0 ? Number(((looseWins / looseSeries.length) * 100).toFixed(2)) : 0,
    trailingDrawdownStrictPct: Number(computeTrailingDrawdownPct(strictCurve).toFixed(4)),
    trailingDrawdownLoosePct: Number(computeTrailingDrawdownPct(looseCurve).toFixed(4)),
    staticDrawdownStrictPct: Number(staticDrawdownFromReturns(strictSeries).toFixed(4)),
    staticDrawdownLoosePct: Number(staticDrawdownFromReturns(looseSeries).toFixed(4)),
  };
}

type PairPerformanceResult = Awaited<ReturnType<typeof getPairPerformance>>;

async function getCryptoPerformanceFromOanda(
  pairs: Record<string, PairSnapshot>,
  reportDate: string,
): Promise<PairPerformanceResult> {
  const window = getPerformanceWindow({
    assetClass: "crypto",
    reportDate,
    isLatestReport: false,
  });

  const performance: Record<string, PairPerformance | null> = {};
  const missingPairs: string[] = [];

  for (const pair of Object.keys(pairs)) {
    let row: PairPerformance | null = null;
    const candidates = Array.from(new Set(getPriceSymbolCandidates(pair, "crypto")));

    for (const candidate of candidates) {
      try {
        const candle = await fetchOandaCandle(candidate, window.openUtc, window.closeUtc);
        if (!candle) continue;
        const percent = candle.open !== 0 ? ((candle.close - candle.open) / candle.open) * 100 : 0;
        row = {
          open: candle.open,
          current: candle.close,
          percent,
          pips: candle.close - candle.open,
          open_time_utc: candle.openTime,
          current_time_utc: candle.closeTime,
        };
        break;
      } catch {
        // Try next candidate.
      }
    }

    performance[pair] = row;
    if (!row) {
      missingPairs.push(pair);
    }
  }

  const missing = missingPairs.length;
  const totalPairs = Object.keys(pairs).length;
  const baseNote =
    missing > 0 ? `Missing prices for ${missing}/${totalPairs}.` : "Prices ready.";
  return {
    performance,
    note: `${baseNote} Historical quality backtest forcing OANDA pricing for crypto.`,
    missingPairs,
  };
}

async function main() {
  loadEnvFromFile();
  process.env.ALLOW_HISTORICAL_RECALC = "true";

  const lookbackDays = Number.parseInt(parseArg("lookbackDays", "370"), 10);
  const minCoverageRatio = Number.parseFloat(parseArg("minCoverage", "0.95"));
  const maxTimeDriftHours = Number.parseFloat(parseArg("maxTimeDriftHours", "2.0"));

  if (!Number.isFinite(lookbackDays) || lookbackDays < 30) {
    throw new Error("lookbackDays must be >= 30.");
  }
  if (!Number.isFinite(minCoverageRatio) || minCoverageRatio <= 0 || minCoverageRatio > 1) {
    throw new Error("minCoverage must be in (0,1].");
  }
  if (!Number.isFinite(maxTimeDriftHours) || maxTimeDriftHours <= 0) {
    throw new Error("maxTimeDriftHours must be > 0.");
  }

  const assets = listAssetClasses().map((item) => item.id);
  const reportDates = await listReportDatesLastPeriod(lookbackDays);
  if (reportDates.length === 0) {
    throw new Error("No CFTC report dates found in requested range.");
  }

  const cotBackfilledByAsset: Record<AssetClass, number> = {
    fx: 0,
    indices: 0,
    crypto: 0,
    commodities: 0,
  };

  for (const reportDate of reportDates) {
    for (const asset of assets) {
      try {
        await refreshSnapshotForClass(asset, reportDate);
        cotBackfilledByAsset[asset] += 1;
      } catch (error) {
        // Continue; quality gates later will reject missing/bad rows.
        const msg = error instanceof Error ? error.message : String(error);
        console.warn(`[COT backfill warn] ${asset} ${reportDate}: ${msg}`);
      }
    }
  }

  const diagnostics: QualityRow[] = [];
  for (const reportDate of reportDates) {
    for (const assetClass of assets) {
      const snapshot = await readSnapshot({ assetClass, reportDate });
      if (!snapshot) continue;

      const allPairs = buildAllPairs(assetClass);
      const basePerformance =
        assetClass === "crypto"
          ? await getCryptoPerformanceFromOanda(allPairs, snapshot.report_date)
          : await getPairPerformance(allPairs, {
              assetClass,
              reportDate: snapshot.report_date,
              isLatestReport: false,
            });
      const window = getPerformanceWindow({
        assetClass,
        reportDate: snapshot.report_date,
        isLatestReport: false,
      });

      for (const model of MODELS) {
        const perf = await computeModelPerformance({
          model,
          assetClass,
          snapshot,
          sentiment: [],
          performance: basePerformance,
        });

        const pricedRatio = perf.total > 0 ? perf.priced / perf.total : 1;
        const missingCount = Math.max(0, perf.total - perf.priced);

        let maxOpenDrift = 0;
        let maxCloseDrift = 0;
        for (const detail of perf.pair_details) {
          if (detail.percent === null) continue;
          const pairPerf = basePerformance.performance[detail.pair];
          if (!pairPerf) continue;
          const openDrift = driftHours(pairPerf.open_time_utc, window.openUtc);
          const closeDrift = driftHours(pairPerf.current_time_utc, window.closeUtc);
          if (openDrift > maxOpenDrift) maxOpenDrift = openDrift;
          if (closeDrift > maxCloseDrift) maxCloseDrift = closeDrift;
        }

        const coveragePass = pricedRatio >= minCoverageRatio;
        const timingPass =
          maxOpenDrift <= maxTimeDriftHours && maxCloseDrift <= maxTimeDriftHours;
        const qualityPass = coveragePass && timingPass;

        diagnostics.push({
          assetClass,
          reportDate,
          weekOpenUtc: reportDateToWeekOpenUtc(reportDate),
          model,
          returnPct: Number(perf.percent.toFixed(6)),
          priced: perf.priced,
          total: perf.total,
          pricedRatio: Number(pricedRatio.toFixed(6)),
          missingCount,
          maxOpenDriftHours: Number(maxOpenDrift.toFixed(6)),
          maxCloseDriftHours: Number(maxCloseDrift.toFixed(6)),
          coveragePass,
          timingPass,
          qualityPass,
          note: perf.note,
        });
      }
    }
  }

  const weekModelMap = new Map<string, WeekAggregate>();
  for (const model of MODELS) {
    for (const reportDate of reportDates) {
      const weekOpenUtc = reportDateToWeekOpenUtc(reportDate);
      const rows = diagnostics.filter(
        (row) => row.model === model && row.reportDate === reportDate,
      );
      if (rows.length === 0) continue;
      const qualified = rows.filter((row) => row.qualityPass);
      const strictQualified = rows.length === assets.length && qualified.length === assets.length;
      const strictReturn = strictQualified
        ? qualified.reduce((sum, row) => sum + row.returnPct, 0)
        : 0;
      const looseReturn = qualified.reduce((sum, row) => sum + row.returnPct, 0);

      weekModelMap.set(`${model}|${reportDate}`, {
        weekOpenUtc,
        reportDate,
        model,
        strictQualified,
        strictReturnPct: Number(strictReturn.toFixed(6)),
        looseReturnPct: Number(looseReturn.toFixed(6)),
        qualifiedAssets: qualified.length,
        totalAssets: assets.length,
      });
    }
  }

  const weekly = Array.from(weekModelMap.values()).sort((a, b) => {
    if (a.weekOpenUtc === b.weekOpenUtc) return a.model.localeCompare(b.model);
    return a.weekOpenUtc.localeCompare(b.weekOpenUtc);
  });

  const rowsPassingQuality = diagnostics.filter((row) => row.qualityPass).length;
  const rowsFailingCoverage = diagnostics.filter((row) => !row.coveragePass).length;
  const rowsFailingTiming = diagnostics.filter((row) => !row.timingPass).length;
  const rowsFailingAny = diagnostics.filter((row) => !row.qualityPass).length;

  const summaries = MODELS.map((model) =>
    summarizeModel(model, reportDates.length, weekly),
  );

  const output: BacktestOutput = {
    generatedAtUtc: DateTime.utc().toISO() ?? new Date().toISOString(),
    params: {
      lookbackDays,
      minCoverageRatio,
      maxTimeDriftHours,
    },
    dataHealth: {
      requestedReportDates: reportDates.length,
      cotBackfilledByAsset,
      evaluationRows: diagnostics.length,
      rowsPassingQuality,
      rowsFailingCoverage,
      rowsFailingTiming,
      rowsFailingAny,
    },
    summaries,
    weekly,
    diagnostics,
  };

  const reportsDir = path.join(process.cwd(), "reports");
  mkdirSync(reportsDir, { recursive: true });
  const stamp = DateTime.utc().toFormat("yyyy-LL-dd_HHmmss");
  const outputPath = path.join(reportsDir, `dealer-commercial-quality-backtest-${stamp}.json`);
  const latestPath = path.join(reportsDir, "dealer-commercial-quality-backtest-latest.json");
  writeFileSync(outputPath, JSON.stringify(output, null, 2), "utf8");
  writeFileSync(latestPath, JSON.stringify(output, null, 2), "utf8");

  console.log(`Report dates requested: ${reportDates.length}`);
  console.log(`Diagnostics rows: ${diagnostics.length}`);
  console.log(`Quality pass rows: ${rowsPassingQuality}`);
  for (const summary of summaries) {
    console.log(
      [
        `${summary.model.toUpperCase()}:`,
        `strictWeeks=${summary.strictQualifiedWeeks}/${summary.weeksRequested}`,
        `strictRet=${summary.totalReturnStrictPct.toFixed(2)}%`,
        `looseRet=${summary.totalReturnLoosePct.toFixed(2)}%`,
        `strictDD=${summary.trailingDrawdownStrictPct.toFixed(2)}%`,
        `looseDD=${summary.trailingDrawdownLoosePct.toFixed(2)}%`,
      ].join(" "),
    );
  }
  console.log(`Saved: ${outputPath}`);
  console.log(`Saved: ${latestPath}`);
}

main().catch((error) => {
  console.error("Dealer/commercial quality backtest failed:", error);
  process.exit(1);
});
