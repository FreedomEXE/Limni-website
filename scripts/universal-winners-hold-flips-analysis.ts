import fs from "node:fs";
import path from "node:path";
import { DateTime } from "luxon";
import { listPerformanceWeeks, readPerformanceSnapshotsByWeek } from "../src/lib/performanceSnapshots";
import { getCanonicalWeekOpenUtc } from "../src/lib/weekAnchor";
import { fetchBitgetCandleSeries } from "../src/lib/bitget";
import { fetchOandaCandleSeries, getOandaInstrument } from "../src/lib/oandaPrices";

type Timeframe = "H1";
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
};

type WeekResult = {
  week_open_utc: string;
  week_label: string;
  positions_at_start: number;
  positions_at_end: number;
  delta_pct: number;
  end_equity_pct: number;
  max_dd_pct: number;
  flips_closed: number;
  new_opened: number;
};

type VariantResult = {
  variant: "flip_only_no_trailing" | "flip_plus_winners_hourly_1pct";
  weekly: WeekResult[];
  total_pct: number;
  avg_weekly_pct: number;
  win_rate_pct: number;
  worst_week_pct: number;
  avg_weekly_max_dd_pct: number;
  worst_week_max_dd_pct: number;
  overall_max_dd_pct: number;
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
      const friday = sunday.plus({ days: 5 }).set({
        hour: 17,
        minute: 0,
        second: 0,
        millisecond: 0,
      });
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
  timeframe: Timeframe;
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
    const candles = await fetchOandaCandleSeries(
      getOandaInstrument(symbol),
      window.openUtc,
      effectiveCloseUtc,
    );
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
    for (let h = 20; h <= 23; h += 1) {
      events.push(dayEt.set({ hour: h, minute: 0, second: 0, millisecond: 0 }).toUTC().toMillis());
    }
    const nextDayEt = sundayEt.plus({ days: d + 1 });
    for (let h = 0; h <= 15; h += 1) {
      events.push(nextDayEt.set({ hour: h, minute: 0, second: 0, millisecond: 0 }).toUTC().toMillis());
    }
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

async function runVariant(
  weeksAsc: Array<{ canonical: string; raw: string }>,
  mode: "flip_only_no_trailing" | "flip_plus_winners_hourly_1pct",
): Promise<VariantResult> {
  const seriesCache = new Map<string, SymbolSeries | null>();
  const open = new Map<string, Position>();
  let realized = 0;
  const weekly: WeekResult[] = [];
  let overallPeak = Number.NEGATIVE_INFINITY;
  let overallMaxDd = 0;

  for (const weekInfo of weeksAsc) {
    const weekOpenUtc = weekInfo.raw;
    const weekCanonicalUtc = weekInfo.canonical;
    const rows = await readPerformanceSnapshotsByWeek(weekOpenUtc);
    const weekLabel = DateTime.fromISO(weekCanonicalUtc, { zone: "utc" }).toFormat("'Week of' MMM dd, yyyy");
    const desired = buildDesiredMap(rows);
    const positionsAtStart = open.size;

    const neededSymbols = new Map<string, { assetClass: AssetClass; pair: string; reportDate: string | null }>();
    for (const pos of open.values()) {
      neededSymbols.set(`${pos.assetClass}|${pos.pair}`, {
        assetClass: pos.assetClass,
        pair: pos.pair,
        reportDate: null,
      });
    }
    for (const d of desired.values()) {
      neededSymbols.set(`${d.assetClass}|${d.pair}`, {
        assetClass: d.assetClass,
        pair: d.pair,
        reportDate: d.reportDate,
      });
    }

    for (const sym of neededSymbols.values()) {
      const cacheKey = `${weekOpenUtc}|${sym.assetClass}|${sym.pair}|H1|${sym.reportDate ?? ""}`;
      if (!seriesCache.has(cacheKey)) {
        const fetched = await fetchSeriesForSymbol({
          assetClass: sym.assetClass,
          pair: sym.pair,
          reportDate: sym.reportDate,
          weekOpenUtc: weekCanonicalUtc,
          timeframe: "H1",
        });
        seriesCache.set(cacheKey, fetched);
      }
    }

    function getSeries(assetClass: AssetClass, pair: string, reportDate: string | null) {
      return seriesCache.get(`${weekOpenUtc}|${assetClass}|${pair}|H1|${reportDate ?? ""}`) ?? null;
    }

    // Close flips/invalid at week open.
    let flipsClosed = 0;
    for (const [key, pos] of Array.from(open.entries())) {
      const wanted = desired.get(key);
      if (wanted && wanted.direction === pos.direction) continue;
      const s = getSeries(pos.assetClass, pos.pair, null);
      if (s && s.openPrice > 0 && pos.remaining > 0) {
        const unit = ((s.openPrice - pos.entryPrice) / pos.entryPrice) * 100 * pos.direction;
        realized += unit * pos.remaining;
      }
      open.delete(key);
      flipsClosed += 1;
    }

    // Open new desired positions.
    let newOpened = 0;
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
      });
      newOpened += 1;
    }

    const seriesInWeek: SymbolSeries[] = [];
    const bySymbol = new Map<string, SymbolSeries>();
    for (const pos of open.values()) {
      const s = getSeries(pos.assetClass, pos.pair, desired.get(pos.key)?.reportDate ?? null) ??
        getSeries(pos.assetClass, pos.pair, null);
      if (!s) continue;
      const symKey = `${pos.assetClass}|${pos.pair}`;
      if (!bySymbol.has(symKey)) bySymbol.set(symKey, s);
    }
    seriesInWeek.push(...bySymbol.values());

    const timestamps = Array.from(new Set(seriesInWeek.flatMap((s) => s.points.map((p) => p.ts)))).sort(
      (a, b) => a - b,
    );
    if (!timestamps.length) {
      weekly.push({
        week_open_utc: weekCanonicalUtc,
        week_label: weekLabel,
        positions_at_start: positionsAtStart,
        positions_at_end: open.size,
        delta_pct: 0,
        end_equity_pct: fmt(realized),
        max_dd_pct: 0,
        flips_closed: flipsClosed,
        new_opened: newOpened,
      });
      continue;
    }

    let startEquity = NaN;
    let endEquity = realized;
    let weekPeak = Number.NEGATIVE_INFINITY;
    let weekMaxDd = 0;
    const events = mode === "flip_plus_winners_hourly_1pct" ? buildHourlyEventsForWeek(weekCanonicalUtc) : [];
    let eventIdx = 0;

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
          if (unit === null || unit <= 0) continue;
          const closeAmt = Math.min(0.01, pos.remaining);
          realized += unit * closeAmt;
          pos.remaining -= closeAmt;
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
      const equity = realized + floating;
      if (!Number.isFinite(startEquity)) startEquity = equity;
      endEquity = equity;

      if (equity > weekPeak) weekPeak = equity;
      if (Number.isFinite(weekPeak)) {
        const dd = weekPeak - equity;
        if (dd > weekMaxDd) weekMaxDd = dd;
      }

      if (equity > overallPeak) overallPeak = equity;
      if (Number.isFinite(overallPeak)) {
        const ddOverall = overallPeak - equity;
        if (ddOverall > overallMaxDd) overallMaxDd = ddOverall;
      }
    }

    if (!Number.isFinite(startEquity)) startEquity = realized;
    const delta = endEquity - startEquity;

    weekly.push({
      week_open_utc: weekCanonicalUtc,
      week_label: weekLabel,
      positions_at_start: positionsAtStart,
      positions_at_end: Array.from(open.values()).filter((p) => p.remaining > 0).length,
      delta_pct: fmt(delta),
      end_equity_pct: fmt(endEquity),
      max_dd_pct: fmt(weekMaxDd),
      flips_closed: flipsClosed,
      new_opened: newOpened,
    });
  }

  const total = weekly.reduce((s, w) => s + w.delta_pct, 0);
  const wins = weekly.filter((w) => w.delta_pct > 0).length;
  const avgWeekDd = weekly.length ? weekly.reduce((s, w) => s + w.max_dd_pct, 0) / weekly.length : 0;
  const worstWeekDd = weekly.length ? Math.max(...weekly.map((w) => w.max_dd_pct)) : 0;
  return {
    variant: mode,
    weekly,
    total_pct: fmt(total),
    avg_weekly_pct: fmt(weekly.length ? total / weekly.length : 0),
    win_rate_pct: fmt(weekly.length ? (wins * 100) / weekly.length : 0, 1),
    worst_week_pct: fmt(weekly.length ? Math.min(...weekly.map((w) => w.delta_pct)) : 0),
    avg_weekly_max_dd_pct: fmt(avgWeekDd),
    worst_week_max_dd_pct: fmt(worstWeekDd),
    overall_max_dd_pct: fmt(overallMaxDd),
  };
}

