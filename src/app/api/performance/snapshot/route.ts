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

function isCronAuthorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return false;
  }
  const headerSecret = request.headers.get("x-cron-secret");
  const authHeader = request.headers.get("authorization");
  const bearerSecret = authHeader?.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length)
    : null;
  const url = new URL(request.url);
  const querySecret = url.searchParams.get("secret");
  return headerSecret === secret || querySecret === secret || bearerSecret === secret;
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

async function listRecentWeeks(
  assetClasses: ReturnType<typeof listAssetClasses>,
  limit: number,
) {
  const weeks = new Set<string>();
  const historyLists = await Promise.all(
    assetClasses.map((asset) => readSnapshotHistory(asset.id, Math.max(limit * 3, 24))),
  );
  for (const history of historyLists) {
    for (const item of history) {
      if (!item.report_date) {
        continue;
      }
      const reportDate = DateTime.fromISO(item.report_date, { zone: "America/New_York" });
      if (!reportDate.isValid) {
        continue;
      }
      weeks.add(getWeekOpenUtc(reportDate));
    }
  }
  return Array.from(weeks.values())
    .sort((a, b) => DateTime.fromISO(b, { zone: "utc" }).toMillis() - DateTime.fromISO(a, { zone: "utc" }).toMillis())
    .slice(0, limit);
}

async function refreshSnapshots(options: {
  forcedWeekOpenUtc?: string | null;
  rollingWeeks: number;
}) {
  const adminToken = process.env.ADMIN_TOKEN;
  const assetClasses = listAssetClasses();
  const models: PerformanceModel[] = [
    "antikythera",
    "blended",
    "dealer",
    "commercial",
    "sentiment",
  ];
  const latestSentiment = await getLatestAggregatesLocked();

  const targetWeeks = options.forcedWeekOpenUtc
    ? [options.forcedWeekOpenUtc]
    : await listRecentWeeks(assetClasses, Math.max(1, options.rollingWeeks));

  const payload = [];
  for (const weekOpenUtc of targetWeeks) {
    const snapshots = await Promise.all(
      assetClasses.map((asset) =>
        options.forcedWeekOpenUtc || targetWeeks.length > 1
          ? readSnapshotForWeek(asset.id, weekOpenUtc)
          : readSnapshot({ assetClass: asset.id }),
      ),
    );
    for (const asset of assetClasses) {
      const snapshot = snapshots.find((item) => item?.asset_class === asset.id) ?? null;
      if (!snapshot) {
        continue;
      }
      const reportWeekOpenUtc =
        options.forcedWeekOpenUtc || targetWeeks.length > 1
          ? weekOpenUtc
          : snapshot.report_date
            ? (() => {
                const reportDate = DateTime.fromISO(snapshot.report_date, {
                  zone: "America/New_York",
                });
                return reportDate.isValid ? getWeekOpenUtc(reportDate) : getWeekOpenUtc();
              })()
            : getWeekOpenUtc();

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
  }

  await writePerformanceSnapshots(payload);

  return {
    week_open_utc: targetWeeks[0] ?? getWeekOpenUtc(),
    weeks: targetWeeks,
    snapshots_written: payload.length,
  };
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

  const { searchParams } = new URL(request.url);
  const forcedWeekOpenUtc = searchParams.get("week_open_utc");
  const weeksParam = searchParams.get("weeks");
  const rollingWeeks = weeksParam ? Number.parseInt(weeksParam, 10) : 1;
  const result = await refreshSnapshots({
    forcedWeekOpenUtc,
    rollingWeeks: Number.isFinite(rollingWeeks) && rollingWeeks > 0 ? rollingWeeks : 1,
  });

  return NextResponse.json({
    ok: true,
    week_open_utc: result.week_open_utc,
    refreshed_weeks: result.weeks,
    snapshots_written: result.snapshots_written,
  });
}

export async function GET(request: Request) {
  const adminToken = process.env.ADMIN_TOKEN;
  if (!adminToken) {
    return NextResponse.json(
      { error: "ADMIN_TOKEN is not configured." },
      { status: 500 },
    );
  }

  const token = getToken(request);
  if (token !== adminToken && !isCronAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const forcedWeekOpenUtc = searchParams.get("week_open_utc");
  const weeksParam = searchParams.get("weeks");
  const rollingWeeks = weeksParam ? Number.parseInt(weeksParam, 10) : 6;
  const result = await refreshSnapshots({
    forcedWeekOpenUtc,
    rollingWeeks: Number.isFinite(rollingWeeks) && rollingWeeks > 0 ? rollingWeeks : 6,
  });

  return NextResponse.json({
    ok: true,
    week_open_utc: result.week_open_utc,
    refreshed_weeks: result.weeks,
    snapshots_written: result.snapshots_written,
  });
}
