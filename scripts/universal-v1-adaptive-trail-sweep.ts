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
type Position = {
  key: string;
  assetClass: AssetClass;
  pair: string;
  direction: 1 | -1;
  entryPrice: number;
  remaining: number;
};

type WeekMetrics = {
  week_open_utc: string;
  week_label: string;
  trail_start_pct: number;
  trail_offset_pct: number;
  week_return_pct: number;
  week_peak_profit_pct: number;
  left_on_table_pct: number;
  week_underwater_dd_pct: number;
  week_giveback_dd_pct: number;
  hard_stop_closes: number;
  flip_or_invalid_closes: number;
  winner_takeprofit_closes: number;
  winners_closed_friday: number;
};

type AdaptiveConfig = {
  id: string;
  label: string;
  startMult: number;
  offsetFracOfStart: number;
  minStart: number;
  maxStart: number;
  minOffset: number;
  maxOffset: number;
  warmupStart: number;
  warmupOffset: number;
};

type VariantOut = {
  id: string;
  label: string;
  summary: {
    total_week_return_pct: number;
    avg_week_return_pct: number;
    win_rate_pct: number;
    worst_week_return_pct: number;
    avg_left_on_table_pct: number;
    worst_left_on_table_pct: number;
    avg_week_underwater_dd_pct: number;
    worst_week_underwater_dd_pct: number;
    avg_week_giveback_dd_pct: number;
    worst_week_giveback_dd_pct: number;
    overall_baseline_underwater_dd_pct: number;
    overall_peak_to_now_giveback_dd_pct: number;
  };
  weekly: WeekMetrics[];
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

function clamp(v: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, v));
}

function mean(values: number[]) {
  if (!values.length) return 0;
  return values.reduce((s, x) => s + x, 0) / values.length;
}

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
        hour: assetClass === "fx" ? 17 : 18,
        minute: 0,
        second: 0,
        millisecond: 0,
      });
      const friday = sunday.plus({ days: 5 }).set({ hour: 17, minute: 0, second: 0, millisecond: 0 });
      return { openUtc: sunday.toUTC(), closeUtc: friday.toUTC() };
    }
  }
  return { openUtc: weekOpen, closeUtc: weekOpen.plus({ days: 5 }) };
}

async function fetchSeriesForSymbol(input: {
  assetClass: AssetClass;
  pair: string;
  reportDate: string | null;
  weekOpenUtc: string;
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
      const candles = await fetchBitgetCandleSeries(base, {
        openUtc: window.openUtc,
        closeUtc: effectiveCloseUtc,
      });
      if (!candles.length) return null;
      return {
        key: `${assetClass}|${pair}`,
        openPrice: candles[0].open,
        points: candles.map((c) => ({ ts: c.ts, close: c.close })),
      };
    }
    const symbol = assetClass === "fx" ? fxSymbol(pair) : pair;
    const candles = await fetchOandaCandleSeries(getOandaInstrument(symbol), window.openUtc, effectiveCloseUtc);
    if (!candles.length) return null;
    return {
      key: `${assetClass}|${pair}`,
      openPrice: candles[0].open,
      points: candles.map((c) => ({ ts: c.ts, close: c.close })),
    };
  } catch {
    return null;
  }
}

function getLatestClose(points: SeriesPoint[], ts: number): number | null {
  let left = 0;
  let right = points.length - 1;
  let best = -1;
  while (left <= right) {
    const mid = Math.floor((left + right) / 2);
    if (points[mid].ts <= ts) {
      best = mid;
      left = mid + 1;
    } else {
      right = mid - 1;
    }
  }
  return best < 0 ? null : points[best].close;
}

function buildDesiredMap(rows: Awaited<ReturnType<typeof readPerformanceSnapshotsByWeek>>) {
  const desired = new Map<string, { assetClass: AssetClass; pair: string; direction: 1 | -1; reportDate: string | null }>();
  for (const row of rows) {
    const assetClass = row.asset_class as AssetClass;
    for (const detail of row.pair_details) {
      if (detail.direction !== "LONG" && detail.direction !== "SHORT") continue;
      const direction = detail.direction === "LONG" ? 1 : -1;
      const key = `${row.model}|${assetClass}|${detail.pair}`;
      desired.set(key, { assetClass, pair: detail.pair, direction, reportDate: row.report_date ?? null });
    }
  }
  return desired;
}

