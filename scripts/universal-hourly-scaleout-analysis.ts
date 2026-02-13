import fs from "node:fs";
import path from "node:path";
import { DateTime } from "luxon";
import { buildUniversalBasketSummary, type UniversalWeekSimulation } from "../src/lib/universalBasket";
import { getCanonicalWeekOpenUtc } from "../src/lib/weekAnchor";

type EquityPoint = {
  ts_utc: string;
  equity_pct: number;
  lock_pct: number | null;
};

type WeekComparison = {
  week_open_utc: string;
  week_label: string;
  baseline_close_pct: number;
  baseline_peak_pct: number;
  baseline_low_pct: number;
  baseline_intrawork_dd_pct: number;
  schedule_close_pct: number;
  schedule_peak_pct: number;
  schedule_low_pct: number;
  schedule_intrawork_dd_pct: number;
  delta_close_pct: number;
};

function loadDotEnv() {
  const cwd = process.cwd();
  for (const filename of [".env.local", ".env"]) {
    const filePath = path.join(cwd, filename);
    if (!fs.existsSync(filePath)) continue;
    const content = fs.readFileSync(filePath, "utf8");
    for (const rawLine of content.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) continue;
      const idx = line.indexOf("=");
      if (idx <= 0) continue;
      const key = line.slice(0, idx).trim();
      let value = line.slice(idx + 1).trim();
      if (
        (value.startsWith("\"") && value.endsWith("\"")) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (!process.env[key]) process.env[key] = value;
    }
  }
}

function fmt(v: number, d = 2) {
  return Number(v.toFixed(d));
}

function toCanonicalWeekOpen(iso: string) {
  const dt = DateTime.fromISO(iso, { zone: "utc" });
  return dt.isValid ? getCanonicalWeekOpenUtc(dt) : iso;
}

function dedupeWeeks(rows: UniversalWeekSimulation[]) {
  const byCanonical = new Map<string, UniversalWeekSimulation>();
  for (const row of rows) {
    const canonical = toCanonicalWeekOpen(row.week_open_utc);
    const current = byCanonical.get(canonical);
    if (!current) {
      byCanonical.set(canonical, { ...row, week_open_utc: canonical });
      continue;
    }
    const currentScore = current.priced_symbols * 1000 + current.legs;
    const nextScore = row.priced_symbols * 1000 + row.legs;
    if (nextScore > currentScore) {
      byCanonical.set(canonical, { ...row, week_open_utc: canonical });
    }
  }
  return Array.from(byCanonical.values()).sort(
    (a, b) => Date.parse(a.week_open_utc) - Date.parse(b.week_open_utc),
  );
}

function computeCurveStats(points: EquityPoint[]) {
  if (points.length === 0) {
    return { close: 0, peak: 0, low: 0, maxDd: 0 };
  }
  let close = 0;
  let peak = Number.NEGATIVE_INFINITY;
  let low = Number.POSITIVE_INFINITY;
  let rollingPeak = Number.NEGATIVE_INFINITY;
  let maxDd = 0;
  for (const point of points) {
    const eq = Number(point.equity_pct);
    if (!Number.isFinite(eq)) continue;
    close = eq;
    if (eq > peak) peak = eq;
    if (eq < low) low = eq;
    if (eq > rollingPeak) rollingPeak = eq;
    const dd = rollingPeak - eq;
    if (dd > maxDd) maxDd = dd;
  }
  if (!Number.isFinite(peak)) peak = close;
  if (!Number.isFinite(low)) low = close;
  return { close, peak, low, maxDd };
}

// Rule requested:
// - Start Sunday 20:00 ET.
// - Close 1% of original basket every hour.
// - Active each day from 20:00 ET through 15:00 ET (20 closes/day).
// - Pause 16:00-19:59 ET (4 hours/day).
// - Continue through Friday 15:00 ET.
function buildHourlyScaleoutEvents(weekOpenUtc: string) {
  const weekOpen = DateTime.fromISO(weekOpenUtc, { zone: "utc" });
  if (!weekOpen.isValid) return [] as number[];
  const sundayEt = weekOpen.setZone("America/New_York").startOf("day");
  const events: number[] = [];

  for (let d = 0; d <= 4; d += 1) {
    const dayStartEt = sundayEt.plus({ days: d });
    // 20:00-23:00 ET
    for (let h = 20; h <= 23; h += 1) {
      events.push(dayStartEt.set({ hour: h, minute: 0, second: 0, millisecond: 0 }).toUTC().toMillis());
    }
    // Next day 00:00-15:00 ET
    const nextDayEt = sundayEt.plus({ days: d + 1 });
    for (let h = 0; h <= 15; h += 1) {
      events.push(nextDayEt.set({ hour: h, minute: 0, second: 0, millisecond: 0 }).toUTC().toMillis());
    }
  }
  // By construction: 5 * 20 = 100 events.
  return events.sort((a, b) => a - b);
}

