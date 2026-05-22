/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/

import type { EngineGridProps, EngineSimulationGroup } from "./engineAdapter";
import {
  assetMatchesPerformanceScope,
  isAllPerformanceAssetSelection,
  performanceScopeIncludesCrypto,
  symbolMatchesPerformanceScope,
  type PerformanceAssetSelection,
} from "./performanceAssetScope";

type GridSection = EngineGridProps["combined"];
type GridModel = GridSection["models"][number];
type GridReturn = GridModel["returns"][number];
type GridPairDetail = GridModel["pair_details"][number];
type EngineSimulationSeries = EngineSimulationGroup["series"][number];

export function filterGridPropsByPerformanceScope(
  gridProps: EngineGridProps | null,
  scope: PerformanceAssetSelection,
  options: { allTimeMode?: boolean } = {},
): EngineGridProps | null {
  if (!gridProps || isAllPerformanceAssetSelection(scope)) return gridProps;
  if (options.allTimeMode) return filterAllTimeGridPropsByScope(gridProps, scope);
  return filterSymbolGridPropsByScope(gridProps, scope);
}

export function deriveScopedSimulationMetrics(
  simulation: EngineSimulationGroup | null,
  scope: PerformanceAssetSelection,
): { returnPct: number | null; maxDrawdownPct: number | null; trades: number | null } | null {
  const series = resolveScopedSimulationSeries(simulation, scope);
  if (!series || series.points.length === 0) return null;

  const points = filterMarketHours(series.points, {
    includeWeekends: performanceScopeIncludesCrypto(scope),
  });
  const usablePoints = points.length > 0 ? points : series.points;
  const lastPoint = usablePoints[usablePoints.length - 1] ?? null;
  const drawdowns = usablePoints
    .map((point) => point.drawdown_pct)
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value));

  const maxDrawdownPct = drawdowns.length > 0 ? Math.abs(Math.min(...drawdowns)) : null;

  return {
    returnPct: lastPoint && Number.isFinite(lastPoint.equity_pct) ? lastPoint.equity_pct : null,
    maxDrawdownPct,
    trades: typeof series.trades === "number" && Number.isFinite(series.trades) ? series.trades : null,
  };
}

function filterSymbolGridPropsByScope(
  gridProps: EngineGridProps,
  scope: PerformanceAssetSelection,
): EngineGridProps {
  const filterModel = (model: GridModel): GridModel => {
    const details = model.pair_details.filter((detail) =>
      symbolMatchesPerformanceScope(detail.pair, scope),
    );
    const returns = model.returns.filter((entry) => symbolMatchesPerformanceScope(entry.pair, scope));
    return rebuildModel(model, returns, details);
  };

  const combinedModels = gridProps.combined.models.map(filterModel);
  const scopedPerAsset = gridProps.perAsset
    .filter((section) => assetMatchesPerformanceScope(section.id, scope))
    .map((section) => ({
      ...section,
      models: section.models.map(filterModel),
    }));
  const scopedAllTimePerAsset = filterAllTimePerAsset(gridProps.allTime.perAsset, scope);

  return {
    ...gridProps,
    combined: {
      ...gridProps.combined,
      models: combinedModels,
    },
    perAsset: scopedPerAsset,
    allTime: {
      combined: combineAllTimeRows(Object.values(scopedAllTimePerAsset).flat()),
      perAsset: scopedAllTimePerAsset,
    },
  };
}

function filterAllTimeGridPropsByScope(
  gridProps: EngineGridProps,
  scope: PerformanceAssetSelection,
): EngineGridProps {
  const scopedPerAsset = gridProps.perAsset
    .filter((section) => assetMatchesPerformanceScope(section.id, scope))
    .map(normalizeAllTimeSection);
  const scopedAllTimePerAsset = filterAllTimePerAsset(gridProps.allTime.perAsset, scope);

  const combined = combineSectionsForAllTimeScope(gridProps.combined, scopedPerAsset);

  return {
    ...gridProps,
    combined,
    perAsset: scopedPerAsset,
    allTime: {
      combined: combineAllTimeRows(Object.values(scopedAllTimePerAsset).flat()),
      perAsset: scopedAllTimePerAsset,
    },
  };
}

