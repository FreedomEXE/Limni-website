import fs from "node:fs";
import path from "node:path";
import { DateTime } from "luxon";
import { listPerformanceWeeks, readPerformanceSnapshotsByWeek } from "../src/lib/performanceSnapshots";
import { getCanonicalWeekOpenUtc } from "../src/lib/weekAnchor";
import { fetchBitgetCandleSeries } from "../src/lib/bitget";
import { fetchOandaCandleSeries, getOandaInstrument } from "../src/lib/oandaPrices";

type AssetClass = "fx" | "indices" | "commodities" | "crypto";
type SeriesPoint = { ts: number; close: number };
type SymbolSeries = { key: string; openTs: number; closeTs: number; openPrice: number; points: SeriesPoint[] };

type Position = {
  key: string;
  assetClass: AssetClass;
  pair: string;
  direction: 1 | -1;
  entryPrice: number;
  remaining: number;
  original: number;
  addCount: number;
  neutralMode: boolean;
  trailPeak: number;
  trailLock: number | null;
};

type WeekResult = {
  week_open_utc: string;
  week_label: string;
  delta_pct: number;
  end_equity_pct: number;
  max_dd_pct: number;
  flips_closed: number;
  neutrals_carried: number;
  neutrals_closed_eow: number;
  new_opened: number;
  winner_adds: number;
};

