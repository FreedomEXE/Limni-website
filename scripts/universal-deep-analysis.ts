import fs from "node:fs";
import path from "node:path";
import { DateTime } from "luxon";
import {
  buildPerModelBasketSummary,
  buildUniversalBasketSummary,
  type UniversalWeekSimulation,
} from "../src/lib/universalBasket";
import { getCanonicalWeekOpenUtc } from "../src/lib/weekAnchor";

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

type CurvePoint = {
  ts_utc: string;
  equity_pct: number;
};

type WeekMetrics = {
  week_open_utc: string;
  week_label: string;
  close_pct: number;
  peak_pct: number;
  peak_at_utc: string | null;
  low_pct: number;
  low_at_utc: string | null;
  intrawork_dd_pct: number;
  legs: number;
  priced_symbols: number;
};

function fmt(v: number, digits = 2) {
  return Number(v.toFixed(digits));
}

function toCanonicalWeekOpen(iso: string): string {
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
    const currentScore = (current.priced_symbols ?? 0) * 1000 + (current.legs ?? 0);
    const nextScore = (row.priced_symbols ?? 0) * 1000 + (row.legs ?? 0);
    if (nextScore > currentScore) {
      byCanonical.set(canonical, { ...row, week_open_utc: canonical });
    }
  }
  return Array.from(byCanonical.values()).sort(
    (a, b) => Date.parse(a.week_open_utc) - Date.parse(b.week_open_utc),
  );
}

function computeCurveMetrics(curve: CurvePoint[], fallbackClose: number) {
  if (!curve.length) {
    return {
      close: fallbackClose,
      peak: fallbackClose,
      peakAt: null as string | null,
      low: fallbackClose,
      lowAt: null as string | null,
      maxDd: 0,
    };
  }
  let close = fallbackClose;
  let peak = Number.NEGATIVE_INFINITY;
  let low = Number.POSITIVE_INFINITY;
  let peakAt: string | null = null;
  let lowAt: string | null = null;
  let rollingPeak = Number.NEGATIVE_INFINITY;
  let maxDd = 0;

  for (const point of curve) {
    const eq = Number(point.equity_pct);
    if (!Number.isFinite(eq)) continue;
    close = eq;
    if (eq > peak) {
      peak = eq;
      peakAt = point.ts_utc;
    }
    if (eq < low) {
      low = eq;
      lowAt = point.ts_utc;
    }
    if (eq > rollingPeak) rollingPeak = eq;
    const dd = rollingPeak - eq;
    if (dd > maxDd) maxDd = dd;
  }

  if (!Number.isFinite(peak)) peak = fallbackClose;
  if (!Number.isFinite(low)) low = fallbackClose;
  return { close, peak, peakAt, low, lowAt, maxDd };
}

function buildWeekMetrics(row: UniversalWeekSimulation): WeekMetrics {
  const curve = row.equity_curve.map((p) => ({
    ts_utc: p.ts_utc,
    equity_pct: p.equity_pct,
  }));
  const metrics = computeCurveMetrics(curve, row.total_percent);
  return {
    week_open_utc: row.week_open_utc,
    week_label: row.week_label,
    close_pct: fmt(metrics.close),
    peak_pct: fmt(metrics.peak),
    peak_at_utc: metrics.peakAt,
    low_pct: fmt(metrics.low),
    low_at_utc: metrics.lowAt,
    intrawork_dd_pct: fmt(metrics.maxDd),
    legs: row.legs,
    priced_symbols: row.priced_symbols,
  };
}

