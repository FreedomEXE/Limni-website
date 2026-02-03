import { DateTime } from "luxon";
import { fetchBitgetCandleSeries, fetchBitgetMinuteSeries } from "@/lib/bitget";
import {
  fetchOandaCandleSeries,
  fetchOandaMinuteSeries,
  getOandaInstrument,
} from "@/lib/oandaPrices";
import { getWeekOpenUtc, listPerformanceWeeks, readPerformanceSnapshotsByWeek, weekLabelFromOpen } from "@/lib/performanceSnapshots";
import type { PerformanceModel } from "@/lib/performanceLab";

export type UniversalWeekSimulation = {
  week_open_utc: string;
  week_label: string;
  total_percent: number;
  observed_peak_percent: number;
  simulated_locked_percent: number;
  trailing_hit: boolean;
  trail_activated_at_utc: string | null;
  trail_hit_at_utc: string | null;
  legs: number;
  priced_symbols: number;
  equity_curve: Array<{
    ts_utc: string;
    equity_pct: number;
    lock_pct: number | null;
  }>;
};

export type UniversalBasketSummary = {
  generated_at: string;
  assumptions: {
    trail_start_pct: number;
    trail_offset_pct: number;
    timeframe: string;
  };
  overall: {
    weeks: number;
    total_percent: number;
    avg_weekly_percent: number;
    win_rate: number;
    simulated_locked_total_percent: number;
    avg_simulated_locked_percent: number;
    best_week: UniversalWeekSimulation | null;
    worst_week: UniversalWeekSimulation | null;
  };
  by_week: UniversalWeekSimulation[];
};

type SeriesPoint = {
  ts: number;
  open: number;
  close: number;
};

type SymbolSeries = {
  key: string;
  assetClass: string;
  pair: string;
  openTs: number;
  closeTs: number;
  openPrice: number;
  points: SeriesPoint[];
};

type UniversalLeg = {
  assetClass: string;
  pair: string;
  direction: 1 | -1;
  reportDate: string | null;
};

type SnapshotWeekRow = Awaited<ReturnType<typeof readPerformanceSnapshotsByWeek>>[number];

export type TrailingSimulationSummary = {
  peak_percent: number;
  locked_percent: number;
  trailing_hit: boolean;
  peak_day: string | null;
  max_drawdown: number;
};

export type PerModelBasketSummary = {
  generated_at: string;
  assumptions: {
    trail_start_pct: number;
    trail_offset_pct: number;
    timeframe: string;
  };
  models: Array<{
    model: PerformanceModel;
    model_label: string;
    overall: UniversalBasketSummary["overall"];
    by_week: UniversalWeekSimulation[];
  }>;
};

export type SymbolResearchRow = {
  symbol: string;
  asset_classes: string[];
  models: PerformanceModel[];
  trades: number;
  priced_trades: number;
  total_percent: number;
  avg_percent: number;
  win_rate: number;
  best_trade_percent: number | null;
  worst_trade_percent: number | null;
  weeks_traded: number;
  weekly: Array<{
    week_open_utc: string;
    week_label: string;
    percent: number;
  }>;
};

export type SymbolResearchSummary = {
  generated_at: string;
  weeks: number;
  model_filter: "all" | PerformanceModel;
  total_trades: number;
  priced_trades: number;
  total_percent: number;
  rows: SymbolResearchRow[];
  equity_curve: Array<{
    ts_utc: string;
    equity_pct: number;
    lock_pct: null;
  }>;
};

type SimulationTimeframe = "M1" | "H1";

function fxSymbol(pair: string): string {
  if (pair.includes("/")) {
    return pair;
  }
  if (pair.length === 6) {
    return `${pair.slice(0, 3)}/${pair.slice(3)}`;
  }
  return pair;
}

function getCryptoBase(pair: string): "BTC" | "ETH" | null {
  if (pair.startsWith("BTC")) {
    return "BTC";
  }
  if (pair.startsWith("ETH")) {
    return "ETH";
  }
  return null;
}

