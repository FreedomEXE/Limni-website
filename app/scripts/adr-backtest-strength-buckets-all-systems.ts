/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: adr-backtest-strength-buckets-all-systems.ts
 *
 * Description:
 * App-backed ADR pullback research across surfaced strategy systems.
 *
 * Scope:
 *   - dealer
 *   - commercial
 *   - sentiment
 *   - tiered_v3
 *   - agree_2of3
 *   - selector_sentiment_override
 *
 * Method:
 *   - Uses computeMultiWeekHold so the trade set comes from the same
 *     app engine path that powers Performance.
 *   - Loads the live ADR run weeks from strategy_backtest_trades.
 *   - Enriches each trade with week-open strength context:
 *       FX           -> currency_strength_snapshots (base - quote)
 *       commodities  -> asset_strength_snapshots (base asset vs 50)
 *       crypto       -> asset_strength_snapshots (base asset vs 50)
 *       indices      -> unsupported, passed through unchanged
 *   - Computes signed strength relative to trade direction:
 *       negative = against the trade
 *       positive = with the trade
 *
 * Buckets:
 *   strongly_against: signed < -25
 *   against:          -25 <= signed < -5
 *   neutral:          -5 <= signed <= 5
 *   with:             5 < signed <= 25
 *   strongly_with:    signed > 25
 *
 * Usage:
 *   npx tsx scripts/adr-backtest-strength-buckets-all-systems.ts
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import { DateTime } from "luxon";

import { query } from "../src/lib/db";
import { PAIRS_BY_ASSET_CLASS } from "../src/lib/cotPairs";
import { computeMultiWeekHold, type WeeklyHoldTrade } from "../src/lib/performance/weeklyHoldEngine";
import { getIntradayFilter, getStrategy } from "../src/lib/performance/strategyConfig";
import { parseUtcNaiveTimestampMs } from "./lib/utcNaive";

type StrengthWindow = "4h" | "24h";
type AssetStrengthClass = "crypto" | "commodities";
type Bucket =
  | "strongly_against"
  | "against"
  | "neutral"
  | "with"
  | "strongly_with"
  | "missing"
  | "unsupported";

type StrengthPoint = { ts: number; norm: number };

type CurrencyStrengthIndex = Record<StrengthWindow, Record<string, StrengthPoint[]>>;
type AssetStrengthIndex = Record<AssetStrengthClass, Record<StrengthWindow, Record<string, StrengthPoint[]>>>;

type PairMeta = {
  pair: string;
  assetClass: string;
  base: string;
  quote: string;
};

type EnrichedTrade = WeeklyHoldTrade & {
  weekOpenUtc: string;
  signedByWindow: Record<StrengthWindow, number | null>;
  bucketByWindow: Record<StrengthWindow, Bucket>;
  supported: boolean;
  availableByWindow: Record<StrengthWindow, boolean>;
};

type BucketTradeStats = {
  trades: number;
  wins: number;
  totalReturn: number;
};

type WeekSummary = {
  weekOpenUtc: string;
  returnPct: number;
  trades: number;
  wins: number;
};

type ResultSummary = {
  totalReturn: number;
  totalTrades: number;
  totalWins: number;
  winRate: number;
  maxDrawdown: number;
  losingWeeks: number;
  weeks: number;
};

type RuleDefinition = {
  id: string;
  label: string;
  keepSupportedBucket: (bucket: Bucket) => boolean;
};

const SYSTEM_IDS = [
  "dealer",
  "commercial",
  "sentiment",
  "tiered_v3",
  "agree_2of3",
  "selector_sentiment_override",
] as const;

const WINDOWS: StrengthWindow[] = ["4h", "24h"];

const RULES: RuleDefinition[] = [
  {
    id: "skip_strongly_with",
    label: "Skip strongly with",
    keepSupportedBucket: (bucket) => bucket !== "strongly_with",
  },
  {
    id: "skip_with_plus",
    label: "Skip with + strongly with",
    keepSupportedBucket: (bucket) => bucket !== "with" && bucket !== "strongly_with",
  },
  {
    id: "keep_against_plus",
    label: "Keep against + strongly against",
    keepSupportedBucket: (bucket) => bucket === "against" || bucket === "strongly_against",
  },
  {
    id: "keep_strongly_against",
    label: "Keep strongly against only",
    keepSupportedBucket: (bucket) => bucket === "strongly_against",
  },
];