type Result = {
  generated_at: string | null;
  assumptions: Record<string, unknown>;
  summary: {
    total_pct: number;
    avg_weekly_pct: number;
    win_rate_pct: number;
    worst_week_pct: number;
    avg_weekly_max_dd_pct: number;
    worst_week_max_dd_pct: number;
    overall_max_dd_pct: number;
  };
  weekly: WeekResult[];
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
        openTs: window.openUtc.toMillis(),
        closeTs: effectiveCloseUtc.toMillis(),
        openPrice: candles[0].open,
        points: candles.map((c) => ({ ts: c.ts, close: c.close })),
      };
    }
    const symbol = assetClass === "fx" ? fxSymbol(pair) : pair;
    const candles = await fetchOandaCandleSeries(getOandaInstrument(symbol), window.openUtc, effectiveCloseUtc);
    if (!candles.length) return null;
    return {
      key: `${assetClass}|${pair}`,
      openTs: window.openUtc.toMillis(),
      closeTs: effectiveCloseUtc.toMillis(),
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

function buildHourlyEventsForWeek(weekOpenUtc: string): number[] {
  const weekOpen = DateTime.fromISO(weekOpenUtc, { zone: "utc" });
  if (!weekOpen.isValid) return [];
  const sundayEt = weekOpen.setZone("America/New_York").startOf("day");
  const events: number[] = [];
  for (let d = 0; d <= 4; d += 1) {
    const dayEt = sundayEt.plus({ days: d });
    for (let h = 20; h <= 23; h += 1)
      events.push(dayEt.set({ hour: h, minute: 0, second: 0, millisecond: 0 }).toUTC().toMillis());
    const nextDayEt = sundayEt.plus({ days: d + 1 });
    for (let h = 0; h <= 15; h += 1)
      events.push(nextDayEt.set({ hour: h, minute: 0, second: 0, millisecond: 0 }).toUTC().toMillis());
  }
  return events.sort((a, b) => a - b);
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
  const startWeekUtc = toCanonicalWeekOpen(process.env.TRUTH_START_WEEK ?? "2026-01-19T00:00:00Z");
  const startMs = Date.parse(startWeekUtc);
  const weeksLimit = Number(process.env.TRUTH_WEEKS ?? 12);

  const WINNER_HOURLY_CLOSE = 0.01;
  const WINNER_ADD_SIZE = 0.25;
  const WINNER_MAX_ADDS = 1;
  const LOSER_ADD_HEAT_LIMIT = -5.0;
  const NEUTRAL_TRAIL_OFFSET = 5.0;

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
  let overallPeak = Number.NEGATIVE_INFINITY;
  let overallMaxDd = 0;
  const weekly: WeekResult[] = [];

  for (const weekInfo of weeksAsc) {
    const weekRaw = weekInfo.raw;
    const weekCanonical = weekInfo.canonical;
    const weekRows = await readPerformanceSnapshotsByWeek(weekRaw);
    const weekLabel = DateTime.fromISO(weekCanonical, { zone: "utc" }).toFormat("'Week of' MMM dd, yyyy");
    const desired = buildDesiredMap(weekRows);

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

    let flipsClosed = 0;
    let neutralsCarried = 0;
    let newOpened = 0;
    let winnerAdds = 0;

    // Weekly refresh: close opposite flips, mark neutral when missing.
    for (const [key, pos] of Array.from(open.entries())) {
      const wanted = desired.get(key);
      if (wanted && wanted.direction !== pos.direction) {
        const s = getSeries(pos.assetClass, pos.pair, null);
        if (s && s.openPrice > 0 && pos.remaining > 0) {
          const unit = ((s.openPrice - pos.entryPrice) / pos.entryPrice) * 100 * pos.direction;
          realized += unit * pos.remaining;
        }
        open.delete(key);
        flipsClosed += 1;
        continue;
      }
      if (!wanted) {
        pos.neutralMode = true;
        pos.trailPeak = Number.NEGATIVE_INFINITY;
        pos.trailLock = null;
        neutralsCarried += 1;
      } else {
        pos.neutralMode = false;
        pos.trailPeak = Number.NEGATIVE_INFINITY;
        pos.trailLock = null;
      }
    }

    // Open missing desired positions.
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
        original: 1.0,
        addCount: 0,
        neutralMode: false,
        trailPeak: Number.NEGATIVE_INFINITY,
        trailLock: null,
      });
      newOpened += 1;
    }

    // Winner add-ons at week open (constrained).
    for (const pos of open.values()) {
      if (pos.neutralMode) continue;
      if (pos.addCount >= WINNER_MAX_ADDS) continue;
      const s = getSeries(pos.assetClass, pos.pair, desired.get(pos.key)?.reportDate ?? null) ?? getSeries(pos.assetClass, pos.pair, null);
      if (!s || s.openPrice <= 0) continue;
      const unit = ((s.openPrice - pos.entryPrice) / pos.entryPrice) * 100 * pos.direction;
      if (unit > 0) {
        pos.remaining += WINNER_ADD_SIZE;
        pos.original += WINNER_ADD_SIZE;
        pos.addCount += 1;
        winnerAdds += 1;
      } else if (unit >= LOSER_ADD_HEAT_LIMIT) {
        // explicitly no loser add in this version; just a heat gate placeholder
      }
    }

    const bySymbol = new Map<string, SymbolSeries>();
    for (const pos of open.values()) {
      const s = getSeries(pos.assetClass, pos.pair, desired.get(pos.key)?.reportDate ?? null) ?? getSeries(pos.assetClass, pos.pair, null);
      if (!s) continue;
      bySymbol.set(`${pos.assetClass}|${pos.pair}`, s);
    }
    const timestamps = Array.from(new Set(Array.from(bySymbol.values()).flatMap((s) => s.points.map((p) => p.ts)))).sort((a, b) => a - b);
    const events = buildHourlyEventsForWeek(weekCanonical);
    let eventIdx = 0;

    let startEq = NaN;
    let endEq = realized;
    let weekPeak = Number.NEGATIVE_INFINITY;
    let weekMaxDd = 0;
    let neutralsClosedEow = 0;

    const unitPnlAt = (pos: Position, ts: number): number | null => {
      const s = bySymbol.get(`${pos.assetClass}|${pos.pair}`);
      if (!s) return null;
      const close = getLatestClose(s.points, ts);
      if (close === null || pos.entryPrice <= 0) return null;
      return ((close - pos.entryPrice) / pos.entryPrice) * 100 * pos.direction;
    };

    for (const ts of timestamps) {
      while (eventIdx < events.length && events[eventIdx] <= ts) {
        const eventTs = events[eventIdx];
        for (const pos of open.values()) {
          if (pos.remaining <= 0) continue;
          const unit = unitPnlAt(pos, eventTs);
          if (unit === null) continue;

          // Winners-only hourly 1% profit taking.
          if (unit > 0) {
            const closeAmt = Math.min(WINNER_HOURLY_CLOSE, pos.remaining);
            realized += unit * closeAmt;
            pos.remaining -= closeAmt;
          }

          // Neutral tighter trailing.
          if (pos.neutralMode) {
            if (unit > pos.trailPeak) pos.trailPeak = unit;
            if (Number.isFinite(pos.trailPeak)) {
              const lock = pos.trailPeak - NEUTRAL_TRAIL_OFFSET;
              if (pos.trailLock === null || lock > pos.trailLock) pos.trailLock = lock;
            }
            if (pos.trailLock !== null && unit <= pos.trailLock && pos.remaining > 0) {
              realized += unit * pos.remaining;
              pos.remaining = 0;
            }
          }
        }
        eventIdx += 1;
      }

      let floating = 0;
      for (const pos of open.values()) {
        if (pos.remaining <= 0) continue;
        const unit = unitPnlAt(pos, ts);
        if (unit === null) continue;
        floating += unit * pos.remaining;
      }
      const eq = realized + floating;
      if (!Number.isFinite(startEq)) startEq = eq;
      endEq = eq;

      if (eq > weekPeak) weekPeak = eq;
      if (Number.isFinite(weekPeak)) {
        const dd = weekPeak - eq;
        if (dd > weekMaxDd) weekMaxDd = dd;
      }
      if (eq > overallPeak) overallPeak = eq;
      if (Number.isFinite(overallPeak)) {
        const dd = overallPeak - eq;
        if (dd > overallMaxDd) overallMaxDd = dd;
      }
    }

    // Friday EOW forced close for neutral positions.
    const lastTs = timestamps.length ? timestamps[timestamps.length - 1] : Date.parse(weekCanonical);
    for (const pos of open.values()) {
      if (!pos.neutralMode || pos.remaining <= 0) continue;
      const unit = unitPnlAt(pos, lastTs);
      if (unit === null) continue;
      realized += unit * pos.remaining;
      pos.remaining = 0;
      neutralsClosedEow += 1;
    }

    // Clean empty positions.
    for (const [k, p] of Array.from(open.entries())) {
      if (p.remaining <= 1e-9) open.delete(k);
    }

    if (!Number.isFinite(startEq)) startEq = realized;
    weekly.push({
      week_open_utc: weekCanonical,
      week_label: weekLabel,
      delta_pct: fmt(endEq - startEq),
      end_equity_pct: fmt(endEq),
      max_dd_pct: fmt(weekMaxDd),
      flips_closed: flipsClosed,
      neutrals_carried: neutralsCarried,
      neutrals_closed_eow: neutralsClosedEow,
      new_opened: newOpened,
      winner_adds: winnerAdds,
    });
  }

  const total = weekly.reduce((s, w) => s + w.delta_pct, 0);
  const wins = weekly.filter((w) => w.delta_pct > 0).length;
  const avgDd = weekly.length ? weekly.reduce((s, w) => s + w.max_dd_pct, 0) / weekly.length : 0;
  const worstDd = weekly.length ? Math.max(...weekly.map((w) => w.max_dd_pct)) : 0;

  const out: Result = {
    generated_at: DateTime.utc().toISO(),
    assumptions: {
      start_week_utc: startWeekUtc,
      timeframe: "H1",
      policy:
        "flip opposite immediately; neutral hold with tight trailing and EOW close; winners-only 1% hourly scaleout; winner-only capped add-ons",
      winner_hourly_close_pct: 1,
      winner_add_size: WINNER_ADD_SIZE,
      winner_max_adds: WINNER_MAX_ADDS,
      loser_add_heat_limit_pct: LOSER_ADD_HEAT_LIMIT,
      neutral_trail_offset_pct: NEUTRAL_TRAIL_OFFSET,
      schedule_et: "20:00-15:00 active, 16:00-19:59 pause",
      weeks: weeksAsc.map((w) => w.canonical),
    },
    summary: {
      total_pct: fmt(total),
      avg_weekly_pct: fmt(weekly.length ? total / weekly.length : 0),
      win_rate_pct: fmt(weekly.length ? (wins * 100) / weekly.length : 0, 1),
      worst_week_pct: fmt(weekly.length ? Math.min(...weekly.map((w) => w.delta_pct)) : 0),
      avg_weekly_max_dd_pct: fmt(avgDd),
      worst_week_max_dd_pct: fmt(worstDd),
      overall_max_dd_pct: fmt(overallMaxDd),
    },
    weekly,
  };

  const stamp = DateTime.utc().toFormat("yyyy-LL-dd");
  const jsonPath = `reports/universal-hybrid-policy-analysis-${stamp}.json`;
  const mdPath = `reports/universal-hybrid-policy-analysis-${stamp}.md`;
  const latestJson = "reports/universal-hybrid-policy-analysis-latest.json";
  const latestMd = "reports/universal-hybrid-policy-analysis-latest.md";
  fs.writeFileSync(jsonPath, JSON.stringify(out, null, 2), "utf8");
  fs.writeFileSync(latestJson, JSON.stringify(out, null, 2), "utf8");

  const md: string[] = [];
  md.push("# Universal Hybrid Policy Analysis");
  md.push("");
  md.push(`Generated: ${out.generated_at}`);
  md.push(`Start week: ${startWeekUtc}`);
  md.push("");
  md.push("## Summary");
  md.push(`- Total %: ${out.summary.total_pct}`);
  md.push(`- Avg weekly %: ${out.summary.avg_weekly_pct}`);
  md.push(`- Win rate %: ${out.summary.win_rate_pct}`);
  md.push(`- Worst week %: ${out.summary.worst_week_pct}`);
  md.push(`- Avg weekly max DD %: ${out.summary.avg_weekly_max_dd_pct}`);
  md.push(`- Worst weekly max DD %: ${out.summary.worst_week_max_dd_pct}`);
  md.push(`- Overall max DD %: ${out.summary.overall_max_dd_pct}`);
  md.push("");
  md.push("| Week | Delta % | End Equity % | Max DD % | Flips Closed | Neutrals Carried | Neutrals Closed EOW | New Opened | Winner Adds |");
  md.push("| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |");
  for (const w of out.weekly) {
    md.push(
      `| ${w.week_label} | ${w.delta_pct} | ${w.end_equity_pct} | ${w.max_dd_pct} | ${w.flips_closed} | ${w.neutrals_carried} | ${w.neutrals_closed_eow} | ${w.new_opened} | ${w.winner_adds} |`,
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
  console.error("universal-hybrid-policy-analysis failed:", error);
  process.exit(1);
});

