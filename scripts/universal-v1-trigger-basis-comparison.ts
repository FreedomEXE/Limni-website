import fs from "node:fs";
import path from "node:path";
import { DateTime } from "luxon";
import { listPerformanceWeeks, readPerformanceSnapshotsByWeek } from "../src/lib/performanceSnapshots";
import { getCanonicalWeekOpenUtc } from "../src/lib/weekAnchor";
import { fetchBitgetCandleSeries } from "../src/lib/bitget";
import { fetchOandaCandleSeries, getOandaInstrument } from "../src/lib/oandaPrices";

type AssetClass = "fx" | "indices" | "commodities" | "crypto";
type SeriesPoint = { ts: number; close: number };
type SymbolSeries = { key: string; openPrice: number; points: SeriesPoint[] };
type Position = { key: string; assetClass: AssetClass; pair: string; direction: 1 | -1; entryPrice: number; remaining: number };

type TriggerMode = "net_peak" | "winners_peak" | "winners_peak_with_net_gate";

type VariantOut = {
  mode: TriggerMode;
  summary: {
    total_week_return_pct: number;
    avg_week_return_pct: number;
    avg_left_on_table_pct: number;
    worst_left_on_table_pct: number;
    avg_week_underwater_dd_pct: number;
    worst_week_underwater_dd_pct: number;
    overall_baseline_underwater_dd_pct: number;
    overall_peak_to_now_giveback_dd_pct: number;
    avg_week_giveback_dd_pct: number;
    worst_week_giveback_dd_pct: number;
    win_rate_pct: number;
  };
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
      ) value = value.slice(1, -1);
      if (!process.env[key]) process.env[key] = value;
    }
  }
}

function fmt(v: number, d = 2) { return Number(v.toFixed(d)); }
function mean(values: number[]) { return values.length ? values.reduce((s, x) => s + x, 0) / values.length : 0; }
function clamp(v: number, lo: number, hi: number) { return Math.min(hi, Math.max(lo, v)); }
function toCanonicalWeekOpen(iso: string) {
  const dt = DateTime.fromISO(iso, { zone: "utc" });
  return dt.isValid ? getCanonicalWeekOpenUtc(dt) : iso;
}
function fxSymbol(pair: string): string {
  if (pair.includes("/")) return pair;
  if (pair.length === 6) return `${pair.slice(0, 3)}/${pair.slice(3)}`;
  return pair;
}
function getCryptoBase(pair: string): "BTC" | "ETH" | null {
  if (pair.startsWith("BTC")) return "BTC";
  if (pair.startsWith("ETH")) return "ETH";
  return null;
}

function getWindowForAsset(assetClass: AssetClass, reportDate: string | null, weekOpenUtc: string) {
  const weekOpen = DateTime.fromISO(weekOpenUtc, { zone: "utc" });
  if (assetClass === "crypto") {
    if (reportDate) {
      const report = DateTime.fromISO(reportDate, { zone: "utc" });
      if (report.isValid) {
        const nextMonday = report.startOf("week").plus({ weeks: 1 });
        return { openUtc: nextMonday.toUTC(), closeUtc: nextMonday.plus({ weeks: 1 }).toUTC() };
      }
    }
    return { openUtc: weekOpen, closeUtc: weekOpen.plus({ weeks: 1 }) };
  }
  if (reportDate) {
    const reportNy = DateTime.fromISO(reportDate, { zone: "America/New_York" });
    if (reportNy.isValid) {
      const daysUntilSunday = (7 - (reportNy.weekday % 7)) % 7;
      const sunday = reportNy.plus({ days: daysUntilSunday }).set({
        hour: assetClass === "fx" ? 17 : 18, minute: 0, second: 0, millisecond: 0,
      });
      const friday = sunday.plus({ days: 5 }).set({ hour: 17, minute: 0, second: 0, millisecond: 0 });
      return { openUtc: sunday.toUTC(), closeUtc: friday.toUTC() };
    }
  }
  return { openUtc: weekOpen, closeUtc: weekOpen.plus({ days: 5 }) };
}

