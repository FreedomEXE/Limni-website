import { DateTime } from "luxon";
import { readPerformanceSnapshotsByWeek, listPerformanceWeeks } from "@/lib/performanceSnapshots";
import { readMarketSnapshot } from "@/lib/priceStore";
import { listAssetClasses } from "@/lib/cotMarkets";

type UniversalWeek = {
  week: string;
  percent: number;
  pips: number;
  usd: number;
  trades: number;
};
type UniversalMonth = {
  month: string;
  count: number;
  percent: number;
  pips: number;
  usd: number;
  avg_percent: number;
  avg_pips: number;
  avg_usd: number;
};

export type UniversalBasketSummary = {
  generated_at: string;
  overall: {
    weeks: number;
    total_percent: number;
    total_pips: number;
    total_usd: number;
    avg_weekly_percent: number;
    avg_weekly_pips: number;
    avg_weekly_usd: number;
    median_weekly_percent: number;
    median_weekly_usd: number;
    win_rate: number;
    max_drawdown_usd: number;
    max_drawdown_percent: number;
    trades: number;
    profit_factor_usd: number | null;
    volatility_percent: number;
    volatility_usd: number;
    best_week: UniversalWeek | null;
    worst_week: UniversalWeek | null;
    max_consecutive_wins: number;
    max_consecutive_losses: number;
  };
  by_week: UniversalWeek[];
  by_month: UniversalMonth[];
};

const CONTRACT_SIZES: Record<string, number> = {
  XAUUSD: 100,
  XAGUSD: 5000,
  WTIUSD: 1000,
  SPXUSD: 1,
  NDXUSD: 1,
  NIKKEIUSD: 1,
  BTCUSD: 1,
  ETHUSD: 1,
};

const DEFAULT_LOTS: Record<string, number> = {
  fx: 0.1,
  commodities: 0.1,
  indices: 0.1,
  crypto: 0.01,
};

function pipSize(pair: string): number {
  return pair.includes("JPY") ? 0.01 : 0.0001;
}

function getFxConversionRate(
  quotes: Record<string, number>,
  quote: string,
): number | null {
  if (quote === "USD") {
    return 1;
  }
  const direct = `USD${quote}`;
  if (quotes[direct]) {
    return 1 / quotes[direct];
  }
  const inverse = `${quote}USD`;
  if (quotes[inverse]) {
    return quotes[inverse];
  }
  return null;
}

