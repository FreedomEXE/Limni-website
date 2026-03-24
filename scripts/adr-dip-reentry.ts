/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: adr-dip-reentry.ts
 *
 * Description:
 * Test 3 in the ADR dip-entry research program.
 *
 * Uses the same Tiered V3 directional signal universe as Test 2, but swaps the
 * single-fill daily-bar execution model for an H1 re-entry loop. After a TP is
 * hit, the pair can re-enter again later in the same week if price revisits the
 * original 1x ADR dip-entry level.
 *
 * Variants:
 *   A. TP 0.25 ADR + unlimited re-entry
 *   B. TP 0.50 ADR + unlimited re-entry
 *   C. TP 0.25 ADR + unlimited re-entry + session-gated fills
 *   D. TP 0.50 ADR + unlimited re-entry + session-gated fills
 *
 * Usage: .\node_modules\.bin\tsx.cmd scripts/adr-dip-reentry.ts
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

// Load .env.local for DATABASE_URL and OANDA credentials
const envPath = path.resolve(process.cwd(), ".env.local");
try {
  const envContent = readFileSync(envPath, "utf8");
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx < 0) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let value = trimmed.slice(eqIdx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
} catch {}

import { DateTime } from "luxon";
import { query } from "@/lib/db";
import { getCanonicalWeekWindow } from "@/lib/canonicalPriceWindows";
import { fetchOandaCandleSeries, type OandaHourlyCandle } from "@/lib/oandaPrices";
import { computeTieredWeekForSystem } from "@/lib/performance/tiered";
import {
  buildCotGateContext,
  buildGateMap,
  evaluatePairWithGate,
  type GateDecision,
} from "@/lib/performance/gateEvaluation";
import { getCanonicalWeekOpenUtc } from "@/lib/weekAnchor";

const LOOKBACK_WEEKS = 9;
const ADR_LOOKBACK_DAYS = 10;
const ADR_MIN_REQUIRED_DAYS = 5;
const ADR_MULTIPLIER = 1.0;
const FETCH_CONCURRENCY = 6;
const REPORT_PATH = path.resolve(process.cwd(), "reports", "adr-dip-reentry.md");

const MODEL_TO_TIER: Record<string, string | null> = {
  antikythera: null,
  antikythera_v2: null,
  antikythera_v3: "HIGH",
  blended: null,
  dealer: "MEDIUM",
  commercial: "LOW",
  sentiment: null,
};

const TEST2_BASELINES = {
  tp025SingleFill: { trades: 79, totalReturn: 24.12, winRate: 94.94 },
  holdSingleFill: { trades: 79, totalReturn: 95.81, winRate: 73.42 },
} as const;

const REENTRY_VARIANTS = [
  { key: "variant_a", label: "A: TP 0.25 + Re-entry", shortLabel: "A", tpMultiplier: 0.25, sessionGated: false },
  { key: "variant_b", label: "B: TP 0.50 + Re-entry", shortLabel: "B", tpMultiplier: 0.5, sessionGated: false },
  { key: "variant_c", label: "C: TP 0.25 + Re-entry + Session", shortLabel: "C", tpMultiplier: 0.25, sessionGated: true },
  { key: "variant_d", label: "D: TP 0.50 + Re-entry + Session", shortLabel: "D", tpMultiplier: 0.5, sessionGated: true },
] as const;

