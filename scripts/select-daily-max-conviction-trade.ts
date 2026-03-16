/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: select-daily-max-conviction-trade.ts
 *
 * Daily 7pm helper:
 * - reads current gated setups payload (with dynamic overlays)
 * - ranks PASS setups by conviction score
 * - validates MenthorQ ingestion coverage before recommending max-size
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { loadEnvConfig } from "@next/env";
import { DateTime } from "luxon";
import { GET } from "../src/app/api/performance/gated-setups/route";

type GateDecision = "PASS" | "SKIP" | "NO_DATA";
type SignalDirection = "LONG" | "SHORT" | "NEUTRAL";
type SignalTier = "HIGH" | "MEDIUM" | "NEUTRAL";

type GatedSetupSignal = {
  assetClass: string;
  pair: string;
  direction: SignalDirection;
  tier: SignalTier;
  gateDecision: GateDecision;
  gateReasons: string[];
  actionable8w: number;
  flips8w: number;
  consistency8w: number;
  gateDecisionSource?: string;
  gateAsOfUtc?: string | null;
};

type GatedSetupsPayload = {
  sourcePath: string;
  generatedUtc: string | null;
  currentWeekOpenUtc: string | null;
  signals: GatedSetupSignal[];
};

type PairSummary = {
  winRatePct: number;
  cumulativePnlPct: number;
  maxDrawdownPct: number;
  pricedTrades: number;
};

type RankedSignal = {
  signal: GatedSetupSignal;
  score: number;
  pairSummary: PairSummary | null;
  notes: string[];
};

type MenthorqDailyCoverage = {
  path: string;
  exists: boolean;
  rowsTotal: number;
  rowsToday: number;
  uniqueSymbolsToday: string[];
  latestCaptureUtc: string | null;
};

function normalizePair(value: unknown): string {
  return String(value ?? "").trim().toUpperCase();
}

function toFinite(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === "," && !inQuotes) {
      out.push(current.trim());
      current = "";
      continue;
    }
    current += ch;
  }
  out.push(current.trim());
  return out;
}

function parseCsvObjects(filePath: string): Array<Record<string, string>> {
  if (!existsSync(filePath)) return [];
  const raw = readFileSync(filePath, "utf8");
  const lines = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length < 2) return [];
  const headers = parseCsvLine(lines[0]).map((header) => header.trim().toLowerCase());
  const rows: Array<Record<string, string>> = [];
  for (const line of lines.slice(1)) {
    const cols = parseCsvLine(line);
    const row: Record<string, string> = {};
    headers.forEach((header, index) => {
      row[header] = cols[index] ?? "";
    });
    rows.push(row);
  }
  return rows;
}

function readPairSummary(pair: string): PairSummary | null {
  const lower = normalizePair(pair).toLowerCase();
  const candidates = [
    path.resolve(process.cwd(), "reports", "bias-gate", `${lower}-bias-backtest-latest.json`),
    path.resolve(process.cwd(), "reports", "bias-gate", `pair-backtest-${lower}-latest.json`),
  ];
  for (const candidate of candidates) {
    if (!existsSync(candidate)) continue;
    try {
      const parsed = JSON.parse(readFileSync(candidate, "utf8")) as {
        summary?: Record<string, unknown>;
      };
      const summary = parsed.summary ?? {};
      return {
        winRatePct: toFinite(summary.winRatePct),
        cumulativePnlPct: toFinite(summary.cumulativePnlPct),
        maxDrawdownPct: toFinite(summary.maxDrawdownPct),
        pricedTrades: Math.max(0, Math.trunc(toFinite(summary.pricedTrades))),
      };
    } catch {
      return null;
    }
  }
  return null;
}

function scoreSignal(signal: GatedSetupSignal, pairSummary: PairSummary | null): RankedSignal {
  const notes: string[] = [];
  const tierWeight = signal.tier === "HIGH" ? 100 : signal.tier === "MEDIUM" ? 60 : 20;
  let score = tierWeight;
  score += signal.consistency8w * 30;
  score += Math.min(signal.actionable8w, 8) * 2;
  score -= Math.min(signal.flips8w, 8) * 3;

  if (pairSummary) {
    score += pairSummary.winRatePct * 0.2;
    score += pairSummary.cumulativePnlPct * 4;
    score -= pairSummary.maxDrawdownPct * 2;
    score += Math.min(pairSummary.pricedTrades, 12) * 0.5;
    notes.push(
      `backtest8w wr=${pairSummary.winRatePct.toFixed(2)} cum=${pairSummary.cumulativePnlPct.toFixed(4)} dd=${pairSummary.maxDrawdownPct.toFixed(4)} n=${pairSummary.pricedTrades}`,
    );
    if (pairSummary.pricedTrades < 4) {
      score -= 20;
      notes.push("small_sample_penalty");
    }
  } else {
    score -= 12;
    notes.push("no_pair_backtest_penalty");
  }

  const source = String(signal.gateDecisionSource ?? "WEEKLY_BOARD");
  if (signal.assetClass !== "crypto" && !source.includes("MENTHORQ")) {
    score -= 8;
    notes.push("no_live_gamma_overlay_penalty");
  }

  if (signal.assetClass === "crypto" && source !== "CRYPTO_LIQUIDATION_LIVE") {
    score -= 12;
    notes.push("no_live_liquidation_overlay_penalty");
  }

  return {
    signal,
    score,
    pairSummary,
    notes,
  };
}

