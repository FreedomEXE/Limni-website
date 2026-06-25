/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * Research-only Weekly Hold exit variants:
 * - baseline hold to weekly close
 * - close full trade at +1x pair ADR
 * - arm a trailing stop after +1x pair ADR is touched
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import { listDataSectionWeeks } from "../../src/lib/dataSectionWeeks";
import { getDisplayWeekOpenUtc } from "../../src/lib/weekAnchor";
import { buildDataWeekOptions } from "../../src/lib/weekOptions";
import { getEntryStyle, getStrategy, type StrategyConfig } from "../../src/lib/performance/strategyConfig";
import { computeWeeklyHold, type WeeklyHoldResult, type WeeklyHoldTrade } from "../../src/lib/performance/weeklyHoldEngine";
import { loadWeeklyAdrMap, getAdrPct, getTargetAdrPct } from "../../src/lib/performance/adrLookup";
import { buildWeeklyHoldLedger } from "../../src/lib/performance/positionLedger";
import { computeBasketPath, computeMultiWeekBasketPath, type BasketPathResult } from "../../src/lib/performance/basketPathEngine";
import { dailyReturnsFromPath, computeReturnSharpe } from "../../src/lib/performance/performanceMetricBasis";
import { loadPathBars, type PathBarMap } from "../../src/lib/performance/pathBarLoader";
import type { CanonicalPriceBar } from "../../src/lib/canonicalPriceBars";

type VariantId =
  | "weekly_hold"
  | "tp_1x_adr"
  | "trail_after_1x_020"
  | "trail_after_1x_040"
  | "trail_after_1x_100";

type WeekVariant = {
  weekOpenUtc: string;
  result: WeeklyHoldResult;
  path: BasketPathResult;
  exitCounts: Record<string, number>;
};

type VariantSummary = {
  strategyId: string;
  variantId: VariantId;
  weeks: WeekVariant[];
  totalReturnPct: number;
  pathMaxDrawdownPct: number;
  returnToDd: number;
  pathSharpe: number;
  trades: number;
  winRatePct: number;
  weeklyWinRatePct: number;
  worstWeekPct: number;
  maxActivePositions: number;
  exitCounts: Record<string, number>;
};

function fmt(value: number, digits = 2) {
  return `${value >= 0 ? "+" : ""}${value.toFixed(digits)}%`;
}

function num(value: number, digits = 2) {
  return value.toFixed(digits);
}

function variantLabel(id: VariantId) {
  if (id === "weekly_hold") return "Weekly Hold";
  if (id === "tp_1x_adr") return "Close at +1x ADR";
  if (id === "trail_after_1x_020") return "Trail after +1x, 0.20 ADR";
  if (id === "trail_after_1x_040") return "Trail after +1x, 0.40 ADR";
  return "Trail after +1x, 1.00 ADR";
}

function exitReasonForVariant(id: VariantId) {
  if (id === "tp_1x_adr") return "tp_1x_adr";
  if (id === "trail_after_1x_020") return "trail_020";
  if (id === "trail_after_1x_040") return "trail_040";
  if (id === "trail_after_1x_100") return "trail_100";
  return "week_close";
}

function pathSharpe(pathResults: BasketPathResult[]) {
  const multi = computeMultiWeekBasketPath(pathResults);
  const returns = dailyReturnsFromPath(multi.points.map((point) => ({
    ts_utc: point.tsUtc,
    equity_pct: point.equityPct,
    drawdown_pct: point.drawdownPct,
  })));
  return computeReturnSharpe(returns, 252);
}

async function computePathForWeek(result: WeeklyHoldResult, entryStyleId: string) {
  const ledger = await buildWeeklyHoldLedger(result, { entryStyleId });
  const symbols = Array.from(new Set(ledger.legs.map((leg) => leg.symbol))).sort();
  const bars = await loadPathBars(symbols, ledger.weekOpenUtc, ledger.weekCloseUtc, "1h");
  return computeBasketPath(ledger, bars, { returnMode: "normalized" });
}

function rawReturnPct(direction: "LONG" | "SHORT", entry: number, exit: number) {
  if (!Number.isFinite(entry) || !Number.isFinite(exit) || entry <= 0) return 0;
  const rawMove = ((exit - entry) / entry) * 100;
  return direction === "SHORT" ? -rawMove : rawMove;
}

function getTradeAdrPct(trade: WeeklyHoldTrade, adrMap: Map<string, number>, targetAdr: number) {
  const fromTrade = trade.adrPct ?? trade.detail?.adrPct;
  if (typeof fromTrade === "number" && Number.isFinite(fromTrade) && fromTrade > 0) return fromTrade;
  const fromMap = getAdrPct(adrMap, trade.symbol, trade.assetClass);
  return Number.isFinite(fromMap) && fromMap > 0 ? fromMap : targetAdr;
}

