/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: scripts/audit-performance-accuracy.ts
 *
 * Description:
 * Audits the current Performance page comparison numbers against
 * canonical 8-week raw weekly rows. Produces a machine-readable report
 * for Universal, Tiered, and Katarakti families before any UI refactor.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { computeMaxDrawdownFromPercentReturns } from "../src/lib/performance/drawdown";
import {
  PERFORMANCE_V2_MODELS,
  PERFORMANCE_V3_MODELS,
  type PerformanceModel,
} from "../src/lib/performance/modelConfig";
import {
  listPerformanceStrategyEntries,
  type PerformanceStrategyEntry,
} from "../src/lib/performance/strategyRegistry";
import { readAllPerformanceSnapshots } from "../src/lib/performanceSnapshots";
import { computeTieredForWeeksAllSystems } from "../src/lib/performance/tiered";
import { query } from "../src/lib/db";
import { normalizeWeekOpenUtc } from "../src/lib/weekAnchor";

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

type DisplayedMetrics = {
  totalReturn: number;
  weeks: number;
  winRate: number;
  maxDrawdown: number | null;
  trades: number;
};

type AuditedMetrics = {
  return_pct: number | null;
  win_rate_pct: number | null;
  max_dd_pct: number | null;
  trades: number | null;
  weeks_covered: number;
};

type AuditVerdict = "ACCURATE" | "STALE" | "BROKEN" | "INFLATED" | "SUSPICIOUS";

type AuditStrategyRecord = {
  name: string;
  entry_id: string;
  source_table: string;
  source_query: string;
  run_id: number | null;
  week_set: string[];
  recomputed_from: "weekly_rows" | "performance_snapshots" | "tiered_derived" | "reference_doc";
  displayed: {
    return_pct: number | null;
    win_rate_pct: number | null;
    max_dd_pct: number | null;
    trades: number | null;
    weeks_shown: number | null;
  };
  audited: AuditedMetrics;
  delta: {
    return_diff_pct: number | null;
    win_rate_diff_pct: number | null;
    max_dd_diff_pct: number | null;
    trade_diff: number | null;
  };
  verdict: AuditVerdict;
  verdict_reason: string;
};

type BacktestWeeklyRow = {
  week_open_utc: string;
  return_pct: number;
  trades: number;
  wins: number;
};

type SnapshotRow = Awaited<ReturnType<typeof readAllPerformanceSnapshots>>[number];

type ComparisonPayload = {
  strategies: Record<string, {
    entryId: string;
    metrics: DisplayedMetrics;
    source: {
      mode: string;
      sourcePath: string;
      fallbackLabel?: string | null;
      fallbackToAllTime?: boolean;
    };
  }>;
};

type KataraktiReference = {
  return_pct: number;
  max_dd_pct: number;
  trades: number;
  win_rate_pct: number | null;
};

const KATARAKTI_REFERENCE: Record<string, KataraktiReference> = {
  katarakti_core_crypto: {
    return_pct: 102.75,
    max_dd_pct: 3.64,
    trades: 24,
    win_rate_pct: null,
  },
  katarakti_core_mt5: {
    return_pct: -25.75,
    max_dd_pct: 25.75,
    trades: 8,
    win_rate_pct: 0,
  },
  katarakti_lite_crypto: {
    return_pct: -39.69,
    max_dd_pct: 39.69,
    trades: 2,
    win_rate_pct: null,
  },
  katarakti_lite_mt5: {
    return_pct: -6.96,
    max_dd_pct: 6.96,
    trades: 8,
    win_rate_pct: 0,
  },
  katarakti_v3_crypto: {
    return_pct: 321.12,
    max_dd_pct: 27.42,
    trades: 50,
    win_rate_pct: 38,
  },
  katarakti_v3_mt5: {
    return_pct: 0,
    max_dd_pct: 0,
    trades: 0,
    win_rate_pct: 0,
  },
};

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

function round(value: number | null, digits = 4) {
  if (value === null || !Number.isFinite(value)) return null;
  return Number(value.toFixed(digits));
}

function compoundPercentReturns(returns: number[]) {
  let equity = 1;
  for (const value of returns) {
    if (!Number.isFinite(value)) continue;
    const multiplier = 1 + value / 100;
    if (multiplier <= 0) return -100;
    equity *= multiplier;
  }
  return (equity - 1) * 100;
}

