/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: page.tsx
 *
 * Description:
 * Performance page using the restored shell, now split into Flagship
 * and Legacy modes and backed by canonical reconstruction data.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import DashboardLayout from "@/components/DashboardLayout";
import PerformanceHeaderContext from "@/components/performance/PerformanceHeaderContext";
import PerformanceViewSection from "@/components/performance/PerformanceViewSection";
import type { PerformanceSimulationGroup } from "@/components/performance/PerformanceSimulationSection";
import { resolveCanonicalFlagships } from "@/lib/performance/canonicalFlagships";
import {
  getCanonicalPerformanceApiModel,
  type CanonicalPerformanceApiModel,
  type CanonicalPerformanceComponentBreakdownRow,
  type CanonicalPerformanceSystem,
  type CanonicalPerformanceWeeklyRow,
} from "@/lib/performance/canonicalPerformanceReport";
import {
  PERFORMANCE_MODEL_LABELS,
  resolvePerformanceSystem,
  type PerformanceSystem,
} from "@/lib/performance/modelConfig";
import { resolvePerformanceView } from "@/lib/performance/pageState";
import { computeReturnStats, type ModelPerformance, type PerformanceModel } from "@/lib/performanceLab";
import type { PerformanceStrategyFamily } from "@/lib/performance/strategyRegistry";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type PerformancePageProps = {
  searchParams?:
    | Record<string, string | string[] | undefined>
    | Promise<Record<string, string | string[] | undefined>>;
};

type WeeklyPerformanceFamily = Exclude<PerformanceStrategyFamily, "katarakti">;

type GridProps = {
  combined: {
    id: string;
    label: string;
    description: string;
    models: ModelPerformance[];
  };
  perAsset: Array<{
    id: string;
    label: string;
    description: string;
    models: ModelPerformance[];
  }>;
  labels: typeof PERFORMANCE_MODEL_LABELS;
  allTime: {
    combined: Array<{
      model: PerformanceModel;
      totalPercent: number;
      weeks: number;
      winRate: number;
      avgWeekly: number;
    }>;
    perAsset: Record<string, Array<{
      model: PerformanceModel;
      totalPercent: number;
      weeks: number;
      winRate: number;
      avgWeekly: number;
    }>>;
  };
  showAllTime: boolean;
  comparisonOverlay?: {
    mode: "standard" | "gated";
    standard: {
      totalReturn: number;
      winRate: number;
      sharpe: number;
      maxDrawdown: number | null;
      profitFactor: number | null;
      tradeWinRate: number;
      avgWeekly: number;
      trades: number;
    };
    gated: {
      totalReturn: number;
      winRate: number;
      sharpe: number;
      maxDrawdown: number | null;
      profitFactor: number | null;
      tradeWinRate: number;
      avgWeekly: number;
      trades: number;
    } | null;
    gateAvailable: boolean;
    delta: {
      totalReturnPct: number;
      maxDrawdownPct: number;
      winRatePct: number;
      tradeWinRatePct: number;
      trades: number;
    } | null;
    gateActivity: {
      skippedTrades: number;
      reducedTrades: number;
      passedOrNoDataTrades: number;
    } | null;
  };
};

const ASSET_LABELS: Record<string, string> = {
  fx: "FX",
  indices: "Indices",
  commodities: "Commodities",
  crypto: "Crypto",
};

const SERIES_COLORS = ["#10b981", "#38bdf8", "#f59e0b", "#a78bfa", "#f43f5e", "#ef4444"];

function parseFamily(value: string | null | undefined): PerformanceStrategyFamily {
  return value === "universal" ? "universal" : value === "katarakti" ? "katarakti" : "tiered";
}

function parseMode(value: string | null | undefined) {
  return value === "legacy" ? "legacy" : "flagship";
}

