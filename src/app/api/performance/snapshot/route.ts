import { NextResponse } from "next/server";
import { listAssetClasses } from "@/lib/cotMarkets";
import { readSnapshot } from "@/lib/cotStore";
import { getLatestAggregates, readAggregates } from "@/lib/sentiment/store";
import {
  computeModelPerformance,
  buildSentimentPairsWithHistory,
  type PerformanceModel,
} from "@/lib/performanceLab";
import { getPairPerformance, getPairPerformanceForWindows, getPerformanceWindow } from "@/lib/pricePerformance";
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

  const weekOpenUtc = getWeekOpenUtc();
  const [latestSentiment, sentimentHistory] = await Promise.all([
    getLatestAggregates(),
    readAggregates(),
  ]);
  const snapshots = await Promise.all(
    assetClasses.map((asset) => readSnapshot({ assetClass: asset.id })),
  );

  const payload = [];
  for (const asset of assetClasses) {
    const snapshot = snapshots.find((item) => item?.asset_class === asset.id) ?? null;
    if (!snapshot) {
      continue;
    }
    const performance = await getPairPerformance(buildAllPairs(asset.id), {
      assetClass: asset.id,
      reportDate: snapshot.report_date,
      isLatestReport: true,
    });
    const window = getPerformanceWindow({
      assetClass: asset.id,
      reportDate: snapshot.report_date,
      isLatestReport: true,
    });

    for (const model of models) {
      let result;
      if (model === "sentiment") {
        const sentimentPairs = buildSentimentPairsWithHistory({
          assetClass: asset.id,
          sentimentHistory,
          weekOpenUtc: window.openUtc,
          weekCloseUtc: window.closeUtc,
        });
        const sentimentPerformance = await getPairPerformanceForWindows(
          sentimentPairs.pairs,
          Object.fromEntries(
            Object.entries(sentimentPairs.windows).map(([pair, windowInfo]) => [
              pair,
              { openUtc: windowInfo.openUtc, closeUtc: windowInfo.closeUtc },
            ]),
          ),
          { assetClass: asset.id },
        );
        result = await computeModelPerformance({
          model,
          assetClass: asset.id,
          snapshot,
          sentiment: latestSentiment,
          performance: sentimentPerformance,
          pairsOverride: sentimentPairs.pairs,
          reasonOverrides: sentimentPairs.reasonOverrides,
        });
      } else {
        result = await computeModelPerformance({
          model,
          assetClass: asset.id,
          snapshot,
          sentiment: latestSentiment,
          performance,
        });
      }
      payload.push({
        week_open_utc: weekOpenUtc,
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
    week_open_utc: weekOpenUtc,
    snapshots_written: payload.length,
  });
}
