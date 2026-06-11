import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { computeBasketPath, computeMultiWeekBasketPath, type BasketPathResult, type BasketPathSummary } from "../../src/lib/performance/basketPathEngine";
import { buildWeeklyHoldLedger } from "../../src/lib/performance/positionLedger";
import { loadPathBars } from "../../src/lib/performance/pathBarLoader";
import { CANONICAL_PATH_RESOLUTION } from "../../src/lib/performance/pathResolution";
import { computeMultiWeekHold, computeWeeklyHold, type WeeklyHoldResult } from "../../src/lib/performance/weeklyHoldEngine";
import { weeklyHoldToSidebarStatsWithPath } from "../../src/lib/performance/engineAdapter";
import { getBiasSource, getEntryStyle, getRiskOverlay } from "../../src/lib/performance/strategyConfig";
import { listDataSectionWeeks } from "../../src/lib/dataSectionWeeks";
import { buildDataWeekOptions } from "../../src/lib/weekOptions";
import { getDisplayWeekOpenUtc } from "../../src/lib/weekAnchor";

type RunMode = "broken" | "new";

type Summary = {
  mode: RunMode;
  resetEntryFilter: "off" | "on";
  bias: string;
  f1: string;
  f2: string;
  week: string;
  weekReturnPct: number;
  selectedWeekTradeCount: number;
  selectedWeekFillWinRate: number;
  allTimeReturnPct: number | null;
  allTimeMaxDrawdownPct: number | null;
  allTimeTotalTrades: number | null;
  allTimeWeeklyWinRate: number | null;
  allTimeWeeks: number | null;
  performanceAllTimeReturnPct: number | null;
  performanceAllTimeMaxDrawdownPct: number | null;
  performanceAllTimeTotalTrades: number | null;
};

