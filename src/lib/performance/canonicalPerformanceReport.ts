/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: canonicalPerformanceReport.ts
 *
 * Description:
 * Cached read model for the canonical comprehensive reconstruction
 * report. Exposes a lean typed contract for app/API consumption without
 * leaking the full raw report shape into the UI layer.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import { readFile } from "node:fs/promises";
import path from "node:path";
import { clearRuntimeCacheByPrefix, getOrSetRuntimeCache } from "@/lib/runtimeCache";

const CANONICAL_PERFORMANCE_REPORT_CACHE_PREFIX = "performance:canonicalReport:";
const CANONICAL_PERFORMANCE_REPORT_CACHE_TTL_MS = Number(
  process.env.CANONICAL_PERFORMANCE_REPORT_CACHE_TTL_MS ?? "15000",
);

function getCanonicalPerformanceReportCacheTtlMs() {
  if (
    Number.isFinite(CANONICAL_PERFORMANCE_REPORT_CACHE_TTL_MS)
    && CANONICAL_PERFORMANCE_REPORT_CACHE_TTL_MS >= 0
  ) {
    return Math.floor(CANONICAL_PERFORMANCE_REPORT_CACHE_TTL_MS);
  }
  return 15000;
}

function getCanonicalPerformanceReportPath() {
  return path.join(process.cwd(), "reports", "comprehensive-reconstruction.json");
}

async function readBundledCanonicalPerformanceReport(): Promise<CanonicalPerformanceReport | null> {
  try {
    const bundled = await import("./embedded/comprehensive-reconstruction.json");
    return normalizeReport((bundled as { default?: unknown }).default ?? bundled);
  } catch (error) {
    console.warn(
      "Bundled canonical performance report unavailable:",
      error instanceof Error ? error.message : String(error),
    );
    return null;
  }
}

function toFinite(value: unknown, fallback = 0) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function toNullableFinite(value: unknown) {
  if (value === null || value === undefined) return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function toPositiveInt(value: unknown, fallback = 0) {
  const numeric = toFinite(value, fallback);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(0, Math.trunc(numeric));
}

function toIsoUtc(value: unknown) {
  if (typeof value === "string" && value.trim().length > 0) return value;
  if (value instanceof Date) return value.toISOString();
  return "";
}

function toStringArray(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => (typeof entry === "string" ? entry : ""))
    .filter((entry) => entry.length > 0);
}

function toRecord(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {} as Record<string, unknown>;
  }
  return value as Record<string, unknown>;
}

function toBoolean(value: unknown, fallback = false) {
  if (typeof value === "boolean") return value;
  return fallback;
}

export type CanonicalPerformanceSourceModelBreakdown = {
  returnPct: number;
  activePairs: number;
};

export type CanonicalPerformanceAssetBreakdown = {
  returnPct: number;
  tradeCount: number;
};

export type CanonicalPerformanceWeeklyBreakdown = {
  sourceModels: Record<string, CanonicalPerformanceSourceModelBreakdown>;
  perAsset: Record<string, CanonicalPerformanceAssetBreakdown>;
};

export type CanonicalPerformanceWeeklyRow = {
  weekOpenUtc: string;
  returnPct: number;
  trades: number;
  wins: number;
  losses: number;
  drawdownPct: number;
  grossProfitPct: number;
  grossLossPct: number;
  breakdown: CanonicalPerformanceWeeklyBreakdown;
};

export type CanonicalPerformanceConfig = {
  mode: string | null;
  carry: string | null;
  stops: string | null;
  tp: string | null;
  hold: string | null;
  weeks: string[];
  models: string[];
  drawdownMode: string | null;
  weighting: string | null;
  gateMode: string | null;
};

export type CanonicalPerformanceSystem = {
  system: string;
  family: string;
  version: string;
  botId: string | null;
  strategyName: string;
  isGated: boolean;
  weeks: number;
  weeklyReturns: CanonicalPerformanceWeeklyRow[];
  simpleReturnPct: number;
  compoundedReturnPct: number;
  maxDrawdownSimplePct: number;
  maxDrawdownPct: number;
  totalTrades: number;
  totalWins: number;
  totalLosses: number;
  winRatePct: number;
  pairsSkippedDueToNetting: number;
  gateSkippedTrades: number | null;
  config: CanonicalPerformanceConfig;
};