const SESSION_WINDOWS: Record<string, { startUtc: number; endUtc: number }> = {
  EURUSD: { startUtc: 7, endUtc: 16 },
  GBPUSD: { startUtc: 7, endUtc: 16 },
  USDJPY: { startUtc: 0, endUtc: 16 },
  USDCHF: { startUtc: 7, endUtc: 16 },
  AUDUSD: { startUtc: 22, endUtc: 7 },
  NZDUSD: { startUtc: 22, endUtc: 7 },
  USDCAD: { startUtc: 12, endUtc: 20 },
  EURJPY: { startUtc: 7, endUtc: 16 },
  GBPJPY: { startUtc: 7, endUtc: 16 },
  EURGBP: { startUtc: 7, endUtc: 16 },
  AUDNZD: { startUtc: 22, endUtc: 7 },
  EURNZD: { startUtc: 7, endUtc: 16 },
  GBPNZD: { startUtc: 7, endUtc: 16 },
  EURAUD: { startUtc: 7, endUtc: 16 },
  GBPAUD: { startUtc: 7, endUtc: 16 },
  AUDCAD: { startUtc: 12, endUtc: 20 },
  AUDJPY: { startUtc: 0, endUtc: 7 },
  NZDJPY: { startUtc: 0, endUtc: 7 },
  CADJPY: { startUtc: 0, endUtc: 16 },
  NZDCAD: { startUtc: 12, endUtc: 20 },
  GBPCAD: { startUtc: 12, endUtc: 20 },
  EURCAD: { startUtc: 12, endUtc: 20 },
  GBPCHF: { startUtc: 7, endUtc: 16 },
  EURCHF: { startUtc: 7, endUtc: 16 },
  NZDCHF: { startUtc: 7, endUtc: 16 },
  AUDCHF: { startUtc: 7, endUtc: 16 },
  CADCHF: { startUtc: 7, endUtc: 16 },
  CHFJPY: { startUtc: 7, endUtc: 16 },
  SPXUSD: { startUtc: 13, endUtc: 20 },
  NDXUSD: { startUtc: 13, endUtc: 20 },
  US30: { startUtc: 13, endUtc: 20 },
  US2000: { startUtc: 13, endUtc: 20 },
  NIKKEIUSD: { startUtc: 0, endUtc: 6 },
  BTCUSD: { startUtc: 0, endUtc: 24 },
  ETHUSD: { startUtc: 0, endUtc: 24 },
  XAUUSD: { startUtc: 7, endUtc: 20 },
  XAGUSD: { startUtc: 7, endUtc: 20 },
  WTIUSD: { startUtc: 7, endUtc: 20 },
  SUGAR: { startUtc: 13, endUtc: 20 },
  WHEAT: { startUtc: 13, endUtc: 20 },
  COPPER: { startUtc: 13, endUtc: 20 },
};

type Direction = "LONG" | "SHORT";
type AssetClass = "fx" | "indices" | "crypto" | "commodities";
type SignalMode = "GATED" | "NON_GATED";
type VariantKey = typeof REENTRY_VARIANTS[number]["key"];

type PairWeekVariantStats = {
  fills: number;
  totalReturn: number;
  wins: number;
  tpHits: number;
  pairsWithFill: number;
  reentries: number;
};

type PairWeekRecord = {
  week: string;
  weekLabel: string;
  pair: string;
  direction: Direction;
  tier: string;
  model: string;
  assetClass: AssetClass;
  gateDecision: GateDecision;
  signalMode: SignalMode;
  adrPct: number | null;
  dipEntryPrice: number | null;
  weekOpenPrice: number | null;
  weekClosePrice: number | null;
  eligible: boolean;
  skipReason: string | null;
  variants: Record<VariantKey, PairWeekVariantStats>;
};

type SummaryRow = {
  variantKey: VariantKey;
  label: string;
  totalFills: number;
  avgFillsPerPairWeek: number | null;
  totalReturn: number | null;
  avgReturnPerFill: number | null;
  winRate: number | null;
  tpHitRate: number | null;
};

function buildCompletedWeekOpens(count: number): string[] {
  const now = DateTime.utc();
  const currentWeekOpen = getCanonicalWeekOpenUtc(now);
  const currentWeekOpenDt = DateTime.fromISO(currentWeekOpen, { zone: "utc" });
  const lastCompleted = currentWeekOpenDt.minus({ weeks: 1 });
  const weeks: string[] = [];
  for (let i = count - 1; i >= 0; i -= 1) {
    const weekOpen = lastCompleted.minus({ weeks: i });
    weeks.push(getCanonicalWeekOpenUtc(weekOpen.plus({ hours: 1 })));
  }
  return weeks;
}

function weekLabel(weekOpenUtc: string): string {
  const dt = DateTime.fromISO(weekOpenUtc, { zone: "utc" }).setZone("America/New_York");
  if (!dt.isValid) return weekOpenUtc.slice(0, 10);
  return dt.plus({ days: 1 }).startOf("day").toFormat("MMM dd");
}

