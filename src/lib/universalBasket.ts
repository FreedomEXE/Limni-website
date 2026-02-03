import { DateTime } from "luxon";
import { fetchBitgetCandleSeries } from "@/lib/bitget";
import { fetchOandaCandleSeries, getOandaInstrument } from "@/lib/oandaPrices";
import { getWeekOpenUtc, listPerformanceWeeks, readPerformanceSnapshotsByWeek, weekLabelFromOpen } from "@/lib/performanceSnapshots";

export type UniversalWeekSimulation = {
  week_open_utc: string;
  week_label: string;
  total_percent: number;
  observed_peak_percent: number;
  simulated_locked_percent: number;
  trailing_hit: boolean;
  legs: number;
  priced_symbols: number;
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
  weight: number;
  openTs: number;
  closeTs: number;
  openPrice: number;
  points: SeriesPoint[];
};

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

function mapRowsToWeights(rows: Awaited<ReturnType<typeof readPerformanceSnapshotsByWeek>>) {
  const map = new Map<
    string,
    {
      assetClass: string;
      pair: string;
      longVotes: number;
      shortVotes: number;
      reportDate: string | null;
      legs: number;
    }
  >();

  for (const row of rows) {
    for (const detail of row.pair_details) {
      if (detail.direction !== "LONG" && detail.direction !== "SHORT") {
        continue;
      }
      const key = `${row.asset_class}|${detail.pair}`;
      const entry = map.get(key) ?? {
        assetClass: row.asset_class,
        pair: detail.pair,
        longVotes: 0,
        shortVotes: 0,
        reportDate: row.report_date ?? null,
        legs: 0,
      };
      if (detail.direction === "LONG") {
        entry.longVotes += 1;
      } else {
        entry.shortVotes += 1;
      }
      entry.legs += 1;
      if (!entry.reportDate && row.report_date) {
        entry.reportDate = row.report_date;
      }
      map.set(key, entry);
    }
  }

  return Array.from(map.values())
    .map((row) => {
      const netVotes = row.longVotes - row.shortVotes;
      return {
        assetClass: row.assetClass,
        pair: row.pair,
        weight: netVotes > 0 ? 1 : netVotes < 0 ? -1 : 0,
        reportDate: row.reportDate,
        legs: row.legs,
      };
    })
    .filter((row) => row.weight !== 0);
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
  weight: number;
  reportDate: string | null;
  weekOpenUtc: string;
}): Promise<SymbolSeries | null> {
  const { assetClass, pair, weight, reportDate, weekOpenUtc } = input;
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
      const candles = await fetchBitgetCandleSeries(base, window);
      if (candles.length === 0) {
        return null;
      }
      return {
        key: `${assetClass}|${pair}`,
        assetClass,
        pair,
        weight,
        openTs: window.openUtc.toMillis(),
        closeTs: window.closeUtc.toMillis(),
        openPrice: candles[0].open,
        points: candles.map((c): SeriesPoint => ({ ts: c.ts, open: c.open, close: c.close })),
      };
    }

    const symbol = assetClass === "fx" ? fxSymbol(pair) : pair;
    const candles = await fetchOandaCandleSeries(getOandaInstrument(symbol), window.openUtc, window.closeUtc);
    if (candles.length === 0) {
      return null;
    }
    return {
      key: `${assetClass}|${pair}`,
      assetClass,
      pair,
      weight,
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

function simulateWeekFromSeries(series: SymbolSeries[], trailStartPct: number, trailOffsetPct: number) {
  const timestamps = Array.from(
    new Set(
      series.flatMap((row) => row.points.map((p) => p.ts)),
    ),
  ).sort((a, b) => a - b);

  if (timestamps.length === 0) {
    return {
      peak: 0,
      locked: 0,
      trailingHit: false,
      finalReturn: 0,
    };
  }

  let peak = 0;
  let lock = 0;
  let trailingActive = false;
  let trailingHit = false;
  let finalReturn = 0;

  for (const ts of timestamps) {
    let total = 0;
    for (const row of series) {
      if (ts < row.openTs || ts > row.closeTs || row.openPrice <= 0) {
        continue;
      }
      const close = getLatestClose(row.points, ts);
      if (close === null) {
        continue;
      }
      const pct = ((close - row.openPrice) / row.openPrice) * 100;
      total += pct * row.weight;
    }

    if (total > peak) {
      peak = total;
    }
    if (total >= trailStartPct) {
      trailingActive = true;
      const nextLock = peak - trailOffsetPct;
      if (nextLock > lock) {
        lock = nextLock;
      }
    }
    if (trailingActive && lock > 0 && total <= lock) {
      trailingHit = true;
    }
    finalReturn = total;
  }

  return {
    peak,
    locked: Math.max(0, lock),
    trailingHit,
    finalReturn,
  };
}

export async function buildUniversalBasketSummary(options?: {
  trailStartPct?: number;
  trailOffsetPct?: number;
  includeCurrentWeek?: boolean;
  limitWeeks?: number;
}): Promise<UniversalBasketSummary> {
  const trailStartPct = options?.trailStartPct ?? 20;
  const trailOffsetPct = options?.trailOffsetPct ?? 10;
  const includeCurrentWeek = options?.includeCurrentWeek ?? false;
  const limitWeeks = options?.limitWeeks ?? 6;
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

    const symbols = mapRowsToWeights(rows);
    const legs = symbols.reduce((sum, row) => sum + row.legs, 0);

    const seriesList = await runWithConcurrency(
      symbols.map((row) => ({
        assetClass: row.assetClass,
        pair: row.pair,
        weight: row.weight,
        reportDate: row.reportDate,
        weekOpenUtc,
      })),
      8,
      fetchSeriesForSymbol,
    );
    const validSeries = seriesList.filter((row): row is SymbolSeries => row !== null);

    const sim = simulateWeekFromSeries(validSeries, trailStartPct, trailOffsetPct);
    byWeek.push({
      week_open_utc: weekOpenUtc,
      week_label: weekLabelFromOpen(weekOpenUtc),
      total_percent: sim.finalReturn,
      observed_peak_percent: sim.peak,
      simulated_locked_percent: sim.locked,
      trailing_hit: sim.trailingHit,
      legs,
      priced_symbols: validSeries.length,
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
      timeframe: "H1",
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
