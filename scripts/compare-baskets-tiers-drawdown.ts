// Comprehensive basket and tier comparison with drawdown analysis
process.env.DATABASE_URL = process.env.DATABASE_URL ||
  "postgresql://limni_db_user:K8zK9exIEbZ4YzyV4jxFYHpZO0Rq1X36@dpg-d5jucsmr433s73baeg1g-a.oregon-postgres.render.com/limni_db";

import { Pool } from "pg";
import { DateTime } from "luxon";
import { listAssetClasses, type AssetClass } from "../src/lib/cotMarkets";
import { readSnapshotHistory } from "../src/lib/cotStore";
import { computeModelPerformance } from "../src/lib/performanceLab";
import { getAggregatesForWeekStartWithBackfill } from "../src/lib/sentiment/store";
import { readMarketSnapshot } from "../src/lib/priceStore";

const DATABASE_URL = process.env.DATABASE_URL;

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: DATABASE_URL.includes("render.com") ? { rejectUnauthorized: false } : false,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

// Analyze more weeks for better drawdown measurement
const WEEKS = [
  "2026-01-05T00:00:00.000Z",
  "2026-01-12T00:00:00.000Z",
  "2026-01-19T00:00:00.000Z",
  "2026-01-26T00:00:00.000Z",
  "2026-02-02T00:00:00.000Z",
  "2026-02-09T00:00:00.000Z",
  "2026-02-16T00:00:00.000Z",
];

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

type BasketStats = {
  weeklyReturns: number[];
  totalReturn: number;
  avgReturn: number;
  trades: number;
  wins: number;
  winRate: number;
  maxDrawdown: number;
  sharpeRatio: number;
  calmarRatio: number;
  stdDev: number;
};

function calculateDrawdown(weeklyReturns: number[]): number {
  let peak = 0;
  let maxDrawdown = 0;

  for (const ret of weeklyReturns) {
    peak += ret;
    const currentDrawdown = peak - Math.max(...weeklyReturns.slice(0, weeklyReturns.indexOf(ret) + 1).reduce((acc, r, i) => {
      acc[i] = (acc[i - 1] || 0) + r;
      return acc;
    }, [] as number[]));

    if (currentDrawdown > maxDrawdown) {
      maxDrawdown = currentDrawdown;
    }
  }

  return maxDrawdown;
}

function calculateStats(weeklyReturns: number[], trades: number, wins: number): BasketStats {
  const totalReturn = weeklyReturns.reduce((sum, r) => sum + r, 0);
  const avgReturn = totalReturn / weeklyReturns.length;
  const winRate = trades > 0 ? (wins / trades) * 100 : 0;

  // Calculate standard deviation
  const variance = weeklyReturns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / weeklyReturns.length;
  const stdDev = Math.sqrt(variance);

  // Calculate max drawdown
  let cumulative = 0;
  let peak = 0;
  let maxDrawdown = 0;

  for (const ret of weeklyReturns) {
    cumulative += ret;
    if (cumulative > peak) {
      peak = cumulative;
    }
    const drawdown = peak - cumulative;
    if (drawdown > maxDrawdown) {
      maxDrawdown = drawdown;
    }
  }

  // Sharpe ratio (assuming risk-free rate = 0 for simplicity)
  const sharpeRatio = stdDev > 0 ? avgReturn / stdDev : 0;

  // Calmar ratio (return / max drawdown)
  const calmarRatio = maxDrawdown > 0 ? totalReturn / maxDrawdown : 0;

  return {
    weeklyReturns,
    totalReturn,
    avgReturn,
    trades,
    wins,
    winRate,
    maxDrawdown,
    sharpeRatio,
    calmarRatio,
    stdDev,
  };
}

type V3Signal = {
  pair: string;
  sentiment: "LONG" | "SHORT" | "NEUTRAL";
  dealer: "LONG" | "SHORT" | "NEUTRAL";
  commercial: "LONG" | "SHORT" | "NEUTRAL";
  tier: 1 | 2 | 3 | null;
  direction: "LONG" | "SHORT" | null;
};

