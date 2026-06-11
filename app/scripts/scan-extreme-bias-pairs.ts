/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: scan-extreme-bias-pairs.ts
 *
 * Description:
 * Scans the latest weekly snapshots and ranks pairs by
 * stable extreme bias vs choppy bias over a lookback window.
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

type PerformanceModel = "dealer" | "commercial" | "sentiment";
type ConfidenceTier = "HIGH" | "MEDIUM" | "NEUTRAL";

type CliConfig = {
  weeks: number;
  top: number;
  minActionableWeeks: number;
  minExtremeScore: number;
  minChoppyFlips: number;
  outPath: string;
};

type PairVoteRow = {
  dealer: Direction;
  commercial: Direction;
  sentiment: Direction;
};

type PairWeekSignal = {
  weekOpenUtc: string;
  dealer: Direction;
  commercial: Direction;
  sentiment: Direction;
  direction: Direction;
  tier: ConfidenceTier;
  votes: { long: number; short: number; neutral: number };
};

type PairAggregate = {
  key: string;
  assetClass: string;
  pair: string;
  totalWeeks: number;
  actionableWeeks: number;
  neutralWeeks: number;
  longWeeks: number;
  shortWeeks: number;
  highWeeks: number;
  mediumWeeks: number;
  flips: number;
  dominantDirection: Direction;
  directionConsistency: number;
  extremeScore: number;
  stableExtreme: boolean;
  choppy: boolean;
  gateTestable: boolean;
  weekSignals: PairWeekSignal[];
};

function parseArgs(): CliConfig {
  const byKey = new Map<string, string>();
  for (const raw of process.argv.slice(2)) {
    if (!raw.startsWith("--")) continue;
    const [key, ...rest] = raw.slice(2).split("=");
    byKey.set(key.trim(), rest.join("="));
  }

  const parseNumber = (name: string, fallback: number) => {
    const parsed = Number(byKey.get(name));
    return Number.isFinite(parsed) ? parsed : fallback;
  };

  const weeks = Math.max(2, Math.floor(parseNumber("weeks", 6)));
  const top = Math.max(5, Math.floor(parseNumber("top", 15)));
  const minActionableWeeks = Math.max(2, Math.floor(parseNumber("min-actionable-weeks", 4)));
  const minExtremeScore = Math.max(0, Math.min(1, parseNumber("min-extreme-score", 0.7)));
  const minChoppyFlips = Math.max(1, Math.floor(parseNumber("min-choppy-flips", 1)));
  const outPath = byKey.get("out")?.trim() || "app/reports/bias-gate/extreme-bias-scan-latest.json";

  return {
    weeks,
    top,
    minActionableWeeks,
    minExtremeScore,
    minChoppyFlips,
    outPath,
  };
}

function normalizeDirection(value: unknown): Direction {
  const raw = String(value ?? "").trim().toUpperCase();
  if (raw === "LONG" || raw === "BULLISH") return "LONG";
  if (raw === "SHORT" || raw === "BEARISH") return "SHORT";
  return "NEUTRAL";
}

function round(value: number, decimals = 4): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function isRequiredModel(value: string): value is PerformanceModel {
  return value === "dealer" || value === "commercial" || value === "sentiment";
}