function buildPairMetaMap() {
  const map = new Map<string, PairMeta>();
  for (const [assetClass, defs] of Object.entries(PAIRS_BY_ASSET_CLASS)) {
    for (const def of defs) {
      map.set(def.pair.toUpperCase(), {
        pair: def.pair.toUpperCase(),
        assetClass,
        base: def.base.toUpperCase(),
        quote: def.quote.toUpperCase(),
      });
    }
  }
  return map;
}

const PAIR_META = buildPairMetaMap();

function fmtPct(value: number) {
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function fmtRatio(value: number) {
  if (!Number.isFinite(value)) return "inf";
  return value.toFixed(2);
}

function sortAscIso(values: string[]) {
  return [...values].sort((a, b) =>
    DateTime.fromISO(a, { zone: "utc" }).toMillis() -
    DateTime.fromISO(b, { zone: "utc" }).toMillis(),
  );
}

function bucketSignedStrength(signed: number | null, supported: boolean): Bucket {
  if (!supported) return "unsupported";
  if (signed === null || !Number.isFinite(signed)) return "missing";
  if (signed < -25) return "strongly_against";
  if (signed < -5) return "against";
  if (signed <= 5) return "neutral";
  if (signed <= 25) return "with";
  return "strongly_with";
}

function findLatestAt(points: StrengthPoint[] | undefined, targetTs: number): StrengthPoint | null {
  if (!points || points.length === 0) return null;
  let lo = 0;
  let hi = points.length - 1;
  let best = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const point = points[mid]!;
    if (point.ts <= targetTs) {
      best = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return best >= 0 ? points[best]! : null;
}

async function loadAdrRunWeeks() {
  const runRows = await query<{ id: string }>(
    `SELECT id FROM strategy_backtest_runs
     WHERE bot_id = 'adr-forward'
       AND variant = 'fresh-start'
       AND market = 'multi-asset'
       AND config_key = 'default'
     LIMIT 1`,
    [],
  );
  if (runRows.length === 0) {
    throw new Error("ADR run not found in strategy_backtest_runs.");
  }

  const runId = Number(runRows[0]!.id);
  const weekRows = await query<{ wk: string }>(
    `SELECT DISTINCT week_open_utc::text AS wk
     FROM strategy_backtest_trades
     WHERE run_id = $1
     ORDER BY wk ASC`,
    [runId],
  );

  return {
    runId,
    weeks: weekRows.map((row) => new Date(row.wk).toISOString()),
  };
}

async function loadCurrencyStrengthIndex(): Promise<CurrencyStrengthIndex> {
  const rows = await query<{
    snapshot_time_utc: Date;
    window: StrengthWindow;
    currency: string;
    normalized_strength: string | number;
  }>(
    `SELECT snapshot_time_utc, "window", currency, normalized_strength
     FROM currency_strength_snapshots
     WHERE "window" IN ('4h', '24h')
     ORDER BY snapshot_time_utc ASC`,
    [],
  );

  const out: CurrencyStrengthIndex = { "4h": {}, "24h": {} };
  for (const row of rows) {
    const window = row.window;
    const currency = String(row.currency).trim().toUpperCase();
    if (!out[window][currency]) out[window][currency] = [];
    out[window][currency]!.push({
      ts: parseUtcNaiveTimestampMs(row.snapshot_time_utc),
      norm: Number(row.normalized_strength),
    });
  }
  return out;
}

async function loadAssetStrengthIndex(): Promise<AssetStrengthIndex> {
  const rows = await query<{
    snapshot_time_utc: Date;
    asset_class: AssetStrengthClass;
    window: StrengthWindow;
    asset: string;
    normalized_strength: string | number;
  }>(
    `SELECT snapshot_time_utc, asset_class, "window", asset, normalized_strength
     FROM asset_strength_snapshots
     WHERE asset_class IN ('crypto', 'commodities')
       AND "window" IN ('4h', '24h')
     ORDER BY snapshot_time_utc ASC`,
    [],
  );

  const out: AssetStrengthIndex = {
    crypto: { "4h": {}, "24h": {} },
    commodities: { "4h": {}, "24h": {} },
  };

  for (const row of rows) {
    const assetClass = row.asset_class;
    const window = row.window;
    const asset = String(row.asset).trim().toUpperCase();
    if (!out[assetClass][window][asset]) out[assetClass][window][asset] = [];
    out[assetClass][window][asset]!.push({
      ts: parseUtcNaiveTimestampMs(row.snapshot_time_utc),
      norm: Number(row.normalized_strength),
    });
  }
  return out;
}

function enrichTrade(params: {
  trade: WeeklyHoldTrade;
  weekOpenUtc: string;
  currencyIndex: CurrencyStrengthIndex;
  assetIndex: AssetStrengthIndex;
}): EnrichedTrade {
  const { trade, weekOpenUtc, currencyIndex, assetIndex } = params;
  const symbol = trade.symbol.toUpperCase();
  const meta = PAIR_META.get(symbol);
  const assetClass = (trade.assetClass || meta?.assetClass || "fx").toLowerCase();
  const weekOpenMs = new Date(weekOpenUtc).getTime();

  const signedByWindow: Record<StrengthWindow, number | null> = { "4h": null, "24h": null };
  const bucketByWindow: Record<StrengthWindow, Bucket> = {
    "4h": "missing",
    "24h": "missing",
  };
  const availableByWindow: Record<StrengthWindow, boolean> = { "4h": false, "24h": false };

  if (!meta || assetClass === "indices") {
    for (const window of WINDOWS) {
      bucketByWindow[window] = "unsupported";
    }
    return {
      ...trade,
      weekOpenUtc,
      signedByWindow,
      bucketByWindow,
      availableByWindow,
      supported: false,
    };
  }

  for (const window of WINDOWS) {
    let signed: number | null = null;
    let available = false;

    if (assetClass === "fx") {
      const base = findLatestAt(currencyIndex[window][meta.base], weekOpenMs);
      const quote = findLatestAt(currencyIndex[window][meta.quote], weekOpenMs);
      if (base && quote) {
        const rawSpread = base.norm - quote.norm;
        signed = trade.direction === "LONG" ? rawSpread : -rawSpread;
        available = true;
      }
    } else if (assetClass === "crypto" || assetClass === "commodities") {
      const point = findLatestAt(assetIndex[assetClass][window][meta.base], weekOpenMs);
      if (point) {
        const centered = point.norm - 50;
        signed = trade.direction === "LONG" ? centered : -centered;
        available = true;
      }
    }

    signedByWindow[window] = signed;
    availableByWindow[window] = available;
    bucketByWindow[window] = bucketSignedStrength(signed, true);
  }

  return {
    ...trade,
    weekOpenUtc,
    signedByWindow,
    bucketByWindow,
    availableByWindow,
    supported: true,
  };
}

function summarizeWeeks(weeks: WeekSummary[]): ResultSummary {
  const ordered = [...weeks].sort((a, b) =>
    DateTime.fromISO(a.weekOpenUtc, { zone: "utc" }).toMillis() -
    DateTime.fromISO(b.weekOpenUtc, { zone: "utc" }).toMillis(),
  );

  let peak = 0;
  let cumulative = 0;
  let maxDrawdown = 0;
  let losingWeeks = 0;

  let totalReturn = 0;
  let totalTrades = 0;
  let totalWins = 0;

  for (const week of ordered) {
    totalReturn += week.returnPct;
    totalTrades += week.trades;
    totalWins += week.wins;

    cumulative += week.returnPct;
    peak = Math.max(peak, cumulative);
    maxDrawdown = Math.min(maxDrawdown, cumulative - peak);
    if (week.returnPct < 0) losingWeeks += 1;
  }

  return {
    totalReturn,
    totalTrades,
    totalWins,
    winRate: totalTrades > 0 ? (totalWins / totalTrades) * 100 : 0,
    maxDrawdown,
    losingWeeks,
    weeks: ordered.length,
  };
}

function summarizeBucketTrades(trades: EnrichedTrade[], window: StrengthWindow) {
  const byBucket = new Map<Bucket, BucketTradeStats>();
  for (const trade of trades) {
    const bucket = trade.bucketByWindow[window];
    if (bucket === "missing" || bucket === "unsupported") continue;
    const current = byBucket.get(bucket) ?? { trades: 0, wins: 0, totalReturn: 0 };
    current.trades += 1;
    current.totalReturn += trade.returnPct;
    if (trade.returnPct > 0) current.wins += 1;
    byBucket.set(bucket, current);
  }
  return byBucket;
}

function applyRule(params: {
  enrichedWeeks: Array<{ weekOpenUtc: string; trades: EnrichedTrade[] }>;
  window: StrengthWindow;
  rule: RuleDefinition;
}) {
  const { enrichedWeeks, window, rule } = params;
  const filteredWeeks: WeekSummary[] = [];
  let keptSupportedTrades = 0;
  let totalSupportedTrades = 0;

  for (const week of enrichedWeeks) {
    let weekReturn = 0;
    let trades = 0;
    let wins = 0;

    for (const trade of week.trades) {
      const bucket = trade.bucketByWindow[window];
      const isSupported = trade.supported;
      const include =
        !isSupported ||
        bucket === "missing" ||
        rule.keepSupportedBucket(bucket);

      if (isSupported) totalSupportedTrades += 1;
      if (isSupported && include) keptSupportedTrades += 1;
      if (!include) continue;

      weekReturn += trade.returnPct;
      trades += 1;
      if (trade.returnPct > 0) wins += 1;
    }

    filteredWeeks.push({
      weekOpenUtc: week.weekOpenUtc,
      returnPct: weekReturn,
      trades,
      wins,
    });
  }

  const summary = summarizeWeeks(filteredWeeks);
  return {
    summary,
    keptSupportedTrades,
    totalSupportedTrades,
    keptPct: totalSupportedTrades > 0 ? (keptSupportedTrades / totalSupportedTrades) * 100 : 0,
  };
}

async function main() {
  console.log("Loading ADR weeks and strength snapshots...\n");

  const { runId, weeks } = await loadAdrRunWeeks();
  const orderedWeeks = sortAscIso(weeks);
  const currencyIndex = await loadCurrencyStrengthIndex();
  const assetIndex = await loadAssetStrengthIndex();

  console.log(`ADR run: ${runId}`);
  console.log(`Weeks: ${orderedWeeks.length}`);
  console.log(`First week: ${orderedWeeks[0]}`);
  console.log(`Last week: ${orderedWeeks[orderedWeeks.length - 1]}\n`);

  const intradayFilter = getIntradayFilter("adr_pullback");
  if (!intradayFilter) throw new Error("Intraday filter adr_pullback not found.");

  for (const systemId of SYSTEM_IDS) {
    const strategy = getStrategy(systemId);
    if (!strategy) {
      console.log(`Skipping missing strategy: ${systemId}`);
      continue;
    }

    console.log("\n" + "=".repeat(132));
    console.log(`SYSTEM: ${strategy.id} (${strategy.label})`);
    console.log("=".repeat(132));

    const engine = await computeMultiWeekHold(strategy, orderedWeeks, intradayFilter);
    const enrichedWeeks = engine.weeks.map((week) => ({
      weekOpenUtc: week.weekOpenUtc,
      trades: week.trades.map((trade) =>
        enrichTrade({
          trade,
          weekOpenUtc: week.weekOpenUtc,
          currencyIndex,
          assetIndex,
        }),
      ),
    }));

    const baselineAllWeeks: WeekSummary[] = enrichedWeeks.map((week) => ({
      weekOpenUtc: week.weekOpenUtc,
      returnPct: week.trades.reduce((sum, trade) => sum + trade.returnPct, 0),
      trades: week.trades.length,
      wins: week.trades.filter((trade) => trade.returnPct > 0).length,
    }));
    const baselineAll = summarizeWeeks(baselineAllWeeks);

    const baselineSupportedWeeks: WeekSummary[] = enrichedWeeks.map((week) => {
      const supportedTrades = week.trades.filter((trade) => trade.supported);
      return {
        weekOpenUtc: week.weekOpenUtc,
        returnPct: supportedTrades.reduce((sum, trade) => sum + trade.returnPct, 0),
        trades: supportedTrades.length,
        wins: supportedTrades.filter((trade) => trade.returnPct > 0).length,
      };
    });
    const baselineSupported = summarizeWeeks(baselineSupportedWeeks);

    const allTrades = enrichedWeeks.flatMap((week) => week.trades);
    const supportedTrades = allTrades.filter((trade) => trade.supported);
    const unsupportedTrades = allTrades.filter((trade) => !trade.supported);

    console.log("Baseline all instruments");
    console.log(
      `  Trades ${baselineAll.totalTrades} | WR ${baselineAll.winRate.toFixed(1)}% | Net ${fmtPct(baselineAll.totalReturn)} | Max DD ${fmtPct(baselineAll.maxDrawdown)} | Losing weeks ${baselineAll.losingWeeks}/${baselineAll.weeks} | Ret/DD ${fmtRatio(baselineAll.maxDrawdown < 0 ? baselineAll.totalReturn / Math.abs(baselineAll.maxDrawdown) : Number.POSITIVE_INFINITY)}`,
    );
    console.log(
      `  Asset coverage: supported ${supportedTrades.length} | unsupported(indices) ${unsupportedTrades.length}`,
    );
    console.log(
      `  Supported-only baseline: trades ${baselineSupported.totalTrades} | Net ${fmtPct(baselineSupported.totalReturn)} | Max DD ${fmtPct(baselineSupported.maxDrawdown)} | Losing weeks ${baselineSupported.losingWeeks}/${baselineSupported.weeks}`,
    );

    for (const window of WINDOWS) {
      console.log(`\n${window} signed-strength buckets (supported trades only)`);
      const bucketStats = summarizeBucketTrades(supportedTrades, window);
      const orderedBuckets: Bucket[] = [
        "strongly_against",
        "against",
        "neutral",
        "with",
        "strongly_with",
      ];
      for (const bucket of orderedBuckets) {
        const stat = bucketStats.get(bucket);
        if (!stat || stat.trades === 0) {
          console.log(`  ${bucket.padEnd(18)} trades 0`);
          continue;
        }
        const winRate = (stat.wins / stat.trades) * 100;
        const avgReturn = stat.totalReturn / stat.trades;
        console.log(
          `  ${bucket.padEnd(18)} trades ${String(stat.trades).padStart(3)} | WR ${winRate.toFixed(1).padStart(5)}% | Avg ${fmtPct(avgReturn).padStart(8)} | Net ${fmtPct(stat.totalReturn).padStart(9)}`,
        );
      }

      console.log(`\n${window} rule tests (all instruments, indices passed through unchanged)`);
      for (const rule of RULES) {
        const result = applyRule({
          enrichedWeeks,
          window,
          rule,
        });
        const ratio = result.summary.maxDrawdown < 0
          ? result.summary.totalReturn / Math.abs(result.summary.maxDrawdown)
          : Number.POSITIVE_INFINITY;
        console.log(
          `  ${rule.label.padEnd(30)} Net ${fmtPct(result.summary.totalReturn).padStart(8)} | DD ${fmtPct(result.summary.maxDrawdown).padStart(8)} | Losing weeks ${String(result.summary.losingWeeks).padStart(2)}/${result.summary.weeks} | Trades ${String(result.summary.totalTrades).padStart(3)} | Kept supported ${result.keptPct.toFixed(1).padStart(5)}% | Ret/DD ${fmtRatio(ratio)}`,
        );
      }
    }
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exit(1);
});