function weekLabel(weekOpenUtc: string) {
  const [datePart] = weekOpenUtc.split("T");
  if (!datePart) return weekOpenUtc;
  const [year, month, day] = datePart.split("-").map((value) => Number.parseInt(value, 10));
  if (!year || !month || !day) return weekOpenUtc;
  const value = new Date(Date.UTC(year, month - 1, day));
  return value.toLocaleDateString("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  }).replace(",", "");
}

function toDirection(value: number | null | undefined): "LONG" | "SHORT" | "NEUTRAL" {
  if ((value ?? 0) > 0) return "LONG";
  if ((value ?? 0) < 0) return "SHORT";
  return "NEUTRAL";
}

function toSharpeProxy(weeklyRows: CanonicalPerformanceWeeklyRow[]) {
  if (weeklyRows.length <= 1) return 0;
  const values = weeklyRows.map((row) => row.returnPct);
  const average = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance = values.reduce((sum, value) => sum + (value - average) ** 2, 0) / (values.length - 1);
  const deviation = Math.sqrt(variance);
  return deviation > 0 ? average / deviation : 0;
}

function toProfitFactor(weeklyRows: CanonicalPerformanceWeeklyRow[]) {
  const grossProfit = weeklyRows.reduce((sum, row) => sum + Math.max(0, row.grossProfitPct), 0);
  const grossLoss = Math.abs(weeklyRows.reduce((sum, row) => sum + Math.min(0, row.grossLossPct), 0));
  if (grossLoss > 0) return grossProfit / grossLoss;
  if (grossProfit > 0) return Number.POSITIVE_INFINITY;
  return null;
}

function toTradeWinRate(system: CanonicalPerformanceSystem) {
  return system.totalTrades > 0 ? (system.totalWins / system.totalTrades) * 100 : 0;
}

function buildWeeklyReturns(
  rows: CanonicalPerformanceWeeklyRow[],
  metric: (row: CanonicalPerformanceWeeklyRow) => number,
) {
  return rows.map((row) => ({
    pair: `Week of ${weekLabel(row.weekOpenUtc)}`,
    percent: metric(row),
  }));
}

function buildWeeklyBreakdowns(
  rows: CanonicalPerformanceWeeklyRow[],
  metric: (row: CanonicalPerformanceWeeklyRow) => number,
  breakdownFactory: (row: CanonicalPerformanceWeeklyRow) => Array<{
    pair: string;
    direction: "LONG" | "SHORT" | "NEUTRAL";
    reason: string[];
    percent: number | null;
  }>,
): ModelPerformance["pair_details"] {
  return rows.map((row) => ({
    pair: `Week of ${weekLabel(row.weekOpenUtc)}`,
    direction: toDirection(metric(row)),
    reason: [
      `${row.trades} trades`,
      `${row.wins} wins / ${row.losses} losses`,
      `Weekly drawdown ${row.drawdownPct.toFixed(2)}%`,
    ],
    percent: metric(row),
    children: breakdownFactory(row),
  }));
}

function buildModelPerformanceFromSystemBreakdown(options: {
  model: PerformanceModel;
  systemRows: CanonicalPerformanceWeeklyRow[];
}) {
  const returns = buildWeeklyReturns(
    options.systemRows,
    (row) => row.breakdown.sourceModels[options.model]?.returnPct ?? 0,
  );
  const pairDetails = buildWeeklyBreakdowns(
    options.systemRows,
    (row) => row.breakdown.sourceModels[options.model]?.returnPct ?? 0,
    (row) =>
      Object.entries(row.breakdown.perAsset).map(([assetKey, assetValue]) => ({
        pair: ASSET_LABELS[assetKey] ?? assetKey,
        direction: toDirection(assetValue.returnPct),
        reason: [`${assetValue.tradeCount} trades`],
        percent: assetValue.returnPct,
      })),
  );
  const totalPercent = returns.reduce((sum, item) => sum + item.percent, 0);
  return {
    model: options.model,
    percent: totalPercent,
    priced: returns.length,
    total: returns.length,
    note: "Component contribution inside the selected canonical system.",
    returns,
    pair_details: pairDetails,
    stats: computeReturnStats(returns),
    diagnostics: {
      max_drawdown: null,
      profit_factor: null,
    },
  } satisfies ModelPerformance;
}

function buildOverlay(system: CanonicalPerformanceSystem, gated: CanonicalPerformanceSystem | null) {
  const standardAvgWeekly = system.weeks > 0 ? system.simpleReturnPct / system.weeks : 0;
  const gatedAvgWeekly = gated && gated.weeks > 0 ? gated.simpleReturnPct / gated.weeks : 0;
  const standardTradeWinRate = toTradeWinRate(system);
  const gatedTradeWinRate = gated ? toTradeWinRate(gated) : 0;

  return {
    mode: gated ? "gated" : "standard",
    standard: {
      totalReturn: system.simpleReturnPct,
      winRate: system.winRatePct,
      sharpe: toSharpeProxy(system.weeklyReturns),
      maxDrawdown: system.maxDrawdownSimplePct,
      profitFactor: toProfitFactor(system.weeklyReturns),
      tradeWinRate: standardTradeWinRate,
      avgWeekly: standardAvgWeekly,
      trades: system.totalTrades,
    },
    gated: gated
      ? {
          totalReturn: gated.simpleReturnPct,
          winRate: gated.winRatePct,
          sharpe: toSharpeProxy(gated.weeklyReturns),
          maxDrawdown: gated.maxDrawdownSimplePct,
          profitFactor: toProfitFactor(gated.weeklyReturns),
          tradeWinRate: gatedTradeWinRate,
          avgWeekly: gatedAvgWeekly,
          trades: gated.totalTrades,
        }
      : null,
    gateAvailable: Boolean(gated),
    delta: gated
      ? {
          totalReturnPct: gated.simpleReturnPct - system.simpleReturnPct,
          maxDrawdownPct: gated.maxDrawdownSimplePct - system.maxDrawdownSimplePct,
          winRatePct: gated.winRatePct - system.winRatePct,
          tradeWinRatePct: gatedTradeWinRate - standardTradeWinRate,
          trades: gated.totalTrades - system.totalTrades,
        }
      : null,
    gateActivity: gated
      ? {
          skippedTrades: gated.gateSkippedTrades ?? 0,
          reducedTrades: 0,
          passedOrNoDataTrades: Math.max(0, system.totalTrades - (gated.gateSkippedTrades ?? 0)),
        }
      : null,
  } satisfies GridProps["comparisonOverlay"];
}

function buildGridPropsForSystem(options: {
  baseline: CanonicalPerformanceSystem | null;
  gated: CanonicalPerformanceSystem | null;
  componentBreakdowns: CanonicalPerformanceApiModel["componentBreakdowns"];
  includeComparisonOverlay?: boolean;
}) {
  const baseline = options.baseline;
  const gated = options.gated;
  const activeSystem = gated ?? baseline;
  if (!activeSystem || !baseline) {
    return null;
  }

  const breakdownRows = options.componentBreakdowns[baseline.system] ?? [];
  const models = breakdownRows
    .filter((row): row is CanonicalPerformanceComponentBreakdownRow & { model: PerformanceModel } =>
      row.model in PERFORMANCE_MODEL_LABELS,
    )
    .map((row) =>
      buildModelPerformanceFromSystemBreakdown({
        model: row.model as PerformanceModel,
        systemRows: activeSystem.weeklyReturns,
      }),
    );

  return {
    combined: {
      id: "combined",
      label: "Combined Basket",
      description: `${activeSystem.strategyName} · canonical component breakdown.`,
      models,
    },
    perAsset: [],
    labels: PERFORMANCE_MODEL_LABELS,
    allTime: { combined: [], perAsset: {} },
    showAllTime: false,
    comparisonOverlay: options.includeComparisonOverlay === false ? undefined : buildOverlay(baseline, gated),
  } satisfies GridProps;
}

function buildSeriesFromWeeklyReturns(options: {
  id: string;
  label: string;
  rows: CanonicalPerformanceWeeklyRow[];
  color?: string;
  metric: (row: CanonicalPerformanceWeeklyRow) => number;
}) {
  let running = 0;
  return {
    id: options.id,
    label: options.label,
    color: options.color,
    points: options.rows.map((row) => {
      running += options.metric(row);
      return {
        ts_utc: row.weekOpenUtc,
        equity_pct: running,
        lock_pct: null,
      };
    }),
  };
}

function buildSimulationGroupForSystem(options: {
  title: string;
  baseline: CanonicalPerformanceSystem | null;
  gated: CanonicalPerformanceSystem | null;
  componentBreakdowns: CanonicalPerformanceApiModel["componentBreakdowns"];
}) {
  const active = options.gated ?? options.baseline;
  const baseline = options.baseline;
  if (!active || !baseline) {
    return null;
  }

  const series: PerformanceSimulationGroup["series"] = [];
  if (options.gated) {
    series.push(
      buildSeriesFromWeeklyReturns({
        id: "gated",
        label: `${options.title} Gated`,
        rows: options.gated.weeklyReturns,
        color: SERIES_COLORS[0],
        metric: (row) => row.returnPct,
      }),
    );
  }
  series.push(
    buildSeriesFromWeeklyReturns({
      id: "baseline",
      label: `${options.title} Baseline`,
      rows: baseline.weeklyReturns,
      color: SERIES_COLORS[1],
      metric: (row) => row.returnPct,
    }),
  );

  const breakdownRows = options.componentBreakdowns[baseline.system] ?? [];
  breakdownRows
    .filter((row): row is CanonicalPerformanceComponentBreakdownRow & { model: PerformanceModel } =>
      row.model in PERFORMANCE_MODEL_LABELS,
    )
    .forEach((row, index) => {
      series.push(
        buildSeriesFromWeeklyReturns({
          id: row.model,
          label: PERFORMANCE_MODEL_LABELS[row.model as PerformanceModel],
          rows: active.weeklyReturns,
          color: SERIES_COLORS[(index + 2) % SERIES_COLORS.length],
          metric: (weekRow) => weekRow.breakdown.sourceModels[row.model as PerformanceModel]?.returnPct ?? 0,
        }),
      );
    });

  return {
    title: options.title,
    description:
      "Simulation uses the shared equity curve chart. The composite system is shown alongside its internal model contribution lines.",
    metrics: {
      returnPct: active.simpleReturnPct,
      maxDrawdownPct: active.maxDrawdownSimplePct,
      trades: active.totalTrades,
    },
    series,
  } satisfies PerformanceSimulationGroup;
}

function buildSystemMaps(options: {
  family: "universal" | "tiered";
  report: CanonicalPerformanceApiModel;
}) {
  const gridMap: Partial<Record<PerformanceSystem, GridProps>> = {};
  const simulationMap: Partial<Record<PerformanceSystem, PerformanceSimulationGroup>> = {};

  (["v1", "v2", "v3"] as const).forEach((version) => {
    const systemId = `${options.family}_${version}`;
    const baseline = options.report.collections.composites.baseline.find((entry) => entry.system === systemId) ?? null;
    const gated = options.report.collections.composites.gated.find((entry) => entry.system === `${systemId}_gated`) ?? null;

    const grid = buildGridPropsForSystem({
      baseline,
      gated,
      componentBreakdowns: options.report.componentBreakdowns,
    });
    if (grid) {
      gridMap[version] = grid;
    }

    const simulation = buildSimulationGroupForSystem({
      title: (gated ?? baseline)?.strategyName ?? systemId,
      baseline,
      gated,
      componentBreakdowns: options.report.componentBreakdowns,
    });
    if (simulation) {
      simulationMap[version] = simulation;
    }
  });

  return { gridMap, simulationMap };
}

export default async function PerformancePage({ searchParams }: PerformancePageProps) {
  const resolvedSearchParams = await Promise.resolve(searchParams);
  const styleParam = resolvedSearchParams?.style;
  const styleParamValue = Array.isArray(styleParam) ? styleParam[0] : styleParam;
  const systemParam = resolvedSearchParams?.system;
  const systemParamValue = Array.isArray(systemParam) ? systemParam[0] : systemParam;
  const viewParam = resolvedSearchParams?.view;
  const viewParamValue = Array.isArray(viewParam) ? viewParam[0] : viewParam;
  const modeParam = resolvedSearchParams?.mode;
  const modeParamValue = Array.isArray(modeParam) ? modeParam[0] : modeParam;

  const resolvedFamily = parseFamily(styleParamValue);
  const initialStyle: WeeklyPerformanceFamily = resolvedFamily === "universal" ? "universal" : "tiered";
  const initialSystem = resolvePerformanceSystem(systemParamValue);
  const initialView = resolvePerformanceView(viewParamValue);
  const initialMode = parseMode(modeParamValue);

  const [report, flagships] = await Promise.all([
    getCanonicalPerformanceApiModel(),
    resolveCanonicalFlagships(),
  ]);

  if (!report) {
    return (
      <DashboardLayout>
        <div className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] px-5 py-4 text-sm text-[color:var(--muted)] shadow-sm">
          Canonical performance report is not available in this environment yet.
        </div>
      </DashboardLayout>
    );
  }

  const universal = buildSystemMaps({
    family: "universal",
    report,
  });
  const tiered = buildSystemMaps({
    family: "tiered",
    report,
  });

  const weeklyFlagshipId = flagships.weekly.systemId ?? "tiered_v3_gated";
  const flagshipBaselineId = weeklyFlagshipId.endsWith("_gated")
    ? weeklyFlagshipId.slice(0, -"_gated".length)
    : weeklyFlagshipId;
  const flagshipBaseline =
    report.collections.composites.baseline.find((entry) => entry.system === flagshipBaselineId) ?? null;
  const flagshipGated =
    report.collections.composites.gated.find((entry) => entry.system === weeklyFlagshipId) ?? null;
  const flagshipGridProps = buildGridPropsForSystem({
    baseline: flagshipBaseline,
    gated: flagshipGated,
    componentBreakdowns: report.componentBreakdowns,
    includeComparisonOverlay: false,
  });
  const flagshipSimulation = buildSimulationGroupForSystem({
    title: flagshipGated?.strategyName ?? flagshipBaseline?.strategyName ?? "Weekly Flagship",
    baseline: flagshipBaseline,
    gated: flagshipGated,
    componentBreakdowns: report.componentBreakdowns,
  });

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <header>
          <div>
            <h1 className="text-3xl font-semibold text-[var(--foreground)]">
              Performance
            </h1>
            <PerformanceHeaderContext
              initialStyle={initialMode === "flagship" ? "tiered" : initialStyle}
              initialSystem={initialMode === "flagship" ? "v3" : initialSystem}
              initialKataraktiMarket="crypto_futures"
              initialKataraktiVariant="v3"
              className="mt-1 text-xs uppercase tracking-[0.18em] text-[color:var(--muted)]"
            />
          </div>
        </header>

        <PerformanceViewSection
          initialMode={initialMode}
          initialView={initialView}
          initialSystem={initialMode === "flagship" ? "v3" : initialSystem}
          initialStyle={initialMode === "flagship" ? "tiered" : initialStyle}
          universalGridPropsBySystem={universal.gridMap}
          tieredGridPropsBySystem={tiered.gridMap}
          universalSimulationBySystem={universal.simulationMap}
          tieredSimulationBySystem={tiered.simulationMap}
          flagshipGridProps={flagshipGridProps}
          flagshipSimulation={flagshipSimulation}
        />
      </div>
    </DashboardLayout>
  );
}
