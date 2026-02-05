import { query, queryOne } from "@/lib/db";
import type { NewsEvent, NewsWeeklySnapshot } from "./types";

let ensured = false;

async function ensureNewsTables() {
  if (ensured) {
    return;
  }
  await query(`
    CREATE TABLE IF NOT EXISTS news_weekly_snapshots (
      id SERIAL PRIMARY KEY,
      week_open_utc TIMESTAMP NOT NULL,
      source VARCHAR(30) NOT NULL DEFAULT 'forexfactory',
      announcements JSONB NOT NULL DEFAULT '[]'::jsonb,
      calendar JSONB NOT NULL DEFAULT '[]'::jsonb,
      fetched_at TIMESTAMP NOT NULL DEFAULT NOW(),
      created_at TIMESTAMP DEFAULT NOW(),
      UNIQUE(week_open_utc, source)
    )
  `);
  await query(`
    CREATE INDEX IF NOT EXISTS idx_news_weekly_snapshots_week
      ON news_weekly_snapshots(week_open_utc DESC)
  `);
  ensured = true;
}

export async function writeNewsWeeklySnapshot(input: {
  week_open_utc: string;
  source: string;
  announcements: NewsEvent[];
  calendar: NewsEvent[];
}) {
  await ensureNewsTables();
  await query(
    `INSERT INTO news_weekly_snapshots
      (week_open_utc, source, announcements, calendar, fetched_at)
     VALUES ($1, $2, $3::jsonb, $4::jsonb, NOW())
     ON CONFLICT (week_open_utc, source)
     DO UPDATE SET
       announcements = EXCLUDED.announcements,
       calendar = EXCLUDED.calendar,
       fetched_at = NOW()`,
    [
      input.week_open_utc,
      input.source,
      JSON.stringify(input.announcements),
      JSON.stringify(input.calendar),
    ],
  );
}

export async function listNewsWeeks(limit = 52): Promise<string[]> {
  await ensureNewsTables();
  const rows = await query<{ week_open_utc: Date }>(
    `SELECT DISTINCT week_open_utc
     FROM news_weekly_snapshots
     ORDER BY week_open_utc DESC
     LIMIT $1`,
    [limit],
  );
  return rows.map((row) => row.week_open_utc.toISOString());
}

export async function readNewsWeeklySnapshot(
  weekOpenUtc?: string,
): Promise<NewsWeeklySnapshot | null> {
  await ensureNewsTables();
  const row = weekOpenUtc
    ? await queryOne<{
        week_open_utc: Date;
        source: string;
        announcements: NewsEvent[];
        calendar: NewsEvent[];
        fetched_at: Date;
      }>(
        `SELECT week_open_utc, source, announcements, calendar, fetched_at
         FROM news_weekly_snapshots
         WHERE week_open_utc = $1
         ORDER BY fetched_at DESC
         LIMIT 1`,
        [weekOpenUtc],
      )
    : await queryOne<{
        week_open_utc: Date;
        source: string;
        announcements: NewsEvent[];
        calendar: NewsEvent[];
        fetched_at: Date;
      }>(
        `SELECT week_open_utc, source, announcements, calendar, fetched_at
         FROM news_weekly_snapshots
         ORDER BY week_open_utc DESC, fetched_at DESC
         LIMIT 1`,
      );

  if (!row) {
    return null;
  }

  return {
    week_open_utc: row.week_open_utc.toISOString(),
    source: row.source,
    announcements: row.announcements ?? [],
    calendar: row.calendar ?? [],
    fetched_at: row.fetched_at.toISOString(),
  };
}
