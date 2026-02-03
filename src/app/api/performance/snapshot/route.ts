import { NextResponse } from "next/server";
import { DateTime } from "luxon";
import { listAssetClasses, type AssetClass } from "@/lib/cotMarkets";
import { readSnapshot, readSnapshotHistory } from "@/lib/cotStore";
import { getLatestAggregatesLocked } from "@/lib/sentiment/store";
import {
  computeModelPerformance,
  type PerformanceModel,
} from "@/lib/performanceLab";
import { getPairPerformance } from "@/lib/pricePerformance";
import type { PairSnapshot } from "@/lib/cotTypes";
import { PAIRS_BY_ASSET_CLASS } from "@/lib/cotPairs";
import {
  getWeekOpenUtc,
  writePerformanceSnapshots,
} from "@/lib/performanceSnapshots";

export const runtime = "nodejs";

function getToken(request: Request) {
  const headerToken = request.headers.get("x-admin-token");
  if (headerToken) {
    return headerToken;
  }

  const auth = request.headers.get("authorization");
  if (auth && auth.toLowerCase().startsWith("bearer ")) {
    return auth.slice(7);
  }

  return null;
}

function buildAllPairs(assetId: string): Record<string, PairSnapshot> {
  const pairDefs = PAIRS_BY_ASSET_CLASS[assetId as keyof typeof PAIRS_BY_ASSET_CLASS] ?? [];
  const pairs: Record<string, PairSnapshot> = {};
  for (const pair of pairDefs) {
    pairs[pair.pair] = {
      direction: "LONG",
      base_bias: "NEUTRAL",
      quote_bias: "NEUTRAL",
    };
  }
  return pairs;
}

function getTargetReportDateForWeek(weekOpenUtc: string): string | null {
  const weekOpen = DateTime.fromISO(weekOpenUtc, { zone: "utc" }).setZone(
    "America/New_York",
  );
  if (!weekOpen.isValid) {
    return null;
  }
  return weekOpen.minus({ days: 6 }).toISODate();
}

async function readSnapshotForWeek(
  assetClass: AssetClass,
  weekOpenUtc: string,
) {
  const targetReportDate = getTargetReportDateForWeek(weekOpenUtc);
  if (!targetReportDate) {
    return null;
  }

  const history = await readSnapshotHistory(assetClass, 260);
  const match = history.find((item) => item.report_date <= targetReportDate);
  return match ?? null;
}

export async function POST(request: Request) {
  const adminToken = process.env.ADMIN_TOKEN;
  if (!adminToken) {
    return NextResponse.json(
      { error: "ADMIN_TOKEN is not configured." },
      { status: 500 },
    );
  }

  const token = getToken(request);
  if (!token || token !== adminToken) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const assetClasses = listAssetClasses();
  const models: PerformanceModel[] = [
    "antikythera",
    "blended",
    "dealer",
    "commercial",
    "sentiment",
  ];
  const { searchParams } = new URL(request.url);
  const forcedWeekOpenUtc = searchParams.get("week_open_utc");

  let responseWeekOpenUtc: string | null = null;
  const latestSentiment = await getLatestAggregatesLocked();
  const snapshots = await Promise.all(
    assetClasses.map((asset) =>
      forcedWeekOpenUtc
        ? readSnapshotForWeek(asset.id, forcedWeekOpenUtc)
        : readSnapshot({ assetClass: asset.id }),
    ),
  );

  const payload = [];
  for (const asset of assetClasses) {
    const snapshot = snapshots.find((item) => item?.asset_class === asset.id) ?? null;
    if (!snapshot) {
      continue;
    }
    let reportWeekOpenUtc: string;
    if (forcedWeekOpenUtc) {
      reportWeekOpenUtc = forcedWeekOpenUtc;
    } else if (snapshot.report_date) {
      const reportDate = DateTime.fromISO(snapshot.report_date, {
        zone: "America/New_York",
      });
      reportWeekOpenUtc = reportDate.isValid
        ? getWeekOpenUtc(reportDate)
        : getWeekOpenUtc();
    } else {
      reportWeekOpenUtc = getWeekOpenUtc();
    }
    if (!responseWeekOpenUtc) {
      responseWeekOpenUtc = reportWeekOpenUtc;
    }

    const performance = await getPairPerformance(buildAllPairs(asset.id), {
      assetClass: asset.id,
      reportDate: snapshot.report_date,
      isLatestReport: false,
    });
    for (const model of models) {
      const result = await computeModelPerformance({
        model,
        assetClass: asset.id,
        snapshot,
        sentiment: latestSentiment,
        performance,
      });
      payload.push({
        week_open_utc: reportWeekOpenUtc,
        asset_class: asset.id,
        model,
        report_date: snapshot.report_date ?? null,
        percent: result.percent,
        priced: result.priced,
        total: result.total,
        note: result.note,
        returns: result.returns,
        pair_details: result.pair_details,
        stats: result.stats,
      });
    }
  }

  await writePerformanceSnapshots(payload);

  return NextResponse.json({
    ok: true,
    week_open_utc: responseWeekOpenUtc ?? getWeekOpenUtc(),
    snapshots_written: payload.length,
  });
}
