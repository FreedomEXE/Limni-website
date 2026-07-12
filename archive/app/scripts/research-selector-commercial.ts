/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: research-selector-commercial.ts
 *
 * Description:
 * Focused selector-commercial research pass. Compares the live selector
 * baseline against several commercial integration roles using the canonical
 * selector context builder and ADR-normalized weekly returns.
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
  policySentimentContextOverride,
  resolveSelectorStrengthTiebreakAudit,
  type Direction,
  type PairContext,
  type PairDefWithAsset,
  type SelectorDirectionalState,
  type SelectorStrengthRelation,
  type SourceMetrics,
} from "../src/lib/performance/selectorEngine";
import type { AssetClass } from "../src/lib/cotMarkets";
import { normalizeWeekOpenUtc, getDisplayWeekOpenUtc } from "../src/lib/weekAnchor";

type VariantId =
  | "baseline_strength_tiebreak"
  | "commercial_full_voter"
  | "commercial_override"
  | "commercial_tiebreak"
  | "commercial_weighted_cot"
  | "commercial_caution_skip"
  | "commercial_strength_disagree_skip";

type VariantBreakdown = {
  changedDecisions: number;
  changedReturnPct: number;
};

type TradeRow = {
  weekOpenUtc: string;
  pair: string;
  assetClass: AssetClass;
  direction: Direction;
  returnPct: number;
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
  byAssetClass: Record<string, { trades: number; totalReturnPct: number; winRatePct: number }>;
  changedDecisions: number;
  changedReturnPct: number;
};

type VariantOutcome = {
  direction: SelectorDirectionalState;
  score: number;
  changedFromBaseline: boolean;
  branch: string;
};

const OUTPUT_PATH = "docs/SELECTOR_COMMERCIAL_RESEARCH_2026-04-05.md";
const EXTREME_THRESHOLD = 0.8;
const COMMERCIAL_OVERRIDE_THRESHOLD = 0.85;
const TARGET_ADR = getTargetAdrPct();

const VARIANT_LABELS: Record<VariantId, string> = {
  baseline_strength_tiebreak: "Baseline strength_tiebreak",
  commercial_full_voter: "Commercial full voter",
  commercial_override: "Commercial override",
  commercial_tiebreak: "Commercial tiebreak",
  commercial_weighted_cot: "Commercial weighted COT",
  commercial_caution_skip: "Commercial caution skip",
  commercial_strength_disagree_skip: "Commercial + strength disagree skip",
};

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

function sameDirection(a: SelectorDirectionalState, b: SelectorDirectionalState) {
  return a !== "NEUTRAL" && b !== "NEUTRAL" && a === b;
}

function classifyStrengthRelationLocal(
  strength: PairContext["strength"],
  proposedDirection: Direction,
): SelectorStrengthRelation {
  const score = strength.compositeScore;
  if (score === 0) return "neutral";
  const sameSign =
    (proposedDirection === "LONG" && score > 0) ||
    (proposedDirection === "SHORT" && score < 0);
  if (sameSign) {
    return Math.abs(score) >= 2 ? "strong_agree" : "agree";
  }
  return Math.abs(score) >= 2 ? "strong_disagree" : "disagree";
}

function sourceDirection(source: SourceMetrics): SelectorDirectionalState {
  return scoreDirection(source.score);
}

function chooseHighestConvictionSource(candidates: Array<{ label: string; score: number; extremity: number }>) {
  const active = candidates.filter((candidate) => Math.abs(candidate.score) > 0.000001);
  if (active.length === 0) return null;
  return [...active].sort((left, right) => {
    const leftQuality = Math.abs(left.score) * (1 - left.extremity * 0.35);
    const rightQuality = Math.abs(right.score) * (1 - right.extremity * 0.35);
    if (rightQuality !== leftQuality) return rightQuality - leftQuality;
    return Math.abs(right.score) - Math.abs(left.score);
  })[0]!;
}