function normalizeAllTimeSection(section: GridSection): GridSection {
  const models = section.models
    .map((model) => rebuildModel(model, model.returns, model.pair_details))
    .filter(hasModelActivity);

  return {
    ...section,
    models: models.length > 0 ? models : section.models.map((model) => rebuildModel(model, [], [])),
  };
}

function combineSectionsForAllTimeScope(baseCombined: GridSection, sections: GridSection[]): GridSection {
  if (sections.length === 0) {
    return {
      ...baseCombined,
      models: baseCombined.models.map((model) => rebuildModel(model, [], [])),
    };
  }

  const scopedModelOrder = uniqueStable(sections.flatMap((section) => section.models.map((model) => model.model)));
  const modelOrder = scopedModelOrder.length > 0
    ? scopedModelOrder
    : baseCombined.models.map((model) => model.model);

  const models = modelOrder
    .map((modelId) => {
      const sourceModels = sections
        .flatMap((section) => section.models)
        .filter((model) => model.model === modelId);
      const template =
        baseCombined.models.find((model) => model.model === modelId) ?? sourceModels[0] ?? null;
      if (!template) return null;
      const returns = sourceModels.flatMap((model) => model.returns);
      const details = sourceModels.flatMap((model) => model.pair_details);
      return rebuildModel(template, returns, details);
    })
    .filter((model): model is GridModel => Boolean(model));

  return {
    ...baseCombined,
    label: sections.length === 1 ? sections[0]?.label ?? baseCombined.label : baseCombined.label,
    models,
  };
}

function rebuildModel(model: GridModel, returns: GridReturn[], pairDetails: GridPairDetail[]): GridModel {
  const stats = recomputeReturns(returns);
  const percent = returns.reduce((sum, entry) => sum + finiteNumber(entry.percent), 0);
  const total = pairDetails.reduce((sum, detail) => sum + Math.max(1, detail.children?.length ?? 0), 0);

  return {
    ...model,
    percent,
    priced: returns.length,
    total,
    returns,
    pair_details: pairDetails,
    stats,
    diagnostics: {
      ...model.diagnostics,
      max_drawdown: computeMaxDrawdownFromReturns(returns.map((entry) => entry.percent)),
      profit_factor: computeProfitFactor(returns.map((entry) => entry.percent)),
    },
  };
}

function hasModelActivity(model: GridModel): boolean {
  return (
    Math.abs(model.percent) > 1e-9 ||
    model.returns.some((entry) => Math.abs(finiteNumber(entry.percent)) > 1e-9) ||
    model.pair_details.some((detail) => Math.abs(finiteNumber(detail.percent)) > 1e-9)
  );
}

function recomputeReturns(returns: GridReturn[]): GridModel["stats"] {
  if (returns.length === 0) {
    return {
      win_rate: 0,
      avg_return: 0,
      volatility: 0,
      median_return: 0,
      best_pair: null,
      worst_pair: null,
    };
  }

  const values = returns.map((entry) => finiteNumber(entry.percent));
  const sorted = [...values].sort((a, b) => a - b);
  const wins = values.filter((value) => value > 0).length;
  const average = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance = values.reduce((sum, value) => sum + (value - average) ** 2, 0) / values.length;
  const mid = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];

  return {
    win_rate: (wins / values.length) * 100,
    avg_return: average,
    volatility: Math.sqrt(variance),
    median_return: median,
    best_pair: returns.reduce((best, entry) => (entry.percent > (best?.percent ?? -Infinity) ? entry : best), null as GridReturn | null),
    worst_pair: returns.reduce((worst, entry) => (entry.percent < (worst?.percent ?? Infinity) ? entry : worst), null as GridReturn | null),
  };
}

function filterAllTimePerAsset(
  perAsset: EngineGridProps["allTime"]["perAsset"],
  scope: PerformanceAssetSelection,
): EngineGridProps["allTime"]["perAsset"] {
  return Object.fromEntries(
    Object.entries(perAsset).filter(([assetClass]) => assetMatchesPerformanceScope(assetClass, scope)),
  );
}

