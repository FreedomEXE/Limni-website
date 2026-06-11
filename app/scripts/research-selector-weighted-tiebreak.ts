/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: research-selector-weighted-tiebreak.ts
 *
 * Description:
 * Weighted commercial tiebreak research for the canonical selector.
 * Keeps the live selector baseline unchanged outside the sentiment-vs-dealer
 * conflict branch, then tests weighted strength/commercial support rules.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import { writeFileSync } from "node:fs";
import { DateTime } from "luxon";

import { listDataSectionWeeks } from "../src/lib/dataSectionWeeks";
import { getWeeklyPairReturns } from "../src/lib/pairReturns";
import { getAdrPct, getTargetAdrPct, loadWeeklyAdrMap } from "../src/lib/performance/adrLookup";
import {
  buildContextForWeek,
  buildPairUniverse,
  loadCotHistory,
  loadSentimentHistory,
  resolveSelectorStrengthTiebreakAudit,
  type Direction,
  type PairContext,
  type PairDefWithAsset,
  type SelectorDirectionalState,
  type SourceMetrics,
} from "../src/lib/performance/selectorEngine";
import type { AssetClass } from "../src/lib/cotMarkets";
import { normalizeWeekOpenUtc, getDisplayWeekOpenUtc } from "../src/lib/weekAnchor";

type VariantId =
  | "baseline"
  | "clean_equal"
  | "weighted_W1"
  | "weighted_W2"
  | "weighted_W3"
  | "weighted_W4"
  | "strength_first"
  | "dealer_bias_W1"
  | "commercial_gate_W1";

type ConflictScenario =
  | "no_conflict"
  | "St_sent_C_sent"
  | "St_sent_C_dealer"
  | "St_sent_C_neutral"
  | "St_dealer_C_sent"
  | "St_dealer_C_dealer"
  | "St_dealer_C_neutral"
  | "St_neutral_C_sent"
  | "St_neutral_C_dealer"
  | "St_neutral_C_neutral";

type WeightPack = {
  id: string;
  label: string;
  strengthWeight: number;
  commercialWeight: number;
};

type VariantOutcome = {
  direction: Direction;
  score: number;
  changedFromBaseline: boolean;
  branch: string;
  scenario: ConflictScenario;
};

type DecisionChangeRow = {
  weekOpenUtc: string;
  pair: string;
  baselineDirection: Direction;
  variantDirection: Direction;
  scenario: ConflictScenario;
  returnDeltaPct: number;
};

type ScenarioAggregate = {
  count: number;
  baselineReturnPct: number;
};

type ScenarioImpact = {
  flipsToDealer: number;
  baselineReturnPct: number;
  variantReturnPct: number;
  deltaPct: number;
};

type VariantStats = {
  id: VariantId;
  label: string;
  trades: number;
  totalReturnPct: number;
  maxDrawdownPct: number;
  winRatePct: number;
  losingWeeks: number;
  tradesPerWeek: number;
  changedDecisions: number;
  changedReturnPct: number;
  byAssetClass: Record<string, { trades: number; totalReturnPct: number; winRatePct: number }>;
};

const OUTPUT_PATH = "docs/SELECTOR_WEIGHTED_TIEBREAK_RESEARCH_2026-04-06.md";
const TARGET_ADR = getTargetAdrPct();
const COMMERCIAL_GATE_EXTREMITY = 0.8;

const WEIGHT_PACKS: WeightPack[] = [
  { id: "W1", label: "St=1.5 C=0.75", strengthWeight: 1.5, commercialWeight: 0.75 },
  { id: "W2", label: "St=2.0 C=0.75", strengthWeight: 2.0, commercialWeight: 0.75 },
  { id: "W3", label: "St=2.0 C=0.5", strengthWeight: 2.0, commercialWeight: 0.5 },
  { id: "W4", label: "St=1.5 C=0.5", strengthWeight: 1.5, commercialWeight: 0.5 },
];