function buildPairAggregates(
  config: CliConfig,
  weekSignalsByPair: Map<string, PairAggregate>,
): PairAggregate[] {
  const rows = Array.from(weekSignalsByPair.values());
  for (const row of rows) {
    const sortedSignals = [...row.weekSignals].sort((a, b) => a.weekOpenUtc.localeCompare(b.weekOpenUtc));
    row.weekSignals = sortedSignals;
    row.totalWeeks = sortedSignals.length;
    row.actionableWeeks = sortedSignals.filter((s) => s.direction !== "NEUTRAL").length;
    row.neutralWeeks = sortedSignals.length - row.actionableWeeks;
    row.longWeeks = sortedSignals.filter((s) => s.direction === "LONG").length;
    row.shortWeeks = sortedSignals.filter((s) => s.direction === "SHORT").length;
    row.highWeeks = sortedSignals.filter((s) => s.tier === "HIGH").length;
    row.mediumWeeks = sortedSignals.filter((s) => s.tier === "MEDIUM").length;

    let flips = 0;
    let prev: Direction | null = null;
    for (const signal of sortedSignals) {
      if (signal.direction === "NEUTRAL") continue;
      if (prev && prev !== signal.direction) flips += 1;
      prev = signal.direction;
    }
    row.flips = flips;

    row.dominantDirection =
      row.longWeeks > row.shortWeeks ? "LONG" : row.shortWeeks > row.longWeeks ? "SHORT" : "NEUTRAL";
    row.directionConsistency =
      row.actionableWeeks > 0 ? Math.max(row.longWeeks, row.shortWeeks) / row.actionableWeeks : 0;
    row.extremeScore =
      row.actionableWeeks > 0 ? (row.highWeeks * 2 + row.mediumWeeks) / (2 * row.actionableWeeks) : 0;
    row.stableExtreme =
      row.actionableWeeks >= config.minActionableWeeks &&
      row.flips === 0 &&
      row.directionConsistency === 1 &&
      row.extremeScore >= config.minExtremeScore;
    row.choppy =
      row.actionableWeeks >= config.minActionableWeeks &&
      row.flips >= config.minChoppyFlips &&
      row.directionConsistency < 1;
  }
  return rows;
}

function writeArtifacts(params: {
  config: CliConfig;
  output: Record<string, unknown>;
  stableCount: number;
  choppyCount: number;
}) {
  const { config, output, stableCount, choppyCount } = params;
  const stamp = DateTime.utc().toFormat("yyyy-LL-dd_HHmmss");
  const reportsDir = path.resolve(process.cwd(), "app", "reports", "bias-gate");
  mkdirSync(reportsDir, { recursive: true });

  const latestPath = path.join(reportsDir, "extreme-bias-scan-latest.json");
  const datedPath = path.join(reportsDir, `extreme-bias-scan-${stamp}.json`);
  const customPath = path.resolve(process.cwd(), config.outPath);

  writeFileSync(latestPath, JSON.stringify(output, null, 2), "utf8");
  writeFileSync(datedPath, JSON.stringify(output, null, 2), "utf8");
  writeFileSync(customPath, JSON.stringify(output, null, 2), "utf8");

  const runHistoryPath = path.join(reportsDir, "extreme-bias-scan-run-history.json");
  const entry = {
    generated_utc: String(output.generated_utc ?? new Date().toISOString()),
    latest_path: latestPath,
    dated_path: datedPath,
    custom_path: customPath,
    weeks: config.weeks,
    top: config.top,
    stable_count: stableCount,
    choppy_count: choppyCount,
  };

  let history: Array<Record<string, unknown>> = [];
  try {
    const existing = JSON.parse(readFileSync(runHistoryPath, "utf8")) as Array<Record<string, unknown>>;
    if (Array.isArray(existing)) history = existing;
  } catch {
    history = [];
  }
  history.push(entry);
  writeFileSync(runHistoryPath, JSON.stringify(history, null, 2), "utf8");

  console.log(`\nReport written (latest): ${latestPath}`);
  console.log(`Report written (dated): ${datedPath}`);
  console.log(`Report written (custom): ${customPath}`);
  console.log(`Run history updated: ${runHistoryPath}`);
}