async function runVariant(
  cfg: AdaptiveConfig,
  weeksAsc: Array<{ canonical: string; raw: string }>,
  hardStopMove: number,
  emergencyStop: number,
): Promise<VariantOut> {
  const seriesCache = new Map<string, SymbolSeries | null>();
  const open = new Map<string, Position>();
  let realized = 0;
  let overallPeakEquity = Number.NEGATIVE_INFINITY;
  let overallMinEquity = Number.POSITIVE_INFINITY;
  let overallGivebackMax = 0;

  const weekly: WeekMetrics[] = [];
  const historyPeaks: number[] = [];

  for (const weekInfo of weeksAsc) {
    const weekRaw = weekInfo.raw;
    const weekCanonical = weekInfo.canonical;
    const weekRows = await readPerformanceSnapshotsByWeek(weekRaw);
    const desired = buildDesiredMap(weekRows);
    const weekLabel = DateTime.fromISO(weekCanonical, { zone: "utc" }).toFormat("'Week of' MMM dd, yyyy");

    const histAvgPeak = mean(historyPeaks);
    const trailStart = historyPeaks.length
      ? clamp(histAvgPeak * cfg.startMult, cfg.minStart, cfg.maxStart)
      : cfg.warmupStart;
    const trailOffset = historyPeaks.length
      ? clamp(trailStart * cfg.offsetFracOfStart, cfg.minOffset, cfg.maxOffset)
      : cfg.warmupOffset;

    const needed = new Map<string, { assetClass: AssetClass; pair: string; reportDate: string | null }>();
    for (const pos of open.values())
      needed.set(`${pos.assetClass}|${pos.pair}`, { assetClass: pos.assetClass, pair: pos.pair, reportDate: null });
    for (const d of desired.values())
      needed.set(`${d.assetClass}|${d.pair}`, { assetClass: d.assetClass, pair: d.pair, reportDate: d.reportDate });

    for (const sym of needed.values()) {
      const ck = `${weekRaw}|${sym.assetClass}|${sym.pair}|${sym.reportDate ?? ""}`;
      if (!seriesCache.has(ck)) {
        seriesCache.set(
          ck,
          await fetchSeriesForSymbol({
            assetClass: sym.assetClass,
            pair: sym.pair,
            reportDate: sym.reportDate,
            weekOpenUtc: weekCanonical,
          }),
        );
      }
    }
    const getSeries = (assetClass: AssetClass, pair: string, reportDate: string | null) =>
      seriesCache.get(`${weekRaw}|${assetClass}|${pair}|${reportDate ?? ""}`) ?? null;

    let hardStopCloses = 0;
    let flipOrInvalidCloses = 0;
    let winnerTakeProfitCloses = 0;
    let winnersClosedFriday = 0;
    let emergencyTriggered = false;

    // refresh closes
    for (const [key, pos] of Array.from(open.entries())) {
      const wanted = desired.get(key);
      if (wanted && wanted.direction === pos.direction) continue;
      const s = getSeries(pos.assetClass, pos.pair, null);
      if (s && s.openPrice > 0 && pos.remaining > 0) {
        const unit = ((s.openPrice - pos.entryPrice) / pos.entryPrice) * 100 * pos.direction;
        realized += unit * pos.remaining;
      }
      open.delete(key);
      flipOrInvalidCloses += 1;
    }

    // open missing
    for (const [key, d] of desired.entries()) {
      if (open.has(key)) continue;
      const s = getSeries(d.assetClass, d.pair, d.reportDate);
      if (!s || s.openPrice <= 0) continue;
      open.set(key, { key, assetClass: d.assetClass, pair: d.pair, direction: d.direction, entryPrice: s.openPrice, remaining: 1.0 });
    }

    const bySymbol = new Map<string, SymbolSeries>();
    for (const pos of open.values()) {
      const s =
        getSeries(pos.assetClass, pos.pair, desired.get(pos.key)?.reportDate ?? null) ??
        getSeries(pos.assetClass, pos.pair, null);
      if (!s) continue;
      bySymbol.set(`${pos.assetClass}|${pos.pair}`, s);
    }
    const timestamps = Array.from(new Set(Array.from(bySymbol.values()).flatMap((s) => s.points.map((p) => p.ts)))).sort((a, b) => a - b);

    const unitPnlAt = (pos: Position, ts: number): number | null => {
      const s = bySymbol.get(`${pos.assetClass}|${pos.pair}`);
      if (!s) return null;
      const close = getLatestClose(s.points, ts);
      if (close === null || pos.entryPrice <= 0) return null;
      return ((close - pos.entryPrice) / pos.entryPrice) * 100 * pos.direction;
    };

    const firstTs = timestamps.length ? timestamps[0] : Date.parse(weekCanonical);
    const weekStartEquity = realized + Array.from(open.values()).reduce((sum, pos) => {
      const u = unitPnlAt(pos, firstTs);
      if (u === null) return sum;
      return sum + u * pos.remaining;
    }, 0);

    let weekPeakProfit = Number.NEGATIVE_INFINITY;
    let weekPeakEquity = Number.NEGATIVE_INFINITY;
    let weekGivebackMax = 0;
    let weekUnderwaterDd = 0;
    let weekEndEquity = weekStartEquity;
    let trailActive = false;
    let lockProfit = Number.NEGATIVE_INFINITY;
    let winnersTpDone = false;

    for (const ts of timestamps) {
      // hard stops
      for (const [key, pos] of Array.from(open.entries())) {
        const u = unitPnlAt(pos, ts);
        if (u === null) continue;
        if (u <= -Math.abs(hardStopMove)) {
          realized += u * pos.remaining;
          open.delete(key);
          hardStopCloses += 1;
        }
      }

      let floating = 0;
      for (const pos of open.values()) {
        const u = unitPnlAt(pos, ts);
        if (u === null) continue;
        floating += u * pos.remaining;
      }
      const equity = realized + floating;
      weekEndEquity = equity;

      if (equity <= -Math.abs(emergencyStop)) {
        for (const [key, pos] of Array.from(open.entries())) {
          const u = unitPnlAt(pos, ts);
          if (u === null) continue;
          realized += u * pos.remaining;
          open.delete(key);
        }
        emergencyTriggered = true;
      }

      const weekProfit = equity - weekStartEquity;
      if (weekProfit > weekPeakProfit) weekPeakProfit = weekProfit;
      if (equity > weekPeakEquity) weekPeakEquity = equity;
      const gb = weekPeakEquity - equity;
      if (gb > weekGivebackMax) weekGivebackMax = gb;
      if (weekProfit < 0) weekUnderwaterDd = Math.max(weekUnderwaterDd, -weekProfit);

      if (!winnersTpDone) {
        if (weekPeakProfit >= trailStart) {
          trailActive = true;
          lockProfit = Math.max(lockProfit, weekPeakProfit - trailOffset);
        }
        if (trailActive && weekProfit <= lockProfit) {
          for (const [key, pos] of Array.from(open.entries())) {
            const u = unitPnlAt(pos, ts);
            if (u === null || u <= 0) continue;
            realized += u * pos.remaining;
            open.delete(key);
            winnerTakeProfitCloses += 1;
          }
          winnersTpDone = true;
        }
      }

      if (equity > overallPeakEquity) overallPeakEquity = equity;
      if (equity < overallMinEquity) overallMinEquity = equity;
      if (Number.isFinite(overallPeakEquity)) {
        overallGivebackMax = Math.max(overallGivebackMax, overallPeakEquity - equity);
      }
    }

    // Friday close winners
    const lastTs = timestamps.length ? timestamps[timestamps.length - 1] : Date.parse(weekCanonical);
    for (const [key, pos] of Array.from(open.entries())) {
      const u = unitPnlAt(pos, lastTs);
      if (u === null || u <= 0) continue;
      realized += u * pos.remaining;
      open.delete(key);
      winnersClosedFriday += 1;
    }

    let endFloating = 0;
    for (const pos of open.values()) {
      const u = unitPnlAt(pos, lastTs);
      if (u === null) continue;
      endFloating += u * pos.remaining;
    }
    weekEndEquity = realized + endFloating;
    const weekEndProfit = weekEndEquity - weekStartEquity;
    const leftOnTable = Math.max(0, weekPeakProfit - weekEndProfit);

    weekly.push({
      week_open_utc: weekCanonical,
      week_label: weekLabel,
      trail_start_pct: fmt(trailStart),
      trail_offset_pct: fmt(trailOffset),
      week_return_pct: fmt(weekEndProfit),
      week_peak_profit_pct: fmt(weekPeakProfit),
      left_on_table_pct: fmt(leftOnTable),
      week_underwater_dd_pct: fmt(weekUnderwaterDd),
      week_giveback_dd_pct: fmt(weekGivebackMax),
      hard_stop_closes: hardStopCloses,
      flip_or_invalid_closes: flipOrInvalidCloses,
      winner_takeprofit_closes: winnerTakeProfitCloses,
      winners_closed_friday: winnersClosedFriday,
    });

    historyPeaks.push(Math.max(0, weekPeakProfit));

    if (emergencyTriggered) {
      // continue with next weeks flat if emergency happened.
    }
  }

  const total = weekly.reduce((s, w) => s + w.week_return_pct, 0);
  const wins = weekly.filter((w) => w.week_return_pct > 0).length;
  const avgLeft = weekly.length ? weekly.reduce((s, w) => s + w.left_on_table_pct, 0) / weekly.length : 0;
  const worstLeft = weekly.length ? Math.max(...weekly.map((w) => w.left_on_table_pct)) : 0;
  const avgUw = weekly.length ? weekly.reduce((s, w) => s + w.week_underwater_dd_pct, 0) / weekly.length : 0;
  const worstUw = weekly.length ? Math.max(...weekly.map((w) => w.week_underwater_dd_pct)) : 0;
  const avgGb = weekly.length ? weekly.reduce((s, w) => s + w.week_giveback_dd_pct, 0) / weekly.length : 0;
  const worstGb = weekly.length ? Math.max(...weekly.map((w) => w.week_giveback_dd_pct)) : 0;

  return {
    id: cfg.id,
    label: cfg.label,
    summary: {
      total_week_return_pct: fmt(total),
      avg_week_return_pct: fmt(weekly.length ? total / weekly.length : 0),
      win_rate_pct: fmt(weekly.length ? (wins * 100) / weekly.length : 0, 1),
      worst_week_return_pct: fmt(weekly.length ? Math.min(...weekly.map((w) => w.week_return_pct)) : 0),
      avg_left_on_table_pct: fmt(avgLeft),
      worst_left_on_table_pct: fmt(worstLeft),
      avg_week_underwater_dd_pct: fmt(avgUw),
      worst_week_underwater_dd_pct: fmt(worstUw),
      avg_week_giveback_dd_pct: fmt(avgGb),
      worst_week_giveback_dd_pct: fmt(worstGb),
      overall_baseline_underwater_dd_pct: fmt(Math.max(0, -overallMinEquity)),
      overall_peak_to_now_giveback_dd_pct: fmt(overallGivebackMax),
    },
    weekly,
  };
}