const VARIANT_LABELS: Record<VariantId, string> = {
  baseline: "Baseline strength_tiebreak",
  clean_equal: "Clean equal (St=1 C=1)",
  weighted_W1: "Weighted W1 (St=1.5 C=0.75)",
  weighted_W2: "Weighted W2 (St=2.0 C=0.75)",
  weighted_W3: "Weighted W3 (St=2.0 C=0.5)",
  weighted_W4: "Weighted W4 (St=1.5 C=0.5)",
  strength_first: "Strength-first fallback",
  dealer_bias_W1: "Dealer-bias W1",
  commercial_gate_W1: "Commercial gate W1",
};

const SCENARIO_ORDER: ConflictScenario[] = [
  "St_sent_C_sent",
  "St_sent_C_dealer",
  "St_sent_C_neutral",
  "St_dealer_C_sent",
  "St_dealer_C_dealer",
  "St_dealer_C_neutral",
  "St_neutral_C_sent",
  "St_neutral_C_dealer",
  "St_neutral_C_neutral",
];

function round(value: number, digits = 2) {
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}

function signedPct(value: number, digits = 2) {
  return `${value >= 0 ? "+" : ""}${value.toFixed(digits)}%`;
}

function formatWeek(weekOpenUtc: string) {
  return DateTime.fromISO(weekOpenUtc, { zone: "utc" }).toFormat("MMM dd");
}

function directionalReturn(rawReturnPct: number, direction: Direction) {
  return direction === "SHORT" ? -rawReturnPct : rawReturnPct;
}

function computeMaxDd(weeklyReturns: number[]) {
  let cumulative = 0;
  let peak = 0;
  let maxDd = 0;
  for (const ret of weeklyReturns) {
    cumulative += ret;
    peak = Math.max(peak, cumulative);
    maxDd = Math.max(maxDd, peak - cumulative);
  }
  return round(maxDd);
}

function scoreDirection(score: number): SelectorDirectionalState {
  if (Math.abs(score) <= 0.000001) return "NEUTRAL";
  return score >= 0 ? "LONG" : "SHORT";
}

function sourceDirection(source: SourceMetrics): SelectorDirectionalState {
  return scoreDirection(source.score);
}

function sameDirection(a: SelectorDirectionalState, b: Direction): boolean {
  return a !== "NEUTRAL" && a === b;
}

function classifyScenario(
  strengthDir: SelectorDirectionalState,
  commercialDir: SelectorDirectionalState,
  sentimentDir: Direction,
  dealerDir: Direction,
): ConflictScenario {
  const stSide = sameDirection(strengthDir, sentimentDir)
    ? "sent"
    : sameDirection(strengthDir, dealerDir)
      ? "dealer"
      : "neutral";
  const cSide = sameDirection(commercialDir, sentimentDir)
    ? "sent"
    : sameDirection(commercialDir, dealerDir)
      ? "dealer"
      : "neutral";
  return `St_${stSide}_C_${cSide}` as ConflictScenario;
}

function conflictDirections(context: PairContext) {
  const sentimentDirection = sourceDirection(context.sentiment);
  const dealerDirection = sourceDirection(context.dealer);
  const commercialDirection = sourceDirection(context.commercial);
  const strengthDirection = context.strength.compositeDirection;
  const hasConflict =
    sentimentDirection !== "NEUTRAL" &&
    dealerDirection !== "NEUTRAL" &&
    sentimentDirection !== dealerDirection;

  return {
    sentimentDirection,
    dealerDirection,
    commercialDirection,
    strengthDirection,
    hasConflict,
    scenario: hasConflict
      ? classifyScenario(
          strengthDirection,
          commercialDirection,
          sentimentDirection,
          dealerDirection,
        )
      : "no_conflict" as ConflictScenario,
  };
}

function basePassThrough(
  baselineDirection: Direction,
  scenario: ConflictScenario,
): VariantOutcome {
  return {
    direction: baselineDirection,
    score: baselineDirection === "LONG" ? 0.0001 : -0.0001,
    changedFromBaseline: false,
    branch: "baseline",
    scenario,
  };
}

