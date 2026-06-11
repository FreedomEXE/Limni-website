/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: refresh-canonical-performance-data.ts
 *
 * Description:
 * Local release/verification refresh for the Performance data contract.
 * Re-derives canonical + execution weekly pair returns from canonical 1h bars,
 * then rebuilds visible strategy week shards from the refreshed source rows.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import { loadEnvConfig } from "@next/env";
import { DateTime } from "luxon";
import { getPool, query } from "@/lib/db";
import { CANONICAL_INSTRUMENTS } from "@/lib/canonicalInstruments";
import { CANONICAL_WEEKS } from "@/lib/canonicalPriceWindows";
import type { AssetClass } from "@/lib/cotMarkets";
import {
  CANONICAL_WEEKLY_RETURN_DERIVATION_VERSION,
  loadCanonicalWeeklyReturnFromHourlyBars,
} from "@/lib/canonicalWeeklyReturns";
import {
  EXECUTION_WEEKLY_RETURN_DERIVATION_VERSION,
  loadExecutionWeeklyReturnFromHourlyBars,
} from "@/lib/executionWeeklyReturns";
import { getCanonicalWeekOpenUtc } from "@/lib/weekAnchor";
import { EXECUTION_ANCHOR_VERSION } from "@/lib/executionPriceWindows";
import {
  ACTIVE_BASELINE_PERFORMANCE_HISTORY_WINDOW,
  getActiveBaselineWeeks,
} from "@/lib/appTruth/activeBaseline";
import { ensureHistoricalWeekShardsForSelection } from "@/lib/performance/strategyPageData";
import {
  buildStrategySelectionKey,
  listVisibleStrategyBootstrapSelections,
} from "@/lib/performance/strategySelection";
import { listStrategyArtifactReadiness } from "@/lib/performance/strategyArtifactReadiness";

loadEnvConfig(process.cwd());

type Args = {
  skipPairReturns: boolean;
  skipStrategyShards: boolean;
  onlyKey: string | null;
  continueOnError: boolean;
  weeks: string[] | null;
  allClosedWeeks: boolean;
};

function parseArgs(): Args {
  const args = process.argv.slice(2);
  const valueFor = (name: string) => {
    const direct = args.find((arg) => arg.startsWith(`--${name}=`));
    if (direct) return direct.slice(name.length + 3);
    const index = args.indexOf(`--${name}`);
    return index >= 0 ? args[index + 1] ?? null : null;
  };
  const weeksArg = valueFor("weeks");
  return {
    skipPairReturns: args.includes("--skip-pair-returns"),
    skipStrategyShards: args.includes("--skip-strategy-shards"),
    onlyKey: valueFor("key"),
    continueOnError: args.includes("--continue-on-error"),
    weeks: weeksArg
      ? weeksArg.split(",").map((value) => value.trim()).filter(Boolean)
      : null,
    allClosedWeeks: args.includes("--all-closed-weeks"),
  };
}

function closedCanonicalWeeks() {
  const currentWeek = getCanonicalWeekOpenUtc(DateTime.utc());
  return CANONICAL_WEEKS.filter((weekOpenUtc) => weekOpenUtc < currentWeek);
}