function mapRowsToLegs(rows: Awaited<ReturnType<typeof readPerformanceSnapshotsByWeek>>) {
  const legs: UniversalLeg[] = [];
  for (const row of rows) {
    for (const detail of row.pair_details) {
      if (detail.direction !== "LONG" && detail.direction !== "SHORT") {
        continue;
      }
      legs.push({
        assetClass: row.asset_class,
        pair: detail.pair,
        reportDate: row.report_date ?? null,
        direction: detail.direction === "LONG" ? 1 : -1,
      });
    }
  }
  return legs;
}

function mapRowsToLegsByModel(
  rows: SnapshotWeekRow[],
  model: PerformanceModel,
) {
  return mapRowsToLegs(rows.filter((row) => row.model === model));
}

function getWindowForAsset(assetClass: string, reportDate: string | null, weekOpenUtc: string) {
  const weekOpen = DateTime.fromISO(weekOpenUtc, { zone: "utc" });
  if (assetClass === "crypto") {
    if (reportDate) {
      const report = DateTime.fromISO(reportDate, { zone: "utc" });
      if (report.isValid) {
        const nextMonday = report.startOf("week").plus({ weeks: 1 });
        return {
          openUtc: nextMonday.toUTC(),
          closeUtc: nextMonday.plus({ weeks: 1 }).toUTC(),
        };
      }
    }
    return {
      openUtc: weekOpen.isValid ? weekOpen : DateTime.utc().startOf("week"),
      closeUtc: (weekOpen.isValid ? weekOpen : DateTime.utc().startOf("week")).plus({ weeks: 1 }),
    };
  }

  if (reportDate) {
    const reportNy = DateTime.fromISO(reportDate, { zone: "America/New_York" });
    if (reportNy.isValid) {
      const daysUntilSunday = (7 - (reportNy.weekday % 7)) % 7;
      const sunday = reportNy
        .plus({ days: daysUntilSunday })
        .set({ hour: assetClass === "fx" ? 17 : 18, minute: 0, second: 0, millisecond: 0 });
      const friday = sunday
        .plus({ days: 5 })
        .set({ hour: 17, minute: 0, second: 0, millisecond: 0 });
      return { openUtc: sunday.toUTC(), closeUtc: friday.toUTC() };
    }
  }

  const fallback = weekOpen.isValid ? weekOpen : DateTime.utc().startOf("week");
  return { openUtc: fallback, closeUtc: fallback.plus({ days: 5 }) };
}

function getLatestClose(points: SeriesPoint[], ts: number): number | null {
  let left = 0;
  let right = points.length - 1;
  let best = -1;
  while (left <= right) {
    const mid = Math.floor((left + right) / 2);
    if (points[mid].ts <= ts) {
      best = mid;
      left = mid + 1;
    } else {
      right = mid - 1;
    }
  }
  if (best < 0) {
    return null;
  }
  return points[best].close;
}

async function runWithConcurrency<T, R>(
  items: T[],
  limit: number,
  task: (item: T) => Promise<R>,
): Promise<R[]> {
  const safeLimit = Math.max(1, limit);
  const results: R[] = [];
  for (let i = 0; i < items.length; i += safeLimit) {
    const chunk = items.slice(i, i + safeLimit);
    const chunkResults = await Promise.all(chunk.map((item) => task(item)));
    results.push(...chunkResults);
  }
  return results;
}

