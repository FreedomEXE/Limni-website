import fs from "node:fs";
import path from "node:path";
import { DateTime } from "luxon";
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
      if (!key) continue;
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

type EquityPoint = {
  ts_utc: string;
  equity_pct: number;
  lock_pct: number | null;
};

type WeekRow = {
  week_open_utc: string;
  week_label: string;
  total_percent: number;
  legs: number;
  priced_symbols: number;
  equity_curve: EquityPoint[];
};

type TrailRun = {
  lockedPct: number;
  trailingHit: boolean;
};

type StrategyEval = {
  mode: "universal" | "per_model";
  startPct: number;
  offsetPct: number;
  totalLockedPct: number;
  avgLockedPct: number;
  winRatePct: number;
  trailingHitRatePct: number;
  worstWeekPct: number;
  maxWeeklyCurveDdPct: number;
  score: number;
};

function latestEquityAtOrBefore(points: EquityPoint[], tsUtc: string): number {
  let last = 0;
  const target = Date.parse(tsUtc);
  if (!Number.isFinite(target)) return last;
  for (const point of points) {
    const ts = Date.parse(point.ts_utc);
    if (!Number.isFinite(ts)) continue;
    if (ts > target) break;
    const eq = Number(point.equity_pct);
    if (Number.isFinite(eq)) last = eq;
  }
  return last;
}

function sumModelCurvesByTimestamp(curves: EquityPoint[][]): EquityPoint[] {
  const tsSet = new Set<string>();
  for (const curve of curves) {
    for (const point of curve) tsSet.add(point.ts_utc);
  }
  const timestamps = Array.from(tsSet).sort((a, b) => Date.parse(a) - Date.parse(b));
  return timestamps.map((tsUtc) => {
    const total = curves.reduce((sum, curve) => sum + latestEquityAtOrBefore(curve, tsUtc), 0);
    return { ts_utc: tsUtc, equity_pct: total, lock_pct: null };
  });
}

function simulateTrailFromCurve(points: EquityPoint[], startPct: number, offsetPct: number): TrailRun {
  let peak = Number.NEGATIVE_INFINITY;
  let lock = Number.NEGATIVE_INFINITY;
  let trailingActive = false;
  let trailingHit = false;
  let finalEq = 0;
  const minLockAfterActivation = startPct - offsetPct;

  for (const point of points) {
    const eq = Number(point.equity_pct);
    if (!Number.isFinite(eq)) continue;
    finalEq = eq;
    if (eq > peak) peak = eq;

    if (!trailingHit && eq >= startPct) {
      trailingActive = true;
      const nextLock = Math.max(minLockAfterActivation, peak - offsetPct);
      if (nextLock > lock) lock = nextLock;
    }
    if (!trailingHit && trailingActive && Number.isFinite(lock) && eq <= lock) {
      trailingHit = true;
    }
  }

  if (trailingHit && Number.isFinite(lock)) {
    return { lockedPct: lock, trailingHit: true };
  }
  return { lockedPct: finalEq, trailingHit: false };
}

function maxDrawdownFromWeeklyReturns(weeklyReturnsOldToNew: number[]) {
  let curve = 0;
  let peak = 0;
  let maxDd = 0;
  for (const r of weeklyReturnsOldToNew) {
    curve += r;
    if (curve > peak) peak = curve;
    const dd = peak - curve;
    if (dd > maxDd) maxDd = dd;
  }
  return maxDd;
}