function loadEnvFile(path: string) {
  if (!existsSync(path)) return;
  const lines = readFileSync(path, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    if (process.env[key] != null) continue;
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

loadEnvFile(resolve(process.cwd(), ".env.local"));
loadEnvFile(resolve(process.cwd(), ".env"));

function argValue(name: string, fallback: string) {
  const prefix = `--${name}=`;
  const inline = process.argv.find((arg) => arg.startsWith(prefix));
  if (inline) return inline.slice(prefix.length);
  const idx = process.argv.indexOf(`--${name}`);
  if (idx >= 0) return process.argv[idx + 1] ?? fallback;
  return fallback;
}

async function computePathSummaryForWeek(result: WeeklyHoldResult): Promise<BasketPathSummary> {
  const ledger = await buildWeeklyHoldLedger(result);
  const symbols = ledger.legs.map((leg) => leg.symbol);
  const bars = await loadPathBars(
    symbols,
    ledger.weekOpenUtc,
    ledger.weekCloseUtc,
    CANONICAL_PATH_RESOLUTION,
  );
  return computeBasketPath(ledger, bars).summary;
}

async function computeStats(mode: RunMode, params: { bias: string; f1: string; f2: string; week: string }): Promise<Summary> {
  if (mode === "broken") {
    process.env.LIMNI_ADR_GRID_RESET_ENTRY_FILTER = "off";
  } else {
    delete process.env.LIMNI_ADR_GRID_RESET_ENTRY_FILTER;
  }

  const biasSource = getBiasSource(params.bias);
  const entryStyle = getEntryStyle(params.f1);
  const riskOverlay = getRiskOverlay(params.f2);
  if (!biasSource) throw new Error(`Unknown bias source: ${params.bias}`);
  if (!entryStyle) throw new Error(`Unknown entry style: ${params.f1}`);
  if (!riskOverlay) throw new Error(`Unknown risk overlay: ${params.f2}`);

  const currentWeekOpenUtc = getDisplayWeekOpenUtc();
  const dataSectionWeeks = await listDataSectionWeeks();
  const weekOptions = buildDataWeekOptions({
    historicalWeeks: dataSectionWeeks,
    currentWeekOpenUtc,
  }) as string[];

  const result = await computeWeeklyHold(biasSource, params.week, entryStyle, riskOverlay);
  const multiWeek = await computeMultiWeekHold(biasSource, weekOptions, entryStyle, riskOverlay);
  const currentWeekPathSummary = await computePathSummaryForWeek(result);

  const realizedWeekPaths: BasketPathResult[] = [];
  for (const weekResult of multiWeek.weeks) {
    const ledger = await buildWeeklyHoldLedger(weekResult);
    const bars = await loadPathBars(
      ledger.legs.map((leg) => leg.symbol),
      ledger.weekOpenUtc,
      ledger.weekCloseUtc,
      CANONICAL_PATH_RESOLUTION,
    );
    realizedWeekPaths.push(computeBasketPath(ledger, bars));
  }

  const multiWeekPathSummary = realizedWeekPaths.length > 0
    ? computeMultiWeekBasketPath(realizedWeekPaths).summary
    : null;

  const stats = weeklyHoldToSidebarStatsWithPath(result, biasSource, {
    multiWeek,
    currentWeekPathSummary,
    multiWeekPathSummary,
  });

  return {
    mode,
    resetEntryFilter: mode === "broken" ? "off" : "on",
    bias: params.bias,
    f1: params.f1,
    f2: params.f2,
    week: params.week,
    weekReturnPct: stats.weekReturnPct,
    selectedWeekTradeCount: stats.tradeCount,
    selectedWeekFillWinRate: stats.winRate,
    allTimeReturnPct: stats.allTime?.totalReturnPct ?? null,
    allTimeMaxDrawdownPct: stats.allTime?.maxDrawdownPct ?? null,
    allTimeTotalTrades: stats.allTime?.totalTrades ?? null,
    allTimeWeeklyWinRate: stats.allTime?.weeklyWinRate ?? null,
    allTimeWeeks: stats.allTime?.weeks ?? null,
    performanceAllTimeReturnPct: multiWeekPathSummary?.totalReturnPct ?? stats.allTime?.totalReturnPct ?? null,
    performanceAllTimeMaxDrawdownPct: multiWeekPathSummary?.maxDrawdownPct ?? stats.allTime?.maxDrawdownPct ?? null,
    performanceAllTimeTotalTrades: stats.allTime?.totalTrades ?? null,
  };
}

function round(value: number | null) {
  return value == null ? null : Number(value.toFixed(6));
}

function summarizeDelta(broken: Summary, next: Summary) {
  return {
    allTimeReturnPct: round((next.allTimeReturnPct ?? 0) - (broken.allTimeReturnPct ?? 0)),
    allTimeMaxDrawdownPct: round((next.allTimeMaxDrawdownPct ?? 0) - (broken.allTimeMaxDrawdownPct ?? 0)),
    allTimeTotalTrades: (next.allTimeTotalTrades ?? 0) - (broken.allTimeTotalTrades ?? 0),
    allTimeWeeklyWinRate: round((next.allTimeWeeklyWinRate ?? 0) - (broken.allTimeWeeklyWinRate ?? 0)),
    performanceAllTimeReturnPct: round((next.performanceAllTimeReturnPct ?? 0) - (broken.performanceAllTimeReturnPct ?? 0)),
    performanceAllTimeMaxDrawdownPct: round((next.performanceAllTimeMaxDrawdownPct ?? 0) - (broken.performanceAllTimeMaxDrawdownPct ?? 0)),
    performanceAllTimeTotalTrades: (next.performanceAllTimeTotalTrades ?? 0) - (broken.performanceAllTimeTotalTrades ?? 0),
    selectedWeekReturnPct: round(next.weekReturnPct - broken.weekReturnPct),
    selectedWeekTradeCount: next.selectedWeekTradeCount - broken.selectedWeekTradeCount,
    selectedWeekFillWinRate: round(next.selectedWeekFillWinRate - broken.selectedWeekFillWinRate),
  };
}

async function main() {
  const params = {
    bias: argValue("bias", "tiered_4w"),
    f1: argValue("f1", "adr_grid"),
    f2: argValue("f2", "pair_fill_cap"),
    week: argValue("week", getDisplayWeekOpenUtc()),
  };

  const broken = await computeStats("broken", params);
  const next = await computeStats("new", params);
  const payload = {
    params,
    metrics: {
      broken: Object.fromEntries(Object.entries(broken).map(([key, value]) => [key, typeof value === "number" ? round(value) : value])),
      newRule: Object.fromEntries(Object.entries(next).map(([key, value]) => [key, typeof value === "number" ? round(value) : value])),
      deltaNewMinusBroken: summarizeDelta(broken, next),
    },
  };

  console.log(JSON.stringify(payload, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