function applyCommercialFullVoter(
  context: PairContext,
  previousContext: PairContext | null,
  previousWeekReturn: number | null,
  baselineDirection: Direction,
): VariantOutcome {
  const sentimentPrev = previousContext?.sentiment ?? null;
  const sentimentStrengthening =
    sentimentPrev !== null &&
    Math.sign(context.sentiment.score) === Math.sign(sentimentPrev.score) &&
    Math.abs(context.sentiment.score) > Math.abs(sentimentPrev.score) + 0.000001;
  const sentimentWeakening =
    sentimentPrev !== null &&
    Math.sign(context.sentiment.score) === Math.sign(sentimentPrev.score) &&
    Math.abs(context.sentiment.score) + 0.000001 < Math.abs(sentimentPrev.score);

  if (Math.abs(context.sentiment.score) > 0.000001) {
    if (context.sentiment.extremity < EXTREME_THRESHOLD || sentimentStrengthening) {
      return { direction: sourceDirection(context.sentiment), score: context.sentiment.score, changedFromBaseline: false, branch: "sentiment_follow" };
    }

    if (sentimentWeakening || context.sentiment.extremity >= 0.9) {
      const winner = chooseHighestConvictionSource([
        { label: "dealer", score: context.dealer.score, extremity: context.dealer.extremity },
        { label: "commercial", score: context.commercial.score, extremity: context.commercial.extremity },
        { label: "strength", score: context.strength.compositeScore / 3, extremity: Math.min(Math.abs(context.strength.compositeScore) / 3, 1) },
      ]);
      if (winner) {
        const direction = scoreDirection(winner.score);
        return {
          direction,
          score: winner.score,
          changedFromBaseline: direction !== baselineDirection,
          branch: `override_${winner.label}`,
        };
      }
    }

    return { direction: sourceDirection(context.sentiment), score: context.sentiment.score, changedFromBaseline: false, branch: "sentiment_fallback" };
  }

  const fallback = chooseHighestConvictionSource([
    { label: "dealer", score: context.dealer.score, extremity: context.dealer.extremity },
    { label: "commercial", score: context.commercial.score, extremity: context.commercial.extremity },
  ]);
  if (fallback) {
    const direction = scoreDirection(fallback.score);
    return {
      direction,
      score: fallback.score,
      changedFromBaseline: direction !== baselineDirection,
      branch: `fallback_${fallback.label}`,
    };
  }
  const defaultDirection: Direction = previousWeekReturn !== null && previousWeekReturn < 0 ? "SHORT" : "LONG";
  return {
    direction: defaultDirection,
    score: defaultDirection === "LONG" ? 0.0001 : -0.0001,
    changedFromBaseline: defaultDirection !== baselineDirection,
    branch: "fallback_previous",
  };
}

function applyCommercialOverride(
  context: PairContext,
  previousContext: PairContext | null,
  baselineDirection: Direction,
): VariantOutcome {
  const baselineDecision = policySentimentContextOverride(context, previousContext, null);
  const sentimentDirection = sourceDirection(context.sentiment);
  const commercialDirection = sourceDirection(context.commercial);

  if (
    sentimentDirection !== "NEUTRAL" &&
    commercialDirection !== "NEUTRAL" &&
    commercialDirection !== sentimentDirection &&
    context.commercial.extremity >= COMMERCIAL_OVERRIDE_THRESHOLD &&
    Math.abs(context.commercial.score) > Math.abs(context.dealer.score) * 0.9
  ) {
    return {
      direction: commercialDirection,
      score: context.commercial.score,
      changedFromBaseline: commercialDirection !== baselineDirection,
      branch: "commercial_extreme_override",
    };
  }

  return {
    direction: baselineDecision.direction,
    score: baselineDecision.score,
    changedFromBaseline: false,
    branch: "baseline",
  };
}