function applyWeightedTiebreak(
  context: PairContext,
  baselineDirection: Direction,
  weights: WeightPack,
  options?: {
    dealerBias?: boolean;
    gateCommercial?: boolean;
  },
): VariantOutcome {
  const {
    sentimentDirection,
    dealerDirection,
    commercialDirection,
    strengthDirection,
    hasConflict,
    scenario,
  } = conflictDirections(context);

  if (!hasConflict) {
    return basePassThrough(baselineDirection, scenario);
  }

  let sentimentSupport = 0;
  let dealerSupport = 0;

  if (sameDirection(strengthDirection, sentimentDirection)) sentimentSupport += weights.strengthWeight;
  else if (sameDirection(strengthDirection, dealerDirection)) dealerSupport += weights.strengthWeight;

  const commercialEnabled = !(options?.gateCommercial && context.commercial.extremity >= COMMERCIAL_GATE_EXTREMITY);
  if (commercialEnabled) {
    if (sameDirection(commercialDirection, sentimentDirection)) sentimentSupport += weights.commercialWeight;
    else if (sameDirection(commercialDirection, dealerDirection)) dealerSupport += weights.commercialWeight;
  }

  if (dealerSupport > sentimentSupport) {
    return {
      direction: dealerDirection,
      score: context.dealer.score,
      changedFromBaseline: dealerDirection !== baselineDirection,
      branch: "dealer_wins_weighted",
      scenario,
    };
  }

  if (sentimentSupport > dealerSupport) {
    return {
      direction: sentimentDirection,
      score: context.sentiment.score,
      changedFromBaseline: sentimentDirection !== baselineDirection,
      branch: "sentiment_wins_weighted",
      scenario,
    };
  }

  const tieDirection = options?.dealerBias ? dealerDirection : sentimentDirection;
  return {
    direction: tieDirection,
    score: tieDirection === dealerDirection ? context.dealer.score : context.sentiment.score,
    changedFromBaseline: tieDirection !== baselineDirection,
    branch: options?.dealerBias ? "tie_dealer_wins" : "tie_sentiment_wins",
    scenario,
  };
}

function applyStrengthFirstFallback(
  context: PairContext,
  baselineDirection: Direction,
): VariantOutcome {
  const {
    sentimentDirection,
    dealerDirection,
    commercialDirection,
    strengthDirection,
    hasConflict,
    scenario,
  } = conflictDirections(context);

  if (!hasConflict) {
    return basePassThrough(baselineDirection, scenario);
  }

  if (sameDirection(strengthDirection, sentimentDirection)) {
    return {
      direction: sentimentDirection,
      score: context.sentiment.score,
      changedFromBaseline: sentimentDirection !== baselineDirection,
      branch: "strength_sentiment",
      scenario,
    };
  }
  if (sameDirection(strengthDirection, dealerDirection)) {
    return {
      direction: dealerDirection,
      score: context.dealer.score,
      changedFromBaseline: dealerDirection !== baselineDirection,
      branch: "strength_dealer",
      scenario,
    };
  }
  if (sameDirection(commercialDirection, sentimentDirection)) {
    return {
      direction: sentimentDirection,
      score: context.sentiment.score,
      changedFromBaseline: sentimentDirection !== baselineDirection,
      branch: "commercial_fallback_sentiment",
      scenario,
    };
  }
  if (sameDirection(commercialDirection, dealerDirection)) {
    return {
      direction: dealerDirection,
      score: context.dealer.score,
      changedFromBaseline: dealerDirection !== baselineDirection,
      branch: "commercial_fallback_dealer",
      scenario,
    };
  }

  return {
    direction: sentimentDirection,
    score: context.sentiment.score,
    changedFromBaseline: sentimentDirection !== baselineDirection,
    branch: "both_neutral_fallback",
    scenario,
  };
}