async function fetchSeriesForSymbol(input: {
  assetClass: AssetClass; pair: string; reportDate: string | null; weekOpenUtc: string;
}): Promise<SymbolSeries | null> {
  const { assetClass, pair, reportDate, weekOpenUtc } = input;
  const window = getWindowForAsset(assetClass, reportDate, weekOpenUtc);
  const nowUtc = DateTime.utc().minus({ minutes: 5 });
  const effectiveCloseUtc = window.closeUtc > nowUtc ? nowUtc : window.closeUtc;
  if (effectiveCloseUtc.toMillis() <= window.openUtc.toMillis()) return null;
  try {
    if (assetClass === "crypto") {
      const base = getCryptoBase(pair);
      if (!base) return null;
      const candles = await fetchBitgetCandleSeries(base, { openUtc: window.openUtc, closeUtc: effectiveCloseUtc });
      if (!candles.length) return null;
      return { key: `${assetClass}|${pair}`, openPrice: candles[0].open, points: candles.map((c) => ({ ts: c.ts, close: c.close })) };
    }
    const symbol = assetClass === "fx" ? fxSymbol(pair) : pair;
    const candles = await fetchOandaCandleSeries(getOandaInstrument(symbol), window.openUtc, effectiveCloseUtc);
    if (!candles.length) return null;
    return { key: `${assetClass}|${pair}`, openPrice: candles[0].open, points: candles.map((c) => ({ ts: c.ts, close: c.close })) };
  } catch {
    return null;
  }
}

function getLatestClose(points: SeriesPoint[], ts: number): number | null {
  let left = 0; let right = points.length - 1; let best = -1;
  while (left <= right) {
    const mid = Math.floor((left + right) / 2);
    if (points[mid].ts <= ts) { best = mid; left = mid + 1; } else { right = mid - 1; }
  }
  return best < 0 ? null : points[best].close;
}

function buildDesiredMap(rows: Awaited<ReturnType<typeof readPerformanceSnapshotsByWeek>>) {
  const desired = new Map<string, { assetClass: AssetClass; pair: string; direction: 1 | -1; reportDate: string | null }>();
  for (const row of rows) {
    const assetClass = row.asset_class as AssetClass;
    for (const detail of row.pair_details) {
      if (detail.direction !== "LONG" && detail.direction !== "SHORT") continue;
      desired.set(`${row.model}|${assetClass}|${detail.pair}`, {
        assetClass, pair: detail.pair, direction: detail.direction === "LONG" ? 1 : -1, reportDate: row.report_date ?? null,
      });
    }
  }
  return desired;
}