async function fetchSeriesForSymbol(input: {
  assetClass: string;
  pair: string;
  reportDate: string | null;
  weekOpenUtc: string;
  timeframe: SimulationTimeframe;
}): Promise<SymbolSeries | null> {
  const { assetClass, pair, reportDate, weekOpenUtc, timeframe } = input;
  const window = getWindowForAsset(assetClass, reportDate, weekOpenUtc);
  if (window.closeUtc.toMillis() <= window.openUtc.toMillis()) {
    return null;
  }

  try {
    if (assetClass === "crypto") {
      const base = getCryptoBase(pair);
      if (!base) {
        return null;
      }
      const candles =
        timeframe === "M1"
          ? await fetchBitgetMinuteSeries(base, window)
          : await fetchBitgetCandleSeries(base, window);
      if (candles.length === 0) {
        return null;
      }
      return {
        key: `${assetClass}|${pair}`,
        assetClass,
        pair,
        openTs: window.openUtc.toMillis(),
        closeTs: window.closeUtc.toMillis(),
        openPrice: candles[0].open,
        points: candles.map((c): SeriesPoint => ({ ts: c.ts, open: c.open, close: c.close })),
      };
    }

    const symbol = assetClass === "fx" ? fxSymbol(pair) : pair;
    const candles =
      timeframe === "M1"
        ? await fetchOandaMinuteSeries(
            getOandaInstrument(symbol),
            window.openUtc,
            window.closeUtc,
          )
        : await fetchOandaCandleSeries(
            getOandaInstrument(symbol),
            window.openUtc,
            window.closeUtc,
          );
    if (candles.length === 0) {
      return null;
    }
    return {
      key: `${assetClass}|${pair}`,
      assetClass,
      pair,
      openTs: window.openUtc.toMillis(),
      closeTs: window.closeUtc.toMillis(),
      openPrice: candles[0].open,
      points: candles.map((c): SeriesPoint => ({ ts: c.ts, open: c.open, close: c.close })),
    };
  } catch (error) {
    console.error("Universal simulation series fetch failed:", assetClass, pair, error);
    return null;
  }
}

function simulateWeekFromSeries(
  seriesByKey: Map<string, SymbolSeries>,
  legs: UniversalLeg[],
  trailStartPct: number,
  trailOffsetPct: number,
) {
  const timestamps = Array.from(
    new Set(
      Array.from(seriesByKey.values()).flatMap((row) => row.points.map((p) => p.ts)),
    ),
  ).sort((a, b) => a - b);

  if (timestamps.length === 0) {
    return {
      peak: 0,
      peakTs: null as number | null,
      locked: 0,
      trailingHit: false,
      finalReturn: 0,
      trailActivatedAtMs: null as number | null,
      trailHitAtMs: null as number | null,
      curve: [] as Array<{ ts: number; equity: number; lock: number | null }>,
    };
  }

  let peak = 0;
  let lock = Number.NEGATIVE_INFINITY;
  let trailingActive = false;
  let trailingHit = false;
  let finalReturn = 0;
  let peakTs: number | null = null;
  let lockedReturn: number | null = null;
  let trailActivatedAtMs: number | null = null;
  let trailHitAtMs: number | null = null;
  const curve: Array<{ ts: number; equity: number; lock: number | null }> = [];
  const minLockAfterActivation = trailStartPct - trailOffsetPct;

  for (const ts of timestamps) {
    let total = 0;
    for (const leg of legs) {
      const row = seriesByKey.get(`${leg.assetClass}|${leg.pair}`);
      if (!row) {
        continue;
      }
      if (ts < row.openTs || ts > row.closeTs || row.openPrice <= 0) {
        continue;
      }
      const close = getLatestClose(row.points, ts);
      if (close === null) {
        continue;
      }
      const pct = ((close - row.openPrice) / row.openPrice) * 100;
      total += pct * leg.direction;
    }

    if (total > peak) {
      peak = total;
      peakTs = ts;
    }
    if (!trailingHit) {
      if (total >= trailStartPct) {
        trailingActive = true;
        if (trailActivatedAtMs === null) {
          trailActivatedAtMs = ts;
        }
        const nextLock = Math.max(minLockAfterActivation, peak - trailOffsetPct);
        if (nextLock > lock) {
          lock = nextLock;
        }
      }
    }
    curve.push({
      ts,
      equity: total,
      lock: Number.isFinite(lock) ? lock : null,
    });
    if (!trailingHit && trailingActive && Number.isFinite(lock) && total <= lock) {
      trailingHit = true;
      trailHitAtMs = ts;
      // Assume ideal trailing-stop fill at lock level (no gap slippage).
      lockedReturn = lock;
    }
    finalReturn = total;
  }

  if (lockedReturn === null) {
    lockedReturn = finalReturn;
  }

  return {
    peak,
    peakTs,
    locked: lockedReturn,
    trailingHit,
    finalReturn,
    trailActivatedAtMs,
    trailHitAtMs,
    curve,
  };
}

function computeMaxDrawdownFromCurve(
  curve: Array<{ ts: number; equity: number; lock: number | null }>,
) {
  let peak = Number.NEGATIVE_INFINITY;
  let maxDrawdown = 0;
  for (const point of curve) {
    if (point.equity > peak) {
      peak = point.equity;
    }
    if (Number.isFinite(peak)) {
      const drawdown = peak - point.equity;
      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
      }
    }
  }
  return maxDrawdown;
}