function toFinite(value: unknown): number | null {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function fmtPct(value: number | null, digits = 2): string {
  if (value === null || !Number.isFinite(value)) return "—";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(digits)}%`;
}

function fmtRate(value: number | null, digits = 2): string {
  if (value === null || !Number.isFinite(value)) return "—";
  return `${value.toFixed(digits)}%`;
}

function fmtNum(value: number | null, digits = 2): string {
  if (value === null || !Number.isFinite(value)) return "—";
  return value.toFixed(digits);
}

function classifySignalMode(decision: GateDecision): SignalMode {
  return decision === "SKIP" || decision === "REDUCE" ? "NON_GATED" : "GATED";
}

function signedReturnPct(direction: Direction, entryPrice: number, exitPrice: number): number {
  const rawPct = ((exitPrice - entryPrice) / entryPrice) * 100;
  return direction === "LONG" ? rawPct : -rawPct;
}

function emptyVariantStats(): PairWeekVariantStats {
  return {
    fills: 0,
    totalReturn: 0,
    wins: 0,
    tpHits: 0,
    pairsWithFill: 0,
    reentries: 0,
  };
}

function makeVariantStatsMap(): Record<VariantKey, PairWeekVariantStats> {
  return {
    variant_a: emptyVariantStats(),
    variant_b: emptyVariantStats(),
    variant_c: emptyVariantStats(),
    variant_d: emptyVariantStats(),
  };
}

function renderMarkdownTable(headers: string[], rows: string[][]): string {
  const divider = headers.map(() => "---");
  return [
    `| ${headers.join(" | ")} |`,
    `| ${divider.join(" | ")} |`,
    ...rows.map((row) => `| ${row.join(" | ")} |`),
  ].join("\n");
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T, index: number) => Promise<R>,
) {
  if (items.length === 0) return [] as R[];
  const results = new Array<R>(items.length);
  let nextIndex = 0;
  const workerCount = Math.min(Math.max(1, concurrency), items.length);
  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (true) {
        const currentIndex = nextIndex;
        nextIndex += 1;
        if (currentIndex >= items.length) return;
        results[currentIndex] = await mapper(items[currentIndex]!, currentIndex);
      }
    }),
  );
  return results;
}

function getSessionWindow(pair: string) {
  return SESSION_WINDOWS[pair] ?? { startUtc: 0, endUtc: 24 };
}

function isSessionHour(ts: number, pair: string) {
  const hour = DateTime.fromMillis(ts, { zone: "utc" }).hour;
  const session = getSessionWindow(pair);
  if (session.startUtc === 0 && session.endUtc === 24) return true;
  if (session.startUtc < session.endUtc) {
    return hour >= session.startUtc && hour < session.endUtc;
  }
  return hour >= session.startUtc || hour < session.endUtc;
}

function simulateReentryVariant(options: {
  pair: string;
  direction: Direction;
  bars: OandaHourlyCandle[];
  adrPct: number;
  dipEntryPrice: number;
  tpMultiplier: number;
  sessionGated: boolean;
}): PairWeekVariantStats {
  const stats = emptyVariantStats();
  if (options.bars.length === 0) return stats;

  const tpPrice =
    options.direction === "LONG"
      ? options.dipEntryPrice * (1 + ((options.tpMultiplier * options.adrPct) / 100))
      : options.dipEntryPrice * (1 - ((options.tpMultiplier * options.adrPct) / 100));
  const tpReturn = options.tpMultiplier * options.adrPct;

  let waitingForTp = false;
  let pairFilled = false;

  for (const bar of options.bars) {
    if (!waitingForTp) {
      const sessionAllowed = !options.sessionGated || isSessionHour(bar.ts, options.pair);
      const fillHit = sessionAllowed && (
        options.direction === "LONG"
          ? bar.low <= options.dipEntryPrice
          : bar.high >= options.dipEntryPrice
      );
      if (!fillHit) {
        continue;
      }

      stats.fills += 1;
      pairFilled = true;
      waitingForTp = true;

      const sameBarTpHit = options.direction === "LONG"
        ? bar.high >= tpPrice
        : bar.low <= tpPrice;
      if (sameBarTpHit) {
        stats.totalReturn += tpReturn;
        stats.wins += 1;
        stats.tpHits += 1;
        waitingForTp = false;
      }
      continue;
    }

    const tpHit = options.direction === "LONG"
      ? bar.high >= tpPrice
      : bar.low <= tpPrice;
    if (tpHit) {
      stats.totalReturn += tpReturn;
      stats.wins += 1;
      stats.tpHits += 1;
      waitingForTp = false;
    }
  }

  if (pairFilled) {
    stats.pairsWithFill = 1;
    stats.reentries = Math.max(0, stats.fills - 1);
  }

  if (waitingForTp) {
    const lastClose = options.bars[options.bars.length - 1]!.close;
    const fallbackReturn = signedReturnPct(options.direction, options.dipEntryPrice, lastClose);
    stats.totalReturn += fallbackReturn;
    if (fallbackReturn > 0) {
      stats.wins += 1;
    }
  }

  return stats;
}

function buildSummaryRows(records: PairWeekRecord[]): string[][] {
  const eligiblePairWeeks = records.filter((record) => record.eligible).length;
  return REENTRY_VARIANTS.map((variant) => {
    const totalFills = records.reduce((sum, record) => sum + record.variants[variant.key].fills, 0);
    const totalReturn = records.reduce((sum, record) => sum + record.variants[variant.key].totalReturn, 0);
    const wins = records.reduce((sum, record) => sum + record.variants[variant.key].wins, 0);
    const tpHits = records.reduce((sum, record) => sum + record.variants[variant.key].tpHits, 0);
    const avgFillsPerPairWeek = eligiblePairWeeks > 0 ? totalFills / eligiblePairWeeks : null;
    const avgReturnPerFill = totalFills > 0 ? totalReturn / totalFills : null;
    const winRate = totalFills > 0 ? (wins / totalFills) * 100 : null;
    const tpHitRate = totalFills > 0 ? (tpHits / totalFills) * 100 : null;
    return [
      variant.label,
      String(totalFills),
      fmtNum(avgFillsPerPairWeek),
      fmtPct(totalReturn),
      fmtPct(avgReturnPerFill),
      fmtRate(winRate),
      fmtRate(tpHitRate),
    ];
  });
}

function buildPerWeekVariantRows(records: PairWeekRecord[], weeks: string[], variantKey: VariantKey): string[][] {
  return weeks.map((weekOpenUtc) => {
    const weekRecords = records.filter((record) => record.week === weekOpenUtc);
    const signals = weekRecords.length;
    const pairsWithFill = weekRecords.reduce((sum, record) => sum + record.variants[variantKey].pairsWithFill, 0);
    const totalFills = weekRecords.reduce((sum, record) => sum + record.variants[variantKey].fills, 0);
    const reentries = weekRecords.reduce((sum, record) => sum + record.variants[variantKey].reentries, 0);
    const totalReturn = weekRecords.reduce((sum, record) => sum + record.variants[variantKey].totalReturn, 0);
    return [
      weekLabel(weekOpenUtc),
      String(signals),
      String(pairsWithFill),
      String(totalFills),
      String(reentries),
      fmtPct(totalFills > 0 ? totalReturn : signals > 0 ? 0 : null),
    ];
  });
}

function buildGateDecisionRows(records: PairWeekRecord[]): string[][] {
  const decisions: GateDecision[] = ["PASS", "NO_DATA", "REDUCE", "SKIP"];
  return decisions.map((decision) => [
    decision,
    String(records.filter((record) => record.gateDecision === decision).length),
  ]);
}

function buildSkipReasonRows(records: PairWeekRecord[]): string[][] {
  const skipCounts = new Map<string, number>();
  for (const record of records) {
    if (!record.skipReason) continue;
    skipCounts.set(record.skipReason, (skipCounts.get(record.skipReason) ?? 0) + 1);
  }
  return [...skipCounts.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([reason, count]) => [reason, String(count)]);
}

function buildModeRecords(records: PairWeekRecord[], mode: "COMBINED" | SignalMode): PairWeekRecord[] {
  if (mode === "COMBINED") return records;
  return records.filter((record) => record.signalMode === mode);
}

function buildVariantSummary(records: PairWeekRecord[], variantKey: VariantKey): SummaryRow {
  const variant = REENTRY_VARIANTS.find((entry) => entry.key === variantKey)!;
  const eligiblePairWeeks = records.filter((record) => record.eligible).length;
  const totalFills = records.reduce((sum, record) => sum + record.variants[variantKey].fills, 0);
  const totalReturn = records.reduce((sum, record) => sum + record.variants[variantKey].totalReturn, 0);
  const wins = records.reduce((sum, record) => sum + record.variants[variantKey].wins, 0);
  const tpHits = records.reduce((sum, record) => sum + record.variants[variantKey].tpHits, 0);
  return {
    variantKey,
    label: variant.label,
    totalFills,
    avgFillsPerPairWeek: eligiblePairWeeks > 0 ? totalFills / eligiblePairWeeks : null,
    totalReturn,
    avgReturnPerFill: totalFills > 0 ? totalReturn / totalFills : null,
    winRate: totalFills > 0 ? (wins / totalFills) * 100 : null,
    tpHitRate: totalFills > 0 ? (tpHits / totalFills) * 100 : null,
  };
}

function buildMarkdownReport(options: {
  records: PairWeekRecord[];
  weeks: string[];
  generatedAtIso: string;
}): string {
  const combinedRecords = buildModeRecords(options.records, "COMBINED");
  const gatedRecords = buildModeRecords(options.records, "GATED");
  const nonGatedRecords = buildModeRecords(options.records, "NON_GATED");
  const variantACombined = buildVariantSummary(combinedRecords, "variant_a");

  const sections = [
    "# ADR Dip Re-Entries",
    "",
    `Generated: ${options.generatedAtIso}`,
    "",
    "## What We're Building And Why",
    "",
    "Test 2 showed that tight fixed targets, especially TP 0.25 ADR, produced a very high win rate but capped total return because the engine allowed only one fill per pair per week. This test asks the next question: if the same pair revisits the 1x ADR dip after TP is hit, can repeated fills compound that high-probability edge enough to close the gap versus hold-to-close?",
    "",
    "This version upgrades execution from daily bars to H1 bars, keeps the 1x ADR dip-entry anchor from the weekly system, and adds session-gated fill variants to see whether restricting entries to the pair's primary session improves trade quality.",
    "",
    "## Test Design",
    "",
    "- Universe: all Tiered V3 directional signals before gate filtering, across FX, indices, commodities, and crypto.",
    "- Mode split: GATED = PASS/NO_DATA, NON-GATED = SKIP/REDUCE, COMBINED = both together.",
    "- Entry level: fixed 1.0x ADR dip from the open of the first H1 bar in the canonical week window.",
    "- Execution bars: OANDA H1 candles for the full canonical week window.",
    "- Re-entry model: after TP, the state machine returns to waiting for another touch of the same dip-entry level.",
    "- Session gating applies only to fills. TP and final hold-to-close exits can occur at any hour.",
    "- One fill and one TP can occur on the same H1 bar, but no second re-entry is allowed until the next bar.",
    "",
    "## Universe Summary",
    "",
    renderMarkdownTable(
      ["Metric", "Value"],
      [
        ["Signals processed", String(options.records.length)],
        ["GATED signals", String(gatedRecords.length)],
        ["NON-GATED signals", String(nonGatedRecords.length)],
        ["Eligible pair-weeks", String(combinedRecords.filter((record) => record.eligible).length)],
        ["Skipped pair-weeks", String(combinedRecords.filter((record) => !record.eligible).length)],
      ],
    ),
    "",
    renderMarkdownTable(["Gate Decision", "Signals"], buildGateDecisionRows(options.records)),
    "",
  ];

  const skipReasonRows = buildSkipReasonRows(options.records);
  if (skipReasonRows.length > 0) {
    sections.push(renderMarkdownTable(["Skip Reason", "Signals"], skipReasonRows));
    sections.push("");
  }

  const modes: Array<{ key: "COMBINED" | SignalMode; title: string }> = [
    { key: "COMBINED", title: "Combined" },
    { key: "GATED", title: "GATED (PASS / NO_DATA)" },
    { key: "NON_GATED", title: "NON-GATED (SKIP / REDUCE)" },
  ];

  for (const mode of modes) {
    const modeRecords = buildModeRecords(options.records, mode.key);
    sections.push(`## ${mode.title}`);
    sections.push("");
    sections.push(
      renderMarkdownTable(
        ["Variant", "Total Fills", "Avg Fills/Pair/Week", "Total Return", "Avg Return/Fill", "Win Rate", "TP Hit Rate"],
        buildSummaryRows(modeRecords),
      ),
    );
    sections.push("");

    for (const variant of REENTRY_VARIANTS) {
      sections.push(`### ${variant.label}`);
      sections.push("");
      sections.push(
        renderMarkdownTable(
          ["Week", "Signals", "Pairs w/ Fill", "Total Fills", "Re-entries", "Total Return"],
          buildPerWeekVariantRows(modeRecords, options.weeks, variant.key),
        ),
      );
      sections.push("");
    }
  }

  sections.push("## Comparison Vs Test 2 Baselines");
  sections.push("");
  sections.push(
    renderMarkdownTable(
      ["Metric", "Value"],
      [
        ["Test 2 TP 0.25 single-fill trades", String(TEST2_BASELINES.tp025SingleFill.trades)],
        ["Test 2 TP 0.25 single-fill total return", fmtPct(TEST2_BASELINES.tp025SingleFill.totalReturn)],
        ["Test 2 TP 0.25 single-fill win rate", fmtRate(TEST2_BASELINES.tp025SingleFill.winRate)],
        ["Test 3 Variant A fills", String(variantACombined.totalFills)],
        ["Test 3 Variant A total return", fmtPct(variantACombined.totalReturn)],
        ["Test 3 Variant A win rate", fmtRate(variantACombined.winRate)],
        ["Delta vs Test 2 TP 0.25", fmtPct((variantACombined.totalReturn ?? 0) - TEST2_BASELINES.tp025SingleFill.totalReturn)],
        ["Test 2 Baseline Hold total return", fmtPct(TEST2_BASELINES.holdSingleFill.totalReturn)],
        ["Test 2 Baseline Hold win rate", fmtRate(TEST2_BASELINES.holdSingleFill.winRate)],
        ["Variant A minus Test 2 Hold", fmtPct((variantACombined.totalReturn ?? 0) - TEST2_BASELINES.holdSingleFill.totalReturn)],
      ],
    ),
  );
  sections.push("");
  sections.push("## Notes");
  sections.push("");
  sections.push("- Avg fills per pair/week uses eligible pair-weeks as the denominator.");
  sections.push("- Session gating only affects whether a new fill can occur. Once in a trade, TP and final week-close exits are always allowed.");
  sections.push("- H1 candles still hide intrabar order. Same-bar fill and TP are counted, but multiple re-entry cycles inside one candle are intentionally not modeled.");
  sections.push("");

  return sections.join("\n");
}