function simulateHourlyScaleout(points: EquityPoint[], weekOpenUtc: string, hourlyClosePct = 1) {
  const sorted = [...points].sort((a, b) => Date.parse(a.ts_utc) - Date.parse(b.ts_utc));
  if (sorted.length === 0) {
    return [] as EquityPoint[];
  }

  const events = buildHourlyScaleoutEvents(weekOpenUtc);
  let eventIndex = 0;
  let remaining = 1.0;
  const closeFraction = Math.max(0, Math.min(1, hourlyClosePct / 100));

  let prevEq = Number(sorted[0].equity_pct);
  if (!Number.isFinite(prevEq)) prevEq = 0;
  let scaledEq = prevEq;
  const out: EquityPoint[] = [
    { ts_utc: sorted[0].ts_utc, equity_pct: scaledEq, lock_pct: null },
  ];

  for (let i = 1; i < sorted.length; i += 1) {
    const point = sorted[i];
    const ts = Date.parse(point.ts_utc);
    while (eventIndex < events.length && ts >= events[eventIndex]) {
      remaining = Math.max(0, remaining - closeFraction);
      eventIndex += 1;
    }
    const eq = Number(point.equity_pct);
    if (!Number.isFinite(eq)) continue;
    const delta = eq - prevEq;
    scaledEq += delta * remaining;
    prevEq = eq;
    out.push({ ts_utc: point.ts_utc, equity_pct: scaledEq, lock_pct: null });
  }

  return out;
}

