// Set DATABASE_URL before any imports
process.env.DATABASE_URL =
  process.env.DATABASE_URL ||
  "postgresql://limni_db_user:K8zK9exIEbZ4YzyV4jxFYHpZO0Rq1X36@dpg-d5jucsmr433s73baeg1g-a.oregon-postgres.render.com/limni_db";

import fs from "node:fs";
import { DateTime } from "luxon";
import { listAssetClasses, type AssetClass } from "../src/lib/cotMarkets";
import { readSnapshotHistory } from "../src/lib/cotStore";
import {
  computeModelPerformance,
  type PerformanceModel,
} from "../src/lib/performanceLab";
import {
  PERFORMANCE_V1_MODELS,
  PERFORMANCE_V2_MODELS,
} from "../src/lib/performance/modelConfig";
import { getAggregatesForWeekStartWithBackfill } from "../src/lib/sentiment/store";
import { readMarketSnapshot } from "../src/lib/priceStore";
import { query, getPool } from "../src/lib/db";

const WEEKS = [
  "2026-01-19T00:00:00.000Z",
  "2026-01-26T00:00:00.000Z",
  "2026-02-02T00:00:00.000Z",
  "2026-02-09T00:00:00.000Z",
  "2026-02-16T00:00:00.000Z",
];

const TARGET_WEEK = "2026-02-16T00:00:00.000Z";

type Direction = "LONG" | "SHORT" | "NEUTRAL";
type Tier = 1 | 2 | 3;

type SystemWeekStats = {
  week_open_utc: string;
  return_percent: number;
  trades: number;
  wins: number;
  win_rate: number;
  avg_return_per_trade: number;
};

type V3TierStats = {
  return_percent: number;
  trades: number;
  wins: number;
  win_rate: number;
  avg_return_per_trade: number;
};

type V3Trade = {
  pair: string;
  pattern: string;
  tier: Tier;
  direction: "LONG" | "SHORT";
  return_percent: number;
};

type TierWeights = { tier1: number; tier2: number; tier3: number };

type SnapshotRow = {
  week_open_utc: Date;
  percent: string;
  priced: number;
  returns: Array<{ pair?: string; percent?: number }> | null;
};

type SnapshotSignalRow = {
  week_open_utc: Date;
  asset_class: string;
  model: string;
  pair_details: Array<{ pair: string; direction: "LONG" | "SHORT" | "NEUTRAL" | null }> | null;
};

type SystemAggregate = {
  weekly: SystemWeekStats[];
  total: SystemWeekStats;
};

type PairDetail = {
  pair: string;
  direction: "LONG" | "SHORT";
};

function toFixedNumber(value: number, digits = 4) {
  return Number(value.toFixed(digits));
}

function fmtPercent(value: number, digits = 2) {
  const rounded = toFixedNumber(value, digits);
  const sign = rounded > 0 ? "+" : "";
  return `${sign}${rounded.toFixed(digits)}%`;
}

function formatWeek(weekOpenUtc: string) {
  return DateTime.fromISO(weekOpenUtc, { zone: "utc" }).toFormat("yyyy-LL-dd");
}

function countWins(returns: SnapshotRow["returns"]): number {
  if (!Array.isArray(returns)) {
    return 0;
  }
  return returns.filter((item) => typeof item?.percent === "number" && item.percent > 0).length;
}

function buildSystemWeekStats(week_open_utc: string, return_percent: number, trades: number, wins: number): SystemWeekStats {
  return {
    week_open_utc,
    return_percent: toFixedNumber(return_percent),
    trades,
    wins,
    win_rate: trades > 0 ? toFixedNumber((wins / trades) * 100, 2) : 0,
    avg_return_per_trade: trades > 0 ? toFixedNumber(return_percent / trades, 4) : 0,
  };
}