function evaluateWeeklySeries(
  mode: "universal" | "per_model",
  weeksDesc: Array<{ week: string; curve: EquityPoint[]; rawPct: number }>,
  startPct: number,
  offsetPct: number,
): StrategyEval {
  const lockedByWeekDesc: number[] = [];
  let hits = 0;
  for (const row of weeksDesc) {
    const run = simulateTrailFromCurve(row.curve, startPct, offsetPct);
    lockedByWeekDesc.push(run.lockedPct);
    if (run.trailingHit) hits += 1;
  }

  const totalLockedPct = lockedByWeekDesc.reduce((s, x) => s + x, 0);
  const weeks = Math.max(1, lockedByWeekDesc.length);
  const avgLockedPct = totalLockedPct / weeks;
  const wins = lockedByWeekDesc.filter((x) => x > 0).length;
  const winRatePct = (wins / weeks) * 100;
  const trailingHitRatePct = (hits / weeks) * 100;
  const worstWeekPct = Math.min(...lockedByWeekDesc);
  const maxWeeklyCurveDdPct = maxDrawdownFromWeeklyReturns([...lockedByWeekDesc].reverse());
  const score = totalLockedPct - maxWeeklyCurveDdPct * 0.75;

  return {
    mode,
    startPct,
    offsetPct,
    totalLockedPct,
    avgLockedPct,
    winRatePct,
    trailingHitRatePct,
    worstWeekPct,
    maxWeeklyCurveDdPct,
    score,
  };
}

function fmt(v: number, d = 2) {
  return Number(v.toFixed(d));
}

function dedupeWeeks(rows: WeekRow[]): WeekRow[] {
  const byCanonical = new Map<string, WeekRow>();
  for (const row of rows) {
    const dt = DateTime.fromISO(row.week_open_utc, { zone: "utc" });
    const canonical = dt.isValid ? getCanonicalWeekOpenUtc(dt) : row.week_open_utc;
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
    (a, b) => Date.parse(b.week_open_utc) - Date.parse(a.week_open_utc),
  );
}

function toCanonicalWeekOpen(isoValue: string): string {
  const dt = DateTime.fromISO(isoValue, { zone: "utc" });
  return dt.isValid ? getCanonicalWeekOpenUtc(dt) : isoValue;
}