function resolveVariant(
  variant: VariantId,
  context: PairContext,
  baselineDirection: Direction,
): VariantOutcome {
  switch (variant) {
    case "baseline":
      return basePassThrough(baselineDirection, conflictDirections(context).scenario);
    case "clean_equal":
      return applyWeightedTiebreak(
        context,
        baselineDirection,
        { id: "equal", label: "St=1 C=1", strengthWeight: 1, commercialWeight: 1 },
      );
    case "weighted_W1":
      return applyWeightedTiebreak(context, baselineDirection, WEIGHT_PACKS[0]!);
    case "weighted_W2":
      return applyWeightedTiebreak(context, baselineDirection, WEIGHT_PACKS[1]!);
    case "weighted_W3":
      return applyWeightedTiebreak(context, baselineDirection, WEIGHT_PACKS[2]!);
    case "weighted_W4":
      return applyWeightedTiebreak(context, baselineDirection, WEIGHT_PACKS[3]!);
    case "strength_first":
      return applyStrengthFirstFallback(context, baselineDirection);
    case "dealer_bias_W1":
      return applyWeightedTiebreak(context, baselineDirection, WEIGHT_PACKS[0]!, { dealerBias: true });
    case "commercial_gate_W1":
      return applyWeightedTiebreak(context, baselineDirection, WEIGHT_PACKS[0]!, { gateCommercial: true });
  }
}

function buildVariantStats(
  weeks: string[],
  trades: Array<{ weekOpenUtc: string; assetClass: AssetClass; returnPct: number }>,
  changedDecisions: number,
  changedReturnPct: number,
): Omit<VariantStats, "id" | "label"> {
  const weekly = new Map<string, number>();
  const byAsset = new Map<string, { trades: number; returnPct: number; wins: number }>();
  let totalReturnPct = 0;
  let wins = 0;

  for (const trade of trades) {
    weekly.set(trade.weekOpenUtc, (weekly.get(trade.weekOpenUtc) ?? 0) + trade.returnPct);
    totalReturnPct += trade.returnPct;
    if (trade.returnPct > 0) wins += 1;
    const bucket = byAsset.get(trade.assetClass) ?? { trades: 0, returnPct: 0, wins: 0 };
    bucket.trades += 1;
    bucket.returnPct += trade.returnPct;
    if (trade.returnPct > 0) bucket.wins += 1;
    byAsset.set(trade.assetClass, bucket);
  }

  const weeklyReturns = weeks.map((week) => weekly.get(week) ?? 0);
  const byAssetClass: VariantStats["byAssetClass"] = {};
  for (const assetClass of ["fx", "crypto", "indices", "commodities"] as const) {
    const bucket = byAsset.get(assetClass) ?? { trades: 0, returnPct: 0, wins: 0 };
    byAssetClass[assetClass] = {
      trades: bucket.trades,
      totalReturnPct: round(bucket.returnPct),
      winRatePct: round(bucket.trades > 0 ? (bucket.wins / bucket.trades) * 100 : 0, 1),
    };
  }

  return {
    trades: trades.length,
    totalReturnPct: round(totalReturnPct),
    maxDrawdownPct: computeMaxDd(weeklyReturns),
    winRatePct: round(trades.length > 0 ? (wins / trades.length) * 100 : 0, 1),
    losingWeeks: weeklyReturns.filter((value) => value < 0).length,
    tradesPerWeek: round(trades.length / weeks.length, 1),
    changedDecisions,
    changedReturnPct: round(changedReturnPct),
    byAssetClass,
  };
}

function assertApprox(name: string, actual: number, expected: number, tolerance = 0.01) {
  if (Math.abs(actual - expected) > tolerance) {
    throw new Error(`${name} mismatch: expected ${expected}, got ${actual}`);
  }
}