function compressCurve(
  points: Array<{ ts: number; equity: number; lock: number | null }>,
  maxPoints = 720,
) {
  if (points.length <= maxPoints) {
    return points;
  }
  const compressed: Array<{ ts: number; equity: number; lock: number | null }> = [];
  const step = (points.length - 1) / (maxPoints - 1);
  for (let i = 0; i < maxPoints; i += 1) {
    const index = Math.round(i * step);
    compressed.push(points[Math.min(index, points.length - 1)]);
  }
  return compressed;
}

export async function buildUniversalBasketSummary(options?: {
  trailStartPct?: number;
  trailOffsetPct?: number;
  includeCurrentWeek?: boolean;
  limitWeeks?: number;
  timeframe?: SimulationTimeframe;
}): Promise<UniversalBasketSummary> {
  const trailStartPct = options?.trailStartPct ?? 20;
  const trailOffsetPct = options?.trailOffsetPct ?? 10;
  const includeCurrentWeek = options?.includeCurrentWeek ?? false;
  const limitWeeks = options?.limitWeeks ?? 6;
  const timeframe = options?.timeframe ?? "M1";
  const nowIso = DateTime.utc().toISO() ?? new Date().toISOString();
  const currentWeekOpenUtc = getWeekOpenUtc();

  const weekOptions = await listPerformanceWeeks(Math.max(limitWeeks * 2, 20));
  const targetWeeks = weekOptions
    .filter((week) => (includeCurrentWeek ? true : week !== currentWeekOpenUtc))
    .slice(0, limitWeeks);

  const byWeek: UniversalWeekSimulation[] = [];

  for (const weekOpenUtc of targetWeeks) {
    const rows = await readPerformanceSnapshotsByWeek(weekOpenUtc);
    if (rows.length === 0) {
      continue;
    }

    const legs = mapRowsToLegs(rows);
    const uniqueSymbols = new Map<
      string,
      {
        assetClass: string;
        pair: string;
        reportDate: string | null;
        weekOpenUtc: string;
        timeframe: SimulationTimeframe;
      }
    >();
    for (const leg of legs) {
      const key = `${leg.assetClass}|${leg.pair}`;
      if (!uniqueSymbols.has(key)) {
        uniqueSymbols.set(key, {
          assetClass: leg.assetClass,
          pair: leg.pair,
          reportDate: leg.reportDate,
          weekOpenUtc,
          timeframe,
        });
      }
    }

    const seriesList = await runWithConcurrency(
      Array.from(uniqueSymbols.values()),
      8,
      fetchSeriesForSymbol,
    );
    const validSeries = seriesList.filter((row): row is SymbolSeries => row !== null);
    const seriesByKey = new Map(validSeries.map((row) => [row.key, row]));

    const sim = simulateWeekFromSeries(seriesByKey, legs, trailStartPct, trailOffsetPct);
    const curve = compressCurve(sim.curve).map((point) => ({
      ts_utc: new Date(point.ts).toISOString(),
      equity_pct: point.equity,
      lock_pct: point.lock,
    }));
    byWeek.push({
      week_open_utc: weekOpenUtc,
      week_label: weekLabelFromOpen(weekOpenUtc),
      total_percent: sim.finalReturn,
      observed_peak_percent: sim.peak,
      simulated_locked_percent: sim.locked,
      trailing_hit: sim.trailingHit,
      trail_activated_at_utc:
        sim.trailActivatedAtMs === null ? null : new Date(sim.trailActivatedAtMs).toISOString(),
      trail_hit_at_utc:
        sim.trailHitAtMs === null ? null : new Date(sim.trailHitAtMs).toISOString(),
      legs: legs.length,
      priced_symbols: validSeries.length,
      equity_curve: curve,
    });
  }

  const totalPercent = byWeek.reduce((sum, row) => sum + row.total_percent, 0);
  const totalLocked = byWeek.reduce((sum, row) => sum + row.simulated_locked_percent, 0);
  const weeks = byWeek.length;
  const wins = byWeek.filter((row) => row.total_percent > 0).length;
  const bestWeek =
    weeks > 0
      ? byWeek.reduce((best, row) => (row.total_percent > best.total_percent ? row : best))
      : null;
  const worstWeek =
    weeks > 0
      ? byWeek.reduce((worst, row) => (row.total_percent < worst.total_percent ? row : worst))
      : null;

  return {
    generated_at: nowIso,
    assumptions: {
      trail_start_pct: trailStartPct,
      trail_offset_pct: trailOffsetPct,
      timeframe,
    },
    overall: {
      weeks,
      total_percent: totalPercent,
      avg_weekly_percent: weeks > 0 ? totalPercent / weeks : 0,
      win_rate: weeks > 0 ? (wins / weeks) * 100 : 0,
      simulated_locked_total_percent: totalLocked,
      avg_simulated_locked_percent: weeks > 0 ? totalLocked / weeks : 0,
      best_week: bestWeek,
      worst_week: worstWeek,
    },
    by_week: byWeek,
  };
}

