/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: canonicalFlagships.ts
 *
 * Description:
 * Resolves canonical flagship metadata from the comprehensive
 * reconstruction read model. Weekly is now driven from the canonical
 * report; intraday remains intentionally provisional.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import {
  getCanonicalSystemResult,
  readCanonicalPerformanceReport,
  type CanonicalPerformanceSystem,
} from "./canonicalPerformanceReport";

export type CanonicalFlagshipStatus = "locked" | "provisional" | "research";

export type CanonicalResolvedFlagship = {
  surface: "weekly" | "intraday";
  status: CanonicalFlagshipStatus;
  systemId: string | null;
  strategyName: string;
  family: string | null;
  isGated: boolean | null;
  sampleWeeks: number | null;
  sourceLabel: string;
  reason: string;
  metrics: {
    simpleReturnPct: number | null;
    compoundedReturnPct: number | null;
    maxDrawdownSimplePct: number | null;
    maxDrawdownPct: number | null;
    trades: number | null;
    winRatePct: number | null;
  };
};

export type CanonicalFlagships = {
  generatedUtc: string;
  canonicalWeeks: string[];
  weekly: CanonicalResolvedFlagship;
  intraday: CanonicalResolvedFlagship;
};

const INITIAL_WEEKLY_FLAGSHIP_ID = "tiered_v3_gated";

function buildWindowLabel(weeks: string[]) {
  if (weeks.length === 0) return "Canonical reconstruction";
  return `Canonical reconstruction · ${weeks[0]?.slice(0, 10)} to ${weeks[weeks.length - 1]?.slice(0, 10)}`;
}

function toFlagshipMetrics(system: CanonicalPerformanceSystem | null) {
  if (!system) {
    return {
      simpleReturnPct: null,
      compoundedReturnPct: null,
      maxDrawdownSimplePct: null,
      maxDrawdownPct: null,
      trades: null,
      winRatePct: null,
    };
  }
  return {
    simpleReturnPct: system.simpleReturnPct,
    compoundedReturnPct: system.compoundedReturnPct,
    maxDrawdownSimplePct: system.maxDrawdownSimplePct,
    maxDrawdownPct: system.maxDrawdownPct,
    trades: system.totalTrades,
    winRatePct: system.winRatePct,
  };
}

function buildWeeklyFlagship(
  system: CanonicalPerformanceSystem | null,
  canonicalWeeks: string[],
): CanonicalResolvedFlagship {
  if (!system) {
    return {
      surface: "weekly",
      status: "provisional",
      systemId: null,
      strategyName: "Weekly flagship pending",
      family: null,
      isGated: null,
      sampleWeeks: canonicalWeeks.length || null,
      sourceLabel: buildWindowLabel(canonicalWeeks),
      reason: "Canonical weekly flagship could not be resolved from the current reconstruction output.",
      metrics: toFlagshipMetrics(null),
    };
  }

  return {
    surface: "weekly",
    status: "locked",
    systemId: system.system,
    strategyName: system.strategyName,
    family: system.family,
    isGated: system.isGated,
    sampleWeeks: system.weeks,
    sourceLabel: buildWindowLabel(canonicalWeeks),
    reason:
      "Initial weekly flagship is Tiered V3 Gated based on the strongest gated risk-adjusted profile on the current 9-week canonical sample.",
    metrics: toFlagshipMetrics(system),
  };
}

function buildIntradayFlagship(canonicalWeeks: string[]): CanonicalResolvedFlagship {
  return {
    surface: "intraday",
    status: "research",
    systemId: null,
    strategyName: "Intraday flagship in research",
    family: null,
    isGated: null,
    sampleWeeks: null,
    sourceLabel: buildWindowLabel(canonicalWeeks),
    reason:
      "Intraday remains research-only until the Katarakti / intraday flagship logic is relocked and forward-testing scope is finalized.",
    metrics: toFlagshipMetrics(null),
  };
}

export async function resolveCanonicalFlagships(): Promise<CanonicalFlagships> {
  const report = await readCanonicalPerformanceReport();
  const weeklySystem = await getCanonicalSystemResult(INITIAL_WEEKLY_FLAGSHIP_ID);

  return {
    generatedUtc: report.generatedUtc,
    canonicalWeeks: report.canonicalWeeks,
    weekly: buildWeeklyFlagship(weeklySystem, report.canonicalWeeks),
    intraday: buildIntradayFlagship(report.canonicalWeeks),
  };
}