function favorableTargetPrice(trade: WeeklyHoldTrade, adrPct: number, adrMultiple: number) {
  const move = (adrPct * adrMultiple) / 100;
  return trade.direction === "SHORT"
    ? trade.openPrice * (1 - move)
    : trade.openPrice * (1 + move);
}

function trailingStopPrice(direction: "LONG" | "SHORT", bestPrice: number, adrPct: number, trailAdr: number) {
  const move = (adrPct * trailAdr) / 100;
  return direction === "SHORT"
    ? bestPrice * (1 + move)
    : bestPrice * (1 - move);
}

function barsForTrade(bars: PathBarMap, trade: WeeklyHoldTrade, entryTimeUtc: string, exitTimeUtc: string) {
  const entryMs = Date.parse(entryTimeUtc);
  const exitMs = Date.parse(exitTimeUtc);
  return (bars.get(trade.symbol.toUpperCase()) ?? []).filter((bar) => {
    const barOpenMs = Date.parse(bar.barOpenUtc);
    return Number.isFinite(barOpenMs) && barOpenMs >= entryMs && barOpenMs < exitMs;
  });
}

function simulateExit(params: {
  variantId: VariantId;
  trade: WeeklyHoldTrade;
  adrPct: number;
  weekCloseUtc: string;
  bars: CanonicalPriceBar[];
}): { exitPrice: number; exitTimeUtc: string; exitReason: string; armed: boolean } {
  const { variantId, trade, adrPct, weekCloseUtc, bars } = params;
  if (variantId === "weekly_hold") {
    return { exitPrice: trade.closePrice, exitTimeUtc: weekCloseUtc, exitReason: "week_close", armed: false };
  }

  const target = favorableTargetPrice(trade, adrPct, 1.0);
  const direction = trade.direction;
  const targetHit = (bar: CanonicalPriceBar) =>
    direction === "SHORT" ? bar.lowPrice <= target : bar.highPrice >= target;

  if (variantId === "tp_1x_adr") {
    for (const bar of bars) {
      if (targetHit(bar)) {
        return {
          exitPrice: target,
          exitTimeUtc: bar.barCloseUtc,
          exitReason: "tp_1x_adr",
          armed: false,
        };
      }
    }
    return { exitPrice: trade.closePrice, exitTimeUtc: weekCloseUtc, exitReason: "week_close", armed: false };
  }

  const trailAdr = variantId === "trail_after_1x_020"
    ? 0.20
    : variantId === "trail_after_1x_040"
      ? 0.40
      : 1.00;

  let armed = false;
  let bestPrice = target;
  let stopPrice = Number.NaN;

  for (const bar of bars) {
    if (armed) {
      const stopHit = direction === "SHORT" ? bar.highPrice >= stopPrice : bar.lowPrice <= stopPrice;
      if (stopHit) {
        return {
          exitPrice: stopPrice,
          exitTimeUtc: bar.barCloseUtc,
          exitReason: exitReasonForVariant(variantId),
          armed: true,
        };
      }
      bestPrice = direction === "SHORT"
        ? Math.min(bestPrice, bar.lowPrice)
        : Math.max(bestPrice, bar.highPrice);
      stopPrice = trailingStopPrice(direction, bestPrice, adrPct, trailAdr);
    } else if (targetHit(bar)) {
      armed = true;
      bestPrice = target;
      stopPrice = trailingStopPrice(direction, bestPrice, adrPct, trailAdr);
    }
  }

  return {
    exitPrice: trade.closePrice,
    exitTimeUtc: weekCloseUtc,
    exitReason: armed ? "armed_week_close" : "week_close",
    armed,
  };
}

