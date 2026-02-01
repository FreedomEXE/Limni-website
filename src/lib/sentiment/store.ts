import { query } from "../db";
import { DateTime } from "luxon";
import { getWeekOpenUtc } from "../performanceSnapshots";
import type {
  ProviderSentiment,
  SentimentAggregate,
  SourceHealth,
} from "./types";

export async function readSnapshots(): Promise<ProviderSentiment[]> {
  try {
    const retentionHours = Number(process.env.SENTIMENT_SNAPSHOT_RETENTION_HOURS ?? "24");
    const hours = Number.isFinite(retentionHours) && retentionHours > 0 ? retentionHours : 24;
    const rows = await query<{
      provider: string;
      symbol: string;
      long_pct: string;
      short_pct: string;
      timestamp_utc: Date;
    }>(
      `SELECT provider, symbol, long_pct, short_pct, timestamp_utc
       FROM sentiment_data
       WHERE timestamp_utc > NOW() - INTERVAL '${hours} hours'
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

    const retentionHours = Number(process.env.SENTIMENT_SNAPSHOT_RETENTION_HOURS ?? "24");
    const hours = Number.isFinite(retentionHours) && retentionHours > 0 ? retentionHours : 24;
    // Clean up old data
    await query(
      `DELETE FROM sentiment_data WHERE timestamp_utc < NOW() - INTERVAL '${hours} hours'`
    );
  } catch (error) {
    console.error("Error appending sentiment snapshots:", error);
    throw error;
  }
}

export async function readAggregates(): Promise<SentimentAggregate[]> {
  try {
    const retentionDays = Number(process.env.SENTIMENT_RETENTION_DAYS ?? "365");
    const days = Number.isFinite(retentionDays) && retentionDays > 0 ? retentionDays : 365;
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
       WHERE timestamp_utc > NOW() - INTERVAL '${days} days'
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

    const retentionDays = Number(process.env.SENTIMENT_RETENTION_DAYS ?? "365");
    const days = Number.isFinite(retentionDays) && retentionDays > 0 ? retentionDays : 365;
    // Clean up old data
    await query(
      `DELETE FROM sentiment_aggregates WHERE timestamp_utc < NOW() - INTERVAL '${days} days'`
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

export async function getLatestAggregatesLocked(): Promise<SentimentAggregate[]> {
  const aggregates = await readAggregates();
  if (aggregates.length === 0) {
    return [];
  }

  const weekOpenUtc = getWeekOpenUtc();
  const weekOpen = DateTime.fromISO(weekOpenUtc, { zone: "utc" });
  const weekOpenMs = weekOpen.isValid ? weekOpen.toMillis() : Date.now();

  const bySymbol = new Map<string, SentimentAggregate[]>();
  for (const agg of aggregates) {
    if (!bySymbol.has(agg.symbol)) {
      bySymbol.set(agg.symbol, []);
    }
    bySymbol.get(agg.symbol)?.push(agg);
  }

  const locked: SentimentAggregate[] = [];
  for (const [symbol, list] of bySymbol.entries()) {
    const sorted = list
      .map((agg) => ({
        agg,
        ts: DateTime.fromISO(agg.timestamp_utc, { zone: "utc" }),
      }))
      .filter((entry) => entry.ts.isValid)
      .sort((a, b) => a.ts.toMillis() - b.ts.toMillis());

    if (sorted.length === 0) {
      continue;
    }

    const latest = sorted[sorted.length - 1].agg;
    const firstFlip = sorted.find(
      (entry) =>
        entry.ts.toMillis() >= weekOpenMs && entry.agg.flip_state !== "NONE",
    );

    if (firstFlip) {
      locked.push({
        ...latest,
        crowding_state: "NEUTRAL",
        flip_state: "FLIPPED_NEUTRAL",
        timestamp_utc: firstFlip.agg.timestamp_utc,
      });
    } else {
      locked.push(latest);
    }
  }

  return locked;
}

export async function getAggregatesForWeekLocked(
  weekOpenUtc: string,
): Promise<SentimentAggregate[]> {
  const aggregates = await readAggregates();
  if (aggregates.length === 0) {
    return [];
  }

  const weekOpen = DateTime.fromISO(weekOpenUtc, { zone: "utc" });
  if (!weekOpen.isValid) {
    return [];
  }
  const weekClose = weekOpen.plus({ days: 5, hours: 23, minutes: 59, seconds: 59 });
  const openMs = weekOpen.toMillis();
  const closeMs = weekClose.toMillis();

  const bySymbol = new Map<string, { agg: SentimentAggregate; time: DateTime }[]>();
  for (const agg of aggregates) {
    const time = DateTime.fromISO(agg.timestamp_utc, { zone: "utc" });
    if (!time.isValid || time.toMillis() > closeMs) {
      continue;
    }
    if (!bySymbol.has(agg.symbol)) {
      bySymbol.set(agg.symbol, []);
    }
    bySymbol.get(agg.symbol)?.push({ agg, time });
  }

  const locked: SentimentAggregate[] = [];
  for (const [symbol, list] of bySymbol.entries()) {
    const sorted = list.sort((a, b) => a.time.toMillis() - b.time.toMillis());
    if (sorted.length === 0) {
      continue;
    }
    const latest = sorted[sorted.length - 1].agg;
    const firstFlip = sorted.find(
      (entry) => entry.time.toMillis() >= openMs && entry.agg.flip_state !== "NONE",
    );
    if (firstFlip) {
      locked.push({
        ...latest,
        crowding_state: "NEUTRAL",
        flip_state: "FLIPPED_NEUTRAL",
        timestamp_utc: firstFlip.agg.timestamp_utc,
      });
    } else {
      locked.push(latest);
    }
  }

  return locked;
}

export async function getAggregatesAsOf(
  asOfUtc: string,
): Promise<SentimentAggregate[]> {
  const aggregates = await readAggregates();
  if (aggregates.length === 0) {
    return [];
  }
  const asOf = DateTime.fromISO(asOfUtc, { zone: "utc" });
  if (!asOf.isValid) {
    return [];
  }
  const cutoff = asOf.toMillis();
  const bySymbol = new Map<string, { agg: SentimentAggregate; time: DateTime }[]>();

  for (const agg of aggregates) {
    const time = DateTime.fromISO(agg.timestamp_utc, { zone: "utc" });
    if (!time.isValid || time.toMillis() > cutoff) {
      continue;
    }
    if (!bySymbol.has(agg.symbol)) {
      bySymbol.set(agg.symbol, []);
    }
    bySymbol.get(agg.symbol)?.push({ agg, time });
  }

  const snapshot: SentimentAggregate[] = [];
  for (const [symbol, list] of bySymbol.entries()) {
    const sorted = list.sort((a, b) => a.time.toMillis() - b.time.toMillis());
    const latest = sorted.at(-1);
    if (!latest) {
      continue;
    }
    snapshot.push(latest.agg);
  }

  return snapshot;
}

export async function getAggregatesForWeekStart(
  weekOpenUtc: string,
  weekCloseUtc: string,
): Promise<SentimentAggregate[]> {
  const aggregates = await readAggregates();
  if (aggregates.length === 0) {
    return [];
  }
  const open = DateTime.fromISO(weekOpenUtc, { zone: "utc" });
  const close = DateTime.fromISO(weekCloseUtc, { zone: "utc" });
  if (!open.isValid) {
    return [];
  }
  const openMs = open.toMillis();
  const closeMs = close.isValid ? close.toMillis() : openMs;
  const bySymbol = new Map<string, { agg: SentimentAggregate; time: DateTime }[]>();

  for (const agg of aggregates) {
    const time = DateTime.fromISO(agg.timestamp_utc, { zone: "utc" });
    if (!time.isValid || time.toMillis() > closeMs) {
      continue;
    }
    if (!bySymbol.has(agg.symbol)) {
      bySymbol.set(agg.symbol, []);
    }
    bySymbol.get(agg.symbol)?.push({ agg, time });
  }

  const snapshot: SentimentAggregate[] = [];
  for (const [symbol, list] of bySymbol.entries()) {
    const sorted = list.sort((a, b) => a.time.toMillis() - b.time.toMillis());
    if (sorted.length === 0) {
      continue;
    }
    const firstAfterOpen = sorted.find((entry) => entry.time.toMillis() >= openMs);
    if (firstAfterOpen) {
      snapshot.push(firstAfterOpen.agg);
      continue;
    }
    const latestBeforeOpen = sorted.at(-1);
    if (latestBeforeOpen) {
      snapshot.push(latestBeforeOpen.agg);
    }
  }

  return snapshot;
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
