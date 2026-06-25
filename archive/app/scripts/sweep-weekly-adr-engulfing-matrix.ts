/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: sweep-weekly-adr-engulfing-matrix.ts
 *
 * Description:
 * Runs an ADR-zone plus 1H engulfing confirmation study across the
 * full 36-pair weekly matrix using canonical hourly bars.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { Client } from "pg";
import { PAIRS_BY_ASSET_CLASS } from "../src/lib/cotPairs";
import type { AssetClass } from "../src/lib/cotMarkets";
import { getCanonicalWeekWindow } from "../src/lib/canonicalPriceWindows";

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
const ADR_MULTIPLIERS = [0.5, 0.75, 1.0, 1.25, 1.5] as const;
const REFERENCE_MULTIPLIER = 1.0;
const MIN_SYMBOL_SAMPLE_FOR_OVERRIDE = 10;
const MIN_CONFIRM_RATE_PCT = 10;
const MAX_POST_ENTRY_MINUS_ONE_PCT = 20;

type TradeDirection = "LONG" | "SHORT";

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
  generated_utc: string;
  composite_systems: SystemRow[];
  composite_systems_gated: SystemRow[];
  standalone_models: SystemRow[];
  standalone_models_gated: SystemRow[];
};

type Observation = {
  key: string;
  weekOpenUtc: string;
  symbol: string;
  assetClass: AssetClass;
  direction: TradeDirection;
  sourceSystems: string[];
};

type WeeklyPriceRow = {
  open_price: number | string;
  close_price: number | string;
};

type DailyPriceRow = {
  period_open_utc: Date;
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

type AdrWindow = {
  adrPct: number;
  barsUsed: number;
};

type ThresholdStats = {
  multiplier: number;
  sampleCount: number;
  zoneTouchedCount: number;
  confirmedCount: number;
  zoneTouchRatePct: number;
  confirmRatePct: number;
  confirmAfterTouchPct: number;
  avgAdrPct: number;
  avgBaselineReturnPct: number;
  avgExecutionReturnPct: number;
  avgConfirmedTradeReturnPct: number;
  deltaVsOpenAvgReturnPct: number;
  deltaVsOneAdrAvgReturnPct: number;
  confirmedTradeWinRatePct: number;
  postEntryMae: {
    avgWorstMaePct: number;
    medianWorstMaePct: number;
    worstWorstMaePct: number;
    hitMinus050Count: number;
    hitMinus050Pct: number;
    hitMinus100Count: number;
    hitMinus100Pct: number;
  };
  timing: {
    avgHoursToTouch: number;
    avgHoursTouchToConfirm: number;
  };
};

type GroupResult = {
  id: string;
  label: string;
  assetClass: AssetClass;
  sampleCount: number;
  referenceMultiplier: number;
  thresholds: ThresholdStats[];
  leaders: {
    bestByExecutionReturn: number | null;
    bestConfirmedTradeReturn: number | null;
    cleanestPostEntry: number | null;
    recommendedBalanced: number | null;
  };
  confidence: "high" | "medium" | "low";
  recommendationSource?: "symbol" | "asset_class_fallback";
  recommendedAssetClassMultiplier?: number | null;
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

function median(values: number[]) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const midpoint = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[midpoint - 1]! + sorted[midpoint]!) / 2;
  }
  return sorted[midpoint]!;
}

function getConfidence(sampleCount: number): "high" | "medium" | "low" {
  if (sampleCount >= 20) return "high";
  if (sampleCount >= 10) return "medium";
  return "low";
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

function buildUniqueObservations(report: CanonicalReport) {
  const map = new Map<string, Observation>();
  for (const system of listAllSystems(report)) {
    for (const week of system.weeklyReturns) {
      for (const pair of week.breakdown.nettedPairs) {
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
          assetClass: pair.assetClass,
          direction: pair.direction,
          sourceSystems: [system.system],
        });
      }
    }
  }
  return [...map.values()];
}

function getAllUniverseSymbols() {
  return (Object.entries(PAIRS_BY_ASSET_CLASS) as Array<[AssetClass, { pair: string }[]]>)
    .flatMap(([assetClass, pairs]) => pairs.map((pair) => ({ symbol: pair.pair, assetClass })));
}

