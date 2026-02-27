// Individual basket performance analysis
process.env.DATABASE_URL = process.env.DATABASE_URL ||
  "postgresql://limni_db_user:K8zK9exIEbZ4YzyV4jxFYHpZO0Rq1X36@dpg-d5jucsmr433s73baeg1g-a.oregon-postgres.render.com/limni_db";

import { Pool } from "pg";
import { DateTime } from "luxon";
import { listAssetClasses, type AssetClass } from "../src/lib/cotMarkets";
import { readSnapshotHistory } from "../src/lib/cotStore";
import { computeModelPerformance } from "../src/lib/performanceLab";
import { getAggregatesForWeekStartWithBackfill } from "../src/lib/sentiment/store";
import { readMarketSnapshot } from "../src/lib/priceStore";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes("render.com") ? { rejectUnauthorized: false } : false,
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
  console.log("║             INDIVIDUAL BASKET & TIER PERFORMANCE                 ║");
  console.log("╚══════════════════════════════════════════════════════════════════╝\n");

  console.log("Testing 5 weeks (Jan 19 - Feb 16, 2026)\n");

  // Track each basket INDEPENDENTLY (not summed as portfolio)
  const baskets = {
    antikythera: { totalReturn: 0, trades: 0, wins: 0, weeklyReturns: [] as number[] },
    blended: { totalReturn: 0, trades: 0, wins: 0, weeklyReturns: [] as number[] },
    dealer: { totalReturn: 0, trades: 0, wins: 0, weeklyReturns: [] as number[] },
    commercial: { totalReturn: 0, trades: 0, wins: 0, weeklyReturns: [] as number[] },
    sentiment: { totalReturn: 0, trades: 0, wins: 0, weeklyReturns: [] as number[] },
  };

  const tiers = {
    tier1: { totalReturn: 0, trades: 0, wins: 0, weeklyReturns: [] as number[] },
    tier2: { totalReturn: 0, trades: 0, wins: 0, weeklyReturns: [] as number[] },
    tier3: { totalReturn: 0, trades: 0, wins: 0, weeklyReturns: [] as number[] },
  };

  for (const weekOpenUtc of WEEKS) {
    const weekOpen = DateTime.fromISO(weekOpenUtc, { zone: "utc" });
    const weekClose = weekOpen.plus({ days: 7 }).toUTC().toISO()!;
    const sentiment = await getAggregatesForWeekStartWithBackfill(weekOpenUtc, weekClose);

    let weekAntikythera = 0;
    let weekBlended = 0;
    let weekDealer = 0;
    let weekCommercial = 0;
    let weekSentiment = 0;
    let weekTier1 = 0;
    let weekTier2 = 0;
    let weekTier3 = 0;

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

      weekAntikythera += antikytheraResult.percent;
      weekBlended += blendedResult.percent;
      weekDealer += dealerResult.percent;
      weekCommercial += commercialResult.percent;
      weekSentiment += sentimentResult.percent;

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

    console.log(`Week ${DateTime.fromISO(weekOpenUtc).toFormat("MMM dd")}:`);
    console.log(`  Antikythera: ${weekAntikythera.toFixed(2)}%`);
    console.log(`  Blended:     ${weekBlended.toFixed(2)}%`);
    console.log(`  Dealer:      ${weekDealer.toFixed(2)}%`);
    console.log(`  Commercial:  ${weekCommercial.toFixed(2)}%`);
    console.log(`  Sentiment:   ${weekSentiment.toFixed(2)}%`);
    console.log(`  Tier 1:      ${weekTier1.toFixed(2)}%`);
    console.log(`  Tier 2:      ${weekTier2.toFixed(2)}%`);
    console.log(`  Tier 3:      ${weekTier3.toFixed(2)}%\n`);

    baskets.antikythera.weeklyReturns.push(weekAntikythera);
    baskets.antikythera.totalReturn += weekAntikythera;
    baskets.blended.weeklyReturns.push(weekBlended);
    baskets.blended.totalReturn += weekBlended;
    baskets.dealer.weeklyReturns.push(weekDealer);
    baskets.dealer.totalReturn += weekDealer;
    baskets.commercial.weeklyReturns.push(weekCommercial);
    baskets.commercial.totalReturn += weekCommercial;
    baskets.sentiment.weeklyReturns.push(weekSentiment);
    baskets.sentiment.totalReturn += weekSentiment;

    tiers.tier1.weeklyReturns.push(weekTier1);
    tiers.tier1.totalReturn += weekTier1;
    tiers.tier2.weeklyReturns.push(weekTier2);
    tiers.tier2.totalReturn += weekTier2;
    tiers.tier3.weeklyReturns.push(weekTier3);
    tiers.tier3.totalReturn += weekTier3;
  }

  console.log("\n╔══════════════════════════════════════════════════════════════════╗");
  console.log("║                    INDIVIDUAL BASKET RESULTS                     ║");
  console.log("╚══════════════════════════════════════════════════════════════════╝\n");

  for (const [name, stats] of Object.entries(baskets)) {
    const winRate = stats.trades > 0 ? (stats.wins / stats.trades) * 100 : 0;
    console.log(`${name.toUpperCase()}:`);
    console.log(`  Total Return:   ${stats.totalReturn.toFixed(2)}%`);
    console.log(`  Trades:         ${stats.trades}`);
    console.log(`  Win Rate:       ${winRate.toFixed(1)}%`);
    console.log(`  Avg per Trade:  ${stats.trades > 0 ? (stats.totalReturn / stats.trades).toFixed(2) : '0.00'}%\n`);
  }

  console.log("\n╔══════════════════════════════════════════════════════════════════╗");
  console.log("║                      TIER RESULTS (V3)                           ║");
  console.log("╚══════════════════════════════════════════════════════════════════╝\n");

  for (const [name, stats] of Object.entries(tiers)) {
    const winRate = stats.trades > 0 ? (stats.wins / stats.trades) * 100 : 0;
    console.log(`${name.toUpperCase()}:`);
    console.log(`  Total Return:   ${stats.totalReturn.toFixed(2)}%`);
    console.log(`  Trades:         ${stats.trades}`);
    console.log(`  Win Rate:       ${winRate.toFixed(1)}%`);
    console.log(`  Avg per Trade:  ${stats.trades > 0 ? (stats.totalReturn / stats.trades).toFixed(2) : '0.00'}%\n`);
  }

  await pool.end();
}

main().catch(console.error);
