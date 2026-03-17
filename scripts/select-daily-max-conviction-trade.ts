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
import { readLatestMenthorqSnapshots } from "../src/lib/menthorqOverlay";

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
  source: "DB" | "CSV" | "NONE";
  path: string;
  exists: boolean;
  rowsTotal: number;
  rowsToday: number;
  uniqueSymbolsToday: string[];
  latestCaptureUtc: string | null;
};

type TradingProfile = {
  id: string;
  label: string;
  maxLeverageByAsset: Record<string, number>;
  isTradable: (signal: GatedSetupSignal) => boolean;
};

function normalizePair(value: unknown): string {
  return String(value ?? "").trim().toUpperCase();
}

const GAMMA_SYMBOL_PREFIXES = [
  "6E",
  "6B",
  "6J",
  "6A",
  "6S",
  "6C",
  "6N",
  "DX",
  "ES",
  "NQ",
  "GC",
  "SI",
  "CL",
] as const;

function normalizeGammaSymbol(value: unknown): string {
  const raw = normalizePair(value).replace(/[^A-Z0-9]/g, "");
  if (!raw) return "";
  const prefix = GAMMA_SYMBOL_PREFIXES.find((candidate) => raw.startsWith(candidate));
  return prefix ?? raw;
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

async function readMenthorqCoverage(nowUtc: DateTime): Promise<MenthorqDailyCoverage> {
  const todayIso = nowUtc.toFormat("yyyy-LL-dd");
  try {
    const latestDb = await readLatestMenthorqSnapshots();
    if (latestDb && latestDb.snapshotDateUtc === todayIso && latestDb.rows.length > 0) {
      const uniqueSymbolsToday = Array.from(
        new Set(
          latestDb.rows
            .map((row) => normalizeGammaSymbol(row.symbol))
            .filter(Boolean),
        ),
      ).sort();
      const latestCaptureUtc = latestDb.rows
        .map((row) => String(row.capturedAtUtc ?? "").trim())
        .filter((value) => value.length > 0)
        .sort()
        .slice(-1)[0] ?? null;
      return {
        source: "DB",
        path: "db:menthorq_overlay_snapshots",
        exists: true,
        rowsTotal: latestDb.rows.length,
        rowsToday: latestDb.rows.length,
        uniqueSymbolsToday,
        latestCaptureUtc,
      };
    }
  } catch {
    // Fall through to CSV fallback
  }

  const csvPath = process.env.PERFORMANCE_MENTHORQ_GAMMA_CSV?.trim()
    ? path.resolve(process.cwd(), process.env.PERFORMANCE_MENTHORQ_GAMMA_CSV)
    : path.resolve(process.cwd(), "reports", "bias-gate", "menthorq-gamma-daily.csv");
  const rows = parseCsvObjects(csvPath);
  if (rows.length === 0) {
    return {
      source: "NONE",
      path: csvPath,
      exists: existsSync(csvPath),
      rowsTotal: 0,
      rowsToday: 0,
      uniqueSymbolsToday: [],
      latestCaptureUtc: null,
    };
  }

  const todayRows = rows.filter((row) => String(row.date ?? "").trim() === todayIso);
  const uniqueSymbolsToday = Array.from(
    new Set(
      todayRows
        .map((row) => normalizeGammaSymbol(row.page_symbol || row.symbol_input || row.symbol || ""))
        .filter(Boolean),
    ),
  ).sort();

  const latestCaptureUtc = rows
    .map((row) => String(row.captured_at_utc ?? "").trim())
    .filter((value) => value.length > 0)
    .sort()
    .slice(-1)[0] ?? null;

  return {
    source: "CSV",
    path: csvPath,
    exists: true,
    rowsTotal: rows.length,
    rowsToday: todayRows.length,
    uniqueSymbolsToday,
    latestCaptureUtc,
  };
}

function readMenthorqPairMap(): Map<string, { base: string | null; quote: string | null; enabled: boolean }> {
  const csvPath = process.env.PERFORMANCE_MENTHORQ_PAIR_MAP_CSV?.trim()
    ? path.resolve(process.cwd(), process.env.PERFORMANCE_MENTHORQ_PAIR_MAP_CSV)
    : path.resolve(process.cwd(), "reports", "bias-gate", "menthorq-gamma-symbol-map-template.csv");
  const rows = parseCsvObjects(csvPath);
  const out = new Map<string, { base: string | null; quote: string | null; enabled: boolean }>();
  for (const row of rows) {
    const pair = normalizePair(row.pair || "");
    if (!pair) continue;
    const base = normalizeGammaSymbol(row.base_gamma_symbol || row.base_symbol || row.base || "") || null;
    const quote = normalizeGammaSymbol(row.quote_gamma_symbol || row.quote_symbol || row.quote || "") || null;
    const enabledRaw = String(row.enabled ?? "1").trim().toLowerCase();
    const enabled = !(enabledRaw === "0" || enabledRaw === "false" || enabledRaw === "no" || enabledRaw === "off");
    out.set(pair, { base, quote, enabled });
  }
  return out;
}

function resolveProfile(): TradingProfile {
  const profileId = String(process.env.DAILY_SELECTOR_PROFILE ?? "bitget_mt5")
    .trim()
    .toLowerCase();

  if (profileId !== "bitget_mt5") {
    return {
      id: "default",
      label: "Default (all assets)",
      maxLeverageByAsset: { fx: 50, commodities: 20, crypto: 20, indices: 20 },
      isTradable: (signal) =>
        signal.direction !== "NEUTRAL" &&
        ["fx", "commodities", "crypto", "indices"].includes(signal.assetClass),
    };
  }

  const allowedCommodityPairs = new Set(["XAUUSD", "XAGUSD"]);
  const allowedCryptoPairs = new Set(["BTCUSD", "ETHUSD"]);
  return {
    id: "bitget_mt5",
    label: "Bitget MT5 (FX + Metals + BTC/ETH, no indices)",
    maxLeverageByAsset: { fx: 500, commodities: 100, crypto: 75 },
    isTradable: (signal) => {
      if (signal.direction !== "LONG" && signal.direction !== "SHORT") return false;
      if (signal.assetClass === "fx") return true;
      if (signal.assetClass === "commodities") return allowedCommodityPairs.has(normalizePair(signal.pair));
      if (signal.assetClass === "crypto") return allowedCryptoPairs.has(normalizePair(signal.pair));
      return false;
    },
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
  const profile = resolveProfile();
  const strictOverlay =
    String(process.env.DAILY_SELECTOR_STRICT_OVERLAY ?? "true").trim().toLowerCase() !== "false";
  const payload = await loadPayload();
  const coverage = await readMenthorqCoverage(nowUtc);
  const menthorqPairMap = readMenthorqPairMap();
  const symbolsToday = new Set(coverage.uniqueSymbolsToday.map((symbol) => normalizeGammaSymbol(symbol)));

  const tradableSignals = payload.signals.filter((signal) => profile.isTradable(signal));
  const excludedSignals = payload.signals.filter((signal) => !profile.isTradable(signal));

  let candidates = tradableSignals
    .filter((signal) => signal.gateDecision === "PASS")
    .filter((signal) => signal.direction === "LONG" || signal.direction === "SHORT")
    .map((signal) => {
      const pairSummary = readPairSummary(signal.pair);
      return scoreSignal(signal, pairSummary);
    })
    .sort((a, b) => b.score - a.score);

  const droppedByStrictOverlay: Array<{ pair: string; reason: string }> = [];
  if (strictOverlay) {
    candidates = candidates.filter((entry) => {
      const source = String(entry.signal.gateDecisionSource ?? "");
      if (entry.signal.assetClass === "crypto") {
        const ok = source === "CRYPTO_LIQUIDATION_LIVE";
        if (!ok) {
          droppedByStrictOverlay.push({
            pair: entry.signal.pair,
            reason: "requires_live_liquidation_overlay",
          });
        }
        return ok;
      }

      const map = menthorqPairMap.get(normalizePair(entry.signal.pair));
      if (!map || !map.enabled) {
        droppedByStrictOverlay.push({
          pair: entry.signal.pair,
          reason: "menthorq_pair_not_mapped_or_disabled",
        });
        return false;
      }

      const required = [map.base, map.quote].filter((value): value is string => Boolean(value));
      const missing = required.filter((symbol) => !symbolsToday.has(symbol));
      if (missing.length > 0) {
        droppedByStrictOverlay.push({
          pair: entry.signal.pair,
          reason: `missing_menthorq_symbols:${missing.join("+")}`,
        });
        return false;
      }

      const ok = source.includes("MENTHORQ");
      if (!ok) {
        droppedByStrictOverlay.push({
          pair: entry.signal.pair,
          reason: "requires_menthorq_overlay_source",
        });
      }
      return ok;
    });
  }

  const top = candidates[0] ?? null;

  console.log(`\n=== Daily Max Conviction Selector (${nowUtc.toISO()}) ===`);
  console.log(`Profile: ${profile.label} (${profile.id})`);
  console.log(`Strict overlay mode: ${strictOverlay ? "ON" : "OFF"}`);
  console.log(`Board source: ${payload.sourcePath}`);
  console.log(`Current week: ${payload.currentWeekOpenUtc ?? "n/a"}`);
  console.log(
    `MenthorQ coverage (${coverage.source}) today: rows=${coverage.rowsToday}, symbols=${coverage.uniqueSymbolsToday.join(",") || "none"}, latest=${coverage.latestCaptureUtc ?? "n/a"}`,
  );
  console.log(`Tradable universe this run: ${tradableSignals.length}/${payload.signals.length} setups`);
  if (excludedSignals.length > 0) {
    console.log(
      `Excluded by profile: ${excludedSignals.map((signal) => `${signal.pair}:${signal.assetClass}`).join(", ")}`,
    );
  }

  if (candidates.length === 0) {
    console.log("No tradable PASS candidates met strict conditions.");
    if (droppedByStrictOverlay.length > 0) {
      console.table(droppedByStrictOverlay);
    }
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
      maxLev: profile.maxLeverageByAsset[entry.signal.assetClass] ?? null,
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
    `${top.signal.pair} ${top.signal.direction} | score=${top.score.toFixed(2)} | tier=${top.signal.tier} | source=${top.signal.gateDecisionSource ?? "WEEKLY_BOARD"} | maxLev=${profile.maxLeverageByAsset[top.signal.assetClass] ?? "n/a"}x`,
  );
  console.log(`Reasons: ${top.signal.gateReasons.join(", ") || "n/a"}`);
  if (top.notes.length > 0) {
    console.log(`Scoring notes: ${top.notes.join(" | ")}`);
  }
  if (droppedByStrictOverlay.length > 0) {
    console.log("\nDropped by strict overlay checks:");
    console.table(droppedByStrictOverlay);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
