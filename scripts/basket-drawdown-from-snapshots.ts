// Basket & tier drawdown analysis using actual performance snapshots
process.env.DATABASE_URL = process.env.DATABASE_URL ||
  "postgresql://limni_db_user:K8zK9exIEbZ4YzyV4jxFYHpZO0Rq1X36@dpg-d5jucsmr433s73baeg1g-a.oregon-postgres.render.com/limni_db";

import { query } from "../src/lib/db";
import { DateTime } from "luxon";

const WEEKS = [
  "2026-01-19T00:00:00.000Z",
  "2026-01-26T00:00:00.000Z",
  "2026-02-02T00:00:00.000Z",
  "2026-02-09T00:00:00.000Z",
  "2026-02-16T00:00:00.000Z",
];

type BasketStats = {
  weeklyReturns: number[];
  totalReturn: number;
  trades: number;
  wins: number;
  winRate: number;
  maxDrawdown: number;
  avgReturn: number;
  stdDev: number;
  sharpeRatio: number;
  calmarRatio: number;
};

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

  // Sharpe ratio (assuming risk-free rate = 0)
  const sharpeRatio = stdDev > 0 ? avgReturn / stdDev : 0;

  // Calmar ratio (return / max drawdown)
  const calmarRatio = maxDrawdown > 0 ? totalReturn / maxDrawdown : 0;

  return {
    weeklyReturns,
    totalReturn,
    trades,
    wins,
    winRate,
    maxDrawdown,
    avgReturn,
    stdDev,
    sharpeRatio,
    calmarRatio,
  };
}

