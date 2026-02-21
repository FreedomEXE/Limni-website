import { NextResponse } from "next/server";
import { readAllPerformanceSnapshots } from "@/lib/performanceSnapshots";
import { getCanonicalWeekOpenUtc } from "@/lib/weekAnchor";
import { DateTime } from "luxon";
import type { PerformanceModel } from "@/lib/performanceLab";

const V1_MODELS: PerformanceModel[] = ["antikythera", "blended", "dealer", "commercial", "sentiment"];
const V2_MODELS: PerformanceModel[] = ["dealer", "sentiment", "antikythera"];

type ComparisonMetrics = {
  totalReturn: number;
  weeks: number;
  winRate: number;
  sharpe: number;
  avgWeekly: number;
};

function computeMetrics(
  snapshots: Awaited<ReturnType<typeof readAllPerformanceSnapshots>>,
  models: PerformanceModel[],
  currentWeekMillis: number,
): ComparisonMetrics {
  // Group by week and sum across selected models
  const weekTotals = new Map<string, number>();

  for (const snapshot of snapshots) {
    if (!models.includes(snapshot.model)) {
      continue;
    }

    const weekKey = snapshot.week_open_utc;
    const weekMillis = DateTime.fromISO(weekKey, { zone: "utc" }).toMillis();

    // Only include closed historical weeks
    if (weekMillis >= currentWeekMillis) {
      continue;
    }

    const current = weekTotals.get(weekKey) ?? 0;
    weekTotals.set(weekKey, current + snapshot.percent);
  }

  const weekReturns = Array.from(weekTotals.values());
  const totalReturn = weekReturns.reduce((sum, val) => sum + val, 0);
  const weeks = weekReturns.length;
  const wins = weekReturns.filter((val) => val > 0).length;
  const winRate = weeks > 0 ? (wins / weeks) * 100 : 0;
  const avgWeekly = weeks > 0 ? totalReturn / weeks : 0;

  // Compute Sharpe (simplified: avg / stddev)
  let sharpe = 0;
  if (weeks > 1 && avgWeekly !== 0) {
    const variance = weekReturns.reduce((sum, val) => {
      const diff = val - avgWeekly;
      return sum + diff * diff;
    }, 0) / (weeks - 1);
    const stdDev = Math.sqrt(variance);
    sharpe = stdDev > 0 ? avgWeekly / stdDev : 0;
  }

  return {
    totalReturn,
    weeks,
    winRate,
    sharpe,
    avgWeekly,
  };
}

export async function GET() {
  try {
    const currentWeekOpenUtc = getCanonicalWeekOpenUtc();
    const currentWeekMillis = DateTime.fromISO(currentWeekOpenUtc, { zone: "utc" }).toMillis();

    // Fetch last 5 weeks of snapshots
    const snapshots = await readAllPerformanceSnapshots(5 * 5); // 5 models × 5 weeks = 25 rows max

    const v1Metrics = computeMetrics(snapshots, V1_MODELS, currentWeekMillis);
    const v2Metrics = computeMetrics(snapshots, V2_MODELS, currentWeekMillis);

    return NextResponse.json({
      v1: v1Metrics,
      v2: v2Metrics,
    });
  } catch (error) {
    console.error("Performance comparison API error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch comparison data" },
      { status: 500 },
    );
  }
}