function applyCommercialTiebreak(
  context: PairContext,
  baselineDirection: Direction,
): VariantOutcome {
  const sentimentDirection = sourceDirection(context.sentiment);
  const dealerDirection = sourceDirection(context.dealer);
  const commercialDirection = sourceDirection(context.commercial);
  const strengthDirection = context.strength.compositeDirection;

  if (
    sentimentDirection !== "NEUTRAL" &&
    dealerDirection !== "NEUTRAL" &&
    sentimentDirection !== dealerDirection
  ) {
    const supportsSentiment = sameDirection(strengthDirection, sentimentDirection) || sameDirection(commercialDirection, sentimentDirection);
    const supportsDealer = sameDirection(strengthDirection, dealerDirection) || sameDirection(commercialDirection, dealerDirection);

    if (supportsSentiment && !supportsDealer) {
      return {
        direction: sentimentDirection,
        score: context.sentiment.score,
        changedFromBaseline: sentimentDirection !== baselineDirection,
        branch: "sentiment_supported",
      };
    }
    if (supportsDealer && !supportsSentiment) {
      return {
        direction: dealerDirection,
        score: context.dealer.score,
        changedFromBaseline: dealerDirection !== baselineDirection,
        branch: "dealer_supported",
      };
    }
    if (supportsSentiment && supportsDealer) {
      const sentimentSupport = (sameDirection(strengthDirection, sentimentDirection) ? 1 : 0) + (sameDirection(commercialDirection, sentimentDirection) ? 1 : 0);
      const dealerSupport = (sameDirection(strengthDirection, dealerDirection) ? 1 : 0) + (sameDirection(commercialDirection, dealerDirection) ? 1 : 0);
      const direction = sentimentSupport >= dealerSupport ? sentimentDirection : dealerDirection;
      const score = direction === sentimentDirection ? context.sentiment.score : context.dealer.score;
      return {
        direction,
        score,
        changedFromBaseline: direction !== baselineDirection,
        branch: "support_count",
      };
    }
  }

  return {
    direction: baselineDirection,
    score: baselineDirection === "LONG" ? 0.0001 : -0.0001,
    changedFromBaseline: false,
    branch: "baseline",
  };
}

function applyCommercialWeightedCot(
  context: PairContext,
  previousContext: PairContext | null,
  baselineDirection: Direction,
): VariantOutcome {
  const baselineDecision = policySentimentContextOverride(context, previousContext, null);
  const sentimentPrev = previousContext?.sentiment ?? null;
  const sentimentWeakening =
    sentimentPrev !== null &&
    Math.sign(context.sentiment.score) === Math.sign(sentimentPrev.score) &&
    Math.abs(context.sentiment.score) + 0.000001 < Math.abs(sentimentPrev.score);

  if (
    Math.abs(context.sentiment.score) > 0.000001 &&
    context.sentiment.extremity >= EXTREME_THRESHOLD &&
    (sentimentWeakening || context.sentiment.extremity >= 0.9)
  ) {
    const weightedCot = context.dealer.score * 1.0 + context.commercial.score * 1.25;
    if (Math.abs(weightedCot) > 0.000001) {
      const direction = scoreDirection(weightedCot);
      return {
        direction,
        score: weightedCot,
        changedFromBaseline: direction !== baselineDirection,
        branch: "weighted_cot_override",
      };
    }
  }

  return {
    direction: baselineDecision.direction,
    score: baselineDecision.score,
    changedFromBaseline: false,
    branch: "baseline",
  };
}

function applyCommercialCautionSkip(
  context: PairContext,
  baselineDirection: Direction,
): VariantOutcome {
  const commercialDirection = sourceDirection(context.commercial);
  const shouldSkip =
    commercialDirection !== "NEUTRAL" &&
    commercialDirection !== baselineDirection &&
    context.commercial.extremity >= 0.85;

  if (shouldSkip) {
    return { direction: "NEUTRAL", score: 0, changedFromBaseline: true, branch: "caution_skip" };
  }

  return {
    direction: baselineDirection,
    score: baselineDirection === "LONG" ? 0.0001 : -0.0001,
    changedFromBaseline: false,
    branch: "baseline",
  };
}

function applyCommercialStrengthDisagreeSkip(
  context: PairContext,
  baselineDirection: Direction,
): VariantOutcome {
  const commercialDirection = sourceDirection(context.commercial);
  const strengthRelation = classifyStrengthRelationLocal(context.strength, baselineDirection);
  const shouldSkip =
    commercialDirection !== "NEUTRAL" &&
    commercialDirection !== baselineDirection &&
    context.commercial.extremity >= 0.85 &&
    strengthRelation === "strong_disagree";

  if (shouldSkip) {
    return { direction: "NEUTRAL", score: 0, changedFromBaseline: true, branch: "commercial_strength_skip" };
  }

  return {
    direction: baselineDirection,
    score: baselineDirection === "LONG" ? 0.0001 : -0.0001,
    changedFromBaseline: false,
    branch: "baseline",
  };
}