function computeV3Signals(
  sentimentResults: any,
  dealerResults: any,
  commercialResults: any,
): V3Signal[] {
  const allPairs = new Set<string>();

  sentimentResults.pair_details.forEach((p: any) => allPairs.add(p.pair));
  dealerResults.pair_details.forEach((p: any) => allPairs.add(p.pair));
  commercialResults.pair_details.forEach((p: any) => allPairs.add(p.pair));

  const signals: V3Signal[] = [];

  for (const pair of allPairs) {
    const sentimentPair = sentimentResults.pair_details.find((p: any) => p.pair === pair);
    const dealerPair = dealerResults.pair_details.find((p: any) => p.pair === pair);
    const commercialPair = commercialResults.pair_details.find((p: any) => p.pair === pair);

    const sentiment = sentimentPair?.direction ?? "NEUTRAL";
    const dealer = dealerPair?.direction ?? "NEUTRAL";
    const commercial = commercialPair?.direction ?? "NEUTRAL";

    const votes = { LONG: 0, SHORT: 0, NEUTRAL: 0 };
    [sentiment, dealer, commercial].forEach((dir) => votes[dir as keyof typeof votes]++);

    let tier: 1 | 2 | 3 | null = null;
    let direction: "LONG" | "SHORT" | null = null;

    if (votes.LONG === 3) {
      tier = 1;
      direction = "LONG";
    } else if (votes.SHORT === 3) {
      tier = 1;
      direction = "SHORT";
    } else if (votes.LONG === 2) {
      tier = 2;
      direction = "LONG";
    } else if (votes.SHORT === 2) {
      tier = 2;
      direction = "SHORT";
    } else if (votes.LONG === 1 && votes.NEUTRAL === 2) {
      tier = 3;
      direction = "LONG";
    } else if (votes.SHORT === 1 && votes.NEUTRAL === 2) {
      tier = 3;
      direction = "SHORT";
    }

    signals.push({ pair, sentiment, dealer, commercial, tier, direction });
  }

  return signals.filter((s) => s.tier !== null);
}

