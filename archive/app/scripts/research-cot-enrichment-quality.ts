/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: research-cot-enrichment-quality.ts
 *
 * Description:
 * Evaluates whether enriched COT fields improve dealer neutral-pair
 * resolution over the crude lean tiebreaker, and captures a secondary
 * view of whether the same enrichments add signal to commercial FX.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import { writeFileSync } from "node:fs";
import { DateTime } from "luxon";
import { deriveCotReportDate, listDataSectionWeeks } from "../src/lib/dataSectionWeeks";
import { getAdrPct, getTargetAdrPct, loadWeeklyAdrMap } from "../src/lib/performance/adrLookup";
import { getWeeklyPairReturns } from "../src/lib/pairReturns";
import { PAIRS_BY_ASSET_CLASS } from "../src/lib/cotPairs";
import { derivePairDirectionsWithNeutral } from "../src/lib/cotCompute";
import { readSnapshot } from "../src/lib/cotStore";
import type { Direction, MarketSnapshot } from "../src/lib/cotTypes";
import { normalizeWeekOpenUtc, getDisplayWeekOpenUtc } from "../src/lib/weekAnchor";

const OUTPUT_PATH = "docs/COT_ENRICHMENT_RESEARCH_RESULTS_2026-04-04.md";

type NeutralPairRecord = {
  weekOpenUtc: string;
  weekLabel: string;
  pair: string;
  base: string;
  quote: string;
  assetClass: "fx";
  rawReturnPct: number;
  adrMultiplier: number;
  leanScore: number | null;
  deltaScore: number | null;
  pctOiScore: number | null;
  oiConfirmedScore: number | null;
  concWeightedScore: number | null;
  baseDealerNet: number;
  quoteDealerNet: number;
  baseDealerDeltaNet: number | null;
  quoteDealerDeltaNet: number | null;
  baseDealerPctOi: number | null;
  quoteDealerPctOi: number | null;
  baseOiDelta: number | null;
  quoteOiDelta: number | null;
  baseConc4Avg: number | null;
  quoteConc4Avg: number | null;
};

type CurrencySummaryRow = {
  weekLabel: string;
  currency: string;
  dealerNet: number;
  dealerDeltaNet: number | null;
  dealerPctOfOi: number | null;
  oiDelta: number | null;
  conc4Long: number | null;
  conc4Short: number | null;
};

type MethodStats = {
  method: string;
  forcedPairs: number;
  totalReturnPct: number;
  winRatePct: number;
  avgReturnPct: number;
};

type CommercialStats = {
  method: string;
  forcedPairs: number;
  totalReturnPct: number;
  winRatePct: number;
  avgReturnPct: number;
};

function round(value: number, digits = 2) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function signed(value: number, digits = 2) {
  return `${value >= 0 ? "+" : ""}${value.toFixed(digits)}%`;
}

function weekLabel(weekOpenUtc: string) {
  return DateTime.fromISO(weekOpenUtc, { zone: "utc" }).toFormat("MMM dd");
}

function directionFromScore(score: number | null | undefined): Direction | null {
  if (typeof score !== "number" || !Number.isFinite(score)) {
    return null;
  }
  if (score > 0) return "LONG";
  if (score < 0) return "SHORT";
  return null;
}

function pairScore(
  base: MarketSnapshot,
  quote: MarketSnapshot,
  getter: (market: MarketSnapshot) => number | null | undefined,
): number | null {
  const baseValue = getter(base);
  const quoteValue = getter(quote);
  if (typeof baseValue !== "number" || typeof quoteValue !== "number") {
    return null;
  }
  return baseValue - quoteValue;
}

function average(values: Array<number | null | undefined>) {
  const present = values.filter((value): value is number => typeof value === "number");
  if (present.length === 0) {
    return null;
  }
  return present.reduce((sum, value) => sum + value, 0) / present.length;
}

function concentrationWeight(market: MarketSnapshot) {
  const avgConc = average([market.conc_gross_4_long, market.conc_gross_4_short]);
  if (typeof avgConc !== "number") {
    return 1;
  }
  return Math.max(0.1, 1 - avgConc / 100);
}