async function upsertCanonicalWeeklyReturn(options: {
  symbol: string;
  assetClass: AssetClass;
  weekOpenUtc: string;
}) {
  const weekly = await loadCanonicalWeeklyReturnFromHourlyBars(options);
  if (!weekly) return { ok: false, reason: "missing_hourly_window" };
  if (!weekly.complete) return { ok: false, reason: weekly.warnings.join(", ") || "incomplete" };

  await query(
    `INSERT INTO pair_period_returns (
       symbol, asset_class, period_type, period_open_utc, period_close_utc,
       anchor_type, anchor_version, window_open_utc, window_close_utc,
       open_price, close_price, high_price, low_price, return_pct,
       source, derived_from_timeframe, derivation_version
     )
     VALUES (
       $1, $2, 'weekly', $3::timestamptz, $4::timestamptz,
       'canonical', 'canonical_weekly_v2', $5::timestamptz, $6::timestamptz,
       $7, $8, $9, $10, $11,
       'canonical_price_bars', '1h', $12
     )
     ON CONFLICT (symbol, asset_class, period_type, period_open_utc, anchor_type, anchor_version)
     DO UPDATE SET
       period_close_utc = EXCLUDED.period_close_utc,
       window_open_utc = EXCLUDED.window_open_utc,
       window_close_utc = EXCLUDED.window_close_utc,
       open_price = EXCLUDED.open_price,
       close_price = EXCLUDED.close_price,
       high_price = EXCLUDED.high_price,
       low_price = EXCLUDED.low_price,
       return_pct = EXCLUDED.return_pct,
       source = EXCLUDED.source,
       derived_from_timeframe = EXCLUDED.derived_from_timeframe,
       derivation_version = EXCLUDED.derivation_version,
       updated_at = NOW()`,
    [
      weekly.symbol,
      weekly.assetClass,
      weekly.weekOpenUtc,
      weekly.periodCloseUtc,
      weekly.periodOpenUtc,
      weekly.periodCloseUtc,
      weekly.openPrice,
      weekly.closePrice,
      weekly.highPrice,
      weekly.lowPrice,
      weekly.returnPct,
      CANONICAL_WEEKLY_RETURN_DERIVATION_VERSION,
    ],
  );
  return { ok: true, reason: null };
}

async function upsertExecutionWeeklyReturn(options: {
  symbol: string;
  assetClass: AssetClass;
  weekOpenUtc: string;
}) {
  const weekly = await loadExecutionWeeklyReturnFromHourlyBars(options);
  if (!weekly) return { ok: false, reason: "missing_hourly_window" };
  if (!weekly.complete) return { ok: false, reason: weekly.warnings.join(", ") || "incomplete" };

  await query(
    `INSERT INTO pair_period_returns (
       symbol, asset_class, period_type, period_open_utc, period_close_utc,
       anchor_type, anchor_version, window_open_utc, window_close_utc,
       open_price, close_price, high_price, low_price, return_pct,
       source, derived_from_timeframe, derivation_version
     )
     VALUES (
       $1, $2, 'weekly', $3::timestamptz, $4::timestamptz,
       'execution', $5, $6::timestamptz, $7::timestamptz,
       $8, $9, $10, $11, $12,
       'canonical_price_bars', '1h', $13
     )
     ON CONFLICT (symbol, asset_class, period_type, period_open_utc, anchor_type, anchor_version)
     DO UPDATE SET
       period_close_utc = EXCLUDED.period_close_utc,
       window_open_utc = EXCLUDED.window_open_utc,
       window_close_utc = EXCLUDED.window_close_utc,
       open_price = EXCLUDED.open_price,
       close_price = EXCLUDED.close_price,
       high_price = EXCLUDED.high_price,
       low_price = EXCLUDED.low_price,
       return_pct = EXCLUDED.return_pct,
       source = EXCLUDED.source,
       derived_from_timeframe = EXCLUDED.derived_from_timeframe,
       derivation_version = EXCLUDED.derivation_version,
       updated_at = NOW()`,
    [
      weekly.symbol,
      weekly.assetClass,
      weekly.weekOpenUtc,
      weekly.periodCloseUtc,
      EXECUTION_ANCHOR_VERSION,
      weekly.windowOpenUtc,
      weekly.windowCloseUtc,
      weekly.openPrice,
      weekly.closePrice,
      weekly.highPrice,
      weekly.lowPrice,
      weekly.returnPct,
      EXECUTION_WEEKLY_RETURN_DERIVATION_VERSION,
    ],
  );
  return { ok: true, reason: null };
}

