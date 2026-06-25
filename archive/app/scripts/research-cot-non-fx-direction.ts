/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: research-cot-non-fx-direction.ts
 *
 * Description:
 * Compares non-FX direction methods for dealer and commercial:
 *  1. Current base-only
 *  2. Base vs USD comparison
 *  3. Base-only with single-currency resolver
 *  4. Base direction gated by broad FX/USD flow
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import { writeFileSync } from "node:fs";
import { DateTime } from "luxon";
import { deriveCotReportDate, listDataSectionWeeks } from "../src/lib/dataSectionWeeks";
import {
  derivePairDirections,
  derivePairDirectionsByBase,
  derivePairDirectionsWithNeutral,
  resolveMarketBias,
} from "../src/lib/cotCompute";
import { PAIRS_BY_ASSET_CLASS, type PairDefinition } from "../src/lib/cotPairs";
import { readSnapshot } from "../src/lib/cotStore";
import type { AssetClass } from "../src/lib/cotMarkets";
import type { MarketSnapshot } from "../src/lib/cotTypes";
import { getAdrPct, getTargetAdrPct, loadWeeklyAdrMap } from "../src/lib/performance/adrLookup";
import { getWeeklyPairReturns } from "../src/lib/pairReturns";
import { getDisplayWeekOpenUtc, normalizeWeekOpenUtc } from "../src/lib/weekAnchor";

const OUTPUT_PATH = "docs/COT_NON_FX_DIRECTION_RESEARCH_2026-04-04.md";
const NON_FX_ASSET_CLASSES: AssetClass[] = ["indices", "crypto", "commodities"];
const USD_PAIR_DEFS = PAIRS_BY_ASSET_CLASS.fx.filter((pd) => pd.base === "USD" || pd.quote === "USD");

type Model = "dealer" | "commercial";
type Direction = "LONG" | "SHORT";
type Method = "base_only" | "base_vs_usd" | "single_currency" | "fx_complex_gate";

type Row = {
  weekOpenUtc: string;
  assetClass: AssetClass;
  pair: string;
  rawReturnPct: number;
  adrMultiplier: number;
  dealer: Record<Method, Direction | null>;
  commercial: Record<Method, Direction | null>;
};

type Stats = {
  trades: number;
  totalPct: number;
  maxDdPct: number;
  winRatePct: number;
  coverage: string;
};

function weekLabel(weekOpenUtc: string) {
  return DateTime.fromISO(weekOpenUtc, { zone: "utc" }).toFormat("MMM dd");
}

function directionFromScore(score: number | null | undefined): Direction | null {
  if (typeof score !== "number" || !Number.isFinite(score) || score === 0) {
    return null;
  }
  return score > 0 ? "LONG" : "SHORT";
}

function round(value: number, digits = 2) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function signedPct(value: number, digits = 2) {
  return `${value >= 0 ? "+" : ""}${value.toFixed(digits)}%`;
}

function directionalReturn(row: Row, direction: Direction) {
  return (direction === "SHORT" ? -row.rawReturnPct : row.rawReturnPct) * row.adrMultiplier;
}

function computeMaxDd(weeklyReturns: number[]) {
  let cumulative = 0;
  let peak = 0;
  let maxDd = 0;
  for (const ret of weeklyReturns) {
    cumulative += ret;
    if (cumulative > peak) peak = cumulative;
    maxDd = Math.max(maxDd, peak - cumulative);
  }
  return round(maxDd);
}

