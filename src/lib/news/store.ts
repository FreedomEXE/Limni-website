import { DateTime } from "luxon";
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
  const rows = await query<{ week_open_utc: string }>(
    `SELECT DISTINCT week_open_utc::text AS week_open_utc
     FROM news_weekly_snapshots
     ORDER BY week_open_utc DESC
     LIMIT $1`,
    [limit],
  );
  return rows
    .map((row) => normalizeTimestampText(row.week_open_utc))
    .filter((value): value is string => !!value);
}

function normalizeTimestampText(value: string | null | undefined) {
  const raw = (value ?? "").trim();
  if (!raw) return null;
  const parsed = DateTime.fromSQL(raw, { zone: "utc" });
  if (!parsed.isValid) {
    return null;
  }
  return parsed.toUTC().toISO();
}

export async function readNewsWeeklySnapshot(
  weekOpenUtc?: string,
): Promise<NewsWeeklySnapshot | null> {
  await ensureNewsTables();
  const row = weekOpenUtc
    ? await queryOne<{
        week_open_utc: string;
        source: string;
        announcements: NewsEvent[];
        calendar: NewsEvent[];
        fetched_at: string;
      }>(
        `SELECT week_open_utc::text AS week_open_utc, source, announcements, calendar, fetched_at::text AS fetched_at
         FROM news_weekly_snapshots
         WHERE week_open_utc = $1::timestamp
         ORDER BY fetched_at DESC
         LIMIT 1`,
        [weekOpenUtc],
      )
    : await queryOne<{
        week_open_utc: string;
        source: string;
        announcements: NewsEvent[];
        calendar: NewsEvent[];
        fetched_at: string;
      }>(
        `SELECT week_open_utc::text AS week_open_utc, source, announcements, calendar, fetched_at::text AS fetched_at
         FROM news_weekly_snapshots
         ORDER BY week_open_utc DESC, fetched_at DESC
         LIMIT 1`,
      );

  if (!row) {
    return null;
  }
  const weekOpenIso = normalizeTimestampText(row.week_open_utc);
  const fetchedAtIso = normalizeTimestampText(row.fetched_at);
  if (!weekOpenIso || !fetchedAtIso) {
    return null;
  }

  return {
    week_open_utc: weekOpenIso,
    source: row.source,
    announcements: row.announcements ?? [],
    calendar: row.calendar ?? [],
    fetched_at: fetchedAtIso,
  };
}
