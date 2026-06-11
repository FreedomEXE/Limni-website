/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: scripts/verify-reconstruction.ts
 *
 * Description:
 * Independently recomputes the weekly reconstruction in memory and
 * verifies that the persisted strategy_backtest_weekly rows match.
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

import { query } from "../src/lib/db";
import { reconstructAllSystems, type ReconstructedSystemReport } from "./reconstruct-weekly-systems";

type PersistedWeeklyRow = {
  week_open_utc: Date;
  return_pct: number | string;
  trades: number | string;
  wins: number | string;
  losses: number | string;
  drawdown_pct: number | string;
  gross_profit_pct: number | string;
  gross_loss_pct: number | string;
};

type PersistedRunRow = {
  id: number;
};

type PersistedTradeSummaryRow = {
  total_trades: number | string;
  neutral_trades: number | string;
};

function toNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

function almostEqual(left: number, right: number, tolerance = 0.0001) {
  return Math.abs(left - right) <= tolerance;
}

async function readLatestRunId(report: ReconstructedSystemReport) {
  const rows = await query<PersistedRunRow>(
    `SELECT id
       FROM strategy_backtest_runs
      WHERE bot_id = $1
        AND variant = $2
        AND market = $3
      ORDER BY generated_utc DESC, id DESC
      LIMIT 1`,
    [report.botId, report.version, "multi_asset"],
  );
  return rows[0]?.id ?? null;
}

async function readPersistedWeeklyRows(runId: number) {
  return query<PersistedWeeklyRow>(
    `SELECT week_open_utc, return_pct, trades, wins, losses, drawdown_pct, gross_profit_pct, gross_loss_pct
       FROM strategy_backtest_weekly
      WHERE run_id = $1
      ORDER BY week_open_utc ASC`,
    [runId],
  );
}

async function readPersistedTradeSummary(runId: number) {
  const rows = await query<PersistedTradeSummaryRow>(
    `SELECT COUNT(*) AS total_trades,
            COUNT(*) FILTER (WHERE direction = 'NEUTRAL') AS neutral_trades
       FROM strategy_backtest_trades
      WHERE run_id = $1`,
    [runId],
  );
  return rows[0] ?? null;
}

async function main() {
  const reports = await reconstructAllSystems();
  let failures = 0;

  for (const report of reports) {
    const runId = await readLatestRunId(report);
    if (!runId) {
      console.error(`[FAIL] ${report.system}: missing persisted run`);
      failures += 1;
      continue;
    }

    const rows = await readPersistedWeeklyRows(runId);
    if (rows.length !== report.weeklyReturns.length) {
      console.error(
        `[FAIL] ${report.system}: weekly row count mismatch persisted=${rows.length} reconstructed=${report.weeklyReturns.length}`,
      );
      failures += 1;
      continue;
    }

    let systemFailed = false;
    for (let index = 0; index < rows.length; index += 1) {
      const persisted = rows[index]!;
      const reconstructed = report.weeklyReturns[index]!;
      const weekOpenUtc = persisted.week_open_utc.toISOString();

      if (weekOpenUtc !== reconstructed.weekOpenUtc) {
        console.error(
          `[FAIL] ${report.system}: week mismatch persisted=${weekOpenUtc} reconstructed=${reconstructed.weekOpenUtc}`,
        );
        failures += 1;
        systemFailed = true;
        break;
      }

      const checks = [
        ["return_pct", toNumber(persisted.return_pct), reconstructed.returnPct],
        ["trades", toNumber(persisted.trades), reconstructed.trades],
        ["wins", toNumber(persisted.wins), reconstructed.wins],
        ["losses", toNumber(persisted.losses), reconstructed.losses],
        ["drawdown_pct", toNumber(persisted.drawdown_pct), reconstructed.drawdownPct],
        ["gross_profit_pct", toNumber(persisted.gross_profit_pct), reconstructed.grossProfitPct],
        ["gross_loss_pct", toNumber(persisted.gross_loss_pct), reconstructed.grossLossPct],
      ] as const;

      for (const [label, left, right] of checks) {
        const valid = label === "trades" || label === "wins" || label === "losses"
          ? left === right
          : almostEqual(left, right);
        if (!valid) {
          console.error(
            `[FAIL] ${report.system} ${weekOpenUtc} ${label}: persisted=${left} reconstructed=${right}`,
          );
          failures += 1;
          systemFailed = true;
          break;
        }
      }

      if (systemFailed) break;
    }

    if (!systemFailed) {
      const persistedTradeSummary = await readPersistedTradeSummary(runId);
      const reconstructedTradeCount = report.weeklyReturns.reduce(
        (sum, week) => sum + week.breakdown.nettedPairs.length + week.breakdown.skippedDueToNetting.length,
        0,
      );
      const reconstructedNeutralTrades = report.weeklyReturns.reduce(
        (sum, week) => sum + week.breakdown.skippedDueToNetting.length,
        0,
      );
      const persistedTotalTrades = toNumber(persistedTradeSummary?.total_trades);
      const persistedNeutralTrades = toNumber(persistedTradeSummary?.neutral_trades);

      if (persistedTotalTrades !== reconstructedTradeCount) {
        console.error(
          `[FAIL] ${report.system}: trade row count mismatch persisted=${persistedTotalTrades} reconstructed=${reconstructedTradeCount}`,
        );
        failures += 1;
        continue;
      }

      if (persistedNeutralTrades !== reconstructedNeutralTrades) {
        console.error(
          `[FAIL] ${report.system}: neutral trade count mismatch persisted=${persistedNeutralTrades} reconstructed=${reconstructedNeutralTrades}`,
        );
        failures += 1;
        continue;
      }

      console.log(`[PASS] ${report.system}: ${rows.length} weekly rows verified against reconstruction`);
    }
  }

  if (failures > 0) {
    throw new Error(`Verification failed with ${failures} mismatches`);
  }
}

main().catch((error) => {
  console.error("Reconstruction verification failed:", error);
  process.exitCode = 1;
});