const MODEL_LABELS: Record<PerformanceModel, string> = {
  antikythera: "Antikythera",
  blended: "Blended",
  dealer: "Dealer",
  commercial: "Commercial",
  sentiment: "Sentiment",
};

export async function simulateTrailingForGroupsFromRows(options: {
  weekOpenUtc: string;
  groups: Array<{ key: string; rows: SnapshotWeekRow[] }>;
  trailStartPct?: number;
  trailOffsetPct?: number;
  timeframe?: SimulationTimeframe;
}) {
  const trailStartPct = options.trailStartPct ?? 10;
  const trailOffsetPct = options.trailOffsetPct ?? 5;
  const timeframe = options.timeframe ?? "M1";
  const result: Record<string, TrailingSimulationSummary> = {};
  const legsByGroup = new Map<string, UniversalLeg[]>();
  const uniqueSymbols = new Map<
    string,
    {
      assetClass: string;
      pair: string;
      reportDate: string | null;
      weekOpenUtc: string;
      timeframe: SimulationTimeframe;
    }
  >();

  for (const group of options.groups) {
    const legs = mapRowsToLegs(group.rows);
    legsByGroup.set(group.key, legs);
    for (const leg of legs) {
      const symbolKey = `${leg.assetClass}|${leg.pair}`;
      if (!uniqueSymbols.has(symbolKey)) {
        uniqueSymbols.set(symbolKey, {
          assetClass: leg.assetClass,
          pair: leg.pair,
          reportDate: leg.reportDate,
          weekOpenUtc: options.weekOpenUtc,
          timeframe,
        });
      }
    }
  }

  const seriesList = await runWithConcurrency(
    Array.from(uniqueSymbols.values()),
    8,
    fetchSeriesForSymbol,
  );
  const validSeries = seriesList.filter((row): row is SymbolSeries => row !== null);
  const seriesByKey = new Map(validSeries.map((row) => [row.key, row]));

  for (const group of options.groups) {
    const legs = legsByGroup.get(group.key) ?? [];
    const sim = simulateWeekFromSeries(seriesByKey, legs, trailStartPct, trailOffsetPct);
    const peakDay =
      sim.peakTs === null
        ? null
        : DateTime.fromMillis(sim.peakTs, { zone: "utc" })
            .setZone("America/New_York")
            .toFormat("MMM dd, yyyy h:mm a 'ET'");
    result[group.key] = {
      peak_percent: sim.peak,
      locked_percent: sim.locked,
      trailing_hit: sim.trailingHit,
      peak_day: peakDay,
      max_drawdown: -computeMaxDrawdownFromCurve(sim.curve),
    };
  }

  return result;
}

