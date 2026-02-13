import { readFileSync, writeFileSync } from "node:fs";
import { DateTime } from "luxon";
import { query } from "@/lib/db";
import { getOandaInstrument } from "@/lib/oandaPrices";

type PairDetail = {
  pair?: string;
  direction?: "LONG" | "SHORT";
  percent?: number;
};

type PerfRow = {
  week_open_utc: string;
  asset_class: string;
  model: string;
  pair_details: PairDetail[] | null;
};

type Trade = {
  weekOpenUtc: string;
  assetClass: string;
  model: string;
  pair: string;
  direction: "LONG" | "SHORT";
  percent: number;
};

type DailyBar = {
  tsMs: number;
  high: number;
  low: number;
};

type HourlyBar = {
  tsMs: number;
  open: number;
};

type ModelWeekResult = {
  week_open_utc: string;
  baseline_return: number;
  filtered_return: number;
  baseline_signals: number;
  filtered_signals: number;
  filtered_out: number;
  baseline_win_rate: number;
  filtered_win_rate: number;
};

type ModelSummary = {
  model: string;
  weeks: number;
  baseline_total_return: number;
  filtered_total_return: number;
  delta_return: number;
  baseline_max_drawdown: number;
  filtered_max_drawdown: number;
  delta_max_drawdown: number;
  baseline_total_signals: number;
  filtered_total_signals: number;
  signal_reduction_pct: number;
  baseline_avg_weekly: number;
  filtered_avg_weekly: number;
  baseline_win_rate: number;
  filtered_win_rate: number;
  filter_pass_rate: number;
};

type BacktestResult = {
  generated_at: string;
  lookback_years: number;
  weeks_requested: number;
  weeks_analyzed: number;
  symmetric_long_filter: boolean;
  models: string[];
  totals: {
    baseline_return: number;
    filtered_return: number;
    delta_return: number;
    baseline_max_drawdown: number;
    filtered_max_drawdown: number;
    delta_max_drawdown: number;
    baseline_signals: number;
    filtered_signals: number;
    signal_reduction_pct: number;
  };
  by_model: ModelSummary[];
  by_week_model: Record<string, ModelWeekResult[]>;
  diagnostics: {
    symbols_considered: number;
    symbols_with_daily_data: number;
    symbols_with_hourly_data: number;
    missing_entry_price_count: number;
    missing_lookback_range_count: number;
  };
};

function loadEnvFromFile() {
  const paths = [".env.local", ".env"];
  for (const file of paths) {
    try {
      const text = readFileSync(file, "utf-8");
      for (const rawLine of text.split(/\r?\n/)) {
        const line = rawLine.trim();
        if (!line || line.startsWith("#") || !line.includes("=")) continue;
        const idx = line.indexOf("=");
        const key = line.slice(0, idx).trim();
        const value = line.slice(idx + 1).trim();
        if (key && !process.env[key]) {
          process.env[key] = value;
        }
      }
    } catch {
      // ignore
    }
  }
}

function parseArg(name: string, fallback: string) {
  const prefix = `--${name}=`;
  const arg = process.argv.find((v) => v.startsWith(prefix));
  return arg ? arg.slice(prefix.length) : fallback;
}

function parseModelList(value: string): string[] {
  return value
    .split(",")
    .map((v) => v.trim().toLowerCase())
    .filter(Boolean);
}

function parseWeekUtc(value: string) {
  const iso = DateTime.fromISO(value, { zone: "utc" });
  if (iso.isValid) return iso;
  const sql = DateTime.fromSQL(value, { zone: "utc" });
  if (sql.isValid) return sql;
  return DateTime.invalid("invalid week datetime");
}

function mean(values: number[]) {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function pct(numerator: number, denominator: number) {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0) return 0;
  return (numerator / denominator) * 100;
}

function maxDrawdownFromWeeklyReturns(weeklyReturns: number[]) {
  let equity = 0;
  let peak = 0;
  let maxDd = 0;
  for (const r of weeklyReturns) {
    equity += r;
    if (equity > peak) peak = equity;
    const dd = peak - equity;
    if (dd > maxDd) maxDd = dd;
  }
  return maxDd;
}