async function loadSystemFromSnapshots(models: string[]): Promise<SystemAggregate> {
  const weekMap = new Map<string, { ret: number; trades: number; wins: number }>();
  for (const week of WEEKS) {
    weekMap.set(week, { ret: 0, trades: 0, wins: 0 });
  }

  const rows = await query<SnapshotRow>(
    `SELECT week_open_utc, percent, priced, returns
     FROM performance_snapshots
     WHERE week_open_utc = ANY($1::timestamptz[])
       AND model = ANY($2::text[])`,
    [WEEKS, models],
  );

  for (const row of rows) {
    const week = row.week_open_utc.toISOString();
    const bucket = weekMap.get(week);
    if (!bucket) {
      continue;
    }
    bucket.ret += Number(row.percent || 0);
    bucket.trades += Number(row.priced || 0);
    bucket.wins += countWins(row.returns);
  }

  const weekly = WEEKS.map((week) => {
    const entry = weekMap.get(week) ?? { ret: 0, trades: 0, wins: 0 };
    return buildSystemWeekStats(week, entry.ret, entry.trades, entry.wins);
  });

  const total = weekly.reduce(
    (acc, item) => {
      acc.ret += item.return_percent;
      acc.trades += item.trades;
      acc.wins += item.wins;
      return acc;
    },
    { ret: 0, trades: 0, wins: 0 },
  );

  return {
    weekly,
    total: buildSystemWeekStats("TOTAL", total.ret, total.trades, total.wins),
  };
}

async function computeSystemFromSnapshotSignals(models: PerformanceModel[]): Promise<SystemAggregate> {
  const assetClasses = listAssetClasses();
  const weekMap = new Map<string, { ret: number; trades: number; wins: number }>();
  for (const week of WEEKS) {
    weekMap.set(week, { ret: 0, trades: 0, wins: 0 });
  }

  const rows = await query<SnapshotSignalRow>(
    `SELECT week_open_utc, asset_class, model, pair_details
     FROM performance_snapshots
     WHERE week_open_utc = ANY($1::timestamptz[])
       AND model = ANY($2::text[])
     ORDER BY week_open_utc, asset_class, model`,
    [WEEKS, models],
  );

  const rowsByWeek = new Map<string, SnapshotSignalRow[]>();
  for (const row of rows) {
    const week = row.week_open_utc.toISOString();
    if (!rowsByWeek.has(week)) {
      rowsByWeek.set(week, []);
    }
    rowsByWeek.get(week)?.push(row);
  }

  for (const weekOpenUtc of WEEKS) {
    const bucket = weekMap.get(weekOpenUtc)!;
    const marketByAsset = new Map<string, Map<string, number>>();

    for (const asset of assetClasses) {
      try {
        const market = await readMarketSnapshot(weekOpenUtc, asset.id as AssetClass);
        if (!market) {
          continue;
        }
        const map = new Map<string, number>();
        Object.entries(market.pairs).forEach(([pair, data]) => {
          if (data && typeof data.percent === "number") {
            map.set(pair, data.percent);
          }
        });
        marketByAsset.set(asset.id, map);
      } catch {
        // no market snapshot for this asset/week
      }
    }

    const weekRows = rowsByWeek.get(weekOpenUtc) ?? [];
    for (const row of weekRows) {
      const marketMap = marketByAsset.get(row.asset_class);
      if (!marketMap || !Array.isArray(row.pair_details)) {
        continue;
      }

      for (const detail of row.pair_details) {
        if (detail.direction !== "LONG" && detail.direction !== "SHORT") {
          continue;
        }
        const rawReturn = marketMap.get(detail.pair);
        if (rawReturn === undefined) {
          continue;
        }
        const adjusted = detail.direction === "LONG" ? rawReturn : -rawReturn;
        bucket.ret += adjusted;
        bucket.trades += 1;
        if (adjusted > 0) {
          bucket.wins += 1;
        }
      }
    }
  }

  const weekly = WEEKS.map((week) => {
    const entry = weekMap.get(week) ?? { ret: 0, trades: 0, wins: 0 };
    return buildSystemWeekStats(week, entry.ret, entry.trades, entry.wins);
  });

  const total = weekly.reduce(
    (acc, item) => {
      acc.ret += item.return_percent;
      acc.trades += item.trades;
      acc.wins += item.wins;
      return acc;
    },
    { ret: 0, trades: 0, wins: 0 },
  );

  return {
    weekly,
    total: buildSystemWeekStats("TOTAL", total.ret, total.trades, total.wins),
  };
}