export type CanonicalPerformanceSummaryRow = {
  system: string;
  family: string;
  simpleReturnPct: number;
  compoundedReturnPct: number;
  maxDrawdownSimplePct: number;
  maxDrawdownPct: number;
  trades: number;
  winRatePct: number;
  weeks: number;
  isGated: boolean;
  gateSkippedTrades: number | null;
};

export type CanonicalPerformanceComponentBreakdownRow = {
  model: string;
  baseline: CanonicalPerformanceSummaryRow;
  gated: CanonicalPerformanceSummaryRow | null;
};

export type CanonicalPerformanceReport = {
  generatedUtc: string;
  canonicalWeeks: string[];
  returnMethodology: string;
  compoundedAlsoIncluded: boolean;
  compositeSystems: CanonicalPerformanceSystem[];
  compositeSystemsGated: CanonicalPerformanceSystem[];
  standaloneModels: CanonicalPerformanceSystem[];
  standaloneModelsGated: CanonicalPerformanceSystem[];
  componentBreakdowns: Record<string, CanonicalPerformanceComponentBreakdownRow[]>;
  summary: CanonicalPerformanceSummaryRow[];
};

export type CanonicalPerformanceApiModel = {
  meta: {
    generatedUtc: string;
    canonicalWeeks: string[];
    returnMethodology: string;
    compoundedAlsoIncluded: boolean;
  };
  collections: {
    composites: {
      baseline: CanonicalPerformanceSystem[];
      gated: CanonicalPerformanceSystem[];
    };
    models: {
      baseline: CanonicalPerformanceSystem[];
      gated: CanonicalPerformanceSystem[];
    };
  };
  componentBreakdowns: Record<string, CanonicalPerformanceComponentBreakdownRow[]>;
  summary: CanonicalPerformanceSummaryRow[];
};

function normalizeWeeklyBreakdown(value: unknown): CanonicalPerformanceWeeklyBreakdown {
  const raw = toRecord(value);
  const sourceModels: Record<string, CanonicalPerformanceSourceModelBreakdown> = {};
  const rawSourceModels = toRecord(raw.sourceModels);
  for (const [key, entry] of Object.entries(rawSourceModels)) {
    const normalized = toRecord(entry);
    sourceModels[key] = {
      returnPct: toFinite(normalized.returnPct, 0),
      activePairs: toPositiveInt(normalized.activePairs, 0),
    };
  }

  const perAsset: Record<string, CanonicalPerformanceAssetBreakdown> = {};
  const rawPerAsset = toRecord(raw.perAsset);
  for (const [key, entry] of Object.entries(rawPerAsset)) {
    const normalized = toRecord(entry);
    perAsset[key] = {
      returnPct: toFinite(normalized.returnPct, 0),
      tradeCount: toPositiveInt(normalized.tradeCount, 0),
    };
  }

  return {
    sourceModels,
    perAsset,
  };
}

function normalizeWeeklyRow(value: unknown): CanonicalPerformanceWeeklyRow {
  const raw = toRecord(value);
  return {
    weekOpenUtc: toIsoUtc(raw.weekOpenUtc),
    returnPct: toFinite(raw.returnPct, 0),
    trades: toPositiveInt(raw.trades, 0),
    wins: toPositiveInt(raw.wins, 0),
    losses: toPositiveInt(raw.losses, 0),
    drawdownPct: toFinite(raw.drawdownPct, 0),
    grossProfitPct: toFinite(raw.grossProfitPct, 0),
    grossLossPct: toFinite(raw.grossLossPct, 0),
    breakdown: normalizeWeeklyBreakdown(raw.breakdown),
  };
}

