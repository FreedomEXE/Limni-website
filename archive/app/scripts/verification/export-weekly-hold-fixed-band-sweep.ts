/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: export-weekly-hold-fixed-band-sweep.ts
 *
 * Description:
 * Gate 34 Dealer-only Weekly Hold execution research. Compares the untouched
 * week-close baseline against fixed ADR TP/SL bands measured from running
 * weekly extremes using canonical 1H bars.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { loadEnvConfig } from "@next/env";
import { DateTime } from "luxon";
import type { CanonicalPriceBar } from "@/lib/canonicalPriceBars";
import { getPool } from "@/lib/db";
import { deriveCotReportDate, listDataSectionWeeks } from "@/lib/dataSectionWeeks";
import type { AssetClass } from "@/lib/cotMarkets";
import { PAIRS_BY_ASSET_CLASS } from "@/lib/cotPairs";
import { readSnapshot } from "@/lib/cotStore";
import { resolveMarketBias } from "@/lib/cotCompute";
import { getDisplayWeekOpenUtc } from "@/lib/weekAnchor";
import { getExecutionWeekWindow } from "@/lib/executionPriceWindows";
import { filterByModel, getCanonicalBasketWeekForModels, type BasketDirection } from "@/lib/performance/basketSource";
import { getExecutionWeeklyPairReturns } from "@/lib/pairReturns";
import { loadExecutionWeeklyReturnFromHourlyBars } from "@/lib/executionWeeklyReturns";
import { getAdrPct, getTargetAdrPct, loadWeeklyAdrMap } from "@/lib/performance/adrLookup";
import { loadPathBars, type PathBarMap } from "@/lib/performance/pathBarLoader";
import {
  computeBasketPath,
  computeMultiWeekBasketPath,
  type BasketPathPoint,
  type BasketPathResult,
} from "@/lib/performance/basketPathEngine";
import { buildWeeklyHoldLedger } from "@/lib/performance/positionLedger";
import type { WeeklyHoldResult, WeeklyHoldTrade } from "@/lib/performance/weeklyHoldEngine";

loadEnvConfig(process.cwd());

type ExitReason = "week_close" | "take_profit" | "stop_loss" | "ambiguous_stop_loss" | "pre_entry_invalidated" | "missing";
type ExecutionSource = "stored_pair_period_returns" | "derived_canonical_1h" | "missing";
type AnchorMode = "execution" | "market_week";

type Variant = {
  id: string;
  label: string;
  sourceRuleId: SourceRuleId;
  sourceRuleLabel: string;
  tpMultipleAdr: number | null;
  slMultipleAdr: number | null;
  anchorMode: AnchorMode | null;
};

export type SourceRuleId =
  | "current"
  | "neutral_only"
  | "direct_delta_confirmed"
  | "direct_delta_override"
  | "direct_raw_delta_leg_ratio0p75"
  | "direct_ratio_confirmed"
  | "direct_ratio_override"
  | "ratio_direction_all"
  | "ratio_direction_all_current_fallback"
  | "dealer_normalized_score_forced28"
  | "cot_combined_v1_forced28"
  | "cot_faces_v1_forced"
  | "cot_faces_v1_commercial_delta_contrarian";

type SourceRuleDecision = {
  direction: BasketDirection | "MISSING";
  tier: string | null;
  reason: string | null;
};

type DealerRule = {
  tier: string;
  direction: BasketDirection | null;
  ratioDirection: BasketDirection | null;
  deltaDirection: BasketDirection | null;
  minLegDirectionalRatio: number | null;
  normalizedScoreDirection: BasketDirection | null;
  normalizedScoreGap: number | null;
  normalizedScoreReason: string | null;
  cotCombinedDirection: BasketDirection | null;
  cotCombinedTier: string | null;
  cotCombinedReason: string | null;
  cotFacesDirection: BasketDirection | null;
  cotFacesTier: string | null;
  cotFacesReason: string | null;
  cotFacesCommercialDeltaContrarianDirection?: BasketDirection | null;
  cotFacesCommercialDeltaContrarianTier?: string | null;
  cotFacesCommercialDeltaContrarianReason?: string | null;
};

type DealerCurrencyScore = {
  currency: string;
  rawNorm: number;
  ratioNorm: number;
  deltaNorm: number;
  totalScore: number;
  rawValue: number | null;
  ratioValue: number | null;
  deltaValue: number | null;
};

export type BasePairWeek = {
  weekOpenUtc: string;
  pineWeekKey: string;
  symbol: string;
  assetClass: AssetClass;
  direction: BasketDirection | "MISSING";
  sourceReportDate: string | null;
  executionReturnSource: ExecutionSource;
  executionReturnComplete: boolean | null;
  executionReturnWarnings: string[];
  entryTimeUtc: string;
  anchorTimeUtc: string;
  weekCloseTimeUtc: string;
  entryPrice: number | null;
  weekClosePrice: number | null;
  pairAdrPct: number;
  adrSource: "canonical_price_bars" | "asset_default";
  bars: CanonicalPriceBar[];
  missingReason: string | null;
  sourceRuleDecisions: Record<string, SourceRuleDecision>;
};

type PairRow = {
  variantId: string;
  variantLabel: string;
  sourceRuleId: SourceRuleId;
  sourceRuleLabel: string;
  sourceRuleTier: string | null;
  sourceRuleReason: string | null;
  tpMultipleAdr: number | null;
  slMultipleAdr: number | null;
  anchorMode: AnchorMode | null;
  weekOpenUtc: string;
  pineWeekKey: string;
  symbol: string;
  direction: BasketDirection | "MISSING";
  sourceReportDate: string | null;
  executionReturnSource: ExecutionSource;
  executionReturnComplete: boolean | null;
  executionReturnWarnings: string[];
  entryTimeUtc: string | null;
  anchorTimeUtc: string | null;
  exitTimeUtc: string | null;
  exitReason: ExitReason;
  entryPrice: number | null;
  exitPrice: number | null;
  pairAdrPct: number | null;
  adrSource: "canonical_price_bars" | "asset_default" | "missing";
  rawReturnPct: number | null;
  adrReturnPct: number | null;
  maxAdverseRawPct: number | null;
  maxAdverseAdrPct: number | null;
  tpPrice: number | null;
  slPrice: number | null;
  runningHigh: number | null;
  runningLow: number | null;
  ambiguousExit: boolean;
  holdingHours: number | null;
  outcome: "WIN" | "LOSS" | "FLAT" | "NO_TRADE" | "PRE_ENTRY_INVALIDATED" | "MISSING_SIGNAL" | "MISSING_RETURN";
  missingReason: string | null;
};

type PathSummary = {
  totalReturnPct: number;
  peakPct: number;
  peakTsUtc: string | null;
  troughPct: number;
  troughTsUtc: string | null;
  closeEquityMaxDrawdownPct: number;
  closeEquityMaxDrawdownTsUtc: string | null;
  adverseMaxDrawdownPct: number;
  adverseMaxDrawdownTsUtc: string | null;
  peakToCloseGivebackPct: number;
  maxActivePositions: number;
  points: number;
};

type WeekReceipt = {
  variantId: string;
  weekOpenUtc: string;
  pineWeekKey: string;
  pairRows: PairRow[];
  missingPathBars: string[];
  totals: {
    tradeRows: number;
    wins: number;
    losses: number;
    flat: number;
    takeProfitExits: number;
    stopLossExits: number;
    weekCloseExits: number;
    preEntryInvalidatedRows: number;
    ambiguousExits: number;
    missingSignalRows: number;
    missingReturnRows: number;
    rawReturnPct: number;
    adrReturnPct: number;
    rawProfitFactor: number | null;
    adrProfitFactor: number | null;
  };
  path: {
    raw: PathSummary;
    adr: PathSummary;
  };
};

type Summary = {
  variantId: string;
  variantLabel: string;
  tpMultipleAdr: number | null;
  slMultipleAdr: number | null;
  anchorMode: AnchorMode | null;
  weeklyWins: number;
  weeklyLosses: number;
  weeklyFlat: number;
  weeklyWinRatePct: number;
  tradeWins: number;
  tradeLosses: number;
  tradeFlat: number;
  tradeWinRatePct: number;
  takeProfitExits: number;
  stopLossExits: number;
  weekCloseExits: number;
  preEntryInvalidatedRows: number;
  ambiguousExits: number;
  totalRawPct: number;
  totalAdrPct: number;
  weeklyRawProfitFactor: number | null;
  weeklyAdrProfitFactor: number | null;
  tradeRawProfitFactor: number | null;
  tradeAdrProfitFactor: number | null;
  tradeRawExpectancyPct: number | null;
  tradeAdrExpectancyPct: number | null;
  weeklyAdrMeanPct: number | null;
  weeklyAdrStdDevPct: number | null;
  weeklySharpeStyleScore: number | null;
  tpNormalizedAdrReturn: number | null;
  slRiskNormalizedAdrReturn: number | null;
  adverseDdPerAdrReturn: number | null;
  givebackPerAdrReturn: number | null;
  rawPeakPct: number;
  rawAdverseDrawdownPct: number;
  rawPeakGivebackPct: number;
  adrPeakPct: number;
  adrAdverseDrawdownPct: number;
  adrPeakGivebackPct: number;
};

const CSV_COLUMNS = [
  "variantId",
  "variantLabel",
  "sourceRuleId",
  "sourceRuleLabel",
  "sourceRuleTier",
  "sourceRuleReason",
  "tpMultipleAdr",
  "slMultipleAdr",
  "anchorMode",
  "pineWeekKey",
  "symbol",
  "direction",
  "exitReason",
  "entryTimeUtc",
  "anchorTimeUtc",
  "exitTimeUtc",
  "entryPrice",
  "exitPrice",
  "pairAdrPct",
  "rawReturnPct",
  "adrReturnPct",
  "maxAdverseRawPct",
  "maxAdverseAdrPct",
  "tpPrice",
  "slPrice",
  "runningHigh",
  "runningLow",
  "ambiguousExit",
  "holdingHours",
  "outcome",
  "missingReason",
] as const;

type ExcludedWeek = {
  weekOpenUtc: string;
  pineWeekKey: string;
  sourceReportDate: string;
  reason: string;
};

const PAIR_DEF_BY_SYMBOL = new Map(
  PAIRS_BY_ASSET_CLASS.fx.map((pair) => [pair.pair.toUpperCase(), pair]),
);

function argValue(name: string): string | null {
  const direct = process.argv.find((arg) => arg.startsWith(`--${name}=`));
  if (direct) return direct.slice(name.length + 3);
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] ?? null : null;
}

function parseExplicitWeeks() {
  const raw = argValue("weeks");
  if (!raw) return null;
  const weeks = raw
    .split(",")
    .map((week) => week.trim())
    .filter(Boolean);
  if (weeks.length === 0) throw new Error("--weeks was provided but did not include any week open UTC values.");
  return weeks;
}

function parseAssetClass(): AssetClass {
  const value = (argValue("asset-class") ?? "fx").trim().toLowerCase();
  if (value === "fx" || value === "indices" || value === "commodities" || value === "crypto") return value;
  throw new Error("--asset-class must be fx, indices, commodities, or crypto.");
}

function parseNumberList(name: string, fallback: string) {
  const raw = argValue(name) ?? fallback;
  const values = raw
    .split(",")
    .map((part) => Number(part.trim()))
    .filter((value) => Number.isFinite(value) && value > 0);
  if (values.length === 0) throw new Error(`--${name} must include at least one positive number.`);
  return Array.from(new Set(values)).sort((left, right) => left - right);
}

function parseAnchorModes(): AnchorMode[] {
  const raw = argValue("anchor-modes") ?? "execution";
  const modes = raw
    .split(",")
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean);
  const parsed = modes.map((mode) => {
    if (mode === "execution" || mode === "market_week") return mode;
    if (mode === "market" || mode === "market-week") return "market_week";
    throw new Error("--anchor-modes must contain execution and/or market_week.");
  });
  return Array.from(new Set(parsed));
}

const SOURCE_RULE_LABELS: Record<SourceRuleId, string> = {
  current: "Current Dealer",
  neutral_only: "Neutral/Tiebreaker Only",
  direct_delta_confirmed: "Direct Delta Confirmed",
  direct_delta_override: "Direct Delta Override",
  direct_raw_delta_leg_ratio0p75: "Direct Raw+Delta, Leg Ratio >= 0.75",
  direct_ratio_confirmed: "Direct Ratio Confirmed",
  direct_ratio_override: "Direct Ratio Override",
  ratio_direction_all: "Ratio Direction All",
  ratio_direction_all_current_fallback: "Ratio Direction All + Current Fallback",
  dealer_normalized_score_forced28: "Dealer Normalized Score Forced 28",
  cot_combined_v1_forced28: "COT Combined v1 Forced 28",
  cot_faces_v1_forced: "COT Faces v1 Forced",
  cot_faces_v1_commercial_delta_contrarian: "COT Faces v1 Commercial Delta Contrarian",
};