async function main() {
  console.log("\n╔══════════════════════════════════════════════════════════════════╗");
  console.log("║       BASKET & TIER DRAWDOWN - FROM PERFORMANCE SNAPSHOTS       ║");
  console.log("╚══════════════════════════════════════════════════════════════════╝\n");

  console.log("Analyzing 5 weeks (Jan 19 - Feb 16, 2026)\n");

  // Track each basket
  const baskets = {
    antikythera: { weeklyReturns: [] as number[], trades: 0, wins: 0 },
    blended: { weeklyReturns: [] as number[], trades: 0, wins: 0 },
    dealer: { weeklyReturns: [] as number[], trades: 0, wins: 0 },
    commercial: { weeklyReturns: [] as number[], trades: 0, wins: 0 },
    sentiment: { weeklyReturns: [] as number[], trades: 0, wins: 0 },
  };

  for (const weekOpenUtc of WEEKS) {
    console.log(`\nWeek ${DateTime.fromISO(weekOpenUtc).toFormat("MMM dd, yyyy")}:`);

    // Get performance snapshots for this week
    const snapshots = await query<{
      model: string;
      percent: number;
      priced: number;
      returns: any;
    }>(
      `SELECT model, percent, priced, returns
       FROM performance_snapshots
       WHERE week_open_utc = $1
       ORDER BY model`,
      [weekOpenUtc]
    );

    let weekAntikythera = 0;
    let weekBlended = 0;
    let weekDealer = 0;
    let weekCommercial = 0;
    let weekSentiment = 0;

    for (const snap of snapshots) {
      const returns = typeof snap.returns === 'string' ? JSON.parse(snap.returns) : snap.returns;
      const wins = Array.isArray(returns) ? returns.filter((r: any) => r.percent > 0).length : 0;
      const percent = Number(snap.percent) || 0;
      const priced = Number(snap.priced) || 0;

      switch (snap.model) {
        case 'antikythera':
          weekAntikythera += percent;
          baskets.antikythera.trades += priced;
          baskets.antikythera.wins += wins;
          break;
        case 'blended':
          weekBlended += percent;
          baskets.blended.trades += priced;
          baskets.blended.wins += wins;
          break;
        case 'dealer':
          weekDealer += percent;
          baskets.dealer.trades += priced;
          baskets.dealer.wins += wins;
          break;
        case 'commercial':
          weekCommercial += percent;
          baskets.commercial.trades += priced;
          baskets.commercial.wins += wins;
          break;
        case 'sentiment':
          weekSentiment += percent;
          baskets.sentiment.trades += priced;
          baskets.sentiment.wins += wins;
          break;
      }
    }

    console.log(`  Antikythera: ${weekAntikythera.toFixed(2)}%`);
    console.log(`  Blended:     ${weekBlended.toFixed(2)}%`);
    console.log(`  Dealer:      ${weekDealer.toFixed(2)}%`);
    console.log(`  Commercial:  ${weekCommercial.toFixed(2)}%`);
    console.log(`  Sentiment:   ${weekSentiment.toFixed(2)}%`);

    baskets.antikythera.weeklyReturns.push(weekAntikythera);
    baskets.blended.weeklyReturns.push(weekBlended);
    baskets.dealer.weeklyReturns.push(weekDealer);
    baskets.commercial.weeklyReturns.push(weekCommercial);
    baskets.sentiment.weeklyReturns.push(weekSentiment);
  }

  console.log("\n\n╔══════════════════════════════════════════════════════════════════╗");
  console.log("║                    INDIVIDUAL BASKET RESULTS                     ║");
  console.log("╚══════════════════════════════════════════════════════════════════╝\n");

  const basketStats: Record<string, BasketStats> = {};

  for (const [name, data] of Object.entries(baskets)) {
    const stats = calculateStats(data.weeklyReturns, data.trades, data.wins);
    basketStats[name] = stats;

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

  // Rankings
  console.log("\n╔══════════════════════════════════════════════════════════════════╗");
  console.log("║                       🏆 RANKINGS 🏆                             ║");
  console.log("╚══════════════════════════════════════════════════════════════════╝\n");

  const allBaskets = Object.entries(basketStats).map(([name, stats]) => ({
    name: name.toUpperCase(),
    stats,
  }));

  // Rank by lowest drawdown
  console.log("🛡️  LOWEST DRAWDOWN (Safest to Go Big):");
  const byDrawdown = [...allBaskets].sort((a, b) => a.stats.maxDrawdown - b.stats.maxDrawdown);
  byDrawdown.forEach((b, i) => {
    console.log(`  ${i + 1}. ${b.name.padEnd(15)} ${b.stats.maxDrawdown.toFixed(2).padStart(7)}% drawdown   (${b.stats.totalReturn.toFixed(2)}% return)`);
  });

  // Rank by Calmar ratio
  console.log("\n📊 BEST CALMAR RATIO (Return / Drawdown):");
  const byCalmar = [...allBaskets].sort((a, b) => b.stats.calmarRatio - a.stats.calmarRatio);
  byCalmar.forEach((b, i) => {
    console.log(`  ${i + 1}. ${b.name.padEnd(15)} ${b.stats.calmarRatio.toFixed(3).padStart(7)}   (${b.stats.totalReturn.toFixed(2)}% / ${b.stats.maxDrawdown.toFixed(2)}%)`);
  });

  // Rank by total return
  console.log("\n💰 HIGHEST TOTAL RETURN:");
  const byReturn = [...allBaskets].sort((a, b) => b.stats.totalReturn - a.stats.totalReturn);
  byReturn.forEach((b, i) => {
    console.log(`  ${i + 1}. ${b.name.padEnd(15)} ${b.stats.totalReturn.toFixed(2).padStart(7)}%   (${b.stats.maxDrawdown.toFixed(2)}% drawdown)`);
  });

  // Rank by Sharpe ratio
  console.log("\n📈 BEST SHARPE RATIO (Risk-Adjusted):");
  const bySharpe = [...allBaskets].sort((a, b) => b.stats.sharpeRatio - a.stats.sharpeRatio);
  bySharpe.forEach((b, i) => {
    console.log(`  ${i + 1}. ${b.name.padEnd(15)} ${b.stats.sharpeRatio.toFixed(3).padStart(7)}   (${b.stats.totalReturn.toFixed(2)}% return)`);
  });

  // Rank by win rate
  console.log("\n🎯 HIGHEST WIN RATE:");
  const byWinRate = [...allBaskets].sort((a, b) => b.stats.winRate - a.stats.winRate);
  byWinRate.forEach((b, i) => {
    console.log(`  ${i + 1}. ${b.name.padEnd(15)} ${b.stats.winRate.toFixed(1).padStart(6)}%   (${b.stats.totalReturn.toFixed(2)}% return, ${b.stats.trades} trades)`);
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
}

main().catch(console.error);