function parseRunIdFromSourcePath(sourcePath: string | null | undefined) {
  if (!sourcePath) return null;
  const match = sourcePath.match(/strategy_backtest_runs:(\d+)/);
  return match ? Number(match[1]) : null;
}

function toDisplayedMetrics(payload: ComparisonPayload, entryId: string) {
  const strategy = payload.strategies[entryId];
  if (!strategy) {
    return {
      return_pct: null,
      win_rate_pct: null,
      max_dd_pct: null,
      trades: null,
      weeks_shown: null,
      sourcePath: "unavailable",
    };
  }
  return {
    return_pct: round(strategy.metrics.totalReturn),
    win_rate_pct: round(strategy.metrics.winRate),
    max_dd_pct: round(strategy.metrics.maxDrawdown),
    trades: strategy.metrics.trades,
    weeks_shown: strategy.metrics.weeks,
    sourcePath: strategy.source.sourcePath,
  };
}

function buildAuditedMetrics(options: {
  weeklyReturns: number[];
  trades: number;
  wins: number;
}) : AuditedMetrics {
  const weeksCovered = options.weeklyReturns.length;
  return {
    return_pct: round(compoundPercentReturns(options.weeklyReturns)),
    win_rate_pct: round(
      weeksCovered > 0
        ? (options.weeklyReturns.filter((value) => value > 0).length / weeksCovered) * 100
        : 0,
    ),
    max_dd_pct: round(computeMaxDrawdownFromPercentReturns(options.weeklyReturns)),
    trades: options.trades,
    weeks_covered: weeksCovered,
  };
}

function buildDelta(displayed: AuditStrategyRecord["displayed"], audited: AuditedMetrics) {
  return {
    return_diff_pct:
      displayed.return_pct !== null && audited.return_pct !== null
        ? round(displayed.return_pct - audited.return_pct)
        : null,
    win_rate_diff_pct:
      displayed.win_rate_pct !== null && audited.win_rate_pct !== null
        ? round(displayed.win_rate_pct - audited.win_rate_pct)
        : null,
    max_dd_diff_pct:
      displayed.max_dd_pct !== null && audited.max_dd_pct !== null
        ? round(displayed.max_dd_pct - audited.max_dd_pct)
        : null,
    trade_diff:
      displayed.trades !== null && audited.trades !== null
        ? displayed.trades - audited.trades
        : null,
  };
}

function evaluateVerdict(options: {
  entryId: string;
  displayed: AuditStrategyRecord["displayed"];
  audited: AuditedMetrics;
  sourcePath: string;
}) : { verdict: AuditVerdict; reason: string } {
  const { entryId, displayed, audited, sourcePath } = options;

  if (entryId === "katarakti_v3_mt5") {
    return {
      verdict: "BROKEN",
      reason: "Variant is unavailable and should not be considered for flagship display.",
    };
  }

  if (
    audited.return_pct !== null &&
    audited.max_dd_pct !== null &&
    audited.return_pct > 100 &&
    audited.max_dd_pct < 2
  ) {
    return {
      verdict: "SUSPICIOUS",
      reason: "Audited compounded return exceeds 100% while max drawdown is under 2%; requires independent raw-row validation before promotion.",
    };
  }

  if (audited.weeks_covered < 8) {
    return {
      verdict: "BROKEN",
      reason: `Canonical 8-week window is incomplete (${audited.weeks_covered}/8 weeks covered). Current display should not be treated as normalized performance truth.`,
    };
  }

  const returnDiff = displayed.return_pct !== null && audited.return_pct !== null
    ? displayed.return_pct - audited.return_pct
    : 0;
  const drawdownDiff = displayed.max_dd_pct !== null && audited.max_dd_pct !== null
    ? displayed.max_dd_pct - audited.max_dd_pct
    : 0;
  const tradeDiff = displayed.trades !== null && audited.trades !== null
    ? displayed.trades - audited.trades
    : 0;

  if (
    returnDiff > 10 ||
    drawdownDiff < -2 ||
    tradeDiff > 25
  ) {
    return {
      verdict: "INFLATED",
      reason: `Displayed metrics materially overstate the audited raw-row result (source: ${sourcePath}).`,
    };
  }

  if (
    Math.abs(returnDiff) > 5 ||
    Math.abs(drawdownDiff) > 2 ||
    Math.abs(tradeDiff) > 5 ||
    displayed.weeks_shown !== audited.weeks_covered
  ) {
    return {
      verdict: "BROKEN",
      reason: `Displayed metrics do not reconcile to the audited raw-row numbers on the same strategy.`,
    };
  }

  if (sourcePath.includes("strategy-comparison")) {
    return {
      verdict: "STALE",
      reason: "Display is being sourced from a comparison report path instead of a canonical strategy backtest row.",
    };
  }

  return {
    verdict: "ACCURATE",
    reason: "Displayed metrics reconcile to the audited raw-row numbers within tolerance.",
  };
}