function parseSourceRules(): SourceRuleId[] {
  const raw = argValue("source-rules") ?? argValue("source-rule") ?? "current";
  const rules = raw
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  if (rules.length === 0) throw new Error("--source-rules must include at least one source rule.");
  for (const rule of rules) {
    if (!(rule in SOURCE_RULE_LABELS)) {
      throw new Error(`Unknown --source-rules value: ${rule}`);
    }
  }
  return Array.from(new Set(rules)) as SourceRuleId[];
}

function parseExpectedPairs(assetClass: AssetClass) {
  const allPairs = PAIRS_BY_ASSET_CLASS[assetClass].map((pair) => pair.pair.toUpperCase());
  const requested = argValue("pairs");
  if (!requested) return allPairs;
  const selected = requested
    .split(",")
    .map((part) => part.trim().toUpperCase())
    .filter(Boolean);
  if (selected.length === 0) throw new Error("--pairs was provided but did not include any symbols.");
  const unknown = selected.filter((pair) => !allPairs.includes(pair));
  if (unknown.length > 0) {
    throw new Error(`--pairs contains symbols outside ${assetClass}: ${unknown.join(", ")}`);
  }
  return Array.from(new Set(selected));
}

function sourceModelDescription(sourceRules: SourceRuleId[]) {
  return sourceRules.some((rule) => rule.startsWith("cot_faces"))
    ? "COT faces research"
    : sourceRules.some((rule) => rule.startsWith("cot_"))
    ? "COT combined research"
    : "dealer only";
}

function sourceModelId(sourceRules: SourceRuleId[]) {
  return sourceRules.some((rule) => rule.startsWith("cot_faces"))
    ? "cot_faces_research"
    : sourceRules.some((rule) => rule.startsWith("cot_"))
    ? "cot_combined_research"
    : "dealer";
}

function fileStemSourceSlug(sourceRules: SourceRuleId[]) {
  if (sourceRules.some((rule) => rule.startsWith("cot_faces"))) return "cot-faces";
  return sourceRules.some((rule) => rule.startsWith("cot_")) ? "cot" : "dealer";
}

function defaultOutDir() {
  const fromAppDir = path.basename(process.cwd()).toLowerCase() === "app";
  return fromAppDir
    ? "reports/data-verification/weekly-hold-exit-sweep"
    : "app/reports/data-verification/weekly-hold-exit-sweep";
}

function pineWeekKey(weekOpenUtc: string) {
  const week = DateTime.fromISO(weekOpenUtc, { zone: "utc" });
  return week.isValid ? week.plus({ days: 1 }).toISODate() ?? weekOpenUtc.slice(0, 10) : weekOpenUtc.slice(0, 10);
}

function marketWeekOpenUtc(weekOpenUtc: string) {
  const parsed = DateTime.fromISO(weekOpenUtc, { zone: "utc" });
  if (!parsed.isValid) return weekOpenUtc;
  const nyWeek = parsed.setZone("America/New_York");
  const daysSinceSunday = nyWeek.weekday % 7;
  return nyWeek
    .minus({ days: daysSinceSunday })
    .startOf("day")
    .set({ hour: 17, minute: 0, second: 0, millisecond: 0 })
    .toUTC()
    .toISO() ?? weekOpenUtc;
}

function selectClosedWeeks(allWeeks: string[], currentWeekOpenUtc: string) {
  return allWeeks
    .map((week) => week.trim())
    .filter(Boolean)
    .sort((left, right) => left.localeCompare(right))
    .filter((week) => week < currentWeekOpenUtc);
}

function filterWeeksByDate(weeks: string[], options: { from: string | null; to: string | null }) {
  return weeks.filter((weekOpenUtc) => {
    const key = pineWeekKey(weekOpenUtc);
    if (options.from && key < options.from) return false;
    if (options.to && key > options.to) return false;
    return true;
  });
}

function filterWeeksByExcludedSourceReports(
  weeks: string[],
  options: { from: string | null; to: string | null },
) {
  if (!options.from && !options.to) {
    return { kept: weeks, excluded: [] as ExcludedWeek[] };
  }

  const excluded: ExcludedWeek[] = [];
  const kept = weeks.filter((weekOpenUtc) => {
    const sourceReportDate = deriveCotReportDate(weekOpenUtc);
    const inExcludedRange = Boolean(
      sourceReportDate
        && (!options.from || sourceReportDate >= options.from)
        && (!options.to || sourceReportDate <= options.to),
    );
    if (inExcludedRange) {
      excluded.push({
        weekOpenUtc,
        pineWeekKey: pineWeekKey(weekOpenUtc),
        sourceReportDate,
        reason: "excluded_source_report_date",
      });
      return false;
    }
    return true;
  });

  return { kept, excluded };
}

