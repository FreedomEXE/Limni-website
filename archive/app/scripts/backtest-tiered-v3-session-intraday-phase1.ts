/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: backtest-tiered-v3-session-intraday-phase1.ts
 *
 * Description:
 * Phase 1 session-timed intraday overlay backtest for Tiered V3
 * ungated, FX-only. Tests Asia / Europe / New York entries against
 * hold-to-16 and basket TP 0.50%, with basket SL -1.00% applied to
 * all variants plus a deterministic random-hour baseline.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { DateTime } from "luxon";

import { query } from "../src/lib/db";

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

const REPORT_PATH = path.join(REPO_ROOT, "reports", "comprehensive-reconstruction.json");
const REPORTS_DIR = path.join(REPO_ROOT, "reports");
const OUTPUT_BASENAME = "tiered-v3-session-intraday-phase1";
const NY_ZONE = "America/New_York";
const BASKET_TP_PCT = 0.5;
const BASKET_SL_PCT = -1.0;
const RANDOM_ENTRY_HOUR_COUNT = 20;

type Direction = "LONG" | "SHORT";
type SessionVariant = "ASIA_ONLY" | "EUROPE_ONLY" | "NEWYORK_ONLY" | "RANDOM_HOUR";
type ExitVariant = "HOLD_TO_16" | "BASKET_TP_050";
type VariantId =
  | "asia_hold_to_16"
  | "asia_basket_tp_050"
  | "europe_hold_to_16"
  | "europe_basket_tp_050"
  | "newyork_hold_to_16"
  | "newyork_basket_tp_050"
  | "random_hold_to_16";

type NettedPair = {
  symbol: string;
  assetClass: string;
  direction: Direction;
  tier: number;
};

type WeeklyRow = {
  weekOpenUtc: string;
  breakdown: {
    nettedPairs: NettedPair[];
  };
};

type SystemRow = {
  system: string;
  weeklyReturns: WeeklyRow[];
};

type CanonicalReport = {
  composite_systems: SystemRow[];
};

type CanonicalHourlyBarRow = {
  symbol: string;
  barOpenUtc: string;
  openPrice: number;
  closePrice: number;
};

type HourlyBar = {
  openUtc: string;
  openMs: number;
  closeMs: number;
  openPrice: number;
  closePrice: number;
};

type TradeSpec = {
  symbol: string;
  direction: Direction;
  tier: number;
};

type TradingDay = {
  weekOpenUtc: string;
  weekLabel: string;
  tradeDateEt: string;
  fxTrades: TradeSpec[];
};

type SessionSchedule = {
  session: SessionVariant;
  label: string;
  entryUtc: string;
  entryMs: number;
  exitUtc: string;
  exitMs: number;
};

type PairPath = {
  symbol: string;
  direction: Direction;
  tier: number;
  entryPrice: number;
  marks: Array<{
    closeUtc: string;
    closeMs: number;
    returnPct: number;
  }>;
  exitReturnPct: number;
};

type DaySimulation = {
  weekOpenUtc: string;
  weekLabel: string;
  tradeDateEt: string;
  variantId: VariantId;
  session: SessionVariant;
  exitMode: ExitVariant;
  entryUtc: string;
  exitUtc: string;
  returnPct: number;
  tradeCount: number;
  basketTpHit: boolean;
  basketSlHit: boolean;
  timeToTpHours: number | null;
  exitReason: "TIME_EXIT" | "BASKET_TP" | "BASKET_SL";
};

type SummaryRow = {
  variantId: VariantId;
  session: SessionVariant;
  exitMode: ExitVariant;
  days: number;
  totalTrades: number;
  avgTradesPerDay: number;
  simpleReturnPct: number;
  maxDrawdownPct: number;
  averageDailyReturnPct: number;
  dailyWinRatePct: number;
  worstDayPct: number;
  basketTpHitPct: number;
  avgTimeToTpHours: number | null;
  basketSlHitPct: number;
  sharpeDaily: number | null;
  tStatDaily: number | null;
};

