import { NextResponse } from "next/server";
import { aggregateSentiment, detectFlips } from "@/lib/sentiment/aggregate";
import { getAllProviders } from "@/lib/sentiment/providers";
import {
  appendAggregates,
  appendSnapshots,
  getLatestAggregates,
  updateSourceHealth,
} from "@/lib/sentiment/store";
import type { ProviderSentiment } from "@/lib/sentiment/types";
import { FX_PAIRS } from "@/lib/sentiment/symbols";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const token = request.headers.get("x-admin-token") ?? "";
  const expectedToken = process.env.ADMIN_TOKEN ?? "";

  if (expectedToken && token !== expectedToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const providers = getAllProviders();
    const allSnapshots: ProviderSentiment[] = [];

    for (const provider of providers) {
      try {
        const available = await provider.isAvailable();
        if (!available) {
          console.log(`[Sentiment] ${provider.name} not available (missing credentials)`);
          await updateSourceHealth(provider.name, false, "Credentials not configured");
          continue;
        }

        const snapshots = await provider.fetchSentiment(Array.from(FX_PAIRS));
        allSnapshots.push(...snapshots);
        await updateSourceHealth(provider.name, true);
        console.log(`[Sentiment] ${provider.name} fetched ${snapshots.length} snapshots`);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        console.error(`[Sentiment] ${provider.name} failed:`, message);
        await updateSourceHealth(provider.name, false, message);
      }
    }

    if (allSnapshots.length === 0) {
      return NextResponse.json({
        ok: false,
        message: "No sentiment data collected from any provider",
      });
    }

    await appendSnapshots(allSnapshots);

    const previousAggregates = await getLatestAggregates();
    const newAggregates = aggregateSentiment(allSnapshots);
    const aggregatesWithFlips = detectFlips(newAggregates, previousAggregates);

    await appendAggregates(aggregatesWithFlips);

    return NextResponse.json({
      ok: true,
      snapshots_collected: allSnapshots.length,
      aggregates_computed: aggregatesWithFlips.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Sentiment refresh failed",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
