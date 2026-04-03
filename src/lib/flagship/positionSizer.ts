/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: positionSizer.ts
 *
 * Description:
 * Pure ADR-normalized lot sizing functions and account factories.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import type { InstrumentSpec } from "@/lib/flagship/instrumentDefaults";

export type SizingAccount = {
  id: string;
  name: string;
  balance: number;
  currency: string;
  riskPctPerTrade: number;
  leverage: number;
  maxPortfolioHeatPct: number;
  scaleFactor: number;
  instrumentOverrides: Record<string, Partial<InstrumentSpec>>;
};

export type SizingResult = {
  lotSize: number;
  riskAmountUsd: number;
  stopDistancePips: number;
  stopDistancePrice: number;
  pipValue: number;
  marginRequired: number;
  riskPct: number;
  maxLotsForBalance: number;
  warning: string | null;
};

function normalizePair(value: string) {
  return String(value ?? "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function roundToStep(value: number, step: number) {
  if (!(step > 0) || !Number.isFinite(value)) return value;
  const precision = Math.max(0, `${step}`.split(".")[1]?.length ?? 0);
  return Number((Math.round(value / step) * step).toFixed(precision));
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function resolveId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `sizing-${Date.now()}`;
}

export function calculateLotSize(
  account: SizingAccount,
  spec: InstrumentSpec,
  adrPct: number,
  currentPrice: number,
  riskDistanceAdrMultiple = 1,
): SizingResult {
  const targetRiskAmount = account.balance * (account.riskPctPerTrade / 100);
  const adrPrice = currentPrice * (adrPct / 100);
  const stopDistancePrice = adrPrice * riskDistanceAdrMultiple;
  const stopDistancePips = spec.pipSize > 0 ? stopDistancePrice / spec.pipSize : 0;
  const effectiveLeverage =
    account.instrumentOverrides[normalizePair(spec.pair)]?.defaultLeverage ??
    account.leverage ??
    spec.defaultLeverage;
  const maxLotsForBalance =
    effectiveLeverage > 0 && spec.contractSize > 0 && currentPrice > 0
      ? (account.balance * effectiveLeverage) / (spec.contractSize * currentPrice)
      : 0;

  if (!(targetRiskAmount > 0) || !(stopDistancePips > 0) || !(spec.pipValuePerLot > 0)) {
    return {
      lotSize: 0,
      riskAmountUsd: 0,
      stopDistancePips,
      stopDistancePrice,
      pipValue: 0,
      marginRequired: 0,
      riskPct: 0,
      maxLotsForBalance,
      warning: "NO_DATA",
    };
  }

  const rawLots = targetRiskAmount / (stopDistancePips * spec.pipValuePerLot);
  const unclampedLots = roundToStep(clamp(rawLots, spec.minLot, spec.maxLot), spec.lotStep);
  const lotSize = clamp(unclampedLots, spec.minLot, spec.maxLot);
  const pipValue = lotSize * spec.pipValuePerLot;
  const riskAmountUsd = stopDistancePips * pipValue;
  const marginRequired =
    effectiveLeverage > 0 ? (lotSize * spec.contractSize * currentPrice) / effectiveLeverage : 0;
  const riskPct = account.balance > 0 ? (riskAmountUsd / account.balance) * 100 : 0;

  const warnings: string[] = [];
  if (rawLots < spec.minLot) warnings.push("MIN_LOT");
  if (rawLots > spec.maxLot) warnings.push("MAX_LOT");
  if (marginRequired > account.balance) warnings.push("MARGIN_EXCEEDED");

  return {
    lotSize,
    riskAmountUsd,
    stopDistancePips,
    stopDistancePrice,
    pipValue,
    marginRequired,
    riskPct,
    maxLotsForBalance,
    warning: warnings.length > 0 ? warnings.join(",") : null,
  };
}

export function createDefaultAccount(name: string): SizingAccount {
  return {
    id: resolveId(),
    name,
    balance: 100,
    currency: "USD",
    riskPctPerTrade: 1,
    leverage: 100,
    maxPortfolioHeatPct: 25,
    scaleFactor: 0.2,
    instrumentOverrides: {},
  };
}