async function main() {
  loadDotEnv();

  const timeframe = (process.env.TRUTH_TIMEFRAME ?? "H1") as "M1" | "H1";
  const includeCurrentWeek = (process.env.TRUTH_INCLUDE_CURRENT_WEEK ?? "true").toLowerCase() !== "false";
  const weeks = Number(process.env.TRUTH_WEEKS ?? 12);
  const startWeekInput = process.env.TRUTH_START_WEEK ?? "2026-01-19T00:00:00Z";
  const startWeekUtc = toCanonicalWeekOpen(startWeekInput);
  const startMs = Date.parse(startWeekUtc);
  const hourlyClosePct = Number(process.env.HOURLY_SCALEOUT_CLOSE_PCT ?? 1);

  const universal = await buildUniversalBasketSummary({
    timeframe,
    includeCurrentWeek,
    limitWeeks: weeks,
  });

  const byWeek = dedupeWeeks(universal.by_week).filter((w) => Date.parse(w.week_open_utc) >= startMs);
  const comparisons: WeekComparison[] = [];
  for (const week of byWeek) {
    const baselineStats = computeCurveStats(week.equity_curve);
    const scheduledCurve = simulateHourlyScaleout(week.equity_curve, week.week_open_utc, hourlyClosePct);
    const scheduledStats = computeCurveStats(scheduledCurve);
    comparisons.push({
      week_open_utc: week.week_open_utc,
      week_label: week.week_label,
      baseline_close_pct: fmt(baselineStats.close),
      baseline_peak_pct: fmt(baselineStats.peak),
      baseline_low_pct: fmt(baselineStats.low),
      baseline_intrawork_dd_pct: fmt(baselineStats.maxDd),
      schedule_close_pct: fmt(scheduledStats.close),
      schedule_peak_pct: fmt(scheduledStats.peak),
      schedule_low_pct: fmt(scheduledStats.low),
      schedule_intrawork_dd_pct: fmt(scheduledStats.maxDd),
      delta_close_pct: fmt(scheduledStats.close - baselineStats.close),
    });
  }

  const totals = comparisons.reduce(
    (acc, w) => {
      acc.base += w.baseline_close_pct;
      acc.schedule += w.schedule_close_pct;
      acc.baseDd += w.baseline_intrawork_dd_pct;
      acc.scheduleDd += w.schedule_intrawork_dd_pct;
      return acc;
    },
    { base: 0, schedule: 0, baseDd: 0, scheduleDd: 0 },
  );
  const count = Math.max(1, comparisons.length);

  const summary = {
    generated_at: DateTime.utc().toISO(),
    assumptions: {
      timeframe,
      includeCurrentWeek,
      weeks,
      start_week_utc: startWeekUtc,
      rule: "Close 1% hourly from 20:00 ET to 15:00 ET; pause 16:00-19:59 ET; Sunday->Friday",
      hourly_close_pct_of_original: hourlyClosePct,
      closes_per_week_target: 100,
    },
    aggregate: {
      baseline_total_close_pct: fmt(totals.base),
      schedule_total_close_pct: fmt(totals.schedule),
      total_close_delta_pct: fmt(totals.schedule - totals.base),
      baseline_avg_intrawork_dd_pct: fmt(totals.baseDd / count),
      schedule_avg_intrawork_dd_pct: fmt(totals.scheduleDd / count),
      avg_intrawork_dd_delta_pct: fmt((totals.scheduleDd - totals.baseDd) / count),
    },
    by_week: comparisons,
  };

  const stamp = DateTime.utc().toFormat("yyyy-LL-dd");
  const jsonPath = `reports/universal-hourly-scaleout-analysis-${stamp}.json`;
  const mdPath = `reports/universal-hourly-scaleout-analysis-${stamp}.md`;
  const latestJsonPath = "reports/universal-hourly-scaleout-analysis-latest.json";
  const latestMdPath = "reports/universal-hourly-scaleout-analysis-latest.md";
  fs.writeFileSync(jsonPath, JSON.stringify(summary, null, 2), "utf8");
  fs.writeFileSync(latestJsonPath, JSON.stringify(summary, null, 2), "utf8");

  const md: string[] = [];
  md.push("# Universal Hourly Scaleout Analysis");
  md.push("");
  md.push(`Generated: ${summary.generated_at}`);
  md.push("Rule: close 1% hourly, active 20:00-15:00 ET, pause 16:00-19:59 ET, Sunday->Friday");
  md.push(`Timeframe: ${timeframe}`);
  md.push(`Start week: ${startWeekUtc}`);
  md.push("");
  md.push("## Aggregate");
  md.push("");
  md.push(`- Baseline total close %: ${summary.aggregate.baseline_total_close_pct}`);
  md.push(`- Scheduled total close %: ${summary.aggregate.schedule_total_close_pct}`);
  md.push(`- Total close delta %: ${summary.aggregate.total_close_delta_pct}`);
  md.push(`- Baseline avg intrawk DD %: ${summary.aggregate.baseline_avg_intrawork_dd_pct}`);
  md.push(`- Scheduled avg intrawk DD %: ${summary.aggregate.schedule_avg_intrawork_dd_pct}`);
  md.push(`- Avg intrawk DD delta %: ${summary.aggregate.avg_intrawork_dd_delta_pct}`);
  md.push("");
  md.push("## Weekly");
  md.push("");
  md.push("| Week | Base Close % | Scheduled Close % | Delta % | Base DD % | Scheduled DD % |");
  md.push("| --- | ---: | ---: | ---: | ---: | ---: |");
  for (const w of comparisons) {
    md.push(
      `| ${w.week_label} | ${w.baseline_close_pct} | ${w.schedule_close_pct} | ${w.delta_close_pct} | ${w.baseline_intrawork_dd_pct} | ${w.schedule_intrawork_dd_pct} |`,
    );
  }
  md.push("");
  md.push(`JSON: \`${jsonPath}\``);
  fs.writeFileSync(mdPath, md.join("\n"), "utf8");
  fs.writeFileSync(latestMdPath, md.join("\n"), "utf8");

  console.log(`Wrote ${jsonPath}`);
  console.log(`Wrote ${mdPath}`);
  console.log(`Wrote ${latestJsonPath}`);
  console.log(`Wrote ${latestMdPath}`);
}

main().catch((error) => {
  console.error("universal-hourly-scaleout-analysis failed:", error);
  process.exit(1);
});

