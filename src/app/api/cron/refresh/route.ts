import { NextResponse } from "next/server";
import { listAssetClasses } from "@/lib/cotMarkets";
import { readSnapshot, refreshAllSnapshots } from "@/lib/cotStore";
import { refreshMarketSnapshot } from "@/lib/pricePerformance";
import { refreshSentiment } from "@/lib/sentiment/refresh";
import { refreshNewsSnapshot } from "@/lib/news/refresh";
import { refreshPerformanceSnapshots } from "@/lib/performanceRefresh";

export const dynamic = "force-dynamic";

function isAuthorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return true;
  }
  const headerSecret = request.headers.get("x-cron-secret");
  const authHeader = request.headers.get("authorization");
  const vercelCron = request.headers.get("x-vercel-cron");
  const bearerSecret = authHeader?.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length)
    : null;
  const url = new URL(request.url);
  const querySecret = url.searchParams.get("secret");
  return (
    headerSecret === secret ||
    querySecret === secret ||
    bearerSecret === secret ||
    vercelCron === "1"
  );
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startedAt = new Date().toISOString();
  const assetClasses = listAssetClasses();
  const results: Record<
    string,
    { cot: "ok" | "error"; prices: "ok" | "skipped" | "error"; message?: string }
  > = {};
  let sentiment: { ok: boolean; snapshots: number; aggregates: number; flips: number } | null = null;
  let news:
    | { ok: boolean; week_open_utc: string | null; announcements: number; calendar_events: number }
    | null = null;

  try {
    await refreshAllSnapshots();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    assetClasses.forEach((asset) => {
      results[asset.id] = { cot: "error", prices: "skipped", message };
    });
    return NextResponse.json({ startedAt, results });
  }

  const priceTasks = assetClasses.map(async (asset) => {
    try {
      const snapshot = await readSnapshot({ assetClass: asset.id });
      if (!snapshot) {
        return {
          assetId: asset.id,
          result: { cot: "ok", prices: "skipped", message: "No snapshot." } as const,
        };
      }
      await refreshMarketSnapshot(snapshot.pairs, {
        assetClass: asset.id,
        force: true,
      });
      return {
        assetId: asset.id,
        result: { cot: "ok", prices: "ok" } as const,
      };
    } catch (error) {
      return {
        assetId: asset.id,
        result: {
          cot: "ok",
          prices: "error",
          message: error instanceof Error ? error.message : String(error),
        } as const,
      };
    }
  });

  const [priceResults, sentimentResult, newsResult, performanceResult] = await Promise.all([
    Promise.all(priceTasks),
    (async () => {
      try {
        const result = await refreshSentiment();
        return {
          ok: result.ok,
          snapshots: result.snapshots,
          aggregates: result.aggregates,
          flips: result.flips.length,
        };
      } catch {
        return {
          ok: false,
          snapshots: 0,
          aggregates: 0,
          flips: 0,
        };
      }
    })(),
    (async () => {
      try {
        const result = await refreshNewsSnapshot();
        return {
          ok: result.ok,
          week_open_utc: result.week_open_utc,
          announcements: result.announcements,
          calendar_events: result.calendar_events,
        };
      } catch {
        return {
          ok: false,
          week_open_utc: null,
          announcements: 0,
          calendar_events: 0,
        };
      }
    })(),
    (async () => {
      try {
        const result = await refreshPerformanceSnapshots({ rollingWeeks: 6 });
        return {
          ok: true,
          weeks: result.weeks,
          snapshots_written: result.snapshots_written,
        };
      } catch {
        return {
          ok: false,
          weeks: [],
          snapshots_written: 0,
        };
      }
    })(),
  ]);

  priceResults.forEach(({ assetId, result }) => {
    results[assetId] = result;
  });
  sentiment = sentimentResult;
  news = newsResult;

  return NextResponse.json({
    startedAt,
    finishedAt: new Date().toISOString(),
    results,
    sentiment,
    news,
    performance: performanceResult,
  });
}
