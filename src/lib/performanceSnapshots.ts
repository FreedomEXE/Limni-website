import { DateTime } from "luxon";
import { query } from "./db";
import type { AssetClass } from "./cotMarkets";
import type { PerformanceModel, ModelPerformance } from "./performanceLab";
import { getConnectedAccount } from "./connectedAccounts";
import { deduplicateWeeks, type WeekOption } from "./weekState";
import { getCanonicalWeekOpenUtc } from "./weekAnchor";

export type PerformanceSnapshot = {
  week_open_utc: string;
  asset_class: AssetClass;
  model: PerformanceModel;
  report_date: string | null;
  percent: number;
  priced: number;
  total: number;
  note: string;
  returns: ModelPerformance["returns"];
  pair_details: ModelPerformance["pair_details"];
  stats: ModelPerformance["stats"];
};

function formatWeekLabel(isoValue: string) {
  const parsed = DateTime.fromISO(isoValue, { zone: "utc" }).setZone("America/New_York");
  if (!parsed.isValid) {
    return isoValue;
  }
  // Internal key is Sunday 19:00 ET open; display label as Monday date for clarity.
  const mondayLabelDate =
    parsed.weekday === 7
      ? parsed.plus({ days: 1 }).startOf("day")
      : parsed.weekday === 1
        ? parsed.startOf("day") // legacy Monday-based key support
        : parsed.startOf("day");
  return mondayLabelDate.toFormat("MMM dd, yyyy");
}

export function getWeekOpenUtc(now = DateTime.utc()): string {
  return getCanonicalWeekOpenUtc(now);
}

function getLegacyWeekOpenUtc(now = DateTime.utc()): string {
  const nyNow = now.setZone("America/New_York");
  const weekday = nyNow.weekday; // 1=Mon ... 7=Sun
  let monday = nyNow;
  if (weekday === 7) {
    monday = nyNow.plus({ days: 1 });
  } else {
    const daysSinceMonday = (weekday + 6) % 7;
    monday = nyNow.minus({ days: daysSinceMonday });
  }

  const open = monday.set({
    hour: 0,
    minute: 0,
    second: 0,
    millisecond: 0,
  });

  return open.toUTC().toISO() ?? new Date().toISOString();
}

export function weekLabelFromOpen(isoValue: string) {
  return `Week of ${formatWeekLabel(isoValue)}`;
}

export function isWeekOpenUtc(isoValue: string) {
  const parsed = DateTime.fromISO(isoValue, { zone: "utc" });
  if (!parsed.isValid) {
    return false;
  }
  const expected = getWeekOpenUtc(parsed);
  const legacyExpected = getLegacyWeekOpenUtc(parsed);
  return expected === isoValue || legacyExpected === isoValue;
}

export async function writePerformanceSnapshots(
  snapshots: PerformanceSnapshot[],
): Promise<void> {
  if (snapshots.length === 0) {
    return;
  }
  const values: string[] = [];
  const params: Array<string | number | null> = [];
  let index = 1;

  for (const snapshot of snapshots) {
    values.push(
      `($${index}, $${index + 1}, $${index + 2}, $${index + 3}, $${index + 4}, $${index + 5}, $${index + 6}, $${index + 7}, $${index + 8}, $${index + 9}, $${index + 10})`,
    );
    params.push(
      snapshot.week_open_utc,
      snapshot.asset_class,
      snapshot.model,
      snapshot.report_date,
      snapshot.percent,
      snapshot.priced,
      snapshot.total,
      snapshot.note,
      JSON.stringify(snapshot.returns),
      JSON.stringify(snapshot.pair_details),
      JSON.stringify(snapshot.stats),
    );
    index += 11;
  }

  await query(
    `INSERT INTO performance_snapshots
      (week_open_utc, asset_class, model, report_date, percent, priced, total, note, returns, pair_details, stats)
     VALUES ${values.join(", ")}
     ON CONFLICT (week_open_utc, asset_class, model)
     DO UPDATE SET
       report_date = EXCLUDED.report_date,
       percent = EXCLUDED.percent,
       priced = EXCLUDED.priced,
       total = EXCLUDED.total,
       note = EXCLUDED.note,
       returns = EXCLUDED.returns,
       pair_details = EXCLUDED.pair_details,
       stats = EXCLUDED.stats`,
    params,
  );
}

export async function listPerformanceWeeks(limit = 52): Promise<string[]> {
  const rows = await query<{ week_open_utc: Date }>(
    "SELECT DISTINCT week_open_utc FROM performance_snapshots ORDER BY week_open_utc DESC LIMIT $1",
    [limit],
  );
  return rows.map((row) => row.week_open_utc.toISOString());
}

