import { DateTime } from "luxon";
import { query } from "../src/lib/db";
import { writePerformanceSnapshots, getWeekOpenUtc } from "../src/lib/performanceSnapshots";
import type { AssetClass } from "../src/lib/cotMarkets";
import type { ModelPerformance, PerformanceModel } from "../src/lib/performanceLab";

type Row = {
  week_open_utc: Date;
  asset_class: string;
  model: string;
  report_date: Date | null;
  percent: string;
  priced: number;
  total: number;
  note: string | null;
  returns: ModelPerformance["returns"] | null;
  pair_details: ModelPerformance["pair_details"] | null;
  stats: ModelPerformance["stats"] | null;
};

function canonicalWeekOpen(weekOpenUtc: Date) {
  const parsed = DateTime.fromJSDate(weekOpenUtc, { zone: "utc" }).setZone(
    "America/New_York",
  );
  if (!parsed.isValid) {
    return getWeekOpenUtc();
  }

  const weekday = parsed.weekday; // 1=Mon ... 7=Sun
  let monday = parsed;
  if (weekday === 7) {
    monday = parsed.plus({ days: 1 });
  } else {
    const daysSinceMonday = (weekday + 6) % 7;
    monday = parsed.minus({ days: daysSinceMonday });
  }

  const open = monday.set({ hour: 0, minute: 0, second: 0, millisecond: 0 });
  return open.toUTC().toISO() ?? getWeekOpenUtc();
}

function scoreRow(row: Row) {
  return (row.priced ?? 0) * 1000 + (row.total ?? 0);
}

async function main() {
  const rows = await query<Row>(
    `SELECT week_open_utc, asset_class, model, report_date, percent, priced, total, note, returns, pair_details, stats
     FROM performance_snapshots`,
  );

  if (rows.length === 0) {
    console.log("No performance snapshots to normalize.");
    return;
  }

  const merged = new Map<string, Row>();
  for (const row of rows) {
    const canonical = canonicalWeekOpen(row.week_open_utc);
    const key = `${canonical}::${row.asset_class}::${row.model}`;
    const existing = merged.get(key);
    if (!existing || scoreRow(row) > scoreRow(existing)) {
      merged.set(key, row);
    }
  }

  const payload = Array.from(merged.entries()).map(([key, row]) => {
    const [week_open_utc, asset_class, model] = key.split("::");
    return {
      week_open_utc,
      asset_class: asset_class as AssetClass,
      model: model as PerformanceModel,
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
    };
  });

  await query("DELETE FROM performance_snapshots");
  await writePerformanceSnapshots(payload);

  console.log(`Normalized ${rows.length} snapshots into ${payload.length} snapshots.`);
}

main().catch((error) => {
  console.error("Normalize failed:", error);
  process.exit(1);
});