function normalizeConfig(value: unknown): CanonicalPerformanceConfig {
  const raw = toRecord(value);
  return {
    mode: typeof raw.mode === "string" ? raw.mode : null,
    carry: typeof raw.carry === "string" ? raw.carry : null,
    stops: typeof raw.stops === "string" ? raw.stops : null,
    tp: typeof raw.tp === "string" ? raw.tp : null,
    hold: typeof raw.hold === "string" ? raw.hold : null,
    weeks: toStringArray(raw.weeks),
    models: toStringArray(raw.models),
    drawdownMode: typeof raw.drawdownMode === "string" ? raw.drawdownMode : null,
    weighting: typeof raw.weighting === "string" ? raw.weighting : null,
    gateMode: typeof raw.gateMode === "string" ? raw.gateMode : null,
  };
}

function normalizeSystem(value: unknown): CanonicalPerformanceSystem {
  const raw = toRecord(value);
  const weeklyReturns = Array.isArray(raw.weeklyReturns)
    ? raw.weeklyReturns.map((entry) => normalizeWeeklyRow(entry))
    : [];

  return {
    system: typeof raw.system === "string" ? raw.system : "",
    family: typeof raw.family === "string" ? raw.family : "",
    version: typeof raw.version === "string" ? raw.version : "",
    botId: typeof raw.botId === "string" ? raw.botId : null,
    strategyName: typeof raw.strategyName === "string" ? raw.strategyName : "",
    isGated: toBoolean(raw.isGated, false),
    weeks: toPositiveInt(raw.weeks, weeklyReturns.length),
    weeklyReturns,
    simpleReturnPct: toFinite(raw.simpleReturnPct, 0),
    compoundedReturnPct: toFinite(raw.compoundedReturnPct, 0),
    maxDrawdownSimplePct: toFinite(raw.maxDrawdownSimplePct, 0),
    maxDrawdownPct: toFinite(raw.maxDrawdownPct, 0),
    totalTrades: toPositiveInt(raw.totalTrades, 0),
    totalWins: toPositiveInt(raw.totalWins, 0),
    totalLosses: toPositiveInt(raw.totalLosses, 0),
    winRatePct: toFinite(raw.winRatePct, 0),
    pairsSkippedDueToNetting: toPositiveInt(raw.pairsSkippedDueToNetting, 0),
    gateSkippedTrades: toNullableFinite(raw.gateSkippedTrades),
    config: normalizeConfig(raw.config),
  };
}

function normalizeSummaryRow(value: unknown): CanonicalPerformanceSummaryRow {
  const raw = toRecord(value);
  return {
    system: typeof raw.system === "string" ? raw.system : "",
    family: typeof raw.family === "string" ? raw.family : "",
    simpleReturnPct: toFinite(raw.simpleReturnPct, 0),
    compoundedReturnPct: toFinite(raw.compoundedReturnPct, 0),
    maxDrawdownSimplePct: toFinite(raw.maxDrawdownSimplePct, 0),
    maxDrawdownPct: toFinite(raw.maxDrawdownPct, 0),
    trades: toPositiveInt(raw.trades, 0),
    winRatePct: toFinite(raw.winRatePct, 0),
    weeks: toPositiveInt(raw.weeks, 0),
    isGated: toBoolean(raw.isGated, false),
    gateSkippedTrades: toNullableFinite(raw.gateSkippedTrades),
  };
}

function normalizeComponentBreakdowns(
  value: unknown,
): Record<string, CanonicalPerformanceComponentBreakdownRow[]> {
  const raw = toRecord(value);
  const normalized: Record<string, CanonicalPerformanceComponentBreakdownRow[]> = {};

  for (const [system, entries] of Object.entries(raw)) {
    if (!Array.isArray(entries)) {
      normalized[system] = [];
      continue;
    }
    normalized[system] = entries.map((entry) => {
      const rawEntry = toRecord(entry);
      return {
        model: typeof rawEntry.model === "string" ? rawEntry.model : "",
        baseline: normalizeSummaryRow(rawEntry.baseline),
        gated: rawEntry.gated ? normalizeSummaryRow(rawEntry.gated) : null,
      };
    });
  }

  return normalized;
}

