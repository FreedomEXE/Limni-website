/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: research-selector-commercial-gates.ts
 *
 * Description:
 * Focused selector-commercial research pass for narrow commercial roles:
 * commercial acts only as a quality gate on dealer-led selector decisions.
 * Baseline stays the live selector (strength_tiebreak).
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
  type SelectorAuditEntry,
  type SelectorDirectionalState,
  type SourceMetrics,
} from "../src/lib/performance/selectorEngine";
import type { AssetClass } from "../src/lib/cotMarkets";
import { getDisplayWeekOpenUtc, normalizeWeekOpenUtc } from "../src/lib/weekAnchor";

type VariantId =
  | "baseline_strength_tiebreak"
  | "comm_gate_strict"
  | "comm_gate_soft"
  | "comm_gate_override_only"
  | "comm_gate_require_confirmation";

type VariantOutcome = {
  direction: SelectorDirectionalState;
  changedFromBaseline: boolean;
  branch: string;
};

type TradeRow = {
  weekOpenUtc: string;
  pair: string;
  assetClass: AssetClass;
  direction: Direction;
  returnPct: number;
};

type VariantBreakdown = {
  changedDecisions: number;
  changedReturnPct: number;
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

type ConflictSlice = {
  label: string;
  count: number;
  totalReturnPct: number;
  winRatePct: number;
};

const OUTPUT_PATH = "docs/SELECTOR_COMMERCIAL_GATE_RESEARCH_2026-04-06.md";
const TARGET_ADR = getTargetAdrPct();
const COMMERCIAL_GATE_THRESHOLD = 0.8;

const VARIANT_LABELS: Record<VariantId, string> = {
  baseline_strength_tiebreak: "Baseline strength_tiebreak",
  comm_gate_strict: "Comm Gate Strict",
  comm_gate_soft: "Comm Gate Soft",
  comm_gate_override_only: "Comm Gate Override-Only",
  comm_gate_require_confirmation: "Comm Require Confirmation",
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

function scoreDirection(score: number): SelectorDirectionalState {
  if (Math.abs(score) <= 0.000001) return "NEUTRAL";
  return score >= 0 ? "LONG" : "SHORT";
}

function sourceDirection(source: SourceMetrics): SelectorDirectionalState {
  return scoreDirection(source.score);
}

function sameDirection(a: SelectorDirectionalState, b: SelectorDirectionalState) {
  return a !== "NEUTRAL" && b !== "NEUTRAL" && a === b;
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

function isDealerSideConflict(context: PairContext, baselineDirection: Direction) {
  const sentimentDirection = sourceDirection(context.sentiment);
  const dealerDirection = sourceDirection(context.dealer);
  return (
    sentimentDirection !== "NEUTRAL"
    && dealerDirection !== "NEUTRAL"
    && sentimentDirection !== dealerDirection
    && baselineDirection === dealerDirection
  );
}

function commercialOpposesDirection(
  context: PairContext,
  direction: Direction,
  threshold = COMMERCIAL_GATE_THRESHOLD,
) {
  const commercialDirection = sourceDirection(context.commercial);
  return (
    commercialDirection !== "NEUTRAL"
    && commercialDirection !== direction
    && context.commercial.extremity >= threshold
  );
}

function applyCommercialGateStrict(
  entry: SelectorAuditEntry,
  context: PairContext,
): VariantOutcome {
  const sentimentDirection = sourceDirection(context.sentiment);
  if (
    isDealerSideConflict(context, entry.finalDirection)
    && commercialOpposesDirection(context, entry.finalDirection)
  ) {
    return {
      direction: sentimentDirection,
      changedFromBaseline: sentimentDirection !== entry.finalDirection,
      branch: "revert_to_sentiment",
    };
  }

  return {
    direction: entry.finalDirection,
    changedFromBaseline: false,
    branch: "baseline",
  };
}

function applyCommercialGateSoft(
  entry: SelectorAuditEntry,
  context: PairContext,
): VariantOutcome {
  const sentimentDirection = sourceDirection(context.sentiment);
  const dealerLedBranch =
    entry.baseSelectorBranch === "override_cot_agreement"
    || entry.baseSelectorBranch === "override_cot_less_stretched"
    || entry.strengthBranch === "strength_tiebreak_dealer";

  if (
    dealerLedBranch
    && isDealerSideConflict(context, entry.finalDirection)
    && commercialOpposesDirection(context, entry.finalDirection)
  ) {
    return {
      direction: sentimentDirection,
      changedFromBaseline: sentimentDirection !== entry.finalDirection,
      branch: "soft_revert_to_sentiment",
    };
  }

  return {
    direction: entry.finalDirection,
    changedFromBaseline: false,
    branch: "baseline",
  };
}

function applyCommercialGateOverrideOnly(
  entry: SelectorAuditEntry,
  context: PairContext,
): VariantOutcome {
  const sentimentDirection = sourceDirection(context.sentiment);
  const overrideBranch =
    entry.baseSelectorBranch === "override_cot_agreement"
    || entry.baseSelectorBranch === "override_cot_less_stretched";

  if (
    overrideBranch
    && isDealerSideConflict(context, entry.finalDirection)
    && commercialOpposesDirection(context, entry.finalDirection)
  ) {
    return {
      direction: sentimentDirection,
      changedFromBaseline: sentimentDirection !== entry.finalDirection,
      branch: "override_blocked",
    };
  }

  return {
    direction: entry.finalDirection,
    changedFromBaseline: false,
    branch: "baseline",
  };
}

function applyCommercialRequireConfirmation(
  entry: SelectorAuditEntry,
  context: PairContext,
): VariantOutcome {
  const sentimentDirection = sourceDirection(context.sentiment);
  const dealerDirection = sourceDirection(context.dealer);
  const commercialDirection = sourceDirection(context.commercial);

  if (
    entry.baseSelectorBranch === "override_cot_less_stretched"
    && isDealerSideConflict(context, entry.finalDirection)
    && entry.finalDirection === dealerDirection
    && !sameDirection(commercialDirection, dealerDirection)
  ) {
    return {
      direction: sentimentDirection,
      changedFromBaseline: sentimentDirection !== entry.finalDirection,
      branch: "confirmation_missing",
    };
  }

  return {
    direction: entry.finalDirection,
    changedFromBaseline: false,
    branch: "baseline",
  };
}

function resolveVariant(
  variant: VariantId,
  entry: SelectorAuditEntry,
  context: PairContext,
): VariantOutcome {
  switch (variant) {
    case "baseline_strength_tiebreak":
      return {
        direction: entry.finalDirection,
        changedFromBaseline: false,
        branch: "baseline",
      };
    case "comm_gate_strict":
      return applyCommercialGateStrict(entry, context);
    case "comm_gate_soft":
      return applyCommercialGateSoft(entry, context);
    case "comm_gate_override_only":
      return applyCommercialGateOverrideOnly(entry, context);
    case "comm_gate_require_confirmation":
      return applyCommercialRequireConfirmation(entry, context);
  }
}

function buildStats(
  weeks: string[],
  trades: TradeRow[],
  changed: VariantBreakdown,
): Omit<VariantStats, "id" | "label"> {
  const weekly = new Map<string, number>();
  const byAssetClass = new Map<string, { trades: number; returnPct: number; wins: number }>();
  let wins = 0;
  let total = 0;

  for (const trade of trades) {
    weekly.set(trade.weekOpenUtc, (weekly.get(trade.weekOpenUtc) ?? 0) + trade.returnPct);
    total += trade.returnPct;
    if (trade.returnPct > 0) wins += 1;
    const bucket = byAssetClass.get(trade.assetClass) ?? { trades: 0, returnPct: 0, wins: 0 };
    bucket.trades += 1;
    bucket.returnPct += trade.returnPct;
    if (trade.returnPct > 0) bucket.wins += 1;
    byAssetClass.set(trade.assetClass, bucket);
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
    changedDecisions: changed.changedDecisions,
    changedReturnPct: round(changed.changedReturnPct),
    byAssetClass: byAssetClassRecord,
  };
}

async function main() {
  const currentWeek = normalizeWeekOpenUtc(getDisplayWeekOpenUtc());
  const historicalWeeks = await listDataSectionWeeks();
  const weeks = historicalWeeks
    .filter((week) => normalizeWeekOpenUtc(week) < currentWeek)
    .slice(-10);

  const [cotHistory, sentimentBySymbol, baselineAudits] = await Promise.all([
    loadCotHistory(),
    loadSentimentHistory(),
    Promise.all(weeks.map((week) => resolveSelectorStrengthTiebreakAudit(week))),
  ]);

  const universe = buildPairUniverse();
  const contextsByWeek = new Map<string, Map<string, PairContext>>();
  for (const weekOpenUtc of weeks) {
    const closedWeeksForLookback = Array.from(
      new Set([...historicalWeeks, weekOpenUtc]),
    ).sort((a, b) => a.localeCompare(b));
    const contexts = await buildContextForWeek(
      weekOpenUtc,
      universe as PairDefWithAsset[],
      cotHistory,
      sentimentBySymbol,
      closedWeeksForLookback,
      { requireStrength: true },
    );
    contextsByWeek.set(weekOpenUtc, contexts);
  }

  const variants: VariantId[] = [
    "baseline_strength_tiebreak",
    "comm_gate_strict",
    "comm_gate_soft",
    "comm_gate_override_only",
    "comm_gate_require_confirmation",
  ];

  const tradesByVariant = new Map<VariantId, TradeRow[]>();
  const changedByVariant = new Map<VariantId, VariantBreakdown>();
  for (const variant of variants) {
    tradesByVariant.set(variant, []);
    changedByVariant.set(variant, { changedDecisions: 0, changedReturnPct: 0 });
  }

  const conflictSlices = new Map<string, { count: number; total: number; wins: number }>();

  for (const weekOpenUtc of weeks) {
    const baselineAudit = baselineAudits.find((audit) => audit.weekOpenUtc === weekOpenUtc);
    const contexts = contextsByWeek.get(weekOpenUtc);
    if (!baselineAudit || !contexts) {
      throw new Error(`Missing selector baseline context for ${weekOpenUtc}`);
    }

    const [pairReturns, adrMap] = await Promise.all([
      getWeeklyPairReturns(weekOpenUtc),
      loadWeeklyAdrMap(weekOpenUtc),
    ]);
    const returnBySymbol = new Map(
      pairReturns.map((row) => [row.symbol.toUpperCase(), row.returnPct] as const),
    );

    for (const entry of baselineAudit.entries) {
      if (entry.finalDirection === "NEUTRAL") continue;
      const context = contexts.get(entry.pair);
      const rawReturn = returnBySymbol.get(entry.pair.toUpperCase());
      if (!context || rawReturn == null) continue;

      const pairAdr = getAdrPct(adrMap, entry.pair, entry.assetClass);
      const baselineReturn =
        directionalReturn(rawReturn, entry.finalDirection) * (TARGET_ADR / pairAdr);

      if (isDealerSideConflict(context, entry.finalDirection)) {
        const dealerDirection = sourceDirection(context.dealer);
        const commercialDirection = sourceDirection(context.commercial);
        const key =
          sameDirection(commercialDirection, dealerDirection)
            ? "dealer_conflict_comm_agrees"
            : commercialOpposesDirection(context, entry.finalDirection)
              ? "dealer_conflict_comm_strong_oppose"
              : "dealer_conflict_comm_weak_or_neutral";
        const bucket = conflictSlices.get(key) ?? { count: 0, total: 0, wins: 0 };
        bucket.count += 1;
        bucket.total += baselineReturn;
        if (baselineReturn > 0) bucket.wins += 1;
        conflictSlices.set(key, bucket);
      }

      for (const variant of variants) {
        const outcome = resolveVariant(variant, entry, context);
        if (outcome.direction === "NEUTRAL") continue;

        const directedReturn =
          directionalReturn(rawReturn, outcome.direction) * (TARGET_ADR / pairAdr);
        tradesByVariant.get(variant)!.push({
          weekOpenUtc,
          pair: entry.pair,
          assetClass: entry.assetClass,
          direction: outcome.direction,
          returnPct: directedReturn,
        });

        if (outcome.changedFromBaseline && outcome.direction !== entry.finalDirection) {
          const changed = changedByVariant.get(variant)!;
          changed.changedDecisions += 1;
          changed.changedReturnPct += directedReturn - baselineReturn;
        }
      }
    }
  }

  const results: VariantStats[] = variants.map((variant) => ({
    id: variant,
    label: VARIANT_LABELS[variant],
    ...buildStats(weeks, tradesByVariant.get(variant)!, changedByVariant.get(variant)!),
  }));

  const conflictRows: ConflictSlice[] = [
    "dealer_conflict_comm_agrees",
    "dealer_conflict_comm_strong_oppose",
    "dealer_conflict_comm_weak_or_neutral",
  ].map((key) => {
    const bucket = conflictSlices.get(key) ?? { count: 0, total: 0, wins: 0 };
    return {
      label: key,
      count: bucket.count,
      totalReturnPct: round(bucket.total),
      winRatePct: round(bucket.count > 0 ? (bucket.wins / bucket.count) * 100 : 0, 1),
    };
  });

  const lines: string[] = [
    "# Selector Commercial Gate Research",
    "",
    `Weeks analyzed: ${weeks.length} (${formatWeek(weeks[0]!)} -> ${formatWeek(weeks.at(-1)!)}).`,
    "Baseline: canonical selector strength_tiebreak.",
    "Commercial is tested only as a gate on dealer-led selector decisions.",
    "All returns ADR-normalized.",
    "",
    "## Master Comparison",
    "",
    "| Variant | Trades | Total% | MaxDD% | Win% | Losing Wks | Trades/Wk | Changed Decisions | Changed Return |",
    "| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
    ...results
      .sort((left, right) => {
        if (left.losingWeeks !== right.losingWeeks) return left.losingWeeks - right.losingWeeks;
        if (left.maxDrawdownPct !== right.maxDrawdownPct) return left.maxDrawdownPct - right.maxDrawdownPct;
        return right.totalReturnPct - left.totalReturnPct;
      })
      .map((row) => `| ${row.label} | ${row.trades} | ${signedPct(row.totalReturnPct)} | ${row.maxDrawdownPct.toFixed(2)}% | ${row.winRatePct.toFixed(1)}% | ${row.losingWeeks} | ${row.tradesPerWeek.toFixed(1)} | ${row.changedDecisions} | ${signedPct(row.changedReturnPct)} |`),
    "",
    "## Conflict Slices",
    "",
    "| Slice | Count | Total% | Win% |",
    "| --- | ---: | ---: | ---: |",
    ...conflictRows.map((row) => `| ${row.label} | ${row.count} | ${signedPct(row.totalReturnPct)} | ${row.winRatePct.toFixed(1)}% |`),
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
