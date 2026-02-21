// Set DATABASE_URL before any imports
process.env.DATABASE_URL = process.env.DATABASE_URL ||
  "postgresql://limni_db_user:K8zK9exIEbZ4YzyV4jxFYHpZO0Rq1X36@dpg-d5jucsmr433s73baeg1g-a.oregon-postgres.render.com/limni_db";

import { Pool } from "pg";
import { DateTime } from "luxon";
import { listAssetClasses, type AssetClass } from "../src/lib/cotMarkets";
import { readSnapshot, readSnapshotHistory } from "../src/lib/cotStore";
import { computeModelPerformance, type PerformanceModel } from "../src/lib/performanceLab";
import { getAggregatesForWeekStartWithBackfill } from "../src/lib/sentiment/store";
import { PERFORMANCE_V1_MODELS, PERFORMANCE_V2_MODELS } from "../src/lib/performance/modelConfig";

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  throw new Error("DATABASE_URL environment variable is required");
}

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

async function main() {
  const assetClasses = listAssetClasses();

  console.log("\\n=== V1 vs V2 Comparison (Fixed) - 5 Weeks ===\\n");
  console.log("Weeks analyzed:");
  WEEKS.forEach((week, i) => {
    const dt = DateTime.fromISO(week, { zone: "utc" });
    console.log(`  ${i + 1}. ${dt.toFormat("MMM dd, yyyy")}`);
  });
  console.log();

  let v1TotalPercent = 0;
  let v1TotalTrades = 0;
  let v1Wins = 0;

  let v2TotalPercent = 0;
  let v2TotalTrades = 0;
  let v2Wins = 0;

  const v1ByModel = new Map<PerformanceModel, { percent: number; trades: number; wins: number }>();
  const v2ByModel = new Map<PerformanceModel, { percent: number; trades: number; wins: number }>();

  PERFORMANCE_V1_MODELS.forEach(m => v1ByModel.set(m, { percent: 0, trades: 0, wins: 0 }));
  PERFORMANCE_V2_MODELS.forEach(m => v2ByModel.set(m, { percent: 0, trades: 0, wins: 0 }));

  for (const weekOpenUtc of WEEKS) {
    const weekOpen = DateTime.fromISO(weekOpenUtc, { zone: "utc" });
    const weekClose = weekOpen.plus({ days: 7 }).toUTC().toISO()!;
    const sentiment = await getAggregatesForWeekStartWithBackfill(weekOpenUtc, weekClose);

    console.log(`\\nWeek: ${weekOpen.toFormat("MMM dd, yyyy")}`);

    for (const asset of assetClasses) {
      const snapshot = await getSnapshotForWeek(asset.id, weekOpenUtc);
      if (!snapshot) continue;

      // Compute V1 models
      for (const model of PERFORMANCE_V1_MODELS) {
        const result = await computeModelPerformance({
          model,
          assetClass: asset.id,
          snapshot,
          sentiment,
          system: "v1",
        });

        // Debug: show first week for all assets
        if (weekOpenUtc === WEEKS[0]) {
          console.log(`  [${asset.id}] ${model}: ${result.priced} trades, +${result.percent.toFixed(2)}%, ${result.total} total pairs`);
          if ((model === "antikythera" || model === "antikythera_v2") && result.total > 0) {
            const reasons = result.pair_details[0]?.reason ?? [];
            console.log(`    First pair reasons: ${reasons.join(", ")}`);
          }
        }

        const stats = v1ByModel.get(model)!;
        stats.percent += result.percent;
        stats.trades += result.priced;
        stats.wins += result.returns.filter(r => r.percent > 0).length;
        v1ByModel.set(model, stats);
      }

      // Compute V2 models
      for (const model of PERFORMANCE_V2_MODELS) {
        const result = await computeModelPerformance({
          model,
          assetClass: asset.id,
          snapshot,
          sentiment,
          system: "v2",
        });

        // Debug: show first week for all assets
        if (weekOpenUtc === WEEKS[0] && model === "antikythera_v2") {
          console.log(`  [${asset.id}] ${model}: ${result.priced} trades, +${result.percent.toFixed(2)}%, ${result.total} total pairs`);
          if (result.total > 0) {
            const reasons = result.pair_details[0]?.reason ?? [];
            console.log(`    First pair reasons: ${reasons.join(", ")}`);
          }
        }

        const stats = v2ByModel.get(model)!;
        stats.percent += result.percent;
        stats.trades += result.priced;
        stats.wins += result.returns.filter(r => r.percent > 0).length;
        v2ByModel.set(model, stats);
      }
    }
  }

  // Calculate totals
  v1ByModel.forEach(stats => {
    v1TotalPercent += stats.percent;
    v1TotalTrades += stats.trades;
    v1Wins += stats.wins;
  });

  v2ByModel.forEach(stats => {
    v2TotalPercent += stats.percent;
    v2TotalTrades += stats.trades;
    v2Wins += stats.wins;
  });

  console.log("\\n=== V1 Results (5 Baskets) ===");
  console.log(`Total Return: +${v1TotalPercent.toFixed(2)}%`);
  console.log(`Total Trades: ${v1TotalTrades}`);
  console.log(`Win Rate: ${((v1Wins / v1TotalTrades) * 100).toFixed(2)}%`);
  console.log("\\nBy Model:");
  v1ByModel.forEach((stats, model) => {
    const winRate = stats.trades > 0 ? ((stats.wins / stats.trades) * 100).toFixed(1) : "0.0";
    console.log(`  ${model.padEnd(15)} +${stats.percent.toFixed(2)}%`.padEnd(30) +
                `${stats.trades} trades, ${winRate}% win rate`);
  });

  console.log("\\n=== V2 Results (3 Baskets - Fixed) ===");
  console.log(`Total Return: +${v2TotalPercent.toFixed(2)}%`);
  console.log(`Total Trades: ${v2TotalTrades}`);
  console.log(`Win Rate: ${((v2Wins / v2TotalTrades) * 100).toFixed(2)}%`);
  console.log("\\nBy Model:");
  v2ByModel.forEach((stats, model) => {
    const winRate = stats.trades > 0 ? ((stats.wins / stats.trades) * 100).toFixed(1) : "0.0";
    console.log(`  ${model.padEnd(15)} +${stats.percent.toFixed(2)}%`.padEnd(30) +
                `${stats.trades} trades, ${winRate}% win rate`);
  });

  console.log("\\n=== Comparison ===");
  console.log(`V1 Total: +${v1TotalPercent.toFixed(2)}%`);
  console.log(`V2 Total: +${v2TotalPercent.toFixed(2)}%`);
  console.log(`Difference: ${(v2TotalPercent - v1TotalPercent).toFixed(2)}%`);

  const v1Antikythera = v1ByModel.get("antikythera")!;
  const v2Antikythera = v2ByModel.get("antikythera_v2")!;
  console.log("\\n=== Antikythera Comparison (Key Fix) ===");
  console.log(`V1 Antikythera (blended): +${v1Antikythera.percent.toFixed(2)}%, ${v1Antikythera.trades} trades`);
  console.log(`V2 Antikythera (dealer):  +${v2Antikythera.percent.toFixed(2)}%, ${v2Antikythera.trades} trades`);
  console.log(`Difference: ${(v2Antikythera.percent - v1Antikythera.percent).toFixed(2)}%, ${v2Antikythera.trades - v1Antikythera.trades} trades`);

  await pool.end();
}

main().catch(console.error);