export async function buildPerModelBasketSummary(options?: {
  trailStartPct?: number;
  trailOffsetPct?: number;
  includeCurrentWeek?: boolean;
  limitWeeks?: number;
  timeframe?: SimulationTimeframe;
}): Promise<PerModelBasketSummary> {
  const trailStartPct = options?.trailStartPct ?? 10;
  const trailOffsetPct = options?.trailOffsetPct ?? 5;
  const includeCurrentWeek = options?.includeCurrentWeek ?? false;
  const limitWeeks = options?.limitWeeks ?? 8;
  const timeframe = options?.timeframe ?? "M1";
  const nowIso = DateTime.utc().toISO() ?? new Date().toISOString();
  const currentWeekOpenUtc = getWeekOpenUtc();
  const models: PerformanceModel[] = [
    "antikythera",
    "blended",
    "dealer",
    "commercial",
    "sentiment",
  ];

  const weekOptions = await listPerformanceWeeks(Math.max(limitWeeks * 2, 20));
  const targetWeeks = weekOptions
    .filter((week) => (includeCurrentWeek ? true : week !== currentWeekOpenUtc))
    .slice(0, limitWeeks);

  const byModel = new Map<PerformanceModel, UniversalWeekSimulation[]>();
  for (const model of models) {
    byModel.set(model, []);
  }

  for (const weekOpenUtc of targetWeeks) {
    const rows = await readPerformanceSnapshotsByWeek(weekOpenUtc);
    if (rows.length === 0) {
      continue;
    }
    const groups = models.map((model) => ({
      key: model,
      rows: rows.filter((row) => row.model === model),
    }));
    const trailingByModel = await simulateTrailingForGroupsFromRows({
      weekOpenUtc,
      groups,
      trailStartPct,
      trailOffsetPct,
      timeframe,
    });

    for (const model of models) {
      const modelRows = rows.filter((row) => row.model === model);
      if (modelRows.length === 0) {
        continue;
      }
      const trailing = trailingByModel[model];
      const rawTotal = modelRows.reduce((sum, row) => sum + row.percent, 0);
      const legs = mapRowsToLegsByModel(rows, model);
      const modelWeek: UniversalWeekSimulation = {
        week_open_utc: weekOpenUtc,
        week_label: weekLabelFromOpen(weekOpenUtc),
        total_percent: rawTotal,
        observed_peak_percent: trailing?.peak_percent ?? rawTotal,
        simulated_locked_percent: trailing?.locked_percent ?? rawTotal,
        trailing_hit: trailing?.trailing_hit ?? false,
        trail_activated_at_utc: null,
        trail_hit_at_utc: null,
        legs: legs.length,
        priced_symbols: legs.length,
        equity_curve: [],
      };
      byModel.get(model)?.push(modelWeek);
    }
  }

  const summaries = models.map((model) => {
    const weeks = byModel.get(model) ?? [];
    const totalPercent = weeks.reduce((sum, row) => sum + row.total_percent, 0);
    const totalLocked = weeks.reduce((sum, row) => sum + row.simulated_locked_percent, 0);
    const wins = weeks.filter((row) => row.total_percent > 0).length;
    const bestWeek =
      weeks.length > 0
        ? weeks.reduce((best, row) => (row.total_percent > best.total_percent ? row : best))
        : null;
    const worstWeek =
      weeks.length > 0
        ? weeks.reduce((worst, row) => (row.total_percent < worst.total_percent ? row : worst))
        : null;
    return {
      model,
      model_label: MODEL_LABELS[model],
      overall: {
        weeks: weeks.length,
        total_percent: totalPercent,
        avg_weekly_percent: weeks.length > 0 ? totalPercent / weeks.length : 0,
        win_rate: weeks.length > 0 ? (wins / weeks.length) * 100 : 0,
        simulated_locked_total_percent: totalLocked,
        avg_simulated_locked_percent: weeks.length > 0 ? totalLocked / weeks.length : 0,
        best_week: bestWeek,
        worst_week: worstWeek,
      },
      by_week: weeks,
    };
  });

  return {
    generated_at: nowIso,
    assumptions: {
      trail_start_pct: trailStartPct,
      trail_offset_pct: trailOffsetPct,
      timeframe,
    },
    models: summaries,
  };
}

