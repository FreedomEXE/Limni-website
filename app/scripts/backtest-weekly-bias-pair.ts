/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: backtest-weekly-bias-pair.ts
 *
 * Description:
 * Generic weekly bias backtest for a single pair using
 * Dealer + Commercial + Sentiment 3-vote classification.
 *
 * Data source:
 * performance_snapshots pair_details (already normalized weekly returns).
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { DateTime } from "luxon";
import { loadEnvConfig } from "@next/env";

import { getPool } from "../src/lib/db";
import {
  listPerformanceWeeks,
  readPerformanceSnapshotsByWeek,
} from "../src/lib/performanceSnapshots";
import { classifyWeeklyBias, type Direction } from "../src/lib/bitgetBotSignals";

type ConfidenceTier = "HIGH" | "MEDIUM" | "NEUTRAL";
type ModelName = "dealer" | "commercial" | "sentiment";

type PairDetail = {
  pair: string;
  direction: Direction;
  percent: number | null;
};

type WeekRow = {
  weekOpenUtc: string;
  assetClass: string | null;
  dealerVote: Direction;
  commercialVote: Direction;
  sentimentVote: Direction;
  combinedDirection: Direction;
  tier: ConfidenceTier;
  baseReturnPct: number | null;
  tradePnlPct: number | null;
  sourceModelForBaseReturn: ModelName | null;
  gateDecision: "NO_DATA";
};

type Summary = {
  totalWeeks: number;
  actionableSignals: number;
  pricedTrades: number;
  wins: number;
  losses: number;
  flats: number;
  winRatePct: number;
  avgPnlPct: number;
  cumulativePnlPct: number;
  maxDrawdownPct: number;
};

type CliConfig = {
  pair: string;
  assetClass: string;
  weeks: number;
  outPath: string;
};

function parseArgs(): CliConfig {
  const byKey = new Map<string, string>();
  for (const raw of process.argv.slice(2)) {
    if (!raw.startsWith("--")) continue;
    const [key, ...rest] = raw.slice(2).split("=");
    byKey.set(key.trim(), rest.join("="));
  }

  const pair = String(byKey.get("pair") ?? "SPXUSD").trim().toUpperCase();
  const assetClass = String(byKey.get("asset-class") ?? "").trim().toLowerCase();
  const weeksRaw = Number(byKey.get("weeks"));
  const weeks = Number.isFinite(weeksRaw) ? Math.max(2, Math.floor(weeksRaw)) : 6;
  const outPath =
    byKey.get("out")?.trim() || `app/reports/bias-gate/pair-backtest-${pair.toLowerCase()}-latest.json`;

  return {
    pair,
    assetClass,
    weeks,
    outPath,
  };
}