function oiConfirmedPairScore(base: MarketSnapshot, quote: MarketSnapshot) {
  const deltaScore = pairScore(base, quote, (market) => market.dealer_delta_net);
  const dir = directionFromScore(deltaScore);
  if (!dir) {
    return null;
  }

  if (dir === "LONG") {
    const baseConfirmed =
      typeof base.dealer_delta_net === "number" &&
      base.dealer_delta_net > 0 &&
      typeof base.oi_delta === "number" &&
      base.oi_delta > 0;
    const quoteConfirmed =
      typeof quote.dealer_delta_net === "number" &&
      quote.dealer_delta_net < 0 &&
      typeof quote.oi_delta === "number" &&
      quote.oi_delta > 0;
    return baseConfirmed || quoteConfirmed ? deltaScore : null;
  }

  const baseConfirmed =
    typeof base.dealer_delta_net === "number" &&
    base.dealer_delta_net < 0 &&
    typeof base.oi_delta === "number" &&
    base.oi_delta > 0;
  const quoteConfirmed =
    typeof quote.dealer_delta_net === "number" &&
    quote.dealer_delta_net > 0 &&
    typeof quote.oi_delta === "number" &&
    quote.oi_delta > 0;
  return baseConfirmed || quoteConfirmed ? deltaScore : null;
}

function concWeightedDeltaPairScore(base: MarketSnapshot, quote: MarketSnapshot) {
  if (
    typeof base.dealer_delta_net !== "number" ||
    typeof quote.dealer_delta_net !== "number"
  ) {
    return null;
  }
  return (
    base.dealer_delta_net * concentrationWeight(base) -
    quote.dealer_delta_net * concentrationWeight(quote)
  );
}

function commercialConcWeightedDeltaPairScore(base: MarketSnapshot, quote: MarketSnapshot) {
  if (
    typeof base.commercial_delta_net !== "number" ||
    typeof quote.commercial_delta_net !== "number"
  ) {
    return null;
  }
  return (
    base.commercial_delta_net * concentrationWeight(base) -
    quote.commercial_delta_net * concentrationWeight(quote)
  );
}

function makeMethodStats(
  method: string,
  records: NeutralPairRecord[],
  scoreGetter: (record: NeutralPairRecord) => number | null,
): MethodStats {
  let forcedPairs = 0;
  let wins = 0;
  let totalReturnPct = 0;

  for (const record of records) {
    const dir = directionFromScore(scoreGetter(record));
    if (!dir) {
      continue;
    }
    const ret = (dir === "SHORT" ? -record.rawReturnPct : record.rawReturnPct) * record.adrMultiplier;
    forcedPairs += 1;
    totalReturnPct += ret;
    if (ret > 0) {
      wins += 1;
    }
  }

  return {
    method,
    forcedPairs,
    totalReturnPct: round(totalReturnPct),
    winRatePct: forcedPairs > 0 ? round((wins / forcedPairs) * 100, 1) : 0,
    avgReturnPct: forcedPairs > 0 ? round(totalReturnPct / forcedPairs, 3) : 0,
  };
}

function makeCommercialStats(
  method: string,
  rows: Array<{ score: number | null; returnPct: number; adrMultiplier: number }>,
): CommercialStats {
  let forcedPairs = 0;
  let wins = 0;
  let totalReturnPct = 0;

  for (const row of rows) {
    const dir = directionFromScore(row.score);
    if (!dir) {
      continue;
    }
    const ret = (dir === "SHORT" ? -row.returnPct : row.returnPct) * row.adrMultiplier;
    forcedPairs += 1;
    totalReturnPct += ret;
    if (ret > 0) {
      wins += 1;
    }
  }

  return {
    method,
    forcedPairs,
    totalReturnPct: round(totalReturnPct),
    winRatePct: forcedPairs > 0 ? round((wins / forcedPairs) * 100, 1) : 0,
    avgReturnPct: forcedPairs > 0 ? round(totalReturnPct / forcedPairs, 3) : 0,
  };
}

