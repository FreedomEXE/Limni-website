// Set DATABASE_URL before any imports
process.env.DATABASE_URL = process.env.DATABASE_URL ||
  "postgresql://limni_db_user:K8zK9exIEbZ4YzyV4jxFYHpZO0Rq1X36@dpg-d5jucsmr433s73baeg1g-a.oregon-postgres.render.com/limni_db";

import { Pool } from "pg";
import { DateTime } from "luxon";
import { listAssetClasses, type AssetClass } from "../src/lib/cotMarkets";
import { readSnapshotHistory } from "../src/lib/cotStore";
import { computeModelPerformance } from "../src/lib/performanceLab";
import { getAggregatesForWeekStartWithBackfill } from "../src/lib/sentiment/store";
import { PERFORMANCE_V1_MODELS, PERFORMANCE_V2_MODELS } from "../src/lib/performance/modelConfig";
import { readMarketSnapshot } from "../src/lib/priceStore";

const DATABASE_URL = process.env.DATABASE_URL;

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: DATABASE_URL.includes("render.com") ? { rejectUnauthorized: false } : false,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

const WEEKS = [
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

    // Count directional votes
    const votes = { LONG: 0, SHORT: 0, NEUTRAL: 0 };
    [sentiment, dealer, commercial].forEach((dir) => votes[dir as keyof typeof votes]++);

    let tier: 1 | 2 | 3 | null = null;
    let direction: "LONG" | "SHORT" | null = null;

    // Tier 1: All 3 agree on direction (excluding neutral)
    if (votes.LONG === 3) {
      tier = 1;
      direction = "LONG";
    } else if (votes.SHORT === 3) {
      tier = 1;
      direction = "SHORT";
    }
    // Tier 2: 2 out of 3 agree on direction
    else if (votes.LONG === 2) {
      tier = 2;
      direction = "LONG";
    } else if (votes.SHORT === 2) {
      tier = 2;
      direction = "SHORT";
    }
    // Tier 3: Tiebreaker (at least 1 directional, rest neutral)
    else if (votes.LONG === 1 && votes.NEUTRAL === 2) {
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

  console.log("\n=== V1 vs V2 vs V3 Comparison - 5 Weeks ===\n");
  console.log("Weeks analyzed:");
  WEEKS.forEach((week, i) => {
    const dt = DateTime.fromISO(week, { zone: "utc" });
    console.log(`  ${i + 1}. ${dt.toFormat("MMM dd, yyyy")}`);
  });
  console.log();
  console.log("Methodology: All systems measured as portfolio returns per week");
  console.log("  V1: 5 parallel baskets (sum weekly return from each basket)");
  console.log("  V2: 3 parallel baskets (sum weekly return from each basket)");
  console.log("  V3: 1 portfolio (sum weekly return from all tiers)");
  console.log();

  // V1 tracking
  let v1TotalPercent = 0;
  let v1TotalTrades = 0;
  let v1Wins = 0;

  // V2 tracking
  let v2TotalPercent = 0;
  let v2TotalTrades = 0;
  let v2Wins = 0;

  // V3 tracking (per week, then sum across weeks)
  const v3WeeklyReturns: number[] = [];
  const v3ByTier = {
    tier1: { percent: 0, trades: 0, wins: 0, weeklyReturns: [] as number[] },
    tier2: { percent: 0, trades: 0, wins: 0, weeklyReturns: [] as number[] },
    tier3: { percent: 0, trades: 0, wins: 0, weeklyReturns: [] as number[] },
  };

  for (const weekOpenUtc of WEEKS) {
    const weekOpen = DateTime.fromISO(weekOpenUtc, { zone: "utc" });
    const weekClose = weekOpen.plus({ days: 7 }).toUTC().toISO()!;
    const sentiment = await getAggregatesForWeekStartWithBackfill(weekOpenUtc, weekClose);

    // Get market returns for this week
    const marketReturns = new Map<string, number>();
    for (const asset of assetClasses) {
      try {
        const marketSnapshot = await readMarketSnapshot(weekOpenUtc, asset.id);
        if (!marketSnapshot) {
          continue;
        }
        Object.entries(marketSnapshot.pairs).forEach(([pair, data]) => {
          if (data && typeof data.percent === "number") {
            marketReturns.set(pair, data.percent);
          }
        });
      } catch (err) {
        // Market data not available for this asset/week
      }
    }

    // Track V3 weekly returns by tier
    let weekV3Tier1 = 0;
    let weekV3Tier2 = 0;
    let weekV3Tier3 = 0;

    for (const asset of assetClasses) {
      const snapshot = await getSnapshotForWeek(asset.id, weekOpenUtc);
      if (!snapshot) continue;

      // Compute V1 models
      const v1Results = [];
      for (const model of PERFORMANCE_V1_MODELS) {
        const result = await computeModelPerformance({
          model,
          assetClass: asset.id,
          snapshot,
          sentiment,
          system: "v1",
        });
        v1Results.push(result);
        v1TotalPercent += result.percent;
        v1TotalTrades += result.priced;
        v1Wins += result.returns.filter((r) => r.percent > 0).length;
      }

      // Compute V2 models
      const v2Results = [];
      for (const model of PERFORMANCE_V2_MODELS) {
        const result = await computeModelPerformance({
          model,
          assetClass: asset.id,
          snapshot,
          sentiment,
          system: "v2",
        });
        v2Results.push(result);
        v2TotalPercent += result.percent;
        v2TotalTrades += result.priced;
        v2Wins += result.returns.filter((r) => r.percent > 0).length;
      }

      // Compute V3 signals
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

      const v3Signals = computeV3Signals(sentimentResult, dealerResult, commercialResult);

      for (const signal of v3Signals) {
        if (!signal.direction || !signal.tier) continue;

        const marketReturn = marketReturns.get(signal.pair);
        if (marketReturn === undefined) continue;

        const adjustedReturn = marketReturn * (signal.direction === "LONG" ? 1 : -1);
        const tierKey = `tier${signal.tier}` as keyof typeof v3ByTier;

        // Accumulate for weekly total
        if (signal.tier === 1) weekV3Tier1 += adjustedReturn;
        if (signal.tier === 2) weekV3Tier2 += adjustedReturn;
        if (signal.tier === 3) weekV3Tier3 += adjustedReturn;

        // Track trade count and wins
        v3ByTier[tierKey].trades += 1;
        if (adjustedReturn > 0) {
          v3ByTier[tierKey].wins += 1;
        }
      }
    }

    // Store weekly returns for each tier
    v3ByTier.tier1.weeklyReturns.push(weekV3Tier1);
    v3ByTier.tier2.weeklyReturns.push(weekV3Tier2);
    v3ByTier.tier3.weeklyReturns.push(weekV3Tier3);
    v3WeeklyReturns.push(weekV3Tier1 + weekV3Tier2 + weekV3Tier3);
  }

  // Calculate V3 totals from weekly returns (apples-to-apples with V1/V2)
  const v3Tier1Total = v3ByTier.tier1.weeklyReturns.reduce((sum, r) => sum + r, 0);
  const v3Tier2Total = v3ByTier.tier2.weeklyReturns.reduce((sum, r) => sum + r, 0);
  const v3Tier3Total = v3ByTier.tier3.weeklyReturns.reduce((sum, r) => sum + r, 0);
  const v3TotalPercent = v3WeeklyReturns.reduce((sum, r) => sum + r, 0);
  const v3TotalTrades = v3ByTier.tier1.trades + v3ByTier.tier2.trades + v3ByTier.tier3.trades;
  const v3Wins = v3ByTier.tier1.wins + v3ByTier.tier2.wins + v3ByTier.tier3.wins;

  console.log("\n╔══════════════════════════════════════════════════════════════════╗");
  console.log("║                    SYSTEM COMPARISON RESULTS                     ║");
  console.log("╚══════════════════════════════════════════════════════════════════╝\n");

  console.log("┌─────────────────────────────────────────────────────────────────┐");
  console.log("│ V1: Universal V1 (5 Baskets)                                    │");
  console.log("│ Models: Antikythera, Blended, Dealer, Commercial, Sentiment     │");
  console.log("└─────────────────────────────────────────────────────────────────┘");
  console.log(`Total Return:     +${v1TotalPercent.toFixed(2)}%`);
  console.log(`Total Trades:     ${v1TotalTrades}`);
  console.log(`Win Rate:         ${((v1Wins / v1TotalTrades) * 100).toFixed(2)}%`);
  console.log(`Avg per Trade:    +${(v1TotalPercent / v1TotalTrades).toFixed(2)}%\n`);

  console.log("┌─────────────────────────────────────────────────────────────────┐");
  console.log("│ V2: Universal V2 (3 Baskets - FIXED)                            │");
  console.log("│ Models: Antikythera V2 (dealer only), Dealer, Sentiment         │");
  console.log("└─────────────────────────────────────────────────────────────────┘");
  console.log(`Total Return:     +${v2TotalPercent.toFixed(2)}%`);
  console.log(`Total Trades:     ${v2TotalTrades}`);
  console.log(`Win Rate:         ${((v2Wins / v2TotalTrades) * 100).toFixed(2)}%`);
  console.log(`Avg per Trade:    +${(v2TotalPercent / v2TotalTrades).toFixed(2)}%\n`);

  console.log("┌─────────────────────────────────────────────────────────────────┐");
  console.log("│ V3: Agreement-Based (3 Tiers)                                   │");
  console.log("│ Sources: Sentiment, Dealer, Commercial                          │");
  console.log("└─────────────────────────────────────────────────────────────────┘");
  console.log(`Total Return:     +${v3TotalPercent.toFixed(2)}%`);
  console.log(`Total Trades:     ${v3TotalTrades}`);
  console.log(`Win Rate:         ${((v3Wins / v3TotalTrades) * 100).toFixed(2)}%`);
  console.log(`Avg per Trade:    +${(v3TotalPercent / v3TotalTrades).toFixed(2)}%`);
  console.log("\nBy Tier:");
  console.log(`  Tier 1 (3/3):   +${v3Tier1Total.toFixed(2)}% (${v3ByTier.tier1.trades} trades, ${v3ByTier.tier1.trades > 0 ? ((v3ByTier.tier1.wins / v3ByTier.tier1.trades) * 100).toFixed(1) : '0.0'}% win rate)`);
  console.log(`  Tier 2 (2/3):   +${v3Tier2Total.toFixed(2)}% (${v3ByTier.tier2.trades} trades, ${v3ByTier.tier2.trades > 0 ? ((v3ByTier.tier2.wins / v3ByTier.tier2.trades) * 100).toFixed(1) : '0.0'}% win rate)`);
  console.log(`  Tier 3 (1/3):   +${v3Tier3Total.toFixed(2)}% (${v3ByTier.tier3.trades} trades, ${v3ByTier.tier3.trades > 0 ? ((v3ByTier.tier3.wins / v3ByTier.tier3.trades) * 100).toFixed(1) : '0.0'}% win rate)\n`);

  console.log("╔══════════════════════════════════════════════════════════════════╗");
  console.log("║                         HEAD TO HEAD                             ║");
  console.log("╚══════════════════════════════════════════════════════════════════╝\n");

  const systems = [
    { name: "V1", return: v1TotalPercent, trades: v1TotalTrades, avgPerTrade: v1TotalPercent / v1TotalTrades },
    { name: "V2", return: v2TotalPercent, trades: v2TotalTrades, avgPerTrade: v2TotalPercent / v2TotalTrades },
    { name: "V3", return: v3TotalPercent, trades: v3TotalTrades, avgPerTrade: v3TotalPercent / v3TotalTrades },
  ];

  systems.sort((a, b) => b.return - a.return);

  console.log("Ranked by Total Return:");
  systems.forEach((s, i) => {
    console.log(`  ${i + 1}. ${s.name.padEnd(3)} +${s.return.toFixed(2)}%`.padEnd(25) +
                `(${s.trades} trades, +${s.avgPerTrade.toFixed(2)}% avg)`);
  });

  console.log("\nRanked by Avg Per Trade:");
  systems.sort((a, b) => b.avgPerTrade - a.avgPerTrade);
  systems.forEach((s, i) => {
    console.log(`  ${i + 1}. ${s.name.padEnd(3)} +${s.avgPerTrade.toFixed(2)}% avg`.padEnd(25) +
                `(${s.trades} trades, +${s.return.toFixed(2)}% total)`);
  });

  console.log("\n");

  await pool.end();
}

main().catch(console.error);
