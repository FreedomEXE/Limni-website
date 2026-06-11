/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: sweep-weekly-adr-threshold-matrix.ts
 *
 * Description:
 * Runs an ADR-normalized fallback-only pullback sweep across the full
 * 36-pair weekly matrix using unique pair/week/direction observations
 * gathered from the canonical weekly reconstruction report.
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
const MIN_FILL_RATE_PCT = 15;
const MAX_POST_FILL_MINUS_ONE_PCT = 15;

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
  canonical_weeks: string[];
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

type AdrWindow = {
  adrPct: number;
  barsUsed: number;
};

type ThresholdStats = {
  multiplier: number;
  sampleCount: number;
  triggeredCount: number;
  fillRatePct: number;
  avgAdrPct: number;
  avgBaselineReturnPct: number;
  avgFallbackReturnPct: number;
  deltaVsOpenAvgReturnPct: number;
  deltaVsOneAdrAvgReturnPct: number;
  avgTriggeredImprovementReturnPct: number;
  postFillMae: {
    avgWorstMaePct: number;
    medianWorstMaePct: number;
    worstWorstMaePct: number;
    hitMinus050Count: number;
    hitMinus050Pct: number;
    hitMinus100Count: number;
    hitMinus100Pct: number;
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
    bestByAvgReturn: number | null;
    cleanestPostFill: number | null;
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

function chooseBalancedThreshold(thresholds: ThresholdStats[]) {
  const eligible = thresholds.filter(
    (row) =>
      row.fillRatePct >= MIN_FILL_RATE_PCT &&
      row.postFillMae.hitMinus100Pct <= MAX_POST_FILL_MINUS_ONE_PCT,
  );
  const pool = eligible.length > 0 ? eligible : thresholds;
  const byReturn = [...pool].sort((left, right) => {
    if (right.avgFallbackReturnPct !== left.avgFallbackReturnPct) {
      return right.avgFallbackReturnPct - left.avgFallbackReturnPct;
    }
    if (right.fillRatePct !== left.fillRatePct) {
      return right.fillRatePct - left.fillRatePct;
    }
    return left.postFillMae.hitMinus100Pct - right.postFillMae.hitMinus100Pct;
  });
  return byReturn[0]?.multiplier ?? null;
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
  const dailyPriceCache = new Map<string, Array<{ highPrice: number | null; lowPrice: number | null }>>();
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
    const cacheKey = `${symbol}|${assetClass}|${weekOpenUtc}`;
    const cached = dailyPriceCache.get(cacheKey);
    if (cached) return cached;
    const window = getCanonicalWeekWindow(weekOpenUtc, assetClass);
    const result = await client.query<DailyPriceRow>(
      `SELECT period_open_utc, high_price, low_price
         FROM pair_period_returns
        WHERE symbol = $1
          AND period_type = 'daily'
          AND period_open_utc >= $2::timestamptz
          AND period_open_utc < $3::timestamptz
        ORDER BY period_open_utc ASC`,
      [symbol, window.openUtc.toISO(), window.closeUtc.toISO()],
    );
    const mapped = result.rows.map((row) => ({
      highPrice: row.high_price === null ? null : toFinite(row.high_price),
      lowPrice: row.low_price === null ? null : toFinite(row.low_price),
    }));
    dailyPriceCache.set(cacheKey, mapped);
    return mapped;
  }

  async function getAdrWindow(symbol: string, assetClass: AssetClass, weekOpenUtc: string) {
    const cacheKey = `${symbol}|${assetClass}|${weekOpenUtc}`;
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
    if (!adr) continue;
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
        triggeredCount: 0,
        fillRatePct: 0,
        avgAdrPct: 0,
        avgBaselineReturnPct: 0,
        avgFallbackReturnPct: 0,
        deltaVsOpenAvgReturnPct: 0,
        deltaVsOneAdrAvgReturnPct: 0,
        avgTriggeredImprovementReturnPct: 0,
        postFillMae: {
          avgWorstMaePct: 0,
          medianWorstMaePct: 0,
          worstWorstMaePct: 0,
          hitMinus050Count: 0,
          hitMinus050Pct: 0,
          hitMinus100Count: 0,
          hitMinus100Pct: 0,
        },
      })),
      leaders: {
        bestByAvgReturn: null,
        cleanestPostFill: null,
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
    for (const multiplier of ADR_MULTIPLIERS) {
      worstMaeBuckets.set(multiplier, []);
    }

    for (const observation of groupObservations) {
      const baselineReturnPct = baselineByObservation.get(observation.key) ?? 0;
      const adr = adrByObservation.get(observation.key);
      if (!adr) continue;
      const weeklyPrices = await getWeeklyPrices(observation.symbol, observation.weekOpenUtc);
      const dailyBars = await getDailyBars(observation.symbol, observation.assetClass, observation.weekOpenUtc);

      for (const multiplier of ADR_MULTIPLIERS) {
        const row = thresholdRowByKey.get(multiplier)!;
        const thresholdPct = adr.adrPct * multiplier;
        const entryPrice =
          observation.direction === "LONG"
            ? weeklyPrices.openPrice * (1 - thresholdPct / 100)
            : weeklyPrices.openPrice * (1 + thresholdPct / 100);

        const touched = dailyBars.some((bar) =>
          observation.direction === "LONG"
            ? bar.lowPrice !== null && bar.lowPrice <= entryPrice
            : bar.highPrice !== null && bar.highPrice >= entryPrice,
        );

        let fallbackReturnPct = baselineReturnPct;
        row.avgAdrPct += adr.adrPct;
        row.avgBaselineReturnPct += baselineReturnPct;

        if (touched) {
          let worstMaePct = 0;
          for (const bar of dailyBars) {
            let adversePct = 0;
            if (observation.direction === "LONG") {
              if (bar.lowPrice !== null) {
                adversePct = ((bar.lowPrice / entryPrice) - 1) * 100;
              }
            } else if (bar.highPrice !== null) {
              adversePct = ((entryPrice / bar.highPrice) - 1) * 100;
            }
            if (adversePct < worstMaePct) {
              worstMaePct = adversePct;
            }
          }

          fallbackReturnPct =
            observation.direction === "LONG"
              ? ((weeklyPrices.closePrice / entryPrice) - 1) * 100
              : ((entryPrice / weeklyPrices.closePrice) - 1) * 100;

          row.triggeredCount += 1;
          row.avgTriggeredImprovementReturnPct += fallbackReturnPct - baselineReturnPct;
          const maeBucket = worstMaeBuckets.get(multiplier)!;
          maeBucket.push(worstMaePct);
          if (worstMaePct <= -0.5) {
            row.postFillMae.hitMinus050Count += 1;
          }
          if (worstMaePct <= -1.0) {
            row.postFillMae.hitMinus100Count += 1;
          }
        }

        row.avgFallbackReturnPct += fallbackReturnPct;
      }
    }

    const referenceRow = thresholdRowByKey.get(REFERENCE_MULTIPLIER) ?? null;
    const referenceAvgFallbackReturnPct =
      referenceRow && referenceRow.sampleCount > 0
        ? referenceRow.avgFallbackReturnPct / referenceRow.sampleCount
        : 0;

    for (const row of group.thresholds) {
      row.fillRatePct =
        row.sampleCount > 0 ? round((row.triggeredCount / row.sampleCount) * 100, 4) : 0;
      row.avgAdrPct = row.sampleCount > 0 ? round(row.avgAdrPct / row.sampleCount, 6) : 0;
      row.avgBaselineReturnPct =
        row.sampleCount > 0 ? round(row.avgBaselineReturnPct / row.sampleCount, 6) : 0;
      row.avgFallbackReturnPct =
        row.sampleCount > 0 ? round(row.avgFallbackReturnPct / row.sampleCount, 6) : 0;
      row.deltaVsOpenAvgReturnPct = round(row.avgFallbackReturnPct - row.avgBaselineReturnPct, 6);
      row.deltaVsOneAdrAvgReturnPct = round(
        row.avgFallbackReturnPct - referenceAvgFallbackReturnPct,
        6,
      );
      row.avgTriggeredImprovementReturnPct =
        row.triggeredCount > 0 ? round(row.avgTriggeredImprovementReturnPct / row.triggeredCount, 6) : 0;

      const maeBucket = worstMaeBuckets.get(row.multiplier) ?? [];
      const avgWorstMaePct =
        maeBucket.length > 0 ? maeBucket.reduce((sum, value) => sum + value, 0) / maeBucket.length : 0;
      row.postFillMae.avgWorstMaePct = round(avgWorstMaePct, 4);
      row.postFillMae.medianWorstMaePct = round(median(maeBucket), 4);
      row.postFillMae.worstWorstMaePct =
        maeBucket.length > 0 ? round(Math.min(...maeBucket), 4) : 0;
      row.postFillMae.hitMinus050Pct =
        row.triggeredCount > 0 ? round((row.postFillMae.hitMinus050Count / row.triggeredCount) * 100, 4) : 0;
      row.postFillMae.hitMinus100Pct =
        row.triggeredCount > 0 ? round((row.postFillMae.hitMinus100Count / row.triggeredCount) * 100, 4) : 0;
    }

    group.leaders.bestByAvgReturn =
      [...group.thresholds].sort((left, right) => right.avgFallbackReturnPct - left.avgFallbackReturnPct)[0]?.multiplier ??
      null;
    group.leaders.cleanestPostFill =
      [...group.thresholds].sort((left, right) => {
        if (left.postFillMae.hitMinus100Pct !== right.postFillMae.hitMinus100Pct) {
          return left.postFillMae.hitMinus100Pct - right.postFillMae.hitMinus100Pct;
        }
        return left.postFillMae.avgWorstMaePct - right.postFillMae.avgWorstMaePct;
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
      mode: "fallback_only",
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
        "canonical_daily_high_low_proxy_for_weekly_path; ADR is computed from prior daily ranges only, so this is a first-pass weekly execution study, not final intraday trigger research",
      executionRule:
        "LONG waits for a pullback of multiplier * rolling ADR from weekly open; SHORT waits for a rally of multiplier * rolling ADR from weekly open; if not touched during the week, fallback keeps original week-open entry",
      recommendationRule:
        `highest avg fallback return among multipliers with fill rate >= ${MIN_FILL_RATE_PCT}% and post-fill <= -1% rate <= ${MAX_POST_FILL_MINUS_ONE_PCT}%; otherwise highest avg fallback return overall`,
      symbolOverrideRule: `symbol-specific recommendation requires >= ${MIN_SYMBOL_SAMPLE_FOR_OVERRIDE} eligible observations; otherwise fall back to the asset-class recommendation`,
    },
    assetClasses: assetClassResults,
    symbols: symbolResults,
  };

  const reportsDir = path.join(REPO_ROOT, "reports");
  mkdirSync(reportsDir, { recursive: true });
  const jsonPath = path.join(reportsDir, "weekly-adr-threshold-matrix-study.json");
  writeFileSync(jsonPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");

  const lines = [
    "# Weekly ADR Threshold Matrix Study",
    "",
    `Generated: ${output.generatedUtc}`,
    "",
    "Methodology:",
    `- Observation basis: ${output.methodology.observationBasis}`,
    `- Unique observations: ${output.methodology.uniqueObservations}`,
    `- Eligible observations with ADR history: ${output.methodology.eligibleObservations}`,
    `- ADR lookback: ${ADR_LOOKBACK_DAYS} days (min ${ADR_MIN_REQUIRED_DAYS})`,
    `- Reference multiplier: ${REFERENCE_MULTIPLIER.toFixed(2)} ADR`,
    "- Mode: fallback only",
    `- Path assumption: ${output.methodology.pathAssumption}`,
    `- Recommendation rule: ${output.methodology.recommendationRule}`,
    "",
    "Asset-Class Recommendations:",
    "",
    "| Asset Class | Sample | Recommended | Best Avg Return | Cleanest Post-Fill | Avg ADR | Confidence |",
    "|---|---:|---:|---:|---:|---:|---|",
    ...assetClassResults.map((row) => {
      const refRow = row.thresholds.find((threshold) => threshold.multiplier === REFERENCE_MULTIPLIER);
      return `| ${row.label} | ${row.sampleCount} | ${row.leaders.recommendedBalanced?.toFixed(2) ?? "n/a"} ADR | ${row.leaders.bestByAvgReturn?.toFixed(2) ?? "n/a"} ADR | ${row.leaders.cleanestPostFill?.toFixed(2) ?? "n/a"} ADR | ${(refRow?.avgAdrPct ?? 0).toFixed(2)}% | ${row.confidence} |`;
    }),
    "",
    "Symbol Recommendations:",
    "",
    "| Symbol | Asset | Sample | Recommended | Source | vs Asset Class | Confidence |",
    "|---|---|---:|---:|---|---:|---|",
    ...symbolResults.map((row) => {
      const assetClassFallback = row.recommendedAssetClassMultiplier;
      const deltaVsAsset =
        row.leaders.recommendedBalanced !== null && assetClassFallback !== null
          ? round(row.leaders.recommendedBalanced - assetClassFallback, 2)
          : 0;
      return `| ${row.label} | ${row.assetClass} | ${row.sampleCount} | ${row.leaders.recommendedBalanced?.toFixed(2) ?? "n/a"} ADR | ${row.recommendationSource ?? "n/a"} | ${deltaVsAsset >= 0 ? "+" : ""}${deltaVsAsset.toFixed(2)} ADR | ${row.confidence} |`;
    }),
    "",
    "Reference Comparison by Asset Class:",
    "",
    "| Asset Class | Multiplier | Fill Rate | Avg Fallback Return | Delta vs Open | Delta vs 1.00 ADR | Post-Fill <= -1% |",
    "|---|---:|---:|---:|---:|---:|---:|",
    ...assetClassResults.flatMap((row) =>
      row.thresholds.map(
        (threshold) =>
          `| ${row.label} | ${threshold.multiplier.toFixed(2)} ADR | ${threshold.fillRatePct.toFixed(2)}% | ${threshold.avgFallbackReturnPct.toFixed(2)}% | ${threshold.deltaVsOpenAvgReturnPct >= 0 ? "+" : ""}${threshold.deltaVsOpenAvgReturnPct.toFixed(2)}% | ${threshold.deltaVsOneAdrAvgReturnPct >= 0 ? "+" : ""}${threshold.deltaVsOneAdrAvgReturnPct.toFixed(2)}% | ${threshold.postFillMae.hitMinus100Pct.toFixed(2)}% |`,
      ),
    ),
    "",
    `JSON: ${path.relative(REPO_ROOT, jsonPath)}`,
  ];

  const mdPath = path.join(REPO_ROOT, "reports", "weekly-adr-threshold-matrix-study.md");
  writeFileSync(mdPath, `${lines.join("\n")}\n`, "utf8");

  console.log(lines.join("\n"));
}

main().catch((error) => {
  console.error("sweep-weekly-adr-threshold-matrix failed:", error);
  process.exitCode = 1;
});