export async function buildUniversalBasketSummary(): Promise<UniversalBasketSummary> {
  const nowUtc = DateTime.utc();
  const assetClasses = listAssetClasses().map((asset) => asset.id);
  const weekOptions = await listPerformanceWeeks();
  const weekEntries: UniversalWeek[] = [];

  for (const week of weekOptions) {
    const parsedWeek = DateTime.fromISO(week, { zone: "utc" });
    if (!parsedWeek.isValid || parsedWeek.toMillis() > nowUtc.toMillis()) {
      continue;
    }

    const snapshots = await readPerformanceSnapshotsByWeek(week);
    if (snapshots.length === 0) {
      continue;
    }

    const marketSnapshots = new Map<string, Awaited<ReturnType<typeof readMarketSnapshot>>>();
    for (const assetClass of assetClasses) {
      const snap = await readMarketSnapshot(week, assetClass);
      marketSnapshots.set(assetClass, snap);
    }

    let totalPercent = 0;
    let totalPips = 0;
    let totalUsd = 0;
    let trades = 0;

    const fxQuotes: Record<string, number> = {};
    const fxMarket = marketSnapshots.get("fx");
    if (fxMarket?.pairs) {
      Object.entries(fxMarket.pairs).forEach(([pair, perf]) => {
        if (perf && Number.isFinite(perf.open)) {
          fxQuotes[pair] = perf.open;
        }
      });
    }

    for (const snapshot of snapshots) {
      const marketSnapshot = marketSnapshots.get(snapshot.asset_class);
      if (!marketSnapshot?.pairs) {
        continue;
      }
      const lots = DEFAULT_LOTS[snapshot.asset_class] ?? 0.1;

      for (const detail of snapshot.pair_details) {
        const perf = marketSnapshot.pairs[detail.pair];
        if (!perf) {
          continue;
        }
        const directionFactor = detail.direction === "LONG" ? 1 : -1;
        const signedPercent = perf.percent * directionFactor;
        const signedPips = perf.pips * directionFactor;

        let usd = 0;
        if (snapshot.asset_class === "fx") {
          const quote = detail.pair.slice(3);
          const pipValueQuote = pipSize(detail.pair) * 100000 * lots;
          const conversion = getFxConversionRate(fxQuotes, quote) ?? 0;
          usd = signedPips * pipValueQuote * conversion;
        } else {
          const contract = CONTRACT_SIZES[detail.pair] ?? 1;
          const rawDelta = (perf.current - perf.open) * directionFactor;
          usd = rawDelta * contract * lots;
        }

        totalPercent += signedPercent;
        totalPips += signedPips;
        totalUsd += usd;
        trades += 1;
      }
    }

    weekEntries.push({
      week,
      percent: totalPercent,
      pips: totalPips,
      usd: totalUsd,
      trades,
    });
  }

  weekEntries.sort((a, b) => (a.week < b.week ? 1 : -1));

  const byMonthMap = new Map<string, { count: number; percent: number; pips: number; usd: number }>();
  for (const row of weekEntries) {
    const monthKey = DateTime.fromISO(row.week, { zone: "utc" }).toFormat("yyyy-LL");
    const entry = byMonthMap.get(monthKey) ?? { count: 0, percent: 0, pips: 0, usd: 0 };
    entry.count += 1;
    entry.percent += row.percent;
    entry.pips += row.pips;
    entry.usd += row.usd;
    byMonthMap.set(monthKey, entry);
  }

  const by_month: UniversalMonth[] = Array.from(byMonthMap.entries())
    .map(([month, entry]) => ({
      month,
      count: entry.count,
      percent: entry.percent,
      pips: entry.pips,
      usd: entry.usd,
      avg_percent: entry.count ? entry.percent / entry.count : 0,
      avg_pips: entry.count ? entry.pips / entry.count : 0,
      avg_usd: entry.count ? entry.usd / entry.count : 0,
    }))
    .sort((a, b) => b.month.localeCompare(a.month));

  const totalPercent = weekEntries.reduce((sum, row) => sum + row.percent, 0);
  const totalPips = weekEntries.reduce((sum, row) => sum + row.pips, 0);
  const totalUsd = weekEntries.reduce((sum, row) => sum + row.usd, 0);
  const totalTrades = weekEntries.reduce((sum, row) => sum + row.trades, 0);
  const wins = weekEntries.filter((row) => row.percent > 0).length;
  const weeks = weekEntries.length;
  const percentValues = weekEntries.map((row) => row.percent).sort((a, b) => a - b);
  const usdValues = weekEntries.map((row) => row.usd).sort((a, b) => a - b);
  const medianPercent =
    percentValues.length === 0
      ? 0
      : percentValues.length % 2 === 0
        ? (percentValues[percentValues.length / 2 - 1] + percentValues[percentValues.length / 2]) / 2
        : percentValues[Math.floor(percentValues.length / 2)];
  const medianUsd =
    usdValues.length === 0
      ? 0
      : usdValues.length % 2 === 0
        ? (usdValues[usdValues.length / 2 - 1] + usdValues[usdValues.length / 2]) / 2
        : usdValues[Math.floor(usdValues.length / 2)];
  const avgPercent = weeks > 0 ? totalPercent / weeks : 0;
  const avgUsd = weeks > 0 ? totalUsd / weeks : 0;
  const variancePercent =
    weeks > 0
      ? weekEntries.reduce((sum, row) => sum + (row.percent - avgPercent) ** 2, 0) / weeks
      : 0;
  const varianceUsd =
    weeks > 0
      ? weekEntries.reduce((sum, row) => sum + (row.usd - avgUsd) ** 2, 0) / weeks
      : 0;
  const volatilityPercent = Math.sqrt(variancePercent);
  const volatilityUsd = Math.sqrt(varianceUsd);
  const grossWinUsd = weekEntries.filter((row) => row.usd > 0).reduce((sum, row) => sum + row.usd, 0);
  const grossLossUsd = weekEntries.filter((row) => row.usd < 0).reduce((sum, row) => sum + Math.abs(row.usd), 0);
  const profitFactorUsd = grossLossUsd > 0 ? grossWinUsd / grossLossUsd : null;
  const bestWeek = weekEntries.length > 0 ? weekEntries.reduce((best, row) => (row.usd > best.usd ? row : best)) : null;
  const worstWeek = weekEntries.length > 0 ? weekEntries.reduce((worst, row) => (row.usd < worst.usd ? row : worst)) : null;

  let maxConsecutiveWins = 0;
  let maxConsecutiveLosses = 0;
  let currentWins = 0;
  let currentLosses = 0;
  for (const row of [...weekEntries].reverse()) {
    if (row.usd > 0) {
      currentWins += 1;
      currentLosses = 0;
    } else if (row.usd < 0) {
      currentLosses += 1;
      currentWins = 0;
    } else {
      currentWins = 0;
      currentLosses = 0;
    }
    if (currentWins > maxConsecutiveWins) {
      maxConsecutiveWins = currentWins;
    }
    if (currentLosses > maxConsecutiveLosses) {
      maxConsecutiveLosses = currentLosses;
    }
  }

  let peakUsd = 0;
  let cumulativeUsd = 0;
  let maxDdUsd = 0;
  let maxDdPercent = 0;
  for (const row of [...weekEntries].reverse()) {
    cumulativeUsd += row.usd;
    if (cumulativeUsd > peakUsd) {
      peakUsd = cumulativeUsd;
    }
    const dd = peakUsd - cumulativeUsd;
    if (dd > maxDdUsd) {
      maxDdUsd = dd;
      maxDdPercent = peakUsd > 0 ? (dd / peakUsd) * 100 : 0;
    }
  }

  return {
    generated_at: nowUtc.toISO() ?? new Date().toISOString(),
    overall: {
      weeks,
      total_percent: totalPercent,
      total_pips: totalPips,
      total_usd: totalUsd,
      avg_weekly_percent: avgPercent,
      avg_weekly_pips: weeks > 0 ? totalPips / weeks : 0,
      avg_weekly_usd: avgUsd,
      median_weekly_percent: medianPercent,
      median_weekly_usd: medianUsd,
      win_rate: weeks > 0 ? (wins / weeks) * 100 : 0,
      max_drawdown_usd: maxDdUsd,
      max_drawdown_percent: maxDdPercent,
      trades: totalTrades,
      profit_factor_usd: profitFactorUsd,
      volatility_percent: volatilityPercent,
      volatility_usd: volatilityUsd,
      best_week: bestWeek,
      worst_week: worstWeek,
      max_consecutive_wins: maxConsecutiveWins,
      max_consecutive_losses: maxConsecutiveLosses,
    },
    by_week: weekEntries,
    by_month,
  };
}