function computeBaselineReturnPct(
  direction: TradeDirection,
  openPrice: number,
  closePrice: number,
) {
  if (direction === "LONG") {
    return ((closePrice / openPrice) - 1) * 100;
  }
  return ((openPrice / closePrice) - 1) * 100;
}

function isEngulfing(direction: TradeDirection, previous: HourlyBar | undefined, current: HourlyBar | undefined) {
  if (!previous || !current) return false;
  return direction === "LONG"
    ? current.closePrice > previous.highPrice
    : current.closePrice < previous.lowPrice;
}

function chooseBalancedThreshold(thresholds: ThresholdStats[]) {
  const eligible = thresholds.filter(
    (row) =>
      row.confirmRatePct >= MIN_CONFIRM_RATE_PCT &&
      row.postEntryMae.hitMinus100Pct <= MAX_POST_ENTRY_MINUS_ONE_PCT,
  );
  const pool = eligible.length > 0 ? eligible : thresholds;
  const byScore = [...pool].sort((left, right) => {
    if (right.avgExecutionReturnPct !== left.avgExecutionReturnPct) {
      return right.avgExecutionReturnPct - left.avgExecutionReturnPct;
    }
    if (right.confirmRatePct !== left.confirmRatePct) {
      return right.confirmRatePct - left.confirmRatePct;
    }
    return left.postEntryMae.hitMinus100Pct - right.postEntryMae.hitMinus100Pct;
  });
  return byScore[0]?.multiplier ?? null;
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required.");
  }

  const report = loadCanonicalReport();
  const observations = buildUniqueObservations(report);

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL.includes("render.com") ? { rejectUnauthorized: false } : false,
  });
  await client.connect();

  const weeklyPriceCache = new Map<string, { openPrice: number; closePrice: number }>();
  const dailyPriceCache = new Map<string, Array<{ openUtc: string; openPrice: number; highPrice: number | null; lowPrice: number | null }>>();
  const hourlyBarCache = new Map<string, HourlyBar[]>();
  const adrCache = new Map<string, AdrWindow | null>();

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

  async function getDailyBars(symbol: string, assetClass: AssetClass, weekOpenUtc: string) {
    const cacheKey = `${symbol}|${assetClass}|${weekOpenUtc}|daily`;
    const cached = dailyPriceCache.get(cacheKey);
    if (cached) return cached;
    const window = getCanonicalWeekWindow(weekOpenUtc, assetClass);
    const result = await client.query<DailyPriceRow>(
      `SELECT period_open_utc, open_price, high_price, low_price
         FROM pair_period_returns
        WHERE symbol = $1
          AND period_type = 'daily'
          AND period_open_utc >= $2::timestamptz
          AND period_open_utc < $3::timestamptz
        ORDER BY period_open_utc ASC`,
      [symbol, window.openUtc.toISO(), window.closeUtc.toISO()],
    );
    const mapped = result.rows.map((row) => ({
      openUtc: row.period_open_utc.toISOString(),
      openPrice: toFinite(row.open_price),
      highPrice: row.high_price === null ? null : toFinite(row.high_price),
      lowPrice: row.low_price === null ? null : toFinite(row.low_price),
    }));
    dailyPriceCache.set(cacheKey, mapped);
    return mapped;
  }

  async function getHourlyBars(symbol: string, assetClass: AssetClass, weekOpenUtc: string) {
    const cacheKey = `${symbol}|${assetClass}|${weekOpenUtc}|hourly`;
    const cached = hourlyBarCache.get(cacheKey);
    if (cached) return cached;
    const window = getCanonicalWeekWindow(weekOpenUtc, assetClass);
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

  async function getAdrWindow(symbol: string, assetClass: AssetClass, weekOpenUtc: string) {
    const cacheKey = `${symbol}|${assetClass}|${weekOpenUtc}|adr`;
    if (adrCache.has(cacheKey)) {
      return adrCache.get(cacheKey) ?? null;
    }
    const window = getCanonicalWeekWindow(weekOpenUtc, assetClass);
    const result = await client.query<DailyPriceRow>(
      `SELECT period_open_utc, open_price, high_price, low_price
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

  const eligibleObservations: Observation[] = [];
  const baselineByObservation = new Map<string, number>();
  const adrByObservation = new Map<string, AdrWindow>();

  for (const observation of observations) {
    const adr = await getAdrWindow(observation.symbol, observation.assetClass, observation.weekOpenUtc);
    const hourlyBars = await getHourlyBars(observation.symbol, observation.assetClass, observation.weekOpenUtc);
    if (!adr || hourlyBars.length < 2) continue;
    const weeklyPrices = await getWeeklyPrices(observation.symbol, observation.weekOpenUtc);
    baselineByObservation.set(
      observation.key,
      computeBaselineReturnPct(observation.direction, weeklyPrices.openPrice, weeklyPrices.closePrice),
    );
    adrByObservation.set(observation.key, adr);
    eligibleObservations.push(observation);
  }

  function buildGroupResult(id: string, label: string, assetClass: AssetClass, sampleCount: number): GroupResult {
    return {
      id,
      label,
      assetClass,
      sampleCount,
      referenceMultiplier: REFERENCE_MULTIPLIER,
      thresholds: ADR_MULTIPLIERS.map((multiplier) => ({
        multiplier,
        sampleCount,
        zoneTouchedCount: 0,
        confirmedCount: 0,
        zoneTouchRatePct: 0,
        confirmRatePct: 0,
        confirmAfterTouchPct: 0,
        avgAdrPct: 0,
        avgBaselineReturnPct: 0,
        avgExecutionReturnPct: 0,
        avgConfirmedTradeReturnPct: 0,
        deltaVsOpenAvgReturnPct: 0,
        deltaVsOneAdrAvgReturnPct: 0,
        confirmedTradeWinRatePct: 0,
        postEntryMae: {
          avgWorstMaePct: 0,
          medianWorstMaePct: 0,
          worstWorstMaePct: 0,
          hitMinus050Count: 0,
          hitMinus050Pct: 0,
          hitMinus100Count: 0,
          hitMinus100Pct: 0,
        },
        timing: {
          avgHoursToTouch: 0,
          avgHoursTouchToConfirm: 0,
        },
      })),
      leaders: {
        bestByExecutionReturn: null,
        bestConfirmedTradeReturn: null,
        cleanestPostEntry: null,
        recommendedBalanced: null,
      },
      confidence: getConfidence(sampleCount),
    };
  }

  const assetClassGroups = new Map<AssetClass, Observation[]>();
  for (const assetClass of Object.keys(PAIRS_BY_ASSET_CLASS) as AssetClass[]) {
    assetClassGroups.set(
      assetClass,
      eligibleObservations.filter((row) => row.assetClass === assetClass),
    );
  }

  const symbolGroups = new Map<string, Observation[]>();
  for (const observation of eligibleObservations) {
    const existing = symbolGroups.get(observation.symbol);
    if (existing) {
      existing.push(observation);
    } else {
      symbolGroups.set(observation.symbol, [observation]);
    }
  }

  async function finalizeGroupResult(group: GroupResult, groupObservations: Observation[]) {
    const thresholdRowByKey = new Map<number, ThresholdStats>(
      group.thresholds.map((row) => [row.multiplier, row]),
    );
    const worstMaeBuckets = new Map<number, number[]>();
    const hoursToTouchBuckets = new Map<number, number[]>();
    const hoursTouchToConfirmBuckets = new Map<number, number[]>();
    const confirmedWinBuckets = new Map<number, number[]>();

    for (const multiplier of ADR_MULTIPLIERS) {
      worstMaeBuckets.set(multiplier, []);
      hoursToTouchBuckets.set(multiplier, []);
      hoursTouchToConfirmBuckets.set(multiplier, []);
      confirmedWinBuckets.set(multiplier, []);
    }

    for (const observation of groupObservations) {
      const baselineReturnPct = baselineByObservation.get(observation.key) ?? 0;
      const adr = adrByObservation.get(observation.key);
      if (!adr) continue;
      const weeklyPrices = await getWeeklyPrices(observation.symbol, observation.weekOpenUtc);
      const hourlyBars = await getHourlyBars(observation.symbol, observation.assetClass, observation.weekOpenUtc);

      for (const multiplier of ADR_MULTIPLIERS) {
        const row = thresholdRowByKey.get(multiplier)!;
        row.avgAdrPct += adr.adrPct;
        row.avgBaselineReturnPct += baselineReturnPct;

        const thresholdPct = adr.adrPct * multiplier;
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
            hoursToTouchBuckets.get(multiplier)!.push(index + 1);
            break;
          }
        }

        if (touchIndex === -1) {
          continue;
        }

        let confirmIndex = -1;
        for (let index = Math.max(1, touchIndex + 1); index < hourlyBars.length; index += 1) {
          if (isEngulfing(observation.direction, hourlyBars[index - 1], hourlyBars[index])) {
            confirmIndex = index;
            row.confirmedCount += 1;
            hoursTouchToConfirmBuckets.get(multiplier)!.push(index - touchIndex);
            break;
          }
        }

        if (confirmIndex === -1) {
          continue;
        }

        const entryBar = hourlyBars[confirmIndex]!;
        const entryPrice = entryBar.closePrice;
        const executionReturnPct = computeBaselineReturnPct(
          observation.direction,
          entryPrice,
          weeklyPrices.closePrice,
        );
        row.avgExecutionReturnPct += executionReturnPct;
        row.avgConfirmedTradeReturnPct += executionReturnPct;
        confirmedWinBuckets.get(multiplier)!.push(executionReturnPct > 0 ? 1 : 0);

        let worstMaePct = 0;
        for (let index = confirmIndex + 1; index < hourlyBars.length; index += 1) {
          const bar = hourlyBars[index]!;
          let adversePct = 0;
          if (observation.direction === "LONG") {
            adversePct = ((bar.lowPrice / entryPrice) - 1) * 100;
          } else {
            adversePct = ((entryPrice / bar.highPrice) - 1) * 100;
          }
          if (adversePct < worstMaePct) {
            worstMaePct = adversePct;
          }
        }

        const maeBucket = worstMaeBuckets.get(multiplier)!;
        maeBucket.push(worstMaePct);
        if (worstMaePct <= -0.5) {
          row.postEntryMae.hitMinus050Count += 1;
        }
        if (worstMaePct <= -1.0) {
          row.postEntryMae.hitMinus100Count += 1;
        }
      }
    }

    const referenceRow = thresholdRowByKey.get(REFERENCE_MULTIPLIER) ?? null;
    const referenceAvgExecutionReturnPct =
      referenceRow && referenceRow.sampleCount > 0
        ? referenceRow.avgExecutionReturnPct / referenceRow.sampleCount
        : 0;

    for (const row of group.thresholds) {
      row.zoneTouchRatePct =
        row.sampleCount > 0 ? round((row.zoneTouchedCount / row.sampleCount) * 100, 4) : 0;
      row.confirmRatePct =
        row.sampleCount > 0 ? round((row.confirmedCount / row.sampleCount) * 100, 4) : 0;
      row.confirmAfterTouchPct =
        row.zoneTouchedCount > 0 ? round((row.confirmedCount / row.zoneTouchedCount) * 100, 4) : 0;
      row.avgAdrPct = row.sampleCount > 0 ? round(row.avgAdrPct / row.sampleCount, 6) : 0;
      row.avgBaselineReturnPct =
        row.sampleCount > 0 ? round(row.avgBaselineReturnPct / row.sampleCount, 6) : 0;
      row.avgExecutionReturnPct =
        row.sampleCount > 0 ? round(row.avgExecutionReturnPct / row.sampleCount, 6) : 0;
      row.avgConfirmedTradeReturnPct =
        row.confirmedCount > 0 ? round(row.avgConfirmedTradeReturnPct / row.confirmedCount, 6) : 0;
      row.deltaVsOpenAvgReturnPct = round(row.avgExecutionReturnPct - row.avgBaselineReturnPct, 6);
      row.deltaVsOneAdrAvgReturnPct = round(
        row.avgExecutionReturnPct - referenceAvgExecutionReturnPct,
        6,
      );
      row.confirmedTradeWinRatePct =
        row.confirmedCount > 0
          ? round((confirmedWinBuckets.get(row.multiplier)!.reduce((sum, value) => sum + value, 0) / row.confirmedCount) * 100, 4)
          : 0;

      const maeBucket = worstMaeBuckets.get(row.multiplier) ?? [];
      const avgWorstMaePct =
        maeBucket.length > 0 ? maeBucket.reduce((sum, value) => sum + value, 0) / maeBucket.length : 0;
      row.postEntryMae.avgWorstMaePct = round(avgWorstMaePct, 4);
      row.postEntryMae.medianWorstMaePct = round(median(maeBucket), 4);
      row.postEntryMae.worstWorstMaePct =
        maeBucket.length > 0 ? round(Math.min(...maeBucket), 4) : 0;
      row.postEntryMae.hitMinus050Pct =
        row.confirmedCount > 0 ? round((row.postEntryMae.hitMinus050Count / row.confirmedCount) * 100, 4) : 0;
      row.postEntryMae.hitMinus100Pct =
        row.confirmedCount > 0 ? round((row.postEntryMae.hitMinus100Count / row.confirmedCount) * 100, 4) : 0;

      const touchBucket = hoursToTouchBuckets.get(row.multiplier) ?? [];
      const touchToConfirmBucket = hoursTouchToConfirmBuckets.get(row.multiplier) ?? [];
      row.timing.avgHoursToTouch =
        touchBucket.length > 0 ? round(touchBucket.reduce((sum, value) => sum + value, 0) / touchBucket.length, 4) : 0;
      row.timing.avgHoursTouchToConfirm =
        touchToConfirmBucket.length > 0
          ? round(touchToConfirmBucket.reduce((sum, value) => sum + value, 0) / touchToConfirmBucket.length, 4)
          : 0;
    }

    group.leaders.bestByExecutionReturn =
      [...group.thresholds].sort((left, right) => right.avgExecutionReturnPct - left.avgExecutionReturnPct)[0]?.multiplier ??
      null;
    group.leaders.bestConfirmedTradeReturn =
      [...group.thresholds].sort((left, right) => right.avgConfirmedTradeReturnPct - left.avgConfirmedTradeReturnPct)[0]?.multiplier ??
      null;
    group.leaders.cleanestPostEntry =
      [...group.thresholds].sort((left, right) => {
        if (left.postEntryMae.hitMinus100Pct !== right.postEntryMae.hitMinus100Pct) {
          return left.postEntryMae.hitMinus100Pct - right.postEntryMae.hitMinus100Pct;
        }
        return left.postEntryMae.avgWorstMaePct - right.postEntryMae.avgWorstMaePct;
      })[0]?.multiplier ?? null;
    group.leaders.recommendedBalanced = chooseBalancedThreshold(group.thresholds);
  }

  const assetClassResults: GroupResult[] = [];
  for (const assetClass of Object.keys(PAIRS_BY_ASSET_CLASS) as AssetClass[]) {
    const groupObservations = assetClassGroups.get(assetClass) ?? [];
    const label = assetClass[0]!.toUpperCase() + assetClass.slice(1);
    const group = buildGroupResult(assetClass, label, assetClass, groupObservations.length);
    await finalizeGroupResult(group, groupObservations);
    assetClassResults.push(group);
  }

  const assetClassRecommendationById = new Map<AssetClass, number | null>(
    assetClassResults.map((row) => [row.assetClass, row.leaders.recommendedBalanced]),
  );

  const symbolResults: GroupResult[] = [];
  for (const { symbol, assetClass } of getAllUniverseSymbols()) {
    const groupObservations = symbolGroups.get(symbol) ?? [];
    const group = buildGroupResult(symbol, symbol, assetClass, groupObservations.length);
    await finalizeGroupResult(group, groupObservations);
    if (group.sampleCount < MIN_SYMBOL_SAMPLE_FOR_OVERRIDE) {
      group.recommendationSource = "asset_class_fallback";
      group.recommendedAssetClassMultiplier = assetClassRecommendationById.get(assetClass) ?? null;
      group.leaders.recommendedBalanced = group.recommendedAssetClassMultiplier;
    } else {
      group.recommendationSource = "symbol";
      group.recommendedAssetClassMultiplier = assetClassRecommendationById.get(assetClass) ?? null;
    }
    symbolResults.push(group);
  }

  await client.end();

  const output = {
    generatedUtc: new Date().toISOString(),
    methodology: {
      mode: "replacement_confirmed",
      confirmation: "1h_engulfing_after_adr_zone_touch",
      observationBasis:
        "unique_pair_week_direction_occurrences_across_all_26_canonical_systems",
      canonicalSystemsUsed: {
        compositeSystems: report.composite_systems.length,
        compositeSystemsGated: report.composite_systems_gated.length,
        standaloneModels: report.standalone_models.length,
        standaloneModelsGated: report.standalone_models_gated.length,
      },
      uniqueObservations: observations.length,
      eligibleObservations: eligibleObservations.length,
      adrLookbackDays: ADR_LOOKBACK_DAYS,
      adrMinimumRequiredDays: ADR_MIN_REQUIRED_DAYS,
      adrMultipliers: ADR_MULTIPLIERS,
      referenceMultiplier: REFERENCE_MULTIPLIER,
      pathAssumption:
        "canonical_hourly_bars_for_entry_confirmation; zone touch can happen intra-hour via high/low and confirmation requires a later hourly engulfing candle close",
      executionRule:
        "LONG waits for ADR pullback zone touch, then enters only on the first later 1H bullish engulfing close; SHORT mirrors this with a rally and bearish engulfing; if confirmation never occurs, trade is skipped",
      recommendationRule:
        `highest avg execution return among multipliers with confirmation rate >= ${MIN_CONFIRM_RATE_PCT}% and post-entry <= -1% rate <= ${MAX_POST_ENTRY_MINUS_ONE_PCT}%; otherwise highest avg execution return overall`,
      symbolOverrideRule: `symbol-specific recommendation requires >= ${MIN_SYMBOL_SAMPLE_FOR_OVERRIDE} eligible observations; otherwise fall back to the asset-class recommendation`,
    },
    assetClasses: assetClassResults,
    symbols: symbolResults,
  };

  const reportsDir = path.join(REPO_ROOT, "reports");
  mkdirSync(reportsDir, { recursive: true });
  const jsonPath = path.join(reportsDir, "weekly-adr-engulfing-matrix-study.json");
  writeFileSync(jsonPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");

  const lines = [
    "# Weekly ADR + 1H Engulfing Matrix Study",
    "",
    `Generated: ${output.generatedUtc}`,
    "",
    "Methodology:",
    `- Observation basis: ${output.methodology.observationBasis}`,
    `- Unique observations: ${output.methodology.uniqueObservations}`,
    `- Eligible observations with ADR history and hourly bars: ${output.methodology.eligibleObservations}`,
    `- ADR lookback: ${ADR_LOOKBACK_DAYS} days (min ${ADR_MIN_REQUIRED_DAYS})`,
    `- Reference multiplier: ${REFERENCE_MULTIPLIER.toFixed(2)} ADR`,
    "- Confirmation: 1H engulfing after ADR zone touch",
    `- Path assumption: ${output.methodology.pathAssumption}`,
    "",
    "Asset-Class Recommendations:",
    "",
    "| Asset Class | Sample | Recommended | Best Exec Return | Best Confirmed Trade | Cleanest Post-Entry | Confidence |",
    "|---|---:|---:|---:|---:|---:|---|",
    ...assetClassResults.map((row) =>
      `| ${row.label} | ${row.sampleCount} | ${row.leaders.recommendedBalanced?.toFixed(2) ?? "n/a"} ADR | ${row.leaders.bestByExecutionReturn?.toFixed(2) ?? "n/a"} ADR | ${row.leaders.bestConfirmedTradeReturn?.toFixed(2) ?? "n/a"} ADR | ${row.leaders.cleanestPostEntry?.toFixed(2) ?? "n/a"} ADR | ${row.confidence} |`,
    ),
    "",
    "Reference Comparison by Asset Class:",
    "",
    "| Asset Class | Multiplier | Zone Touch | Confirm Rate | Confirm/Touch | Avg Exec Return | Confirmed Trade Avg | Post-Entry <= -1% |",
    "|---|---:|---:|---:|---:|---:|---:|---:|",
    ...assetClassResults.flatMap((row) =>
      row.thresholds.map(
        (threshold) =>
          `| ${row.label} | ${threshold.multiplier.toFixed(2)} ADR | ${threshold.zoneTouchRatePct.toFixed(2)}% | ${threshold.confirmRatePct.toFixed(2)}% | ${threshold.confirmAfterTouchPct.toFixed(2)}% | ${threshold.avgExecutionReturnPct.toFixed(2)}% | ${threshold.avgConfirmedTradeReturnPct.toFixed(2)}% | ${threshold.postEntryMae.hitMinus100Pct.toFixed(2)}% |`,
      ),
    ),
    "",
    `JSON: ${path.relative(REPO_ROOT, jsonPath)}`,
  ];

  const mdPath = path.join(reportsDir, "weekly-adr-engulfing-matrix-study.md");
  writeFileSync(mdPath, `${lines.join("\n")}\n`, "utf8");

  console.log(lines.join("\n"));
}

main().catch((error) => {
  console.error("sweep-weekly-adr-engulfing-matrix failed:", error);
  process.exitCode = 1;
});
