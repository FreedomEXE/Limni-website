import { query } from "../db";
import type {
  ProviderSentiment,
  SentimentAggregate,
  SourceHealth,
} from "./types";

export async function readSnapshots(): Promise<ProviderSentiment[]> {
  try {
    const rows = await query<{
      provider: string;
      symbol: string;
      long_pct: string;
      short_pct: string;
      timestamp_utc: Date;
    }>(
      `SELECT provider, symbol, long_pct, short_pct, timestamp_utc
       FROM sentiment_data
       WHERE timestamp_utc > NOW() - INTERVAL '24 hours'
       ORDER BY timestamp_utc DESC`
    );

    return rows.map((row) => {
      const longPct = Number(row.long_pct);
      const shortPct = Number(row.short_pct);
      return {
        provider: row.provider as ProviderSentiment["provider"],
        symbol: row.symbol,
        long_pct: longPct,
        short_pct: shortPct,
        net: longPct - shortPct,
        ratio: shortPct > 0 ? longPct / shortPct : 0,
        timestamp_utc: row.timestamp_utc.toISOString(),
      };
    });
  } catch (error) {
    console.error("Error reading sentiment snapshots:", error);
    throw error;
  }
}

export async function writeSnapshots(
  snapshots: ProviderSentiment[],
): Promise<void> {
  // Deprecated - use appendSnapshots instead
  await appendSnapshots(snapshots);
}

export async function appendSnapshots(
  newSnapshots: ProviderSentiment[],
): Promise<void> {
  try {
    for (const snapshot of newSnapshots) {
      await query(
        `INSERT INTO sentiment_data (provider, symbol, long_pct, short_pct, timestamp_utc)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          snapshot.provider,
          snapshot.symbol,
          snapshot.long_pct,
          snapshot.short_pct,
          new Date(snapshot.timestamp_utc),
        ]
      );
    }

    // Clean up old data (keep last 24 hours)
    await query(
      "DELETE FROM sentiment_data WHERE timestamp_utc < NOW() - INTERVAL '24 hours'"
    );
  } catch (error) {
    console.error("Error appending sentiment snapshots:", error);
    throw error;
  }
}

export async function readAggregates(): Promise<SentimentAggregate[]> {
  try {
    const rows = await query<{
      symbol: string;
      agg_long_pct: string;
      agg_short_pct: string;
      agg_net: string;
      sources_used: string[];
      confidence_score: string;
      crowding_state: string;
      flip_state: string;
      timestamp_utc: Date;
    }>(
      `SELECT symbol, agg_long_pct, agg_short_pct, agg_net, sources_used, confidence_score, crowding_state, flip_state, timestamp_utc
       FROM sentiment_aggregates
       WHERE timestamp_utc > NOW() - INTERVAL '7 days'
       ORDER BY timestamp_utc DESC`
    );

    return rows.map((row) => ({
      symbol: row.symbol,
      agg_long_pct: Number(row.agg_long_pct),
      agg_short_pct: Number(row.agg_short_pct),
      agg_net: Number(row.agg_net),
      sources_used: row.sources_used as ProviderSentiment["provider"][],
      confidence_score: Number(row.confidence_score),
      crowding_state: row.crowding_state as SentimentAggregate["crowding_state"],
      flip_state: row.flip_state as SentimentAggregate["flip_state"],
      timestamp_utc: row.timestamp_utc.toISOString(),
    }));
  } catch (error) {
    console.error("Error reading sentiment aggregates:", error);
    throw error;
  }
}

export async function writeAggregates(
  aggregates: SentimentAggregate[],
): Promise<void> {
  // Deprecated - use appendAggregates instead
  await appendAggregates(aggregates);
}

export async function appendAggregates(
  newAggregates: SentimentAggregate[],
): Promise<void> {
  try {
    for (const agg of newAggregates) {
      await query(
        `INSERT INTO sentiment_aggregates (symbol, agg_long_pct, agg_short_pct, agg_net, sources_used, confidence_score, crowding_state, flip_state, timestamp_utc)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          agg.symbol,
          agg.agg_long_pct,
          agg.agg_short_pct,
          agg.agg_net,
          agg.sources_used,
          agg.confidence_score,
          agg.crowding_state,
          agg.flip_state,
          new Date(agg.timestamp_utc),
        ]
      );
    }

    // Clean up old data (keep last 7 days)
    await query(
      "DELETE FROM sentiment_aggregates WHERE timestamp_utc < NOW() - INTERVAL '7 days'"
    );
  } catch (error) {
    console.error("Error appending sentiment aggregates:", error);
    throw error;
  }
}

export async function getLatestAggregates(): Promise<SentimentAggregate[]> {
  try {
    const rows = await query<{
      symbol: string;
      agg_long_pct: string;
      agg_short_pct: string;
      agg_net: string;
      sources_used: string[];
      confidence_score: string;
      crowding_state: string;
      flip_state: string;
      timestamp_utc: Date;
    }>(
      `SELECT DISTINCT ON (symbol)
         symbol, agg_long_pct, agg_short_pct, agg_net, sources_used, confidence_score, crowding_state, flip_state, timestamp_utc
       FROM sentiment_aggregates
       ORDER BY symbol, timestamp_utc DESC`
    );

    return rows.map((row) => ({
      symbol: row.symbol,
      agg_long_pct: Number(row.agg_long_pct),
      agg_short_pct: Number(row.agg_short_pct),
      agg_net: Number(row.agg_net),
      sources_used: row.sources_used as ProviderSentiment["provider"][],
      confidence_score: Number(row.confidence_score),
      crowding_state: row.crowding_state as SentimentAggregate["crowding_state"],
      flip_state: row.flip_state as SentimentAggregate["flip_state"],
      timestamp_utc: row.timestamp_utc.toISOString(),
    }));
  } catch (error) {
    console.error("Error getting latest sentiment aggregates:", error);
    throw error;
  }
}

export async function readSourceHealth(): Promise<SourceHealth[]> {
  // For now, return empty array - source health tracking not yet implemented in DB
  // TODO: Add sentiment_source_health table and implement this
  return [];
}

export async function writeSourceHealth(
  sources: SourceHealth[],
): Promise<void> {
  // For now, no-op - source health tracking not yet implemented in DB
  // TODO: Add sentiment_source_health table and implement this
  console.log("writeSourceHealth not yet implemented for PostgreSQL");
}

export async function updateSourceHealth(
  name: string,
  success: boolean,
  error?: string,
): Promise<void> {
  // For now, no-op - source health tracking not yet implemented in DB
  // TODO: Add sentiment_source_health table and implement this
  console.log("updateSourceHealth not yet implemented for PostgreSQL");
}
