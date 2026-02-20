import { DateTime } from "luxon";
import { query } from "./db";
import type { AssetClass } from "./cotMarkets";
import type { PerformanceModel, ModelPerformance } from "./performanceLab";
import { getConnectedAccount } from "./connectedAccounts";
import { deduplicateWeeks, type WeekOption } from "./weekState";
import { getCanonicalWeekOpenUtc, normalizeWeekOpenUtc } from "./weekAnchor";

const EXCLUDED_PERFORMANCE_WEEK_CANONICAL = new Set<string>([
  // No bot/live analytics existed for this week; exclude from all historical reporting.
  "2026-01-12T00:00:00.000Z",
]);

function isExcludedPerformanceWeek(weekOpenUtc: string): boolean {
  const canonical = normalizeWeekOpenUtc(weekOpenUtc) ?? weekOpenUtc;
  return EXCLUDED_PERFORMANCE_WEEK_CANONICAL.has(canonical);
}

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

function getEquivalentWeekOpenCandidates(weekOpenUtc: string): string[] {
  const parsed = DateTime.fromISO(weekOpenUtc, { zone: "utc" });
  if (!parsed.isValid) {
    return [weekOpenUtc];
  }
  const candidates = deduplicateWeeks([
    weekOpenUtc,
    getWeekOpenUtc(parsed),
    getLegacyWeekOpenUtc(parsed),
  ]);
  return candidates;
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
  const allowedSnapshots = snapshots.filter((snapshot) => !isExcludedPerformanceWeek(snapshot.week_open_utc));
  if (allowedSnapshots.length === 0) {
    return;
  }
  const values: string[] = [];
  const params: Array<string | number | null> = [];
  let index = 1;

  for (const snapshot of allowedSnapshots) {
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
  const safeLimit = Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : 52;
  const chunkSize = Math.max(safeLimit * 4, 32);
  const canonicalWeeks: string[] = [];
  const seenCanonicalWeeks = new Set<string>();
  let offset = 0;
  for (let pass = 0; pass < 8; pass++) {
    const rows = await query<{ week_open_utc: Date }>(
      "SELECT DISTINCT week_open_utc FROM performance_snapshots ORDER BY week_open_utc DESC LIMIT $1 OFFSET $2",
      [chunkSize, offset],
    );
    if (rows.length === 0) {
      break;
    }

    for (const row of rows) {
      const iso = row.week_open_utc.toISOString();
      const canonical = normalizeWeekOpenUtc(iso) ?? iso;
      if (isExcludedPerformanceWeek(canonical)) {
        continue;
      }
      if (!seenCanonicalWeeks.has(canonical)) {
        seenCanonicalWeeks.add(canonical);
        canonicalWeeks.push(canonical);
      }
    }

    if (canonicalWeeks.length >= safeLimit || rows.length < chunkSize) {
      break;
    }
    offset += rows.length;
  }

  return canonicalWeeks
    .sort((a, b) => DateTime.fromISO(b, { zone: "utc" }).toMillis() - DateTime.fromISO(a, { zone: "utc" }).toMillis())
    .slice(0, safeLimit);
}

function isBetterWeekSnapshotRow(
  current: {
    week_open_utc: Date;
    priced: number;
    total: number;
    report_date: Date | null;
  },
  next: {
    week_open_utc: Date;
    priced: number;
    total: number;
    report_date: Date | null;
  },
  requestedWeekOpenUtc: string,
): boolean {
  if (next.priced !== current.priced) {
    return next.priced > current.priced;
  }
  if (next.total !== current.total) {
    return next.total > current.total;
  }

  const currentIso = current.week_open_utc.toISOString();
  const nextIso = next.week_open_utc.toISOString();
  const currentExact = currentIso === requestedWeekOpenUtc;
  const nextExact = nextIso === requestedWeekOpenUtc;
  if (nextExact !== currentExact) {
    return nextExact;
  }

  const currentCanonical = normalizeWeekOpenUtc(currentIso) ?? currentIso;
  const nextCanonical = normalizeWeekOpenUtc(nextIso) ?? nextIso;
  const requestedCanonical = normalizeWeekOpenUtc(requestedWeekOpenUtc) ?? requestedWeekOpenUtc;
  const currentCanonicalMatch = currentCanonical === requestedCanonical;
  const nextCanonicalMatch = nextCanonical === requestedCanonical;
  if (nextCanonicalMatch !== currentCanonicalMatch) {
    return nextCanonicalMatch;
  }

  const currentReportMs = current.report_date
    ? DateTime.fromJSDate(current.report_date, { zone: "utc" }).toMillis()
    : Number.NEGATIVE_INFINITY;
  const nextReportMs = next.report_date
    ? DateTime.fromJSDate(next.report_date, { zone: "utc" }).toMillis()
    : Number.NEGATIVE_INFINITY;
  if (nextReportMs !== currentReportMs) {
    return nextReportMs > currentReportMs;
  }

  return next.week_open_utc.getTime() > current.week_open_utc.getTime();
}

export async function readPerformanceSnapshotsByWeek(weekOpenUtc: string) {
  if (isExcludedPerformanceWeek(weekOpenUtc)) {
    return [];
  }
  const candidates = getEquivalentWeekOpenCandidates(weekOpenUtc);
  const filteredCandidates = candidates.filter((candidate) => !isExcludedPerformanceWeek(candidate));
  if (filteredCandidates.length === 0) {
    return [];
  }
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
     WHERE week_open_utc = ANY($1::timestamptz[])
     ORDER BY asset_class, model`,
    [filteredCandidates],
  );

  const deduped = new Map<string, (typeof rows)[number]>();
  for (const row of rows) {
    const key = `${row.asset_class}:${row.model}`;
    const prev = deduped.get(key);
    if (!prev) {
      deduped.set(key, row);
      continue;
    }
    if (isBetterWeekSnapshotRow(prev, row, weekOpenUtc)) {
      deduped.set(key, row);
    }
  }

  return Array.from(deduped.values()).map((row) => ({
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
    report_date: Date | null;
    priced: number;
    total: number;
    percent: string;
  }>(
    `SELECT week_open_utc, asset_class, model, report_date, priced, total, percent
     FROM performance_snapshots
     ORDER BY week_open_utc DESC
     LIMIT $1`,
    [limit],
  );

  const mapped = rows
    .map((row) => ({
      week_open_utc: row.week_open_utc.toISOString(),
      asset_class: row.asset_class,
      model: row.model,
      report_date: row.report_date ? row.report_date.toISOString().slice(0, 10) : null,
      priced: row.priced,
      total: row.total,
      percent: Number(row.percent),
    }))
    .filter((row) => !isExcludedPerformanceWeek(row.week_open_utc));

  function canonicalWeekFromReportDate(reportDate: string | null): string | null {
    if (!reportDate) return null;
    const report = DateTime.fromISO(reportDate, { zone: "America/New_York" });
    if (!report.isValid) return null;
    const daysUntilSunday = (7 - (report.weekday % 7)) % 7;
    return report
      .plus({ days: daysUntilSunday })
      .set({ hour: 19, minute: 0, second: 0, millisecond: 0 })
      .toUTC()
      .toISO();
  }

  function isBetterRow(
    current: (typeof mapped)[number],
    next: (typeof mapped)[number],
  ): boolean {
    if (next.priced !== current.priced) return next.priced > current.priced;
    if (next.total !== current.total) return next.total > current.total;

    const canonical = canonicalWeekFromReportDate(next.report_date);
    if (canonical) {
      const canonicalMs = DateTime.fromISO(canonical, { zone: "utc" }).toMillis();
      const currentMs = DateTime.fromISO(current.week_open_utc, { zone: "utc" }).toMillis();
      const nextMs = DateTime.fromISO(next.week_open_utc, { zone: "utc" }).toMillis();
      const currentDist = Number.isFinite(currentMs) ? Math.abs(currentMs - canonicalMs) : Number.POSITIVE_INFINITY;
      const nextDist = Number.isFinite(nextMs) ? Math.abs(nextMs - canonicalMs) : Number.POSITIVE_INFINITY;
      if (nextDist !== currentDist) return nextDist < currentDist;
    }

    const currentWeekMs = DateTime.fromISO(current.week_open_utc, { zone: "utc" }).toMillis();
    const nextWeekMs = DateTime.fromISO(next.week_open_utc, { zone: "utc" }).toMillis();
    if (Number.isFinite(currentWeekMs) && Number.isFinite(nextWeekMs)) {
      return nextWeekMs > currentWeekMs;
    }

    return false;
  }

  const deduped = new Map<string, (typeof mapped)[number]>();
  for (const row of mapped) {
    const canonicalWeek = normalizeWeekOpenUtc(row.week_open_utc) ?? row.week_open_utc;
    const logicalWeekKey = row.report_date ? `report:${row.report_date}` : `week:${canonicalWeek}`;
    const key = `${row.asset_class}:${row.model}:${logicalWeekKey}`;
    const prev = deduped.get(key);
    if (!prev || isBetterRow(prev, row)) {
      deduped.set(key, row);
    }
  }

  return Array.from(deduped.values()).map((row) => ({
    week_open_utc: row.week_open_utc,
    asset_class: row.asset_class,
    model: row.model,
    report_date: row.report_date,
    percent: row.percent,
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

  return rows
    .map((row) => ({
      week_open_utc: row.week_open_utc.toISOString(),
      total_percent: Number(row.total_percent),
      rows: row.rows,
    }))
    .filter((row) => !isExcludedPerformanceWeek(row.week_open_utc));
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

    const historicalWeeks = rows
      .map((row) => row.week_open_utc.toISOString())
      .filter((week) => !isExcludedPerformanceWeek(week));

    // Always include current week
    const currentWeek = getWeekOpenUtc();

    // Combine and deduplicate using canonical week keys.
    const allWeeks = [currentWeek, ...historicalWeeks]
      .map((week) => normalizeWeekOpenUtc(week) ?? week);
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