function parseTradeRows(rows: PerfRow[], selectedModels: Set<string>): Trade[] {
  const trades: Trade[] = [];
  for (const row of rows) {
    const model = String(row.model ?? "").toLowerCase();
    if (!selectedModels.has(model)) continue;
    const details = Array.isArray(row.pair_details) ? row.pair_details : [];
    for (const d of details) {
      const pair = String(d?.pair ?? "").toUpperCase();
      const direction = d?.direction === "SHORT" ? "SHORT" : d?.direction === "LONG" ? "LONG" : null;
      const percent = Number(d?.percent);
      if (!pair || !direction || !Number.isFinite(percent)) continue;
      trades.push({
        weekOpenUtc: row.week_open_utc,
        assetClass: row.asset_class,
        model,
        pair,
        direction,
        percent,
      });
    }
  }
  return trades;
}

async function fetchDailyBarsWithHighLow(
  symbol: string,
  fromUtc: DateTime,
  toUtc: DateTime
): Promise<DailyBar[]> {
  const apiKey = process.env.OANDA_API_KEY ?? "";
  if (!apiKey) throw new Error("OANDA_API_KEY is not configured.");
  const instrument = getOandaInstrument(symbol);
  const env = process.env.OANDA_ENV === "live" ? "https://api-fxtrade.oanda.com" : "https://api-fxpractice.oanda.com";
  const url = new URL(`${env}/v3/instruments/${instrument}/candles`);
  url.searchParams.set("price", "M");
  url.searchParams.set("granularity", "D");
  url.searchParams.set("from", fromUtc.toUTC().toISO() ?? "");
  url.searchParams.set("to", toUtc.toUTC().toISO() ?? "");

  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Daily fetch failed (${symbol}) [${res.status}]: ${body}`);
  }

  const json = (await res.json()) as {
    candles?: Array<{
      time: string;
      complete: boolean;
      mid?: { h: string; l: string };
    }>;
  };

  return (json.candles ?? [])
    .filter((c) => c.complete && c.mid)
    .map((c) => {
      const tsMs = DateTime.fromISO(c.time, { zone: "utc" }).toMillis();
      const high = Number(c.mid?.h ?? NaN);
      const low = Number(c.mid?.l ?? NaN);
      return { tsMs, high, low };
    })
    .filter((c) => Number.isFinite(c.tsMs) && Number.isFinite(c.high) && Number.isFinite(c.low))
    .sort((a, b) => a.tsMs - b.tsMs);
}

async function fetchHourlyOpenSeries(
  symbol: string,
  fromUtc: DateTime,
  toUtc: DateTime
): Promise<HourlyBar[]> {
  const apiKey = process.env.OANDA_API_KEY ?? "";
  if (!apiKey) throw new Error("OANDA_API_KEY is not configured.");
  const instrument = getOandaInstrument(symbol);
  const env = process.env.OANDA_ENV === "live" ? "https://api-fxtrade.oanda.com" : "https://api-fxpractice.oanda.com";

  const all: HourlyBar[] = [];
  const maxBars = 4000;
  const stepHours = maxBars;
  let cursor = fromUtc;
  let page = 0;

  while (cursor.toMillis() < toUtc.toMillis() && page < 100) {
    page += 1;
    const pageEnd = DateTime.fromMillis(
      Math.min(toUtc.toMillis(), cursor.plus({ hours: stepHours }).toMillis()),
      { zone: "utc" }
    );
    const url = new URL(`${env}/v3/instruments/${instrument}/candles`);
    url.searchParams.set("price", "M");
    url.searchParams.set("granularity", "H1");
    url.searchParams.set("from", cursor.toUTC().toISO() ?? "");
    url.searchParams.set("to", pageEnd.toUTC().toISO() ?? "");

    const res = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Hourly fetch failed (${symbol}) [${res.status}]: ${body}`);
    }
    const json = (await res.json()) as {
      candles?: Array<{
        time: string;
        complete: boolean;
        mid?: { o: string };
      }>;
    };
    const bars = (json.candles ?? [])
      .filter((c) => c.complete && c.mid)
      .map((c) => {
        const tsMs = DateTime.fromISO(c.time, { zone: "utc" }).toMillis();
        const open = Number(c.mid?.o ?? NaN);
        return { tsMs, open };
      })
      .filter((c) => Number.isFinite(c.tsMs) && Number.isFinite(c.open))
      .sort((a, b) => a.tsMs - b.tsMs);

    if (bars.length === 0) break;
    all.push(...bars);
    const nextTs = bars[bars.length - 1].tsMs + 60 * 60 * 1000;
    if (nextTs <= cursor.toMillis()) break;
    cursor = DateTime.fromMillis(nextTs, { zone: "utc" });
  }

  return all.sort((a, b) => a.tsMs - b.tsMs);
}

