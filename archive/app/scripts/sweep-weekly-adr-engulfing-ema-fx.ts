/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: sweep-weekly-adr-engulfing-ema-fx.ts
 *
 * Description:
 * Runs an FX-only study for weekly bias + ADR zone + 1H engulfing
 * confirmation + 5m EMA50 structure filter.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { DateTime } from "luxon";
import { Client } from "pg";
import { getCanonicalWeekWindow } from "../src/lib/canonicalPriceWindows";
import { fetchOanda5MinuteSeries } from "../src/lib/oandaPrices";

function loadEnvFileIntoProcess(filePath: string) {
  if (!existsSync(filePath)) return;
  const lines = readFileSync(filePath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIndex = trimmed.indexOf("=");
    if (eqIndex <= 0) continue;
    const key = trimmed.slice(0, eqIndex).trim();
    const value = trimmed.slice(eqIndex + 1);
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

const REPO_ROOT = path.resolve(__dirname, "..");
loadEnvFileIntoProcess(path.join(REPO_ROOT, ".env"));
loadEnvFileIntoProcess(path.join(REPO_ROOT, ".env.local"));

const ADR_LOOKBACK_DAYS = 10;
const ADR_MIN_REQUIRED_DAYS = 5;
const ADR_MULTIPLIERS = [0.75, 1.0, 1.25, 1.5] as const;
const EMA_LENGTH = 50;

type TradeDirection = "LONG" | "SHORT";
type AssetClass = "fx";

type NettedPairRow = {
  symbol: string;
  assetClass: AssetClass;
  direction: TradeDirection;
};

type WeeklyReturnRow = {
  weekOpenUtc: string;
  breakdown: {
    nettedPairs: NettedPairRow[];
  };
};

type SystemRow = {
  system: string;
  weeklyReturns: WeeklyReturnRow[];
};

type CanonicalReport = {
  composite_systems: SystemRow[];
  composite_systems_gated: SystemRow[];
  standalone_models: SystemRow[];
  standalone_models_gated: SystemRow[];
};

type Observation = {
  key: string;
  weekOpenUtc: string;
  symbol: string;
  direction: TradeDirection;
  sourceSystems: string[];
};

type WeeklyPriceRow = {
  open_price: number | string;
  close_price: number | string;
};

type DailyPriceRow = {
  open_price: number | string;
  high_price: number | string | null;
  low_price: number | string | null;
};

type HourlyBarRow = {
  bar_open_utc: Date;
  bar_close_utc: Date;
  open_price: number | string;
  high_price: number | string;
  low_price: number | string;
  close_price: number | string;
};

type HourlyBar = {
  openUtc: string;
  closeUtc: string;
  openPrice: number;
  highPrice: number;
  lowPrice: number;
  closePrice: number;
};

type M5Bar = {
  ts: number;
  close: number;
};

type AdrWindow = {
  adrPct: number;
  barsUsed: number;
};

type ThresholdStats = {
  multiplier: number;
  sampleCount: number;
  zoneTouchedCount: number;
  engulfConfirmedCount: number;
  emaConfirmedCount: number;
  zoneTouchRatePct: number;
  engulfConfirmRatePct: number;
  emaConfirmRatePct: number;
  emaAfterEngulfPct: number;
  avgExecutionReturnPct: number;
  avgConfirmedTradeReturnPct: number;
  confirmedTradeWinRatePct: number;
  postEntryMaeHitMinus100Pct: number;
  avgHoursToTouch: number;
  avgHoursTouchToEngulf: number;
};

function round(value: number, places = 4) {
  if (!Number.isFinite(value)) return 0;
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

function toFinite(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function loadCanonicalReport(): CanonicalReport {
  const reportPath = path.join(REPO_ROOT, "reports", "comprehensive-reconstruction.json");
  return JSON.parse(readFileSync(reportPath, "utf8")) as CanonicalReport;
}

function listAllSystems(report: CanonicalReport) {
  return [
    ...report.composite_systems,
    ...report.composite_systems_gated,
    ...report.standalone_models,
    ...report.standalone_models_gated,
  ];
}

function buildUniqueFxObservations(report: CanonicalReport) {
  const map = new Map<string, Observation>();
  for (const system of listAllSystems(report)) {
    for (const week of system.weeklyReturns) {
      for (const pair of week.breakdown.nettedPairs) {
        if (pair.assetClass !== "fx") continue;
        const key = `${week.weekOpenUtc}|${pair.symbol}|${pair.direction}`;
        const existing = map.get(key);
        if (existing) {
          existing.sourceSystems.push(system.system);
          continue;
        }
        map.set(key, {
          key,
          weekOpenUtc: week.weekOpenUtc,
          symbol: pair.symbol,
          direction: pair.direction,
          sourceSystems: [system.system],
        });
      }
    }
  }
  return [...map.values()];
}

function computeReturnPct(direction: TradeDirection, entryPrice: number, exitPrice: number) {
  return direction === "LONG"
    ? ((exitPrice / entryPrice) - 1) * 100
    : ((entryPrice / exitPrice) - 1) * 100;
}

function isEngulfing(direction: TradeDirection, previous: HourlyBar | undefined, current: HourlyBar | undefined) {
  if (!previous || !current) return false;
  return direction === "LONG"
    ? current.closePrice > previous.highPrice
    : current.closePrice < previous.lowPrice;
}

function computeEma(values: number[], length: number) {
  const out: Array<number | null> = Array.from({ length: values.length }, () => null);
  if (values.length === 0) return out;
  const multiplier = 2 / (length + 1);
  let ema: number | null = null;
  let seedSum = 0;
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index]!;
    if (index < length) {
      seedSum += value;
      if (index === length - 1) {
        ema = seedSum / length;
        out[index] = ema;
      }
      continue;
    }
    if (ema === null) continue;
    ema = value * multiplier + ema * (1 - multiplier);
    out[index] = ema;
  }
  return out;
}

function buildM5CloseEma50(candles: M5Bar[]) {
  const closes = candles.map((row) => row.close);
  const emaValues = computeEma(closes, EMA_LENGTH);
  return candles.map((row, index) => ({
    ts: row.ts,
    close: row.close,
    ema50: emaValues[index],
  }));
}

function findLatestM5StateAtOrBefore(
  candles: Array<{ ts: number; close: number; ema50: number | null }>,
  tsMs: number,
) {
  let latest: { ts: number; close: number; ema50: number | null } | null = null;
  for (const candle of candles) {
    if (candle.ts > tsMs) break;
    latest = candle;
  }
  return latest;
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required.");
  }

  const report = loadCanonicalReport();
  const observations = buildUniqueFxObservations(report);

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL.includes("render.com") ? { rejectUnauthorized: false } : false,
  });
  await client.connect();

  const weeklyPriceCache = new Map<string, { openPrice: number; closePrice: number }>();
  const hourlyBarCache = new Map<string, HourlyBar[]>();
  const adrCache = new Map<string, AdrWindow | null>();
  const m5Cache = new Map<string, Array<{ ts: number; close: number; ema50: number | null }>>();

  async function getWeeklyPrices(symbol: string, weekOpenUtc: string) {
    const cacheKey = `${symbol}|${weekOpenUtc}`;
    const cached = weeklyPriceCache.get(cacheKey);
    if (cached) return cached;
    const result = await client.query<WeeklyPriceRow>(
      `SELECT open_price, close_price
         FROM pair_period_returns
        WHERE symbol = $1
          AND period_type = 'weekly'
          AND period_open_utc = $2::timestamptz
        LIMIT 1`,
      [symbol, weekOpenUtc],
    );
    if (result.rowCount === 0) {
      throw new Error(`Missing weekly pair_period_returns row for ${symbol} ${weekOpenUtc}`);
    }
    const mapped = {
      openPrice: toFinite(result.rows[0]?.open_price),
      closePrice: toFinite(result.rows[0]?.close_price),
    };
    weeklyPriceCache.set(cacheKey, mapped);
    return mapped;
  }

  async function getHourlyBars(symbol: string, weekOpenUtc: string) {
    const cacheKey = `${symbol}|${weekOpenUtc}|hourly`;
    const cached = hourlyBarCache.get(cacheKey);
    if (cached) return cached;
    const window = getCanonicalWeekWindow(weekOpenUtc, "fx");
    const result = await client.query<HourlyBarRow>(
      `SELECT bar_open_utc, bar_close_utc, open_price, high_price, low_price, close_price
         FROM canonical_price_bars
        WHERE symbol = $1
          AND timeframe = '1h'
          AND bar_open_utc >= $2::timestamptz
          AND bar_open_utc < $3::timestamptz
        ORDER BY bar_open_utc ASC`,
      [symbol, window.openUtc.toISO(), window.closeUtc.toISO()],
    );
    const mapped = result.rows.map((row) => ({
      openUtc: row.bar_open_utc.toISOString(),
      closeUtc: row.bar_close_utc.toISOString(),
      openPrice: toFinite(row.open_price),
      highPrice: toFinite(row.high_price),
      lowPrice: toFinite(row.low_price),
      closePrice: toFinite(row.close_price),
    }));
    hourlyBarCache.set(cacheKey, mapped);
    return mapped;
  }

  async function getAdrWindow(symbol: string, weekOpenUtc: string) {
    const cacheKey = `${symbol}|${weekOpenUtc}|adr`;
    if (adrCache.has(cacheKey)) {
      return adrCache.get(cacheKey) ?? null;
    }
    const window = getCanonicalWeekWindow(weekOpenUtc, "fx");
    const result = await client.query<DailyPriceRow>(
      `SELECT open_price, high_price, low_price
         FROM pair_period_returns
        WHERE symbol = $1
          AND period_type = 'daily'
          AND period_open_utc < $2::timestamptz
        ORDER BY period_open_utc DESC
        LIMIT $3`,
      [symbol, window.openUtc.toISO(), ADR_LOOKBACK_DAYS],
    );

    const validRanges = result.rows
      .map((row) => {
        const openPrice = toFinite(row.open_price);
        const highPrice = row.high_price === null ? null : toFinite(row.high_price);
        const lowPrice = row.low_price === null ? null : toFinite(row.low_price);
        if (openPrice <= 0 || highPrice === null || lowPrice === null) {
          return null;
        }
        return ((highPrice - lowPrice) / openPrice) * 100;
      })
      .filter((value): value is number => value !== null && Number.isFinite(value));

    if (validRanges.length < ADR_MIN_REQUIRED_DAYS) {
      adrCache.set(cacheKey, null);
      return null;
    }

    const adrPct = validRanges.reduce((sum, value) => sum + value, 0) / validRanges.length;
    const mapped = { adrPct, barsUsed: validRanges.length };
    adrCache.set(cacheKey, mapped);
    return mapped;
  }

  async function getM5EmaSeries(symbol: string, weekOpenUtc: string) {
    const cacheKey = `${symbol}|${weekOpenUtc}|m5ema`;
    const cached = m5Cache.get(cacheKey);
    if (cached) return cached;
    const window = getCanonicalWeekWindow(weekOpenUtc, "fx");
    const fetchFrom = window.openUtc.minus({ days: 2 });
    const fetchTo = window.closeUtc;
    const candles = await fetchOanda5MinuteSeries(symbol, fetchFrom, fetchTo);
    const m5 = candles
      .filter((row) => row.ts >= fetchFrom.toMillis() && row.ts < fetchTo.toMillis())
      .map((row) => ({ ts: row.ts, close: row.close }));
    const emaSeries = buildM5CloseEma50(m5);
    m5Cache.set(cacheKey, emaSeries);
    return emaSeries;
  }

  const eligibleObservations: Observation[] = [];
  const baselineByObservation = new Map<string, number>();
  const adrByObservation = new Map<string, AdrWindow>();

  for (const observation of observations) {
    const adr = await getAdrWindow(observation.symbol, observation.weekOpenUtc);
    const hourlyBars = await getHourlyBars(observation.symbol, observation.weekOpenUtc);
    const m5Bars = await getM5EmaSeries(observation.symbol, observation.weekOpenUtc);
    if (!adr || hourlyBars.length < 2 || m5Bars.length < EMA_LENGTH) continue;
    const weeklyPrices = await getWeeklyPrices(observation.symbol, observation.weekOpenUtc);
    baselineByObservation.set(
      observation.key,
      computeReturnPct(observation.direction, weeklyPrices.openPrice, weeklyPrices.closePrice),
    );
    adrByObservation.set(observation.key, adr);
    eligibleObservations.push(observation);
  }

  const results: ThresholdStats[] = ADR_MULTIPLIERS.map((multiplier) => ({
    multiplier,
    sampleCount: eligibleObservations.length,
    zoneTouchedCount: 0,
    engulfConfirmedCount: 0,
    emaConfirmedCount: 0,
    zoneTouchRatePct: 0,
    engulfConfirmRatePct: 0,
    emaConfirmRatePct: 0,
    emaAfterEngulfPct: 0,
    avgExecutionReturnPct: 0,
    avgConfirmedTradeReturnPct: 0,
    confirmedTradeWinRatePct: 0,
    postEntryMaeHitMinus100Pct: 0,
    avgHoursToTouch: 0,
    avgHoursTouchToEngulf: 0,
  }));

  const postEntryMaeHits = new Map<number, { count: number; confirmed: number }>();
  const confirmedWins = new Map<number, number>();
  const hoursToTouch = new Map<number, number[]>();
  const hoursTouchToEngulf = new Map<number, number[]>();
  for (const multiplier of ADR_MULTIPLIERS) {
    postEntryMaeHits.set(multiplier, { count: 0, confirmed: 0 });
    confirmedWins.set(multiplier, 0);
    hoursToTouch.set(multiplier, []);
    hoursTouchToEngulf.set(multiplier, []);
  }

  for (const observation of eligibleObservations) {
    const weeklyPrices = await getWeeklyPrices(observation.symbol, observation.weekOpenUtc);
    const hourlyBars = await getHourlyBars(observation.symbol, observation.weekOpenUtc);
    const m5Series = await getM5EmaSeries(observation.symbol, observation.weekOpenUtc);
    const adr = adrByObservation.get(observation.key)!;

    for (const row of results) {
      const thresholdPct = adr.adrPct * row.multiplier;
      const triggerPrice =
        observation.direction === "LONG"
          ? weeklyPrices.openPrice * (1 - thresholdPct / 100)
          : weeklyPrices.openPrice * (1 + thresholdPct / 100);

      let touchIndex = -1;
      for (let index = 0; index < hourlyBars.length; index += 1) {
        const bar = hourlyBars[index]!;
        const touched =
          observation.direction === "LONG"
            ? bar.lowPrice <= triggerPrice
            : bar.highPrice >= triggerPrice;
        if (touched) {
          touchIndex = index;
          row.zoneTouchedCount += 1;
          hoursToTouch.get(row.multiplier)!.push(index + 1);
          break;
        }
      }
      if (touchIndex === -1) continue;

      let engulfIndex = -1;
      for (let index = Math.max(1, touchIndex + 1); index < hourlyBars.length; index += 1) {
        if (isEngulfing(observation.direction, hourlyBars[index - 1], hourlyBars[index])) {
          engulfIndex = index;
          row.engulfConfirmedCount += 1;
          hoursTouchToEngulf.get(row.multiplier)!.push(index - touchIndex);
          break;
        }
      }
      if (engulfIndex === -1) continue;

      const engulfBar = hourlyBars[engulfIndex]!;
      const engulfCloseMs = DateTime.fromISO(engulfBar.closeUtc, { zone: "utc" }).toMillis();
      const latestM5 = findLatestM5StateAtOrBefore(m5Series, engulfCloseMs);
      if (!latestM5 || latestM5.ema50 === null) continue;

      const emaPass =
        observation.direction === "LONG"
          ? engulfBar.closePrice > latestM5.ema50
          : engulfBar.closePrice < latestM5.ema50;
      if (!emaPass) continue;

      row.emaConfirmedCount += 1;
      const entryPrice = engulfBar.closePrice;
      const executionReturnPct = computeReturnPct(
        observation.direction,
        entryPrice,
        weeklyPrices.closePrice,
      );
      row.avgExecutionReturnPct += executionReturnPct;
      row.avgConfirmedTradeReturnPct += executionReturnPct;
      if (executionReturnPct > 0) {
        confirmedWins.set(row.multiplier, (confirmedWins.get(row.multiplier) ?? 0) + 1);
      }

      let worstMaePct = 0;
      for (let index = engulfIndex + 1; index < hourlyBars.length; index += 1) {
        const bar = hourlyBars[index]!;
        const adversePct =
          observation.direction === "LONG"
            ? ((bar.lowPrice / entryPrice) - 1) * 100
            : ((entryPrice / bar.highPrice) - 1) * 100;
        if (adversePct < worstMaePct) {
          worstMaePct = adversePct;
        }
      }
      const mae = postEntryMaeHits.get(row.multiplier)!;
      mae.confirmed += 1;
      if (worstMaePct <= -1.0) {
        mae.count += 1;
      }
    }
  }

  for (const row of results) {
    row.zoneTouchRatePct = row.sampleCount > 0 ? round((row.zoneTouchedCount / row.sampleCount) * 100, 4) : 0;
    row.engulfConfirmRatePct = row.sampleCount > 0 ? round((row.engulfConfirmedCount / row.sampleCount) * 100, 4) : 0;
    row.emaConfirmRatePct = row.sampleCount > 0 ? round((row.emaConfirmedCount / row.sampleCount) * 100, 4) : 0;
    row.emaAfterEngulfPct =
      row.engulfConfirmedCount > 0 ? round((row.emaConfirmedCount / row.engulfConfirmedCount) * 100, 4) : 0;
    row.avgExecutionReturnPct =
      row.sampleCount > 0 ? round(row.avgExecutionReturnPct / row.sampleCount, 6) : 0;
    row.avgConfirmedTradeReturnPct =
      row.emaConfirmedCount > 0 ? round(row.avgConfirmedTradeReturnPct / row.emaConfirmedCount, 6) : 0;
    row.confirmedTradeWinRatePct =
      row.emaConfirmedCount > 0
        ? round(((confirmedWins.get(row.multiplier) ?? 0) / row.emaConfirmedCount) * 100, 4)
        : 0;
    const mae = postEntryMaeHits.get(row.multiplier)!;
    row.postEntryMaeHitMinus100Pct =
      mae.confirmed > 0 ? round((mae.count / mae.confirmed) * 100, 4) : 0;
    const touchHours = hoursToTouch.get(row.multiplier)!;
    const engulfHours = hoursTouchToEngulf.get(row.multiplier)!;
    row.avgHoursToTouch =
      touchHours.length > 0 ? round(touchHours.reduce((sum, value) => sum + value, 0) / touchHours.length, 4) : 0;
    row.avgHoursTouchToEngulf =
      engulfHours.length > 0 ? round(engulfHours.reduce((sum, value) => sum + value, 0) / engulfHours.length, 4) : 0;
  }

  const bestByExecutionReturn = [...results].sort((left, right) => right.avgExecutionReturnPct - left.avgExecutionReturnPct)[0] ?? null;
  const bestByConfirmedTrade = [...results].sort((left, right) => right.avgConfirmedTradeReturnPct - left.avgConfirmedTradeReturnPct)[0] ?? null;
  const cleanest = [...results].sort((left, right) => left.postEntryMaeHitMinus100Pct - right.postEntryMaeHitMinus100Pct)[0] ?? null;
  const recommended = [...results]
    .filter((row) => row.emaConfirmRatePct >= 10 && row.postEntryMaeHitMinus100Pct <= 20)
    .sort((left, right) => right.avgExecutionReturnPct - left.avgExecutionReturnPct)[0]
    ?? bestByExecutionReturn;

  await client.end();

  const output = {
    generatedUtc: new Date().toISOString(),
    methodology: {
      universe: "fx_only",
      mode: "replacement_confirmed",
      confirmation: "1h_engulfing_plus_5m_ema50",
      observationBasis: "unique_pair_week_direction_occurrences_across_all_26_canonical_systems",
      eligibleObservations: eligibleObservations.length,
      adrLookbackDays: ADR_LOOKBACK_DAYS,
      adrMinimumRequiredDays: ADR_MIN_REQUIRED_DAYS,
      adrMultipliers: ADR_MULTIPLIERS,
      emaLength: EMA_LENGTH,
      executionRule:
        "LONG waits for ADR zone touch, then later 1H bullish engulfing; entry only if engulfing close is above the latest closed 5m EMA50. SHORT mirrors below EMA50. If no confirmation, trade is skipped.",
    },
    results,
    leaders: {
      bestByExecutionReturn,
      bestByConfirmedTrade,
      cleanestPostEntry: cleanest,
      recommended,
    },
  };

  const reportsDir = path.join(REPO_ROOT, "reports");
  mkdirSync(reportsDir, { recursive: true });
  const jsonPath = path.join(reportsDir, "weekly-adr-engulfing-ema-fx-study.json");
  writeFileSync(jsonPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");

  const lines = [
    "# Weekly ADR + 1H Engulfing + 5m EMA50 FX Study",
    "",
    `Generated: ${output.generatedUtc}`,
    "",
    "Methodology:",
    "- Universe: FX only",
    `- Eligible observations: ${eligibleObservations.length}`,
    `- ADR lookback: ${ADR_LOOKBACK_DAYS} days (min ${ADR_MIN_REQUIRED_DAYS})`,
    `- Multipliers: ${ADR_MULTIPLIERS.map((value) => value.toFixed(2)).join(", ")} ADR`,
    `- 5m EMA length: ${EMA_LENGTH}`,
    "- Confirmation: 1H engulfing, then require engulf close on correct side of latest closed 5m EMA50",
    "",
    "| Multiplier | Zone Touch | 1H Engulf | EMA Confirm | EMA/Engulf | Avg Exec Return | Confirmed Trade Avg | Confirmed Win | Post-Entry <= -1% |",
    "|---|---:|---:|---:|---:|---:|---:|---:|---:|",
    ...results.map((row) =>
      `| ${row.multiplier.toFixed(2)} ADR | ${row.zoneTouchRatePct.toFixed(2)}% | ${row.engulfConfirmRatePct.toFixed(2)}% | ${row.emaConfirmRatePct.toFixed(2)}% | ${row.emaAfterEngulfPct.toFixed(2)}% | ${row.avgExecutionReturnPct.toFixed(2)}% | ${row.avgConfirmedTradeReturnPct.toFixed(2)}% | ${row.confirmedTradeWinRatePct.toFixed(2)}% | ${row.postEntryMaeHitMinus100Pct.toFixed(2)}% |`,
    ),
    "",
    `Recommended: ${recommended ? `${recommended.multiplier.toFixed(2)} ADR` : "n/a"}`,
    `JSON: ${path.relative(REPO_ROOT, jsonPath)}`,
  ];

  const mdPath = path.join(reportsDir, "weekly-adr-engulfing-ema-fx-study.md");
  writeFileSync(mdPath, `${lines.join("\n")}\n`, "utf8");

  console.log(lines.join("\n"));
}

main().catch((error) => {
  console.error("sweep-weekly-adr-engulfing-ema-fx failed:", error);
  process.exitCode = 1;
});