function combineAllTimeRows(
  rows: EngineGridProps["allTime"]["combined"],
): EngineGridProps["allTime"]["combined"] {
  const byModel = new Map<
    EngineGridProps["allTime"]["combined"][number]["model"],
    EngineGridProps["allTime"]["combined"][number]
  >();
  for (const row of rows) {
    const current = byModel.get(row.model);
    if (!current) {
      byModel.set(row.model, { ...row });
      continue;
    }
    const weeks = Math.max(current.weeks, row.weeks);
    const totalPercent = current.totalPercent + row.totalPercent;
    byModel.set(row.model, {
      ...current,
      totalPercent,
      weeks,
      winRate:
        current.weeks + row.weeks > 0
          ? ((current.winRate * current.weeks) + (row.winRate * row.weeks)) /
            (current.weeks + row.weeks)
          : 0,
      avgWeekly: weeks > 0 ? totalPercent / weeks : 0,
    });
  }
  return Array.from(byModel.values());
}

function resolveScopedSimulationSeries(
  simulation: EngineSimulationGroup | null,
  scope: PerformanceAssetSelection,
): EngineSimulationSeries | null {
  if (!simulation) return null;
  const assetSeries = simulation.series.filter((series) => series.id.startsWith("asset:"));
  const activeAssetSeries = isAllPerformanceAssetSelection(scope)
    ? assetSeries
    : assetSeries.filter((series) => assetMatchesPerformanceScope(series.id.slice("asset:".length), scope));
  const totalSeries = simulation.series.find((series) => series.id === "equity" || series.id === "total") ?? null;

  if (isAllPerformanceAssetSelection(scope) && totalSeries) return totalSeries;
  if (activeAssetSeries.length === 0) return null;
  if (activeAssetSeries.length === 1) return activeAssetSeries[0];
  return computeMixedSeries(activeAssetSeries);
}

function computeMixedSeries(seriesList: EngineSimulationSeries[]): EngineSimulationSeries {
  const pointMap = new Map<string, EngineSimulationSeries["points"][number]>();

  for (const series of seriesList) {
    for (const point of series.points) {
      const existing = pointMap.get(point.ts_utc);
      if (!existing) {
        pointMap.set(point.ts_utc, { ...point });
        continue;
      }
      existing.equity_pct += point.equity_pct;
      existing.lock_pct = (existing.lock_pct ?? 0) + (point.lock_pct ?? 0);
      existing.active_positions = (existing.active_positions ?? 0) + (point.active_positions ?? 0);
    }
  }

  let peak = -Infinity;
  const points = Array.from(pointMap.values())
    .sort((a, b) => new Date(a.ts_utc).getTime() - new Date(b.ts_utc).getTime())
    .map((point) => {
      peak = Math.max(peak, point.equity_pct);
      const drawdown = point.equity_pct - peak;
      return {
        ...point,
        peak_pct: peak,
        drawdown_pct: drawdown < 0 ? drawdown : 0,
      };
    });

  return {
    id: "scoped-mix",
    label: "Scoped Mix",
    color: "#14b8a6",
    trades: seriesList.reduce((sum, series) => sum + (series.trades ?? 0), 0),
    points,
  };
}

function filterMarketHours<T extends { ts_utc: string }>(
  points: T[],
  options: { includeWeekends: boolean },
): T[] {
  const now = Date.now();
  return points.filter((point) => {
    const ts = new Date(point.ts_utc).getTime();
    if (!Number.isFinite(ts) || ts > now) return false;
    if (options.includeWeekends) return true;
    return !isWeekend(point.ts_utc);
  });
}

function isWeekend(tsUtc: string): boolean {
  const date = new Date(tsUtc);
  const day = date.getUTCDay();
  if (day === 6) return true;
  if (day === 0 && date.getUTCHours() < 21) return true;
  return false;
}

function computeMaxDrawdownFromReturns(values: number[]): number | null {
  if (values.length === 0) return null;
  let equity = 0;
  let peak = 0;
  let maxDrawdown = 0;
  for (const value of values) {
    equity += finiteNumber(value);
    peak = Math.max(peak, equity);
    maxDrawdown = Math.min(maxDrawdown, equity - peak);
  }
  return Math.abs(maxDrawdown);
}

function computeProfitFactor(values: number[]): number | null {
  let gains = 0;
  let losses = 0;
  for (const value of values) {
    if (value > 0) gains += value;
    if (value < 0) losses += Math.abs(value);
  }
  if (losses === 0) return gains > 0 ? Number.POSITIVE_INFINITY : null;
  return gains / losses;
}

function finiteNumber(value: number | null | undefined): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function uniqueStable(values: string[]): string[] {
  return Array.from(new Set(values));
}

/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/
