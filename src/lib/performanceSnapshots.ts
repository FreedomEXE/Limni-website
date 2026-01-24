import { DateTime } from "luxon";
import { query } from "./db";
import type { AssetClass } from "./cotMarkets";
import type { PerformanceModel, ModelPerformance } from "./performanceLab";

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
  const parsed = DateTime.fromISO(isoValue, { zone: "America/New_York" });
  if (!parsed.isValid) {
    return isoValue;
  }
  return parsed.toFormat("MMM dd, yyyy");
}

export function getWeekOpenUtc(now = DateTime.utc()): string {
  const nyNow = now.setZone("America/New_York");
  const daysSinceSunday = nyNow.weekday % 7;
  let sunday = nyNow.minus({ days: daysSinceSunday });

  if (daysSinceSunday === 0 && nyNow.hour < 17) {
    sunday = sunday.minus({ days: 7 });
  }

  const open = sunday.set({
    hour: 17,
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
  return expected === isoValue;
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