function resolveSingleCurrencyDealer(market: MarketSnapshot): Direction | null {
  if (typeof market.dealer_directional_ratio === "number" && market.dealer_directional_ratio > 0.5) {
    return directionFromScore(market.dealer_net);
  }

  if (
    typeof market.dealer_delta_persistence === "number" &&
    market.dealer_delta_persistence >= 3 &&
    typeof market.dealer_delta_net === "number" &&
    market.dealer_delta_net !== 0
  ) {
    return directionFromScore(market.dealer_delta_net);
  }

  if (
    typeof market.dealer_delta_net === "number" &&
    typeof market.oi_delta === "number" &&
    market.dealer_delta_net !== 0 &&
    market.oi_delta !== 0 &&
    Math.sign(market.dealer_delta_net) === Math.sign(market.oi_delta)
  ) {
    return directionFromScore(market.dealer_delta_net);
  }

  return directionFromScore(market.dealer_net);
}

function resolveSingleCurrencyCommercial(market: MarketSnapshot): Direction | null {
  const standard = directionFromScore(market.commercial_net ?? null);
  if (standard) {
    return standard;
  }

  if (
    typeof market.commercial_delta_persistence === "number" &&
    market.commercial_delta_persistence >= 3 &&
    typeof market.commercial_delta_net === "number" &&
    market.commercial_delta_net !== 0
  ) {
    return directionFromScore(market.commercial_delta_net);
  }

  return null;
}

function deriveBaseOnly(
  markets: Record<string, MarketSnapshot>,
  pairDef: PairDefinition,
  model: Model,
) {
  return derivePairDirectionsByBase(markets, [pairDef], model)[pairDef.pair]?.direction ?? null;
}

function deriveBaseVsUsd(
  base: MarketSnapshot,
  usd: MarketSnapshot | undefined,
  pairDef: PairDefinition,
  model: Model,
  fallback: Direction | null,
) {
  if (!usd) {
    return fallback;
  }
  const derived = derivePairDirections(
    { [pairDef.base]: base, USD: usd },
    [pairDef],
    model,
  )[pairDef.pair]?.direction;
  return derived === "LONG" || derived === "SHORT" ? derived : fallback;
}

function broadUsdFlowDirection(
  fxMarkets: Record<string, MarketSnapshot>,
  model: Model,
): Direction | null {
  const derived = derivePairDirectionsWithNeutral(fxMarkets, USD_PAIR_DEFS, model);
  let score = 0;
  for (const pairDef of USD_PAIR_DEFS) {
    const direction = derived[pairDef.pair]?.direction;
    if (direction !== "LONG" && direction !== "SHORT") {
      continue;
    }
    const usdScore =
      pairDef.base === "USD"
        ? direction === "LONG" ? 1 : -1
        : direction === "LONG" ? -1 : 1;
    score += usdScore;
  }
  return directionFromScore(score);
}

function applyFxComplexGate(
  baseDirection: Direction | null,
  usdFlowDirection: Direction | null,
): Direction | null {
  if (!baseDirection || !usdFlowDirection) {
    return null;
  }
  if (baseDirection === "LONG" && usdFlowDirection === "SHORT") {
    return "LONG";
  }
  if (baseDirection === "SHORT" && usdFlowDirection === "LONG") {
    return "SHORT";
  }
  return null;
}

function computeStats(
  rows: Row[],
  assetClass: AssetClass | "combined",
  model: Model,
  method: Method,
  possibleTrades: number,
): Stats {
  const filtered = assetClass === "combined" ? rows : rows.filter((row) => row.assetClass === assetClass);
  const byWeek = new Map<string, { ret: number; trades: number; wins: number }>();

  for (const row of filtered) {
    const direction = row[model][method];
    if (!direction) {
      continue;
    }
    const ret = directionalReturn(row, direction);
    const week = byWeek.get(row.weekOpenUtc) ?? { ret: 0, trades: 0, wins: 0 };
    week.ret += ret;
    week.trades += 1;
    if (ret > 0) {
      week.wins += 1;
    }
    byWeek.set(row.weekOpenUtc, week);
  }

  const weeklyReturns = [...byWeek.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([, value]) => value.ret);
  const trades = [...byWeek.values()].reduce((sum, row) => sum + row.trades, 0);
  const wins = [...byWeek.values()].reduce((sum, row) => sum + row.wins, 0);
  const total = round(weeklyReturns.reduce((sum, value) => sum + value, 0));

  return {
    trades,
    totalPct: total,
    maxDdPct: computeMaxDd(weeklyReturns),
    winRatePct: trades > 0 ? round((wins / trades) * 100, 1) : 0,
    coverage: `${trades}/${possibleTrades}`,
  };
}