function getEntryPrice(hourlyBars: HourlyBar[], weekOpenMs: number) {
  const bar = hourlyBars.find((b) => b.tsMs >= weekOpenMs);
  return bar?.open ?? null;
}

function getFiveYearRange(dailyBars: DailyBar[], weekOpenMs: number, lookbackYears: number) {
  const lookbackStartMs = DateTime.fromMillis(weekOpenMs, { zone: "utc" }).minus({ years: lookbackYears }).toMillis();
  let high = Number.NEGATIVE_INFINITY;
  let low = Number.POSITIVE_INFINITY;
  let count = 0;
  for (const b of dailyBars) {
    if (b.tsMs < lookbackStartMs || b.tsMs >= weekOpenMs) continue;
    if (b.high > high) high = b.high;
    if (b.low < low) low = b.low;
    count += 1;
  }
  if (count < 30 || !Number.isFinite(high) || !Number.isFinite(low) || high <= low) return null;
  return { high, low, bars: count };
}

function passRangeFilter(
  direction: "LONG" | "SHORT",
  entryPrice: number,
  high: number,
  low: number,
  symmetricLong: boolean
) {
  const distToLow = Math.max(entryPrice - low, 0);
  const distToHigh = Math.max(high - entryPrice, 0);
  if (direction === "SHORT") {
    return distToLow > distToHigh;
  }
  if (!symmetricLong) return true;
  return distToHigh > distToLow;
}