function resolveVariant(
  variant: VariantId,
  context: PairContext,
  previousContext: PairContext | null,
  previousWeekReturn: number | null,
  baselineDirection: Direction,
): VariantOutcome {
  switch (variant) {
    case "baseline_strength_tiebreak":
      return {
        direction: baselineDirection,
        score: baselineDirection === "LONG" ? 0.0001 : -0.0001,
        changedFromBaseline: false,
        branch: "baseline",
      };
    case "commercial_full_voter":
      return applyCommercialFullVoter(context, previousContext, previousWeekReturn, baselineDirection);
    case "commercial_override":
      return applyCommercialOverride(context, previousContext, baselineDirection);
    case "commercial_tiebreak":
      return applyCommercialTiebreak(context, baselineDirection);
    case "commercial_weighted_cot":
      return applyCommercialWeightedCot(context, previousContext, baselineDirection);
    case "commercial_caution_skip":
      return applyCommercialCautionSkip(context, baselineDirection);
    case "commercial_strength_disagree_skip":
      return applyCommercialStrengthDisagreeSkip(context, baselineDirection);
  }
}

function buildStats(weeks: string[], trades: TradeRow[], changed: VariantBreakdown): Omit<VariantStats, "id" | "label"> {
  const weekly = new Map<string, number>();
  const byAssetClass = new Map<string, { trades: number; returnPct: number; wins: number }>();
  let wins = 0;
  let total = 0;

  for (const trade of trades) {
    weekly.set(trade.weekOpenUtc, (weekly.get(trade.weekOpenUtc) ?? 0) + trade.returnPct);
    total += trade.returnPct;
    if (trade.returnPct > 0) wins += 1;
    const assetBucket = byAssetClass.get(trade.assetClass) ?? { trades: 0, returnPct: 0, wins: 0 };
    assetBucket.trades += 1;
    assetBucket.returnPct += trade.returnPct;
    if (trade.returnPct > 0) assetBucket.wins += 1;
    byAssetClass.set(trade.assetClass, assetBucket);
  }

  const weeklyReturns = weeks.map((week) => weekly.get(week) ?? 0);
  const byAssetClassRecord: VariantStats["byAssetClass"] = {};
  for (const assetClass of ["fx", "crypto", "indices", "commodities"] as const) {
    const bucket = byAssetClass.get(assetClass) ?? { trades: 0, returnPct: 0, wins: 0 };
    byAssetClassRecord[assetClass] = {
      trades: bucket.trades,
      totalReturnPct: round(bucket.returnPct),
      winRatePct: round(bucket.trades > 0 ? (bucket.wins / bucket.trades) * 100 : 0, 1),
    };
  }

  return {
    trades: trades.length,
    totalReturnPct: round(total),
    maxDrawdownPct: computeMaxDd(weeklyReturns),
    winRatePct: round(trades.length > 0 ? (wins / trades.length) * 100 : 0, 1),
    losingWeeks: weeklyReturns.filter((value) => value < 0).length,
    tradesPerWeek: round(trades.length / weeks.length, 1),
    byAssetClass: byAssetClassRecord,
    changedDecisions: changed.changedDecisions,
    changedReturnPct: round(changed.changedReturnPct),
  };
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
  const previousWeekReturnByWeek = new Map<string, Map<string, number>>();

  for (let index = 0; index < weeks.length; index += 1) {
    const weekOpenUtc = weeks[index]!;
    const [contexts, pairReturns] = await Promise.all([
      buildContextForWeek(weekOpenUtc, universe as PairDefWithAsset[], cotHistory, sentimentBySymbol, weeks, { requireStrength: true }),
      getWeeklyPairReturns(weekOpenUtc),
    ]);
    contextsByWeek.set(weekOpenUtc, contexts);
    previousWeekReturnByWeek.set(
      weekOpenUtc,
      new Map(pairReturns.map((row) => [row.symbol.toUpperCase(), row.returnPct] as const)),
    );
  }

  const variants: VariantId[] = [
    "baseline_strength_tiebreak",
    "commercial_full_voter",
    "commercial_override",
    "commercial_tiebreak",
    "commercial_weighted_cot",
    "commercial_caution_skip",
    "commercial_strength_disagree_skip",
  ];

  const tradesByVariant = new Map<VariantId, TradeRow[]>();
  const changedByVariant = new Map<VariantId, VariantBreakdown>();
  for (const variant of variants) {
    tradesByVariant.set(variant, []);
    changedByVariant.set(variant, { changedDecisions: 0, changedReturnPct: 0 });
  }

  for (let weekIndex = 0; weekIndex < weeks.length; weekIndex += 1) {
    const weekOpenUtc = weeks[weekIndex]!;
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
      const previousContext = weekIndex > 0 ? contextsByWeek.get(weeks[weekIndex - 1]!)?.get(pair) ?? null : null;
      const previousWeekReturn = weekIndex > 0
        ? previousWeekReturnByWeek.get(weeks[weekIndex - 1]!)?.get(pair) ?? null
        : null;
      const priceRow = returnBySymbol.get(pair);
      if (!context || !priceRow || entry.finalDirection === "NEUTRAL") continue;

      const pairAdr = getAdrPct(adrMap, pair, context.assetClass);
      const baselineReturn = directionalReturn(priceRow.returnPct, entry.finalDirection) * (TARGET_ADR / pairAdr);

      for (const variant of variants) {
        const outcome = resolveVariant(
          variant,
          context,
          previousContext,
          previousWeekReturn,
          entry.finalDirection,
        );

        if (outcome.changedFromBaseline) {
          const changed = changedByVariant.get(variant)!;
          changed.changedDecisions += 1;
        }

        if (outcome.direction === "NEUTRAL") {
          const changed = changedByVariant.get(variant)!;
          changed.changedReturnPct += -baselineReturn;
          continue;
        }

        const directed = directionalReturn(priceRow.returnPct, outcome.direction) * (TARGET_ADR / pairAdr);
        tradesByVariant.get(variant)!.push({
          weekOpenUtc,
          pair,
          assetClass: context.assetClass,
          direction: outcome.direction,
          returnPct: directed,
        });

        if (outcome.direction !== entry.finalDirection) {
          const changed = changedByVariant.get(variant)!;
          changed.changedReturnPct += directed - baselineReturn;
        }
      }
    }
  }

  const results: VariantStats[] = variants.map((variant) => ({
    id: variant,
    label: VARIANT_LABELS[variant],
    ...buildStats(weeks, tradesByVariant.get(variant)!, changedByVariant.get(variant)!),
  }));

  const lines: string[] = [
    "# Selector Commercial Research",
    "",
    `Weeks analyzed: ${weeks.length} (${formatWeek(weeks[0]!)} -> ${formatWeek(weeks.at(-1)!)}).`,
    "Baseline: canonical selector strength_tiebreak.",
    "All returns ADR-normalized.",
    "",
    "## Master Comparison",
    "",
    "| Variant | Trades | Total% | MaxDD% | Win% | Losing Wks | Trades/Wk | Changed Decisions | Changed Return |",
    "| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
    ...results
      .sort((left, right) => {
        if (left.losingWeeks !== right.losingWeeks) return left.losingWeeks - right.losingWeeks;
        return right.totalReturnPct - left.totalReturnPct;
      })
      .map((row) => `| ${row.label} | ${row.trades} | ${signedPct(row.totalReturnPct)} | ${row.maxDrawdownPct.toFixed(2)}% | ${row.winRatePct.toFixed(1)}% | ${row.losingWeeks} | ${row.tradesPerWeek.toFixed(1)} | ${row.changedDecisions} | ${signedPct(row.changedReturnPct)} |`),
    "",
    "## Asset Breakdown",
    "",
  ];

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

  writeFileSync(OUTPUT_PATH, `${lines.join("\n")}\n`, "utf8");
  console.log(`Wrote ${OUTPUT_PATH}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