function renderPerClassTable(
  title: string,
  model: Model,
  method: Method,
  rows: Row[],
  possibleByClass: Record<AssetClass, number>,
) {
  const lines = [`### ${title}`, "", "| Asset Class | Trades | Total% | MaxDD% | Win% | Coverage |", "| --- | ---: | ---: | ---: | ---: | ---: |"];
  for (const assetClass of NON_FX_ASSET_CLASSES) {
    const stats = computeStats(rows, assetClass, model, method, possibleByClass[assetClass]);
    lines.push(
      `| ${assetClass} | ${stats.trades} | ${signedPct(stats.totalPct)} | ${stats.maxDdPct.toFixed(2)}% | ${stats.winRatePct.toFixed(1)}% | ${stats.coverage} |`,
    );
  }
  const combinedPossible = Object.values(possibleByClass).reduce((sum, value) => sum + value, 0);
  const combined = computeStats(rows, "combined", model, method, combinedPossible);
  lines.push(
    `| combined | ${combined.trades} | ${signedPct(combined.totalPct)} | ${combined.maxDdPct.toFixed(2)}% | ${combined.winRatePct.toFixed(1)}% | ${combined.coverage} |`,
  );
  return lines.join("\n");
}

async function main() {
  console.log("╔══════════════════════════════════════════════════════════════════╗");
  console.log("║   COT Non-FX Direction Research                                ║");
  console.log("╚══════════════════════════════════════════════════════════════════╝");

  const currentWeekOpenUtc = getDisplayWeekOpenUtc();
  const weekOpenUtcs = (await listDataSectionWeeks())
    .sort((left, right) => left.localeCompare(right))
    .filter((weekOpenUtc) => weekOpenUtc < currentWeekOpenUtc);

  const targetAdr = getTargetAdrPct();
  const rows: Row[] = [];
  const possibleByClass = {
    indices: weekOpenUtcs.length * PAIRS_BY_ASSET_CLASS.indices.length,
    crypto: weekOpenUtcs.length * PAIRS_BY_ASSET_CLASS.crypto.length,
    commodities: weekOpenUtcs.length * PAIRS_BY_ASSET_CLASS.commodities.length,
  } satisfies Record<AssetClass, number>;

  for (const rawWeekOpenUtc of weekOpenUtcs) {
    const weekOpenUtc = normalizeWeekOpenUtc(rawWeekOpenUtc) ?? rawWeekOpenUtc;
    const reportDate = deriveCotReportDate(weekOpenUtc);
    const [fxSnapshot, indicesSnapshot, cryptoSnapshot, commoditiesSnapshot] = await Promise.all([
      readSnapshot({ assetClass: "fx", reportDate }),
      readSnapshot({ assetClass: "indices", reportDate }),
      readSnapshot({ assetClass: "crypto", reportDate }),
      readSnapshot({ assetClass: "commodities", reportDate }),
    ]);

    if (!fxSnapshot) {
      throw new Error(`Missing FX snapshot for ${reportDate}`);
    }

    const snapshotByClass = {
      indices: indicesSnapshot,
      crypto: cryptoSnapshot,
      commodities: commoditiesSnapshot,
    } satisfies Partial<Record<AssetClass, Awaited<ReturnType<typeof readSnapshot>>>>;

    const weeklyReturns = await getWeeklyPairReturns(weekOpenUtc);
    const adrMap = await loadWeeklyAdrMap(weekOpenUtc);
    const returnMap = new Map(
      weeklyReturns.map((row) => {
        const adrPct = getAdrPct(adrMap, row.symbol.toUpperCase(), row.assetClass);
        return [
          row.symbol.toUpperCase(),
          {
            returnPct: row.returnPct,
            adrMultiplier: adrPct > 0 ? targetAdr / adrPct : 1,
          },
        ] as const;
      }),
    );

    const dealerUsdFlow = broadUsdFlowDirection(fxSnapshot.currencies, "dealer");
    const commercialUsdFlow = broadUsdFlowDirection(fxSnapshot.currencies, "commercial");
    const usdSnapshot = fxSnapshot.currencies.USD;

    for (const assetClass of NON_FX_ASSET_CLASSES) {
      const snapshot = snapshotByClass[assetClass];
      if (!snapshot) {
        continue;
      }

      for (const pairDef of PAIRS_BY_ASSET_CLASS[assetClass]) {
        const pair = pairDef.pair.toUpperCase();
        const ret = returnMap.get(pair);
        const base = snapshot.currencies[pairDef.base];
        if (!ret || !base) {
          continue;
        }

        const dealerBaseOnly = deriveBaseOnly(snapshot.currencies, pairDef, "dealer") as Direction | null;
        const dealerBaseVsUsd = deriveBaseVsUsd(base, usdSnapshot, pairDef, "dealer", dealerBaseOnly) as Direction | null;
        const dealerBaseBias = resolveMarketBias(base, "dealer");
        const dealerSingleCurrency =
          dealerBaseBias?.bias === "NEUTRAL"
            ? resolveSingleCurrencyDealer(base)
            : dealerBaseOnly;
        const dealerFxComplex = applyFxComplexGate(dealerSingleCurrency, dealerUsdFlow);

        const commercialBaseOnly = deriveBaseOnly(snapshot.currencies, pairDef, "commercial") as Direction | null;
        const commercialBaseVsUsd = deriveBaseVsUsd(base, usdSnapshot, pairDef, "commercial", commercialBaseOnly) as Direction | null;
        const commercialBaseBias = resolveMarketBias(base, "commercial");
        const commercialSingleCurrency =
          commercialBaseBias?.bias === "NEUTRAL"
            ? resolveSingleCurrencyCommercial(base)
            : commercialBaseOnly;
        const commercialFxComplex = applyFxComplexGate(commercialSingleCurrency, commercialUsdFlow);

        rows.push({
          weekOpenUtc,
          assetClass,
          pair,
          rawReturnPct: ret.returnPct,
          adrMultiplier: ret.adrMultiplier,
          dealer: {
            base_only: dealerBaseOnly,
            base_vs_usd: dealerBaseVsUsd,
            single_currency: dealerSingleCurrency,
            fx_complex_gate: dealerFxComplex,
          },
          commercial: {
            base_only: commercialBaseOnly,
            base_vs_usd: commercialBaseVsUsd,
            single_currency: commercialSingleCurrency,
            fx_complex_gate: commercialFxComplex,
          },
        });
      }
    }
  }

  const methodTitles: Record<Method, string> = {
    base_only: "Option 1: Base-only baseline",
    base_vs_usd: "Option 2: Base vs USD comparison",
    single_currency: "Option 3: Single-currency resolver",
    fx_complex_gate: "Option 4: FX-complex gate",
  };

  const dealerCombinedPossible = Object.values(possibleByClass).reduce((sum, value) => sum + value, 0);
  const dealerSummary = (Object.keys(methodTitles) as Method[]).map((method) => ({
    method,
    stats: computeStats(rows, "combined", "dealer", method, dealerCombinedPossible),
  }));
  const commercialSummary = (Object.keys(methodTitles) as Method[]).map((method) => ({
    method,
    stats: computeStats(rows, "combined", "commercial", method, dealerCombinedPossible),
  }));

  const lines: string[] = [];
  lines.push("# COT Non-FX Direction Research");
  lines.push("");
  lines.push(`Weeks analyzed: ${weekOpenUtcs.length} (${weekLabel(weekOpenUtcs[0]!)} -> ${weekLabel(weekOpenUtcs.at(-1)!)}).`);
  lines.push("");
  lines.push("Non-FX universe: 3 indices + 2 crypto + 3 commodities = 8 pairs per week.");
  lines.push("");

  lines.push("## Dealer");
  lines.push("");
  for (const method of Object.keys(methodTitles) as Method[]) {
    lines.push(renderPerClassTable(methodTitles[method], "dealer", method, rows, possibleByClass));
    lines.push("");
  }

  lines.push("### Dealer comparison");
  lines.push("");
  lines.push("| Method | Trades | Total% | MaxDD% | Win% | Coverage |");
  lines.push("| --- | ---: | ---: | ---: | ---: | ---: |");
  for (const row of dealerSummary) {
    lines.push(
      `| ${methodTitles[row.method]} | ${row.stats.trades} | ${signedPct(row.stats.totalPct)} | ${row.stats.maxDdPct.toFixed(2)}% | ${row.stats.winRatePct.toFixed(1)}% | ${row.stats.coverage} |`,
    );
  }
  lines.push("");

  lines.push("## Commercial");
  lines.push("");
  for (const method of Object.keys(methodTitles) as Method[]) {
    lines.push(renderPerClassTable(methodTitles[method], "commercial", method, rows, possibleByClass));
    lines.push("");
  }

  lines.push("### Commercial comparison");
  lines.push("");
  lines.push("| Method | Trades | Total% | MaxDD% | Win% | Coverage |");
  lines.push("| --- | ---: | ---: | ---: | ---: | ---: |");
  for (const row of commercialSummary) {
    lines.push(
      `| ${methodTitles[row.method]} | ${row.stats.trades} | ${signedPct(row.stats.totalPct)} | ${row.stats.maxDdPct.toFixed(2)}% | ${row.stats.winRatePct.toFixed(1)}% | ${row.stats.coverage} |`,
    );
  }
  lines.push("");

  lines.push("## Per-Class Winners");
  lines.push("");
  lines.push("| Model | indices | crypto | commodities |");
  lines.push("| --- | --- | --- | --- |");
  for (const model of ["dealer", "commercial"] as const) {
    const winners = NON_FX_ASSET_CLASSES.map((assetClass) => {
      const statsByMethod = (Object.keys(methodTitles) as Method[]).map((method) => ({
        method,
        stats: computeStats(rows, assetClass, model, method, possibleByClass[assetClass]),
      }));
      const winner = statsByMethod.sort(
        (left, right) =>
          right.stats.totalPct - left.stats.totalPct ||
          left.stats.maxDdPct - right.stats.maxDdPct ||
          right.stats.winRatePct - left.stats.winRatePct,
      )[0]!;
      return methodTitles[winner.method].replace("Option ", "O").replace(": ", " ");
    });
    lines.push(`| ${model} | ${winners.join(" | ")} |`);
  }
  lines.push("");

  writeFileSync(OUTPUT_PATH, `${lines.join("\n")}\n`, "utf8");

  console.log("Dealer summary:");
  for (const row of dealerSummary) {
    console.log(
      `  ${methodTitles[row.method]} :: ${row.stats.trades} / ${row.stats.totalPct.toFixed(2)}% / ${row.stats.maxDdPct.toFixed(2)} DD / ${row.stats.winRatePct.toFixed(1)}%`,
    );
  }
  console.log("Commercial summary:");
  for (const row of commercialSummary) {
    console.log(
      `  ${methodTitles[row.method]} :: ${row.stats.trades} / ${row.stats.totalPct.toFixed(2)}% / ${row.stats.maxDdPct.toFixed(2)} DD / ${row.stats.winRatePct.toFixed(1)}%`,
    );
  }
  console.log(`Output written to ${OUTPUT_PATH}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