async function main() {
  loadDotEnv();

  const timeframe = (process.env.TRUTH_TIMEFRAME ?? "H1") as "M1" | "H1";
  const includeCurrentWeek = (process.env.TRUTH_INCLUDE_CURRENT_WEEK ?? "true").toLowerCase() !== "false";
  const limitWeeks = Number(process.env.TRUTH_WEEKS ?? 12);
  const startWeekInput = process.env.TRUTH_START_WEEK ?? "2026-01-19T00:00:00Z";
  const startWeekUtc = toCanonicalWeekOpen(startWeekInput);
  const startWeekMillis = Date.parse(startWeekUtc);

  const universal = await buildUniversalBasketSummary({
    timeframe,
    includeCurrentWeek,
    limitWeeks,
  });
  const perModel = await buildPerModelBasketSummary({
    timeframe,
    includeCurrentWeek,
    limitWeeks,
    trailStartPct: 30,
    trailOffsetPct: 10,
  });

  const universalWeeks = dedupeWeeks(universal.by_week)
    .filter((w) => Date.parse(w.week_open_utc) >= startWeekMillis);
  const weekly = universalWeeks.map(buildWeekMetrics);

  const models = perModel.models.map((modelRow) => {
    const weeks = dedupeWeeks(modelRow.by_week)
      .filter((w) => Date.parse(w.week_open_utc) >= startWeekMillis)
      .map(buildWeekMetrics);
    const total = weeks.reduce((s, w) => s + w.close_pct, 0);
    const winRate = weeks.length ? (weeks.filter((w) => w.close_pct > 0).length * 100) / weeks.length : 0;
    const bestWeek = weeks.length ? weeks.reduce((a, b) => (a.close_pct >= b.close_pct ? a : b)) : null;
    const worstWeek = weeks.length ? weeks.reduce((a, b) => (a.close_pct <= b.close_pct ? a : b)) : null;
    const avgPeak = weeks.length ? weeks.reduce((s, w) => s + w.peak_pct, 0) / weeks.length : 0;
    const avgDd = weeks.length ? weeks.reduce((s, w) => s + w.intrawork_dd_pct, 0) / weeks.length : 0;
    return {
      model: modelRow.model,
      total_close_pct: fmt(total),
      avg_weekly_close_pct: fmt(weeks.length ? total / weeks.length : 0),
      win_rate_pct: fmt(winRate, 1),
      avg_weekly_peak_pct: fmt(avgPeak),
      avg_intrawork_dd_pct: fmt(avgDd),
      best_week: bestWeek,
      worst_week: worstWeek,
      weeks,
    };
  });

  const byWeekModelComparison = weekly.map((week) => {
    const rows = models.map((m) => {
      const row = m.weeks.find((w) => w.week_open_utc === week.week_open_utc);
      return {
        model: m.model,
        close_pct: row?.close_pct ?? 0,
        peak_pct: row?.peak_pct ?? 0,
        low_pct: row?.low_pct ?? 0,
        intrawork_dd_pct: row?.intrawork_dd_pct ?? 0,
      };
    });
    rows.sort((a, b) => b.close_pct - a.close_pct);
    return {
      week_open_utc: week.week_open_utc,
      week_label: week.week_label,
      universal: week,
      model_ranking: rows,
    };
  });

  const out = {
    generated_at: DateTime.utc().toISO(),
    assumptions: {
      timeframe,
      includeCurrentWeek,
      limitWeeks,
      start_week_utc: startWeekUtc,
    },
    universal_weekly_metrics: weekly,
    model_summary: models,
    by_week_model_comparison: byWeekModelComparison,
  };

  const stamp = DateTime.utc().toFormat("yyyy-LL-dd");
  const jsonPath = `reports/universal-deep-analysis-${stamp}.json`;
  const mdPath = `reports/universal-deep-analysis-${stamp}.md`;
  const latestJsonPath = "reports/universal-deep-analysis-latest.json";
  const latestMdPath = "reports/universal-deep-analysis-latest.md";
  fs.writeFileSync(jsonPath, JSON.stringify(out, null, 2), "utf8");
  fs.writeFileSync(latestJsonPath, JSON.stringify(out, null, 2), "utf8");

  const md: string[] = [];
  md.push("# Universal Deep Analysis");
  md.push("");
  md.push(`Generated: ${out.generated_at}`);
  md.push(`Timeframe: ${timeframe}`);
  md.push(`Start week: ${startWeekUtc}`);
  md.push("");
  md.push("## Weekly Peak/Low/Drawdown (Universal)");
  md.push("");
  md.push("| Week | Close % | Peak % | Low % | Intrawk DD % | Legs | Priced Symbols |");
  md.push("| --- | ---: | ---: | ---: | ---: | ---: | ---: |");
  for (const w of weekly) {
    md.push(
      `| ${w.week_label} | ${w.close_pct} | ${w.peak_pct} | ${w.low_pct} | ${w.intrawork_dd_pct} | ${w.legs} | ${w.priced_symbols} |`,
    );
  }
  md.push("");
  md.push("## Basket (Model) Comparison");
  md.push("");
  md.push("| Basket | Total Close % | Avg Weekly % | Win Rate % | Avg Peak % | Avg Intrawk DD % |");
  md.push("| --- | ---: | ---: | ---: | ---: | ---: |");
  for (const m of models.sort((a, b) => b.total_close_pct - a.total_close_pct)) {
    md.push(
      `| ${m.model} | ${m.total_close_pct} | ${m.avg_weekly_close_pct} | ${m.win_rate_pct} | ${m.avg_weekly_peak_pct} | ${m.avg_intrawork_dd_pct} |`,
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
  console.error("universal-deep-analysis failed:", error);
  process.exit(1);
});