const VARIANTS: Array<{ id: VariantId; session: SessionVariant; exitMode: ExitVariant }> = [
  { id: "asia_hold_to_16", session: "ASIA_ONLY", exitMode: "HOLD_TO_16" },
  { id: "asia_basket_tp_050", session: "ASIA_ONLY", exitMode: "BASKET_TP_050" },
  { id: "europe_hold_to_16", session: "EUROPE_ONLY", exitMode: "HOLD_TO_16" },
  { id: "europe_basket_tp_050", session: "EUROPE_ONLY", exitMode: "BASKET_TP_050" },
  { id: "newyork_hold_to_16", session: "NEWYORK_ONLY", exitMode: "HOLD_TO_16" },
  { id: "newyork_basket_tp_050", session: "NEWYORK_ONLY", exitMode: "BASKET_TP_050" },
  { id: "random_hold_to_16", session: "RANDOM_HOUR", exitMode: "HOLD_TO_16" },
];

function assertReportSystem(report: CanonicalReport, systemId: string) {
  const system = report.composite_systems.find((entry) => entry.system === systemId);
  if (!system) {
    throw new Error(`System ${systemId} not found in comprehensive reconstruction report.`);
  }
  return system;
}

function readReport(): CanonicalReport {
  return JSON.parse(readFileSync(REPORT_PATH, "utf8")) as CanonicalReport;
}

function buildTradingDays(system: SystemRow): TradingDay[] {
  const out: TradingDay[] = [];

  for (const weeklyRow of system.weeklyReturns) {
    const mondayEt = DateTime.fromISO(weeklyRow.weekOpenUtc, { zone: "utc" })
      .toFormat("yyyy-MM-dd");
    const mondayStartEt = DateTime.fromISO(mondayEt, { zone: NY_ZONE }).startOf("day");

    const fxTrades = (weeklyRow.breakdown?.nettedPairs ?? [])
      .filter((trade) => trade.assetClass === "fx" && (trade.direction === "LONG" || trade.direction === "SHORT"))
      .map((trade) => ({
        symbol: String(trade.symbol).trim().toUpperCase(),
        direction: trade.direction,
        tier: Number.isFinite(Number(trade.tier)) ? Number(trade.tier) : 0,
      }))
      .filter((trade) => trade.symbol.length > 0);

    for (let offset = 0; offset < 5; offset += 1) {
      const tradeDate = mondayStartEt.plus({ days: offset });
      out.push({
        weekOpenUtc: weeklyRow.weekOpenUtc,
        weekLabel: mondayStartEt.toFormat("yyyy-MM-dd"),
        tradeDateEt: tradeDate.toFormat("yyyy-MM-dd"),
        fxTrades,
      });
    }
  }

  return out;
}

function deterministicIndex(input: string, modulo: number) {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash >>> 0) % modulo;
}

function buildSessionSchedule(tradingDay: TradingDay, session: SessionVariant): SessionSchedule {
  const tradeDateEt = DateTime.fromISO(tradingDay.tradeDateEt, { zone: NY_ZONE }).startOf("day");
  const exitLocal = tradeDateEt.set({ hour: 15, minute: 0, second: 0, millisecond: 0 });

  let entryLocal: DateTime;
  if (session === "ASIA_ONLY") {
    entryLocal = tradeDateEt.minus({ days: 1 }).set({ hour: 20, minute: 0, second: 0, millisecond: 0 });
  } else if (session === "EUROPE_ONLY") {
    entryLocal = tradeDateEt.set({ hour: 4, minute: 0, second: 0, millisecond: 0 });
  } else if (session === "NEWYORK_ONLY") {
    entryLocal = tradeDateEt.set({ hour: 9, minute: 0, second: 0, millisecond: 0 });
  } else {
    const start = tradeDateEt.minus({ days: 1 }).set({ hour: 20, minute: 0, second: 0, millisecond: 0 });
    const offset = deterministicIndex(`${tradingDay.weekOpenUtc}|${tradingDay.tradeDateEt}`, RANDOM_ENTRY_HOUR_COUNT);
    entryLocal = start.plus({ hours: offset });
  }

  return {
    session,
    label:
      session === "ASIA_ONLY"
        ? "Asia-only"
        : session === "EUROPE_ONLY"
          ? "Europe-only"
          : session === "NEWYORK_ONLY"
            ? "NewYork-only"
            : "Random-hour",
    entryUtc: entryLocal.toUTC().toISO()!,
    entryMs: entryLocal.toUTC().toMillis(),
    exitUtc: exitLocal.plus({ hours: 1 }).toUTC().toISO()!,
    exitMs: exitLocal.plus({ hours: 1 }).toUTC().toMillis(),
  };
}

