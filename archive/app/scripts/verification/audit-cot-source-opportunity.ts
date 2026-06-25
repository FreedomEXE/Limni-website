/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: audit-cot-source-opportunity.ts
 *
 * Description:
 * Gate 34 source-opportunity audit. Rebuilds COT source decisions for an
 * existing receipt scope, then measures selected-direction and opposite-side
 * path opportunity without changing exits or promoting a strategy.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { loadEnvConfig } from "@next/env";
import { DateTime } from "luxon";
import { getPool } from "@/lib/db";
import type { AssetClass } from "@/lib/cotMarkets";
import type { CanonicalPriceBar } from "@/lib/canonicalPriceBars";
import { getTargetAdrPct } from "@/lib/performance/adrLookup";
import { buildWeeklyHoldLedger } from "@/lib/performance/positionLedger";
import { computeBasketPath, type BasketPathPoint } from "@/lib/performance/basketPathEngine";
import type { WeeklyHoldResult, WeeklyHoldTrade } from "@/lib/performance/weeklyHoldEngine";
import { buildBaseWeek, type BasePairWeek, type SourceRuleId } from "./export-weekly-hold-fixed-band-sweep";

loadEnvConfig(process.cwd());

type Direction = "LONG" | "SHORT";

type ReceiptScope = {
  assetClass: AssetClass;
  expectedPairs: string[];
  weekOpenUtcs: string[];
  displayedWeekFrom?: string | null;
  displayedWeekTo?: string | null;
};

type OpportunitySide = {
  direction: Direction;
  mfeAdr: number | null;
  maeAdr: number | null;
  closeAdr: number | null;
  firstTarget0p5TsUtc: string | null;
  firstTarget0p75TsUtc: string | null;
  firstTarget1TsUtc: string | null;
  firstTarget1p25TsUtc: string | null;
  firstTarget1p5TsUtc: string | null;
  firstAdverse0p5TsUtc: string | null;
  firstAdverse1TsUtc: string | null;
  firstAdverse1p5TsUtc: string | null;
  firstAdverse2TsUtc: string | null;
};

type AuditRow = {
  weekOpenUtc: string;
  pineWeekKey: string;
  symbol: string;
  sourceReportDate: string | null;
  sourceRuleId: string;
  selectedDirection: Direction | "MISSING" | "NEUTRAL";
  oppositeDirection: Direction | null;
  sourceTier: string | null;
  sourceReason: string | null;
  pairScore: number | null;
  baseScore: number | null;
  quoteScore: number | null;
  baseMult: number | null;
  quoteMult: number | null;
  agreeWeight: number | null;
  conflictWeight: number | null;
  dealerPair: string | null;
  commercialPair: string | null;
  noncommPair: string | null;
  oiPair: string | null;
  dealerNetDirection: string | null;
  dealerNetGap: number | null;
  dealerDeltaDirection: string | null;
  dealerDeltaGap: number | null;
  commercialNetDirection: string | null;
  commercialNetGap: number | null;
  commercialDeltaDirection: string | null;
  commercialDeltaGap: number | null;
  noncommNetDirection: string | null;
  noncommNetGap: number | null;
  noncommDeltaDirection: string | null;
  noncommDeltaGap: number | null;
  nonreptNetDirection: string | null;
  nonreptNetGap: number | null;
  nonreptDeltaDirection: string | null;
  nonreptDeltaGap: number | null;
  assetMgrNetDirection: string | null;
  assetMgrNetGap: number | null;
  assetMgrDeltaDirection: string | null;
  assetMgrDeltaGap: number | null;
  levMoneyNetDirection: string | null;
  levMoneyNetGap: number | null;
  levMoneyDeltaDirection: string | null;
  levMoneyDeltaGap: number | null;
  entryTimeUtc: string | null;
  weekCloseTimeUtc: string | null;
  entryPrice: number | null;
  weekClosePrice: number | null;
  pairAdrPct: number | null;
  selectedMfeAdr: number | null;
  selectedMaeAdr: number | null;
  selectedCloseAdr: number | null;
  oppositeMfeAdr: number | null;
  oppositeMaeAdr: number | null;
  oppositeCloseAdr: number | null;
  selectedT0p75BeforeA1: boolean | null;
  selectedT1BeforeA1: boolean | null;
  selectedT1BeforeA1p5: boolean | null;
  oppositeT0p75BeforeA1: boolean | null;
  oppositeT1BeforeA1: boolean | null;
  oppositeT1BeforeA1p5: boolean | null;
  opportunityCostT0p75A1: boolean | null;
  opportunityCostT1A1: boolean | null;
  opportunityCostT1A1p5: boolean | null;
  selectedAdvantageT0p75A1: boolean | null;
  selectedAdvantageT1A1: boolean | null;
  selectedAdvantageT1A1p5: boolean | null;
  missingReason: string | null;
};

const TARGETS = [0.5, 0.75, 1, 1.25, 1.5] as const;
const ADVERSE = [0.5, 1, 1.5, 2] as const;
const BASKET_TARGETS = [5, 10, 15, 20] as const;
const BASKET_ADVERSE = [5, 10, 15, 20] as const;