async function main() {
  loadDotEnv();
  const startWeekUtc = toCanonicalWeekOpen(process.env.TRUTH_START_WEEK ?? "2026-01-19T00:00:00Z");
  const startMs = Date.parse(startWeekUtc);
  const weeksLimit = Number(process.env.TRUTH_WEEKS ?? 12);
  const hardStopMove = Number(process.env.V1_HARD_STOP_MOVE_PCT ?? 10);
  const emergencyStop = Number(process.env.V1_EMERGENCY_BASELINE_STOP_PCT ?? 30);

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
      if (score > bestScore) {
        bestScore = score;
        bestRaw = raw;
      }
    }
    weekChoices.push({ canonical, raw: bestRaw, score: bestScore });
  }
  const weeksAsc = weekChoices
    .filter((w) => Date.parse(w.canonical) >= startMs)
    .sort((a, b) => Date.parse(a.canonical) - Date.parse(b.canonical))
    .slice(-weeksLimit);

  const configs: AdaptiveConfig[] = [
    {
      id: "adaptive_conservative",
      label: "Conservative (0.35x avg peak, 35% offset-of-start)",
      startMult: 0.35,
      offsetFracOfStart: 0.35,
      minStart: 20,
      maxStart: 90,
      minOffset: 6,
      maxOffset: 35,
      warmupStart: 30,
      warmupOffset: 10,
    },
    {
      id: "adaptive_balanced",
      label: "Balanced (0.5x avg peak, 30% offset-of-start)",
      startMult: 0.5,
      offsetFracOfStart: 0.30,
      minStart: 25,
      maxStart: 110,
      minOffset: 8,
      maxOffset: 40,
      warmupStart: 30,
      warmupOffset: 10,
    },
    {
      id: "adaptive_aggressive",
      label: "Aggressive (0.65x avg peak, 25% offset-of-start)",
      startMult: 0.65,
      offsetFracOfStart: 0.25,
      minStart: 30,
      maxStart: 130,
      minOffset: 8,
      maxOffset: 45,
      warmupStart: 30,
      warmupOffset: 10,
    },
    {
      id: "static_30_10",
      label: "Static 30/10 (control)",
      startMult: 0.0,
      offsetFracOfStart: 0.0,
      minStart: 30,
      maxStart: 30,
      minOffset: 10,
      maxOffset: 10,
      warmupStart: 30,
      warmupOffset: 10,
    },
  ];

  const variants: VariantOut[] = [];
  for (const cfg of configs) {
    const runCfg =
      cfg.id === "static_30_10"
        ? { ...cfg, startMult: 1, offsetFracOfStart: 0.333333, minStart: 30, maxStart: 30, minOffset: 10, maxOffset: 10 }
        : cfg;
    variants.push(await runVariant(runCfg, weeksAsc, hardStopMove, emergencyStop));
  }

  const ranked = [...variants].sort((a, b) => {
    const scoreA = a.summary.total_week_return_pct - a.summary.avg_left_on_table_pct * 0.6 - a.summary.avg_week_underwater_dd_pct * 0.3;
    const scoreB = b.summary.total_week_return_pct - b.summary.avg_left_on_table_pct * 0.6 - b.summary.avg_week_underwater_dd_pct * 0.3;
    return scoreB - scoreA;
  });

  const out = {
    generated_at: DateTime.utc().toISO(),
    start_week_utc: startWeekUtc,
    hard_stop_move_pct: hardStopMove,
    emergency_baseline_stop_pct: emergencyStop,
    ranking_note: "Score = total_return - 0.6*avg_left_on_table - 0.3*avg_underwater_dd",
    ranked_ids: ranked.map((v) => v.id),
    variants,
  };

  const stamp = DateTime.utc().toFormat("yyyy-LL-dd");
  const jsonPath = `reports/universal-v1-adaptive-trail-sweep-${stamp}.json`;
  const mdPath = `reports/universal-v1-adaptive-trail-sweep-${stamp}.md`;
  const latestJson = "reports/universal-v1-adaptive-trail-sweep-latest.json";
  const latestMd = "reports/universal-v1-adaptive-trail-sweep-latest.md";
  fs.writeFileSync(jsonPath, JSON.stringify(out, null, 2), "utf8");
  fs.writeFileSync(latestJson, JSON.stringify(out, null, 2), "utf8");

  const md: string[] = [];
  md.push("# Universal V1 Adaptive Trail Sweep");
  md.push("");
  md.push(`Generated: ${out.generated_at}`);
  md.push(`Start week: ${startWeekUtc}`);
  md.push(`Ranking: ${out.ranking_note}`);
  md.push("");
  md.push("| Variant | Total % | Avg Week % | Avg Left Table % | Avg Underwater DD % | Avg Giveback DD % | Overall Baseline DD % | Overall Giveback % |");
  md.push("| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |");
  for (const v of ranked) {
    md.push(
      `| ${v.id} | ${v.summary.total_week_return_pct} | ${v.summary.avg_week_return_pct} | ${v.summary.avg_left_on_table_pct} | ${v.summary.avg_week_underwater_dd_pct} | ${v.summary.avg_week_giveback_dd_pct} | ${v.summary.overall_baseline_underwater_dd_pct} | ${v.summary.overall_peak_to_now_giveback_dd_pct} |`,
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
  console.error("universal-v1-adaptive-trail-sweep failed:", error);
  process.exit(1);
});