function rebuildResult(params: {
  baseline: WeeklyHoldResult;
  variantId: VariantId;
  bars: PathBarMap;
  adrMap: Map<string, number>;
}): { result: WeeklyHoldResult; exitCounts: Record<string, number> } {
  const { baseline, variantId, bars, adrMap } = params;
  const targetAdr = getTargetAdrPct();
  const entryTimeUtc = baseline.executionWindowOpenUtc ?? baseline.weekOpenUtc;
  const weekCloseUtc = baseline.executionWindowCloseUtc ?? entryTimeUtc;
  const exitCounts: Record<string, number> = {};

  const trades = baseline.trades.map((trade, index): WeeklyHoldTrade => {
    const adrPct = getTradeAdrPct(trade, adrMap, targetAdr);
    const adrMultiplier = trade.adrMultiplier && Number.isFinite(trade.adrMultiplier)
      ? trade.adrMultiplier
      : targetAdr / adrPct;
    const sim = simulateExit({
      variantId,
      trade,
      adrPct,
      weekCloseUtc,
      bars: barsForTrade(bars, trade, entryTimeUtc, weekCloseUtc),
    });
    exitCounts[sim.exitReason] = (exitCounts[sim.exitReason] ?? 0) + 1;
    const raw = rawReturnPct(trade.direction, trade.openPrice, sim.exitPrice);
    const normalized = raw * adrMultiplier;
    return {
      ...trade,
      closePrice: sim.exitPrice,
      rawReturnPct: raw,
      normalizedReturnPct: normalized,
      displayReturnPct: normalized,
      returnPct: normalized,
      adrPct,
      adrMultiplier,
      returnMode: "normalized",
      detail: {
        tradeNumber: trade.detail?.tradeNumber ?? index + 1,
        entryTimeUtc,
        exitTimeUtc: sim.exitTimeUtc,
        exitReason: sim.exitReason,
        anchorPrice: trade.openPrice,
        tpPrice: variantId === "weekly_hold" ? null : favorableTargetPrice(trade, adrPct, 1.0),
        adrPct,
        maePct: trade.detail?.maePct ?? null,
      },
    };
  });

  const totalReturnPct = trades.reduce((sum, trade) => sum + trade.returnPct, 0);
  const wins = trades.filter((trade) => trade.returnPct > 0).length;
  const losses = trades.filter((trade) => trade.returnPct <= 0).length;
  return {
    result: {
      ...baseline,
      trades,
      totalReturnPct,
      rawTotalReturnPct: trades.reduce((sum, trade) => sum + (trade.rawReturnPct ?? 0), 0),
      normalizedTotalReturnPct: totalReturnPct,
      displayTotalReturnPct: totalReturnPct,
      winCount: wins,
      lossCount: losses,
      winRate: trades.length > 0 ? (wins / trades.length) * 100 : 0,
      tradeCount: trades.length,
    },
    exitCounts,
  };
}

async function withQuietConsole<T>(fn: () => Promise<T>): Promise<T> {
  const originalLog = console.log;
  const originalWarn = console.warn;
  try {
    console.log = () => undefined;
    console.warn = () => undefined;
    return await fn();
  } finally {
    console.log = originalLog;
    console.warn = originalWarn;
  }
}

async function runWeek(strategy: StrategyConfig, weekOpenUtc: string, variantId: VariantId): Promise<WeekVariant> {
  const entryStyle = getEntryStyle("weekly_hold");
  if (!entryStyle) throw new Error("Missing weekly_hold entry style");
  const baseline = await withQuietConsole(() => computeWeeklyHold(strategy, weekOpenUtc, entryStyle));
  const ledger = await buildWeeklyHoldLedger(baseline, { entryStyleId: "weekly_hold" });
  const symbols = Array.from(new Set(ledger.legs.map((leg) => leg.symbol))).sort();
  const bars = await loadPathBars(symbols, ledger.weekOpenUtc, ledger.weekCloseUtc, "1h");
  const adrMap = await loadWeeklyAdrMap(weekOpenUtc);
  const { result, exitCounts } = rebuildResult({ baseline, variantId, bars, adrMap });
  return {
    weekOpenUtc,
    result,
    path: await computePathForWeek(result, variantId),
    exitCounts,
  };
}

function summarize(strategyId: string, variantId: VariantId, weeks: WeekVariant[]): VariantSummary {
  const multiPath = computeMultiWeekBasketPath(weeks.map((week) => week.path));
  const weeklyReturns = weeks.map((week) => week.path.summary.totalReturnPct);
  const tradeReturns = weeks.flatMap((week) => week.result.trades.map((trade) => trade.returnPct));
  const wins = tradeReturns.filter((value) => value > 0).length;
  const exitCounts: Record<string, number> = {};
  for (const week of weeks) {
    for (const [reason, count] of Object.entries(week.exitCounts)) {
      exitCounts[reason] = (exitCounts[reason] ?? 0) + count;
    }
  }
  return {
    strategyId,
    variantId,
    weeks,
    totalReturnPct: multiPath.summary.totalReturnPct,
    pathMaxDrawdownPct: multiPath.summary.maxDrawdownPct,
    returnToDd: multiPath.summary.maxDrawdownPct > 0
      ? multiPath.summary.totalReturnPct / multiPath.summary.maxDrawdownPct
      : 0,
    pathSharpe: pathSharpe(weeks.map((week) => week.path)),
    trades: tradeReturns.length,
    winRatePct: tradeReturns.length > 0 ? (wins / tradeReturns.length) * 100 : 0,
    weeklyWinRatePct: weeklyReturns.length > 0
      ? (weeklyReturns.filter((value) => value > 0).length / weeklyReturns.length) * 100
      : 0,
    worstWeekPct: weeklyReturns.length > 0 ? Math.min(...weeklyReturns) : 0,
    maxActivePositions: multiPath.summary.maxActivePositions,
    exitCounts,
  };
}

