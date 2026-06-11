/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: scripts/investigate-weekly-flagships.ts
 *
 * Description:
 * Produces a canonical investigation report for weekly flagship candidates,
 * reconciling the legacy Universal DB run against the bias-gate overlay report.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { loadEnvConfig } from "@next/env";
import { Client } from "pg";

type AuditStrategyRow = {
  name: string;
  entry_id: string;
  source_table: string;
  source_query: string;
  run_id: number | null;
  week_set: string[];
  recomputed_from: string;
  displayed: {
    return_pct: number;
    win_rate_pct: number;
    max_dd_pct: number;
    trades: number;
    weeks_shown: number;
    sourcePath: string;
  };
  audited: {
    return_pct: number;
    win_rate_pct: number;
    max_dd_pct: number;
    trades: number;
    weeks_covered: number;
  };
  verdict: string;
  verdict_reason: string;
};

type GateComparisonWeek = {
  weekOpenUtc: string;
  baselineReturn: number;
  gatedReturn: number;
  skippedTrades?: number;
  reducedTrades?: number;
};

type GateComparison = {
  strategy: string;
  baseline: {
    totalReturn: number;
    weeks: number;
    winRatePct: number;
    avgWeeklyPct: number;
    maxDrawdownPct: number;
    trades: number;
    tradeWinRatePct: number;
  };
  gated: {
    totalReturn: number;
    weeks: number;
    winRatePct: number;
    avgWeeklyPct: number;
    maxDrawdownPct: number;
    trades: number;
    tradeWinRatePct: number;
  };
  weekly: GateComparisonWeek[];
};

type DbWeeklyRow = {
  week_open_utc: string;
  return_pct: string | number;
  trades: string | number;
  wins: string | number;
  losses: string | number;
  drawdown_pct: string | number;
  gross_profit_pct: string | number;
  gross_loss_pct: string | number;
  equity_end_pct: string | number;
};

