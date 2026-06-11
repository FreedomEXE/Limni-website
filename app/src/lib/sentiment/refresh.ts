import { aggregateSentiment, detectFlips } from "./aggregate";
import { getAllProviders } from "./providers";
import {
  appendAggregates,
  appendSnapshots,
  getLatestAggregates,
  updateSourceHealth,
} from "./store";
import type { ProviderSentiment, SentimentAggregate } from "./types";
import { ALL_SENTIMENT_SYMBOLS } from "./symbols";
import { sendEmail } from "../notifications/email";

export type SentimentRefreshResult = {
  ok: boolean;
  snapshots: number;
  aggregates: number;
  flips: SentimentAggregate[];
  timestamp: string;
};

export async function refreshSentiment(): Promise<SentimentRefreshResult> {
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

      const snapshots = await provider.fetchSentiment(
        Array.from(ALL_SENTIMENT_SYMBOLS),
      );
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
    return {
      ok: false,
      snapshots: 0,
      aggregates: 0,
      flips: [],
      timestamp: new Date().toISOString(),
    };
  }

  await appendSnapshots(allSnapshots);

  const previousAggregates = await getLatestAggregates();
  const newAggregates = aggregateSentiment(allSnapshots);
  const aggregatesWithFlips = detectFlips(newAggregates, previousAggregates);

  await appendAggregates(aggregatesWithFlips);

  const flips = aggregatesWithFlips.filter((agg) => agg.flip_state !== "NONE");
  if (flips.length > 0) {
    const subject = `[Limni] Sentiment flips detected (${flips.length})`;
    const rows = flips
      .map((agg) => {
        return `<tr><td>${agg.symbol}</td><td>${agg.flip_state}</td><td>${agg.timestamp_utc}</td></tr>`;
      })
      .join("");
    const html = `
      <p>New sentiment flips detected:</p>
      <table border="1" cellpadding="6" cellspacing="0">
        <thead><tr><th>Symbol</th><th>Flip</th><th>Time (UTC)</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    `;
    await sendEmail({ to: "", subject, html });
  }

  return {
    ok: true,
    snapshots: allSnapshots.length,
    aggregates: aggregatesWithFlips.length,
    flips,
    timestamp: new Date().toISOString(),
  };
}