function printSummaryTable(title: string, summaries: VariantSummary[]) {
  console.log(`\n${title}`);
  console.log("=".repeat(title.length));
  console.log([
    "Variant".padEnd(30),
    "Return".padStart(10),
    "Path DD".padStart(10),
    "Ret/DD".padStart(8),
    "Path Sharpe".padStart(12),
    "Trades".padStart(8),
    "Win%".padStart(8),
    "WkWin%".padStart(8),
    "WorstWk".padStart(10),
    "MaxAct".padStart(8),
    "Exits".padStart(18),
  ].join(" "));
  for (const summary of summaries) {
    const exits = Object.entries(summary.exitCounts)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([reason, count]) => `${reason}:${count}`)
      .join(",");
    console.log([
      variantLabel(summary.variantId).padEnd(30),
      fmt(summary.totalReturnPct).padStart(10),
      `${summary.pathMaxDrawdownPct.toFixed(2)}%`.padStart(10),
      num(summary.returnToDd).padStart(8),
      num(summary.pathSharpe).padStart(12),
      String(summary.trades).padStart(8),
      `${summary.winRatePct.toFixed(1)}%`.padStart(8),
      `${summary.weeklyWinRatePct.toFixed(1)}%`.padStart(8),
      fmt(summary.worstWeekPct).padStart(10),
      String(summary.maxActivePositions).padStart(8),
      exits.padStart(18),
    ].join(" "));
  }
}

async function main() {
  const currentWeek = getDisplayWeekOpenUtc();
  const dataWeeks = await listDataSectionWeeks();
  const weeks = buildDataWeekOptions({
    historicalWeeks: dataWeeks,
    currentWeekOpenUtc: currentWeek,
    limit: 20,
  })
    .filter((weekOpenUtc): weekOpenUtc is string => typeof weekOpenUtc === "string")
    .filter((weekOpenUtc) => weekOpenUtc !== currentWeek)
    .slice(0, 19)
    .sort((left, right) => left.localeCompare(right));

  if (weeks.length === 0) throw new Error("No realized weeks available.");

  console.log("Weekly Hold ADR exit research");
  console.log(`Weeks: ${weeks.length} (${weeks[0]} -> ${weeks[weeks.length - 1]})`);
  console.log("Returns are ADR-normalized. Exits are per trade, based on H1 path bars.");
  console.log("Trailing variants arm only after +1x pair ADR is touched; active stops are checked before updating the next H1 trail.");

  const variants: VariantId[] = [
    "weekly_hold",
    "tp_1x_adr",
    "trail_after_1x_020",
    "trail_after_1x_040",
    "trail_after_1x_100",
  ];

  for (const strategyId of ["tandem", "tiered_v3", "agree_3of4", "selector"]) {
    const strategy = getStrategy(strategyId);
    if (!strategy) throw new Error(`Missing strategy ${strategyId}`);
    const summaries: VariantSummary[] = [];
    for (const variantId of variants) {
      const weekResults: WeekVariant[] = [];
      for (const weekOpenUtc of weeks) {
        weekResults.push(await runWeek(strategy, weekOpenUtc, variantId));
      }
      summaries.push(summarize(strategy.id, variantId, weekResults));
    }
    printSummaryTable(`${strategy.label} - Weekly Hold ADR exits`, summaries);
    const baseline = summaries.find((summary) => summary.variantId === "weekly_hold");
    const bestBySharpe = summaries.slice().sort((left, right) => right.pathSharpe - left.pathSharpe)[0];
    const bestByReturnDd = summaries.slice().sort((left, right) => right.returnToDd - left.returnToDd)[0];
    if (baseline && bestBySharpe) {
      console.log(`\nPrimary read for ${strategy.label}: best path Sharpe is ${variantLabel(bestBySharpe.variantId)} (${bestBySharpe.pathSharpe.toFixed(2)}, return ${fmt(bestBySharpe.totalReturnPct)}, DD ${bestBySharpe.pathMaxDrawdownPct.toFixed(2)}%).`);
      console.log(`Against baseline: return ${fmt(bestBySharpe.totalReturnPct - baseline.totalReturnPct)}, DD ${(bestBySharpe.pathMaxDrawdownPct - baseline.pathMaxDrawdownPct).toFixed(2)} points, Sharpe ${(bestBySharpe.pathSharpe - baseline.pathSharpe).toFixed(2)}.`);
    }
    if (baseline && bestByReturnDd) {
      console.log(`Best return/DD is ${variantLabel(bestByReturnDd.variantId)} (${bestByReturnDd.returnToDd.toFixed(2)} return/DD).`);
    }
  }
}

main().catch((error) => {
  console.error("[backtest-weekly-hold-adr-exits] Failed:", error instanceof Error ? error.stack ?? error.message : error);
  process.exitCode = 1;
});