async function main() {
  loadDotEnv();

  const weeks = Number(process.env.TRUTH_WEEKS ?? 8);
  const includeCurrentWeek = (process.env.TRUTH_INCLUDE_CURRENT_WEEK ?? "true").toLowerCase() !== "false";
  const timeframe = (process.env.TRUTH_TIMEFRAME ?? "M1") as "M1" | "H1";

  const universalMod = (await import("../src/lib/universalBasket.ts")) as {
    buildUniversalBasketSummary: (o?: Record<string, unknown>) => Promise<{
      generated_at: string;
      by_week: WeekRow[];
      assumptions: { trail_start_pct: number; trail_offset_pct: number; timeframe: string };
    }>;
    buildPerModelBasketSummary: (o?: Record<string, unknown>) => Promise<{
      generated_at: string;
      models: Array<{ model: string; by_week: WeekRow[] }>;
      assumptions: { trail_start_pct: number; trail_offset_pct: number; timeframe: string };
    }>;
  };

  const universal = await universalMod.buildUniversalBasketSummary({
    timeframe,
    limitWeeks: weeks,
    includeCurrentWeek,
  });
  const perModel = await universalMod.buildPerModelBasketSummary({
    timeframe,
    limitWeeks: weeks,
    includeCurrentWeek,
    trailStartPct: 10,
    trailOffsetPct: 5,
  });

  const starts = [10, 12, 15, 18, 20, 22, 25, 30, 35];
  const offsets = [4, 5, 6, 8, 10, 12, 15];

  const universalWeeks = dedupeWeeks(universal.by_week);
  const universalWeeksDesc = universalWeeks.map((w) => ({
    week: w.week_open_utc,
    curve: w.equity_curve,
    rawPct: w.total_percent,
  }));

  const byWeekModelCurve = new Map<string, EquityPoint[][]>();
  const byWeekModelRaw = new Map<string, number>();
  for (const model of perModel.models) {
    for (const w of model.by_week) {
      const key = toCanonicalWeekOpen(w.week_open_utc);
      const curves = byWeekModelCurve.get(key) ?? [];
      curves.push(w.equity_curve.map((p) => ({ ...p, lock_pct: null as null })));
      byWeekModelCurve.set(key, curves);
      byWeekModelRaw.set(key, (byWeekModelRaw.get(key) ?? 0) + w.total_percent);
    }
  }
  const modelWeeksDesc = universalWeeks
    .map((w) => ({
      week: w.week_open_utc,
      curve: sumModelCurvesByTimestamp(byWeekModelCurve.get(w.week_open_utc) ?? []),
      rawPct: byWeekModelRaw.get(w.week_open_utc) ?? 0,
    }))
    .filter((w) => w.curve.length > 0);

  const evals: StrategyEval[] = [];
  for (const start of starts) {
    for (const offset of offsets) {
      if (offset >= start) continue;
      evals.push(evaluateWeeklySeries("universal", universalWeeksDesc, start, offset));
      evals.push(evaluateWeeklySeries("per_model", modelWeeksDesc, start, offset));
    }
  }

  const holdUniversal = {
    totalPct: universalWeeksDesc.reduce((s, w) => s + w.rawPct, 0),
    avgPct: universalWeeksDesc.length
      ? universalWeeksDesc.reduce((s, w) => s + w.rawPct, 0) / universalWeeksDesc.length
      : 0,
    winRatePct: universalWeeksDesc.length
      ? (universalWeeksDesc.filter((w) => w.rawPct > 0).length * 100) / universalWeeksDesc.length
      : 0,
    worstWeekPct: universalWeeksDesc.length ? Math.min(...universalWeeksDesc.map((w) => w.rawPct)) : 0,
    maxWeeklyCurveDdPct: maxDrawdownFromWeeklyReturns([...universalWeeksDesc.map((w) => w.rawPct)].reverse()),
  };

  const topByScore = [...evals].sort((a, b) => b.score - a.score).slice(0, 12);
  const lowDdCandidates = [...evals]
    .filter((r) => r.maxWeeklyCurveDdPct <= 20)
    .sort((a, b) => b.totalLockedPct - a.totalLockedPct)
    .slice(0, 12);
  const topUniversal = [...evals]
    .filter((r) => r.mode === "universal")
    .sort((a, b) => b.totalLockedPct - a.totalLockedPct)
    .slice(0, 10);
  const topPerModel = [...evals]
    .filter((r) => r.mode === "per_model")
    .sort((a, b) => b.totalLockedPct - a.totalLockedPct)
    .slice(0, 10);

  const generatedAt = DateTime.utc();
  const stamp = generatedAt.toFormat("yyyy-LL-dd");
  const jsonPath = `reports/universal-truth-sweep-${stamp}.json`;
  const mdPath = `reports/universal-truth-sweep-${stamp}.md`;

  const out = {
    generated_at: generatedAt.toISO(),
    assumptions: {
      timeframe,
      weeks,
      includeCurrentWeek,
      universal_engine_assumptions: universal.assumptions,
    },
    hold_baseline_universal: {
      total_pct: fmt(holdUniversal.totalPct),
      avg_weekly_pct: fmt(holdUniversal.avgPct),
      win_rate_pct: fmt(holdUniversal.winRatePct, 1),
      worst_week_pct: fmt(holdUniversal.worstWeekPct),
      max_weekly_curve_dd_pct: fmt(holdUniversal.maxWeeklyCurveDdPct),
    },
    week_window: universalWeeks.map((w) => ({
      week_open_utc: w.week_open_utc,
      week_label: w.week_label,
      raw_pct: fmt(w.total_percent),
      legs: w.legs,
      priced_symbols: w.priced_symbols,
    })),
    top_by_score: topByScore.map((r) => ({
      mode: r.mode,
      start: r.startPct,
      offset: r.offsetPct,
      total_locked_pct: fmt(r.totalLockedPct),
      avg_locked_pct: fmt(r.avgLockedPct),
      max_weekly_curve_dd_pct: fmt(r.maxWeeklyCurveDdPct),
      win_rate_pct: fmt(r.winRatePct, 1),
      trailing_hit_rate_pct: fmt(r.trailingHitRatePct, 1),
      worst_week_pct: fmt(r.worstWeekPct),
      score: fmt(r.score),
    })),
    low_dd_candidates: lowDdCandidates.map((r) => ({
      mode: r.mode,
      start: r.startPct,
      offset: r.offsetPct,
      total_locked_pct: fmt(r.totalLockedPct),
      max_weekly_curve_dd_pct: fmt(r.maxWeeklyCurveDdPct),
      win_rate_pct: fmt(r.winRatePct, 1),
      worst_week_pct: fmt(r.worstWeekPct),
    })),
    top_universal_by_return: topUniversal.map((r) => ({
      start: r.startPct,
      offset: r.offsetPct,
      total_locked_pct: fmt(r.totalLockedPct),
      max_weekly_curve_dd_pct: fmt(r.maxWeeklyCurveDdPct),
      win_rate_pct: fmt(r.winRatePct, 1),
      worst_week_pct: fmt(r.worstWeekPct),
    })),
    top_per_model_by_return: topPerModel.map((r) => ({
      start: r.startPct,
      offset: r.offsetPct,
      total_locked_pct: fmt(r.totalLockedPct),
      max_weekly_curve_dd_pct: fmt(r.maxWeeklyCurveDdPct),
      win_rate_pct: fmt(r.winRatePct, 1),
      worst_week_pct: fmt(r.worstWeekPct),
    })),
  };

  fs.writeFileSync(jsonPath, JSON.stringify(out, null, 2), "utf8");

  const md: string[] = [];
  md.push("# Universal Truth Sweep");
  md.push("");
  md.push(`Generated: ${generatedAt.toISO()}`);
  md.push(`Timeframe: ${timeframe}`);
  md.push(`Weeks: ${weeks} (includeCurrentWeek=${includeCurrentWeek})`);
  md.push("");
  md.push("## Hold Baseline (No Trailing)");
  md.push("");
  md.push(`- Total %: ${fmt(holdUniversal.totalPct)}`);
  md.push(`- Avg weekly %: ${fmt(holdUniversal.avgPct)}`);
  md.push(`- Win rate %: ${fmt(holdUniversal.winRatePct, 1)}`);
  md.push(`- Worst week %: ${fmt(holdUniversal.worstWeekPct)}`);
  md.push(`- Max weekly-curve DD %: ${fmt(holdUniversal.maxWeeklyCurveDdPct)}`);
  md.push("");
  md.push("## Top By Score (Return - 0.75 * DD)");
  md.push("");
  md.push("| Mode | Start | Offset | Total Locked % | Max Weekly DD % | Win Rate % | Worst Week % | Score |");
  md.push("| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |");
  for (const r of out.top_by_score.slice(0, 12)) {
    md.push(
      `| ${r.mode} | ${r.start} | ${r.offset} | ${r.total_locked_pct} | ${r.max_weekly_curve_dd_pct} | ${r.win_rate_pct} | ${r.worst_week_pct} | ${r.score} |`,
    );
  }
  md.push("");
  md.push("## Low-DD Candidates (DD <= 20%)");
  md.push("");
  md.push("| Mode | Start | Offset | Total Locked % | Max Weekly DD % | Win Rate % | Worst Week % |");
  md.push("| --- | ---: | ---: | ---: | ---: | ---: | ---: |");
  for (const r of out.low_dd_candidates.slice(0, 12)) {
    md.push(
      `| ${r.mode} | ${r.start} | ${r.offset} | ${r.total_locked_pct} | ${r.max_weekly_curve_dd_pct} | ${r.win_rate_pct} | ${r.worst_week_pct} |`,
    );
  }
  md.push("");
  md.push(`JSON: \`${jsonPath}\``);
  fs.writeFileSync(mdPath, md.join("\n"), "utf8");

  console.log(`Wrote ${jsonPath}`);
  console.log(`Wrote ${mdPath}`);
}

main().catch((error) => {
  console.error("universal-truth-sweep failed:", error);
  process.exit(1);
});