function normalizeReport(rawValue: unknown): CanonicalPerformanceReport {
  const raw = toRecord(rawValue);
  return {
    generatedUtc: toIsoUtc(raw.generated_utc),
    canonicalWeeks: toStringArray(raw.canonical_weeks),
    returnMethodology:
      typeof raw.return_methodology === "string" ? raw.return_methodology : "simple_sum",
    compoundedAlsoIncluded: toBoolean(raw.compounded_also_included, true),
    compositeSystems: Array.isArray(raw.composite_systems)
      ? raw.composite_systems.map((entry) => normalizeSystem(entry))
      : [],
    compositeSystemsGated: Array.isArray(raw.composite_systems_gated)
      ? raw.composite_systems_gated.map((entry) => normalizeSystem(entry))
      : [],
    standaloneModels: Array.isArray(raw.standalone_models)
      ? raw.standalone_models.map((entry) => normalizeSystem(entry))
      : [],
    standaloneModelsGated: Array.isArray(raw.standalone_models_gated)
      ? raw.standalone_models_gated.map((entry) => normalizeSystem(entry))
      : [],
    componentBreakdowns: normalizeComponentBreakdowns(raw.component_breakdowns),
    summary: Array.isArray(raw.summary) ? raw.summary.map((entry) => normalizeSummaryRow(entry)) : [],
  };
}

export async function readCanonicalPerformanceReport(): Promise<CanonicalPerformanceReport | null> {
  const cacheKey = `${CANONICAL_PERFORMANCE_REPORT_CACHE_PREFIX}report`;
  return getOrSetRuntimeCache(
    cacheKey,
    getCanonicalPerformanceReportCacheTtlMs(),
    async () => {
      try {
        const payload = await readFile(getCanonicalPerformanceReportPath(), "utf8");
        return normalizeReport(JSON.parse(payload));
      } catch (error) {
        console.warn(
          "Filesystem canonical performance report unavailable, trying bundled fallback:",
          error instanceof Error ? error.message : String(error),
        );
        return readBundledCanonicalPerformanceReport();
      }
    },
  );
}

export function clearCanonicalPerformanceReportCache() {
  clearRuntimeCacheByPrefix(CANONICAL_PERFORMANCE_REPORT_CACHE_PREFIX);
}

export async function getCanonicalSummaryRows() {
  const report = await readCanonicalPerformanceReport();
  return report?.summary ?? [];
}

export async function getCanonicalCompositeSystems(options?: { isGated?: boolean }) {
  const report = await readCanonicalPerformanceReport();
  if (!report) return [];
  if (options?.isGated === true) return report.compositeSystemsGated;
  if (options?.isGated === false) return report.compositeSystems;
  return [...report.compositeSystems, ...report.compositeSystemsGated];
}

export async function getCanonicalStandaloneModels(options?: { isGated?: boolean }) {
  const report = await readCanonicalPerformanceReport();
  if (!report) return [];
  if (options?.isGated === true) return report.standaloneModelsGated;
  if (options?.isGated === false) return report.standaloneModels;
  return [...report.standaloneModels, ...report.standaloneModelsGated];
}

export async function getCanonicalSystemResult(systemId: string) {
  const report = await readCanonicalPerformanceReport();
  if (!report) return null;
  return (
    report.compositeSystems.find((entry) => entry.system === systemId)
    ?? report.compositeSystemsGated.find((entry) => entry.system === systemId)
    ?? report.standaloneModels.find((entry) => entry.system === systemId)
    ?? report.standaloneModelsGated.find((entry) => entry.system === systemId)
    ?? null
  );
}

export async function getCanonicalComponentBreakdown(systemId: string) {
  const report = await readCanonicalPerformanceReport();
  return report?.componentBreakdowns[systemId] ?? [];
}

export async function getCanonicalPerformanceApiModel(): Promise<CanonicalPerformanceApiModel | null> {
  const report = await readCanonicalPerformanceReport();
  if (!report) return null;
  return {
    meta: {
      generatedUtc: report.generatedUtc,
      canonicalWeeks: report.canonicalWeeks,
      returnMethodology: report.returnMethodology,
      compoundedAlsoIncluded: report.compoundedAlsoIncluded,
    },
    collections: {
      composites: {
        baseline: report.compositeSystems,
        gated: report.compositeSystemsGated,
      },
      models: {
        baseline: report.standaloneModels,
        gated: report.standaloneModelsGated,
      },
    },
    componentBreakdowns: report.componentBreakdowns,
    summary: report.summary,
  };
}
