/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: ingest-tiered-flagship-backtest.ts
 *
 * Description:
 * Normalizes the audited Tiered V1 8-week flagship snapshot into
 * strategy_backtest_runs so the Performance page can read the weekly
 * flagship from the canonical DB store.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

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

const CANONICAL_WEEKS = [
  "2026-01-19T00:00:00.000Z",
  "2026-01-26T00:00:00.000Z",
  "2026-02-02T00:00:00.000Z",
  "2026-02-09T00:00:00.000Z",
  "2026-02-16T00:00:00.000Z",
  "2026-02-23T00:00:00.000Z",
  "2026-03-02T00:00:00.000Z",
  "2026-03-09T00:00:00.000Z",
] as const;

function round(value: number, digits = 6) {
  return Number(value.toFixed(digits));
}

async function main() {
  const { computeTieredForWeeksAllSystems } = await import("../src/lib/performance/tiered");
  const { persistStrategyBacktestSnapshot } = await import(
    "../src/lib/performance/strategyBacktestIngestion"
  );
  const tiered = await computeTieredForWeeksAllSystems({
    weeks: [...CANONICAL_WEEKS],
  });
  const weeks = [...tiered.v1].sort(
    (left, right) => Date.parse(left.week_open_utc) - Date.parse(right.week_open_utc),
  );
  if (weeks.length === 0) {
    throw new Error("No tiered_v1 rows were computed for canonical weeks.");
  }

  const weekly = weeks.map((week) => {
    const returnPct = round(week.summary.return_percent);
    return {
      weekOpenUtc: week.week_open_utc,
      returnPct,
      trades: week.summary.trades,
      wins: week.summary.wins,
      losses: Math.max(0, week.summary.priced_trades - week.summary.wins),
      stopHits: 0,
      drawdownPct: returnPct < 0 ? round(Math.abs(returnPct)) : 0,
      grossProfitPct: returnPct > 0 ? returnPct : 0,
      grossLossPct: returnPct < 0 ? round(Math.abs(returnPct)) : 0,
      equityEndPct: null,
      pnlUsd: null,
    };
  });

  await persistStrategyBacktestSnapshot({
    context: "tiered_v1 flagship ingest",
    snapshot: {
      run: {
        botId: "tiered_v1_flagship",
        variant: "v1",
        market: "multi_asset",
        strategyName: "Tiered V1 Flagship (Canonical 8W)",
        backtestWeeks: weekly.length,
        generatedUtc: new Date().toISOString(),
        configJson: {
          canonicalWeeks: [...CANONICAL_WEEKS],
          source: "computeTieredForWeeksAllSystems",
          accountSizeUsd: Number(process.env.PERFORMANCE_TIERED_ACCOUNT_SIZE_USD ?? "100000"),
          note: "Normalized from audited tiered_v1 weekly derivation for the simplified Performance flagship view.",
        },
      },
      weekly,
      trades: [],
    },
  });
}

main().catch((error) => {
  console.error("ingest-tiered-flagship-backtest failed:", error);
  process.exitCode = 1;
});