async function runMode(
  mode: TriggerMode,
  weeksAsc: Array<{ canonical: string; raw: string }>,
  hardStopMove: number,
  emergencyStop: number,
  startMult: number,
  offsetFrac: number,
) {
  const seriesCache = new Map<string, SymbolSeries | null>();
  const open = new Map<string, Position>();
  let realized = 0;
  let overallPeak = Number.NEGATIVE_INFINITY;
  let overallMin = Number.POSITIVE_INFINITY;
  let overallGiveback = 0;
  const weekReturns: number[] = [];
  const weekLeftTable: number[] = [];
  const weekUwDd: number[] = [];
  const weekGbDd: number[] = [];
  const peakHistory: number[] = [];

  for (const week of weeksAsc) {
    const rows = await readPerformanceSnapshotsByWeek(week.raw);
    const desired = buildDesiredMap(rows);
    const needed = new Map<string, { assetClass: AssetClass; pair: string; reportDate: string | null }>();
    for (const p of open.values()) needed.set(`${p.assetClass}|${p.pair}`, { assetClass: p.assetClass, pair: p.pair, reportDate: null });
    for (const d of desired.values()) needed.set(`${d.assetClass}|${d.pair}`, { assetClass: d.assetClass, pair: d.pair, reportDate: d.reportDate });
    for (const sym of needed.values()) {
      const ck = `${week.raw}|${sym.assetClass}|${sym.pair}|${sym.reportDate ?? ""}`;
      if (!seriesCache.has(ck)) {
        seriesCache.set(ck, await fetchSeriesForSymbol({
          assetClass: sym.assetClass, pair: sym.pair, reportDate: sym.reportDate, weekOpenUtc: week.canonical,
        }));
      }
    }
    const getSeries = (assetClass: AssetClass, pair: string, reportDate: string | null) =>
      seriesCache.get(`${week.raw}|${assetClass}|${pair}|${reportDate ?? ""}`) ?? null;

    for (const [k, p] of Array.from(open.entries())) {
      const wanted = desired.get(k);
      if (wanted && wanted.direction === p.direction) continue;
      const s = getSeries(p.assetClass, p.pair, null);
      if (s && s.openPrice > 0 && p.remaining > 0) {
        const u = ((s.openPrice - p.entryPrice) / p.entryPrice) * 100 * p.direction;
        realized += u * p.remaining;
      }
      open.delete(k);
    }
    for (const [k, d] of desired.entries()) {
      if (open.has(k)) continue;
      const s = getSeries(d.assetClass, d.pair, d.reportDate);
      if (!s || s.openPrice <= 0) continue;
      open.set(k, { key: k, assetClass: d.assetClass, pair: d.pair, direction: d.direction, entryPrice: s.openPrice, remaining: 1 });
    }

    const bySymbol = new Map<string, SymbolSeries>();
    for (const p of open.values()) {
      const s = getSeries(p.assetClass, p.pair, desired.get(p.key)?.reportDate ?? null) ?? getSeries(p.assetClass, p.pair, null);
      if (!s) continue;
      bySymbol.set(`${p.assetClass}|${p.pair}`, s);
    }
    const tsAll = Array.from(new Set(Array.from(bySymbol.values()).flatMap((s) => s.points.map((p) => p.ts)))).sort((a, b) => a - b);
    const unit = (p: Position, ts: number): number | null => {
      const s = bySymbol.get(`${p.assetClass}|${p.pair}`); if (!s) return null;
      const c = getLatestClose(s.points, ts); if (c === null || p.entryPrice <= 0) return null;
      return ((c - p.entryPrice) / p.entryPrice) * 100 * p.direction;
    };

    const firstTs = tsAll.length ? tsAll[0] : Date.parse(week.canonical);
    const weekStartEq = realized + Array.from(open.values()).reduce((s, p) => {
      const u = unit(p, firstTs); return u === null ? s : s + u * p.remaining;
    }, 0);
    const avgPeak = mean(peakHistory);
    const trailStart = peakHistory.length ? clamp(avgPeak * startMult, 30, 130) : 30;
    const trailOffset = peakHistory.length ? clamp(trailStart * offsetFrac, 8, 45) : 10;
    const netGate = trailStart * 0.30;

    let weekPeakProfit = Number.NEGATIVE_INFINITY;
    let weekPeakEq = Number.NEGATIVE_INFINITY;
    let weekGb = 0;
    let weekUw = 0;
    let endEq = weekStartEq;
    let active = false;
    let lock = Number.NEGATIVE_INFINITY;
    let closedWinners = false;

    for (const ts of tsAll) {
      for (const [k, p] of Array.from(open.entries())) {
        const u = unit(p, ts); if (u === null) continue;
        if (u <= -Math.abs(hardStopMove)) { realized += u * p.remaining; open.delete(k); }
      }
      let floating = 0;
      let winnersFloating = 0;
      for (const p of open.values()) {
        const u = unit(p, ts); if (u === null) continue;
        const pnl = u * p.remaining;
        floating += pnl;
        if (u > 0) winnersFloating += pnl;
      }
      const eq = realized + floating;
      endEq = eq;
      if (eq <= -Math.abs(emergencyStop)) {
        for (const [k, p] of Array.from(open.entries())) {
          const u = unit(p, ts); if (u === null) continue;
          realized += u * p.remaining; open.delete(k);
        }
      }
      const weekProfit = eq - weekStartEq;
      if (weekProfit > weekPeakProfit) weekPeakProfit = weekProfit;
      if (eq > weekPeakEq) weekPeakEq = eq;
      weekGb = Math.max(weekGb, weekPeakEq - eq);
      if (weekProfit < 0) weekUw = Math.max(weekUw, -weekProfit);

      const triggerValue = mode === "net_peak" ? weekProfit : winnersFloating;
      const gateOk = mode !== "winners_peak_with_net_gate" || weekProfit >= netGate;
      if (!closedWinners) {
        if (triggerValue >= trailStart) {
          active = true;
          lock = Math.max(lock, triggerValue - trailOffset);
        }
        if (active && gateOk && triggerValue <= lock) {
          for (const [k, p] of Array.from(open.entries())) {
            const u = unit(p, ts); if (u === null || u <= 0) continue;
            realized += u * p.remaining; open.delete(k);
          }
          closedWinners = true;
        }
      }

      if (eq > overallPeak) overallPeak = eq;
      if (eq < overallMin) overallMin = eq;
      overallGiveback = Math.max(overallGiveback, overallPeak - eq);
    }

    const lastTs = tsAll.length ? tsAll[tsAll.length - 1] : Date.parse(week.canonical);
    for (const [k, p] of Array.from(open.entries())) {
      const u = unit(p, lastTs); if (u === null || u <= 0) continue;
      realized += u * p.remaining; open.delete(k);
    }
    let endFloating = 0;
    for (const p of open.values()) {
      const u = unit(p, lastTs); if (u === null) continue;
      endFloating += u * p.remaining;
    }
    endEq = realized + endFloating;
    const endProfit = endEq - weekStartEq;
    weekReturns.push(endProfit);
    weekLeftTable.push(Math.max(0, weekPeakProfit - endProfit));
    weekUwDd.push(weekUw);
    weekGbDd.push(weekGb);
    peakHistory.push(Math.max(0, weekPeakProfit));
  }

  return {
    mode,
    summary: {
      total_week_return_pct: fmt(weekReturns.reduce((s, x) => s + x, 0)),
      avg_week_return_pct: fmt(mean(weekReturns)),
      avg_left_on_table_pct: fmt(mean(weekLeftTable)),
      worst_left_on_table_pct: fmt(weekLeftTable.length ? Math.max(...weekLeftTable) : 0),
      avg_week_underwater_dd_pct: fmt(mean(weekUwDd)),
      worst_week_underwater_dd_pct: fmt(weekUwDd.length ? Math.max(...weekUwDd) : 0),
      overall_baseline_underwater_dd_pct: fmt(Math.max(0, -overallMin)),
      overall_peak_to_now_giveback_dd_pct: fmt(overallGiveback),
      avg_week_giveback_dd_pct: fmt(mean(weekGbDd)),
      worst_week_giveback_dd_pct: fmt(weekGbDd.length ? Math.max(...weekGbDd) : 0),
      win_rate_pct: fmt(weekReturns.length ? (weekReturns.filter((x) => x > 0).length * 100) / weekReturns.length : 0, 1),
    },
  } satisfies VariantOut;
}

