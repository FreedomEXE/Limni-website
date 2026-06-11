/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: research-cot-full-book.ts
 *
 * Description:
 * Full-book COT enrichment research for FX. Tests participant-group
 * enrichment as a quality layer across dealer non-neutral trades,
 * dealer neutral resolution, commercial forced-raw filtering, and
 * cross-category agreement structures.
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
import type { MarketSnapshot } from "../src/lib/cotTypes";
import { getDisplayWeekOpenUtc, normalizeWeekOpenUtc } from "../src/lib/weekAnchor";

const OUTPUT_PATH = "docs/COT_FULL_BOOK_RESEARCH_RESULTS_2026-04-04.md";

type TradeDirection = "LONG" | "SHORT";

type CurrencyRow = {
  weekLabel: string;
  currency: string;
  dealerNet: number;
  assetMgrNet: number | null;
  levMoneyNet: number | null;
  nonreptNet: number | null;
  commercialNet: number | null;
  dealerDeltaNet: number | null;
  assetMgrDeltaNet: number | null;
  levMoneyDeltaNet: number | null;
};

type FxPairWeekRow = {
  weekOpenUtc: string;
  weekLabel: string;
  pair: string;
  base: string;
  quote: string;
  rawReturnPct: number;
  adrMultiplier: number;
  dealerDirection: TradeDirection | null;
  dealerLeanDirection: TradeDirection | null;
  dealerDeltaDirection: TradeDirection | null;
  dealerOiConfirmedDirection: TradeDirection | null;
  commercialDirection: TradeDirection | null;
  commercialDeltaDirection: TradeDirection | null;
  assetMgrDirection: TradeDirection | null;
  levMoneyDirection: TradeDirection | null;
  otherReptDirection: TradeDirection | null;
  nonreptDirection: TradeDirection | null;
  pairOiDelta: number | null;
};

type AggregateStats = {
  label: string;
  pairs: number;
  totalReturnPct: number;
  winRatePct: number;
  avgReturnPct: number;
};

function weekLabel(weekOpenUtc: string) {
  return DateTime.fromISO(weekOpenUtc, { zone: "utc" }).toFormat("MMM dd");
}

function round(value: number, digits = 2) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function signed(value: number, digits = 2) {
  return `${value >= 0 ? "+" : ""}${value.toFixed(digits)}%`;
}