export async function readPerformanceSnapshotsByWeek(weekOpenUtc: string) {
  const rows = await query<{
    week_open_utc: Date;
    asset_class: AssetClass;
    model: PerformanceModel;
    report_date: Date | null;
    percent: string;
    priced: number;
    total: number;
    note: string | null;
    returns: ModelPerformance["returns"];
    pair_details: ModelPerformance["pair_details"];
    stats: ModelPerformance["stats"];
  }>(
    `SELECT week_open_utc, asset_class, model, report_date, percent, priced, total, note, returns, pair_details, stats
     FROM performance_snapshots
     WHERE week_open_utc = $1
     ORDER BY asset_class, model`,
    [weekOpenUtc],
  );

  return rows.map((row) => ({
    week_open_utc: row.week_open_utc.toISOString(),
    asset_class: row.asset_class,
    model: row.model,
    report_date: row.report_date ? row.report_date.toISOString().slice(0, 10) : null,
    percent: Number(row.percent),
    priced: row.priced,
    total: row.total,
    note: row.note ?? "",
    returns: row.returns ?? [],
    pair_details: row.pair_details ?? [],
    stats: row.stats ?? {
      avg_return: 0,
      median_return: 0,
      win_rate: 0,
      volatility: 0,
      best_pair: null,
      worst_pair: null,
    },
  }));
}

export async function readAllPerformanceSnapshots(limit = 520) {
  const rows = await query<{
    week_open_utc: Date;
    asset_class: AssetClass;
    model: PerformanceModel;
    percent: string;
  }>(
    `SELECT week_open_utc, asset_class, model, percent
     FROM performance_snapshots
     ORDER BY week_open_utc DESC
     LIMIT $1`,
    [limit],
  );

  return rows.map((row) => ({
    week_open_utc: row.week_open_utc.toISOString(),
    asset_class: row.asset_class,
    model: row.model,
    percent: Number(row.percent),
  }));
}

export async function readUniversalWeeklyTotals(limit = 104): Promise<
  Array<{
    week_open_utc: string;
    total_percent: number;
    rows: number;
  }>
> {
  const rows = await query<{
    week_open_utc: Date;
    total_percent: string;
    rows: number;
  }>(
    `SELECT
       week_open_utc,
       SUM(percent) AS total_percent,
       COUNT(*)::int AS rows
     FROM performance_snapshots
     GROUP BY week_open_utc
     ORDER BY week_open_utc DESC
     LIMIT $1`,
    [limit],
  );

  return rows.map((row) => ({
    week_open_utc: row.week_open_utc.toISOString(),
    total_percent: Number(row.total_percent),
    rows: row.rows,
  }));
}

/**
 * Get list of weeks filtered by account creation date
 * Only returns weeks that occurred after the account was connected
 *
 * @param accountKey - The connected account key
 * @param limit - Maximum number of weeks to return (default: 4)
 * @returns Array of week ISO strings, sorted newest first
 */
export async function listWeeksForAccount(
  accountKey: string,
  limit: number = 4
): Promise<string[]> {
  try {
    // Get account creation date
    const account = await getConnectedAccount(accountKey);
    if (!account) {
      const currentWeek = getWeekOpenUtc();
      return deduplicateWeeks([currentWeek]).slice(0, limit);
    }
    const createdAt = DateTime.fromISO(account.created_at, { zone: "utc" });

    if (!createdAt.isValid) {
      console.error(`Invalid account creation date for ${accountKey}`);
      return [];
    }

    // Query weeks starting from the week the account was connected (not strictly after the timestamp),
    // so users can view the partial week that includes the connection date.
    const createdWeekOpenUtc = getWeekOpenUtc(createdAt);
    const createdWeekOpenDt = DateTime.fromISO(createdWeekOpenUtc, { zone: "utc" });
    const createdWeekOpen = createdWeekOpenDt.isValid ? createdWeekOpenDt.toJSDate() : createdAt.toJSDate();

    // Query weeks on/after the connection week open
    const rows = await query<{ week_open_utc: Date }>(
      `SELECT DISTINCT week_open_utc
       FROM performance_snapshots
       WHERE week_open_utc >= $1
       ORDER BY week_open_utc DESC
       LIMIT $2`,
      [createdWeekOpen, limit]
    );

    const historicalWeeks = rows.map((row) => row.week_open_utc.toISOString());

    // Always include current week
    const currentWeek = getWeekOpenUtc();

    // Combine and deduplicate
    const allWeeks = [currentWeek, ...historicalWeeks];
    return deduplicateWeeks(allWeeks).slice(0, limit);
  } catch (error) {
    console.error(`Failed to list weeks for account ${accountKey}:`, error);
    // Fallback to current week only
    return [getWeekOpenUtc()];
  }
}

/**
 * Get week options for account, optionally including "all" for all-time view
 *
 * @param accountKey - The connected account key
 * @param includeAll - Whether to include "all" option (default: true)
 * @param limit - Maximum number of weeks to return (default: 4)
 * @returns Array of week options including "all" if requested
 */
export async function listWeekOptionsForAccount(
  accountKey: string,
  includeAll: boolean = true,
  limit: number = 4
): Promise<WeekOption[]> {
  const weeks = await listWeeksForAccount(accountKey, limit);
  return includeAll ? ["all", ...weeks] : weeks;
}
