import fs from "node:fs";
import path from "node:path";
import { DateTime } from "luxon";
import { listPerformanceWeeks, readPerformanceSnapshotsByWeek } from "../src/lib/performanceSnapshots";
import { getCanonicalWeekOpenUtc } from "../src/lib/weekAnchor";
import { fetchBitgetCandleSeries } from "../src/lib/bitget";
import { fetchOandaCandleSeries, getOandaInstrument } from "../src/lib/oandaPrices";

type AssetClass = "fx" | "indices" | "commodities" | "crypto";
type PositionMode = "HEDGED" | "NET";
type SeriesPoint = { ts: number; close: number };
type SymbolSeries = { key: string; openPrice: number; points: SeriesPoint[] };

type Position = {
  key: string;
  assetClass: AssetClass;
  pair: string;
  direction: 1 | -1;
  entryPrice: number;
  riskWeight: number;
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
  per_trade_sl_closes: number;
  basket_tp_closes: number;
  basket_sl_closes: number;
  flip_or_invalid_closes: number;
  friday_close_all: number;
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
        (value.startsWith('"') && value.endsWith('"')) ||
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

function buildDesiredMapWithMode(
  rows: Awaited<ReturnType<typeof readPerformanceSnapshotsByWeek>>,
  positionMode: PositionMode,
) {
  const desired = new Map<
    string,
    { assetClass: AssetClass; pair: string; direction: 1 | -1; reportDate: string | null; units: number }
  >();

  if (positionMode === "HEDGED") {
    for (const row of rows) {
      const assetClass = row.asset_class as AssetClass;
      for (const detail of row.pair_details) {
        if (detail.direction !== "LONG" && detail.direction !== "SHORT") continue;
        const direction = detail.direction === "LONG" ? 1 : -1;
        const key = `${row.model}|${assetClass}|${detail.pair}`;
        desired.set(key, {
          assetClass,
          pair: detail.pair,
          direction,
          reportDate: row.report_date ?? null,
          units: 1,
        });
      }
    }
    return desired;
  }

  const netBySymbol = new Map<string, { assetClass: AssetClass; pair: string; signed: number; reportDate: string | null }>();
  for (const row of rows) {
    const assetClass = row.asset_class as AssetClass;
    for (const detail of row.pair_details) {
      if (detail.direction !== "LONG" && detail.direction !== "SHORT") continue;
      const direction = detail.direction === "LONG" ? 1 : -1;
      const key = `${assetClass}|${detail.pair}`;
      const curr = netBySymbol.get(key) ?? { assetClass, pair: detail.pair, signed: 0, reportDate: null };
      curr.signed += direction;
      if (!curr.reportDate && row.report_date) curr.reportDate = row.report_date;
      netBySymbol.set(key, curr);
    }
  }

  for (const [key, leg] of netBySymbol.entries()) {
    if (leg.signed === 0) continue;
    desired.set(key, {
      assetClass: leg.assetClass,
      pair: leg.pair,
      direction: leg.signed > 0 ? 1 : -1,
      reportDate: leg.reportDate,
      units: Math.abs(leg.signed),
    });
  }

  return desired;
}

async function main() {
  loadDotEnv();

  const LOW_RISK_SCALE = Number(process.env.FUNDED_LOW_RISK_SCALE ?? 0.10);
  const POSITION_MODE_RAW = String(process.env.FUNDED_POSITION_MODE ?? "HEDGED").toUpperCase();
  const POSITION_MODE: PositionMode = POSITION_MODE_RAW === "NET" ? "NET" : "HEDGED";
  const FX_SCALE_MULT = Number(process.env.FUNDED_FX_SCALE_MULT ?? 1);
  const NON_FX_SCALE_MULT = Number(process.env.FUNDED_NON_FX_SCALE_MULT ?? 1);
  const INDICES_SCALE_MULT = Number(process.env.FUNDED_INDICES_SCALE_MULT ?? NON_FX_SCALE_MULT);
  const COMMODITIES_SCALE_MULT = Number(process.env.FUNDED_COMMODITIES_SCALE_MULT ?? NON_FX_SCALE_MULT);
  const CRYPTO_SCALE_MULT = Number(process.env.FUNDED_CRYPTO_SCALE_MULT ?? NON_FX_SCALE_MULT);
  const BASKET_TP = Number(process.env.FUNDED_BASKET_TP_PCT ?? 6);
  const BASKET_SL = Number(process.env.FUNDED_BASKET_SL_PCT ?? 3);
  const PER_TRADE_SL = Number(process.env.FUNDED_PER_TRADE_SL_PCT ?? 1);

  const riskScaleForAsset = (assetClass: AssetClass) => {
    if (assetClass === "fx") return Math.max(0, LOW_RISK_SCALE * FX_SCALE_MULT);
    if (assetClass === "indices") return Math.max(0, LOW_RISK_SCALE * INDICES_SCALE_MULT);
    if (assetClass === "commodities") return Math.max(0, LOW_RISK_SCALE * COMMODITIES_SCALE_MULT);
    if (assetClass === "crypto") return Math.max(0, LOW_RISK_SCALE * CRYPTO_SCALE_MULT);
    return Math.max(0, LOW_RISK_SCALE);
  };

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
  let overallPeakEquity = Number.NEGATIVE_INFINITY;
  let overallGivebackMax = 0;
  let overallMinEquity = Number.POSITIVE_INFINITY;
  const weekly: WeekMetrics[] = [];

  for (const weekInfo of weeksAsc) {
    const weekRaw = weekInfo.raw;
    const weekCanonical = weekInfo.canonical;
    const weekRows = await readPerformanceSnapshotsByWeek(weekRaw);
    const desired = buildDesiredMapWithMode(weekRows, POSITION_MODE);
    const weekLabel = DateTime.fromISO(weekCanonical, { zone: "utc" }).toFormat("'Week of' MMM dd, yyyy");

    const needed = new Map<string, { assetClass: AssetClass; pair: string; reportDate: string | null }>();
    for (const pos of open.values()) {
      needed.set(`${pos.assetClass}|${pos.pair}`, { assetClass: pos.assetClass, pair: pos.pair, reportDate: null });
    }
    for (const d of desired.values()) {
      needed.set(`${d.assetClass}|${d.pair}`, { assetClass: d.assetClass, pair: d.pair, reportDate: d.reportDate });
    }

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
    let perTradeSlCloses = 0;
    let basketTpCloses = 0;
    let basketSlCloses = 0;
    let fridayCloseAll = 0;

    // Weekly refresh: close invalid/opposite from prior week.
    for (const [key, pos] of Array.from(open.entries())) {
      const wanted = desired.get(key);
      if (wanted && wanted.direction === pos.direction) continue;
      const s = getSeries(pos.assetClass, pos.pair, null);
      if (s && s.openPrice > 0) {
        const unit = ((s.openPrice - pos.entryPrice) / pos.entryPrice) * 100 * pos.direction;
        realized += unit * pos.riskWeight;
      }
      open.delete(key);
      flipOrInvalidCloses += 1;
    }

    // Open weekly desired (no intra-week re-entry after basket close).
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
        riskWeight: riskScaleForAsset(d.assetClass) * Math.max(1, d.units),
      });
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
      return sum + u * pos.riskWeight;
    }, 0);

    let weekPeakProfit = Number.NEGATIVE_INFINITY;
    let weekPeakEquity = Number.NEGATIVE_INFINITY;
    let weekGivebackMax = 0;
    let weekUnderwaterDd = 0;
    let weekEndEquity = weekStartEquity;
    let basketClosed = false;

    for (const ts of timestamps) {
      // Per-trade SL cap: close a leg when its contribution reaches -PER_TRADE_SL % equity.
      for (const [key, pos] of Array.from(open.entries())) {
        const u = unitPnlAt(pos, ts);
        if (u === null) continue;
        const contrib = u * pos.riskWeight;
        if (contrib <= -Math.abs(PER_TRADE_SL)) {
          realized += contrib;
          open.delete(key);
          perTradeSlCloses += 1;
        }
      }

      let floating = 0;
      for (const pos of open.values()) {
        const u = unitPnlAt(pos, ts);
        if (u === null) continue;
        floating += u * pos.riskWeight;
      }
      const equity = realized + floating;
      weekEndEquity = equity;

      const weekProfit = equity - weekStartEquity;
      if (weekProfit > weekPeakProfit) weekPeakProfit = weekProfit;
      if (equity > weekPeakEquity) weekPeakEquity = equity;
      const gb = weekPeakEquity - equity;
      if (gb > weekGivebackMax) weekGivebackMax = gb;
      if (weekProfit < 0) weekUnderwaterDd = Math.max(weekUnderwaterDd, -weekProfit);

      if (!basketClosed && open.size > 0) {
        if (weekProfit >= Math.abs(BASKET_TP)) {
          for (const [key, pos] of Array.from(open.entries())) {
            const u = unitPnlAt(pos, ts);
            if (u === null) continue;
            realized += u * pos.riskWeight;
            open.delete(key);
          }
          basketTpCloses += 1;
          basketClosed = true;
        } else if (weekProfit <= -Math.abs(BASKET_SL)) {
          for (const [key, pos] of Array.from(open.entries())) {
            const u = unitPnlAt(pos, ts);
            if (u === null) continue;
            realized += u * pos.riskWeight;
            open.delete(key);
          }
          basketSlCloses += 1;
          basketClosed = true;
        }
      }

      if (equity > overallPeakEquity) overallPeakEquity = equity;
      if (equity < overallMinEquity) overallMinEquity = equity;
      if (Number.isFinite(overallPeakEquity)) {
        overallGivebackMax = Math.max(overallGivebackMax, overallPeakEquity - equity);
      }
    }

    // End-of-week: flat all remaining positions (no loser carry).
    const lastTs = timestamps.length ? timestamps[timestamps.length - 1] : Date.parse(weekCanonical);
    for (const [key, pos] of Array.from(open.entries())) {
      const u = unitPnlAt(pos, lastTs);
      if (u === null) continue;
      realized += u * pos.riskWeight;
      open.delete(key);
      fridayCloseAll += 1;
    }

    let endFloating = 0;
    for (const pos of open.values()) {
      const u = unitPnlAt(pos, lastTs);
      if (u === null) continue;
      endFloating += u * pos.riskWeight;
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
      week_underwater_dd_pct: fmt(weekUnderwaterDd),
      week_giveback_dd_pct: fmt(weekGivebackMax),
      per_trade_sl_closes: perTradeSlCloses,
      basket_tp_closes: basketTpCloses,
      basket_sl_closes: basketSlCloses,
      flip_or_invalid_closes: flipOrInvalidCloses,
      friday_close_all: fridayCloseAll,
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

  const out = {
    generated_at: DateTime.utc().toISO(),
    assumptions: {
      start_week_utc: startWeekUtc,
      policy:
        "Funded profile simulation: configurable sizing scale, fixed basket TP/SL, no adaptive trail, no cross-week loser carry, per-trade loss capped by equity contribution threshold",
      position_mode: POSITION_MODE,
      low_risk_scale: LOW_RISK_SCALE,
      fx_scale_mult: FX_SCALE_MULT,
      non_fx_scale_mult: NON_FX_SCALE_MULT,
      indices_scale_mult: INDICES_SCALE_MULT,
      commodities_scale_mult: COMMODITIES_SCALE_MULT,
      crypto_scale_mult: CRYPTO_SCALE_MULT,
      basket_takeprofit_pct: BASKET_TP,
      basket_stoploss_pct: BASKET_SL,
      per_trade_stoploss_pct: PER_TRADE_SL,
      weeks: weeksAsc.map((w) => w.canonical),
      note:
        "Per-trade SL is simulated as close when single-leg equity contribution <= -per_trade_stoploss_pct. This is an equity-contribution proxy, not broker stop-distance emulation.",
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
      overall_baseline_underwater_dd_pct: fmt(Math.max(0, -overallMinEquity)),
      overall_peak_to_now_giveback_dd_pct: fmt(overallGivebackMax),
      basket_tp_hits: weekly.reduce((s, w) => s + w.basket_tp_closes, 0),
      basket_sl_hits: weekly.reduce((s, w) => s + w.basket_sl_closes, 0),
      per_trade_sl_hits: weekly.reduce((s, w) => s + w.per_trade_sl_closes, 0),
    },
    weekly,
  };

  const stamp = DateTime.utc().toFormat("yyyy-LL-dd");
  const jsonPath = `reports/universal-v1-funded-policy-sim-${stamp}.json`;
  const mdPath = `reports/universal-v1-funded-policy-sim-${stamp}.md`;
  const latestJson = "reports/universal-v1-funded-policy-sim-latest.json";
  const latestMd = "reports/universal-v1-funded-policy-sim-latest.md";

  fs.writeFileSync(jsonPath, JSON.stringify(out, null, 2), "utf8");
  fs.writeFileSync(latestJson, JSON.stringify(out, null, 2), "utf8");

  const md: string[] = [];
  md.push("# Universal V1 Funded Policy Simulation");
  md.push("");
  md.push(`Generated: ${out.generated_at}`);
  md.push(`Start week: ${startWeekUtc}`);
  md.push("");
  md.push("## Summary");
  md.push(`- Total weekly return %: ${out.summary.total_week_return_pct}`);
  md.push(`- Avg weekly return %: ${out.summary.avg_week_return_pct}`);
  md.push(`- Win rate %: ${out.summary.win_rate_pct}`);
  md.push(`- Worst week return %: ${out.summary.worst_week_return_pct}`);
  md.push(`- Avg underwater DD %: ${out.summary.avg_week_underwater_dd_pct}`);
  md.push(`- Worst underwater DD %: ${out.summary.worst_week_underwater_dd_pct}`);
  md.push(`- Basket TP hits: ${out.summary.basket_tp_hits}`);
  md.push(`- Basket SL hits: ${out.summary.basket_sl_hits}`);
  md.push(`- Per-trade SL hits: ${out.summary.per_trade_sl_hits}`);
  md.push("");
  md.push("| Week | Return % | Peak % | End % | Underwater DD % | Giveback DD % | Basket TP | Basket SL | Per-Trade SL | Flip/Invalid | Friday Close-All |\n| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |");
  for (const w of out.weekly) {
    md.push(
      `| ${w.week_label} | ${w.week_return_pct} | ${w.week_peak_profit_pct} | ${w.week_end_profit_pct} | ${w.week_underwater_dd_pct} | ${w.week_giveback_dd_pct} | ${w.basket_tp_closes} | ${w.basket_sl_closes} | ${w.per_trade_sl_closes} | ${w.flip_or_invalid_closes} | ${w.friday_close_all} |`,
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
  console.error("universal-v1-funded-policy-sim failed:", error);
  process.exit(1);
});