async function main() {
  const weekOpens = buildCompletedWeekOpens(LOOKBACK_WEEKS);
  const generatedAtIso = DateTime.utc().toISO() ?? new Date().toISOString();

  console.log("\nADR Dip Re-Entry Test");
  console.log(`${weekOpens.length} completed weeks | H1 execution | variants: A, B, C, D`);
  console.log("Universe: Tiered V3 directional signals across all asset classes\n");

  console.log("Loading gate artifacts...");
  const gateMap = buildGateMap();
  const cotContext = await buildCotGateContext();
  console.log("Ready.\n");

  const records: PairWeekRecord[] = [];

  for (const weekOpenUtc of weekOpens) {
    const label = weekLabel(weekOpenUtc);
    console.log(`Processing ${label} (${weekOpenUtc})...`);

    let computed;
    try {
      computed = await computeTieredWeekForSystem({ weekOpenUtc, system: "v3" });
    } catch (error) {
      console.log(`  Failed to compute tiered week: ${error}`);
      continue;
    }

    if (!computed) {
      console.log("  No tiered week data.");
      continue;
    }

    const pairToAssetClass = new Map<string, AssetClass>();
    for (const [assetClass, models] of Object.entries(computed.perAsset)) {
      for (const modelRow of models) {
        for (const detail of (modelRow as { pair_details?: Array<{ pair: string }> }).pair_details ?? []) {
          pairToAssetClass.set(detail.pair.toUpperCase(), assetClass as AssetClass);
        }
      }
    }

    const signalInputs: Array<{
      pair: string;
      direction: Direction;
      tier: string;
      model: string;
      assetClass: AssetClass;
      signalMode: SignalMode;
      gateDecision: GateDecision;
    }> = [];

    for (const modelRow of computed.combined) {
      const tier = MODEL_TO_TIER[modelRow.model];
      if (!tier) continue;

      for (const detail of (modelRow as { pair_details?: Array<{ pair: string; direction: string }> }).pair_details ?? []) {
        const pair = detail.pair.toUpperCase();
        const direction = detail.direction;
        if (direction !== "LONG" && direction !== "SHORT") continue;

        const assetClass = pairToAssetClass.get(pair) ?? "fx";

        let gate: { decision: GateDecision; reasons: string[] };
        try {
          gate = evaluatePairWithGate({
            pair,
            weekOpenUtc,
            direction,
            assetClass,
            gateMap,
            cotContext,
            reduceAsSkip: false,
          });
        } catch {
          gate = { decision: "NO_DATA", reasons: ["gate_eval_error"] };
        }

        signalInputs.push({
          pair,
          direction,
          tier,
          model: modelRow.model,
          assetClass,
          signalMode: classifySignalMode(gate.decision),
          gateDecision: gate.decision,
        });
      }
    }

    const weekResults = await mapWithConcurrency(signalInputs, FETCH_CONCURRENCY, async (signal) => {
      const weekWindow = getCanonicalWeekWindow(weekOpenUtc, signal.assetClass);
      const record: PairWeekRecord = {
        week: weekOpenUtc,
        weekLabel: label,
        pair: signal.pair,
        direction: signal.direction,
        tier: signal.tier,
        model: signal.model,
        assetClass: signal.assetClass,
        gateDecision: signal.gateDecision,
        signalMode: signal.signalMode,
        adrPct: null,
        dipEntryPrice: null,
        weekOpenPrice: null,
        weekClosePrice: null,
        eligible: false,
        skipReason: null,
        variants: makeVariantStatsMap(),
      };

      const adrRowsPromise = query<{ open_price: string; high_price: string; low_price: string }>(
        `SELECT open_price, high_price, low_price
         FROM pair_period_returns
         WHERE symbol = $1
           AND period_type = 'daily'
           AND period_open_utc < $2::timestamptz
         ORDER BY period_open_utc DESC
         LIMIT $3`,
        [signal.pair, weekWindow.openUtc.toISO(), ADR_LOOKBACK_DAYS],
      );
      const barsPromise = fetchOandaCandleSeries(signal.pair, weekWindow.openUtc, weekWindow.closeUtc);

      const [adrResult, barsResult] = await Promise.allSettled([adrRowsPromise, barsPromise]);
      if (adrResult.status === "rejected") {
        record.skipReason = "adr_query_failed";
        return record;
      }
      if (barsResult.status === "rejected") {
        record.skipReason = "oanda_fetch_failed";
        return record;
      }
      const adrRows = adrResult.value;
      const bars = barsResult.value;

      const adrRanges = adrRows
        .map((row) => {
          const openPrice = toFinite(row.open_price);
          const highPrice = toFinite(row.high_price);
          const lowPrice = toFinite(row.low_price);
          if (openPrice === null || openPrice <= 0 || highPrice === null || lowPrice === null) return null;
          return ((highPrice - lowPrice) / openPrice) * 100;
        })
        .filter((value): value is number => value !== null && Number.isFinite(value));

      if (adrRanges.length < ADR_MIN_REQUIRED_DAYS) {
        record.skipReason = "insufficient_adr";
        return record;
      }

      if (bars.length === 0) {
        record.skipReason = "no_h1_bars";
        return record;
      }

      record.eligible = true;
      record.adrPct = adrRanges.reduce((sum, value) => sum + value, 0) / adrRanges.length;
      record.weekOpenPrice = bars[0]!.open;
      record.weekClosePrice = bars[bars.length - 1]!.close;

      const thresholdPct = record.adrPct * ADR_MULTIPLIER;
      record.dipEntryPrice =
        signal.direction === "LONG"
          ? record.weekOpenPrice * (1 - (thresholdPct / 100))
          : record.weekOpenPrice * (1 + (thresholdPct / 100));

      for (const variant of REENTRY_VARIANTS) {
        record.variants[variant.key] = simulateReentryVariant({
          pair: signal.pair,
          direction: signal.direction,
          bars,
          adrPct: record.adrPct,
          dipEntryPrice: record.dipEntryPrice,
          tpMultiplier: variant.tpMultiplier,
          sessionGated: variant.sessionGated,
        });
      }

      return record;
    });

    const eligibleCount = weekResults.filter((record) => record.eligible).length;
    const skipCount = weekResults.length - eligibleCount;
    console.log(`  Signals: ${weekResults.length} | Eligible: ${eligibleCount} | Skipped: ${skipCount}`);
    records.push(...weekResults);
  }

  const combinedRecords = buildModeRecords(records, "COMBINED");
  const gatedRecords = buildModeRecords(records, "GATED");
  const nonGatedRecords = buildModeRecords(records, "NON_GATED");
  const variantACombined = buildVariantSummary(combinedRecords, "variant_a");

  console.log("\nUniverse Summary");
  console.log(renderMarkdownTable(
    ["Metric", "Value"],
    [
      ["Signals processed", String(records.length)],
      ["GATED signals", String(gatedRecords.length)],
      ["NON-GATED signals", String(nonGatedRecords.length)],
      ["Eligible pair-weeks", String(combinedRecords.filter((record) => record.eligible).length)],
      ["Skipped pair-weeks", String(combinedRecords.filter((record) => !record.eligible).length)],
    ],
  ));
  console.log("");
  console.log(renderMarkdownTable(["Gate Decision", "Signals"], buildGateDecisionRows(records)));
  const skipReasonRows = buildSkipReasonRows(records);
  if (skipReasonRows.length > 0) {
    console.log("");
    console.log(renderMarkdownTable(["Skip Reason", "Signals"], skipReasonRows));
  }

  const modes: Array<{ key: "COMBINED" | SignalMode; title: string }> = [
    { key: "COMBINED", title: "COMBINED" },
    { key: "GATED", title: "GATED (PASS / NO_DATA)" },
    { key: "NON_GATED", title: "NON-GATED (SKIP / REDUCE)" },
  ];

  for (const mode of modes) {
    const modeRecords = buildModeRecords(records, mode.key);
    console.log(`\n${mode.title}`);
    console.log(renderMarkdownTable(
      ["Variant", "Total Fills", "Avg Fills/Pair/Week", "Total Return", "Avg Return/Fill", "Win Rate", "TP Hit Rate"],
      buildSummaryRows(modeRecords),
    ));
  }

  console.log("\nComparison Vs Test 2 Baselines");
  console.log(renderMarkdownTable(
    ["Metric", "Value"],
    [
      ["Test 2 TP 0.25 single-fill", `${TEST2_BASELINES.tp025SingleFill.trades} trades | ${fmtPct(TEST2_BASELINES.tp025SingleFill.totalReturn)} | ${fmtRate(TEST2_BASELINES.tp025SingleFill.winRate)}`],
      ["Test 3 Variant A", `${variantACombined.totalFills} fills | ${fmtPct(variantACombined.totalReturn)} | ${fmtRate(variantACombined.winRate)}`],
      ["Delta vs Test 2 TP 0.25", fmtPct((variantACombined.totalReturn ?? 0) - TEST2_BASELINES.tp025SingleFill.totalReturn)],
      ["Test 2 Baseline Hold", `${TEST2_BASELINES.holdSingleFill.trades} trades | ${fmtPct(TEST2_BASELINES.holdSingleFill.totalReturn)} | ${fmtRate(TEST2_BASELINES.holdSingleFill.winRate)}`],
      ["Variant A minus Test 2 Hold", fmtPct((variantACombined.totalReturn ?? 0) - TEST2_BASELINES.holdSingleFill.totalReturn)],
    ],
  ));

  const reportText = buildMarkdownReport({
    records,
    weeks: weekOpens,
    generatedAtIso,
  });
  mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
  writeFileSync(REPORT_PATH, `${reportText}\n`, "utf8");

  console.log(`\nReport written to ${REPORT_PATH}`);
  console.log("Done.");
  process.exit(0);
}

main().catch((error) => {
  console.error("Fatal:", error);
  process.exit(1);
});