async function main() {
  loadDotEnv();
  const startWeekInput = process.env.TRUTH_START_WEEK ?? "2026-01-19T00:00:00Z";
  const startWeekUtc = toCanonicalWeekOpen(startWeekInput);
  const startMs = Date.parse(startWeekUtc);
  const weeksLimit = Number(process.env.TRUTH_WEEKS ?? 12);

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

  const noTrailing = await runVariant(weeksAsc, "flip_only_no_trailing");
  const winnersHourly = await runVariant(weeksAsc, "flip_plus_winners_hourly_1pct");

  const out = {
    generated_at: DateTime.utc().toISO(),
    assumptions: {
      start_week_utc: startWeekUtc,
      timeframe: "H1",
      policy: "close winners only; hold losers across weeks; close flips/invalid at weekly refresh",
      hourly_schedule_if_enabled: "1% per hour, active 20:00-15:00 ET, pause 16:00-19:59 ET",
      weeks: weeksAsc.map((w) => w.canonical),
    },
    variants: [noTrailing, winnersHourly],
  };

  const stamp = DateTime.utc().toFormat("yyyy-LL-dd");
  const jsonPath = `reports/universal-winners-hold-flips-analysis-${stamp}.json`;
  const mdPath = `reports/universal-winners-hold-flips-analysis-${stamp}.md`;
  const latestJsonPath = "reports/universal-winners-hold-flips-analysis-latest.json";
  const latestMdPath = "reports/universal-winners-hold-flips-analysis-latest.md";

  fs.writeFileSync(jsonPath, JSON.stringify(out, null, 2), "utf8");
  fs.writeFileSync(latestJsonPath, JSON.stringify(out, null, 2), "utf8");

  const md: string[] = [];
  md.push("# Universal Winners Hold + Weekly Flips Analysis");
  md.push("");
  md.push(`Generated: ${out.generated_at}`);
  md.push(`Start week: ${startWeekUtc}`);
  md.push("");
  md.push("## Summary");
  for (const v of out.variants) {
    md.push("");
    md.push(`### ${v.variant}`);
    md.push(`- Total %: ${v.total_pct}`);
    md.push(`- Avg weekly %: ${v.avg_weekly_pct}`);
    md.push(`- Win rate %: ${v.win_rate_pct}`);
    md.push(`- Worst week %: ${v.worst_week_pct}`);
    md.push(`- Avg weekly max DD %: ${v.avg_weekly_max_dd_pct}`);
    md.push(`- Worst weekly max DD %: ${v.worst_week_max_dd_pct}`);
    md.push(`- Overall max DD %: ${v.overall_max_dd_pct}`);
    md.push("");
    md.push("| Week | Delta % | End Equity % | Max DD % | Flips Closed | New Opened |");
    md.push("| --- | ---: | ---: | ---: | ---: | ---: |");
    for (const w of v.weekly) {
      md.push(`| ${w.week_label} | ${w.delta_pct} | ${w.end_equity_pct} | ${w.max_dd_pct} | ${w.flips_closed} | ${w.new_opened} |`);
    }
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
  console.error("universal-winners-hold-flips-analysis failed:", error);
  process.exit(1);
});