async function main() {
  loadEnvFromFile();
  const weeksRequested = Number.parseInt(parseArg("weeks", "20"), 10);
  const lookbackYears = Number.parseInt(parseArg("lookbackYears", "5"), 10);
  const modelArg = parseArg("models", "blended,dealer,commercial,sentiment,antikythera");
  const symmetricLongFilter = parseArg("symmetricLong", "false").toLowerCase() === "true";
  const modelList = parseModelList(modelArg);
  const selectedModels = new Set(modelList);

  const perfRows = await query<PerfRow>(
    `SELECT week_open_utc::text, asset_class, model, pair_details
     FROM performance_snapshots
     WHERE model = ANY($1::text[])
     ORDER BY week_open_utc DESC`,
    [modelList]
  );

  const weekKeys = Array.from(new Set(perfRows.map((r) => r.week_open_utc))).sort().reverse().slice(0, weeksRequested);
  const allowedWeeks = new Set(weekKeys);
  const trades = parseTradeRows(perfRows.filter((r) => allowedWeeks.has(r.week_open_utc)), selectedModels);
  if (trades.length === 0) {
    throw new Error("No trades found for requested models/weeks.");
  }

  const weekMsList = weekKeys
    .map((w) => parseWeekUtc(w))
    .filter((d) => d.isValid)
    .map((d) => d.toMillis())
    .sort((a, b) => a - b);
  const minWeekMs = weekMsList[0];
  const maxWeekMs = weekMsList[weekMsList.length - 1];

  const symbols = Array.from(new Set(trades.map((t) => t.pair))).sort();
  const dailyBySymbol = new Map<string, DailyBar[]>();
  const hourlyBySymbol = new Map<string, HourlyBar[]>();

  const dailyFrom = DateTime.fromMillis(minWeekMs, { zone: "utc" }).minus({ years: lookbackYears, days: 7 });
  const dailyTo = DateTime.fromMillis(maxWeekMs, { zone: "utc" }).plus({ days: 7 });
  const hourlyFrom = DateTime.fromMillis(minWeekMs, { zone: "utc" }).minus({ days: 1 });
  const hourlyTo = DateTime.fromMillis(maxWeekMs, { zone: "utc" }).plus({ days: 2 });

  let symbolsWithDaily = 0;
  let symbolsWithHourly = 0;
  for (const symbol of symbols) {
    try {
      const daily = await fetchDailyBarsWithHighLow(symbol, dailyFrom, dailyTo);
      dailyBySymbol.set(symbol, daily);
      if (daily.length > 0) symbolsWithDaily += 1;
    } catch {
      dailyBySymbol.set(symbol, []);
    }

    try {
      const hourly = await fetchHourlyOpenSeries(symbol, hourlyFrom, hourlyTo);
      hourlyBySymbol.set(symbol, hourly);
      if (hourly.length > 0) symbolsWithHourly += 1;
    } catch {
      hourlyBySymbol.set(symbol, []);
    }
  }

  let missingEntryPriceCount = 0;
  let missingLookbackRangeCount = 0;

  const byModelWeek = new Map<string, Map<string, ModelWeekResult>>();
  for (const t of trades) {
    if (!byModelWeek.has(t.model)) byModelWeek.set(t.model, new Map());
    const weekMap = byModelWeek.get(t.model)!;
    if (!weekMap.has(t.weekOpenUtc)) {
      weekMap.set(t.weekOpenUtc, {
        week_open_utc: t.weekOpenUtc,
        baseline_return: 0,
        filtered_return: 0,
        baseline_signals: 0,
        filtered_signals: 0,
        filtered_out: 0,
        baseline_win_rate: 0,
        filtered_win_rate: 0,
      });
    }
    const agg = weekMap.get(t.weekOpenUtc)!;
    agg.baseline_return += t.percent;
    agg.baseline_signals += 1;
    if (t.percent > 0) agg.baseline_win_rate += 1; // temporary wins counter

    const weekMs = parseWeekUtc(t.weekOpenUtc).toMillis();
    const entryPrice = getEntryPrice(hourlyBySymbol.get(t.pair) ?? [], weekMs);
    if (!Number.isFinite(entryPrice ?? NaN)) {
      missingEntryPriceCount += 1;
      agg.filtered_out += 1;
      continue;
    }

    const range = getFiveYearRange(dailyBySymbol.get(t.pair) ?? [], weekMs, lookbackYears);
    if (!range) {
      missingLookbackRangeCount += 1;
      agg.filtered_out += 1;
      continue;
    }

    const keep = passRangeFilter(t.direction, Number(entryPrice), range.high, range.low, symmetricLongFilter);
    if (!keep) {
      agg.filtered_out += 1;
      continue;
    }

    agg.filtered_signals += 1;
    agg.filtered_return += t.percent;
    if (t.percent > 0) agg.filtered_win_rate += 1; // temporary wins counter
  }

  const byWeekModel: Record<string, ModelWeekResult[]> = {};
  const summaries: ModelSummary[] = [];
  let totalBaselineReturn = 0;
  let totalFilteredReturn = 0;
  let totalBaselineSignals = 0;
  let totalFilteredSignals = 0;
  const totalWeeklyBaseline: number[] = [];
  const totalWeeklyFiltered: number[] = [];

  const allWeeksSorted = [...weekKeys].sort((a, b) => a.localeCompare(b));
  for (const w of allWeeksSorted) {
    let b = 0;
    let f = 0;
    for (const model of modelList) {
      const weekMap = byModelWeek.get(model);
      const row = weekMap?.get(w);
      if (!row) continue;
      b += row.baseline_return;
      f += row.filtered_return;
    }
    totalWeeklyBaseline.push(b);
    totalWeeklyFiltered.push(f);
  }

  for (const model of modelList) {
    const weekMap = byModelWeek.get(model) ?? new Map<string, ModelWeekResult>();
    const weeks = Array.from(weekMap.values()).sort((a, b) => a.week_open_utc.localeCompare(b.week_open_utc));
    for (const w of weeks) {
      w.baseline_win_rate = pct(w.baseline_win_rate, w.baseline_signals);
      w.filtered_win_rate = pct(w.filtered_win_rate, w.filtered_signals);
    }
    byWeekModel[model] = weeks;

    const baselineReturns = weeks.map((w) => w.baseline_return);
    const filteredReturns = weeks.map((w) => w.filtered_return);
    const baselineSignals = weeks.reduce((a, w) => a + w.baseline_signals, 0);
    const filteredSignals = weeks.reduce((a, w) => a + w.filtered_signals, 0);
    const baselineWinsTotal = weeks.reduce((a, w) => a + (w.baseline_win_rate / 100) * w.baseline_signals, 0);
    const filteredWinsTotal = weeks.reduce((a, w) => a + (w.filtered_win_rate / 100) * w.filtered_signals, 0);
    const baselineTotal = baselineReturns.reduce((a, b) => a + b, 0);
    const filteredTotal = filteredReturns.reduce((a, b) => a + b, 0);
    const baselineDd = maxDrawdownFromWeeklyReturns(baselineReturns);
    const filteredDd = maxDrawdownFromWeeklyReturns(filteredReturns);

    totalBaselineReturn += baselineTotal;
    totalFilteredReturn += filteredTotal;
    totalBaselineSignals += baselineSignals;
    totalFilteredSignals += filteredSignals;

    summaries.push({
      model,
      weeks: weeks.length,
      baseline_total_return: baselineTotal,
      filtered_total_return: filteredTotal,
      delta_return: filteredTotal - baselineTotal,
      baseline_max_drawdown: baselineDd,
      filtered_max_drawdown: filteredDd,
      delta_max_drawdown: filteredDd - baselineDd,
      baseline_total_signals: baselineSignals,
      filtered_total_signals: filteredSignals,
      signal_reduction_pct: pct(baselineSignals - filteredSignals, baselineSignals),
      baseline_avg_weekly: mean(baselineReturns),
      filtered_avg_weekly: mean(filteredReturns),
      baseline_win_rate: pct(baselineWinsTotal, baselineSignals),
      filtered_win_rate: pct(filteredWinsTotal, filteredSignals),
      filter_pass_rate: pct(filteredSignals, baselineSignals),
    });
  }

  const result: BacktestResult = {
    generated_at: new Date().toISOString(),
    lookback_years: lookbackYears,
    weeks_requested: weeksRequested,
    weeks_analyzed: weekKeys.length,
    symmetric_long_filter: symmetricLongFilter,
    models: modelList,
    totals: {
      baseline_return: totalBaselineReturn,
      filtered_return: totalFilteredReturn,
      delta_return: totalFilteredReturn - totalBaselineReturn,
      baseline_max_drawdown: maxDrawdownFromWeeklyReturns(totalWeeklyBaseline),
      filtered_max_drawdown: maxDrawdownFromWeeklyReturns(totalWeeklyFiltered),
      delta_max_drawdown:
        maxDrawdownFromWeeklyReturns(totalWeeklyFiltered) -
        maxDrawdownFromWeeklyReturns(totalWeeklyBaseline),
      baseline_signals: totalBaselineSignals,
      filtered_signals: totalFilteredSignals,
      signal_reduction_pct: pct(totalBaselineSignals - totalFilteredSignals, totalBaselineSignals),
    },
    by_model: summaries,
    by_week_model: byWeekModel,
    diagnostics: {
      symbols_considered: symbols.length,
      symbols_with_daily_data: symbolsWithDaily,
      symbols_with_hourly_data: symbolsWithHourly,
      missing_entry_price_count: missingEntryPriceCount,
      missing_lookback_range_count: missingLookbackRangeCount,
    },
  };

  const dateTag = DateTime.utc().toISODate();
  const variantTag = symmetricLongFilter ? "short-and-long" : "short-only";
  const baseName = `reports/range-filter-5y-backtest-${variantTag}-${dateTag}`;
  writeFileSync(`${baseName}.json`, JSON.stringify(result, null, 2));

  const md: string[] = [];
  md.push("# 5Y Range Filter Backtest");
  md.push("");
  md.push(`**Generated**: ${result.generated_at}`);
  md.push(`**Weeks analyzed**: ${result.weeks_analyzed}`);
  md.push(`**Models**: ${result.models.join(", ")}`);
  md.push(`**Short rule**: keep SHORT only when distance_to_low > distance_to_high`);
  md.push(`**Long rule**: ${symmetricLongFilter ? "symmetric filter enabled" : "not filtered"}`);
  md.push("");
  md.push("## Totals");
  md.push("");
  md.push(`- Baseline return: ${result.totals.baseline_return.toFixed(2)}%`);
  md.push(`- Filtered return: ${result.totals.filtered_return.toFixed(2)}%`);
  md.push(`- Delta: ${result.totals.delta_return >= 0 ? "+" : ""}${result.totals.delta_return.toFixed(2)}%`);
  md.push(`- Baseline max drawdown (weekly curve): ${result.totals.baseline_max_drawdown.toFixed(2)}%`);
  md.push(`- Filtered max drawdown (weekly curve): ${result.totals.filtered_max_drawdown.toFixed(2)}%`);
  md.push(`- Drawdown delta: ${result.totals.delta_max_drawdown >= 0 ? "+" : ""}${result.totals.delta_max_drawdown.toFixed(2)}%`);
  md.push(`- Signals: ${result.totals.filtered_signals}/${result.totals.baseline_signals} kept (${(100 - result.totals.signal_reduction_pct).toFixed(1)}% pass)`);
  md.push("");
  md.push("## By Model");
  md.push("");
  md.push("| Model | Weeks | Baseline % | Filtered % | Delta % | Baseline MDD % | Filtered MDD % | Delta MDD % | Baseline Signals | Filtered Signals | Pass % | Baseline Win % | Filtered Win % |");
  md.push("|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|");
  for (const row of result.by_model) {
    md.push(
      `| ${row.model} | ${row.weeks} | ${row.baseline_total_return.toFixed(2)} | ${row.filtered_total_return.toFixed(2)} | ${row.delta_return >= 0 ? "+" : ""}${row.delta_return.toFixed(2)} | ${row.baseline_max_drawdown.toFixed(2)} | ${row.filtered_max_drawdown.toFixed(2)} | ${row.delta_max_drawdown >= 0 ? "+" : ""}${row.delta_max_drawdown.toFixed(2)} | ${row.baseline_total_signals} | ${row.filtered_total_signals} | ${row.filter_pass_rate.toFixed(1)} | ${row.baseline_win_rate.toFixed(1)} | ${row.filtered_win_rate.toFixed(1)} |`
    );
  }
  md.push("");
  md.push("## Diagnostics");
  md.push("");
  md.push(`- Symbols considered: ${result.diagnostics.symbols_considered}`);
  md.push(`- Symbols with daily data: ${result.diagnostics.symbols_with_daily_data}`);
  md.push(`- Symbols with hourly data: ${result.diagnostics.symbols_with_hourly_data}`);
  md.push(`- Missing entry prices: ${result.diagnostics.missing_entry_price_count}`);
  md.push(`- Missing 5Y ranges: ${result.diagnostics.missing_lookback_range_count}`);
  md.push("");

  writeFileSync(`${baseName}.md`, md.join("\n"));

  console.log(`Wrote ${baseName}.json`);
  console.log(`Wrote ${baseName}.md`);
}

main().catch((error) => {
  console.error("Failed to run 5Y range filter backtest:", error);
  process.exit(1);
});