function normalizeDirection(value: unknown): Direction {
  const raw = String(value ?? "").trim().toUpperCase();
  if (raw === "LONG" || raw === "BULLISH") return "LONG";
  if (raw === "SHORT" || raw === "BEARISH") return "SHORT";
  return "NEUTRAL";
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function round(value: number, decimals = 4): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function toNumberOrNull(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function extractPairDetail(details: unknown, pair: string): PairDetail | null {
  if (!Array.isArray(details)) return null;
  const match = details.find((raw) => String(asRecord(raw).pair ?? "").toUpperCase() === pair);
  if (!match) return null;
  const row = asRecord(match);
  return {
    pair,
    direction: normalizeDirection(row.direction),
    percent: toNumberOrNull(row.percent),
  };
}

function inferBaseReturnFromDetail(detail: PairDetail | null): number | null {
  if (!detail || detail.percent === null) return null;
  if (detail.direction === "LONG") return detail.percent;
  if (detail.direction === "SHORT") return -detail.percent;
  return null;
}

function tradeReturnFromBase(baseReturnPct: number | null, direction: Direction): number | null {
  if (baseReturnPct === null) return null;
  if (direction === "LONG") return baseReturnPct;
  if (direction === "SHORT") return -baseReturnPct;
  return null;
}

function computeMaxDrawdown(returns: number[]): number {
  let equity = 0;
  let peak = 0;
  let maxDd = 0;
  for (const ret of returns) {
    equity += ret;
    if (equity > peak) peak = equity;
    const dd = peak - equity;
    if (dd > maxDd) maxDd = dd;
  }
  return maxDd;
}

function summarize(rows: WeekRow[]): Summary {
  const actionable = rows.filter((row) => row.combinedDirection === "LONG" || row.combinedDirection === "SHORT");
  const priced = actionable.filter((row) => row.tradePnlPct !== null) as Array<WeekRow & { tradePnlPct: number }>;
  const wins = priced.filter((row) => row.tradePnlPct > 0).length;
  const losses = priced.filter((row) => row.tradePnlPct < 0).length;
  const flats = priced.filter((row) => row.tradePnlPct === 0).length;
  const avg = priced.length ? priced.reduce((sum, row) => sum + row.tradePnlPct, 0) / priced.length : 0;
  const cumulative = priced.reduce((sum, row) => sum + row.tradePnlPct, 0);
  const maxDd = computeMaxDrawdown(priced.map((row) => row.tradePnlPct));

  return {
    totalWeeks: rows.length,
    actionableSignals: actionable.length,
    pricedTrades: priced.length,
    wins,
    losses,
    flats,
    winRatePct: priced.length ? (wins / priced.length) * 100 : 0,
    avgPnlPct: avg,
    cumulativePnlPct: cumulative,
    maxDrawdownPct: maxDd,
  };
}

function writeArtifacts(params: {
  config: CliConfig;
  output: Record<string, unknown>;
}) {
  const { config, output } = params;
  const stamp = DateTime.utc().toFormat("yyyy-LL-dd_HHmmss");
  const reportsDir = path.resolve(process.cwd(), "app", "reports", "bias-gate");
  mkdirSync(reportsDir, { recursive: true });

  const pairLower = config.pair.toLowerCase();
  const latestPath = path.join(reportsDir, `${pairLower}-bias-backtest-latest.json`);
  const datedPath = path.join(reportsDir, `${pairLower}-bias-backtest-${stamp}.json`);
  const customPath = path.resolve(process.cwd(), config.outPath);

  writeFileSync(latestPath, JSON.stringify(output, null, 2), "utf8");
  writeFileSync(datedPath, JSON.stringify(output, null, 2), "utf8");
  writeFileSync(customPath, JSON.stringify(output, null, 2), "utf8");

  const historyPath = path.join(reportsDir, "pair-bias-backtest-run-history.json");
  const entry = {
    generated_utc: String(output.generated_utc ?? new Date().toISOString()),
    pair: config.pair,
    asset_class: config.assetClass || "auto",
    latest_path: latestPath,
    dated_path: datedPath,
    custom_path: customPath,
    weeks: config.weeks,
    priced_trades: Number((output as { summary?: { pricedTrades?: number } }).summary?.pricedTrades ?? 0),
    win_rate_pct: Number((output as { summary?: { winRatePct?: number } }).summary?.winRatePct ?? 0),
    avg_pnl_pct: Number((output as { summary?: { avgPnlPct?: number } }).summary?.avgPnlPct ?? 0),
    max_drawdown_pct: Number((output as { summary?: { maxDrawdownPct?: number } }).summary?.maxDrawdownPct ?? 0),
  };

  let history: Array<Record<string, unknown>> = [];
  try {
    const existing = JSON.parse(readFileSync(historyPath, "utf8")) as Array<Record<string, unknown>>;
    if (Array.isArray(existing)) history = existing;
  } catch {
    history = [];
  }
  history.push(entry);
  writeFileSync(historyPath, JSON.stringify(history, null, 2), "utf8");

  console.log(`\nReport written (latest): ${latestPath}`);
  console.log(`Report written (dated): ${datedPath}`);
  console.log(`Report written (custom): ${customPath}`);
  console.log(`Run history updated: ${historyPath}`);
}

async function main() {
  loadEnvConfig(process.cwd());
  const config = parseArgs();

  const weeks = await listPerformanceWeeks(config.weeks);
  if (!weeks.length) {
    throw new Error("No performance snapshot weeks available.");
  }
  const selectedWeeks = weeks.slice(0, config.weeks);

  const rows: WeekRow[] = [];
  for (const weekOpenUtc of selectedWeeks) {
    const snapshots = await readPerformanceSnapshotsByWeek(weekOpenUtc);
    const filtered = config.assetClass
      ? snapshots.filter((row) => row.asset_class === config.assetClass)
      : snapshots;

    const byModel = new Map<ModelName, PairDetail | null>();
    let resolvedAssetClass: string | null = null;
    for (const row of filtered) {
      if (row.model !== "dealer" && row.model !== "commercial" && row.model !== "sentiment") continue;
      const detail = extractPairDetail(row.pair_details, config.pair);
      if (!detail) continue;
      if (!resolvedAssetClass) resolvedAssetClass = row.asset_class;
      byModel.set(row.model, detail);
    }

    const dealerVote = byModel.get("dealer")?.direction ?? "NEUTRAL";
    const commercialVote = byModel.get("commercial")?.direction ?? "NEUTRAL";
    const sentimentVote = byModel.get("sentiment")?.direction ?? "NEUTRAL";
    const classified = classifyWeeklyBias(dealerVote, commercialVote, sentimentVote);

    let sourceModel: ModelName | null = null;
    let baseReturnPct: number | null = null;
    for (const candidate of ["dealer", "commercial", "sentiment"] as ModelName[]) {
      const inferred = inferBaseReturnFromDetail(byModel.get(candidate) ?? null);
      if (inferred === null) continue;
      sourceModel = candidate;
      baseReturnPct = inferred;
      break;
    }

    const tradePnlPct = tradeReturnFromBase(baseReturnPct, classified.direction);
    rows.push({
      weekOpenUtc,
      assetClass: resolvedAssetClass,
      dealerVote,
      commercialVote,
      sentimentVote,
      combinedDirection: classified.direction,
      tier: classified.tier,
      baseReturnPct: baseReturnPct === null ? null : round(baseReturnPct, 4),
      tradePnlPct: tradePnlPct === null ? null : round(tradePnlPct, 4),
      sourceModelForBaseReturn: sourceModel,
      gateDecision: "NO_DATA",
    });
  }

  rows.sort((a, b) => a.weekOpenUtc.localeCompare(b.weekOpenUtc));
  const summary = summarize(rows);

  console.log(`=== Weekly Bias Backtest: ${config.pair} (${config.assetClass || "auto"}) ===`);
  console.log(`Weeks: ${rows.map((row) => row.weekOpenUtc.slice(0, 10)).join(", ")}`);
  console.table(
    rows.map((row) => ({
      week_start: row.weekOpenUtc.slice(0, 10),
      asset_class: row.assetClass ?? "N/A",
      dealer: row.dealerVote,
      commercial: row.commercialVote,
      sentiment: row.sentimentVote,
      bias: `${row.combinedDirection}/${row.tier}`,
      base_return_pct: row.baseReturnPct,
      trade_pnl_pct: row.tradePnlPct,
      base_source: row.sourceModelForBaseReturn ?? "N/A",
      gate: row.gateDecision,
    })),
  );
  console.table([
    {
      pair: config.pair,
      total_weeks: summary.totalWeeks,
      actionable_signals: summary.actionableSignals,
      priced_trades: summary.pricedTrades,
      wins: summary.wins,
      losses: summary.losses,
      flats: summary.flats,
      win_rate_pct: round(summary.winRatePct, 2),
      avg_pnl_pct: round(summary.avgPnlPct, 4),
      cumulative_pnl_pct: round(summary.cumulativePnlPct, 4),
      max_drawdown_pct: round(summary.maxDrawdownPct, 4),
    },
  ]);

  const output = {
    generated_utc: new Date().toISOString(),
    pair: config.pair,
    asset_class_filter: config.assetClass || null,
    weeks: selectedWeeks,
    rows,
    summary: {
      ...summary,
      winRatePct: round(summary.winRatePct, 4),
      avgPnlPct: round(summary.avgPnlPct, 6),
      cumulativePnlPct: round(summary.cumulativePnlPct, 6),
      maxDrawdownPct: round(summary.maxDrawdownPct, 6),
    },
  };

  writeArtifacts({ config, output });
}

main()
  .catch((error) => {
    console.error("backtest-weekly-bias-pair failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await getPool().end();
    } catch {
      // ignore
    }
  });