async function refreshPairReturns(weeks: string[]) {
  const activeInstruments = CANONICAL_INSTRUMENTS.filter((instrument) => instrument.isActive);
  let canonicalUpserted = 0;
  let executionUpserted = 0;
  const missing: string[] = [];

  for (const weekOpenUtc of weeks) {
    console.log(`pair_period_returns: refreshing ${weekOpenUtc}`);
    for (const instrument of activeInstruments) {
      const canonical = await upsertCanonicalWeeklyReturn({
        symbol: instrument.symbol,
        assetClass: instrument.assetClass,
        weekOpenUtc,
      });
      if (canonical.ok) {
        canonicalUpserted += 1;
      } else {
        missing.push(`${weekOpenUtc} ${instrument.symbol} canonical: ${canonical.reason}`);
      }

      const execution = await upsertExecutionWeeklyReturn({
        symbol: instrument.symbol,
        assetClass: instrument.assetClass,
        weekOpenUtc,
      });
      if (execution.ok) {
        executionUpserted += 1;
      } else {
        missing.push(`${weekOpenUtc} ${instrument.symbol} execution: ${execution.reason}`);
      }
    }
  }

  return {
    weeks: weeks.length,
    instruments: activeInstruments.length,
    canonicalUpserted,
    executionUpserted,
    missing,
  };
}

async function refreshStrategyShards(onlyKey: string | null, continueOnError: boolean) {
  const selections = listVisibleStrategyBootstrapSelections()
    .filter((selection) => !onlyKey || buildStrategySelectionKey(selection) === onlyKey);
  const before = await listStrategyArtifactReadiness(selections);
  const refreshed: Array<{ key: string; ok: boolean; computedWeeks: number; error?: string }> = [];

  for (const selection of selections) {
    const key = buildStrategySelectionKey(selection);
    const started = Date.now();
    console.log(`strategy_week_shards: refreshing ${key}`);
    try {
      const result = await ensureHistoricalWeekShardsForSelection(selection, {
        onlyPreviousWeek: false,
        historyWindow: ACTIVE_BASELINE_PERFORMANCE_HISTORY_WINDOW,
      });
      const errors = Object.entries(result.errors ?? {});
      refreshed.push({
        key,
        ok: errors.length === 0,
        computedWeeks: result.computedWeeks.length,
        error: errors.length > 0 ? errors.map(([week, error]) => `${week}: ${error}`).join("; ") : undefined,
      });
      console.log(`strategy_week_shards: ${key} ${result.computedWeeks.length} weeks in ${Date.now() - started}ms`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      refreshed.push({ key, ok: false, computedWeeks: 0, error: message });
      console.error(`strategy_week_shards: ${key} failed: ${message}`);
      if (!continueOnError) throw error;
    }
  }

  const after = await listStrategyArtifactReadiness(selections);
  return {
    beforeReady: before.filter((item) => item.ready).length,
    beforeTotal: before.length,
    afterReady: after.filter((item) => item.ready).length,
    afterTotal: after.length,
    refreshed,
  };
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not configured");
  }

  const args = parseArgs();
  const weeks = args.weeks ?? (args.allClosedWeeks ? closedCanonicalWeeks() : getActiveBaselineWeeks());
  const startedAt = Date.now();
  const report: Record<string, unknown> = {
    generatedAtUtc: new Date().toISOString(),
    executionAnchorVersion: EXECUTION_ANCHOR_VERSION,
    historyWindow: args.allClosedWeeks ? "all-closed-weeks" : ACTIVE_BASELINE_PERFORMANCE_HISTORY_WINDOW,
    weeks,
  };

  if (!args.skipPairReturns) {
    report.pairReturns = await refreshPairReturns(weeks);
  }

  if (!args.skipStrategyShards) {
    report.strategyShards = await refreshStrategyShards(args.onlyKey, args.continueOnError);
  }

  report.durationMs = Date.now() - startedAt;
  console.log(JSON.stringify(report, null, 2));
}

void main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (process.env.DATABASE_URL) {
      await getPool().end().catch(() => undefined);
    }
  });