function round(value: number, places = 4) {
  return Number(value.toFixed(places));
}

function pctMove(entryPrice: number, exitPrice: number, direction: Direction) {
  const raw = ((exitPrice / entryPrice) - 1) * 100;
  return direction === "LONG" ? raw : -raw;
}

async function loadHourlyBars(symbols: string[], fromUtc: string, toUtc: string) {
  const rows = await query<CanonicalHourlyBarRow>(
    `
      SELECT
        symbol,
        bar_open_utc::text AS "barOpenUtc",
        open_price AS "openPrice",
        close_price AS "closePrice"
      FROM canonical_price_bars
      WHERE symbol = ANY($1)
        AND timeframe = '1h'
        AND bar_open_utc >= $2::timestamptz
        AND bar_open_utc < $3::timestamptz
      ORDER BY symbol, bar_open_utc
    `,
    [symbols, fromUtc, toUtc],
  );

  const out = new Map<string, HourlyBar[]>();
  for (const row of rows) {
    const openMs = Date.parse(row.barOpenUtc);
    if (!Number.isFinite(openMs)) continue;
    const list = out.get(row.symbol) ?? [];
    list.push({
      openUtc: row.barOpenUtc,
      openMs,
      closeMs: openMs + 60 * 60 * 1000,
      openPrice: Number(row.openPrice),
      closePrice: Number(row.closePrice),
    });
    out.set(row.symbol, list);
  }

  return out;
}

function findEntryBar(bars: HourlyBar[], entryMs: number) {
  return bars.find((bar) => bar.openMs >= entryMs) ?? null;
}

function buildPairPath(
  bars: HourlyBar[],
  trade: TradeSpec,
  schedule: SessionSchedule,
): PairPath | null {
  const entryBar = findEntryBar(bars, schedule.entryMs);
  if (!entryBar || !Number.isFinite(entryBar.openPrice) || entryBar.openPrice <= 0) return null;

  const marks = bars
    .filter((bar) => bar.closeMs > entryBar.openMs && bar.closeMs <= schedule.exitMs)
    .map((bar) => ({
      closeUtc: new Date(bar.closeMs).toISOString(),
      closeMs: bar.closeMs,
      returnPct: pctMove(entryBar.openPrice, bar.closePrice, trade.direction),
    }));

  if (marks.length === 0) return null;

  return {
    symbol: trade.symbol,
    direction: trade.direction,
    tier: trade.tier,
    entryPrice: entryBar.openPrice,
    marks,
    exitReturnPct: marks[marks.length - 1]!.returnPct,
  };
}

