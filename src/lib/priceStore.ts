import { query, queryOne } from "./db";

export type PairPerformance = {
  open: number;
  current: number;
  percent: number;
  pips: number;
  open_time_utc: string;
  current_time_utc: string;
};

export type MarketSnapshot = {
  week_open_utc: string;
  last_refresh_utc: string;
  pairs: Record<string, PairPerformance | null>;
};

export async function readMarketSnapshot(): Promise<MarketSnapshot | null> {
  try {
    const row = await queryOne<{
      week_open_utc: Date;
      last_refresh_utc: Date;
      pairs: Record<string, PairPerformance | null>;
    }>(
      "SELECT week_open_utc, last_refresh_utc, pairs FROM market_snapshots ORDER BY week_open_utc DESC LIMIT 1"
    );

    if (!row) {
      return null;
    }

    return {
      week_open_utc: row.week_open_utc.toISOString(),
      last_refresh_utc: row.last_refresh_utc.toISOString(),
      pairs: row.pairs,
    };
  } catch (error) {
    console.error("Error reading market snapshot from database:", error);
    throw error;
  }
}

export async function writeMarketSnapshot(
  snapshot: MarketSnapshot,
): Promise<void> {
  try {
    const weekOpen = new Date(snapshot.week_open_utc);
    const existing = await queryOne<{ id: number }>(
      "SELECT id FROM market_snapshots WHERE week_open_utc = $1 LIMIT 1",
      [weekOpen],
    );

    if (existing?.id) {
      await query(
        `UPDATE market_snapshots
         SET last_refresh_utc = $1,
             pairs = $2
         WHERE id = $3`,
        [
          new Date(snapshot.last_refresh_utc),
          JSON.stringify(snapshot.pairs),
          existing.id,
        ],
      );
    } else {
      await query(
        `INSERT INTO market_snapshots (week_open_utc, last_refresh_utc, pairs)
         VALUES ($1, $2, $3)`,
        [
          weekOpen,
          new Date(snapshot.last_refresh_utc),
          JSON.stringify(snapshot.pairs),
        ],
      );
    }
  } catch (error) {
    console.error("Error writing market snapshot to database:", error);
    throw error;
  }
}