function round(value: number | null, places = 6) {
  if (value === null || !Number.isFinite(value)) return null;
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

function fixed(value: number | null, places = 2) {
  return value === null || !Number.isFinite(value) ? "-" : value.toFixed(places);
}

function signed(value: number | null, places = 2) {
  return value === null || !Number.isFinite(value)
    ? "-"
    : `${value >= 0 ? "+" : ""}${value.toFixed(places)}%`;
}

function formatProfitFactor(value: number | null) {
  if (value === null) return "-";
  return Number.isFinite(value) ? value.toFixed(2) : "inf";
}

function formatRatio(value: number | null, places = 2) {
  return value === null || !Number.isFinite(value) ? "-" : value.toFixed(places);
}

function average(values: number[]) {
  return values.length > 0
    ? values.reduce((sum, value) => sum + value, 0) / values.length
    : null;
}

function stdDev(values: number[], mean: number | null) {
  if (values.length < 2 || mean === null) return null;
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

function ratio(numerator: number | null, denominator: number | null) {
  if (numerator === null || denominator === null || !Number.isFinite(numerator) || !Number.isFinite(denominator)) {
    return null;
  }
  if (denominator === 0) return null;
  return numerator / denominator;
}

function positiveReturnRatio(numerator: number, returnPct: number) {
  if (!Number.isFinite(numerator) || !Number.isFinite(returnPct) || returnPct <= 0) return null;
  return numerator / returnPct;
}

function csvEscape(value: unknown) {
  if (value === null || value === undefined) return "";
  const text = Array.isArray(value) ? value.join(";") : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll("\"", "\"\"")}"` : text;
}

function toCsv(rows: PairRow[]) {
  return [
    CSV_COLUMNS.join(","),
    ...rows.map((row) => CSV_COLUMNS.map((column) => csvEscape(row[column])).join(",")),
  ].join("\n");
}

function profitFactor(grossProfit: number, grossLoss: number) {
  if (grossLoss > 0) return grossProfit / grossLoss;
  if (grossProfit > 0) return Number.POSITIVE_INFINITY;
  return null;
}

function outcomeFor(direction: BasketDirection | "MISSING", raw: number | null, normalized: number | null) {
  if (direction === "MISSING") return "MISSING_SIGNAL" as const;
  if (direction === "NEUTRAL") return "NO_TRADE" as const;
  if (raw === null || normalized === null) return "MISSING_RETURN" as const;
  if (normalized > 0) return "WIN" as const;
  if (normalized < 0) return "LOSS" as const;
  return "FLAT" as const;
}

function directionFromScore(score: number | null | undefined): BasketDirection | null {
  if (typeof score !== "number" || !Number.isFinite(score) || score === 0) return null;
  return score > 0 ? "LONG" : "SHORT";
}

function dealerDirectionalRatio(market: any) {
  if (typeof market?.dealer_directional_ratio === "number") return market.dealer_directional_ratio;
  if (typeof market?.dealer_spread !== "number" || market.dealer_spread < 0) return null;
  const directional = Math.abs(Number(market.dealer_net));
  const denom = directional + market.dealer_spread;
  return denom > 0 ? directional / denom : null;
}

function numeric(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function dealerPctOfOi(market: any): number | null {
  const existing = numeric(market?.dealer_pct_of_oi);
  if (existing !== null) return existing;
  const dealerNet = numeric(market?.dealer_net);
  const openInterest = numeric(market?.open_interest);
  return dealerNet !== null && openInterest !== null && openInterest > 0
    ? dealerNet / openInterest
    : null;
}

function dealerDeltaPctOfOi(market: any): number | null {
  const dealerDeltaNet = numeric(market?.dealer_delta_net);
  const openInterest = numeric(market?.open_interest);
  return dealerDeltaNet !== null && openInterest !== null && openInterest > 0
    ? dealerDeltaNet / openInterest
    : null;
}

function commercialPctOfOi(market: any): number | null {
  const existing = numeric(market?.commercial_pct_of_oi);
  if (existing !== null) return existing;
  const commercialNet = numeric(market?.commercial_net);
  const openInterest = numeric(market?.open_interest);
  return commercialNet !== null && openInterest !== null && openInterest > 0
    ? commercialNet / openInterest
    : null;
}

function commercialDeltaPctOfOi(market: any): number | null {
  const commercialDeltaNet = numeric(market?.commercial_delta_net);
  const openInterest = numeric(market?.open_interest);
  return commercialDeltaNet !== null && openInterest !== null && openInterest > 0
    ? commercialDeltaNet / openInterest
    : null;
}

function normalizeComponent(valuesByCurrency: Map<string, number | null>) {
  const valid = Array.from(valuesByCurrency.values()).filter((value): value is number => (
    typeof value === "number" && Number.isFinite(value)
  ));
  const mean = average(valid) ?? 0;
  const maxAbsDeviation = valid.reduce((max, value) => Math.max(max, Math.abs(value - mean)), 0);
  const normalized = new Map<string, number>();

  for (const [currency, value] of valuesByCurrency.entries()) {
    if (value === null || !Number.isFinite(value) || maxAbsDeviation === 0) {
      normalized.set(currency, 0);
    } else {
      normalized.set(currency, (value - mean) / maxAbsDeviation);
    }
  }

  return normalized;
}

function buildDealerCurrencyScores(
  markets: Record<string, any>,
  currencies: string[],
): Map<string, DealerCurrencyScore> {
  const rawValues = new Map<string, number | null>();
  const ratioValues = new Map<string, number | null>();
  const deltaValues = new Map<string, number | null>();

  for (const currency of currencies) {
    const market = markets[currency];
    rawValues.set(currency, market ? dealerPctOfOi(market) : null);
    ratioValues.set(currency, market ? dealerDirectionalRatio(market) : null);
    deltaValues.set(currency, market ? dealerDeltaPctOfOi(market) : null);
  }

  const rawNorm = normalizeComponent(rawValues);
  const ratioNorm = normalizeComponent(ratioValues);
  const deltaNorm = normalizeComponent(deltaValues);

  return new Map(currencies.map((currency) => {
    const score: DealerCurrencyScore = {
      currency,
      rawNorm: rawNorm.get(currency) ?? 0,
      ratioNorm: ratioNorm.get(currency) ?? 0,
      deltaNorm: deltaNorm.get(currency) ?? 0,
      rawValue: rawValues.get(currency) ?? null,
      ratioValue: ratioValues.get(currency) ?? null,
      deltaValue: deltaValues.get(currency) ?? null,
      totalScore: 0,
    };
    score.totalScore = score.rawNorm + score.ratioNorm + score.deltaNorm;
    return [currency, score] as const;
  }));
}

function normalizedScoreDecision(
  baseSymbol: string,
  quoteSymbol: string,
  scoreMap: Map<string, DealerCurrencyScore>,
) {
  const base = scoreMap.get(baseSymbol);
  const quote = scoreMap.get(quoteSymbol);
  if (!base || !quote) {
    return {
      direction: null as BasketDirection | null,
      gap: null,
      reason: "normalized_score_missing_currency",
    };
  }

  const componentGap = {
    raw: base.rawNorm - quote.rawNorm,
    ratio: base.ratioNorm - quote.ratioNorm,
    delta: base.deltaNorm - quote.deltaNorm,
  };
  let gap = base.totalScore - quote.totalScore;
  let reason = `score_gap=${round(gap, 4)} raw_gap=${round(componentGap.raw, 4)} ratio_gap=${round(componentGap.ratio, 4)} delta_gap=${round(componentGap.delta, 4)}`;

  if (gap === 0) {
    const detailGap = componentGap.ratio || componentGap.raw || componentGap.delta;
    if (detailGap !== 0) {
      gap = detailGap;
      reason = `${reason} tie_break=component_detail`;
    }
  }

  if (gap === 0) {
    gap = baseSymbol.localeCompare(quoteSymbol) <= 0 ? 1e-9 : -1e-9;
    reason = `${reason} tie_break=stable_symbol_order`;
  }

  return {
    direction: gap > 0 ? "LONG" as const : "SHORT" as const,
    gap,
    reason,
  };
}

function pairComponentDirection(
  base: any,
  quote: any,
  component: (market: any) => number | null,
) {
  const baseValue = component(base);
  const quoteValue = component(quote);
  return {
    direction: baseValue !== null && quoteValue !== null
      ? directionFromScore(baseValue - quoteValue)
      : null,
    gap: baseValue !== null && quoteValue !== null ? baseValue - quoteValue : null,
  };
}

function directionVoteScore(direction: BasketDirection | null, weight: number) {
  if (direction === "LONG") return weight;
  if (direction === "SHORT") return -weight;
  return 0;
}

function formatDirection(direction: BasketDirection | null) {
  return direction ?? "none";
}

function cotCombinedDecision(baseSymbol: string, quoteSymbol: string, base: any, quote: any) {
  if (!base || !quote) {
    return {
      direction: null as BasketDirection | null,
      tier: "cot_missing_market",
      reason: "missing_cot_market",
    };
  }

  const dealerRatio = pairComponentDirection(base, quote, dealerDirectionalRatio);
  const dealerDelta = pairComponentDirection(base, quote, dealerDeltaPctOfOi);
  const dealerRaw = pairComponentDirection(base, quote, dealerPctOfOi);
  const commercial = pairComponentDirection(base, quote, commercialPctOfOi);
  const commercialDelta = pairComponentDirection(base, quote, commercialDeltaPctOfOi);

  const reasonParts = [
    `ratio=${formatDirection(dealerRatio.direction)} gap=${round(dealerRatio.gap, 4)}`,
    `dealer_delta=${formatDirection(dealerDelta.direction)} gap=${round(dealerDelta.gap, 4)}`,
    `dealer_raw=${formatDirection(dealerRaw.direction)} gap=${round(dealerRaw.gap, 4)}`,
    `commercial=${formatDirection(commercial.direction)} gap=${round(commercial.gap, 4)}`,
    `commercial_delta=${formatDirection(commercialDelta.direction)} gap=${round(commercialDelta.gap, 4)}`,
  ];

  if (
    dealerRatio.direction &&
    dealerDelta.direction === dealerRatio.direction &&
    commercial.direction === dealerRatio.direction
  ) {
    return {
      direction: dealerRatio.direction,
      tier: "cot_ratio_delta_commercial_confirmed",
      reason: reasonParts.join(" "),
    };
  }

  if (dealerRatio.direction && dealerDelta.direction === dealerRatio.direction) {
    return {
      direction: dealerRatio.direction,
      tier: "cot_ratio_delta_confirmed",
      reason: reasonParts.join(" "),
    };
  }

  if (dealerRatio.direction && commercial.direction === dealerRatio.direction) {
    return {
      direction: dealerRatio.direction,
      tier: "cot_ratio_commercial_confirmed",
      reason: reasonParts.join(" "),
    };
  }

  if (dealerDelta.direction && dealerRaw.direction === dealerDelta.direction && commercial.direction === dealerDelta.direction) {
    return {
      direction: dealerDelta.direction,
      tier: "cot_delta_raw_commercial_confirmed",
      reason: reasonParts.join(" "),
    };
  }

  const vote =
    directionVoteScore(dealerRatio.direction, 2) +
    directionVoteScore(dealerDelta.direction, 1.25) +
    directionVoteScore(dealerRaw.direction, 1) +
    directionVoteScore(commercial.direction, 0.75) +
    directionVoteScore(commercialDelta.direction, 0.5);
  let direction = directionFromScore(vote);
  let tier = Math.abs(vote) >= 1
    ? "cot_weighted_forced"
    : "cot_low_confidence_forced";
  let tieBreak = "";

  if (!direction) {
    direction =
      dealerRatio.direction ??
      dealerDelta.direction ??
      commercial.direction ??
      dealerRaw.direction ??
      (baseSymbol.localeCompare(quoteSymbol) <= 0 ? "LONG" : "SHORT");
    tier = "cot_tie_forced";
    tieBreak = ` tie_break=${direction === dealerRatio.direction ? "dealer_ratio" : direction === dealerDelta.direction ? "dealer_delta" : direction === commercial.direction ? "commercial" : direction === dealerRaw.direction ? "dealer_raw" : "stable_symbol_order"}`;
  }

  return {
    direction,
    tier,
    reason: `vote=${round(vote, 4)}${tieBreak} ${reasonParts.join(" ")}`,
  };
}

type CotFaceMetric = {
  id: string;
  label: string;
  weight: number;
  component: (market: any) => number | null;
};

const COT_FACE_METRICS: CotFaceMetric[] = [
  { id: "dealer_net", label: "dealer_net_oi", weight: 1.5, component: dealerPctOfOi },
  { id: "dealer_delta", label: "dealer_delta_oi", weight: 1, component: dealerDeltaPctOfOi },
  { id: "commercial_net", label: "commercial_net_oi", weight: 1, component: commercialPctOfOi },
  { id: "commercial_delta", label: "commercial_delta_oi", weight: 0.75, component: commercialDeltaPctOfOi },
  { id: "noncomm_net", label: "noncomm_net_oi", weight: 0.75, component: (market) => pctOfOi(market, "noncomm_net") },
  { id: "noncomm_delta", label: "noncomm_delta_oi", weight: 0.5, component: (market) => pctOfOi(market, "noncomm_delta_net") },
  { id: "nonrept_net", label: "nonrept_net_oi", weight: 0.5, component: (market) => pctOfOi(market, "nonrept_net") },
  { id: "nonrept_delta", label: "nonrept_delta_oi", weight: 0.25, component: (market) => pctOfOi(market, "nonrept_delta_net") },
  { id: "asset_mgr_net", label: "asset_mgr_net_oi", weight: 0.5, component: (market) => pctOfOi(market, "asset_mgr_net") },
  { id: "asset_mgr_delta", label: "asset_mgr_delta_oi", weight: 0.35, component: (market) => pctOfOi(market, "asset_mgr_delta_net") },
  { id: "lev_money_net", label: "lev_money_net_oi", weight: 0.5, component: (market) => pctOfOi(market, "lev_money_net") },
  { id: "lev_money_delta", label: "lev_money_delta_oi", weight: 0.35, component: (market) => pctOfOi(market, "lev_money_delta_net") },
];

type CotFacesOptions = {
  commercialDeltaContrarian?: boolean;
};

function cotFaceMetrics(options: CotFacesOptions = {}) {
  if (!options.commercialDeltaContrarian) return COT_FACE_METRICS;
  return COT_FACE_METRICS.map((metric) => {
    if (metric.id !== "commercial_delta") return metric;
    return {
      ...metric,
      component: (market: any) => {
        const value = commercialDeltaPctOfOi(market);
        return value === null ? null : -value;
      },
    };
  });
}

function pctOfOi(market: any, field: string): number | null {
  const value = numeric(market?.[field]);
  const openInterest = numeric(market?.open_interest);
  return value !== null && openInterest !== null && openInterest > 0 ? value / openInterest : null;
}

function directionalRatioFromSpread(market: any, netField: string, spreadField: string) {
  const net = numeric(market?.[netField]);
  const spread = numeric(market?.[spreadField]);
  if (net === null || spread === null || spread < 0) return null;
  const directional = Math.abs(net);
  const denom = directional + spread;
  return denom > 0 ? directional / denom : null;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function cotFacesCurrencyScore(market: any, options: CotFacesOptions = {}) {
  let weightedScore = 0;
  const components: string[] = [];
  for (const metric of cotFaceMetrics(options)) {
    const value = metric.component(market);
    if (value === null) {
      components.push(`${metric.label}=missing`);
      continue;
    }
    weightedScore += value * metric.weight;
    components.push(`${metric.label}=${round(value, 4)}`);
  }

  const adjustments: string[] = [];
  let confidence = 1;
  const dealerRatio = directionalRatioFromSpread(market, "dealer_net", "dealer_spread");
  if (dealerRatio !== null) {
    if (dealerRatio >= 0.7) {
      confidence += 0.15;
      adjustments.push(`dealer_spread=clean:${round(dealerRatio, 3)}`);
    } else if (dealerRatio <= 0.35) {
      confidence -= 0.15;
      adjustments.push(`dealer_spread=dirty:${round(dealerRatio, 3)}`);
    } else {
      adjustments.push(`dealer_spread=mixed:${round(dealerRatio, 3)}`);
    }
  }

  const noncommRatio = directionalRatioFromSpread(market, "noncomm_net", "noncomm_spread");
  if (noncommRatio !== null) {
    if (noncommRatio >= 0.7) {
      confidence += 0.1;
      adjustments.push(`noncomm_spread=clean:${round(noncommRatio, 3)}`);
    } else if (noncommRatio <= 0.35) {
      confidence -= 0.1;
      adjustments.push(`noncomm_spread=dirty:${round(noncommRatio, 3)}`);
    } else {
      adjustments.push(`noncomm_spread=mixed:${round(noncommRatio, 3)}`);
    }
  }

  const oiDeltaPct = pctOfOi(market, "oi_delta");
  if (oiDeltaPct !== null && oiDeltaPct !== 0 && weightedScore !== 0) {
    if (oiDeltaPct > 0) {
      confidence += 0.1;
      adjustments.push(`oi=expanding:${round(oiDeltaPct, 4)}`);
    } else {
      confidence -= 0.1;
      adjustments.push(`oi=contracting:${round(oiDeltaPct, 4)}`);
    }
  }

  const concentration = Math.max(
    numeric(market?.conc_gross_4_long) ?? 0,
    numeric(market?.conc_gross_4_short) ?? 0,
    numeric(market?.conc_gross_8_long) ?? 0,
    numeric(market?.conc_gross_8_short) ?? 0,
  );
  if (concentration >= 40) {
    confidence -= 0.05;
    adjustments.push(`concentration=high:${round(concentration, 2)}`);
  }

  const multiplier = clamp(confidence, 0.7, 1.3);
  return {
    weightedScore,
    multiplier,
    finalScore: weightedScore * multiplier,
    components,
    adjustments,
  };
}

function cotFacesDecision(
  baseSymbol: string,
  quoteSymbol: string,
  base: any,
  quote: any,
  options: CotFacesOptions = {},
) {
  if (!base || !quote) {
    return {
      direction: null as BasketDirection | null,
      tier: "cot_faces_missing_market",
      reason: "missing_cot_market",
    };
  }

  const baseScore = cotFacesCurrencyScore(base, options);
  const quoteScore = cotFacesCurrencyScore(quote, options);
  let pairScore = baseScore.finalScore - quoteScore.finalScore;
  let direction = directionFromScore(pairScore);
  let tieBreak = "";
  if (!direction) {
    pairScore = baseScore.weightedScore - quoteScore.weightedScore;
    direction = directionFromScore(pairScore);
    tieBreak = " tie_break=unmultiplied_score";
  }
  if (!direction) {
    direction = baseSymbol.localeCompare(quoteSymbol) <= 0 ? "LONG" : "SHORT";
    tieBreak = " tie_break=stable_symbol_order";
  }

  const faceDecisions = cotFaceMetrics(options).map((metric) => {
    const pairComponent = pairComponentDirection(base, quote, metric.component);
    return { ...metric, direction: pairComponent.direction, gap: pairComponent.gap };
  });
  const agreementWeight = faceDecisions
    .filter((face) => face.direction === direction)
    .reduce((sum, face) => sum + face.weight, 0);
  const conflictWeight = faceDecisions
    .filter((face) => face.direction && face.direction !== direction)
    .reduce((sum, face) => sum + face.weight, 0);
  const faceById = new Map(faceDecisions.map((face) => [face.id, face]));
  const dealerNetDirection = faceById.get("dealer_net")?.direction ?? null;
  const commercialDirection = faceById.get("commercial_net")?.direction ?? null;
  const noncommDirection = faceById.get("noncomm_net")?.direction ?? null;
  const levMoneyDirection = faceById.get("lev_money_net")?.direction ?? null;
  const pairOiDirection = pairComponentDirection(base, quote, (market) => pctOfOi(market, "oi_delta")).direction;

  let tier = "cot_faces_weighted_forced";
  if (dealerNetDirection === direction && commercialDirection === direction && noncommDirection === direction) {
    tier = "cot_faces_broad_alignment";
  } else if (dealerNetDirection === direction && commercialDirection === direction) {
    tier = "cot_faces_dealer_commercial_confirmed";
  } else if (
    dealerNetDirection === direction &&
    noncommDirection === direction &&
    commercialDirection &&
    commercialDirection !== direction
  ) {
    tier = "cot_faces_dealer_noncomm_commercial_conflict";
  } else if (dealerNetDirection === direction && noncommDirection === direction) {
    tier = "cot_faces_dealer_noncomm_confirmed";
  } else if (pairOiDirection === direction && agreementWeight >= conflictWeight) {
    tier = "cot_faces_oi_confirmed";
  } else if (dealerNetDirection === direction && commercialDirection && commercialDirection !== direction) {
    tier = "cot_faces_dealer_leads_commercial_conflicts";
  } else if (noncommDirection === direction && levMoneyDirection === direction && dealerNetDirection !== direction) {
    tier = "cot_faces_speculative_crowding_warning";
  } else if (Math.abs(agreementWeight - conflictWeight) < 1) {
    tier = "cot_faces_low_confidence_forced";
  }

  const faceReason = faceDecisions
    .map((face) => `${face.label}:${formatDirection(face.direction)}:${round(face.gap, 4)}`)
    .join(" ");
  return {
    direction,
    tier,
    reason: [
      `pair_score=${round(pairScore, 6)}`,
      `base_score=${round(baseScore.finalScore, 6)}`,
      `quote_score=${round(quoteScore.finalScore, 6)}`,
      `base_mult=${round(baseScore.multiplier, 3)}`,
      `quote_mult=${round(quoteScore.multiplier, 3)}`,
      `agree_w=${round(agreementWeight, 2)}`,
      `conflict_w=${round(conflictWeight, 2)}`,
      `dealer_pair=${formatDirection(dealerNetDirection)}`,
      `commercial_pair=${formatDirection(commercialDirection)}`,
      `noncomm_pair=${formatDirection(noncommDirection)}`,
      `oi_pair=${formatDirection(pairOiDirection)}`,
      options.commercialDeltaContrarian ? "variant=commercial_delta_contrarian" : "",
      tieBreak.trim(),
      faceReason,
      `base_quality=${baseScore.adjustments.join(";") || "none"}`,
      `quote_quality=${quoteScore.adjustments.join(";") || "none"}`,
    ].filter(Boolean).join(" "),
  };
}

function classifyDealerRule(
  baseSymbol: string,
  quoteSymbol: string,
  base: any,
  quote: any,
  normalizedScore?: ReturnType<typeof normalizedScoreDecision> | null,
): DealerRule {
  const cotCombined = cotCombinedDecision(baseSymbol, quoteSymbol, base, quote);
  const cotFaces = cotFacesDecision(baseSymbol, quoteSymbol, base, quote);
  const cotFacesCommercialDeltaContrarian = cotFacesDecision(baseSymbol, quoteSymbol, base, quote, {
    commercialDeltaContrarian: true,
  });
  const baseRatio = dealerDirectionalRatio(base);
  const quoteRatio = dealerDirectionalRatio(quote);
  const minLegDirectionalRatio =
    typeof baseRatio === "number" && typeof quoteRatio === "number"
      ? Math.min(baseRatio, quoteRatio)
      : null;
  const ratioDirection =
    typeof baseRatio === "number" && typeof quoteRatio === "number"
      ? directionFromScore(baseRatio - quoteRatio)
      : null;
  const deltaDirection =
    typeof base?.dealer_delta_net === "number" && typeof quote?.dealer_delta_net === "number"
      ? directionFromScore(base.dealer_delta_net - quote.dealer_delta_net)
      : null;

  const baseBias = base ? resolveMarketBias(base, "dealer") : null;
  const quoteBias = quote ? resolveMarketBias(quote, "dealer") : null;
  if (!baseBias || !quoteBias) {
    return {
      tier: "missing_market",
      direction: null,
      ratioDirection,
      deltaDirection,
      minLegDirectionalRatio,
      normalizedScoreDirection: normalizedScore?.direction ?? null,
      normalizedScoreGap: normalizedScore?.gap ?? null,
      normalizedScoreReason: normalizedScore?.reason ?? null,
      cotCombinedDirection: cotCombined.direction,
      cotCombinedTier: cotCombined.tier,
      cotCombinedReason: cotCombined.reason,
      cotFacesDirection: cotFaces.direction,
      cotFacesTier: cotFaces.tier,
      cotFacesReason: cotFaces.reason,
      cotFacesCommercialDeltaContrarianDirection: cotFacesCommercialDeltaContrarian.direction,
      cotFacesCommercialDeltaContrarianTier: cotFacesCommercialDeltaContrarian.tier,
      cotFacesCommercialDeltaContrarianReason: cotFacesCommercialDeltaContrarian.reason,
    };
  }

  if (
    baseBias.bias !== "NEUTRAL" &&
    quoteBias.bias !== "NEUTRAL" &&
    baseBias.bias !== quoteBias.bias
  ) {
    return {
      tier: "direct_opposed_bias",
      direction: baseBias.bias === "BULLISH" && quoteBias.bias === "BEARISH" ? "LONG" : "SHORT",
      ratioDirection,
      deltaDirection,
      minLegDirectionalRatio,
      normalizedScoreDirection: normalizedScore?.direction ?? null,
      normalizedScoreGap: normalizedScore?.gap ?? null,
      normalizedScoreReason: normalizedScore?.reason ?? null,
      cotCombinedDirection: cotCombined.direction,
      cotCombinedTier: cotCombined.tier,
      cotCombinedReason: cotCombined.reason,
      cotFacesDirection: cotFaces.direction,
      cotFacesTier: cotFaces.tier,
      cotFacesReason: cotFaces.reason,
      cotFacesCommercialDeltaContrarianDirection: cotFacesCommercialDeltaContrarian.direction,
      cotFacesCommercialDeltaContrarianTier: cotFacesCommercialDeltaContrarian.tier,
      cotFacesCommercialDeltaContrarianReason: cotFacesCommercialDeltaContrarian.reason,
    };
  }

  if (ratioDirection) {
    return {
      tier: "neutral_tier1_directional_ratio",
      direction: ratioDirection,
      ratioDirection,
      deltaDirection,
      minLegDirectionalRatio,
      normalizedScoreDirection: normalizedScore?.direction ?? null,
      normalizedScoreGap: normalizedScore?.gap ?? null,
      normalizedScoreReason: normalizedScore?.reason ?? null,
      cotCombinedDirection: cotCombined.direction,
      cotCombinedTier: cotCombined.tier,
      cotCombinedReason: cotCombined.reason,
      cotFacesDirection: cotFaces.direction,
      cotFacesTier: cotFaces.tier,
      cotFacesReason: cotFaces.reason,
      cotFacesCommercialDeltaContrarianDirection: cotFacesCommercialDeltaContrarian.direction,
      cotFacesCommercialDeltaContrarianTier: cotFacesCommercialDeltaContrarian.tier,
      cotFacesCommercialDeltaContrarianReason: cotFacesCommercialDeltaContrarian.reason,
    };
  }

  return {
    tier: "neutral_or_unresolved",
    direction: null,
    ratioDirection,
    deltaDirection,
    minLegDirectionalRatio,
    normalizedScoreDirection: normalizedScore?.direction ?? null,
    normalizedScoreGap: normalizedScore?.gap ?? null,
    normalizedScoreReason: normalizedScore?.reason ?? null,
    cotCombinedDirection: cotCombined.direction,
    cotCombinedTier: cotCombined.tier,
    cotCombinedReason: cotCombined.reason,
    cotFacesDirection: cotFaces.direction,
    cotFacesTier: cotFaces.tier,
    cotFacesReason: cotFaces.reason,
    cotFacesCommercialDeltaContrarianDirection: cotFacesCommercialDeltaContrarian.direction,
    cotFacesCommercialDeltaContrarianTier: cotFacesCommercialDeltaContrarian.tier,
    cotFacesCommercialDeltaContrarianReason: cotFacesCommercialDeltaContrarian.reason,
  };
}

function sourceRuleDecision(options: {
  sourceRuleId: SourceRuleId;
  currentDirection: BasketDirection | "MISSING";
  rule: DealerRule | null;
}): SourceRuleDecision {
  const { sourceRuleId, currentDirection, rule } = options;
  if (!rule) {
    return { direction: "MISSING", tier: null, reason: "missing_dealer_rule" };
  }

  const current = currentDirection === "LONG" || currentDirection === "SHORT" ? currentDirection : null;

  if (sourceRuleId === "dealer_normalized_score_forced28") {
    return rule.normalizedScoreDirection
      ? {
          direction: rule.normalizedScoreDirection,
          tier: "dealer_normalized_score_forced28",
          reason: rule.normalizedScoreReason ?? "normalized_score_direction",
        }
      : {
          direction: currentDirection === "LONG" || currentDirection === "SHORT" ? currentDirection : "MISSING",
          tier: "dealer_normalized_score_forced28",
          reason: "normalized_score_missing_direction",
        };
  }

  if (sourceRuleId === "cot_combined_v1_forced28") {
    return rule.cotCombinedDirection
      ? {
          direction: rule.cotCombinedDirection,
          tier: rule.cotCombinedTier ?? "cot_combined_v1_forced28",
          reason: rule.cotCombinedReason ?? "cot_combined_direction",
        }
      : {
          direction: currentDirection === "LONG" || currentDirection === "SHORT" ? currentDirection : "MISSING",
          tier: rule.cotCombinedTier ?? "cot_combined_v1_forced28",
          reason: rule.cotCombinedReason ?? "cot_combined_missing_direction",
        };
  }

  if (sourceRuleId === "cot_faces_v1_forced") {
    return rule.cotFacesDirection
      ? {
          direction: rule.cotFacesDirection,
          tier: rule.cotFacesTier ?? "cot_faces_v1_forced",
          reason: rule.cotFacesReason ?? "cot_faces_direction",
        }
      : {
          direction: currentDirection === "LONG" || currentDirection === "SHORT" ? currentDirection : "MISSING",
          tier: rule.cotFacesTier ?? "cot_faces_v1_forced",
          reason: rule.cotFacesReason ?? "cot_faces_missing_direction",
        };
  }

  if (sourceRuleId === "cot_faces_v1_commercial_delta_contrarian") {
    return rule.cotFacesCommercialDeltaContrarianDirection
      ? {
          direction: rule.cotFacesCommercialDeltaContrarianDirection,
          tier: rule.cotFacesCommercialDeltaContrarianTier ?? "cot_faces_v1_commercial_delta_contrarian",
          reason: rule.cotFacesCommercialDeltaContrarianReason ?? "cot_faces_commercial_delta_contrarian_direction",
        }
      : {
          direction: currentDirection === "LONG" || currentDirection === "SHORT" ? currentDirection : "MISSING",
          tier: rule.cotFacesCommercialDeltaContrarianTier ?? "cot_faces_v1_commercial_delta_contrarian",
          reason: rule.cotFacesCommercialDeltaContrarianReason ?? "cot_faces_commercial_delta_contrarian_missing_direction",
        };
  }

  if (sourceRuleId === "ratio_direction_all") {
    return rule.ratioDirection
      ? { direction: rule.ratioDirection, tier: rule.tier, reason: rule.ratioDirection === current ? null : "ratio_direction_override" }
      : { direction: "NEUTRAL", tier: rule.tier, reason: "ratio_direction_missing_or_tied" };
  }

  if (sourceRuleId === "ratio_direction_all_current_fallback") {
    if (rule.ratioDirection) {
      return {
        direction: rule.ratioDirection,
        tier: rule.tier,
        reason: rule.ratioDirection === current ? null : "ratio_direction_override",
      };
    }
    if (current) {
      return { direction: current, tier: rule.tier, reason: "ratio_direction_missing_current_fallback" };
    }
    return {
      direction: currentDirection,
      tier: rule.tier,
      reason: currentDirection === "NEUTRAL" ? "ratio_missing_current_neutral" : "ratio_missing_current_missing",
    };
  }

  if (!current) {
    return {
      direction: currentDirection,
      tier: rule.tier,
      reason: currentDirection === "NEUTRAL" ? "current_neutral" : "missing_current_signal",
    };
  }

  const isDirect = rule.tier === "direct_opposed_bias";
  const isNeutral = !isDirect && rule.tier.startsWith("neutral_");

  switch (sourceRuleId) {
    case "current":
      return { direction: current, tier: rule.tier, reason: null };
    case "neutral_only":
      return isNeutral
        ? { direction: current, tier: rule.tier, reason: null }
        : { direction: "NEUTRAL", tier: rule.tier, reason: "direct_rule_abstained" };
    case "direct_delta_confirmed":
      if (!isDirect) return { direction: current, tier: rule.tier, reason: null };
      return rule.deltaDirection === current
        ? { direction: current, tier: rule.tier, reason: null }
        : { direction: "NEUTRAL", tier: rule.tier, reason: "direct_delta_not_confirmed" };
    case "direct_delta_override":
      if (!isDirect) return { direction: current, tier: rule.tier, reason: null };
      return rule.deltaDirection
        ? { direction: rule.deltaDirection, tier: rule.tier, reason: rule.deltaDirection === current ? null : "direct_delta_override" }
        : { direction: "NEUTRAL", tier: rule.tier, reason: "direct_delta_missing" };
    case "direct_raw_delta_leg_ratio0p75":
      if (!isDirect) return { direction: current, tier: rule.tier, reason: null };
      return rule.deltaDirection === current &&
        typeof rule.minLegDirectionalRatio === "number" &&
        rule.minLegDirectionalRatio >= 0.75
        ? { direction: current, tier: rule.tier, reason: null }
        : { direction: "NEUTRAL", tier: rule.tier, reason: "direct_delta_or_spread_quality_failed" };
    case "direct_ratio_confirmed":
      if (!isDirect) return { direction: current, tier: rule.tier, reason: null };
      return rule.ratioDirection === current
        ? { direction: current, tier: rule.tier, reason: null }
        : { direction: "NEUTRAL", tier: rule.tier, reason: "direct_ratio_not_confirmed" };
    case "direct_ratio_override":
      if (!isDirect) return { direction: current, tier: rule.tier, reason: null };
      return rule.ratioDirection
        ? { direction: rule.ratioDirection, tier: rule.tier, reason: rule.ratioDirection === current ? null : "direct_ratio_override" }
        : { direction: "NEUTRAL", tier: rule.tier, reason: "direct_ratio_missing" };
  }
}

function directedReturn(direction: "LONG" | "SHORT", entryPrice: number, exitPrice: number) {
  const raw = ((exitPrice - entryPrice) / entryPrice) * 100;
  return direction === "SHORT" ? -raw : raw;
}

function barsForWindow(bars: CanonicalPriceBar[], entryTimeUtc: string, exitTimeUtc: string) {
  const entryMs = Date.parse(entryTimeUtc);
  const exitMs = Date.parse(exitTimeUtc);
  return bars
    .filter((bar) => {
      const openMs = Date.parse(bar.barOpenUtc);
      return Number.isFinite(openMs) && Number.isFinite(entryMs) && Number.isFinite(exitMs)
        && openMs >= entryMs && openMs < exitMs;
    })
    .sort((left, right) => left.barOpenUtc.localeCompare(right.barOpenUtc));
}

function maxAdverseRawPct(options: {
  direction: BasketDirection | "MISSING";
  entryPrice: number | null;
  bars: CanonicalPriceBar[];
}) {
  if (options.direction !== "LONG" && options.direction !== "SHORT") return null;
  if (options.entryPrice === null || !Number.isFinite(options.entryPrice) || options.entryPrice <= 0) return null;
  if (options.bars.length === 0) return null;

  let adverse = 0;
  for (const bar of options.bars) {
    const adverseMove = options.direction === "SHORT"
      ? bar.highPrice - options.entryPrice
      : options.entryPrice - bar.lowPrice;
    adverse = Math.max(adverse, adverseMove);
  }
  return (adverse / options.entryPrice) * 100;
}

function summarizePath(pathResult: BasketPathResult): PathSummary {
  const points = pathResult.points;
  const peakPoint = points.reduce<BasketPathPoint | null>((best, point) =>
    !best || point.equityPct > best.equityPct ? point : best, null);
  const troughPoint = points.reduce<BasketPathPoint | null>((best, point) =>
    !best || point.equityPct < best.equityPct ? point : best, null);
  const adverseDdPoint = points.reduce<BasketPathPoint | null>((best, point) =>
    !best || point.drawdownPct < best.drawdownPct ? point : best, null);

  let closePeakPct = 0;
  let closeMaxDrawdownPct = 0;
  let closeMaxDrawdownTsUtc: string | null = null;
  for (const point of points) {
    closePeakPct = Math.max(closePeakPct, point.equityPct);
    const drawdown = (100 + closePeakPct) <= 0
      ? 100
      : Math.abs((((100 + point.equityPct) / (100 + closePeakPct)) - 1) * 100);
    if (drawdown > closeMaxDrawdownPct) {
      closeMaxDrawdownPct = drawdown;
      closeMaxDrawdownTsUtc = point.tsUtc;
    }
  }

  return {
    totalReturnPct: round(pathResult.summary.totalReturnPct) ?? 0,
    peakPct: round(pathResult.summary.peakPct) ?? 0,
    peakTsUtc: peakPoint?.tsUtc ?? null,
    troughPct: round(pathResult.summary.troughPct) ?? 0,
    troughTsUtc: troughPoint?.tsUtc ?? null,
    closeEquityMaxDrawdownPct: round(closeMaxDrawdownPct) ?? 0,
    closeEquityMaxDrawdownTsUtc: closeMaxDrawdownTsUtc,
    adverseMaxDrawdownPct: round(pathResult.summary.maxDrawdownPct) ?? 0,
    adverseMaxDrawdownTsUtc: adverseDdPoint?.tsUtc ?? null,
    peakToCloseGivebackPct: round(pathResult.summary.peakToCloseGivebackPct) ?? 0,
    maxActivePositions: pathResult.summary.maxActivePositions,
    points: points.length,
  };
}

async function resolveExecutionReturn(options: {
  symbol: string;
  assetClass: AssetClass;
  weekOpenUtc: string;
  storedRows: Array<{ symbol: string; assetClass: AssetClass; returnPct: number; openPrice: number; closePrice: number }>;
}) {
  const stored = options.storedRows.find((candidate) => candidate.symbol.toUpperCase() === options.symbol);
  if (stored) {
    return { row: stored, source: "stored_pair_period_returns" as const, complete: true, warnings: [] as string[] };
  }

  const derived = await loadExecutionWeeklyReturnFromHourlyBars({
    symbol: options.symbol,
    assetClass: options.assetClass,
    weekOpenUtc: options.weekOpenUtc,
  });
  if (!derived) {
    return { row: null, source: "missing" as const, complete: null, warnings: [] as string[] };
  }
  return {
    row: {
      symbol: derived.symbol,
      assetClass: derived.assetClass,
      returnPct: derived.returnPct,
      openPrice: derived.openPrice,
      closePrice: derived.closePrice,
    },
    source: "derived_canonical_1h" as const,
    complete: derived.complete,
    warnings: derived.warnings,
  };
}

function bandPrices(options: {
  direction: "LONG" | "SHORT";
  runningHigh: number;
  runningLow: number;
  pairAdrPct: number;
  tpMultipleAdr: number;
  slMultipleAdr: number;
}) {
  const tpDistancePct = options.pairAdrPct * options.tpMultipleAdr;
  const slDistancePct = options.pairAdrPct * options.slMultipleAdr;
  if (options.direction === "LONG") {
    return {
      tpPrice: options.runningLow * (1 + tpDistancePct / 100),
      slPrice: options.runningHigh * (1 - slDistancePct / 100),
    };
  }
  return {
    tpPrice: options.runningHigh * (1 - tpDistancePct / 100),
    slPrice: options.runningLow * (1 + slDistancePct / 100),
  };
}

function simulateFixedBandExit(options: {
  direction: "LONG" | "SHORT";
  entryPrice: number;
  weekClosePrice: number;
  anchorTimeUtc: string;
  entryTimeUtc: string;
  weekCloseTimeUtc: string;
  pairAdrPct: number;
  tpMultipleAdr: number;
  slMultipleAdr: number;
  bars: CanonicalPriceBar[];
}) {
  const preEntryBars = barsForWindow(options.bars, options.anchorTimeUtc, options.entryTimeUtc);
  const marketOpenPrice = preEntryBars[0]?.openPrice;
  let runningHigh = marketOpenPrice ?? options.entryPrice;
  let runningLow = marketOpenPrice ?? options.entryPrice;
  let lastTpPrice: number | null = null;
  let lastSlPrice: number | null = null;

  for (const bar of preEntryBars) {
    const { tpPrice, slPrice } = bandPrices({
      direction: options.direction,
      runningHigh,
      runningLow,
      pairAdrPct: options.pairAdrPct,
      tpMultipleAdr: options.tpMultipleAdr,
      slMultipleAdr: options.slMultipleAdr,
    });
    const tpHit = options.direction === "LONG" ? bar.highPrice >= tpPrice : bar.lowPrice <= tpPrice;
    const slHit = options.direction === "LONG" ? bar.lowPrice <= slPrice : bar.highPrice >= slPrice;
    if (tpHit || slHit) {
      return {
        exitPrice: null,
        exitTimeUtc: null,
        exitReason: "pre_entry_invalidated" as const,
        tpPrice,
        slPrice,
        runningHigh,
        runningLow,
        ambiguousExit: tpHit && slHit,
      };
    }
    runningHigh = Math.max(runningHigh, bar.highPrice);
    runningLow = Math.min(runningLow, bar.lowPrice);
  }

  for (const bar of barsForWindow(options.bars, options.entryTimeUtc, options.weekCloseTimeUtc)) {
    const { tpPrice, slPrice } = bandPrices({
      direction: options.direction,
      runningHigh,
      runningLow,
      pairAdrPct: options.pairAdrPct,
      tpMultipleAdr: options.tpMultipleAdr,
      slMultipleAdr: options.slMultipleAdr,
    });
    lastTpPrice = tpPrice;
    lastSlPrice = slPrice;

    const tpHit = options.direction === "LONG" ? bar.highPrice >= tpPrice : bar.lowPrice <= tpPrice;
    const slHit = options.direction === "LONG" ? bar.lowPrice <= slPrice : bar.highPrice >= slPrice;

    if (tpHit || slHit) {
      if (tpHit && slHit) {
        const tpReturn = directedReturn(options.direction, options.entryPrice, tpPrice);
        const slReturn = directedReturn(options.direction, options.entryPrice, slPrice);
        const useStop = slReturn <= tpReturn;
        return {
          exitPrice: useStop ? slPrice : tpPrice,
          exitTimeUtc: bar.barCloseUtc,
          exitReason: "ambiguous_stop_loss" as const,
          tpPrice,
          slPrice,
          runningHigh,
          runningLow,
          ambiguousExit: true,
        };
      }
      return {
        exitPrice: tpHit ? tpPrice : slPrice,
        exitTimeUtc: bar.barCloseUtc,
        exitReason: tpHit ? "take_profit" as const : "stop_loss" as const,
        tpPrice,
        slPrice,
        runningHigh,
        runningLow,
        ambiguousExit: false,
      };
    }

    runningHigh = Math.max(runningHigh, bar.highPrice);
    runningLow = Math.min(runningLow, bar.lowPrice);
  }

  return {
    exitPrice: options.weekClosePrice,
    exitTimeUtc: options.weekCloseTimeUtc,
    exitReason: "week_close" as const,
    tpPrice: lastTpPrice,
    slPrice: lastSlPrice,
    runningHigh,
    runningLow,
    ambiguousExit: false,
  };
}

function simulatePair(base: BasePairWeek, variant: Variant, targetAdrPct: number): PairRow {
  const sourceDecision = base.sourceRuleDecisions[variant.sourceRuleId] ?? {
    direction: base.direction,
    tier: null,
    reason: "missing_source_rule_decision",
  };
  const direction = sourceDecision.direction;
  const missingReason = sourceDecision.reason ?? base.missingReason;
  const missingBase = {
    variantId: variant.id,
    variantLabel: variant.label,
    sourceRuleId: variant.sourceRuleId,
    sourceRuleLabel: variant.sourceRuleLabel,
    sourceRuleTier: sourceDecision.tier,
    sourceRuleReason: sourceDecision.reason,
    tpMultipleAdr: variant.tpMultipleAdr,
    slMultipleAdr: variant.slMultipleAdr,
    anchorMode: variant.anchorMode,
    weekOpenUtc: base.weekOpenUtc,
    pineWeekKey: base.pineWeekKey,
    symbol: base.symbol,
    direction,
    sourceReportDate: base.sourceReportDate,
    executionReturnSource: base.executionReturnSource,
    executionReturnComplete: base.executionReturnComplete,
    executionReturnWarnings: base.executionReturnWarnings,
    entryTimeUtc: null,
    anchorTimeUtc: null,
    exitTimeUtc: null,
    exitReason: "missing" as const,
    entryPrice: round(base.entryPrice),
    exitPrice: round(base.weekClosePrice),
    pairAdrPct: round(base.pairAdrPct),
    adrSource: base.adrSource,
    rawReturnPct: null,
    adrReturnPct: null,
    maxAdverseRawPct: null,
    maxAdverseAdrPct: null,
    tpPrice: null,
    slPrice: null,
    runningHigh: null,
    runningLow: null,
    ambiguousExit: false,
    holdingHours: null,
    missingReason,
  };

  if (direction !== "LONG" && direction !== "SHORT") {
    return { ...missingBase, outcome: outcomeFor(direction, null, null) };
  }
  if (!base.entryPrice || !base.weekClosePrice) {
    return { ...missingBase, outcome: "MISSING_RETURN" };
  }

  const anchorTimeUtc = variant.anchorMode === "market_week" ? base.anchorTimeUtc : base.entryTimeUtc;
  const exit = variant.tpMultipleAdr === null || variant.slMultipleAdr === null
    ? {
        exitPrice: base.weekClosePrice,
        exitTimeUtc: base.weekCloseTimeUtc,
        exitReason: "week_close" as const,
        tpPrice: null,
        slPrice: null,
        runningHigh: null,
        runningLow: null,
        ambiguousExit: false,
      }
    : simulateFixedBandExit({
        direction,
        entryPrice: base.entryPrice,
        weekClosePrice: base.weekClosePrice,
        anchorTimeUtc,
        entryTimeUtc: base.entryTimeUtc,
        weekCloseTimeUtc: base.weekCloseTimeUtc,
        pairAdrPct: base.pairAdrPct,
        tpMultipleAdr: variant.tpMultipleAdr,
        slMultipleAdr: variant.slMultipleAdr,
        bars: base.bars,
      });
  if (exit.exitReason === "pre_entry_invalidated") {
    return {
      ...missingBase,
      entryTimeUtc: base.entryTimeUtc,
      anchorTimeUtc,
      exitTimeUtc: null,
      exitReason: exit.exitReason,
      entryPrice: round(base.entryPrice),
      exitPrice: null,
      tpPrice: round(exit.tpPrice),
      slPrice: round(exit.slPrice),
      runningHigh: round(exit.runningHigh),
      runningLow: round(exit.runningLow),
      ambiguousExit: exit.ambiguousExit,
      outcome: "PRE_ENTRY_INVALIDATED",
      missingReason: "pre_entry_tp_or_sl_hit",
    };
  }
  const rawReturn = directedReturn(direction, base.entryPrice, exit.exitPrice);
  const adrReturn = rawReturn * (targetAdrPct / base.pairAdrPct);
  const heldBars = barsForWindow(base.bars, base.entryTimeUtc, exit.exitTimeUtc);
  const adverseRaw = maxAdverseRawPct({ direction, entryPrice: base.entryPrice, bars: heldBars });
  const adverseAdr = adverseRaw === null ? null : adverseRaw * (targetAdrPct / base.pairAdrPct);
  const entryMs = Date.parse(base.entryTimeUtc);
  const exitMs = Date.parse(exit.exitTimeUtc);

  return {
    ...missingBase,
    entryTimeUtc: base.entryTimeUtc,
    anchorTimeUtc,
    exitTimeUtc: exit.exitTimeUtc,
    exitReason: exit.exitReason,
    entryPrice: round(base.entryPrice),
    exitPrice: round(exit.exitPrice),
    rawReturnPct: round(rawReturn),
    adrReturnPct: round(adrReturn),
    maxAdverseRawPct: round(adverseRaw),
    maxAdverseAdrPct: round(adverseAdr),
    tpPrice: round(exit.tpPrice),
    slPrice: round(exit.slPrice),
    runningHigh: round(exit.runningHigh),
    runningLow: round(exit.runningLow),
    ambiguousExit: exit.ambiguousExit,
    holdingHours: Number.isFinite(entryMs) && Number.isFinite(exitMs) ? round((exitMs - entryMs) / 3_600_000) : null,
    outcome: outcomeFor(direction, rawReturn, adrReturn),
    missingReason: null,
  };
}

function tradeFromRow(row: PairRow, targetAdrPct: number): WeeklyHoldTrade | null {
  if (row.direction !== "LONG" && row.direction !== "SHORT") return null;
  if (!row.entryPrice || !row.exitPrice || row.rawReturnPct === null || row.adrReturnPct === null) return null;
  const pairAdrPct = row.pairAdrPct ?? targetAdrPct;
  return {
    symbol: row.symbol,
    assetClass: "fx",
    direction: row.direction,
    openPrice: row.entryPrice,
    closePrice: row.exitPrice,
    returnPct: row.adrReturnPct,
    rawReturnPct: row.rawReturnPct,
    normalizedReturnPct: row.adrReturnPct,
    displayReturnPct: row.adrReturnPct,
    adrPct: pairAdrPct,
    adrMultiplier: targetAdrPct / pairAdrPct,
    returnMode: "normalized",
    source: "dealer",
    tier: null,
    detail: {
      tradeNumber: 0,
      entryTimeUtc: row.entryTimeUtc,
      exitTimeUtc: row.exitTimeUtc,
      exitReason: row.exitReason,
      anchorPrice: row.runningHigh ?? row.runningLow,
      tpPrice: row.tpPrice,
      adrPct: pairAdrPct,
      maePct: row.maxAdverseRawPct,
    },
  };
}

export async function buildBaseWeek(options: {
  weekOpenUtc: string;
  assetClass: AssetClass;
  expectedPairs: string[];
  sourceRuleIds: SourceRuleId[];
  includePathBars?: boolean;
  includeExecutionContext?: boolean;
}) {
  const { weekOpenUtc, assetClass, expectedPairs, sourceRuleIds } = options;
  const includePathBars = options.includePathBars ?? true;
  const includeExecutionContext = options.includeExecutionContext ?? true;
  const sourceReportDate = deriveCotReportDate(weekOpenUtc);
  const [basketWeek, executionRows, adrMap, snapshot] = await Promise.all([
    getCanonicalBasketWeekForModels(weekOpenUtc, ["dealer"]),
    includeExecutionContext ? getExecutionWeeklyPairReturns(weekOpenUtc) : Promise.resolve([]),
    includeExecutionContext ? loadWeeklyAdrMap(weekOpenUtc) : Promise.resolve(new Map<string, number>()),
    readSnapshot({ assetClass, reportDate: sourceReportDate }),
  ]);
  const signals = filterByModel(basketWeek, "dealer").filter((signal) => signal.assetClass === assetClass);
  const signalBySymbol = new Map(signals.map((signal) => [signal.symbol.toUpperCase(), signal]));
  const executionRowsForAsset = executionRows.filter((row) => row.assetClass === assetClass);
  const executionWindow = getExecutionWeekWindow(weekOpenUtc, assetClass);
  const entryTimeUtc = executionWindow.windowOpenUtc.toUTC().toISO() ?? weekOpenUtc;
  const anchorTimeUtc = marketWeekOpenUtc(weekOpenUtc);
  const weekCloseTimeUtc = executionWindow.windowCloseUtc.toUTC().toISO() ?? weekOpenUtc;
  const bars = includePathBars
    ? await loadPathBars(expectedPairs, anchorTimeUtc, weekCloseTimeUtc)
    : new Map<string, CanonicalPriceBar[]>();
  const scoreCurrencies = Array.from(new Set(expectedPairs.flatMap((symbol) => {
    const pairDef = PAIR_DEF_BY_SYMBOL.get(symbol);
    return pairDef ? [pairDef.base, pairDef.quote] : [];
  })));
  const dealerCurrencyScores = snapshot
    ? buildDealerCurrencyScores(snapshot.currencies, scoreCurrencies)
    : new Map<string, DealerCurrencyScore>();

  const rows: BasePairWeek[] = [];
  for (const symbol of expectedPairs) {
    const signal = signalBySymbol.get(symbol) ?? null;
    const direction = signal?.direction ?? "MISSING";
    const pairDef = PAIR_DEF_BY_SYMBOL.get(symbol);
    const normalizedScore = pairDef
      ? normalizedScoreDecision(pairDef.base, pairDef.quote, dealerCurrencyScores)
      : null;
    const dealerRule = snapshot && pairDef
      ? classifyDealerRule(
          pairDef.base,
          pairDef.quote,
          snapshot.currencies[pairDef.base],
          snapshot.currencies[pairDef.quote],
          normalizedScore,
        )
      : null;
    const sourceRuleDecisions = Object.fromEntries(sourceRuleIds.map((sourceRuleId) => [
      sourceRuleId,
      sourceRuleDecision({ sourceRuleId, currentDirection: direction, rule: dealerRule }),
    ])) as Record<string, SourceRuleDecision>;
    const execution = includeExecutionContext
      ? await resolveExecutionReturn({
          symbol,
          assetClass,
          weekOpenUtc,
          storedRows: executionRowsForAsset,
        })
      : {
          row: null,
          source: "missing" as const,
          complete: null,
          warnings: [] as string[],
        };
    const pairAdrPct = getAdrPct(adrMap, symbol, assetClass);
    rows.push({
      weekOpenUtc,
      pineWeekKey: pineWeekKey(weekOpenUtc),
      symbol,
      assetClass,
      direction,
      sourceReportDate: signal?.sourceReportDate ?? null,
      executionReturnSource: execution.source,
      executionReturnComplete: execution.complete,
      executionReturnWarnings: execution.warnings,
      entryTimeUtc,
      anchorTimeUtc,
      weekCloseTimeUtc,
      entryPrice: execution.row?.openPrice ?? null,
      weekClosePrice: execution.row?.closePrice ?? null,
      pairAdrPct,
      adrSource: adrMap.has(symbol) ? "canonical_price_bars" : "asset_default",
      bars: bars.get(symbol) ?? [],
      missingReason: direction === "MISSING"
        ? "missing_signal"
        : includeExecutionContext && !execution.row
          ? "missing_execution_return"
          : direction === "NEUTRAL"
            ? "neutral_signal"
            : null,
      sourceRuleDecisions,
    });
  }

  return {
    weekOpenUtc,
    entryTimeUtc,
    anchorTimeUtc,
    weekCloseTimeUtc,
    bars,
    rows,
    missingPathBars: expectedPairs.filter((symbol) => (bars.get(symbol)?.length ?? 0) === 0),
  };
}

async function buildVariantWeek(options: {
  variant: Variant;
  baseWeek: Awaited<ReturnType<typeof buildBaseWeek>>;
  targetAdrPct: number;
}) {
  const pairRows = options.baseWeek.rows.map((row) => simulatePair(row, options.variant, options.targetAdrPct));
  const trades = pairRows
    .map((row) => tradeFromRow(row, options.targetAdrPct))
    .filter((trade): trade is WeeklyHoldTrade => trade !== null)
    .map((trade, index) => ({
      ...trade,
      detail: trade.detail ? { ...trade.detail, tradeNumber: index + 1 } : trade.detail,
    }));
  const rawReturnPct = trades.reduce((sum, trade) => sum + (trade.rawReturnPct ?? 0), 0);
  const adrReturnPct = trades.reduce((sum, trade) => sum + (trade.normalizedReturnPct ?? trade.returnPct), 0);
  const result: WeeklyHoldResult = {
    weekOpenUtc: options.baseWeek.weekOpenUtc,
    executionWindowOpenUtc: options.baseWeek.entryTimeUtc,
    executionWindowCloseUtc: options.baseWeek.weekCloseTimeUtc,
    biasSourceId: "dealer",
    trades,
    totalReturnPct: adrReturnPct,
    rawTotalReturnPct: rawReturnPct,
    normalizedTotalReturnPct: adrReturnPct,
    displayTotalReturnPct: adrReturnPct,
    returnMode: "normalized",
    winCount: trades.filter((trade) => trade.returnPct > 0).length,
    lossCount: trades.filter((trade) => trade.returnPct < 0).length,
    winRate: trades.length > 0 ? (trades.filter((trade) => trade.returnPct > 0).length / trades.length) * 100 : 0,
    tradeCount: trades.length,
    signals: trades.map((trade) => ({
      symbol: trade.symbol,
      assetClass: trade.assetClass,
      direction: trade.direction,
      source: trade.source,
      tier: trade.tier,
    })),
    isRealized: true,
    missingPriceSymbols: pairRows.filter((row) => row.executionReturnSource === "missing").map((row) => row.symbol),
  };
  const ledger = await buildWeeklyHoldLedger(result, { entryStyleId: options.variant.id });
  const rawPath = computeBasketPath(ledger, options.baseWeek.bars as PathBarMap, { returnMode: "raw" });
  const adrPath = computeBasketPath(ledger, options.baseWeek.bars as PathBarMap, { returnMode: "normalized" });
  const rawReturns = pairRows.map((row) => row.rawReturnPct ?? 0);
  const adrReturns = pairRows.map((row) => row.adrReturnPct ?? 0);
  const rawProfit = rawReturns.filter((value) => value > 0).reduce((sum, value) => sum + value, 0);
  const rawLoss = Math.abs(rawReturns.filter((value) => value < 0).reduce((sum, value) => sum + value, 0));
  const adrProfit = adrReturns.filter((value) => value > 0).reduce((sum, value) => sum + value, 0);
  const adrLoss = Math.abs(adrReturns.filter((value) => value < 0).reduce((sum, value) => sum + value, 0));

  const receipt: WeekReceipt = {
    variantId: options.variant.id,
    weekOpenUtc: options.baseWeek.weekOpenUtc,
    pineWeekKey: pineWeekKey(options.baseWeek.weekOpenUtc),
    pairRows,
    missingPathBars: options.baseWeek.missingPathBars,
    totals: {
      tradeRows: trades.length,
      wins: pairRows.filter((row) => row.outcome === "WIN").length,
      losses: pairRows.filter((row) => row.outcome === "LOSS").length,
      flat: pairRows.filter((row) => row.outcome === "FLAT").length,
      takeProfitExits: pairRows.filter((row) => row.exitReason === "take_profit").length,
      stopLossExits: pairRows.filter((row) => row.exitReason === "stop_loss" || row.exitReason === "ambiguous_stop_loss").length,
      weekCloseExits: pairRows.filter((row) => row.exitReason === "week_close").length,
      preEntryInvalidatedRows: pairRows.filter((row) => row.exitReason === "pre_entry_invalidated").length,
      ambiguousExits: pairRows.filter((row) => row.ambiguousExit).length,
      missingSignalRows: pairRows.filter((row) => row.outcome === "MISSING_SIGNAL").length,
      missingReturnRows: pairRows.filter((row) => row.outcome === "MISSING_RETURN").length,
      rawReturnPct: round(rawReturnPct) ?? 0,
      adrReturnPct: round(adrReturnPct) ?? 0,
      rawProfitFactor: profitFactor(rawProfit, rawLoss),
      adrProfitFactor: profitFactor(adrProfit, adrLoss),
    },
    path: {
      raw: summarizePath(rawPath),
      adr: summarizePath(adrPath),
    },
  };
  return { receipt, rawPath, adrPath };
}

function summarizeVariant(options: {
  variant: Variant;
  weeks: WeekReceipt[];
  rawPath: PathSummary;
  adrPath: PathSummary;
}): Summary {
  const rows = options.weeks.flatMap((week) => week.pairRows)
    .filter((row) => row.outcome === "WIN" || row.outcome === "LOSS" || row.outcome === "FLAT");
  const weeklyRaw = options.weeks.map((week) => week.totals.rawReturnPct);
  const weeklyAdr = options.weeks.map((week) => week.totals.adrReturnPct);
  const tradeRaw = rows.map((row) => row.rawReturnPct ?? 0);
  const tradeAdr = rows.map((row) => row.adrReturnPct ?? 0);
  const weeklyRawProfit = weeklyRaw.filter((value) => value > 0).reduce((sum, value) => sum + value, 0);
  const weeklyRawLoss = Math.abs(weeklyRaw.filter((value) => value < 0).reduce((sum, value) => sum + value, 0));
  const weeklyAdrProfit = weeklyAdr.filter((value) => value > 0).reduce((sum, value) => sum + value, 0);
  const weeklyAdrLoss = Math.abs(weeklyAdr.filter((value) => value < 0).reduce((sum, value) => sum + value, 0));
  const tradeRawProfit = tradeRaw.filter((value) => value > 0).reduce((sum, value) => sum + value, 0);
  const tradeRawLoss = Math.abs(tradeRaw.filter((value) => value < 0).reduce((sum, value) => sum + value, 0));
  const tradeAdrProfit = tradeAdr.filter((value) => value > 0).reduce((sum, value) => sum + value, 0);
  const tradeAdrLoss = Math.abs(tradeAdr.filter((value) => value < 0).reduce((sum, value) => sum + value, 0));
  const weeklyWins = weeklyAdr.filter((value) => value > 0).length;
  const weeklyLosses = weeklyAdr.filter((value) => value < 0).length;
  const weeklyFlat = weeklyAdr.filter((value) => value === 0).length;
  const tradeWins = rows.filter((row) => (row.adrReturnPct ?? 0) > 0).length;
  const tradeLosses = rows.filter((row) => (row.adrReturnPct ?? 0) < 0).length;
  const tradeFlat = rows.filter((row) => (row.adrReturnPct ?? 0) === 0).length;
  const weeklyAdrMean = average(weeklyAdr);
  const weeklyAdrStdDev = stdDev(weeklyAdr, weeklyAdrMean);
  const tradeRawMean = average(tradeRaw);
  const tradeAdrMean = average(tradeAdr);
  const totalAdrPct = options.adrPath.totalReturnPct;

  return {
    variantId: options.variant.id,
    variantLabel: options.variant.label,
    tpMultipleAdr: options.variant.tpMultipleAdr,
    slMultipleAdr: options.variant.slMultipleAdr,
    anchorMode: options.variant.anchorMode,
    weeklyWins,
    weeklyLosses,
    weeklyFlat,
    weeklyWinRatePct: options.weeks.length > 0 ? (weeklyWins / options.weeks.length) * 100 : 0,
    tradeWins,
    tradeLosses,
    tradeFlat,
    tradeWinRatePct: rows.length > 0 ? (tradeWins / rows.length) * 100 : 0,
    takeProfitExits: rows.filter((row) => row.exitReason === "take_profit").length,
    stopLossExits: rows.filter((row) => row.exitReason === "stop_loss" || row.exitReason === "ambiguous_stop_loss").length,
    weekCloseExits: rows.filter((row) => row.exitReason === "week_close").length,
    preEntryInvalidatedRows: options.weeks
      .flatMap((week) => week.pairRows)
      .filter((row) => row.exitReason === "pre_entry_invalidated").length,
    ambiguousExits: options.weeks
      .flatMap((week) => week.pairRows)
      .filter((row) => row.ambiguousExit).length,
    totalRawPct: options.rawPath.totalReturnPct,
    totalAdrPct,
    weeklyRawProfitFactor: profitFactor(weeklyRawProfit, weeklyRawLoss),
    weeklyAdrProfitFactor: profitFactor(weeklyAdrProfit, weeklyAdrLoss),
    tradeRawProfitFactor: profitFactor(tradeRawProfit, tradeRawLoss),
    tradeAdrProfitFactor: profitFactor(tradeAdrProfit, tradeAdrLoss),
    tradeRawExpectancyPct: round(tradeRawMean),
    tradeAdrExpectancyPct: round(tradeAdrMean),
    weeklyAdrMeanPct: round(weeklyAdrMean),
    weeklyAdrStdDevPct: round(weeklyAdrStdDev),
    weeklySharpeStyleScore: round(
      weeklyAdrStdDev && weeklyAdrMean !== null
        ? (weeklyAdrMean / weeklyAdrStdDev) * Math.sqrt(weeklyAdr.length)
        : null,
    ),
    tpNormalizedAdrReturn: round(ratio(totalAdrPct, options.variant.tpMultipleAdr)),
    slRiskNormalizedAdrReturn: round(ratio(totalAdrPct, options.variant.slMultipleAdr)),
    adverseDdPerAdrReturn: round(positiveReturnRatio(options.adrPath.adverseMaxDrawdownPct, totalAdrPct)),
    givebackPerAdrReturn: round(positiveReturnRatio(options.adrPath.peakToCloseGivebackPct, totalAdrPct)),
    rawPeakPct: options.rawPath.peakPct,
    rawAdverseDrawdownPct: options.rawPath.adverseMaxDrawdownPct,
    rawPeakGivebackPct: options.rawPath.peakToCloseGivebackPct,
    adrPeakPct: options.adrPath.peakPct,
    adrAdverseDrawdownPct: options.adrPath.adverseMaxDrawdownPct,
    adrPeakGivebackPct: options.adrPath.peakToCloseGivebackPct,
  };
}

function buildMarkdown(options: {
  generatedAtUtc: string;
  fromDate: string | null;
  toDate: string | null;
  excludedSourceReportFrom: string | null;
  excludedSourceReportTo: string | null;
  explicitWeekCount: number | null;
  selectedWeekCount: number;
  excludedWeeks: ExcludedWeek[];
  expectedPairs: string[];
  tpMultiples: number[];
  sourceRules: SourceRuleId[];
  variants: Variant[];
  summaries: Summary[];
  weeksByVariant: Record<string, WeekReceipt[]>;
  jsonPath: string;
  csvPath: string;
}) {
  const lines = [
    "# Gate 34 Dealer Weekly Hold Fixed ADR TP/SL Sweep",
    "",
    `Generated: ${options.generatedAtUtc}`,
    "",
    "## Scope",
    "",
    `- Source model: ${sourceModelDescription(options.sourceRules)}`,
    "- Asset class: fx",
    "- Entry style: unchanged Weekly Hold",
    "- Risk overlay: none",
    "- Pair filtering/caps: none",
    "- Basket exits: none",
    `- Source-rule candidates: ${options.sourceRules.map((rule) => SOURCE_RULE_LABELS[rule]).join(", ")}`,
    `- TP variants: ${options.tpMultiples.map((multiple) => `${multiple}x ADR`).join(", ")}`,
    `- SL variants: ${Array.from(new Set(options.variants.filter((variant) => variant.slMultipleAdr !== null).map((variant) => `${variant.slMultipleAdr}x ADR`))).join(", ")}`,
    `- Anchor modes: ${Array.from(new Set(options.variants.filter((variant) => variant.anchorMode !== null).map((variant) => variant.anchorMode))).join(", ")}`,
    `- Expected pair count: ${options.expectedPairs.length}`,
    `- Displayed week filter: ${options.fromDate ?? "-"} -> ${options.toDate ?? "-"}`,
    `- Explicit week inputs: ${options.explicitWeekCount ?? "no"}`,
    `- Selected weeks after source exclusions: ${options.selectedWeekCount}`,
    `- Excluded source report date filter: ${options.excludedSourceReportFrom ?? "-"} -> ${options.excludedSourceReportTo ?? "-"}`,
    `- Excluded weeks: ${options.excludedWeeks.length}`,
    "",
    "## Fixed Band Rule",
    "",
    "- Long TP: `runningWeeklyLow + TP * ADR`; Long SL: `runningWeeklyHigh - SL * ADR`.",
    "- Short TP: `runningWeeklyHigh - TP * ADR`; Short SL: `runningWeeklyLow + SL * ADR`.",
    "- Execution anchor starts running high/low at Limni's trade entry.",
    "- Market-week anchor initializes running high/low from Sunday 17:00 New York time, but exits are still only allowed after Limni's trade entry.",
    "- Extremes update after each 1H bar if no exit was hit. If TP and SL both hit in one 1H bar, the receipt uses the worse exit for that trade.",
    "",
    "## Variant Summary",
    "",
    "| Variant | Anchor | Raw | ADR Norm | Weekly W/L/F | Weekly WR | Weekly ADR PF | Trade PF Raw/ADR | Trade Exp ADR | TP-Norm ADR | SL-Norm ADR | Sharpe-Style | ADR DD/Return | Giveback/Return | TP Exits | SL Exits | Week Close | Pre-entry Skip | Ambiguous | ADR Adv DD | ADR Giveback |",
    "|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|",
  ];
  for (const summary of options.summaries) {
    lines.push(
      `| ${summary.variantLabel} | ${summary.anchorMode ?? "-"} | ${signed(summary.totalRawPct)} | ${signed(summary.totalAdrPct)} | ${summary.weeklyWins}/${summary.weeklyLosses}/${summary.weeklyFlat} | ${fixed(summary.weeklyWinRatePct)}% | ${formatProfitFactor(summary.weeklyAdrProfitFactor)} | ${formatProfitFactor(summary.tradeRawProfitFactor)}/${formatProfitFactor(summary.tradeAdrProfitFactor)} | ${signed(summary.tradeAdrExpectancyPct, 4)} | ${formatRatio(summary.tpNormalizedAdrReturn)} | ${formatRatio(summary.slRiskNormalizedAdrReturn)} | ${formatRatio(summary.weeklySharpeStyleScore)} | ${formatRatio(summary.adverseDdPerAdrReturn)} | ${formatRatio(summary.givebackPerAdrReturn)} | ${summary.takeProfitExits} | ${summary.stopLossExits} | ${summary.weekCloseExits} | ${summary.preEntryInvalidatedRows} | ${summary.ambiguousExits} | ${fixed(summary.adrAdverseDrawdownPct)}% | ${fixed(summary.adrPeakGivebackPct)}% |`,
    );
  }

  if (options.excludedWeeks.length > 0) {
    lines.push(
      "",
      "## Excluded Weeks",
      "",
      "| Week | Source Report Date | Reason |",
      "|---|---|---|",
    );
    for (const week of options.excludedWeeks) {
      lines.push(`| ${week.pineWeekKey} | ${week.sourceReportDate} | ${week.reason} |`);
    }
  }

  for (const variant of options.variants) {
    const weeks = options.weeksByVariant[variant.id] ?? [];
    lines.push(
      "",
      `## Weekly Rows - ${variant.label}`,
      "",
      "| Week | Trades | W/L/F | Raw | ADR Norm | TP | SL | Week Close | Pre-entry Skip | Ambiguous | Raw Adv DD | ADR Adv DD | Missing |",
      "|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|",
    );
    for (const week of weeks) {
      lines.push(
        `| ${week.pineWeekKey} | ${week.totals.tradeRows} | ${week.totals.wins}/${week.totals.losses}/${week.totals.flat} | ${signed(week.totals.rawReturnPct)} | ${signed(week.totals.adrReturnPct)} | ${week.totals.takeProfitExits} | ${week.totals.stopLossExits} | ${week.totals.weekCloseExits} | ${week.totals.preEntryInvalidatedRows} | ${week.totals.ambiguousExits} | ${fixed(week.path.raw.adverseMaxDrawdownPct)}% | ${fixed(week.path.adr.adverseMaxDrawdownPct)}% | ${week.totals.missingSignalRows + week.totals.missingReturnRows + week.missingPathBars.length} |`,
      );
    }
  }

  lines.push(
    "",
    "## Files",
    "",
    `- JSON: ${options.jsonPath}`,
    `- CSV: ${options.csvPath}`,
    "",
  );
  return lines.join("\n");
}

async function main() {
  const assetClass = parseAssetClass();
  const fromDate = argValue("from") ?? "2026-01-01";
  const toDate = argValue("to") ?? "2026-06-08";
  const excludedSourceReportFrom = argValue("exclude-source-report-from") ?? null;
  const excludedSourceReportTo = argValue("exclude-source-report-to") ?? null;
  const outDir = path.resolve(process.cwd(), argValue("out-dir") ?? defaultOutDir());
  const tpMultiples = parseNumberList("tp-multiples", argValue("tp-multiple") ?? "1");
  const slMultiples = parseNumberList("sl-multiples", "0.5,1,1.5,2");
  const anchorModes = parseAnchorModes();
  const sourceRuleIds = parseSourceRules();
  if (assetClass !== "fx") throw new Error("This first fixed-band sweep is intentionally limited to --asset-class fx.");

  const exitVariants: Array<Omit<Variant, "id" | "label" | "sourceRuleId" | "sourceRuleLabel"> & { id: string; label: string }> = [
    { id: "week_close", label: "Week Close", tpMultipleAdr: null, slMultipleAdr: null, anchorMode: null },
    ...anchorModes.flatMap((anchorMode) => tpMultiples.flatMap((tpMultiple) =>
      slMultiples.map((slMultiple) => ({
        id: `${anchorMode}_tp${String(tpMultiple).replace(".", "p")}x_sl${String(slMultiple).replace(".", "p")}x_adr`,
        label: `${anchorMode === "market_week" ? "Market" : "Exec"} TP ${tpMultiple}x / SL ${slMultiple}x`,
        tpMultipleAdr: tpMultiple,
        slMultipleAdr: slMultiple,
        anchorMode,
      })),
    )),
  ];
  const variants: Variant[] = sourceRuleIds.flatMap((sourceRuleId) => exitVariants.map((exitVariant) => ({
    ...exitVariant,
    id: sourceRuleIds.length === 1 && sourceRuleId === "current"
      ? exitVariant.id
      : `${sourceRuleId}__${exitVariant.id}`,
    label: sourceRuleIds.length === 1 && sourceRuleId === "current"
      ? exitVariant.label
      : `${SOURCE_RULE_LABELS[sourceRuleId]} / ${exitVariant.label}`,
    sourceRuleId,
    sourceRuleLabel: SOURCE_RULE_LABELS[sourceRuleId],
  })));
  const expectedPairs = parseExpectedPairs(assetClass);
  const currentWeekOpenUtc = getDisplayWeekOpenUtc();
  const explicitWeeks = parseExplicitWeeks();
  const dateFilteredWeeks = filterWeeksByDate(
    selectClosedWeeks(explicitWeeks ?? await listDataSectionWeeks(), currentWeekOpenUtc),
    { from: fromDate, to: toDate },
  );
  await mkdir(outDir, { recursive: true });
  const { kept: weeks, excluded: excludedWeeks } = filterWeeksByExcludedSourceReports(
    dateFilteredWeeks,
    { from: excludedSourceReportFrom, to: excludedSourceReportTo },
  );
  if (weeks.length === 0) {
    const generatedAtUtc = DateTime.utc().toISO() ?? new Date().toISOString();
    const stamp = DateTime.utc().toFormat("yyyyLLdd-HHmmss");
    const fileStem = `${assetClass}-${expectedPairs.length}pair-${fileStemSourceSlug(sourceRuleIds)}-weekly-hold-fixed-band-sweep-0w-${stamp}`;
    const jsonPath = path.join(outDir, `${fileStem}.json`);
    const csvPath = path.join(outDir, `${fileStem}.csv`);
    const mdPath = path.join(outDir, `${fileStem}.md`);
    const emptyReceipt = {
      schemaVersion: 1,
      generatedAtUtc,
      noData: true,
      scope: {
        gate: "Gate 34 weekly-hold-engine-research",
        sourceModel: sourceModelId(sourceRuleIds),
        assetClass,
        expectedPairs,
        expectedPairCount: expectedPairs.length,
        displayedWeekFrom: fromDate,
        displayedWeekTo: toDate,
        explicitWeekCount: explicitWeeks?.length ?? null,
        dateFilteredWeekCount: dateFilteredWeeks.length,
        selectedWeekCount: weeks.length,
        excludedSourceReportFrom,
        excludedSourceReportTo,
        excludedWeeks,
        variants,
        anchorModes,
        sourceRules: sourceRuleIds,
        pathResolution: "1h",
      },
      summaries: [],
      basketPathByVariant: {},
      weeksByVariant: {},
    };
    await writeFile(jsonPath, `${JSON.stringify(emptyReceipt, null, 2)}\n`, "utf8");
    await writeFile(csvPath, `${CSV_COLUMNS.join(",")}\n`, "utf8");
    await writeFile(mdPath, buildMarkdown({
      generatedAtUtc,
      fromDate,
      toDate,
      excludedSourceReportFrom,
      excludedSourceReportTo,
      explicitWeekCount: explicitWeeks?.length ?? null,
      selectedWeekCount: 0,
      excludedWeeks,
      expectedPairs,
      tpMultiples,
      sourceRules: sourceRuleIds,
      variants,
      summaries: [],
      weeksByVariant: {},
      jsonPath,
      csvPath,
    }), "utf8");

    console.log(`Dealer Weekly Hold fixed-band sweep: ${assetClass} ${expectedPairs.length} pairs`);
    console.log("Weeks: 0");
    console.log(`Date-filtered weeks before source exclusions: ${dateFilteredWeeks.length}`);
    console.log(`Excluded weeks: ${excludedWeeks.length}`);
    console.log(`JSON: ${jsonPath}`);
    console.log(`CSV: ${csvPath}`);
    console.log(`Markdown: ${mdPath}`);
    await getPool().end();
    return;
  }

  const targetAdrPct = getTargetAdrPct();
  const baseWeeks = [];
  for (const weekOpenUtc of weeks) {
    baseWeeks.push(await buildBaseWeek({ weekOpenUtc, assetClass, expectedPairs, sourceRuleIds }));
  }

  const weeksByVariant: Record<string, WeekReceipt[]> = {};
  const rawPathsByVariant: Record<string, BasketPathResult[]> = {};
  const adrPathsByVariant: Record<string, BasketPathResult[]> = {};
  for (const variant of variants) {
    weeksByVariant[variant.id] = [];
    rawPathsByVariant[variant.id] = [];
    adrPathsByVariant[variant.id] = [];
    for (const baseWeek of baseWeeks) {
      const { receipt, rawPath, adrPath } = await buildVariantWeek({ variant, baseWeek, targetAdrPct });
      weeksByVariant[variant.id]?.push(receipt);
      rawPathsByVariant[variant.id]?.push(rawPath);
      adrPathsByVariant[variant.id]?.push(adrPath);
    }
  }

  const summaries: Summary[] = [];
  const basketPathByVariant: Record<string, {
    raw: { summary: PathSummary; points: BasketPathPoint[] };
    adrNormalized: { summary: PathSummary; points: BasketPathPoint[] };
  }> = {};
  for (const variant of variants) {
    const rawMulti = computeMultiWeekBasketPath(rawPathsByVariant[variant.id] ?? []);
    const adrMulti = computeMultiWeekBasketPath(adrPathsByVariant[variant.id] ?? []);
    const rawSummary = summarizePath({
      weekOpenUtc: weeks[0] ?? "",
      strategyId: "dealer",
      entryStyleId: variant.id,
      returnMode: "raw",
      resolution: "1h",
      points: rawMulti.points,
      summary: rawMulti.summary,
    });
    const adrSummary = summarizePath({
      weekOpenUtc: weeks[0] ?? "",
      strategyId: "dealer",
      entryStyleId: variant.id,
      returnMode: "normalized",
      resolution: "1h",
      points: adrMulti.points,
      summary: adrMulti.summary,
    });
    summaries.push(summarizeVariant({
      variant,
      weeks: weeksByVariant[variant.id] ?? [],
      rawPath: rawSummary,
      adrPath: adrSummary,
    }));
    basketPathByVariant[variant.id] = {
      raw: { summary: rawSummary, points: rawMulti.points },
      adrNormalized: { summary: adrSummary, points: adrMulti.points },
    };
  }

  const allPairRows = Object.values(weeksByVariant).flatMap((variantWeeks) =>
    variantWeeks.flatMap((week) => week.pairRows),
  );
  const generatedAtUtc = DateTime.utc().toISO() ?? new Date().toISOString();
  const stamp = DateTime.utc().toFormat("yyyyLLdd-HHmmss");
  const fileStem = `${assetClass}-${expectedPairs.length}pair-${fileStemSourceSlug(sourceRuleIds)}-weekly-hold-fixed-band-sweep-${weeks.length}w-${stamp}`;
  const jsonPath = path.join(outDir, `${fileStem}.json`);
  const csvPath = path.join(outDir, `${fileStem}.csv`);
  const mdPath = path.join(outDir, `${fileStem}.md`);
  const receipt = {
    schemaVersion: 1,
    generatedAtUtc,
    scope: {
      gate: "Gate 34 weekly-hold-engine-research",
      sourceModel: sourceModelId(sourceRuleIds),
      assetClass,
      expectedPairs,
      expectedPairCount: expectedPairs.length,
      displayedWeekFrom: fromDate,
      displayedWeekTo: toDate,
      explicitWeekCount: explicitWeeks?.length ?? null,
      dateFilteredWeekCount: dateFilteredWeeks.length,
      selectedWeekCount: weeks.length,
      excludedSourceReportFrom,
      excludedSourceReportTo,
      excludedWeeks,
      weekOpenUtcs: weeks,
      variants,
      anchorModes,
      sourceRules: sourceRuleIds,
      targetAdrPct,
      pathResolution: "1h",
      sequencing: "extremes update after each 1H bar if no exit was hit; same-bar TP/SL ambiguity is conservative",
    },
    summaries,
    basketPathByVariant,
    weeksByVariant,
  };

  await writeFile(jsonPath, `${JSON.stringify(receipt, null, 2)}\n`, "utf8");
  await writeFile(csvPath, `${toCsv(allPairRows)}\n`, "utf8");
  await writeFile(mdPath, buildMarkdown({
    generatedAtUtc,
    fromDate,
    toDate,
    excludedSourceReportFrom,
    excludedSourceReportTo,
    explicitWeekCount: explicitWeeks?.length ?? null,
    selectedWeekCount: weeks.length,
    excludedWeeks,
    expectedPairs,
    tpMultiples,
    sourceRules: sourceRuleIds,
    variants,
    summaries,
    weeksByVariant,
    jsonPath,
    csvPath,
  }), "utf8");

  console.log(`Dealer Weekly Hold fixed-band sweep: ${assetClass} ${expectedPairs.length} pairs`);
  console.log(`Weeks: ${weeks.length}`);
  console.log(`Date-filtered weeks before source exclusions: ${dateFilteredWeeks.length}`);
  console.log(`Excluded weeks: ${excludedWeeks.length}`);
  for (const summary of summaries) {
    console.log([
      summary.variantLabel.padEnd(18),
      `Raw ${summary.totalRawPct >= 0 ? "+" : ""}${summary.totalRawPct.toFixed(2)}%`,
      `ADR ${summary.totalAdrPct >= 0 ? "+" : ""}${summary.totalAdrPct.toFixed(2)}%`,
      `W/L/F ${summary.weeklyWins}/${summary.weeklyLosses}/${summary.weeklyFlat}`,
      `ADR DD ${summary.adrAdverseDrawdownPct.toFixed(2)}%`,
      `TP ${summary.takeProfitExits}`,
      `SL ${summary.stopLossExits}`,
      `skip ${summary.preEntryInvalidatedRows}`,
      `amb ${summary.ambiguousExits}`,
    ].join(" | "));
  }
  console.log(`JSON: ${jsonPath}`);
  console.log(`CSV: ${csvPath}`);
  console.log(`Markdown: ${mdPath}`);
  await getPool().end();
}

if ((process.argv[1] ?? "").replaceAll("\\", "/").endsWith("/export-weekly-hold-fixed-band-sweep.ts")) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