function getReportDateForWeek(weekOpenUtc: string): string {
  const weekOpen = DateTime.fromISO(weekOpenUtc, { zone: "utc" }).setZone("America/New_York");
  return weekOpen.minus({ days: 5 }).toISODate()!;
}

async function getSnapshotForWeek(assetClass: AssetClass, weekOpenUtc: string) {
  const targetReportDate = getReportDateForWeek(weekOpenUtc);
  const history = await readSnapshotHistory(assetClass, 260);
  const match = history.find((item) => item.report_date <= targetReportDate);
  return match ?? null;
}

function normalizeDirection(value: unknown): Direction {
  if (value === "LONG" || value === "SHORT") {
    return value;
  }
  return "NEUTRAL";
}

function votePattern(sentiment: Direction, dealer: Direction, commercial: Direction) {
  const shortCode = (dir: Direction) => (dir === "LONG" ? "L" : dir === "SHORT" ? "S" : "N");
  return `${shortCode(sentiment)}/${shortCode(dealer)}/${shortCode(commercial)}`;
}

function classifyTier(sentiment: Direction, dealer: Direction, commercial: Direction) {
  const votes = { LONG: 0, SHORT: 0, NEUTRAL: 0 };
  [sentiment, dealer, commercial].forEach((dir) => {
    votes[dir] += 1;
  });

  if (votes.LONG === 3) return { tier: 1 as Tier, direction: "LONG" as const };
  if (votes.SHORT === 3) return { tier: 1 as Tier, direction: "SHORT" as const };

  if (votes.LONG === 2) return { tier: 2 as Tier, direction: "LONG" as const };
  if (votes.SHORT === 2) return { tier: 2 as Tier, direction: "SHORT" as const };

  if (votes.LONG === 1 && votes.NEUTRAL === 2) return { tier: 3 as Tier, direction: "LONG" as const };
  if (votes.SHORT === 1 && votes.NEUTRAL === 2) return { tier: 3 as Tier, direction: "SHORT" as const };

  return null;
}

function toDirectionMap(pairDetails: PairDetail[]): Map<string, Direction> {
  const map = new Map<string, Direction>();
  for (const detail of pairDetails) {
    map.set(detail.pair, normalizeDirection(detail.direction));
  }
  return map;
}

function summarizeTier(returnPercent: number, trades: number, wins: number): V3TierStats {
  return {
    return_percent: toFixedNumber(returnPercent),
    trades,
    wins,
    win_rate: trades > 0 ? toFixedNumber((wins / trades) * 100, 2) : 0,
    avg_return_per_trade: trades > 0 ? toFixedNumber(returnPercent / trades, 4) : 0,
  };
}

function computeTierWeightedReturn(
  tier1: number,
  tier2: number,
  tier3: number,
  weights: TierWeights,
) {
  return toFixedNumber((tier1 * weights.tier1) + (tier2 * weights.tier2) + (tier3 * weights.tier3));
}

function getWeightForTier(tier: Tier, weights: TierWeights) {
  if (tier === 1) return weights.tier1;
  if (tier === 2) return weights.tier2;
  return weights.tier3;
}

function computeCapitalNormalizedReturnForTrades(trades: V3Trade[], weights: TierWeights) {
  if (!trades.length) {
    return 0;
  }
  const totalWeight = trades.reduce((sum, trade) => sum + getWeightForTier(trade.tier, weights), 0);
  if (totalWeight <= 0) {
    return 0;
  }
  const weightedReturn = trades.reduce((sum, trade) => {
    const positionSize = getWeightForTier(trade.tier, weights) / totalWeight;
    return sum + (trade.return_percent * positionSize);
  }, 0);
  return toFixedNumber(weightedReturn);
}