async function main() {
  loadDotEnv();
  const startWeekUtc = toCanonicalWeekOpen(process.env.TRUTH_START_WEEK ?? "2026-01-19T00:00:00Z");
  const startMs = Date.parse(startWeekUtc);
  const weeksLimit = Number(process.env.TRUTH_WEEKS ?? 12);
  const hardStopMove = Number(process.env.V1_HARD_STOP_MOVE_PCT ?? 10);
  const emergencyStop = Number(process.env.V1_EMERGENCY_BASELINE_STOP_PCT ?? 30);
  const startMult = Number(process.env.ADAPTIVE_START_MULT ?? 0.65);
  const offsetFrac = Number(process.env.ADAPTIVE_OFFSET_FRAC ?? 0.25);

  const rawWeeks = await listPerformanceWeeks(Math.max(weeksLimit * 3, 30));
  const canonicalCandidates = new Map<string, string[]>();
  for (const w of rawWeeks) {
    const c = toCanonicalWeekOpen(w);
    const list = canonicalCandidates.get(c) ?? [];
    list.push(w);
    canonicalCandidates.set(c, list);
  }
  const weekChoices: Array<{ canonical: string; raw: string; score: number }> = [];
  for (const [canonical, raws] of canonicalCandidates.entries()) {
    let bestRaw = raws[0];
    let bestScore = -1;
    for (const raw of raws) {
      const rows = await readPerformanceSnapshotsByWeek(raw);
      const score = rows.reduce((s, r) => s + (r.pair_details?.length ?? 0), 0);
      if (score > bestScore) { bestScore = score; bestRaw = raw; }
    }
    weekChoices.push({ canonical, raw: bestRaw, score: bestScore });
  }
  const weeksAsc = weekChoices
    .filter((w) => Date.parse(w.canonical) >= startMs)
    .sort((a, b) => Date.parse(a.canonical) - Date.parse(b.canonical))
    .slice(-weeksLimit);

  const modes: TriggerMode[] = ["net_peak", "winners_peak", "winners_peak_with_net_gate"];
  const variants: VariantOut[] = [];
  for (const mode of modes) variants.push(await runMode(mode, weeksAsc, hardStopMove, emergencyStop, startMult, offsetFrac));

  const ranked = [...variants].sort((a, b) => {
    const sa = a.summary.total_week_return_pct - 0.7 * a.summary.avg_left_on_table_pct - 0.3 * a.summary.avg_week_underwater_dd_pct;
    const sb = b.summary.total_week_return_pct - 0.7 * b.summary.avg_left_on_table_pct - 0.3 * b.summary.avg_week_underwater_dd_pct;
    return sb - sa;
  });

  const out = {
    generated_at: DateTime.utc().toISO(),
    start_week_utc: startWeekUtc,
    hard_stop_move_pct: hardStopMove,
    emergency_baseline_stop_pct: emergencyStop,
    adaptive_start_mult: startMult,
    adaptive_offset_frac: offsetFrac,
    ranking_note: "Score = total_return - 0.7*avg_left_on_table - 0.3*avg_underwater_dd",
    ranked_modes: ranked.map((v) => v.mode),
    variants,
  };

  const stamp = DateTime.utc().toFormat("yyyy-LL-dd");
  const jsonPath = `reports/universal-v1-trigger-basis-comparison-${stamp}.json`;
  const mdPath = `reports/universal-v1-trigger-basis-comparison-${stamp}.md`;
  const latestJson = "reports/universal-v1-trigger-basis-comparison-latest.json";
  const latestMd = "reports/universal-v1-trigger-basis-comparison-latest.md";
  fs.writeFileSync(jsonPath, JSON.stringify(out, null, 2), "utf8");
  fs.writeFileSync(latestJson, JSON.stringify(out, null, 2), "utf8");

  const md: string[] = [];
  md.push("# Universal V1 Trigger Basis Comparison");
  md.push("");
  md.push(`Generated: ${out.generated_at}`);
  md.push(`Start week: ${startWeekUtc}`);
  md.push(`Adaptive multipliers: start=${startMult}, offset_frac=${offsetFrac}`);
  md.push(`Ranking: ${out.ranking_note}`);
  md.push("");
  md.push("| Mode | Total % | Avg Week % | Avg Left Table % | Avg Underwater DD % | Overall Baseline DD % | Overall Giveback % |");
  md.push("| --- | ---: | ---: | ---: | ---: | ---: | ---: |");
  for (const v of ranked) {
    md.push(
      `| ${v.mode} | ${v.summary.total_week_return_pct} | ${v.summary.avg_week_return_pct} | ${v.summary.avg_left_on_table_pct} | ${v.summary.avg_week_underwater_dd_pct} | ${v.summary.overall_baseline_underwater_dd_pct} | ${v.summary.overall_peak_to_now_giveback_dd_pct} |`,
    );
  }
  md.push("");
  md.push(`JSON: \`${jsonPath}\``);
  fs.writeFileSync(mdPath, md.join("\n"), "utf8");
  fs.writeFileSync(latestMd, md.join("\n"), "utf8");

  console.log(`Wrote ${jsonPath}`);
  console.log(`Wrote ${mdPath}`);
  console.log(`Wrote ${latestJson}`);
  console.log(`Wrote ${latestMd}`);
}

main().catch((error) => {
  console.error("universal-v1-trigger-basis-comparison failed:", error);
  process.exit(1);
});