async function main() {
  const assetClasses = listAssetClasses();

  console.log("\n╔══════════════════════════════════════════════════════════════════╗");
  console.log("║          BASKET & TIER COMPARISON - DRAWDOWN ANALYSIS           ║");
  console.log("╚══════════════════════════════════════════════════════════════════╝\n");

  console.log(`Analyzing ${WEEKS.length} weeks:`);
  WEEKS.forEach((week, i) => {
    const dt = DateTime.fromISO(week, { zone: "utc" });
    console.log(`  ${i + 1}. ${dt.toFormat("MMM dd, yyyy")}`);
  });
  console.log();

  // Track individual baskets
  const baskets = {
    antikythera: { weeklyReturns: [] as number[], trades: 0, wins: 0 },
    blended: { weeklyReturns: [] as number[], trades: 0, wins: 0 },
    dealer: { weeklyReturns: [] as number[], trades: 0, wins: 0 },
    commercial: { weeklyReturns: [] as number[], trades: 0, wins: 0 },
    sentiment: { weeklyReturns: [] as number[], trades: 0, wins: 0 },
  };

  // Track tiers
  const tiers = {
    tier1: { weeklyReturns: [] as number[], trades: 0, wins: 0 },
    tier2: { weeklyReturns: [] as number[], trades: 0, wins: 0 },
    tier3: { weeklyReturns: [] as number[], trades: 0, wins: 0 },
  };

  for (const weekOpenUtc of WEEKS) {
    const weekOpen = DateTime.fromISO(weekOpenUtc, { zone: "utc" });
    const weekClose = weekOpen.plus({ days: 7 }).toUTC().toISO()!;
    const sentiment = await getAggregatesForWeekStartWithBackfill(weekOpenUtc, weekClose);

    // Weekly returns for each basket
    let weekAntikythera = 0;
    let weekBlended = 0;
    let weekDealer = 0;
    let weekCommercial = 0;
    let weekSentiment = 0;

    // Weekly returns for each tier
    let weekTier1 = 0;
    let weekTier2 = 0;
    let weekTier3 = 0;

    // Get market returns
    const marketReturns = new Map<string, number>();
    for (const asset of assetClasses) {
      try {
        const marketSnapshot = await readMarketSnapshot(weekOpenUtc, asset.id);
        if (!marketSnapshot) continue;
        Object.entries(marketSnapshot.pairs).forEach(([pair, data]) => {
          if (data && typeof data.percent === "number") {
            marketReturns.set(pair, data.percent);
          }
        });
      } catch (err) {
        // Skip
      }
    }

    for (const asset of assetClasses) {
      const snapshot = await getSnapshotForWeek(asset.id, weekOpenUtc);
      if (!snapshot) continue;

      // Compute each basket
      const antikytheraResult = await computeModelPerformance({
        model: "antikythera",
        assetClass: asset.id,
        snapshot,
        sentiment,
        system: "v1",
      });

      const blendedResult = await computeModelPerformance({
        model: "blended",
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

      const sentimentResult = await computeModelPerformance({
        model: "sentiment",
        assetClass: asset.id,
        snapshot,
        sentiment,
        system: "v1",
      });

      // Accumulate weekly returns
      weekAntikythera += antikytheraResult.percent;
      weekBlended += blendedResult.percent;
      weekDealer += dealerResult.percent;
      weekCommercial += commercialResult.percent;
      weekSentiment += sentimentResult.percent;

      // Track trades and wins
      baskets.antikythera.trades += antikytheraResult.priced;
      baskets.antikythera.wins += antikytheraResult.returns.filter(r => r.percent > 0).length;

      baskets.blended.trades += blendedResult.priced;
      baskets.blended.wins += blendedResult.returns.filter(r => r.percent > 0).length;

      baskets.dealer.trades += dealerResult.priced;
      baskets.dealer.wins += dealerResult.returns.filter(r => r.percent > 0).length;

      baskets.commercial.trades += commercialResult.priced;
      baskets.commercial.wins += commercialResult.returns.filter(r => r.percent > 0).length;

      baskets.sentiment.trades += sentimentResult.priced;
      baskets.sentiment.wins += sentimentResult.returns.filter(r => r.percent > 0).length;

      // Compute V3 signals for tiers
      const v3Signals = computeV3Signals(sentimentResult, dealerResult, commercialResult);

      for (const signal of v3Signals) {
        if (!signal.direction || !signal.tier) continue;

        const marketReturn = marketReturns.get(signal.pair);
        if (marketReturn === undefined) continue;

        const adjustedReturn = marketReturn * (signal.direction === "LONG" ? 1 : -1);

        if (signal.tier === 1) {
          weekTier1 += adjustedReturn;
          tiers.tier1.trades += 1;
          if (adjustedReturn > 0) tiers.tier1.wins += 1;
        } else if (signal.tier === 2) {
          weekTier2 += adjustedReturn;
          tiers.tier2.trades += 1;
          if (adjustedReturn > 0) tiers.tier2.wins += 1;
        } else if (signal.tier === 3) {
          weekTier3 += adjustedReturn;
          tiers.tier3.trades += 1;
          if (adjustedReturn > 0) tiers.tier3.wins += 1;
        }
      }
    }

    // Store weekly returns
    baskets.antikythera.weeklyReturns.push(weekAntikythera);
    baskets.blended.weeklyReturns.push(weekBlended);
    baskets.dealer.weeklyReturns.push(weekDealer);
    baskets.commercial.weeklyReturns.push(weekCommercial);
    baskets.sentiment.weeklyReturns.push(weekSentiment);

    tiers.tier1.weeklyReturns.push(weekTier1);
    tiers.tier2.weeklyReturns.push(weekTier2);
    tiers.tier3.weeklyReturns.push(weekTier3);
  }

  // Calculate stats for each basket
  const basketStats = {
    antikythera: calculateStats(baskets.antikythera.weeklyReturns, baskets.antikythera.trades, baskets.antikythera.wins),
    blended: calculateStats(baskets.blended.weeklyReturns, baskets.blended.trades, baskets.blended.wins),
    dealer: calculateStats(baskets.dealer.weeklyReturns, baskets.dealer.trades, baskets.dealer.wins),
    commercial: calculateStats(baskets.commercial.weeklyReturns, baskets.commercial.trades, baskets.commercial.wins),
    sentiment: calculateStats(baskets.sentiment.weeklyReturns, baskets.sentiment.trades, baskets.sentiment.wins),
  };

  const tierStats = {
    tier1: calculateStats(tiers.tier1.weeklyReturns, tiers.tier1.trades, tiers.tier1.wins),
    tier2: calculateStats(tiers.tier2.weeklyReturns, tiers.tier2.trades, tiers.tier2.wins),
    tier3: calculateStats(tiers.tier3.weeklyReturns, tiers.tier3.trades, tiers.tier3.wins),
  };

  // Display results
  console.log("\n╔══════════════════════════════════════════════════════════════════╗");
  console.log("║                    BASKET COMPARISON (V1)                        ║");
  console.log("╚══════════════════════════════════════════════════════════════════╝\n");

  const basketNames = Object.keys(basketStats) as Array<keyof typeof basketStats>;

  for (const name of basketNames) {
    const stats = basketStats[name];
    console.log(`┌─ ${name.toUpperCase().padEnd(60, "─")}┐`);
    console.log(`│ Total Return:       ${stats.totalReturn.toFixed(2).padStart(8)}%                            │`);
    console.log(`│ Avg Weekly:         ${stats.avgReturn.toFixed(2).padStart(8)}%                            │`);
    console.log(`│ Max Drawdown:       ${stats.maxDrawdown.toFixed(2).padStart(8)}%  ⬅️  RISK                 │`);
    console.log(`│ Std Dev:            ${stats.stdDev.toFixed(2).padStart(8)}%                            │`);
    console.log(`│ Sharpe Ratio:       ${stats.sharpeRatio.toFixed(3).padStart(8)}                               │`);
    console.log(`│ Calmar Ratio:       ${stats.calmarRatio.toFixed(3).padStart(8)}   (Return/Drawdown)       │`);
    console.log(`│ Trades:             ${stats.trades.toString().padStart(8)}                               │`);
    console.log(`│ Win Rate:           ${stats.winRate.toFixed(1).padStart(7)}%                            │`);
    console.log(`└${"─".repeat(64)}┘\n`);
  }

  console.log("\n╔══════════════════════════════════════════════════════════════════╗");
  console.log("║                      TIER COMPARISON (V3)                        ║");
  console.log("╚══════════════════════════════════════════════════════════════════╝\n");

  const tierNames = Object.keys(tierStats) as Array<keyof typeof tierStats>;

  for (const name of tierNames) {
    const stats = tierStats[name];
    const tierNum = name.replace("tier", "");
    const agreement = tierNum === "1" ? "3/3 Agreement" : tierNum === "2" ? "2/3 Agreement" : "1/3 Agreement";

    console.log(`┌─ TIER ${tierNum} (${agreement})${" ".repeat(43 - agreement.length)}┐`);
    console.log(`│ Total Return:       ${stats.totalReturn.toFixed(2).padStart(8)}%                            │`);
    console.log(`│ Avg Weekly:         ${stats.avgReturn.toFixed(2).padStart(8)}%                            │`);
    console.log(`│ Max Drawdown:       ${stats.maxDrawdown.toFixed(2).padStart(8)}%  ⬅️  RISK                 │`);
    console.log(`│ Std Dev:            ${stats.stdDev.toFixed(2).padStart(8)}%                            │`);
    console.log(`│ Sharpe Ratio:       ${stats.sharpeRatio.toFixed(3).padStart(8)}                               │`);
    console.log(`│ Calmar Ratio:       ${stats.calmarRatio.toFixed(3).padStart(8)}   (Return/Drawdown)       │`);
    console.log(`│ Trades:             ${stats.trades.toString().padStart(8)}                               │`);
    console.log(`│ Win Rate:           ${stats.winRate.toFixed(1).padStart(7)}%                            │`);
    console.log(`└${"─".repeat(64)}┘\n`);
  }

  // Rankings
  console.log("\n╔══════════════════════════════════════════════════════════════════╗");
  console.log("║                       🏆 RANKINGS 🏆                             ║");
  console.log("╚══════════════════════════════════════════════════════════════════╝\n");

  // Combine all for ranking
  const allSystems = [
    ...basketNames.map(name => ({ name: name.toUpperCase(), stats: basketStats[name], type: "BASKET" })),
    ...tierNames.map(name => ({ name: name.toUpperCase(), stats: tierStats[name], type: "TIER" })),
  ];

  // Rank by lowest drawdown (best for "go big")
  console.log("🛡️  LOWEST DRAWDOWN (Safest to Go Big):");
  const byDrawdown = [...allSystems].sort((a, b) => a.stats.maxDrawdown - b.stats.maxDrawdown);
  byDrawdown.forEach((s, i) => {
    console.log(`  ${i + 1}. ${s.name.padEnd(15)} ${s.stats.maxDrawdown.toFixed(2).padStart(7)}% drawdown   (${s.stats.totalReturn.toFixed(2)}% return)`);
  });

  // Rank by highest Calmar ratio (best risk-adjusted return)
  console.log("\n📊 BEST CALMAR RATIO (Return / Drawdown):");
  const byCalmar = [...allSystems].sort((a, b) => b.stats.calmarRatio - a.stats.calmarRatio);
  byCalmar.forEach((s, i) => {
    console.log(`  ${i + 1}. ${s.name.padEnd(15)} ${s.stats.calmarRatio.toFixed(3).padStart(7)}   (${s.stats.totalReturn.toFixed(2)}% / ${s.stats.maxDrawdown.toFixed(2)}%)`);
  });

  // Rank by highest total return
  console.log("\n💰 HIGHEST TOTAL RETURN:");
  const byReturn = [...allSystems].sort((a, b) => b.stats.totalReturn - a.stats.totalReturn);
  byReturn.forEach((s, i) => {
    console.log(`  ${i + 1}. ${s.name.padEnd(15)} ${s.stats.totalReturn.toFixed(2).padStart(7)}%   (${s.stats.maxDrawdown.toFixed(2)}% drawdown)`);
  });

  // Rank by Sharpe ratio
  console.log("\n📈 BEST SHARPE RATIO (Risk-Adjusted):");
  const bySharpe = [...allSystems].sort((a, b) => b.stats.sharpeRatio - a.stats.sharpeRatio);
  bySharpe.forEach((s, i) => {
    console.log(`  ${i + 1}. ${s.name.padEnd(15)} ${s.stats.sharpeRatio.toFixed(3).padStart(7)}   (${s.stats.totalReturn.toFixed(2)}% return)`);
  });

  console.log("\n\n╔══════════════════════════════════════════════════════════════════╗");
  console.log("║                    🎯 RECOMMENDATION 🎯                          ║");
  console.log("╚══════════════════════════════════════════════════════════════════╝\n");

  const best = byCalmar[0];
  console.log(`For "GO BIG" concentrated trading, use: ${best.name}`);
  console.log(`  Return:        +${best.stats.totalReturn.toFixed(2)}%`);
  console.log(`  Max Drawdown:   ${best.stats.maxDrawdown.toFixed(2)}%`);
  console.log(`  Calmar Ratio:   ${best.stats.calmarRatio.toFixed(3)}`);
  console.log(`  Win Rate:       ${best.stats.winRate.toFixed(1)}%`);
  console.log(`  Trades:         ${best.stats.trades}`);
  console.log();

  await pool.end();
}

main().catch(console.error);