const FACE_LABEL_TO_COLUMN = {
  dealer_net_oi: ["dealerNetDirection", "dealerNetGap"],
  dealer_delta_oi: ["dealerDeltaDirection", "dealerDeltaGap"],
  commercial_net_oi: ["commercialNetDirection", "commercialNetGap"],
  commercial_delta_oi: ["commercialDeltaDirection", "commercialDeltaGap"],
  noncomm_net_oi: ["noncommNetDirection", "noncommNetGap"],
  noncomm_delta_oi: ["noncommDeltaDirection", "noncommDeltaGap"],
  nonrept_net_oi: ["nonreptNetDirection", "nonreptNetGap"],
  nonrept_delta_oi: ["nonreptDeltaDirection", "nonreptDeltaGap"],
  asset_mgr_net_oi: ["assetMgrNetDirection", "assetMgrNetGap"],
  asset_mgr_delta_oi: ["assetMgrDeltaDirection", "assetMgrDeltaGap"],
  lev_money_net_oi: ["levMoneyNetDirection", "levMoneyNetGap"],
  lev_money_delta_oi: ["levMoneyDeltaDirection", "levMoneyDeltaGap"],
} as const;

const CSV_COLUMNS: Array<keyof AuditRow> = [
  "weekOpenUtc",
  "pineWeekKey",
  "symbol",
  "sourceReportDate",
  "sourceRuleId",
  "selectedDirection",
  "oppositeDirection",
  "sourceTier",
  "pairScore",
  "baseScore",
  "quoteScore",
  "baseMult",
  "quoteMult",
  "agreeWeight",
  "conflictWeight",
  "dealerPair",
  "commercialPair",
  "noncommPair",
  "oiPair",
  "dealerNetDirection",
  "dealerNetGap",
  "dealerDeltaDirection",
  "dealerDeltaGap",
  "commercialNetDirection",
  "commercialNetGap",
  "commercialDeltaDirection",
  "commercialDeltaGap",
  "noncommNetDirection",
  "noncommNetGap",
  "noncommDeltaDirection",
  "noncommDeltaGap",
  "nonreptNetDirection",
  "nonreptNetGap",
  "nonreptDeltaDirection",
  "nonreptDeltaGap",
  "assetMgrNetDirection",
  "assetMgrNetGap",
  "assetMgrDeltaDirection",
  "assetMgrDeltaGap",
  "levMoneyNetDirection",
  "levMoneyNetGap",
  "levMoneyDeltaDirection",
  "levMoneyDeltaGap",
  "entryTimeUtc",
  "weekCloseTimeUtc",
  "entryPrice",
  "weekClosePrice",
  "pairAdrPct",
  "selectedMfeAdr",
  "selectedMaeAdr",
  "selectedCloseAdr",
  "oppositeMfeAdr",
  "oppositeMaeAdr",
  "oppositeCloseAdr",
  "selectedT0p75BeforeA1",
  "selectedT1BeforeA1",
  "selectedT1BeforeA1p5",
  "oppositeT0p75BeforeA1",
  "oppositeT1BeforeA1",
  "oppositeT1BeforeA1p5",
  "opportunityCostT0p75A1",
  "opportunityCostT1A1",
  "opportunityCostT1A1p5",
  "selectedAdvantageT0p75A1",
  "selectedAdvantageT1A1",
  "selectedAdvantageT1A1p5",
  "missingReason",
  "sourceReason",
];

function argValue(name: string): string | null {
  const direct = process.argv.find((arg) => arg.startsWith(`--${name}=`));
  if (direct) return direct.slice(name.length + 3);
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] ?? null : null;
}

function argFlag(name: string) {
  return process.argv.includes(`--${name}`);
}

function round(value: number | null | undefined, places = 6) {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

function signed(value: number | null | undefined, places = 2) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "-";
  return `${value >= 0 ? "+" : ""}${value.toFixed(places)}`;
}

function csvEscape(value: unknown) {
  if (value === null || value === undefined) return "";
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll("\"", "\"\"")}"` : text;
}

function toCsv(rows: AuditRow[]) {
  return [
    CSV_COLUMNS.join(","),
    ...rows.map((row) => CSV_COLUMNS.map((column) => csvEscape(row[column])).join(",")),
  ].join("\n");
}

function safeRatio(numerator: number, denominator: number) {
  return denominator > 0 ? numerator / denominator : null;
}

function average(values: number[]) {
  return values.length > 0 ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}