async function main() {
  console.log("╔══════════════════════════════════════════════════════════════════╗");
  console.log("║   COT Enrichment Quality Research                              ║");
  console.log("╚══════════════════════════════════════════════════════════════════╝");

  const currentWeekOpenUtc = getDisplayWeekOpenUtc();
  const weeks = (await listDataSectionWeeks())
    .sort((left, right) => left.localeCompare(right))
    .filter((weekOpenUtc) => weekOpenUtc < currentWeekOpenUtc);

  const targetAdr = getTargetAdrPct();
  const currencySummaryRows: CurrencySummaryRow[] = [];
  const neutralRecords: NeutralPairRecord[] = [];
  const commercialRows: Array<{ score: number | null; method: string; returnPct: number; adrMultiplier: number }> = [];

  for (const rawWeekOpenUtc of weeks) {
    const weekOpenUtc = normalizeWeekOpenUtc(rawWeekOpenUtc) ?? rawWeekOpenUtc;
    const reportDate = deriveCotReportDate(weekOpenUtc);
    const snapshot = await readSnapshot({ assetClass: "fx", reportDate });
    if (!snapshot) {
      throw new Error(`Missing FX snapshot for report date ${reportDate}`);
    }

    const dealerPairs = derivePairDirectionsWithNeutral(
      snapshot.currencies,
      PAIRS_BY_ASSET_CLASS.fx,
      "dealer",
    );

    const returns = await getWeeklyPairReturns(weekOpenUtc, "fx");
    const adrMap = await loadWeeklyAdrMap(weekOpenUtc);
    const returnMap = new Map(
      returns.map((row) => [
        row.symbol.toUpperCase(),
        {
          returnPct: row.returnPct,
          adrMultiplier: targetAdr / getAdrPct(adrMap, row.symbol.toUpperCase(), row.assetClass),
        },
      ]),
    );

    for (const currency of Object.keys(snapshot.currencies).sort()) {
      const market = snapshot.currencies[currency]!;
      currencySummaryRows.push({
        weekLabel: weekLabel(weekOpenUtc),
        currency,
        dealerNet: market.dealer_net,
        dealerDeltaNet: market.dealer_delta_net ?? null,
        dealerPctOfOi: market.dealer_pct_of_oi ?? null,
        oiDelta: market.oi_delta ?? null,
        conc4Long: market.conc_gross_4_long ?? null,
        conc4Short: market.conc_gross_4_short ?? null,
      });
    }

    for (const pairDef of PAIRS_BY_ASSET_CLASS.fx) {
      const pair = pairDef.pair.toUpperCase();
      const base = snapshot.currencies[pairDef.base];
      const quote = snapshot.currencies[pairDef.quote];
      const returnRow = returnMap.get(pair);

      if (!base || !quote || !returnRow) {
        continue;
      }

      const leanScore = pairScore(base, quote, (market) => market.dealer_net);
      const deltaScore = pairScore(base, quote, (market) => market.dealer_delta_net);
      const pctOiScore = pairScore(base, quote, (market) => market.dealer_pct_of_oi);
      const oiConfirmedScore = oiConfirmedPairScore(base, quote);
      const concWeightedScore = concWeightedDeltaPairScore(base, quote);

      if (dealerPairs[pair]?.direction === "NEUTRAL") {
        neutralRecords.push({
          weekOpenUtc,
          weekLabel: weekLabel(weekOpenUtc),
          pair,
          base: pairDef.base,
          quote: pairDef.quote,
          assetClass: "fx",
          rawReturnPct: returnRow.returnPct,
          adrMultiplier: returnRow.adrMultiplier,
          leanScore,
          deltaScore,
          pctOiScore,
          oiConfirmedScore,
          concWeightedScore,
          baseDealerNet: base.dealer_net,
          quoteDealerNet: quote.dealer_net,
          baseDealerDeltaNet: base.dealer_delta_net ?? null,
          quoteDealerDeltaNet: quote.dealer_delta_net ?? null,
          baseDealerPctOi: base.dealer_pct_of_oi ?? null,
          quoteDealerPctOi: quote.dealer_pct_of_oi ?? null,
          baseOiDelta: base.oi_delta ?? null,
          quoteOiDelta: quote.oi_delta ?? null,
          baseConc4Avg: average([base.conc_gross_4_long, base.conc_gross_4_short]),
          quoteConc4Avg: average([quote.conc_gross_4_long, quote.conc_gross_4_short]),
        });
      }

      commercialRows.push({
        method: "Forced Raw",
        score: pairScore(base, quote, (market) => market.commercial_net),
        returnPct: returnRow.returnPct,
        adrMultiplier: returnRow.adrMultiplier,
      });
      commercialRows.push({
        method: "Delta-based",
        score: pairScore(base, quote, (market) => market.commercial_delta_net),
        returnPct: returnRow.returnPct,
        adrMultiplier: returnRow.adrMultiplier,
      });
      commercialRows.push({
        method: "PctOI-based",
        score: pairScore(base, quote, (market) => market.commercial_pct_of_oi),
        returnPct: returnRow.returnPct,
        adrMultiplier: returnRow.adrMultiplier,
      });
      commercialRows.push({
        method: "Conc-weighted delta",
        score: commercialConcWeightedDeltaPairScore(base, quote),
        returnPct: returnRow.returnPct,
        adrMultiplier: returnRow.adrMultiplier,
      });
    }
  }

  const neutralMethodStats: MethodStats[] = [
    makeMethodStats("Current lean", neutralRecords, (record) => record.leanScore),
    makeMethodStats("Delta-based", neutralRecords, (record) => record.deltaScore),
    makeMethodStats("PctOI-based", neutralRecords, (record) => record.pctOiScore),
    makeMethodStats("OI-confirmed delta", neutralRecords, (record) => record.oiConfirmedScore),
    makeMethodStats("Conc-weighted delta", neutralRecords, (record) => record.concWeightedScore),
  ];

  const commercialMethodStats = ["Forced Raw", "Delta-based", "PctOI-based", "Conc-weighted delta"].map(
    (method) =>
      makeCommercialStats(
        method,
        commercialRows.filter((row) => row.method === method),
      ),
  );

  const bestNeutralMethod = [...neutralMethodStats].sort(
    (left, right) => right.totalReturnPct - left.totalReturnPct,
  )[0];

  const markdown = [
    "# COT Enrichment Research Results",
    "",
    `Date: ${DateTime.now().toISODate()}`,
    "",
    `Weeks analyzed: ${weeks.length} (${weekLabel(weeks[0]!)} → ${weekLabel(weeks.at(-1)!)}), FX dealer neutral pairs only for the tiebreaker comparison.`,
    "",
    "## FX Currency Enrichment Summary",
    "",
    "| Week | Currency | DealerNet | DeltaNet | Dealer%OI | OIΔ | Conc4 Long | Conc4 Short |",
    "|---|---|---:|---:|---:|---:|---:|---:|",
    ...currencySummaryRows.map(
      (row) =>
        `| ${row.weekLabel} | ${row.currency} | ${row.dealerNet} | ${row.dealerDeltaNet ?? "—"} | ${
          typeof row.dealerPctOfOi === "number" ? row.dealerPctOfOi.toFixed(4) : "—"
        } | ${row.oiDelta ?? "—"} | ${row.conc4Long ?? "—"} | ${row.conc4Short ?? "—"} |`,
    ),
    "",
    "## Dealer Neutral Pair Analysis",
    "",
    "| Week | Pair | Lean | Delta | PctOI | OI-Confirmed | Conc-Weighted | BaseΔ | QuoteΔ | BaseOIΔ | QuoteOIΔ | BaseC4Avg | QuoteC4Avg | Return% |",
    "|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|",
    ...neutralRecords.map(
      (row) =>
        `| ${row.weekLabel} | ${row.pair} | ${row.leanScore?.toFixed(4) ?? "—"} | ${row.deltaScore?.toFixed(4) ?? "—"} | ${
          row.pctOiScore?.toFixed(4) ?? "—"
        } | ${row.oiConfirmedScore?.toFixed(4) ?? "—"} | ${row.concWeightedScore?.toFixed(4) ?? "—"} | ${
          row.baseDealerDeltaNet ?? "—"
        } | ${row.quoteDealerDeltaNet ?? "—"} | ${row.baseOiDelta ?? "—"} | ${row.quoteOiDelta ?? "—"} | ${
          typeof row.baseConc4Avg === "number" ? row.baseConc4Avg.toFixed(2) : "—"
        } | ${
          typeof row.quoteConc4Avg === "number" ? row.quoteConc4Avg.toFixed(2) : "—"
        } | ${row.rawReturnPct.toFixed(3)} |`,
    ),
    "",
    "## Dealer Neutral-Only Tiebreaker Comparison",
    "",
    "| Method | Forced Pairs | Total% | Avg% | Win% |",
    "|---|---:|---:|---:|---:|",
    ...neutralMethodStats.map(
      (row) =>
        `| ${row.method} | ${row.forcedPairs} | ${signed(row.totalReturnPct)} | ${row.avgReturnPct.toFixed(3)}% | ${row.winRatePct.toFixed(1)}% |`,
    ),
    "",
    "## Commercial Secondary Check (All FX Pair-Weeks)",
    "",
    "| Method | Forced Pairs | Total% | Avg% | Win% |",
    "|---|---:|---:|---:|---:|",
    ...commercialMethodStats.map(
      (row) =>
        `| ${row.method} | ${row.forcedPairs} | ${signed(row.totalReturnPct)} | ${row.avgReturnPct.toFixed(3)}% | ${row.winRatePct.toFixed(1)}% |`,
    ),
    "",
    "## Recommendation",
    "",
    `Best dealer neutral resolver in this pass: **${bestNeutralMethod?.method ?? "n/a"}** (${signed(bestNeutralMethod?.totalReturnPct ?? 0)}, ${bestNeutralMethod?.winRatePct.toFixed(1) ?? "0.0"}% WR on ${bestNeutralMethod?.forcedPairs ?? 0} forced pairs).`,
    "",
    "This pass changes no canonical direction logic. It only measures whether enriched COT fields beat the existing lean tiebreaker on dealer-neutral FX pairs.",
    "",
  ].join("\n");

  writeFileSync(OUTPUT_PATH, markdown, "utf8");

  console.log(`Neutral pair count: ${neutralRecords.length}`);
  console.log("Dealer neutral-only comparison:");
  for (const row of neutralMethodStats) {
    console.log(
      `  ${row.method.padEnd(20)} ${String(row.forcedPairs).padStart(4)} | ${signed(row.totalReturnPct).padStart(9)} | WR ${row.winRatePct.toFixed(1).padStart(5)}%`,
    );
  }
  console.log(`Saved markdown report: ${OUTPUT_PATH}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