function readMenthorqCoverage(nowUtc: DateTime): MenthorqDailyCoverage {
  const csvPath = process.env.PERFORMANCE_MENTHORQ_GAMMA_CSV?.trim()
    ? path.resolve(process.cwd(), process.env.PERFORMANCE_MENTHORQ_GAMMA_CSV)
    : path.resolve(process.cwd(), "reports", "bias-gate", "menthorq-gamma-daily.csv");
  const rows = parseCsvObjects(csvPath);
  if (rows.length === 0) {
    return {
      path: csvPath,
      exists: existsSync(csvPath),
      rowsTotal: 0,
      rowsToday: 0,
      uniqueSymbolsToday: [],
      latestCaptureUtc: null,
    };
  }

  const todayIso = nowUtc.toFormat("yyyy-LL-dd");
  const todayRows = rows.filter((row) => String(row.date ?? "").trim() === todayIso);
  const uniqueSymbolsToday = Array.from(
    new Set(
      todayRows
        .map((row) => normalizePair(row.page_symbol || row.symbol_input || row.symbol || ""))
        .filter(Boolean),
    ),
  ).sort();

  const latestCaptureUtc = rows
    .map((row) => String(row.captured_at_utc ?? "").trim())
    .filter((value) => value.length > 0)
    .sort()
    .slice(-1)[0] ?? null;

  return {
    path: csvPath,
    exists: true,
    rowsTotal: rows.length,
    rowsToday: todayRows.length,
    uniqueSymbolsToday,
    latestCaptureUtc,
  };
}

async function loadPayload(): Promise<GatedSetupsPayload> {
  const response = await GET();
  if (response.status !== 200) {
    throw new Error(`Gated setups API returned ${response.status}`);
  }
  const body = (await response.json()) as GatedSetupsPayload & { error?: string };
  if (body.error) {
    throw new Error(body.error);
  }
  if (!Array.isArray(body.signals)) {
    throw new Error("Invalid gated setups payload");
  }
  return body;
}

async function main() {
  loadEnvConfig(process.cwd());
  const nowUtc = DateTime.utc();
  const payload = await loadPayload();
  const coverage = readMenthorqCoverage(nowUtc);

  const candidates = payload.signals
    .filter((signal) => signal.gateDecision === "PASS")
    .filter((signal) => signal.direction === "LONG" || signal.direction === "SHORT")
    .map((signal) => {
      const pairSummary = readPairSummary(signal.pair);
      return scoreSignal(signal, pairSummary);
    })
    .sort((a, b) => b.score - a.score);

  const top = candidates[0] ?? null;
  const fxCandidates = candidates.filter((entry) => entry.signal.assetClass === "fx");
  const missingFxGamma = fxCandidates.filter(
    (entry) => !String(entry.signal.gateDecisionSource ?? "").includes("MENTHORQ"),
  );
  const coverageOk = coverage.rowsToday >= 4 && coverage.uniqueSymbolsToday.length >= 4;

  console.log(`\n=== Daily Max Conviction Selector (${nowUtc.toISO()}) ===`);
  console.log(`Board source: ${payload.sourcePath}`);
  console.log(`Current week: ${payload.currentWeekOpenUtc ?? "n/a"}`);
  console.log(
    `MenthorQ coverage today: rows=${coverage.rowsToday}, symbols=${coverage.uniqueSymbolsToday.join(",") || "none"}, latest=${coverage.latestCaptureUtc ?? "n/a"}`,
  );

  if (candidates.length === 0) {
    console.log("No PASS candidates available.");
    process.exit(0);
  }

  console.log("\nRanked PASS candidates:");
  console.table(
    candidates.map((entry) => ({
      pair: entry.signal.pair,
      asset: entry.signal.assetClass,
      direction: entry.signal.direction,
      tier: entry.signal.tier,
      source: entry.signal.gateDecisionSource ?? "WEEKLY_BOARD",
      score: Number(entry.score.toFixed(2)),
      consistency8w: Number((entry.signal.consistency8w * 100).toFixed(0)),
      actionable8w: entry.signal.actionable8w,
      flips8w: entry.signal.flips8w,
      wr8w: entry.pairSummary ? Number(entry.pairSummary.winRatePct.toFixed(2)) : null,
      cum8w: entry.pairSummary ? Number(entry.pairSummary.cumulativePnlPct.toFixed(4)) : null,
      dd8w: entry.pairSummary ? Number(entry.pairSummary.maxDrawdownPct.toFixed(4)) : null,
    })),
  );

  console.log("\nTop pick:");
  console.log(
    `${top.signal.pair} ${top.signal.direction} | score=${top.score.toFixed(2)} | tier=${top.signal.tier} | source=${top.signal.gateDecisionSource ?? "WEEKLY_BOARD"}`,
  );
  console.log(`Reasons: ${top.signal.gateReasons.join(", ") || "n/a"}`);
  if (top.notes.length > 0) {
    console.log(`Scoring notes: ${top.notes.join(" | ")}`);
  }

  if (!coverageOk) {
    console.log(
      "\nDATA WARNING: MenthorQ daily pull is incomplete for a 7pm max-size decision. Refresh capture before sizing up.",
    );
  }
  if (missingFxGamma.length > 0) {
    console.log(
      `FX WARNING: ${missingFxGamma.length} FX PASS candidates lack MenthorQ overlay (source still weekly board).`,
    );
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});