async function main() {
  loadEnvConfig(process.cwd());
  const config = parseArgs();

  const weekOpens = await listPerformanceWeeks(config.weeks);
  if (!weekOpens.length) {
    throw new Error("No performance weeks available.");
  }

  const limitedWeeks = weekOpens.slice(0, config.weeks);
  const pairVotesByWeek = new Map<string, Map<string, PairVoteRow>>();
  const pairSignals = new Map<string, PairAggregate>();

  for (const weekOpenUtc of limitedWeeks) {
    const weekRows = await readPerformanceSnapshotsByWeek(weekOpenUtc);
    const pairMap = new Map<string, PairVoteRow>();
    pairVotesByWeek.set(weekOpenUtc, pairMap);

    for (const row of weekRows) {
      if (!isRequiredModel(row.model)) continue;
      const details = Array.isArray(row.pair_details) ? row.pair_details : [];
      for (const rawDetail of details) {
        const detail = asRecord(rawDetail);
        const pair = String(detail.pair ?? "").trim().toUpperCase();
        if (!pair) continue;
        const key = `${row.asset_class}|${pair}`;
        if (!pairMap.has(key)) {
          pairMap.set(key, {
            dealer: "NEUTRAL",
            commercial: "NEUTRAL",
            sentiment: "NEUTRAL",
          });
        }
        const target = pairMap.get(key);
        if (!target) continue;
        const direction = normalizeDirection(detail.direction);
        if (row.model === "dealer") target.dealer = direction;
        if (row.model === "commercial") target.commercial = direction;
        if (row.model === "sentiment") target.sentiment = direction;
      }
    }

    for (const [key, votes] of pairMap.entries()) {
      const [assetClass, pair] = key.split("|");
      const classified = classifyWeeklyBias(votes.dealer, votes.commercial, votes.sentiment);
      const gateTestable = assetClass === "crypto" && (pair === "BTCUSD" || pair === "ETHUSD");

      if (!pairSignals.has(key)) {
        pairSignals.set(key, {
          key,
          assetClass,
          pair,
          totalWeeks: 0,
          actionableWeeks: 0,
          neutralWeeks: 0,
          longWeeks: 0,
          shortWeeks: 0,
          highWeeks: 0,
          mediumWeeks: 0,
          flips: 0,
          dominantDirection: "NEUTRAL",
          directionConsistency: 0,
          extremeScore: 0,
          stableExtreme: false,
          choppy: false,
          gateTestable,
          weekSignals: [],
        });
      }

      const pairRow = pairSignals.get(key);
      if (!pairRow) continue;
      pairRow.weekSignals.push({
        weekOpenUtc,
        dealer: votes.dealer,
        commercial: votes.commercial,
        sentiment: votes.sentiment,
        direction: classified.direction,
        tier: classified.tier,
        votes: classified.votes,
      });
    }
  }

  const aggregates = buildPairAggregates(config, pairSignals);

  const stableExtreme = aggregates
    .filter((row) => row.stableExtreme)
    .sort((a, b) =>
      b.extremeScore - a.extremeScore ||
      b.highWeeks - a.highWeeks ||
      b.actionableWeeks - a.actionableWeeks ||
      a.pair.localeCompare(b.pair),
    );

  const choppy = aggregates
    .filter((row) => row.choppy)
    .sort((a, b) =>
      b.flips - a.flips ||
      b.actionableWeeks - a.actionableWeeks ||
      a.pair.localeCompare(b.pair),
    );

  const stableTop = stableExtreme.slice(0, config.top);
  const choppyTop = choppy.slice(0, config.top);

  console.log(`=== Extreme Bias Scan (last ${limitedWeeks.length} weeks) ===`);
  console.log(`Weeks: ${limitedWeeks.map((w) => w.slice(0, 10)).join(", ")}`);

  console.log("\nStable extreme pairs (test these first):");
  console.table(
    stableTop.map((row) => ({
      asset_class: row.assetClass,
      pair: row.pair,
      dominant: row.dominantDirection,
      actionable_weeks: row.actionableWeeks,
      high_weeks: row.highWeeks,
      medium_weeks: row.mediumWeeks,
      flips: row.flips,
      extreme_score: round(row.extremeScore, 4),
      gate_testable: row.gateTestable,
    })),
  );

  console.log("\nChoppy pairs (test after stable set):");
  console.table(
    choppyTop.map((row) => ({
      asset_class: row.assetClass,
      pair: row.pair,
      dominant: row.dominantDirection,
      actionable_weeks: row.actionableWeeks,
      high_weeks: row.highWeeks,
      medium_weeks: row.mediumWeeks,
      flips: row.flips,
      consistency: round(row.directionConsistency, 4),
      extreme_score: round(row.extremeScore, 4),
      gate_testable: row.gateTestable,
    })),
  );

  const output = {
    generated_utc: new Date().toISOString(),
    config,
    weeks: limitedWeeks,
    counts: {
      scanned_pairs: aggregates.length,
      stable_extreme_pairs: stableExtreme.length,
      choppy_pairs: choppy.length,
    },
    stable_extreme_top: stableTop,
    choppy_top: choppyTop,
    all_pairs: aggregates,
  };

  writeArtifacts({
    config,
    output,
    stableCount: stableExtreme.length,
    choppyCount: choppy.length,
  });
}

main()
  .catch((error) => {
    console.error("scan-extreme-bias-pairs failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await getPool().end();
    } catch {
      // ignore
    }
  });