function round(value: number, places = 4) {
  if (!Number.isFinite(value)) return 0;
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

function compoundReturns(returns: number[]) {
  let equity = 1;
  for (const value of returns) {
    if (!Number.isFinite(value)) continue;
    const multiplier = 1 + value / 100;
    if (multiplier <= 0) return -100;
    equity *= multiplier;
  }
  return (equity - 1) * 100;
}

function maxDrawdownFromReturns(returns: number[]) {
  let equity = 1;
  let peak = 1;
  let maxDrawdown = 0;
  for (const value of returns) {
    if (!Number.isFinite(value)) continue;
    const multiplier = 1 + value / 100;
    if (multiplier <= 0) return 100;
    equity *= multiplier;
    peak = Math.max(peak, equity);
    const drawdown = peak > 0 ? ((peak - equity) / peak) * 100 : 0;
    maxDrawdown = Math.max(maxDrawdown, drawdown);
  }
  return maxDrawdown;
}

function toNumber(value: string | number | null | undefined) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

async function main() {
  loadEnvConfig(process.cwd());

  const reportsDir = path.resolve(process.cwd(), "app", "reports");
  const outPath = path.join(reportsDir, "weekly-flagship-investigation.json");
  mkdirSync(reportsDir, { recursive: true });

  const audit = JSON.parse(
    readFileSync(path.join(reportsDir, "performance-accuracy-audit.json"), "utf8"),
  ) as { strategies: AuditStrategyRow[]; flagship_candidates?: unknown };
  const gateReport = JSON.parse(
    readFileSync(path.join(reportsDir, "bias-gate", "strategy-comparison-reduce-as-skip.json"), "utf8"),
  ) as { generated_utc: string; comparisons: GateComparison[]; assumptions?: Record<string, unknown> };

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  const runRows = await client.query(
    "select id, bot_id, variant, market, strategy_name, backtest_weeks, carry_mode, stop_mode, generated_utc, config_json from strategy_backtest_runs order by id",
  );
  const universalRunRows = await client.query(
    "select week_open_utc, return_pct, trades, wins, losses, drawdown_pct, gross_profit_pct, gross_loss_pct, equity_end_pct from strategy_backtest_weekly where run_id = 2 order by week_open_utc",
  );
  const tieredRunRows = await client.query(
    "select week_open_utc, return_pct, trades, wins, losses, drawdown_pct, gross_profit_pct, gross_loss_pct, equity_end_pct from strategy_backtest_weekly where run_id = 11 order by week_open_utc",
  );
  await client.end();

  const universalWeekly = (universalRunRows.rows as DbWeeklyRow[]).map((row) => ({
    weekOpenUtc: row.week_open_utc,
    returnPct: toNumber(row.return_pct),
    trades: toNumber(row.trades),
    wins: toNumber(row.wins),
    losses: toNumber(row.losses),
    drawdownPct: toNumber(row.drawdown_pct),
    grossProfitPct: toNumber(row.gross_profit_pct),
    grossLossPct: toNumber(row.gross_loss_pct),
    equityEndPct: toNumber(row.equity_end_pct),
  }));

  const tieredWeekly = (tieredRunRows.rows as DbWeeklyRow[]).map((row) => ({
    weekOpenUtc: row.week_open_utc,
    returnPct: toNumber(row.return_pct),
    trades: toNumber(row.trades),
    wins: toNumber(row.wins),
    losses: toNumber(row.losses),
    drawdownPct: toNumber(row.drawdown_pct),
    grossProfitPct: toNumber(row.gross_profit_pct),
    grossLossPct: toNumber(row.gross_loss_pct),
    equityEndPct: toNumber(row.equity_end_pct),
  }));

  const gateCompounded = gateReport.comparisons.map((comparison) => {
    const baselineReturns = comparison.weekly.map((row) => row.baselineReturn);
    const gatedReturns = comparison.weekly.map((row) => row.gatedReturn);
    return {
      strategy: comparison.strategy,
      baseline: {
        reportedTotalReturnPct: comparison.baseline.totalReturn,
        compoundedTotalReturnPct: round(compoundReturns(baselineReturns), 4),
        reportedMaxDrawdownPct: comparison.baseline.maxDrawdownPct,
        recomputedMaxDrawdownPct: round(maxDrawdownFromReturns(baselineReturns), 6),
        weeks: comparison.baseline.weeks,
        trades: comparison.baseline.trades,
      },
      gated: {
        reportedTotalReturnPct: comparison.gated.totalReturn,
        compoundedTotalReturnPct: round(compoundReturns(gatedReturns), 4),
        reportedMaxDrawdownPct: comparison.gated.maxDrawdownPct,
        recomputedMaxDrawdownPct: round(maxDrawdownFromReturns(gatedReturns), 6),
        weeks: comparison.gated.weeks,
        trades: comparison.gated.trades,
      },
      weekly: comparison.weekly,
    };
  });

  const universalAudit = audit.strategies.find((row) => row.entry_id === "universal_v1") ?? null;
  const tieredAudit = audit.strategies.find((row) => row.entry_id === "tiered_v1") ?? null;
  const universalRun = runRows.rows.find((row) => String(row.id) === "2") ?? null;
  const tieredRun = runRows.rows.find((row) => String(row.id) === "11") ?? null;
  const universalGate = gateCompounded.find((row) => row.strategy === "universal_v1") ?? null;
  const tieredGate = gateCompounded.find((row) => row.strategy === "tiered_v1") ?? null;

  const report = {
    generated_utc: new Date().toISOString(),
    source_models: {
      v1: ["antikythera", "blended", "dealer", "commercial", "sentiment"],
      v2: ["dealer", "sentiment", "antikythera_v2"],
      v3: ["antikythera_v3", "dealer", "commercial", "sentiment"],
      note: "Dealer/commercial/sentiment are the core COT-derived inputs, but Universal/Tiered systems also layer Antikythera/Blended model families.",
    },
    gate_report: {
      generated_utc: gateReport.generated_utc,
      assumptions: gateReport.assumptions ?? null,
      note: "The gate overlay report stores totalReturn as the simple sum of weekly returns, while drawdown is computed from the compounded weekly equity curve.",
      comparisons: gateCompounded,
    },
    universal_v1_legacy_db_run: {
      audit_entry: universalAudit,
      run: universalRun,
      weekly: universalWeekly,
      recomputed: {
        compoundedTotalReturnPct: round(compoundReturns(universalWeekly.map((row) => row.returnPct)), 4),
        weekCloseMaxDrawdownPct: round(maxDrawdownFromReturns(universalWeekly.map((row) => row.returnPct)), 6),
      },
      interpretation: {
        note: "This is a 6-week legacy carry run. Weekly return_pct is week_delta_equity_pct, which includes floating P&L changes. stop_mode is none and carry_mode is aligned.",
        floatingRiskPct:
          universalRun && typeof universalRun.config_json === "object" && universalRun.config_json !== null
            ? toNumber((universalRun.config_json as { totals?: { floating_pct?: number } }).totals?.floating_pct)
            : 0,
        realizedPct:
          universalRun && typeof universalRun.config_json === "object" && universalRun.config_json !== null
            ? toNumber((universalRun.config_json as { totals?: { realized_pct?: number } }).totals?.realized_pct)
            : 0,
      },
    },
    tiered_v1_flagship_db_run: {
      audit_entry: tieredAudit,
      run: tieredRun,
      weekly: tieredWeekly,
      recomputed: {
        compoundedTotalReturnPct: round(compoundReturns(tieredWeekly.map((row) => row.returnPct)), 4),
        weekCloseMaxDrawdownPct: round(maxDrawdownFromReturns(tieredWeekly.map((row) => row.returnPct)), 6),
      },
      interpretation: {
        note: "This is the canonical 8-week DB-backed tiered flagship run created during normalization. It is the current safe weekly reference, but its risk profile is weak compared with the gate-overlay outliers.",
      },
    },
    conclusions: [
      "Universal V1 legacy DB run and bias-gate Universal V1 are not the same experiment. The DB run is a 6-week carry strategy with floating losers; the gate report is an 8-week snapshot overlay with trade skipping.",
      "The bias-gate report's displayed totalReturn values are additive, not compounded. Universal V1 gated compounds to about 146.33% from the stored weekly series, with week-close max drawdown about 1.19%.",
      "Because the gate report is an overlay study rather than a canonical persisted backtest run, it is strong evidence of alpha but not yet sufficient on its own to crown a flagship model.",
      "Universal V1 is still promising, but the flagship decision should be based on a dedicated 8-week rerun of the gated strategy with a persisted strategy_backtest_runs record, not on the overlay report alone.",
    ],
  };

  writeFileSync(outPath, JSON.stringify(report, null, 2));
  console.log(`weekly flagship investigation written to ${path.relative(process.cwd(), outPath)}`);
}

main().catch((error) => {
  console.error("investigate-weekly-flagships failed:", error);
  process.exitCode = 1;
});
