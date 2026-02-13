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
  week_start_equity_pct: number;
  week_end_equity_pct: number;
  week_return_pct: number;
  week_peak_profit_pct: number;
  week_end_profit_pct: number;
  left_on_table_pct: number;
  week_underwater_dd_pct: number;
  week_giveback_dd_pct: number;
  hard_stop_closes: number;
  flip_or_invalid_closes: number;
  winner_takeprofit_closes: number;
  winners_closed_friday: number;
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

async function main() {
  loadDotEnv();

  const TRAIL_START = Number(process.env.V1_TRAIL_START_PCT ?? 30);
  const TRAIL_OFFSET = Number(process.env.V1_TRAIL_OFFSET_PCT ?? 10);
  const HARD_STOP_ADVERSE_MOVE = Number(process.env.V1_HARD_STOP_MOVE_PCT ?? 10);
  const EMERGENCY_BASELINE_STOP = Number(process.env.V1_EMERGENCY_BASELINE_STOP_PCT ?? 30);
  const weeksLimit = Number(process.env.TRUTH_WEEKS ?? 12);
  const startWeekUtc = toCanonicalWeekOpen(process.env.TRUTH_START_WEEK ?? "2026-01-19T00:00:00Z");
  const startMs = Date.parse(startWeekUtc);

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

  const seriesCache = new Map<string, SymbolSeries | null>();
  const open = new Map<string, Position>();

  let realized = 0;
  let emergencyTriggered = false;
  let overallPeakEquity = Number.NEGATIVE_INFINITY;
  let overallGivebackMax = 0;
  let overallMinEquity = Number.POSITIVE_INFINITY;
  const weekly: WeekMetrics[] = [];

  for (const weekInfo of weeksAsc) {
    const weekRaw = weekInfo.raw;
    const weekCanonical = weekInfo.canonical;
    const weekRows = await readPerformanceSnapshotsByWeek(weekRaw);
    const desired = buildDesiredMap(weekRows);
    const weekLabel = DateTime.fromISO(weekCanonical, { zone: "utc" }).toFormat("'Week of' MMM dd, yyyy");

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

    let flipOrInvalidCloses = 0;
    let hardStopCloses = 0;
    let winnerTakeProfitCloses = 0;
    let winnersClosedFriday = 0;

    // Weekly refresh: close invalid or opposite flip.
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

    // Open missing desired.
    if (!emergencyTriggered) {
      for (const [key, d] of desired.entries()) {
        if (open.has(key)) continue;
        const s = getSeries(d.assetClass, d.pair, d.reportDate);
        if (!s || s.openPrice <= 0) continue;
        open.set(key, {
          key,
          assetClass: d.assetClass,
          pair: d.pair,
          direction: d.direction,
          entryPrice: s.openPrice,
          remaining: 1.0,
        });
      }
    }

    const bySymbol = new Map<string, SymbolSeries>();
    for (const pos of open.values()) {
      const s =
        getSeries(pos.assetClass, pos.pair, desired.get(pos.key)?.reportDate ?? null) ??
        getSeries(pos.assetClass, pos.pair, null);
      if (!s) continue;
      bySymbol.set(`${pos.assetClass}|${pos.pair}`, s);
    }
    const timestamps = Array.from(new Set(Array.from(bySymbol.values()).flatMap((s) => s.points.map((p) => p.ts)))).sort(
      (a, b) => a - b,
    );

    const weekStartEquity = realized + Array.from(open.values()).reduce((sum, pos) => {
      const s = bySymbol.get(`${pos.assetClass}|${pos.pair}`);
      if (!s) return sum;
      const p0 = s.points.length ? s.points[0].close : s.openPrice;
      if (!p0 || pos.entryPrice <= 0) return sum;
      return sum + (((p0 - pos.entryPrice) / pos.entryPrice) * 100 * pos.direction * pos.remaining);
    }, 0);

    let weekPeakProfit = Number.NEGATIVE_INFINITY;
    let weekMinProfit = Number.POSITIVE_INFINITY;
    let weekPeakEquity = Number.NEGATIVE_INFINITY;
    let weekGivebackMax = 0;
    let weekUnderwaterDd = 0;
    let weekEndEquity = weekStartEquity;
    let basketTrailActive = false;
    let basketLockProfit = Number.NEGATIVE_INFINITY;
    let winnersTpDone = false;

    const unitPnlAt = (pos: Position, ts: number): number | null => {
      const s = bySymbol.get(`${pos.assetClass}|${pos.pair}`);
      if (!s) return null;
      const close = getLatestClose(s.points, ts);
      if (close === null || pos.entryPrice <= 0) return null;
      return ((close - pos.entryPrice) / pos.entryPrice) * 100 * pos.direction;
    };

    for (const ts of timestamps) {
      // Hard stop on adverse 10% move.
      for (const [key, pos] of Array.from(open.entries())) {
        if (pos.remaining <= 0) continue;
        const unit = unitPnlAt(pos, ts);
        if (unit === null) continue;
        if (unit <= -Math.abs(HARD_STOP_ADVERSE_MOVE)) {
          realized += unit * pos.remaining;
          open.delete(key);
          hardStopCloses += 1;
        }
      }

      let floating = 0;
      for (const pos of open.values()) {
        if (pos.remaining <= 0) continue;
        const unit = unitPnlAt(pos, ts);
        if (unit === null) continue;
        floating += unit * pos.remaining;
      }
      const equity = realized + floating;
      weekEndEquity = equity;

      // Emergency baseline stop.
      if (equity <= -Math.abs(EMERGENCY_BASELINE_STOP)) {
        for (const [key, pos] of Array.from(open.entries())) {
          const unit = unitPnlAt(pos, ts);
          if (unit === null) continue;
          realized += unit * pos.remaining;
          open.delete(key);
        }
        emergencyTriggered = true;
      }

      const weekProfit = equity - weekStartEquity;
      if (weekProfit > weekPeakProfit) weekPeakProfit = weekProfit;
      if (weekProfit < weekMinProfit) weekMinProfit = weekProfit;
      if (equity > weekPeakEquity) weekPeakEquity = equity;
      const weekDdNow = weekPeakEquity - equity;
      if (weekDdNow > weekGivebackMax) weekGivebackMax = weekDdNow;
      if (weekProfit < 0) {
        const uw = -weekProfit;
        if (uw > weekUnderwaterDd) weekUnderwaterDd = uw;
      }

      if (!winnersTpDone) {
        if (weekPeakProfit >= TRAIL_START) {
          basketTrailActive = true;
          const lock = weekPeakProfit - TRAIL_OFFSET;
          if (lock > basketLockProfit) basketLockProfit = lock;
        }
        if (basketTrailActive && weekProfit <= basketLockProfit) {
          // Basket trigger hit: close winners only, pro-rata (all winners fully closed).
          for (const [key, pos] of Array.from(open.entries())) {
            const unit = unitPnlAt(pos, ts);
            if (unit === null || unit <= 0 || pos.remaining <= 0) continue;
            realized += unit * pos.remaining;
            open.delete(key);
            winnerTakeProfitCloses += 1;
          }
          winnersTpDone = true;
        }
      }

      if (equity > overallPeakEquity) overallPeakEquity = equity;
      if (equity < overallMinEquity) overallMinEquity = equity;
      if (Number.isFinite(overallPeakEquity)) {
        const gb = overallPeakEquity - equity;
        if (gb > overallGivebackMax) overallGivebackMax = gb;
      }
    }

    // Friday close winners if still open.
    const lastTs = timestamps.length ? timestamps[timestamps.length - 1] : Date.parse(weekCanonical);
    for (const [key, pos] of Array.from(open.entries())) {
      const unit = unitPnlAt(pos, lastTs);
      if (unit === null || unit <= 0 || pos.remaining <= 0) continue;
      realized += unit * pos.remaining;
      open.delete(key);
      winnersClosedFriday += 1;
    }

    // Recompute week end after Friday winner close.
    let endFloating = 0;
    for (const pos of open.values()) {
      const unit = unitPnlAt(pos, lastTs);
      if (unit === null) continue;
      endFloating += unit * pos.remaining;
    }
    weekEndEquity = realized + endFloating;
    const weekEndProfit = weekEndEquity - weekStartEquity;
    const leftOnTable = Math.max(0, weekPeakProfit - weekEndProfit);

    weekly.push({
      week_open_utc: weekCanonical,
      week_label: weekLabel,
      week_start_equity_pct: fmt(weekStartEquity),
      week_end_equity_pct: fmt(weekEndEquity),
      week_return_pct: fmt(weekEndProfit),
      week_peak_profit_pct: fmt(weekPeakProfit),
      week_end_profit_pct: fmt(weekEndProfit),
      left_on_table_pct: fmt(leftOnTable),
      week_underwater_dd_pct: fmt(Math.max(0, weekUnderwaterDd)),
      week_giveback_dd_pct: fmt(Math.max(0, weekGivebackMax)),
      hard_stop_closes: hardStopCloses,
      flip_or_invalid_closes: flipOrInvalidCloses,
      winner_takeprofit_closes: winnerTakeProfitCloses,
      winners_closed_friday: winnersClosedFriday,
    });
  }

  const total = weekly.reduce((s, w) => s + w.week_return_pct, 0);
  const wins = weekly.filter((w) => w.week_return_pct > 0).length;
  const avgLeftTable = weekly.length ? weekly.reduce((s, w) => s + w.left_on_table_pct, 0) / weekly.length : 0;
  const worstLeftTable = weekly.length ? Math.max(...weekly.map((w) => w.left_on_table_pct)) : 0;
  const avgUwDd = weekly.length ? weekly.reduce((s, w) => s + w.week_underwater_dd_pct, 0) / weekly.length : 0;
  const worstUwDd = weekly.length ? Math.max(...weekly.map((w) => w.week_underwater_dd_pct)) : 0;
  const avgGiveback = weekly.length ? weekly.reduce((s, w) => s + w.week_giveback_dd_pct, 0) / weekly.length : 0;
  const worstGiveback = weekly.length ? Math.max(...weekly.map((w) => w.week_giveback_dd_pct)) : 0;
  const overallBaselineUnderwaterDd = Math.max(0, -overallMinEquity);

  const out = {
    generated_at: DateTime.utc().toISO(),
    assumptions: {
      start_week_utc: startWeekUtc,
      policy:
        "Winners harvested within week via basket-level peak lock + Friday winner close; losers carry if still valid; close flips/invalid at weekly refresh; 10% adverse hard stop; 30% baseline emergency stop",
      trail_start_pct: TRAIL_START,
      trail_offset_pct: TRAIL_OFFSET,
      hard_stop_adverse_move_pct: HARD_STOP_ADVERSE_MOVE,
      emergency_baseline_stop_pct: EMERGENCY_BASELINE_STOP,
      weeks: weeksAsc.map((w) => w.canonical),
    },
    summary: {
      total_week_return_pct: fmt(total),
      avg_week_return_pct: fmt(weekly.length ? total / weekly.length : 0),
      win_rate_pct: fmt(weekly.length ? (wins * 100) / weekly.length : 0, 1),
      worst_week_return_pct: fmt(weekly.length ? Math.min(...weekly.map((w) => w.week_return_pct)) : 0),
      avg_left_on_table_pct: fmt(avgLeftTable),
      worst_left_on_table_pct: fmt(worstLeftTable),
      avg_week_underwater_dd_pct: fmt(avgUwDd),
      worst_week_underwater_dd_pct: fmt(worstUwDd),
      avg_week_giveback_dd_pct: fmt(avgGiveback),
      worst_week_giveback_dd_pct: fmt(worstGiveback),
      overall_baseline_underwater_dd_pct: fmt(overallBaselineUnderwaterDd),
      overall_peak_to_now_giveback_dd_pct: fmt(overallGivebackMax),
      emergency_triggered: emergencyTriggered,
    },
    weekly,
  };

  const stamp = DateTime.utc().toFormat("yyyy-LL-dd");
  const jsonPath = `reports/universal-v1-policy-analysis-${stamp}.json`;
  const mdPath = `reports/universal-v1-policy-analysis-${stamp}.md`;
  const latestJson = "reports/universal-v1-policy-analysis-latest.json";
  const latestMd = "reports/universal-v1-policy-analysis-latest.md";
  fs.writeFileSync(jsonPath, JSON.stringify(out, null, 2), "utf8");
  fs.writeFileSync(latestJson, JSON.stringify(out, null, 2), "utf8");

  const md: string[] = [];
  md.push("# Universal V1 Policy Analysis");
  md.push("");
  md.push(`Generated: ${out.generated_at}`);
  md.push(`Start week: ${startWeekUtc}`);
  md.push("");
  md.push("## Summary");
  md.push(`- Total weekly return %: ${out.summary.total_week_return_pct}`);
  md.push(`- Avg weekly return %: ${out.summary.avg_week_return_pct}`);
  md.push(`- Win rate %: ${out.summary.win_rate_pct}`);
  md.push(`- Worst week return %: ${out.summary.worst_week_return_pct}`);
  md.push(`- Avg left on table %: ${out.summary.avg_left_on_table_pct}`);
  md.push(`- Worst left on table %: ${out.summary.worst_left_on_table_pct}`);
  md.push(`- Avg week underwater DD % (from week baseline): ${out.summary.avg_week_underwater_dd_pct}`);
  md.push(`- Worst week underwater DD % (from week baseline): ${out.summary.worst_week_underwater_dd_pct}`);
  md.push(`- Avg week giveback DD % (peak->trough): ${out.summary.avg_week_giveback_dd_pct}`);
  md.push(`- Worst week giveback DD % (peak->trough): ${out.summary.worst_week_giveback_dd_pct}`);
  md.push(`- Overall baseline underwater DD % (from account baseline): ${out.summary.overall_baseline_underwater_dd_pct}`);
  md.push(`- Overall peak giveback DD % (left on table): ${out.summary.overall_peak_to_now_giveback_dd_pct}`);
  md.push(`- Emergency stop triggered: ${out.summary.emergency_triggered}`);
  md.push("");
  md.push("| Week | Week Return % | Peak Profit % | End Profit % | Left On Table % | Underwater DD % | Giveback DD % | Hard Stops | Flip/Invalid Closes | Winner TP Closes | Friday Winner Closes |");
  md.push("| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |");
  for (const w of out.weekly) {
    md.push(
      `| ${w.week_label} | ${w.week_return_pct} | ${w.week_peak_profit_pct} | ${w.week_end_profit_pct} | ${w.left_on_table_pct} | ${w.week_underwater_dd_pct} | ${w.week_giveback_dd_pct} | ${w.hard_stop_closes} | ${w.flip_or_invalid_closes} | ${w.winner_takeprofit_closes} | ${w.winners_closed_friday} |`,
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
  console.error("universal-v1-policy-analysis failed:", error);
  process.exit(1);
});