function parseNumberToken(reason: string | null, token: string) {
  if (!reason) return null;
  const match = reason.match(new RegExp(`(?:^| )${token}=([^ ]+)`));
  const value = match?.[1] ?? null;
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseStringToken(reason: string | null, token: string) {
  if (!reason) return null;
  const match = reason.match(new RegExp(`(?:^| )${token}=([^ ]+)`));
  return match?.[1] ?? null;
}

function parseSourceReason(reason: string | null) {
  const parsed = {
    pairScore: parseNumberToken(reason, "pair_score"),
    baseScore: parseNumberToken(reason, "base_score"),
    quoteScore: parseNumberToken(reason, "quote_score"),
    baseMult: parseNumberToken(reason, "base_mult"),
    quoteMult: parseNumberToken(reason, "quote_mult"),
    agreeWeight: parseNumberToken(reason, "agree_w"),
    conflictWeight: parseNumberToken(reason, "conflict_w"),
    dealerPair: parseStringToken(reason, "dealer_pair"),
    commercialPair: parseStringToken(reason, "commercial_pair"),
    noncommPair: parseStringToken(reason, "noncomm_pair"),
    oiPair: parseStringToken(reason, "oi_pair"),
  } as Partial<AuditRow>;

  if (!reason) return parsed;
  for (const token of reason.split(/\s+/)) {
    const match = token.match(/^([a-z_]+_oi):(LONG|SHORT|none):([^ ]+)$/);
    if (!match) continue;
    const label = match[1] as keyof typeof FACE_LABEL_TO_COLUMN;
    const columns = FACE_LABEL_TO_COLUMN[label];
    if (!columns) continue;
    const [directionColumn, gapColumn] = columns;
    const gap = Number(match[3]);
    parsed[directionColumn as keyof AuditRow] = match[2] as never;
    parsed[gapColumn as keyof AuditRow] = (Number.isFinite(gap) ? gap : null) as never;
  }
  return parsed;
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

function directedReturnPct(direction: Direction, entryPrice: number, exitPrice: number) {
  const raw = ((exitPrice - entryPrice) / entryPrice) * 100;
  return direction === "SHORT" ? -raw : raw;
}

function firstBefore(firstTs: string | null, secondTs: string | null) {
  if (!firstTs) return false;
  if (!secondTs) return true;
  return Date.parse(firstTs) < Date.parse(secondTs);
}

function opportunityForSide(options: {
  direction: Direction;
  entryPrice: number | null;
  weekClosePrice: number | null;
  pairAdrPct: number | null;
  entryTimeUtc: string;
  weekCloseTimeUtc: string;
  bars: CanonicalPriceBar[];
}): OpportunitySide {
  const side: OpportunitySide = {
    direction: options.direction,
    mfeAdr: null,
    maeAdr: null,
    closeAdr: null,
    firstTarget0p5TsUtc: null,
    firstTarget0p75TsUtc: null,
    firstTarget1TsUtc: null,
    firstTarget1p25TsUtc: null,
    firstTarget1p5TsUtc: null,
    firstAdverse0p5TsUtc: null,
    firstAdverse1TsUtc: null,
    firstAdverse1p5TsUtc: null,
    firstAdverse2TsUtc: null,
  };
  if (!options.entryPrice || !options.weekClosePrice || !options.pairAdrPct || options.pairAdrPct <= 0) {
    return side;
  }

  const targetKeys = {
    0.5: "firstTarget0p5TsUtc",
    0.75: "firstTarget0p75TsUtc",
    1: "firstTarget1TsUtc",
    1.25: "firstTarget1p25TsUtc",
    1.5: "firstTarget1p5TsUtc",
  } as const;
  const adverseKeys = {
    0.5: "firstAdverse0p5TsUtc",
    1: "firstAdverse1TsUtc",
    1.5: "firstAdverse1p5TsUtc",
    2: "firstAdverse2TsUtc",
  } as const;

  let mfeAdr = 0;
  let maeAdr = 0;
  for (const bar of barsForWindow(options.bars, options.entryTimeUtc, options.weekCloseTimeUtc)) {
    const favorableRawPct = options.direction === "LONG"
      ? ((bar.highPrice - options.entryPrice) / options.entryPrice) * 100
      : ((options.entryPrice - bar.lowPrice) / options.entryPrice) * 100;
    const adverseRawPct = options.direction === "LONG"
      ? ((options.entryPrice - bar.lowPrice) / options.entryPrice) * 100
      : ((bar.highPrice - options.entryPrice) / options.entryPrice) * 100;
    const favorableAdr = favorableRawPct / options.pairAdrPct;
    const adverseAdr = adverseRawPct / options.pairAdrPct;
    mfeAdr = Math.max(mfeAdr, favorableAdr);
    maeAdr = Math.max(maeAdr, adverseAdr);

    for (const target of TARGETS) {
      const key = targetKeys[target];
      if (!side[key] && favorableAdr >= target) side[key] = bar.barCloseUtc;
    }
    for (const adverse of ADVERSE) {
      const key = adverseKeys[adverse];
      if (!side[key] && adverseAdr >= adverse) side[key] = bar.barCloseUtc;
    }
  }

  side.mfeAdr = round(mfeAdr, 4);
  side.maeAdr = round(maeAdr, 4);
  side.closeAdr = round(directedReturnPct(options.direction, options.entryPrice, options.weekClosePrice) / options.pairAdrPct, 4);
  return side;
}

function oppositeDirection(direction: Direction | "MISSING" | "NEUTRAL"): Direction | null {
  if (direction === "LONG") return "SHORT";
  if (direction === "SHORT") return "LONG";
  return null;
}

function auditRowFromBase(row: BasePairWeek, sourceRuleId: SourceRuleId): AuditRow {
  const decision = row.sourceRuleDecisions[sourceRuleId] ?? {
    direction: row.direction,
    tier: null,
    reason: "missing_source_rule_decision",
  };
  const selectedDirection = decision.direction;
  const opposite = oppositeDirection(selectedDirection);
  const parsed = parseSourceReason(decision.reason);
  const selected = selectedDirection === "LONG" || selectedDirection === "SHORT"
    ? opportunityForSide({
        direction: selectedDirection,
        entryPrice: row.entryPrice,
        weekClosePrice: row.weekClosePrice,
        pairAdrPct: row.pairAdrPct,
        entryTimeUtc: row.entryTimeUtc,
        weekCloseTimeUtc: row.weekCloseTimeUtc,
        bars: row.bars,
      })
    : null;
  const oppositeSide = opposite
    ? opportunityForSide({
        direction: opposite,
        entryPrice: row.entryPrice,
        weekClosePrice: row.weekClosePrice,
        pairAdrPct: row.pairAdrPct,
        entryTimeUtc: row.entryTimeUtc,
        weekCloseTimeUtc: row.weekCloseTimeUtc,
        bars: row.bars,
      })
    : null;

  const selectedT0p75A1 = selected ? firstBefore(selected.firstTarget0p75TsUtc, selected.firstAdverse1TsUtc) : null;
  const selectedT1A1 = selected ? firstBefore(selected.firstTarget1TsUtc, selected.firstAdverse1TsUtc) : null;
  const selectedT1A1p5 = selected ? firstBefore(selected.firstTarget1TsUtc, selected.firstAdverse1p5TsUtc) : null;
  const oppositeT0p75A1 = oppositeSide ? firstBefore(oppositeSide.firstTarget0p75TsUtc, oppositeSide.firstAdverse1TsUtc) : null;
  const oppositeT1A1 = oppositeSide ? firstBefore(oppositeSide.firstTarget1TsUtc, oppositeSide.firstAdverse1TsUtc) : null;
  const oppositeT1A1p5 = oppositeSide ? firstBefore(oppositeSide.firstTarget1TsUtc, oppositeSide.firstAdverse1p5TsUtc) : null;

  return {
    weekOpenUtc: row.weekOpenUtc,
    pineWeekKey: row.pineWeekKey,
    symbol: row.symbol,
    sourceReportDate: row.sourceReportDate,
    sourceRuleId,
    selectedDirection,
    oppositeDirection: opposite,
    sourceTier: decision.tier,
    sourceReason: decision.reason,
    pairScore: parsed.pairScore ?? null,
    baseScore: parsed.baseScore ?? null,
    quoteScore: parsed.quoteScore ?? null,
    baseMult: parsed.baseMult ?? null,
    quoteMult: parsed.quoteMult ?? null,
    agreeWeight: parsed.agreeWeight ?? null,
    conflictWeight: parsed.conflictWeight ?? null,
    dealerPair: parsed.dealerPair ?? null,
    commercialPair: parsed.commercialPair ?? null,
    noncommPair: parsed.noncommPair ?? null,
    oiPair: parsed.oiPair ?? null,
    dealerNetDirection: parsed.dealerNetDirection ?? null,
    dealerNetGap: parsed.dealerNetGap ?? null,
    dealerDeltaDirection: parsed.dealerDeltaDirection ?? null,
    dealerDeltaGap: parsed.dealerDeltaGap ?? null,
    commercialNetDirection: parsed.commercialNetDirection ?? null,
    commercialNetGap: parsed.commercialNetGap ?? null,
    commercialDeltaDirection: parsed.commercialDeltaDirection ?? null,
    commercialDeltaGap: parsed.commercialDeltaGap ?? null,
    noncommNetDirection: parsed.noncommNetDirection ?? null,
    noncommNetGap: parsed.noncommNetGap ?? null,
    noncommDeltaDirection: parsed.noncommDeltaDirection ?? null,
    noncommDeltaGap: parsed.noncommDeltaGap ?? null,
    nonreptNetDirection: parsed.nonreptNetDirection ?? null,
    nonreptNetGap: parsed.nonreptNetGap ?? null,
    nonreptDeltaDirection: parsed.nonreptDeltaDirection ?? null,
    nonreptDeltaGap: parsed.nonreptDeltaGap ?? null,
    assetMgrNetDirection: parsed.assetMgrNetDirection ?? null,
    assetMgrNetGap: parsed.assetMgrNetGap ?? null,
    assetMgrDeltaDirection: parsed.assetMgrDeltaDirection ?? null,
    assetMgrDeltaGap: parsed.assetMgrDeltaGap ?? null,
    levMoneyNetDirection: parsed.levMoneyNetDirection ?? null,
    levMoneyNetGap: parsed.levMoneyNetGap ?? null,
    levMoneyDeltaDirection: parsed.levMoneyDeltaDirection ?? null,
    levMoneyDeltaGap: parsed.levMoneyDeltaGap ?? null,
    entryTimeUtc: row.entryTimeUtc,
    weekCloseTimeUtc: row.weekCloseTimeUtc,
    entryPrice: round(row.entryPrice),
    weekClosePrice: round(row.weekClosePrice),
    pairAdrPct: round(row.pairAdrPct, 4),
    selectedMfeAdr: selected?.mfeAdr ?? null,
    selectedMaeAdr: selected?.maeAdr ?? null,
    selectedCloseAdr: selected?.closeAdr ?? null,
    oppositeMfeAdr: oppositeSide?.mfeAdr ?? null,
    oppositeMaeAdr: oppositeSide?.maeAdr ?? null,
    oppositeCloseAdr: oppositeSide?.closeAdr ?? null,
    selectedT0p75BeforeA1: selectedT0p75A1,
    selectedT1BeforeA1: selectedT1A1,
    selectedT1BeforeA1p5: selectedT1A1p5,
    oppositeT0p75BeforeA1: oppositeT0p75A1,
    oppositeT1BeforeA1: oppositeT1A1,
    oppositeT1BeforeA1p5: oppositeT1A1p5,
    opportunityCostT0p75A1: selectedT0p75A1 === false && oppositeT0p75A1 === true,
    opportunityCostT1A1: selectedT1A1 === false && oppositeT1A1 === true,
    opportunityCostT1A1p5: selectedT1A1p5 === false && oppositeT1A1p5 === true,
    selectedAdvantageT0p75A1: selectedT0p75A1 === true && oppositeT0p75A1 === false,
    selectedAdvantageT1A1: selectedT1A1 === true && oppositeT1A1 === false,
    selectedAdvantageT1A1p5: selectedT1A1p5 === true && oppositeT1A1p5 === false,
    missingReason: row.missingReason,
  };
}

function weeklyHoldTradeFromBase(row: BasePairWeek, sourceRuleId: SourceRuleId, targetAdrPct: number): WeeklyHoldTrade | null {
  const decision = row.sourceRuleDecisions[sourceRuleId];
  const direction = decision?.direction ?? row.direction;
  if (direction !== "LONG" && direction !== "SHORT") return null;
  if (!row.entryPrice || !row.weekClosePrice || !row.pairAdrPct || row.pairAdrPct <= 0) return null;
  const rawReturnPct = directedReturnPct(direction, row.entryPrice, row.weekClosePrice);
  const adrReturnPct = rawReturnPct * (targetAdrPct / row.pairAdrPct);
  return {
    symbol: row.symbol,
    assetClass: "fx",
    direction,
    openPrice: row.entryPrice,
    closePrice: row.weekClosePrice,
    returnPct: adrReturnPct,
    rawReturnPct,
    normalizedReturnPct: adrReturnPct,
    displayReturnPct: adrReturnPct,
    adrPct: row.pairAdrPct,
    adrMultiplier: targetAdrPct / row.pairAdrPct,
    returnMode: "normalized",
    source: "dealer",
    tier: decision?.tier ?? null,
    detail: {
      tradeNumber: 0,
      entryTimeUtc: row.entryTimeUtc,
      exitTimeUtc: row.weekCloseTimeUtc,
      exitReason: "week_close",
      adrPct: row.pairAdrPct,
    },
  };
}

function firstBasketTarget(points: BasketPathPoint[], target: number) {
  return points.find((point) => point.equityPct >= target)?.tsUtc ?? null;
}

function firstBasketAdverse(points: BasketPathPoint[], adverse: number) {
  return points.find((point) => point.equityPct <= -adverse)?.tsUtc ?? null;
}

async function basketWeekSummary(options: {
  baseWeek: Awaited<ReturnType<typeof buildBaseWeek>>;
  sourceRuleId: SourceRuleId;
  targetAdrPct: number;
}) {
  const trades = options.baseWeek.rows
    .map((row) => weeklyHoldTradeFromBase(row, options.sourceRuleId, options.targetAdrPct))
    .filter((trade): trade is WeeklyHoldTrade => trade !== null)
    .map((trade, index) => ({
      ...trade,
      detail: trade.detail ? { ...trade.detail, tradeNumber: index + 1 } : trade.detail,
    }));
  const totalReturnPct = trades.reduce((sum, trade) => sum + (trade.normalizedReturnPct ?? trade.returnPct), 0);
  const result: WeeklyHoldResult = {
    weekOpenUtc: options.baseWeek.weekOpenUtc,
    executionWindowOpenUtc: options.baseWeek.entryTimeUtc,
    executionWindowCloseUtc: options.baseWeek.weekCloseTimeUtc,
    biasSourceId: "cot_source_opportunity",
    trades,
    totalReturnPct,
    rawTotalReturnPct: trades.reduce((sum, trade) => sum + (trade.rawReturnPct ?? 0), 0),
    normalizedTotalReturnPct: totalReturnPct,
    displayTotalReturnPct: totalReturnPct,
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
    missingPriceSymbols: options.baseWeek.rows.filter((row) => row.executionReturnSource === "missing").map((row) => row.symbol),
  };
  const ledger = await buildWeeklyHoldLedger(result, { entryStyleId: `${options.sourceRuleId}_source_opportunity` });
  const pathResult = computeBasketPath(ledger, options.baseWeek.bars, { returnMode: "normalized" });
  const points = pathResult.points;
  const peak = Math.max(...points.map((point) => point.equityPct), 0);
  const trough = Math.min(...points.map((point) => point.equityPct), 0);

  return {
    weekOpenUtc: options.baseWeek.weekOpenUtc,
    pineWeekKey: options.baseWeek.rows[0]?.pineWeekKey ?? options.baseWeek.weekOpenUtc,
    tradeCount: trades.length,
    closeAdr: round(pathResult.summary.totalReturnPct, 4),
    peakAdr: round(peak, 4),
    troughAdr: round(trough, 4),
    maxDrawdownAdr: round(pathResult.summary.maxDrawdownPct, 4),
    target5BeforeAdverse10: firstBefore(firstBasketTarget(points, 5), firstBasketAdverse(points, 10)),
    target10BeforeAdverse10: firstBefore(firstBasketTarget(points, 10), firstBasketAdverse(points, 10)),
    target15BeforeAdverse15: firstBefore(firstBasketTarget(points, 15), firstBasketAdverse(points, 15)),
    firstTarget5TsUtc: firstBasketTarget(points, 5),
    firstTarget10TsUtc: firstBasketTarget(points, 10),
    firstTarget15TsUtc: firstBasketTarget(points, 15),
    firstTarget20TsUtc: firstBasketTarget(points, 20),
    firstAdverse5TsUtc: firstBasketAdverse(points, 5),
    firstAdverse10TsUtc: firstBasketAdverse(points, 10),
    firstAdverse15TsUtc: firstBasketAdverse(points, 15),
    firstAdverse20TsUtc: firstBasketAdverse(points, 20),
  };
}

function summarizeGroup(rows: AuditRow[], key: "symbol" | "sourceTier") {
  const groups = new Map<string, AuditRow[]>();
  for (const row of rows) {
    const groupKey = String(row[key] ?? "missing");
    groups.set(groupKey, [...(groups.get(groupKey) ?? []), row]);
  }
  return Array.from(groups.entries()).map(([group, groupRows]) => {
    const selectedT1 = groupRows.filter((row) => row.selectedT1BeforeA1).length;
    const oppositeT1 = groupRows.filter((row) => row.oppositeT1BeforeA1).length;
    const opportunityCost = groupRows.filter((row) => row.opportunityCostT1A1).length;
    const selectedAdvantage = groupRows.filter((row) => row.selectedAdvantageT1A1).length;
    const validMfe = groupRows.map((row) => row.selectedMfeAdr).filter((value): value is number => typeof value === "number");
    const validMae = groupRows.map((row) => row.selectedMaeAdr).filter((value): value is number => typeof value === "number");
    const validClose = groupRows.map((row) => row.selectedCloseAdr).filter((value): value is number => typeof value === "number");
    return {
      group,
      rows: groupRows.length,
      selectedT1BeforeA1: selectedT1,
      selectedT1Rate: safeRatio(selectedT1, groupRows.length),
      oppositeT1BeforeA1: oppositeT1,
      oppositeT1Rate: safeRatio(oppositeT1, groupRows.length),
      opportunityCostT1A1: opportunityCost,
      opportunityCostRate: safeRatio(opportunityCost, groupRows.length),
      selectedAdvantageT1A1: selectedAdvantage,
      selectedAdvantageRate: safeRatio(selectedAdvantage, groupRows.length),
      avgSelectedMfeAdr: average(validMfe),
      avgSelectedMaeAdr: average(validMae),
      avgSelectedCloseAdr: average(validClose),
    };
  }).sort((left, right) => (
    right.opportunityCostT1A1 - left.opportunityCostT1A1 ||
    (left.avgSelectedCloseAdr ?? 0) - (right.avgSelectedCloseAdr ?? 0)
  ));
}

function buildMarkdown(options: {
  generatedAtUtc: string;
  receiptPath: string;
  sourceRuleId: SourceRuleId;
  rows: AuditRow[];
  pairSummary: ReturnType<typeof summarizeGroup>;
  tierSummary: ReturnType<typeof summarizeGroup>;
  basketWeeks: Awaited<ReturnType<typeof basketWeekSummary>>[];
  jsonPath: string;
  csvPath: string;
}) {
  const rows = options.rows;
  const selectedT1 = rows.filter((row) => row.selectedT1BeforeA1).length;
  const oppositeT1 = rows.filter((row) => row.oppositeT1BeforeA1).length;
  const opportunityCost = rows.filter((row) => row.opportunityCostT1A1).length;
  const selectedAdvantage = rows.filter((row) => row.selectedAdvantageT1A1).length;
  const basketTarget10 = options.basketWeeks.filter((week) => week.target10BeforeAdverse10).length;
  const basketWins = options.basketWeeks.filter((week) => (week.closeAdr ?? 0) > 0).length;
  const basketLosses = options.basketWeeks.filter((week) => (week.closeAdr ?? 0) < 0).length;
  const basketLines = options.basketWeeks.length > 0
    ? [
        `- Weeks positive at close: ${basketWins}/${options.basketWeeks.length}`,
        `- Weeks negative at close: ${basketLosses}/${options.basketWeeks.length}`,
        `- Weeks basket hit +10 before -10: ${basketTarget10}/${options.basketWeeks.length}`,
        "",
        "| Week | Trades | Close ADR | Peak ADR | Trough ADR | Max DD | +5 before -10 | +10 before -10 | +15 before -15 |",
        "|---|---:|---:|---:|---:|---:|---:|---:|---:|",
        ...options.basketWeeks.map((week) =>
          `| ${week.pineWeekKey} | ${week.tradeCount} | ${signed(week.closeAdr)} | ${signed(week.peakAdr)} | ${signed(week.troughAdr)} | ${signed(week.maxDrawdownAdr)} | ${week.target5BeforeAdverse10} | ${week.target10BeforeAdverse10} | ${week.target15BeforeAdverse15} |`),
      ]
    : [
        "- Basket opportunity skipped by `--skip-basket`; pair-level selected-vs-opposite diagnostics are still included.",
      ];

  const lines = [
    "# Gate 34 COT Source Opportunity Audit",
    "",
    `Generated: ${options.generatedAtUtc}`,
    "",
    "## Scope",
    "",
    `- Source rule: ${options.sourceRuleId}`,
    `- Receipt scope: ${options.receiptPath}`,
    `- Pair/week rows: ${rows.length}`,
    "- Purpose: source diagnostics only; this is not exit optimization.",
    "",
    "## Overall Opportunity",
    "",
    "| Metric | Count | Rate |",
    "|---|---:|---:|",
    `| Selected direction hit +1 ADR before -1 ADR | ${selectedT1} | ${signed((safeRatio(selectedT1, rows.length) ?? 0) * 100)}% |`,
    `| Opposite direction hit +1 ADR before -1 ADR | ${oppositeT1} | ${signed((safeRatio(oppositeT1, rows.length) ?? 0) * 100)}% |`,
    `| Opportunity cost: opposite passed while selected failed | ${opportunityCost} | ${signed((safeRatio(opportunityCost, rows.length) ?? 0) * 100)}% |`,
    `| Selected advantage: selected passed while opposite failed | ${selectedAdvantage} | ${signed((safeRatio(selectedAdvantage, rows.length) ?? 0) * 100)}% |`,
    "",
    "## Basket Opportunity",
    "",
    ...basketLines,
    "",
    "## Worst Pair Opportunity Cost",
    "",
    "| Pair | Rows | Selected +1/-1 | Opposite +1/-1 | Opp Cost | Selected Adv | Avg MFE | Avg MAE | Avg Close |",
    "|---|---:|---:|---:|---:|---:|---:|---:|---:|",
    ...options.pairSummary.slice(0, 14).map((item) =>
      `| ${item.group} | ${item.rows} | ${item.selectedT1BeforeA1} (${signed((item.selectedT1Rate ?? 0) * 100)}%) | ${item.oppositeT1BeforeA1} (${signed((item.oppositeT1Rate ?? 0) * 100)}%) | ${item.opportunityCostT1A1} | ${item.selectedAdvantageT1A1} | ${signed(item.avgSelectedMfeAdr, 3)} | ${signed(item.avgSelectedMaeAdr, 3)} | ${signed(item.avgSelectedCloseAdr, 3)} |`),
    "",
    "## Tier Opportunity Cost",
    "",
    "| Tier | Rows | Selected +1/-1 | Opposite +1/-1 | Opp Cost | Selected Adv | Avg MFE | Avg MAE | Avg Close |",
    "|---|---:|---:|---:|---:|---:|---:|---:|---:|",
    ...options.tierSummary.map((item) =>
      `| ${item.group} | ${item.rows} | ${item.selectedT1BeforeA1} (${signed((item.selectedT1Rate ?? 0) * 100)}%) | ${item.oppositeT1BeforeA1} (${signed((item.oppositeT1Rate ?? 0) * 100)}%) | ${item.opportunityCostT1A1} | ${item.selectedAdvantageT1A1} | ${signed(item.avgSelectedMfeAdr, 3)} | ${signed(item.avgSelectedMaeAdr, 3)} | ${signed(item.avgSelectedCloseAdr, 3)} |`),
    "",
    "## Files",
    "",
    `- JSON: ${options.jsonPath}`,
    `- CSV: ${options.csvPath}`,
    "",
  ];
  return lines.join("\n");
}

async function readScopeFromReceipt(receiptPath: string): Promise<ReceiptScope> {
  const receipt = JSON.parse(await readFile(receiptPath, "utf8"));
  const scope = receipt.scope ?? {};
  if (!Array.isArray(scope.weekOpenUtcs) || scope.weekOpenUtcs.length === 0) {
    throw new Error("Receipt scope must include weekOpenUtcs.");
  }
  if (!Array.isArray(scope.expectedPairs) || scope.expectedPairs.length === 0) {
    throw new Error("Receipt scope must include expectedPairs.");
  }
  if (scope.assetClass !== "fx") {
    throw new Error("Only fx receipt scopes are supported for this audit.");
  }
  return {
    assetClass: scope.assetClass,
    expectedPairs: scope.expectedPairs.map((pair: string) => pair.toUpperCase()),
    weekOpenUtcs: scope.weekOpenUtcs,
    displayedWeekFrom: scope.displayedWeekFrom ?? null,
    displayedWeekTo: scope.displayedWeekTo ?? null,
  };
}

async function main() {
  const receiptPathArg = argValue("receipt");
  if (!receiptPathArg) throw new Error("--receipt is required.");
  const receiptPath = path.resolve(process.cwd(), receiptPathArg);
  const sourceRuleId = (argValue("source-rule") ?? "cot_faces_v1_forced") as SourceRuleId;
  const skipBasket = argFlag("skip-basket");
  const outDir = path.resolve(
    process.cwd(),
    argValue("out-dir") ?? "app/reports/data-verification/weekly-hold-source-opportunity",
  );
  const scope = await readScopeFromReceipt(receiptPath);
  const targetAdrPct = getTargetAdrPct();
  const baseWeeks = [];
  for (const weekOpenUtc of scope.weekOpenUtcs) {
    baseWeeks.push(await buildBaseWeek({
      weekOpenUtc,
      assetClass: scope.assetClass,
      expectedPairs: scope.expectedPairs,
      sourceRuleIds: [sourceRuleId],
    }));
  }

  const rows = baseWeeks.flatMap((baseWeek) =>
    baseWeek.rows.map((row) => auditRowFromBase(row, sourceRuleId)));
  const basketWeeks = [];
  if (!skipBasket) {
    for (const baseWeek of baseWeeks) {
      basketWeeks.push(await basketWeekSummary({ baseWeek, sourceRuleId, targetAdrPct }));
    }
  }
  const pairSummary = summarizeGroup(rows, "symbol");
  const tierSummary = summarizeGroup(rows, "sourceTier");
  const generatedAtUtc = DateTime.utc().toISO() ?? new Date().toISOString();
  const stamp = DateTime.utc().toFormat("yyyyLLdd-HHmmss");
  const fileStem = `fx-${scope.expectedPairs.length}pair-${sourceRuleId.replaceAll("_", "-")}-source-opportunity-${scope.weekOpenUtcs.length}w-${stamp}`;
  await mkdir(outDir, { recursive: true });
  const jsonPath = path.join(outDir, `${fileStem}.json`);
  const csvPath = path.join(outDir, `${fileStem}.csv`);
  const mdPath = path.join(outDir, `${fileStem}.md`);

  const receipt = {
    schemaVersion: 1,
    generatedAtUtc,
    scope: {
      sourceRuleId,
      sourceReceiptPath: receiptPath,
      assetClass: scope.assetClass,
      expectedPairs: scope.expectedPairs,
      expectedPairCount: scope.expectedPairs.length,
      weekOpenUtcs: scope.weekOpenUtcs,
      selectedWeekCount: scope.weekOpenUtcs.length,
      targetAdrPct,
      pairTargetsAdr: TARGETS,
      pairAdverseAdr: ADVERSE,
      basketTargetsAdr: BASKET_TARGETS,
      basketAdverseAdr: BASKET_ADVERSE,
      basketOpportunitySkipped: skipBasket,
      diagnostic: "selected_direction_vs_opposite_direction_path_opportunity",
    },
    overall: {
      rows: rows.length,
      selectedT1BeforeA1: rows.filter((row) => row.selectedT1BeforeA1).length,
      oppositeT1BeforeA1: rows.filter((row) => row.oppositeT1BeforeA1).length,
      opportunityCostT1A1: rows.filter((row) => row.opportunityCostT1A1).length,
      selectedAdvantageT1A1: rows.filter((row) => row.selectedAdvantageT1A1).length,
    },
    pairSummary,
    tierSummary,
    basketWeeks,
    rows,
  };
  await writeFile(jsonPath, `${JSON.stringify(receipt, null, 2)}\n`, "utf8");
  await writeFile(csvPath, `${toCsv(rows)}\n`, "utf8");
  await writeFile(mdPath, buildMarkdown({
    generatedAtUtc,
    receiptPath,
    sourceRuleId,
    rows,
    pairSummary,
    tierSummary,
    basketWeeks,
    jsonPath,
    csvPath,
  }), "utf8");

  console.log(`COT source opportunity audit: fx ${scope.expectedPairs.length} pairs`);
  console.log(`Weeks: ${scope.weekOpenUtcs.length}`);
  console.log(`Rows: ${rows.length}`);
  console.log(`Selected +1 before -1: ${rows.filter((row) => row.selectedT1BeforeA1).length}`);
  console.log(`Opposite +1 before -1: ${rows.filter((row) => row.oppositeT1BeforeA1).length}`);
  console.log(`Opportunity cost +1/-1: ${rows.filter((row) => row.opportunityCostT1A1).length}`);
  console.log(`JSON: ${jsonPath}`);
  console.log(`CSV: ${csvPath}`);
  console.log(`Markdown: ${mdPath}`);
  await getPool().end();
}

main().catch(async (error) => {
  console.error(error);
  await getPool().end().catch(() => undefined);
  process.exit(1);
});