async function main() {
  const currentWeek = normalizeWeekOpenUtc(getDisplayWeekOpenUtc());
  const weeks = (await listDataSectionWeeks())
    .filter((week) => normalizeWeekOpenUtc(week) < currentWeek)
    .slice(-10);

  const [cotHistory, sentimentBySymbol, baselineAudits] = await Promise.all([
    loadCotHistory(),
    loadSentimentHistory(),
    Promise.all(weeks.map((week) => resolveSelectorStrengthTiebreakAudit(week))),
  ]);

  const universe = buildPairUniverse();
  const baselineByWeek = new Map(baselineAudits.map((audit) => [audit.weekOpenUtc, audit]));

  const contextsByWeek = new Map<string, Map<string, PairContext>>();
  for (const weekOpenUtc of weeks) {
    const contexts = await buildContextForWeek(
      weekOpenUtc,
      universe as PairDefWithAsset[],
      cotHistory,
      sentimentBySymbol,
      weeks,
      { requireStrength: true },
    );
    contextsByWeek.set(weekOpenUtc, contexts);
  }

  const variants: VariantId[] = [
    "baseline",
    "clean_equal",
    "weighted_W1",
    "weighted_W2",
    "weighted_W3",
    "weighted_W4",
    "strength_first",
    "dealer_bias_W1",
    "commercial_gate_W1",
  ];

  const tradesByVariant = new Map<VariantId, Array<{ weekOpenUtc: string; assetClass: AssetClass; returnPct: number }>>();
  const changedCountByVariant = new Map<VariantId, number>();
  const changedReturnByVariant = new Map<VariantId, number>();
  const scenarioCounts = new Map<ConflictScenario, ScenarioAggregate>();
  const scenarioImpacts = new Map<ConflictScenario, Map<VariantId, ScenarioImpact>>();
  const decisionChanges = new Map<VariantId, DecisionChangeRow[]>();

  for (const variant of variants) {
    tradesByVariant.set(variant, []);
    changedCountByVariant.set(variant, 0);
    changedReturnByVariant.set(variant, 0);
    decisionChanges.set(variant, []);
  }

  for (const weekOpenUtc of weeks) {
    const baselineAudit = baselineByWeek.get(weekOpenUtc);
    const contexts = contextsByWeek.get(weekOpenUtc);
    const pairReturns = await getWeeklyPairReturns(weekOpenUtc);
    const returnBySymbol = new Map(pairReturns.map((row) => [row.symbol.toUpperCase(), row] as const));
    const adrMap = await loadWeeklyAdrMap(weekOpenUtc);

    if (!baselineAudit || !contexts) {
      throw new Error(`Missing selector baseline context for ${weekOpenUtc}`);
    }

    for (const entry of baselineAudit.entries) {
      const pair = entry.pair.toUpperCase();
      const context = contexts.get(pair);
      const priceRow = returnBySymbol.get(pair);
      if (!context || !priceRow || entry.finalDirection === "NEUTRAL") continue;

      const pairAdr = getAdrPct(adrMap, pair, context.assetClass);
      const adrMultiplier = TARGET_ADR / pairAdr;
      const baselineReturnPct = directionalReturn(priceRow.returnPct, entry.finalDirection) * adrMultiplier;

      const conflict = conflictDirections(context);
      if (conflict.scenario !== "no_conflict") {
        const aggregate = scenarioCounts.get(conflict.scenario) ?? { count: 0, baselineReturnPct: 0 };
        aggregate.count += 1;
        aggregate.baselineReturnPct += baselineReturnPct;
        scenarioCounts.set(conflict.scenario, aggregate);
      }

      for (const variant of variants) {
        const outcome = resolveVariant(variant, context, entry.finalDirection);
        const returnPct = directionalReturn(priceRow.returnPct, outcome.direction) * adrMultiplier;
        tradesByVariant.get(variant)!.push({
          weekOpenUtc,
          assetClass: context.assetClass,
          returnPct,
        });

        if (outcome.changedFromBaseline) {
          changedCountByVariant.set(variant, (changedCountByVariant.get(variant) ?? 0) + 1);
          changedReturnByVariant.set(
            variant,
            (changedReturnByVariant.get(variant) ?? 0) + (returnPct - baselineReturnPct),
          );
          decisionChanges.get(variant)!.push({
            weekOpenUtc,
            pair,
            baselineDirection: entry.finalDirection,
            variantDirection: outcome.direction,
            scenario: outcome.scenario,
            returnDeltaPct: round(returnPct - baselineReturnPct),
          });
        }

        if (outcome.scenario !== "no_conflict") {
          const impactByVariant = scenarioImpacts.get(outcome.scenario) ?? new Map<VariantId, ScenarioImpact>();
          const currentImpact = impactByVariant.get(variant) ?? {
            flipsToDealer: 0,
            baselineReturnPct: 0,
            variantReturnPct: 0,
            deltaPct: 0,
          };
          const dealerDirection = conflict.dealerDirection;
          if (outcome.direction === dealerDirection && outcome.direction !== entry.finalDirection) {
            currentImpact.flipsToDealer += 1;
          }
          currentImpact.baselineReturnPct += baselineReturnPct;
          currentImpact.variantReturnPct += returnPct;
          currentImpact.deltaPct += returnPct - baselineReturnPct;
          impactByVariant.set(variant, currentImpact);
          scenarioImpacts.set(outcome.scenario, impactByVariant);
        }
      }
    }
  }

  const results: VariantStats[] = variants.map((variant) => ({
    id: variant,
    label: VARIANT_LABELS[variant],
    ...buildVariantStats(
      weeks,
      tradesByVariant.get(variant)!,
      changedCountByVariant.get(variant) ?? 0,
      changedReturnByVariant.get(variant) ?? 0,
    ),
  }));

  const baseline = results.find((row) => row.id === "baseline")!;
  assertApprox("baseline trades", baseline.trades, 360, 0);
  assertApprox("baseline total", baseline.totalReturnPct, 91.96);
  assertApprox("baseline dd", baseline.maxDrawdownPct, 4.01);
  assertApprox("baseline win", baseline.winRatePct, 54.2, 0.1);
  assertApprox("baseline losing weeks", baseline.losingWeeks, 1, 0);

  const cleanEqual = results.find((row) => row.id === "clean_equal")!;
  assertApprox("clean equal trades", cleanEqual.trades, 360, 0);
  assertApprox("clean equal total", cleanEqual.totalReturnPct, 88.49);
  assertApprox("clean equal dd", cleanEqual.maxDrawdownPct, 1.91);
  assertApprox("clean equal win", cleanEqual.winRatePct, 58.9, 0.1);
  assertApprox("clean equal losing weeks", cleanEqual.losingWeeks, 2, 0);
  assertApprox("clean equal changed decisions", cleanEqual.changedDecisions, 75, 0);

  for (const result of results) {
    assertApprox(`${result.id} trades`, result.trades, 360, 0);
  }

  const totalConflictRows = Array.from(scenarioCounts.values()).reduce((sum, row) => sum + row.count, 0);

  const lines: string[] = [
    "# Selector Weighted Tiebreak Research",
    "",
    `Weeks analyzed: ${weeks.length} (${formatWeek(weeks[0]!)} -> ${formatWeek(weeks.at(-1)!)}).`,
    "Baseline: canonical selector strength_tiebreak.",
    "All returns ADR-normalized.",
    "",
    "## Conflict Scenario Distribution",
    "",
    `Total conflict pair-weeks: ${totalConflictRows} / ${baseline.trades}`,
    "",
    "| Scenario | Count | % of Conflicts | Baseline Return | Notes |",
    "| --- | ---: | ---: | ---: | --- |",
    ...SCENARIO_ORDER.map((scenario) => {
      const row = scenarioCounts.get(scenario) ?? { count: 0, baselineReturnPct: 0 };
      const pct = totalConflictRows > 0 ? (row.count / totalConflictRows) * 100 : 0;
      return `| ${scenario} | ${row.count} | ${pct.toFixed(1)}% | ${signedPct(round(row.baselineReturnPct))} | ${scenario.replaceAll("_", " ")} |`;
    }),
    "",
  ];

  for (const scenario of SCENARIO_ORDER) {
    const row = scenarioCounts.get(scenario);
    const impacts = scenarioImpacts.get(scenario);
    if (!row || row.count === 0 || !impacts) continue;
    const variantRows = variants
      .map((variant) => ({ variant, impact: impacts.get(variant) }))
      .filter((entry) => entry.impact && Math.abs(entry.impact.deltaPct) > 0.000001);
    if (variantRows.length === 0) continue;

    lines.push(`## Scenario Impact: ${scenario}`);
    lines.push("");
    lines.push(`Baseline: ${signedPct(round(row.baselineReturnPct))} across ${row.count} conflict pair-weeks.`);
    lines.push("");
    lines.push("| Variant | Flips to Dealer | Baseline Return | Variant Return | Delta |");
    lines.push("| --- | ---: | ---: | ---: | ---: |");
    for (const { variant, impact } of variantRows) {
      lines.push(`| ${VARIANT_LABELS[variant]} | ${impact!.flipsToDealer} | ${signedPct(round(impact!.baselineReturnPct))} | ${signedPct(round(impact!.variantReturnPct))} | ${signedPct(round(impact!.deltaPct))} |`);
    }
    lines.push("");
  }

  lines.push("## Master Comparison");
  lines.push("");
  lines.push("| Variant | Trades | Total% | MaxDD% | Win% | Losing Wks | Trades/Wk | Changed Decisions | Changed Return |");
  lines.push("| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |");
  for (const result of [...results].sort((a, b) => {
    if (a.losingWeeks !== b.losingWeeks) return a.losingWeeks - b.losingWeeks;
    return b.totalReturnPct - a.totalReturnPct;
  })) {
    lines.push(`| ${result.label} | ${result.trades} | ${signedPct(result.totalReturnPct)} | ${result.maxDrawdownPct.toFixed(2)}% | ${result.winRatePct.toFixed(1)}% | ${result.losingWeeks} | ${result.tradesPerWeek.toFixed(1)} | ${result.changedDecisions} | ${signedPct(result.changedReturnPct)} |`);
  }
  lines.push("");

  lines.push("## Asset Breakdown");
  lines.push("");
  for (const result of results) {
    lines.push(`### ${result.label}`);
    lines.push("");
    lines.push("| Asset Class | Trades | Total% | Win% |");
    lines.push("| --- | ---: | ---: | ---: |");
    for (const assetClass of ["fx", "crypto", "indices", "commodities"] as const) {
      const row = result.byAssetClass[assetClass];
      lines.push(`| ${assetClass} | ${row.trades} | ${signedPct(row.totalReturnPct)} | ${row.winRatePct.toFixed(1)}% |`);
    }
    lines.push("");
  }

  for (const variant of variants.filter((id) => id !== "baseline")) {
    const changes = decisionChanges.get(variant) ?? [];
    lines.push(`## Decision Changes: ${variant}`);
    lines.push("");
    lines.push("| Week | Pair | Baseline Dir | Variant Dir | Scenario | Return Delta |");
    lines.push("| --- | --- | --- | --- | --- | ---: |");
    for (const row of changes.sort((a, b) => {
      if (a.weekOpenUtc !== b.weekOpenUtc) return a.weekOpenUtc.localeCompare(b.weekOpenUtc);
      return a.pair.localeCompare(b.pair);
    })) {
      lines.push(`| ${row.weekOpenUtc.slice(0, 10)} | ${row.pair} | ${row.baselineDirection} | ${row.variantDirection} | ${row.scenario} | ${signedPct(row.returnDeltaPct)} |`);
    }
    lines.push("");
  }

  writeFileSync(OUTPUT_PATH, `${lines.join("\n")}\n`, "utf8");
  console.log(`Wrote ${OUTPUT_PATH}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