function mean(values: number[]) {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function standardDeviation(values: number[]) {
  if (values.length < 2) return 0;
  const avg = mean(values);
  const variance = values.reduce((sum, value) => sum + ((value - avg) ** 2), 0) / (values.length - 1);
  return Math.sqrt(variance);
}

function computeMaxDrawdownSimple(returns: number[]) {
  let equity = 0;
  let peak = 0;
  let maxDrawdown = 0;
  for (const value of returns) {
    equity += value;
    peak = Math.max(peak, equity);
    maxDrawdown = Math.max(maxDrawdown, peak - equity);
  }
  return maxDrawdown;
}

function simulateDay(
  tradingDay: TradingDay,
  schedule: SessionSchedule,
  exitMode: ExitVariant,
  barsBySymbol: Map<string, HourlyBar[]>,
): DaySimulation | null {
  const pairPaths = tradingDay.fxTrades
    .map((trade) => {
      const bars = barsBySymbol.get(trade.symbol) ?? [];
      return buildPairPath(bars, trade, schedule);
    })
    .filter((value): value is PairPath => value !== null);

  if (pairPaths.length === 0) {
    return null;
  }

  const checkpoints = Array.from(
    new Set(pairPaths.flatMap((path) => path.marks.map((mark) => mark.closeMs))),
  ).sort((left, right) => left - right);

  let exitReason: DaySimulation["exitReason"] = "TIME_EXIT";
  let exitMs = schedule.exitMs;
  let basketTpHit = false;
  let basketSlHit = false;
  let timeToTpHours: number | null = null;

  for (const checkpoint of checkpoints) {
    const openReturns = pairPaths.map((path) => {
      const latest = path.marks.find((mark) => mark.closeMs === checkpoint)
        ?? path.marks.filter((mark) => mark.closeMs <= checkpoint).slice(-1)[0]
        ?? null;
      return latest?.returnPct ?? null;
    }).filter((value): value is number => value !== null);

    if (openReturns.length === 0) continue;
    const basketReturn = mean(openReturns);

    if (basketReturn <= BASKET_SL_PCT) {
      exitReason = "BASKET_SL";
      exitMs = checkpoint;
      basketSlHit = true;
      break;
    }

    if (exitMode === "BASKET_TP_050" && basketReturn >= BASKET_TP_PCT) {
      exitReason = "BASKET_TP";
      exitMs = checkpoint;
      basketTpHit = true;
      timeToTpHours = (checkpoint - schedule.entryMs) / (60 * 60 * 1000);
      break;
    }
  }

  const realizedReturns = pairPaths.map((path) => {
    const mark = path.marks.find((item) => item.closeMs === exitMs)
      ?? path.marks.filter((item) => item.closeMs <= exitMs).slice(-1)[0]
      ?? path.marks[path.marks.length - 1]!;
    return mark.returnPct;
  });

  return {
    weekOpenUtc: tradingDay.weekOpenUtc,
    weekLabel: tradingDay.weekLabel,
    tradeDateEt: tradingDay.tradeDateEt,
    variantId: "asia_hold_to_16",
    session: schedule.session,
    exitMode,
    entryUtc: schedule.entryUtc,
    exitUtc: new Date(exitMs).toISOString(),
    returnPct: round(mean(realizedReturns), 4),
    tradeCount: realizedReturns.length,
    basketTpHit,
    basketSlHit,
    timeToTpHours: timeToTpHours === null ? null : round(timeToTpHours, 2),
    exitReason,
  };
}

function summarizeDays(variantId: VariantId, session: SessionVariant, exitMode: ExitVariant, days: DaySimulation[]): SummaryRow {
  const returns = days.map((day) => day.returnPct);
  const avg = mean(returns);
  const sd = standardDeviation(returns);
  const sharpe = sd > 0 ? (avg / sd) * Math.sqrt(252) : null;
  const tStat = sd > 0 ? avg / (sd / Math.sqrt(returns.length)) : null;

  return {
    variantId,
    session,
    exitMode,
    days: days.length,
    totalTrades: days.reduce((sum, day) => sum + day.tradeCount, 0),
    avgTradesPerDay: round(mean(days.map((day) => day.tradeCount)), 2),
    simpleReturnPct: round(returns.reduce((sum, value) => sum + value, 0), 4),
    maxDrawdownPct: round(computeMaxDrawdownSimple(returns), 4),
    averageDailyReturnPct: round(avg, 4),
    dailyWinRatePct: round((days.filter((day) => day.returnPct > 0).length / Math.max(days.length, 1)) * 100, 2),
    worstDayPct: round(Math.min(...returns), 4),
    basketTpHitPct: round((days.filter((day) => day.basketTpHit).length / Math.max(days.length, 1)) * 100, 2),
    avgTimeToTpHours: (() => {
      const values = days.map((day) => day.timeToTpHours).filter((value): value is number => value !== null);
      return values.length > 0 ? round(mean(values), 2) : null;
    })(),
    basketSlHitPct: round((days.filter((day) => day.basketSlHit).length / Math.max(days.length, 1)) * 100, 2),
    sharpeDaily: sharpe === null ? null : round(sharpe, 4),
    tStatDaily: tStat === null ? null : round(tStat, 4),
  };
}

function toVariantDay(
  variantId: VariantId,
  session: SessionVariant,
  exitMode: ExitVariant,
  day: DaySimulation,
): DaySimulation {
  return {
    ...day,
    variantId,
    session,
    exitMode,
  };
}

function formatSummaryTable(rows: SummaryRow[]) {
  const lines = [
    "| Variant | Session | Exit | Return | Max DD | Avg Day | Win % | Worst Day | Trades | Avg/Day | TP % | SL % | Avg TP Hrs | Sharpe | t-stat |",
    "| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
  ];

  for (const row of rows) {
    lines.push(
      `| ${row.variantId} | ${row.session} | ${row.exitMode} | ${row.simpleReturnPct.toFixed(2)}% | ${row.maxDrawdownPct.toFixed(2)}% | ${row.averageDailyReturnPct.toFixed(3)}% | ${row.dailyWinRatePct.toFixed(2)}% | ${row.worstDayPct.toFixed(2)}% | ${row.totalTrades} | ${row.avgTradesPerDay.toFixed(2)} | ${row.basketTpHitPct.toFixed(2)}% | ${row.basketSlHitPct.toFixed(2)}% | ${row.avgTimeToTpHours === null ? "—" : row.avgTimeToTpHours.toFixed(2)} | ${row.sharpeDaily === null ? "—" : row.sharpeDaily.toFixed(2)} | ${row.tStatDaily === null ? "—" : row.tStatDaily.toFixed(2)} |`,
    );
  }

  return lines;
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required.");
  }

  const report = readReport();
  const system = assertReportSystem(report, "tiered_v3");
  const tradingDays = buildTradingDays(system);
  const allSymbols = Array.from(new Set(tradingDays.flatMap((day) => day.fxTrades.map((trade) => trade.symbol)))).sort();

  if (allSymbols.length === 0) {
    throw new Error("No FX trades found in Tiered V3 weekly reconstruction.");
  }

  const allSchedules = tradingDays.flatMap((day) => [
    buildSessionSchedule(day, "ASIA_ONLY"),
    buildSessionSchedule(day, "EUROPE_ONLY"),
    buildSessionSchedule(day, "NEWYORK_ONLY"),
    buildSessionSchedule(day, "RANDOM_HOUR"),
  ]);

  const minEntryUtc = allSchedules
    .map((schedule) => schedule.entryUtc)
    .sort()[0]!;
  const maxExitUtc = allSchedules
    .map((schedule) => schedule.exitUtc)
    .sort()
    .slice(-1)[0]!;

  const barsBySymbol = await loadHourlyBars(allSymbols, minEntryUtc, maxExitUtc);

  const byVariant = new Map<VariantId, DaySimulation[]>();
  for (const variant of VARIANTS) {
    byVariant.set(variant.id, []);
  }

  for (const day of tradingDays) {
    for (const variant of VARIANTS) {
      const schedule = buildSessionSchedule(day, variant.session);
      const simulation = simulateDay(day, schedule, variant.exitMode, barsBySymbol);
      if (!simulation) continue;
      byVariant.get(variant.id)!.push(
        toVariantDay(variant.id, variant.session, variant.exitMode, simulation),
      );
    }
  }

  const summaries = VARIANTS.map((variant) =>
    summarizeDays(variant.id, variant.session, variant.exitMode, byVariant.get(variant.id) ?? []))
    .sort((left, right) => right.simpleReturnPct - left.simpleReturnPct);

  const output = {
    generatedUtc: new Date().toISOString(),
    methodology: {
      system: "tiered_v3",
      scope: "fx_only",
      pairUniverseLockedAtWeekOpen: true,
      sessionsEt: {
        ASIA_ONLY: "20:00 ET previous day",
        EUROPE_ONLY: "04:00 ET",
        NEWYORK_ONLY: "09:00 ET",
        RANDOM_HOUR: "deterministic random hour between 20:00 ET previous day and 15:00 ET",
      },
      exitEt: "16:00 ET close (bar ending 16:00 ET)",
      basketTpPct: BASKET_TP_PCT,
      basketSlPct: BASKET_SL_PCT,
      denominator: "equal_weight_average_pair_return_per_day",
      hourlyBarRule: "enter at first hourly bar open at or after session timestamp; TP/SL evaluated on hourly close marks",
      weekCount: system.weeklyReturns.length,
      tradingDayCount: tradingDays.length,
    },
    variants: summaries,
    dailyResults: Object.fromEntries(
      VARIANTS.map((variant) => [variant.id, byVariant.get(variant.id) ?? []]),
    ),
  };

  const stamp = DateTime.utc().toFormat("yyyyLLdd-HHmmss");
  const jsonPath = path.join(REPORTS_DIR, `${OUTPUT_BASENAME}-${stamp}.json`);
  const mdPath = path.join(REPORTS_DIR, `${OUTPUT_BASENAME}-${stamp}.md`);
  const latestJsonPath = path.join(REPORTS_DIR, `${OUTPUT_BASENAME}-latest.json`);
  const latestMdPath = path.join(REPORTS_DIR, `${OUTPUT_BASENAME}-latest.md`);

  writeFileSync(jsonPath, JSON.stringify(output, null, 2));
  writeFileSync(latestJsonPath, JSON.stringify(output, null, 2));

  const mdLines = [
    "# Tiered V3 Session Intraday Phase 1",
    "",
    `Generated: ${output.generatedUtc}`,
    "",
    "## Methodology",
    "",
    `- System: ${output.methodology.system}`,
    `- Scope: ${output.methodology.scope}`,
    `- Weeks: ${output.methodology.weekCount}`,
    `- Trading days: ${output.methodology.tradingDayCount}`,
    `- Basket TP: +${output.methodology.basketTpPct.toFixed(2)}%`,
    `- Basket SL: ${output.methodology.basketSlPct.toFixed(2)}%`,
    `- Denominator: ${output.methodology.denominator}`,
    `- Hourly rule: ${output.methodology.hourlyBarRule}`,
    "",
    "## Summary",
    "",
    ...formatSummaryTable(summaries),
    "",
  ];

  writeFileSync(mdPath, mdLines.join("\n"));
  writeFileSync(latestMdPath, mdLines.join("\n"));

  console.log(`Wrote ${jsonPath}`);
  console.log(`Wrote ${mdPath}`);
  console.log("Top variants:");
  for (const row of summaries.slice(0, 5)) {
    console.log(
      `  ${row.variantId}: return ${row.simpleReturnPct.toFixed(2)}%, max DD ${row.maxDrawdownPct.toFixed(2)}%, win ${row.dailyWinRatePct.toFixed(2)}%, t-stat ${row.tStatDaily === null ? "n/a" : row.tStatDaily.toFixed(2)}`,
    );
  }
}

main().catch((error) => {
  console.error("backtest-tiered-v3-session-intraday-phase1 failed:", error);
  process.exitCode = 1;
});