function computeCompoundedPercent(weeklyReturns: number[]) {
  const growth = weeklyReturns.reduce((acc, value) => acc * (1 + (value / 100)), 1);
  return toFixedNumber((growth - 1) * 100);
}

async function computeV3FromRawSignals() {
  const assetClasses = listAssetClasses();
  const weekly = new Map<string, {
    ret: number;
    trades: number;
    wins: number;
    tier1: { ret: number; trades: number; wins: number };
    tier2: { ret: number; trades: number; wins: number };
    tier3: { ret: number; trades: number; wins: number };
    trades_list: V3Trade[];
  }>();

  for (const week of WEEKS) {
    weekly.set(week, {
      ret: 0,
      trades: 0,
      wins: 0,
      tier1: { ret: 0, trades: 0, wins: 0 },
      tier2: { ret: 0, trades: 0, wins: 0 },
      tier3: { ret: 0, trades: 0, wins: 0 },
      trades_list: [],
    });
  }

  for (const weekOpenUtc of WEEKS) {
    const weekOpen = DateTime.fromISO(weekOpenUtc, { zone: "utc" });
    const weekCloseUtc = weekOpen.plus({ days: 7 }).toUTC().toISO()!;
    const sentiment = await getAggregatesForWeekStartWithBackfill(weekOpenUtc, weekCloseUtc);
    const marketReturns = new Map<string, number>();

    for (const asset of assetClasses) {
      try {
        const market = await readMarketSnapshot(weekOpenUtc, asset.id as AssetClass);
        if (!market) {
          continue;
        }
        Object.entries(market.pairs).forEach(([pair, data]) => {
          if (data && typeof data.percent === "number") {
            marketReturns.set(pair, data.percent);
          }
        });
      } catch {
        // ignore missing market snapshots for an asset class
      }
    }

    for (const asset of assetClasses) {
      const snapshot = await getSnapshotForWeek(asset.id as AssetClass, weekOpenUtc);
      if (!snapshot) {
        continue;
      }

      const sentimentResult = await computeModelPerformance({
        model: "sentiment",
        assetClass: asset.id,
        snapshot,
        sentiment,
        system: "v1",
      });
      const dealerResult = await computeModelPerformance({
        model: "dealer",
        assetClass: asset.id,
        snapshot,
        sentiment,
        system: "v1",
      });
      const commercialResult = await computeModelPerformance({
        model: "commercial",
        assetClass: asset.id,
        snapshot,
        sentiment,
        system: "v1",
      });

      const sentimentMap = toDirectionMap(sentimentResult.pair_details as PairDetail[]);
      const dealerMap = toDirectionMap(dealerResult.pair_details as PairDetail[]);
      const commercialMap = toDirectionMap(commercialResult.pair_details as PairDetail[]);
      const allPairs = new Set<string>([
        ...sentimentMap.keys(),
        ...dealerMap.keys(),
        ...commercialMap.keys(),
      ]);

      for (const pair of allPairs) {
        const sentimentDir = sentimentMap.get(pair) ?? "NEUTRAL";
        const dealerDir = dealerMap.get(pair) ?? "NEUTRAL";
        const commercialDir = commercialMap.get(pair) ?? "NEUTRAL";
        const classified = classifyTier(sentimentDir, dealerDir, commercialDir);
        if (!classified) {
          continue;
        }

        const rawReturn = marketReturns.get(pair);
        if (rawReturn === undefined) {
          continue;
        }

        const adjustedReturn = classified.direction === "LONG" ? rawReturn : -rawReturn;
        const weekBucket = weekly.get(weekOpenUtc)!;
        weekBucket.ret += adjustedReturn;
        weekBucket.trades += 1;
        if (adjustedReturn > 0) {
          weekBucket.wins += 1;
        }

        const tierKey = `tier${classified.tier}` as "tier1" | "tier2" | "tier3";
        weekBucket[tierKey].ret += adjustedReturn;
        weekBucket[tierKey].trades += 1;
        if (adjustedReturn > 0) {
          weekBucket[tierKey].wins += 1;
        }

        weekBucket.trades_list.push({
          pair,
          pattern: votePattern(sentimentDir, dealerDir, commercialDir),
          tier: classified.tier,
          direction: classified.direction,
          return_percent: toFixedNumber(adjustedReturn),
        });
      }
    }
  }

  const weeklyArray = WEEKS.map((week) => {
    const bucket = weekly.get(week)!;
    return {
      week_open_utc: week,
      summary: buildSystemWeekStats(week, bucket.ret, bucket.trades, bucket.wins),
      tiers: {
        tier1: summarizeTier(bucket.tier1.ret, bucket.tier1.trades, bucket.tier1.wins),
        tier2: summarizeTier(bucket.tier2.ret, bucket.tier2.trades, bucket.tier2.wins),
        tier3: summarizeTier(bucket.tier3.ret, bucket.tier3.trades, bucket.tier3.wins),
      },
      trades: bucket.trades_list,
    };
  });

  const totals = weeklyArray.reduce(
    (acc, week) => {
      acc.ret += week.summary.return_percent;
      acc.trades += week.summary.trades;
      acc.wins += week.summary.wins;
      acc.t1.ret += week.tiers.tier1.return_percent;
      acc.t1.trades += week.tiers.tier1.trades;
      acc.t1.wins += week.tiers.tier1.wins;
      acc.t2.ret += week.tiers.tier2.return_percent;
      acc.t2.trades += week.tiers.tier2.trades;
      acc.t2.wins += week.tiers.tier2.wins;
      acc.t3.ret += week.tiers.tier3.return_percent;
      acc.t3.trades += week.tiers.tier3.trades;
      acc.t3.wins += week.tiers.tier3.wins;
      return acc;
    },
    {
      ret: 0,
      trades: 0,
      wins: 0,
      t1: { ret: 0, trades: 0, wins: 0 },
      t2: { ret: 0, trades: 0, wins: 0 },
      t3: { ret: 0, trades: 0, wins: 0 },
    },
  );

  return {
    weekly: weeklyArray,
    total: buildSystemWeekStats("TOTAL", totals.ret, totals.trades, totals.wins),
    tier_totals: {
      tier1: summarizeTier(totals.t1.ret, totals.t1.trades, totals.t1.wins),
      tier2: summarizeTier(totals.t2.ret, totals.t2.trades, totals.t2.wins),
      tier3: summarizeTier(totals.t3.ret, totals.t3.trades, totals.t3.wins),
    },
  };
}