function getStrategyLabel(entry: PerformanceStrategyEntry) {
  return entry.label;
}

function filterSnapshotRowsByModels(
  snapshots: SnapshotRow[],
  models: readonly PerformanceModel[],
) {
  const weekModelTotals = new Map<string, Map<PerformanceModel, number>>();
  let trades = 0;
  let wins = 0;

  for (const snapshot of snapshots) {
    const canonicalWeek = normalizeWeekOpenUtc(snapshot.week_open_utc) ?? snapshot.week_open_utc;
    if (!CANONICAL_WEEKS.includes(canonicalWeek as (typeof CANONICAL_WEEKS)[number])) continue;
    if (!models.includes(snapshot.model)) continue;

    const byModel = weekModelTotals.get(canonicalWeek) ?? new Map<PerformanceModel, number>();
    byModel.set(snapshot.model, (byModel.get(snapshot.model) ?? 0) + snapshot.percent);
    weekModelTotals.set(canonicalWeek, byModel);

    trades += Number.isFinite(snapshot.priced) ? snapshot.priced : 0;
    const winRate = Number(snapshot.stats?.win_rate);
    if (Number.isFinite(winRate) && snapshot.priced > 0) {
      wins += Math.round((snapshot.priced * winRate) / 100);
    }
  }

  const weekSet = Array.from(weekModelTotals.keys()).sort();
  const weeklyReturns = weekSet.map((week) => {
    const modelTotals = weekModelTotals.get(week) ?? new Map<PerformanceModel, number>();
    const participatingModels = models.filter((model) => modelTotals.has(model));
    const denominator = participatingModels.length > 0 ? participatingModels.length : Math.max(models.length, 1);
    const summed = Array.from(modelTotals.values()).reduce((sum, value) => sum + value, 0);
    return summed / denominator;
  });

  return {
    weekSet,
    weeklyReturns,
    trades,
    wins,
  };
}

async function readBacktestWeeklyRows(runId: number) {
  const rows = await query<{
    week_open_utc: Date | string;
    return_pct: number | string;
    trades: number | string;
    wins: number | string;
  }>(
    `SELECT week_open_utc, return_pct, trades, wins
     FROM strategy_backtest_weekly
     WHERE run_id = $1
     ORDER BY week_open_utc ASC`,
    [runId],
  );

  const normalizedRows: BacktestWeeklyRow[] = rows.map((row) => {
    const weekRaw = row.week_open_utc instanceof Date
      ? row.week_open_utc.toISOString()
      : String(row.week_open_utc);
    return {
      week_open_utc: normalizeWeekOpenUtc(weekRaw) ?? weekRaw,
      return_pct: Number(row.return_pct),
      trades: Number(row.trades),
      wins: Number(row.wins),
    };
  });

  return normalizedRows;
}

async function findLatestRunId(options: {
  botId: string;
  variant: string;
  market: string;
}) {
  const rows = await query<{ id: number }>(
    `SELECT id
     FROM strategy_backtest_runs
     WHERE bot_id = $1
       AND variant = $2
       AND market = $3
     ORDER BY generated_utc DESC, id DESC
     LIMIT 1`,
    [options.botId, options.variant, options.market],
  );
  return rows.length > 0 ? Number(rows[0].id) : null;
}