export async function buildSymbolResearchSummary(options?: {
  modelFilter?: "all" | PerformanceModel;
  includeCurrentWeek?: boolean;
  limitWeeks?: number;
}): Promise<SymbolResearchSummary> {
  const modelFilter = options?.modelFilter ?? "all";
  const includeCurrentWeek = options?.includeCurrentWeek ?? false;
  const limitWeeks = options?.limitWeeks ?? 8;
  const nowIso = DateTime.utc().toISO() ?? new Date().toISOString();
  const currentWeekOpenUtc = getWeekOpenUtc();

  const weekOptions = await listPerformanceWeeks(Math.max(limitWeeks * 2, 20));
  const targetWeeks = weekOptions
    .filter((week) => (includeCurrentWeek ? true : week !== currentWeekOpenUtc))
    .slice(0, limitWeeks);

  const symbolMap = new Map<
    string,
    {
      assets: Set<string>;
      models: Set<PerformanceModel>;
      trades: number;
      pricedTrades: number;
      wins: number;
      total: number;
      best: number | null;
      worst: number | null;
      weekly: Map<string, number>;
    }
  >();
  const weeklyTotals = new Map<string, number>();

  for (const weekOpenUtc of targetWeeks) {
    const rows = await readPerformanceSnapshotsByWeek(weekOpenUtc);
    let weekTotal = 0;
    for (const row of rows) {
      if (modelFilter !== "all" && row.model !== modelFilter) {
        continue;
      }
      for (const detail of row.pair_details) {
        if (detail.direction !== "LONG" && detail.direction !== "SHORT") {
          continue;
        }
        if (!symbolMap.has(detail.pair)) {
          symbolMap.set(detail.pair, {
            assets: new Set<string>(),
            models: new Set<PerformanceModel>(),
            trades: 0,
            pricedTrades: 0,
            wins: 0,
            total: 0,
            best: null,
            worst: null,
            weekly: new Map<string, number>(),
          });
        }
        const entry = symbolMap.get(detail.pair)!;
        entry.assets.add(row.asset_class);
        entry.models.add(row.model);
        entry.trades += 1;
        if (detail.percent === null) {
          continue;
        }
        entry.pricedTrades += 1;
        entry.total += detail.percent;
        if (detail.percent > 0) {
          entry.wins += 1;
        }
        if (entry.best === null || detail.percent > entry.best) {
          entry.best = detail.percent;
        }
        if (entry.worst === null || detail.percent < entry.worst) {
          entry.worst = detail.percent;
        }
        entry.weekly.set(weekOpenUtc, (entry.weekly.get(weekOpenUtc) ?? 0) + detail.percent);
        weekTotal += detail.percent;
      }
    }
    weeklyTotals.set(weekOpenUtc, weekTotal);
  }

  const rows: SymbolResearchRow[] = Array.from(symbolMap.entries())
    .map(([symbol, entry]) => {
      const weekly = targetWeeks
        .map((week) => ({
          week_open_utc: week,
          week_label: weekLabelFromOpen(week),
          percent: entry.weekly.get(week) ?? 0,
        }))
        .filter((item) => item.percent !== 0);
      return {
        symbol,
        asset_classes: Array.from(entry.assets.values()).sort(),
        models: Array.from(entry.models.values()).sort(),
        trades: entry.trades,
        priced_trades: entry.pricedTrades,
        total_percent: entry.total,
        avg_percent: entry.pricedTrades > 0 ? entry.total / entry.pricedTrades : 0,
        win_rate: entry.pricedTrades > 0 ? (entry.wins / entry.pricedTrades) * 100 : 0,
        best_trade_percent: entry.best,
        worst_trade_percent: entry.worst,
        weeks_traded: weekly.length,
        weekly,
      };
    })
    .sort((a, b) => Math.abs(b.total_percent) - Math.abs(a.total_percent));

  const curveWeeks = [...targetWeeks].reverse();
  let cumulative = 0;
  const equityCurve = curveWeeks.map((week) => {
    cumulative += weeklyTotals.get(week) ?? 0;
    return {
      ts_utc: week,
      equity_pct: cumulative,
      lock_pct: null,
    };
  });

  const totalTrades = rows.reduce((sum, row) => sum + row.trades, 0);
  const pricedTrades = rows.reduce((sum, row) => sum + row.priced_trades, 0);
  const totalPercent = rows.reduce((sum, row) => sum + row.total_percent, 0);

  return {
    generated_at: nowIso,
    weeks: targetWeeks.length,
    model_filter: modelFilter,
    total_trades: totalTrades,
    priced_trades: pricedTrades,
    total_percent: totalPercent,
    rows,
    equity_curve: equityCurve,
  };
}