async function main() {
  const [v1, v2, v3, v1SnapshotStoredPercent, v2SnapshotStoredPercent] = await Promise.all([
    computeSystemFromSnapshotSignals(PERFORMANCE_V1_MODELS),
    computeSystemFromSnapshotSignals(PERFORMANCE_V2_MODELS),
    computeV3FromRawSignals(),
    loadSystemFromSnapshots(PERFORMANCE_V1_MODELS),
    loadSystemFromSnapshots(PERFORMANCE_V2_MODELS),
  ]);

  const targetWeekV3 = v3.weekly.find((week) => week.week_open_utc === TARGET_WEEK);
  if (!targetWeekV3) {
    throw new Error(`Target week not found for V3: ${TARGET_WEEK}`);
  }

  const conservativeWeights = { tier1: 3, tier2: 1, tier3: 0.5 };
  const fiveWeekBalancedWeights = {
    tier1: v3.tier_totals.tier1.trades > 0 ? v3.tier_totals.tier2.trades / v3.tier_totals.tier1.trades : 0,
    tier2: 1,
    tier3: v3.tier_totals.tier3.trades > 0 ? v3.tier_totals.tier2.trades / v3.tier_totals.tier3.trades : 0,
  };
  const weekBalancedWeights = {
    tier1: targetWeekV3.tiers.tier1.trades > 0 ? targetWeekV3.tiers.tier2.trades / targetWeekV3.tiers.tier1.trades : 0,
    tier2: 1,
    tier3: targetWeekV3.tiers.tier3.trades > 0 ? targetWeekV3.tiers.tier2.trades / targetWeekV3.tiers.tier3.trades : 0,
  };

  const scenario = {
    five_week: {
      equal_weight_all_tiers: toFixedNumber(v3.total.return_percent),
      conservative_tier_weighting: {
        weights: conservativeWeights,
        return_percent: computeTierWeightedReturn(
          v3.tier_totals.tier1.return_percent,
          v3.tier_totals.tier2.return_percent,
          v3.tier_totals.tier3.return_percent,
          conservativeWeights,
        ),
      },
      balanced_by_trade_count: {
        weights: {
          tier1: toFixedNumber(fiveWeekBalancedWeights.tier1, 4),
          tier2: 1,
          tier3: toFixedNumber(fiveWeekBalancedWeights.tier3, 4),
        },
        return_percent: computeTierWeightedReturn(
          v3.tier_totals.tier1.return_percent,
          v3.tier_totals.tier2.return_percent,
          v3.tier_totals.tier3.return_percent,
          fiveWeekBalancedWeights,
        ),
      },
    },
    target_week: {
      week_open_utc: TARGET_WEEK,
      equal_weight_all_tiers: toFixedNumber(targetWeekV3.summary.return_percent),
      conservative_tier_weighting: {
        weights: conservativeWeights,
        return_percent: computeTierWeightedReturn(
          targetWeekV3.tiers.tier1.return_percent,
          targetWeekV3.tiers.tier2.return_percent,
          targetWeekV3.tiers.tier3.return_percent,
          conservativeWeights,
        ),
      },
      balanced_by_trade_count: {
        weights: {
          tier1: toFixedNumber(weekBalancedWeights.tier1, 4),
          tier2: 1,
          tier3: toFixedNumber(weekBalancedWeights.tier3, 4),
        },
        return_percent: computeTierWeightedReturn(
          targetWeekV3.tiers.tier1.return_percent,
          targetWeekV3.tiers.tier2.return_percent,
          targetWeekV3.tiers.tier3.return_percent,
          weekBalancedWeights,
        ),
      },
    },
  };

  const normalizedScenarioDefs: Array<{
    key: "equal_weight" | "conservative_tiered" | "balanced_trade_count";
    weights: TierWeights;
  }> = [
    { key: "equal_weight", weights: { tier1: 1, tier2: 1, tier3: 1 } },
    { key: "conservative_tiered", weights: conservativeWeights },
    { key: "balanced_trade_count", weights: fiveWeekBalancedWeights },
  ];

  const normalizedByWeek = WEEKS.map((weekOpenUtc) => {
    const weekEntry = v3.weekly.find((item) => item.week_open_utc === weekOpenUtc);
    const trades = weekEntry?.trades ?? [];
    const row: Record<string, number | string> = {
      week_open_utc: weekOpenUtc,
      trades: trades.length,
    };
    for (const def of normalizedScenarioDefs) {
      row[def.key] = computeCapitalNormalizedReturnForTrades(trades, def.weights);
    }
    return row;
  });

  const normalizedTotals = normalizedScenarioDefs.reduce((acc, def) => {
    const weeklyReturns = normalizedByWeek.map((row) => Number(row[def.key] ?? 0));
    acc[def.key] = {
      weights: {
        tier1: toFixedNumber(def.weights.tier1, 4),
        tier2: toFixedNumber(def.weights.tier2, 4),
        tier3: toFixedNumber(def.weights.tier3, 4),
      },
      weekly_returns: weeklyReturns.map((value) => toFixedNumber(value)),
      arithmetic_total_percent: toFixedNumber(weeklyReturns.reduce((sum, value) => sum + value, 0)),
      compounded_total_percent: computeCompoundedPercent(weeklyReturns),
      average_weekly_percent: toFixedNumber(
        weeklyReturns.length > 0
          ? weeklyReturns.reduce((sum, value) => sum + value, 0) / weeklyReturns.length
          : 0,
      ),
    };
    return acc;
  }, {} as Record<string, {
    weights: { tier1: number; tier2: number; tier3: number };
    weekly_returns: number[];
    arithmetic_total_percent: number;
    compounded_total_percent: number;
    average_weekly_percent: number;
  }>);

  const targetWeekTrades = targetWeekV3.trades;
  const normalizedTargetWeek = normalizedScenarioDefs.reduce((acc, def) => {
    acc[def.key] = {
      weights: {
        tier1: toFixedNumber(def.weights.tier1, 4),
        tier2: toFixedNumber(def.weights.tier2, 4),
        tier3: toFixedNumber(def.weights.tier3, 4),
      },
      return_percent: computeCapitalNormalizedReturnForTrades(targetWeekTrades, def.weights),
    };
    return acc;
  }, {} as Record<string, { weights: { tier1: number; tier2: number; tier3: number }; return_percent: number }>);

  const systemsByWeek = WEEKS.map((week) => ({
    week_open_utc: week,
    week_label: formatWeek(week),
    v1: v1.weekly.find((item) => item.week_open_utc === week),
    v2: v2.weekly.find((item) => item.week_open_utc === week),
    v3: v3.weekly.find((item) => item.week_open_utc === week)?.summary,
  }));

  const output = {
    weeks: WEEKS,
    systems: {
      v1,
      v2,
      v3: {
        total: v3.total,
        tier_totals: v3.tier_totals,
      },
    },
    snapshot_stored_percent_audit: {
      v1: v1SnapshotStoredPercent,
      v2: v2SnapshotStoredPercent,
    },
    week_by_week: systemsByWeek,
    v3_target_week: targetWeekV3,
    scenarios: scenario,
    capital_normalized: {
      definition: "Fixed 100% weekly capital budget. Position size per trade = tier_weight / sum(weights of all trades that week). Weekly return is weighted average of trade returns.",
      week_by_week: normalizedByWeek,
      five_week_totals: normalizedTotals,
      target_week: {
        week_open_utc: TARGET_WEEK,
        trades: targetWeekTrades.length,
        scenarios: normalizedTargetWeek,
      },
    },
  };

  const stamp = DateTime.utc().toFormat("yyyy-LL-dd");
  const jsonPath = `reports/universal-v3-agreement-backtest-${stamp}.json`;
  const mdPath = `reports/universal-v3-agreement-backtest-${stamp}.md`;
  const latestJsonPath = "reports/universal-v3-agreement-backtest-latest.json";
  const latestMdPath = "reports/universal-v3-agreement-backtest-latest.md";
  fs.writeFileSync(jsonPath, JSON.stringify(output, null, 2), "utf8");
  fs.writeFileSync(latestJsonPath, JSON.stringify(output, null, 2), "utf8");

  const md: string[] = [];
  md.push("# Universal V3 Agreement Backtest");
  md.push("");
  md.push(`Generated: ${DateTime.utc().toISO()}`);
  md.push(`Weeks: ${WEEKS.join(", ")}`);
  md.push("");
  md.push("## System Totals");
  md.push("");
  md.push("| System | Return | Trades | Win Rate | Avg/Trade |");
  md.push("| --- | ---: | ---: | ---: | ---: |");
  md.push(`| V1 | ${fmtPercent(output.systems.v1.total.return_percent)} | ${output.systems.v1.total.trades} | ${output.systems.v1.total.win_rate.toFixed(2)}% | ${fmtPercent(output.systems.v1.total.avg_return_per_trade)} |`);
  md.push(`| V2 | ${fmtPercent(output.systems.v2.total.return_percent)} | ${output.systems.v2.total.trades} | ${output.systems.v2.total.win_rate.toFixed(2)}% | ${fmtPercent(output.systems.v2.total.avg_return_per_trade)} |`);
  md.push(`| V3 | ${fmtPercent(output.systems.v3.total.return_percent)} | ${output.systems.v3.total.trades} | ${output.systems.v3.total.win_rate.toFixed(2)}% | ${fmtPercent(output.systems.v3.total.avg_return_per_trade)} |`);
  md.push("");
  md.push("## V3 Tiers (5 Weeks)");
  md.push("");
  md.push("| Tier | Return | Trades | Win Rate | Avg/Trade |");
  md.push("| --- | ---: | ---: | ---: | ---: |");
  md.push(`| Tier 1 | ${fmtPercent(output.systems.v3.tier_totals.tier1.return_percent)} | ${output.systems.v3.tier_totals.tier1.trades} | ${output.systems.v3.tier_totals.tier1.win_rate.toFixed(2)}% | ${fmtPercent(output.systems.v3.tier_totals.tier1.avg_return_per_trade)} |`);
  md.push(`| Tier 2 | ${fmtPercent(output.systems.v3.tier_totals.tier2.return_percent)} | ${output.systems.v3.tier_totals.tier2.trades} | ${output.systems.v3.tier_totals.tier2.win_rate.toFixed(2)}% | ${fmtPercent(output.systems.v3.tier_totals.tier2.avg_return_per_trade)} |`);
  md.push(`| Tier 3 | ${fmtPercent(output.systems.v3.tier_totals.tier3.return_percent)} | ${output.systems.v3.tier_totals.tier3.trades} | ${output.systems.v3.tier_totals.tier3.win_rate.toFixed(2)}% | ${fmtPercent(output.systems.v3.tier_totals.tier3.avg_return_per_trade)} |`);
  md.push("");
  md.push("## Week-by-Week");
  md.push("");
  md.push("| Week | V1 Return | V2 Return | V3 Return |");
  md.push("| --- | ---: | ---: | ---: |");
  for (const row of output.week_by_week) {
    md.push(`| ${row.week_label} | ${fmtPercent(row.v1?.return_percent ?? 0)} | ${fmtPercent(row.v2?.return_percent ?? 0)} | ${fmtPercent(row.v3?.return_percent ?? 0)} |`);
  }
  md.push("");
  md.push("## Equal vs Tiered (Raw Return Sum)");
  md.push("");
  md.push(`- 5-week equal-weight: ${fmtPercent(output.scenarios.five_week.equal_weight_all_tiers)}`);
  md.push(`- 5-week conservative tiered (3/1/0.5): ${fmtPercent(output.scenarios.five_week.conservative_tier_weighting.return_percent)}`);
  md.push(`- 5-week balanced trade-count tiered: ${fmtPercent(output.scenarios.five_week.balanced_by_trade_count.return_percent)}`);
  md.push(`- Target week (${TARGET_WEEK}) equal-weight: ${fmtPercent(output.scenarios.target_week.equal_weight_all_tiers)}`);
  md.push(`- Target week conservative tiered: ${fmtPercent(output.scenarios.target_week.conservative_tier_weighting.return_percent)}`);
  md.push(`- Target week balanced trade-count tiered: ${fmtPercent(output.scenarios.target_week.balanced_by_trade_count.return_percent)}`);
  md.push("");
  md.push("## Capital-Normalized (Fixed Weekly Risk)");
  md.push("");
  md.push(`- Equal-weight compounded: ${fmtPercent(output.capital_normalized.five_week_totals.equal_weight.compounded_total_percent)}`);
  md.push(`- Conservative tiered compounded: ${fmtPercent(output.capital_normalized.five_week_totals.conservative_tiered.compounded_total_percent)}`);
  md.push(`- Balanced trade-count compounded: ${fmtPercent(output.capital_normalized.five_week_totals.balanced_trade_count.compounded_total_percent)}`);
  md.push("");
  md.push(`JSON: \`${jsonPath}\``);
  fs.writeFileSync(mdPath, md.join("\n"), "utf8");
  fs.writeFileSync(latestMdPath, md.join("\n"), "utf8");

  console.log(JSON.stringify(output, null, 2));
  console.log(`Wrote ${jsonPath}`);
  console.log(`Wrote ${mdPath}`);
  console.log(`Wrote ${latestJsonPath}`);
  console.log(`Wrote ${latestMdPath}`);
  await getPool().end();
}

main().catch(async (error) => {
  console.error(error);
  try {
    await getPool().end();
  } catch {
    // ignore
  }
  process.exitCode = 1;
});