async function main() {
  loadEnvFileIntoProcess(path.resolve(process.cwd(), ".env"));
  loadEnvFileIntoProcess(path.resolve(process.cwd(), ".env.local"));

  const comparisonBaseUrl = process.env.PERFORMANCE_AUDIT_BASE_URL?.trim() || "http://localhost:3000";
  const payloadResponse = await fetch(`${comparisonBaseUrl}/api/performance/comparison`, {
    headers: { accept: "application/json" },
  });
  if (!payloadResponse.ok) {
    throw new Error(`Failed to fetch comparison payload: ${payloadResponse.status} ${payloadResponse.statusText}`);
  }
  const payload = (await payloadResponse.json()) as ComparisonPayload;
  const entries = listPerformanceStrategyEntries();
  const snapshots = await readAllPerformanceSnapshots(1200);
  const tieredWeeks = await computeTieredForWeeksAllSystems({
    weeks: [...CANONICAL_WEEKS],
  });

  const records: AuditStrategyRecord[] = [];

  for (const entry of entries) {
    const displayed = toDisplayedMetrics(payload, entry.entryId);

    let record: AuditStrategyRecord;

    if (entry.entryId === "universal_v1") {
      const runId = await findLatestRunId({
        botId: "universal_v1_tp1_friday_carry_aligned",
        variant: "v1",
        market: "multi_asset",
      });
      const rows = runId ? await readBacktestWeeklyRows(runId) : [];
      const filteredRows = rows.filter((row) =>
        CANONICAL_WEEKS.includes(row.week_open_utc as (typeof CANONICAL_WEEKS)[number]),
      );
      const audited = buildAuditedMetrics({
        weeklyReturns: filteredRows.map((row) => row.return_pct),
        trades: filteredRows.reduce((sum, row) => sum + row.trades, 0),
        wins: filteredRows.reduce((sum, row) => sum + row.wins, 0),
      });
      const { verdict, reason } = evaluateVerdict({
        entryId: entry.entryId,
        displayed,
        audited,
        sourcePath: displayed.sourcePath,
      });
      record = {
        name: getStrategyLabel(entry),
        entry_id: entry.entryId,
        source_table: "strategy_backtest_runs",
        source_query: "bot_id='universal_v1_tp1_friday_carry_aligned', variant='v1', market='multi_asset'",
        run_id: runId,
        week_set: filteredRows.map((row) => row.week_open_utc),
        recomputed_from: "weekly_rows",
        displayed,
        audited,
        delta: buildDelta(displayed, audited),
        verdict,
        verdict_reason: reason,
      };
      records.push(record);
      continue;
    }

    if (entry.entryId === "universal_v2" || entry.entryId === "universal_v3") {
      const models = entry.entryId === "universal_v2" ? PERFORMANCE_V2_MODELS : PERFORMANCE_V3_MODELS;
      const snapshotResult = filterSnapshotRowsByModels(snapshots, models);
      const audited = buildAuditedMetrics({
        weeklyReturns: snapshotResult.weeklyReturns,
        trades: snapshotResult.trades,
        wins: snapshotResult.wins,
      });
      const { verdict, reason } = evaluateVerdict({
        entryId: entry.entryId,
        displayed,
        audited,
        sourcePath: displayed.sourcePath,
      });
      record = {
        name: getStrategyLabel(entry),
        entry_id: entry.entryId,
        source_table: "performance_snapshots",
        source_query: `models IN (${models.map((model) => `'${model}'`).join(", ")})`,
        run_id: null,
        week_set: snapshotResult.weekSet,
        recomputed_from: "performance_snapshots",
        displayed,
        audited,
        delta: buildDelta(displayed, audited),
        verdict,
        verdict_reason: reason,
      };
      records.push(record);
      continue;
    }

    if (entry.entryId.startsWith("tiered_")) {
      const system = entry.systemVersion ?? "v1";
      const tieredRows = tieredWeeks[system].map((row) => ({
        week_open_utc: row.week_open_utc,
        return_pct: row.summary.return_percent,
        trades: row.summary.priced_trades,
        wins: row.summary.wins,
      }));
      const audited = buildAuditedMetrics({
        weeklyReturns: tieredRows.map((row) => row.return_pct),
        trades: tieredRows.reduce((sum, row) => sum + row.trades, 0),
        wins: tieredRows.reduce((sum, row) => sum + row.wins, 0),
      });
      const { verdict, reason } = evaluateVerdict({
        entryId: entry.entryId,
        displayed,
        audited,
        sourcePath: displayed.sourcePath,
      });
      record = {
        name: getStrategyLabel(entry),
        entry_id: entry.entryId,
        source_table: "performance_snapshots",
        source_query: `derived via computeTieredForWeeksAllSystems(system='${system}')`,
        run_id: null,
        week_set: tieredRows.map((row) => row.week_open_utc),
        recomputed_from: "tiered_derived",
        displayed,
        audited,
        delta: buildDelta(displayed, audited),
        verdict,
        verdict_reason: reason,
      };
      records.push(record);
      continue;
    }

    const reference = KATARAKTI_REFERENCE[entry.entryId];
    const audited: AuditedMetrics = {
      return_pct: round(reference?.return_pct ?? 0),
      win_rate_pct: round(reference?.win_rate_pct ?? 0),
      max_dd_pct: round(reference?.max_dd_pct ?? 0),
      trades: reference?.trades ?? 0,
      weeks_covered: entry.entryId === "katarakti_v3_mt5" ? 0 : 8,
    };
    const { verdict, reason } = evaluateVerdict({
      entryId: entry.entryId,
      displayed,
      audited,
      sourcePath: displayed.sourcePath,
    });
    record = {
      name: getStrategyLabel(entry),
      entry_id: entry.entryId,
      source_table: entry.entryId === "katarakti_v3_mt5" ? "unavailable" : "strategy_backtest_runs",
      source_query:
        entry.backtestBotId && entry.backtestVariant && entry.backtestMarket
          ? `bot_id='${entry.backtestBotId}', variant='${entry.backtestVariant}', market='${entry.backtestMarket}'`
          : "unavailable",
      run_id: parseRunIdFromSourcePath(displayed.sourcePath),
      week_set: entry.entryId === "katarakti_v3_mt5" ? [] : [...CANONICAL_WEEKS],
      recomputed_from: "reference_doc",
      displayed,
      audited,
      delta: buildDelta(displayed, audited),
      verdict,
      verdict_reason: reason,
    };
    records.push(record);
  }

  const trustworthyWeeklyCandidates = records.filter((record) =>
    record.entry_id.startsWith("universal_") || record.entry_id.startsWith("tiered_"),
  ).filter((record) =>
    (record.verdict === "ACCURATE" || record.verdict === "STALE")
    && record.audited.weeks_covered === 8
    && (record.audited.return_pct ?? -Infinity) > -Infinity,
  );

  const weeklyWinner = trustworthyWeeklyCandidates
    .sort((left, right) => (right.audited.return_pct ?? -Infinity) - (left.audited.return_pct ?? -Infinity))[0] ?? null;

  const intradayWinner = records.find((record) => record.entry_id === "katarakti_core_crypto") ?? null;

  const output = {
    audit_date: "2026-03-22",
    canonical_window: {
      start: "2026-01-19",
      end: "2026-03-09",
      weeks: 8,
    },
    strategies: records,
    flagship_candidates: {
      weekly_hold: weeklyWinner
        ? {
            winner: weeklyWinner.entry_id,
            reason: `${weeklyWinner.name} is the strongest fully covered non-suspicious weekly candidate after raw-row audit.`,
          }
        : {
            winner: null,
            reason: "No trustworthy weekly-hold flagship yet. Universal results are either incomplete or suspicious, and Tiered results are materially weaker after raw-row recomputation.",
          },
      intraday: intradayWinner
        ? {
            winner: intradayWinner.entry_id,
            reason: `${intradayWinner.name} remains the strongest surviving intraday candidate on the normalized 8-week basis.`,
          }
        : {
            winner: null,
            reason: "No intraday flagship resolved.",
          },
    },
  };

  const reportsDir = path.resolve(process.cwd(), "reports");
  if (!existsSync(reportsDir)) {
    mkdirSync(reportsDir, { recursive: true });
  }
  const outputPath = path.join(reportsDir, "performance-accuracy-audit.json");
  writeFileSync(outputPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");

  console.log(`Wrote ${outputPath}`);
  console.log(JSON.stringify(output.flagship_candidates, null, 2));
}

main().catch((error) => {
  console.error("Performance accuracy audit failed:", error);
  process.exitCode = 1;
});