function directionFromScore(score: number | null | undefined): TradeDirection | null {
  if (typeof score !== "number" || !Number.isFinite(score)) {
    return null;
  }
  if (score > 0) {
    return "LONG";
  }
  if (score < 0) {
    return "SHORT";
  }
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

function oiConfirmedDealerDirection(base: MarketSnapshot, quote: MarketSnapshot): TradeDirection | null {
  const score = pairScore(base, quote, (market) => market.dealer_delta_net);
  const dir = directionFromScore(score);
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
    return baseConfirmed || quoteConfirmed ? dir : null;
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
  return baseConfirmed || quoteConfirmed ? dir : null;
}

function evaluateStats(
  rows: FxPairWeekRow[],
  predicate: (row: FxPairWeekRow) => boolean,
  directionGetter: (row: FxPairWeekRow) => TradeDirection | null,
  label: string,
): AggregateStats {
  let pairs = 0;
  let wins = 0;
  let totalReturnPct = 0;

  for (const row of rows) {
    if (!predicate(row)) {
      continue;
    }
    const dir = directionGetter(row);
    if (!dir) {
      continue;
    }
    const ret = (dir === "SHORT" ? -row.rawReturnPct : row.rawReturnPct) * row.adrMultiplier;
    totalReturnPct += ret;
    pairs += 1;
    if (ret > 0) {
      wins += 1;
    }
  }

  return {
    label,
    pairs,
    totalReturnPct: round(totalReturnPct),
    winRatePct: pairs > 0 ? round((wins / pairs) * 100, 1) : 0,
    avgReturnPct: pairs > 0 ? round(totalReturnPct / pairs, 3) : 0,
  };
}

async function loadFxDataset() {
  const currentWeekOpenUtc = getDisplayWeekOpenUtc();
  const weeks = (await listDataSectionWeeks())
    .sort((left, right) => left.localeCompare(right))
    .filter((weekOpenUtc) => weekOpenUtc < currentWeekOpenUtc);

  const targetAdr = getTargetAdrPct();
  const currencyRows: CurrencyRow[] = [];
  const pairRows: FxPairWeekRow[] = [];

  for (const rawWeekOpenUtc of weeks) {
    const weekOpenUtc = normalizeWeekOpenUtc(rawWeekOpenUtc) ?? rawWeekOpenUtc;
    const reportDate = deriveCotReportDate(weekOpenUtc);
    const snapshot = await readSnapshot({ assetClass: "fx", reportDate });
    if (!snapshot) {
      throw new Error(`Missing FX snapshot for ${reportDate}`);
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
      currencyRows.push({
        weekLabel: weekLabel(weekOpenUtc),
        currency,
        dealerNet: market.dealer_net,
        assetMgrNet: market.asset_mgr_net ?? null,
        levMoneyNet: market.lev_money_net ?? null,
        nonreptNet: market.nonrept_net ?? null,
        commercialNet: market.commercial_net ?? null,
        dealerDeltaNet: market.dealer_delta_net ?? null,
        assetMgrDeltaNet: market.asset_mgr_delta_net ?? null,
        levMoneyDeltaNet: market.lev_money_delta_net ?? null,
      });
    }

    for (const pairDef of PAIRS_BY_ASSET_CLASS.fx) {
      const pair = pairDef.pair.toUpperCase();
      const base = snapshot.currencies[pairDef.base];
      const quote = snapshot.currencies[pairDef.quote];
      const ret = returnMap.get(pair);

      if (!base || !quote || !ret) {
        continue;
      }

      pairRows.push({
        weekOpenUtc,
        weekLabel: weekLabel(weekOpenUtc),
        pair,
        base: pairDef.base,
        quote: pairDef.quote,
        rawReturnPct: ret.returnPct,
        adrMultiplier: ret.adrMultiplier,
        dealerDirection:
          dealerPairs[pair]?.direction === "LONG" || dealerPairs[pair]?.direction === "SHORT"
            ? dealerPairs[pair]!.direction
            : null,
        dealerLeanDirection: directionFromScore(pairScore(base, quote, (market) => market.dealer_net)),
        dealerDeltaDirection: directionFromScore(pairScore(base, quote, (market) => market.dealer_delta_net)),
        dealerOiConfirmedDirection: oiConfirmedDealerDirection(base, quote),
        commercialDirection: directionFromScore(pairScore(base, quote, (market) => market.commercial_net)),
        commercialDeltaDirection: directionFromScore(
          pairScore(base, quote, (market) => market.commercial_delta_net),
        ),
        assetMgrDirection: directionFromScore(pairScore(base, quote, (market) => market.asset_mgr_net)),
        levMoneyDirection: directionFromScore(pairScore(base, quote, (market) => market.lev_money_net)),
        otherReptDirection: directionFromScore(pairScore(base, quote, (market) => market.other_rept_net)),
        nonreptDirection: directionFromScore(pairScore(base, quote, (market) => market.nonrept_net)),
        pairOiDelta:
          typeof base.oi_delta === "number" || typeof quote.oi_delta === "number"
            ? (base.oi_delta ?? 0) + (quote.oi_delta ?? 0)
            : null,
      });
    }
  }

  return { weeks, currencyRows, pairRows };
}

async function main() {
  console.log("╔══════════════════════════════════════════════════════════════════╗");
  console.log("║   COT Full Book Research                                       ║");
  console.log("╚══════════════════════════════════════════════════════════════════╝");

  const { weeks, currencyRows, pairRows } = await loadFxDataset();
  const dealerNonNeutral = pairRows.filter((row) => row.dealerDirection !== null);
  const dealerNeutral = pairRows.filter((row) => row.dealerDirection === null);
  const commercialAll = pairRows.filter((row) => row.commercialDirection !== null);

  const dealerBaseline = evaluateStats(
    dealerNonNeutral,
    () => true,
    (row) => row.dealerDirection,
    "All non-neutral (baseline)",
  );

  const sectionB = [
    dealerBaseline,
    evaluateStats(
      dealerNonNeutral,
      (row) => row.dealerDeltaDirection === row.dealerDirection,
      (row) => row.dealerDirection,
      "Delta confirms",
    ),
    evaluateStats(
      dealerNonNeutral,
      (row) =>
        row.dealerDeltaDirection !== null && row.dealerDeltaDirection !== row.dealerDirection,
      (row) => row.dealerDirection,
      "Delta contradicts",
    ),
    evaluateStats(
      dealerNonNeutral,
      (row) => typeof row.pairOiDelta === "number" && row.pairOiDelta > 0,
      (row) => row.dealerDirection,
      "OI expanding",
    ),
    evaluateStats(
      dealerNonNeutral,
      (row) => typeof row.pairOiDelta === "number" && row.pairOiDelta < 0,
      (row) => row.dealerDirection,
      "OI contracting",
    ),
    evaluateStats(
      dealerNonNeutral,
      (row) => row.assetMgrDirection === row.dealerDirection,
      (row) => row.dealerDirection,
      "Asset mgr agrees",
    ),
    evaluateStats(
      dealerNonNeutral,
      (row) => row.assetMgrDirection !== null && row.assetMgrDirection !== row.dealerDirection,
      (row) => row.dealerDirection,
      "Asset mgr disagrees",
    ),
    evaluateStats(
      dealerNonNeutral,
      (row) => row.levMoneyDirection === row.dealerDirection,
      (row) => row.dealerDirection,
      "Lev money agrees",
    ),
    evaluateStats(
      dealerNonNeutral,
      (row) => row.levMoneyDirection !== null && row.levMoneyDirection !== row.dealerDirection,
      (row) => row.dealerDirection,
      "Lev money disagrees",
    ),
    evaluateStats(
      dealerNonNeutral,
      (row) => row.nonreptDirection !== null && row.nonreptDirection !== row.dealerDirection,
      (row) => row.dealerDirection,
      "Retail contrarian",
    ),
    evaluateStats(
      dealerNonNeutral,
      (row) =>
        row.dealerDeltaDirection === row.dealerDirection &&
        typeof row.pairOiDelta === "number" &&
        row.pairOiDelta > 0,
      (row) => row.dealerDirection,
      "Delta confirms + OI expanding",
    ),
    evaluateStats(
      dealerNonNeutral,
      (row) =>
        row.dealerDeltaDirection === row.dealerDirection &&
        row.assetMgrDirection === row.dealerDirection,
      (row) => row.dealerDirection,
      "Delta confirms + AM agrees",
    ),
    evaluateStats(
      dealerNonNeutral,
      (row) =>
        row.dealerDeltaDirection !== null &&
        row.dealerDeltaDirection !== row.dealerDirection &&
        row.levMoneyDirection === row.dealerDirection,
      (row) => row.dealerDirection,
      "Delta contradicts + LM agrees",
    ),
  ];

  const dealerNeutralBaseline = evaluateStats(
    dealerNeutral,
    () => true,
    (row) => row.dealerLeanDirection,
    "Current lean (baseline)",
  );

  const sectionC = [
    dealerNeutralBaseline,
    evaluateStats(dealerNeutral, () => true, (row) => row.dealerDeltaDirection, "Delta-based"),
    evaluateStats(
      dealerNeutral,
      () => true,
      (row) => row.dealerOiConfirmedDirection,
      "OI-confirmed delta",
    ),
    evaluateStats(
      dealerNeutral,
      () => true,
      (row) => row.assetMgrDirection,
      "Asset mgr direction",
    ),
    evaluateStats(
      dealerNeutral,
      () => true,
      (row) =>
        row.levMoneyDirection === null
          ? null
          : row.levMoneyDirection === "LONG"
            ? "SHORT"
            : "LONG",
      "Lev money contrarian",
    ),
    evaluateStats(
      dealerNeutral,
      (row) =>
        row.dealerDeltaDirection !== null &&
        row.assetMgrDirection !== null &&
        row.dealerDeltaDirection === row.assetMgrDirection,
      (row) => row.dealerDeltaDirection,
      "AM + dealer delta agreement",
    ),
    evaluateStats(
      dealerNeutral,
      (row) =>
        row.dealerOiConfirmedDirection !== null &&
        row.assetMgrDirection !== null &&
        row.dealerOiConfirmedDirection === row.assetMgrDirection,
      (row) => row.dealerOiConfirmedDirection,
      "OI-confirmed delta + AM agrees",
    ),
    evaluateStats(
      dealerNeutral,
      () => true,
      (row) =>
        row.dealerLeanDirection === null
          ? null
          : row.dealerLeanDirection === "LONG"
            ? "SHORT"
            : "LONG",
      "Inverted lean",
    ),
  ];

  const commercialBaseline = evaluateStats(
    commercialAll,
    () => true,
    (row) => row.commercialDirection,
    "Forced raw (current baseline)",
  );

  const sectionD = [
    commercialBaseline,
    evaluateStats(
      commercialAll,
      (row) => row.commercialDeltaDirection === row.commercialDirection,
      (row) => row.commercialDirection,
      "Delta confirms",
    ),
    evaluateStats(
      commercialAll,
      (row) =>
        row.commercialDeltaDirection !== null &&
        row.commercialDeltaDirection !== row.commercialDirection,
      (row) => row.commercialDirection,
      "Delta contradicts",
    ),
    evaluateStats(
      commercialAll,
      (row) => typeof row.pairOiDelta === "number" && row.pairOiDelta > 0,
      (row) => row.commercialDirection,
      "OI expanding",
    ),
    evaluateStats(
      commercialAll,
      (row) => row.assetMgrDirection === row.commercialDirection,
      (row) => row.commercialDirection,
      "AM agrees with forced-raw dir",
    ),
    evaluateStats(
      commercialAll,
      (row) => row.levMoneyDirection !== null && row.levMoneyDirection !== row.commercialDirection,
      (row) => row.commercialDirection,
      "LM disagrees (contrarian)",
    ),
    evaluateStats(
      commercialAll,
      (row) =>
        row.commercialDeltaDirection === row.commercialDirection &&
        typeof row.pairOiDelta === "number" &&
        row.pairOiDelta > 0,
      (row) => row.commercialDirection,
      "Delta confirms + OI expanding",
    ),
  ];

  const sectionE = [
    dealerBaseline,
    evaluateStats(
      dealerNonNeutral,
      (row) => row.assetMgrDirection === row.dealerDirection,
      (row) => row.dealerDirection,
      "Dealer + AM agree",
    ),
    evaluateStats(
      dealerNonNeutral,
      (row) =>
        row.assetMgrDirection === row.dealerDirection &&
        row.commercialDirection === row.dealerDirection,
      (row) => row.dealerDirection,
      "Dealer + AM + Comm agree",
    ),
    evaluateStats(
      dealerNonNeutral,
      (row) =>
        row.assetMgrDirection === row.dealerDirection &&
        row.levMoneyDirection !== null &&
        row.levMoneyDirection !== row.dealerDirection,
      (row) => row.dealerDirection,
      "Dealer + AM agree + LM disagree",
    ),
    evaluateStats(
      dealerNonNeutral,
      (row) =>
        row.assetMgrDirection === row.dealerDirection &&
        row.nonreptDirection !== null &&
        row.nonreptDirection !== row.dealerDirection,
      (row) => row.dealerDirection,
      "Dealer + AM agree + retail opposes",
    ),
    evaluateStats(
      dealerNonNeutral,
      (row) =>
        row.assetMgrDirection === row.dealerDirection &&
        row.commercialDirection === row.dealerDirection &&
        row.otherReptDirection === row.dealerDirection,
      (row) => row.dealerDirection,
      "All smart money agree (D+AM+Comm+Other)",
    ),
    evaluateStats(
      dealerNonNeutral,
      (row) =>
        row.assetMgrDirection === row.dealerDirection &&
        row.commercialDirection === row.dealerDirection &&
        row.otherReptDirection === row.dealerDirection &&
        row.levMoneyDirection !== null &&
        row.levMoneyDirection !== row.dealerDirection &&
        row.nonreptDirection !== null &&
        row.nonreptDirection !== row.dealerDirection,
      (row) => row.dealerDirection,
      "Smart money agree + dumb opposes",
    ),
  ];

  const bestNonNeutral = [...sectionB.slice(1)].sort(
    (left, right) => right.avgReturnPct - left.avgReturnPct,
  )[0];
  const bestNeutral = [...sectionC.slice(1)].sort(
    (left, right) => right.totalReturnPct - left.totalReturnPct,
  )[0];
  const bestCommercial = [...sectionD.slice(1)].sort(
    (left, right) => right.avgReturnPct - left.avgReturnPct,
  )[0];
  const bestCross = [...sectionE.slice(1)].sort(
    (left, right) => right.avgReturnPct - left.avgReturnPct,
  )[0];

  const markdown = [
    "# COT Full Book Research Results",
    "",
    `Date: ${DateTime.now().toISODate()}`,
    "",
    `Weeks analyzed: ${weeks.length} (${weekLabel(weeks[0]!)} → ${weekLabel(weeks.at(-1)!)}), FX only, ADR-normalized.`,
    "",
    "## Section A — Participant Group Summary",
    "",
    "| Week | CCY | Dealer_Net | AM_Net | LM_Net | NonR_Net | Comm_Net | D_Δ_Net | AM_Δ_Net | LM_Δ_Net |",
    "|---|---|---:|---:|---:|---:|---:|---:|---:|---:|",
    ...currencyRows.map(
      (row) =>
        `| ${row.weekLabel} | ${row.currency} | ${row.dealerNet} | ${row.assetMgrNet ?? "—"} | ${row.levMoneyNet ?? "—"} | ${row.nonreptNet ?? "—"} | ${row.commercialNet ?? "—"} | ${row.dealerDeltaNet ?? "—"} | ${row.assetMgrDeltaNet ?? "—"} | ${row.levMoneyDeltaNet ?? "—"} |`,
    ),
    "",
    "## Section B — Dealer Non-Neutral Signal Quality",
    "",
    "| Filter | Pairs | Total% | Win% | Avg% | vs Unfiltered |",
    "|---|---:|---:|---:|---:|---:|",
    ...sectionB.map(
      (row) =>
        `| ${row.label} | ${row.pairs} | ${signed(row.totalReturnPct)} | ${row.winRatePct.toFixed(1)}% | ${row.avgReturnPct.toFixed(3)}% | ${
          row.label === dealerBaseline.label
            ? "—"
            : signed(row.totalReturnPct - dealerBaseline.totalReturnPct)
        } |`,
    ),
    "",
    "## Section C — Dealer Neutral Resolution (Expanded)",
    "",
    "| Method | Forced Pairs | Total% | Win% | Avg% | vs Lean Baseline |",
    "|---|---:|---:|---:|---:|---:|",
    ...sectionC.map(
      (row) =>
        `| ${row.label} | ${row.pairs} | ${signed(row.totalReturnPct)} | ${row.winRatePct.toFixed(1)}% | ${row.avgReturnPct.toFixed(3)}% | ${
          row.label === dealerNeutralBaseline.label
            ? "—"
            : signed(row.totalReturnPct - dealerNeutralBaseline.totalReturnPct)
        } |`,
    ),
    "",
    "## Section D — Commercial Enrichment (Full Book)",
    "",
    "| Method | Pairs | Total% | Win% | Avg% | vs Forced Raw |",
    "|---|---:|---:|---:|---:|---:|",
    ...sectionD.map(
      (row) =>
        `| ${row.label} | ${row.pairs} | ${signed(row.totalReturnPct)} | ${row.winRatePct.toFixed(1)}% | ${row.avgReturnPct.toFixed(3)}% | ${
          row.label === commercialBaseline.label
            ? "—"
            : signed(row.totalReturnPct - commercialBaseline.totalReturnPct)
        } |`,
    ),
    "",
    "## Section E — Cross-Category Signals",
    "",
    "| Agreement Level | Pairs | Total% | Win% | Avg% |",
    "|---|---:|---:|---:|---:|",
    ...sectionE.map(
      (row) =>
        `| ${row.label} | ${row.pairs} | ${signed(row.totalReturnPct)} | ${row.winRatePct.toFixed(1)}% | ${row.avgReturnPct.toFixed(3)}% |`,
    ),
    "",
    "## Summary",
    "",
    `1. Non-neutral dealer quality: strongest filter in this pass was **${bestNonNeutral?.label ?? "n/a"}** (${signed(bestNonNeutral?.totalReturnPct ?? 0)}, ${bestNonNeutral?.winRatePct.toFixed(1) ?? "0.0"}% WR, ${bestNonNeutral?.pairs ?? 0} pairs).`,
    `2. Neutral dealer resolution: strongest method in this pass was **${bestNeutral?.label ?? "n/a"}** (${signed(bestNeutral?.totalReturnPct ?? 0)}, ${bestNeutral?.winRatePct.toFixed(1) ?? "0.0"}% WR, ${bestNeutral?.pairs ?? 0} forced pairs).`,
    `3. Commercial enrichment beyond forced raw: best commercial filter was **${bestCommercial?.label ?? "n/a"}** (${signed(bestCommercial?.totalReturnPct ?? 0)} vs baseline ${signed(commercialBaseline.totalReturnPct)}).`,
    `4. Cross-category structure: strongest combination was **${bestCross?.label ?? "n/a"}** (${signed(bestCross?.totalReturnPct ?? 0)}, ${bestCross?.winRatePct.toFixed(1) ?? "0.0"}% WR).`,
    `5. Most promising canonical upgrade candidate from this pass: **${bestNeutral?.label ?? "n/a"}** for dealer neutral resolution, unless a non-neutral dealer filter clearly dominates on robustness as more data accumulates.`,
    "",
  ].join("\n");

  writeFileSync(OUTPUT_PATH, markdown, "utf8");

  console.log(`Dealer non-neutral rows: ${dealerNonNeutral.length}`);
  console.log(`Dealer neutral rows: ${dealerNeutral.length}`);
  console.log(`Commercial rows: ${commercialAll.length}`);
  console.log(`Saved markdown report: ${OUTPUT_PATH}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
