/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: adr-dip-tp-optimization.ts
 *
 * Description:
 * Tests ADR dip-entry profit-target variants across ALL Tiered V3 signals
 * (gated + non-gated) over the last 9 completed weeks.
 *
 * Entry:
 *   1. Compute all Tiered V3 directional signals before gate filtering
 *   2. Split signals into GATED (PASS/NO_DATA) vs NON-GATED (SKIP/REDUCE)
 *   3. Wait for a 1.0x ADR dip from the week open in the signal direction
 *   4. One entry per pair per week, no re-entry after fill/TP
 *
 * Exit variants tested on the same fill event:
 *   1. Baseline: hold to week close
 *   2. TP 0.25 ADR
 *   3. TP 0.50 ADR
 *   4. TP 0.75 ADR
 *   5. TP 1.00 ADR
 *
 * TP detection uses daily bars from the fill day onward (inclusive).
 * If a TP level is touched, the trade books the fixed ADR-distance return.
 * If TP is not touched, the trade holds to the weekly close.
 *
 * Usage: .\node_modules\.bin\tsx.cmd scripts/adr-dip-tp-optimization.ts
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

// Load .env.local for DATABASE_URL
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
const REPORT_PATH = path.resolve(process.cwd(), "app", "reports", "adr-dip-tp-optimization.md");

const MODEL_TO_TIER: Record<string, string | null> = {
  antikythera: null,
  antikythera_v2: null,
  antikythera_v3: "HIGH",
  blended: null,
  dealer: "MEDIUM",
  commercial: "LOW",
  sentiment: null,
};

const TP_VARIANTS = [
  { key: "baseline", label: "Baseline Hold", shortLabel: "Hold", tpMultiplier: null },
  { key: "tp_0_25", label: "TP 0.25 ADR", shortLabel: "TP0.25", tpMultiplier: 0.25 },
  { key: "tp_0_50", label: "TP 0.50 ADR", shortLabel: "TP0.50", tpMultiplier: 0.5 },
  { key: "tp_0_75", label: "TP 0.75 ADR", shortLabel: "TP0.75", tpMultiplier: 0.75 },
  { key: "tp_1_00", label: "TP 1.00 ADR", shortLabel: "TP1.00", tpMultiplier: 1.0 },
] as const;

type Direction = "LONG" | "SHORT";
type AssetClass = "fx" | "indices" | "crypto" | "commodities";
type SignalMode = "GATED" | "NON_GATED";
type VariantKey = typeof TP_VARIANTS[number]["key"];

type PriceBar = {
  period_open_utc: string | Date;
  high_price: string;
  low_price: string;
};

type TradeRecord = {
  week: string;
  weekLabel: string;
  pair: string;
  direction: Direction;
  tier: string;
  model: string;
  assetClass: AssetClass;
  gateDecision: GateDecision;
  gateReasons: string[];
  signalMode: SignalMode;
  weekOpenPrice: number | null;
  weekClosePrice: number | null;
  adrPct: number | null;
  dipEntryPrice: number | null;
  eligible: boolean;
  dipFilled: boolean;
  fillBarIndex: number | null;
  variantReturns: Record<VariantKey, number | null>;
  variantTpHit: Record<VariantKey, boolean>;
};

type VariantStats = {
  variantKey: VariantKey;
  label: string;
  eligible: number;
  trades: number;
  avgReturn: number | null;
  totalReturn: number | null;
  winRate: number | null;
  fillRate: number | null;
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

function signedReturnPct(direction: Direction, entryPrice: number, exitPrice: number): number {
  const rawPct = ((exitPrice - entryPrice) / entryPrice) * 100;
  return direction === "LONG" ? rawPct : -rawPct;
}

function classifySignalMode(decision: GateDecision): SignalMode {
  return decision === "SKIP" || decision === "REDUCE" ? "NON_GATED" : "GATED";
}

function makeVariantReturnMap(): Record<VariantKey, number | null> {
  return {
    baseline: null,
    tp_0_25: null,
    tp_0_50: null,
    tp_0_75: null,
    tp_1_00: null,
  };
}

function makeVariantHitMap(): Record<VariantKey, boolean> {
  return {
    baseline: false,
    tp_0_25: false,
    tp_0_50: false,
    tp_0_75: false,
    tp_1_00: false,
  };
}

function findDipFillIndex(direction: Direction, dipEntryPrice: number, dailyBars: PriceBar[]): number | null {
  for (let index = 0; index < dailyBars.length; index += 1) {
    const bar = dailyBars[index]!;
    const barHigh = toFinite(bar.high_price);
    const barLow = toFinite(bar.low_price);
    if (barHigh === null || barLow === null) continue;
    if (direction === "LONG" && barLow <= dipEntryPrice) return index;
    if (direction === "SHORT" && barHigh >= dipEntryPrice) return index;
  }
  return null;
}

function tpHitAfterFill(
  direction: Direction,
  tpPrice: number,
  dailyBars: PriceBar[],
  fillBarIndex: number,
): boolean {
  for (let index = fillBarIndex; index < dailyBars.length; index += 1) {
    const bar = dailyBars[index]!;
    const barHigh = toFinite(bar.high_price);
    const barLow = toFinite(bar.low_price);
    if (barHigh === null || barLow === null) continue;
    if (direction === "LONG" && barHigh >= tpPrice) return true;
    if (direction === "SHORT" && barLow <= tpPrice) return true;
  }
  return false;
}

function evaluateVariantReturns(options: {
  direction: Direction;
  adrPct: number;
  dipEntryPrice: number;
  weekClosePrice: number;
  dailyBars: PriceBar[];
  fillBarIndex: number;
}): { returns: Record<VariantKey, number | null>; tpHits: Record<VariantKey, boolean> } {
  const returns = makeVariantReturnMap();
  const tpHits = makeVariantHitMap();

  const fallbackReturn = signedReturnPct(options.direction, options.dipEntryPrice, options.weekClosePrice);

  for (const variant of TP_VARIANTS) {
    if (variant.tpMultiplier === null) {
      returns[variant.key] = fallbackReturn;
      continue;
    }

    const tpPrice =
      options.direction === "LONG"
        ? options.dipEntryPrice * (1 + ((variant.tpMultiplier * options.adrPct) / 100))
        : options.dipEntryPrice * (1 - ((variant.tpMultiplier * options.adrPct) / 100));

    const hit = tpHitAfterFill(options.direction, tpPrice, options.dailyBars, options.fillBarIndex);
    tpHits[variant.key] = hit;
    returns[variant.key] = hit ? variant.tpMultiplier * options.adrPct : fallbackReturn;
  }

  return { returns, tpHits };
}

function renderMarkdownTable(headers: string[], rows: string[][]): string {
  const divider = headers.map(() => "---");
  return [
    `| ${headers.join(" | ")} |`,
    `| ${divider.join(" | ")} |`,
    ...rows.map((row) => `| ${row.join(" | ")} |`),
  ].join("\n");
}

function computeVariantStats(records: TradeRecord[], variantKey: VariantKey): VariantStats {
  const eligible = records.filter((record) => record.eligible).length;
  const returns = records
    .map((record) => record.variantReturns[variantKey])
    .filter((value): value is number => value !== null && Number.isFinite(value));
  const wins = returns.filter((value) => value > 0).length;
  const totalReturn = returns.length > 0 ? returns.reduce((sum, value) => sum + value, 0) : null;
  return {
    variantKey,
    label: TP_VARIANTS.find((variant) => variant.key === variantKey)?.label ?? variantKey,
    eligible,
    trades: returns.length,
    avgReturn: returns.length > 0 && totalReturn !== null ? totalReturn / returns.length : null,
    totalReturn,
    winRate: returns.length > 0 ? (wins / returns.length) * 100 : null,
    fillRate: eligible > 0 ? (returns.length / eligible) * 100 : null,
  };
}

function buildComparisonRows(records: TradeRecord[]): string[][] {
  return TP_VARIANTS.map((variant) => {
    const stats = computeVariantStats(records, variant.key);
    return [
      variant.label,
      String(stats.trades),
      fmtPct(stats.avgReturn),
      fmtPct(stats.totalReturn),
      fmtRate(stats.winRate),
      fmtRate(stats.fillRate),
    ];
  });
}

function buildPerWeekRows(records: TradeRecord[], weeks: string[]): string[][] {
  return weeks.map((weekOpenUtc) => {
    const weekRecords = records.filter((record) => record.week === weekOpenUtc);
    const eligible = weekRecords.filter((record) => record.eligible).length;
    const filled = weekRecords.filter((record) => record.dipFilled).length;
    const fillRate = eligible > 0 ? (filled / eligible) * 100 : null;
    return [
      weekLabel(weekOpenUtc),
      String(eligible),
      String(filled),
      fmtRate(fillRate),
      ...TP_VARIANTS.map((variant) => {
        const values = weekRecords
          .map((record) => record.variantReturns[variant.key])
          .filter((value): value is number => value !== null && Number.isFinite(value));
        const total = values.length > 0 ? values.reduce((sum, value) => sum + value, 0) : null;
        return fmtPct(total);
      }),
    ];
  });
}

function buildModeRecords(records: TradeRecord[], mode: "COMBINED" | SignalMode): TradeRecord[] {
  if (mode === "COMBINED") return records;
  return records.filter((record) => record.signalMode === mode);
}

function buildGateDecisionSummary(records: TradeRecord[]): string[][] {
  const decisions: GateDecision[] = ["PASS", "NO_DATA", "REDUCE", "SKIP"];
  return decisions.map((decision) => [
    decision,
    String(records.filter((record) => record.gateDecision === decision).length),
  ]);
}

function buildMarkdownReport(options: {
  records: TradeRecord[];
  weeks: string[];
  generatedAtIso: string;
}): string {
  const combinedRecords = buildModeRecords(options.records, "COMBINED");
  const gatedRecords = buildModeRecords(options.records, "GATED");
  const nonGatedRecords = buildModeRecords(options.records, "NON_GATED");

  const sections = [
    "# ADR Dip-Entry TP Optimization",
    "",
    `Generated: ${options.generatedAtIso}`,
    "",
    "## What We're Building And Why",
    "",
    "We're testing the intraday execution layer on top of the Tiered V3 weekly directional system. The weekly system already works when entered at week open and held to week close. This research asks a narrower question: once a valid weekly signal pulls back by 1 ADR and fills a better entry, what profit target works best from that improved price?",
    "",
    "This is Test 2 in the ADR dip-entry research program. The goal is to compare fixed ADR take-profit distances against the control case of holding the filled dip-entry trade to week close, while keeping the fill logic identical across all variants.",
    "",
    "## Test Design",
    "",
    "- Universe: all Tiered V3 directional signals before gate filtering, across FX, indices, commodities, and crypto.",
    "- Mode split: GATED = PASS/NO_DATA, NON-GATED = SKIP/REDUCE, COMBINED = both together.",
    "- Entry: 1.0x ADR dip from week open, using the same 10-day ADR logic as the baseline script.",
    "- Exit variants: hold to week close, TP at 0.25 ADR, 0.50 ADR, 0.75 ADR, and 1.00 ADR.",
    "- TP scan: daily bars from the fill day onward, inclusive of the fill day.",
    "- No stop loss. If TP is not hit, the trade holds to the weekly close.",
    "- One entry per pair per week, with no re-entry after fill or TP.",
    "",
    "## Universe Summary",
    "",
    renderMarkdownTable(
      ["Metric", "Value"],
      [
        ["Signals processed", String(options.records.length)],
        ["GATED signals", String(gatedRecords.length)],
        ["NON-GATED signals", String(nonGatedRecords.length)],
        ["Combined eligible ADR trades", String(combinedRecords.filter((record) => record.eligible).length)],
        ["Combined filled ADR trades", String(combinedRecords.filter((record) => record.dipFilled).length)],
      ],
    ),
    "",
    renderMarkdownTable(["Gate Decision", "Signals"], buildGateDecisionSummary(options.records)),
    "",
  ];

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
        ["Variant", "Trades", "Avg Return", "Total Return", "Win Rate", "Fill Rate"],
        buildComparisonRows(modeRecords),
      ),
    );
    sections.push("");
    sections.push("### Per-Week Breakdown");
    sections.push("");
    sections.push(
      renderMarkdownTable(
        ["Week", "Eligible", "Filled", "Fill Rate", ...TP_VARIANTS.map((variant) => `${variant.shortLabel} Tot`)],
        buildPerWeekRows(modeRecords, options.weeks),
      ),
    );
    sections.push("");
  }

  sections.push("## Notes");
  sections.push("");
  sections.push("- Returns are reported only for filled ADR dip entries. Unfilled signals affect fill rate but do not contribute return.");
  sections.push("- TP-hit trades book the fixed ADR-distance return defined by the target multiplier.");
  sections.push("- Daily bars cannot resolve intraday path beyond level touch. Same-day fill and TP touch are counted as TP hits by design.");
  sections.push("");

  return sections.join("\n");
}

async function main() {
  const weekOpens = buildCompletedWeekOpens(LOOKBACK_WEEKS);
  const generatedAtIso = DateTime.utc().toISO() ?? new Date().toISOString();

  console.log("\nADR Dip-Entry TP Optimization");
  console.log(`${weekOpens.length} completed weeks | 1.0x ADR entry | variants: Hold, TP0.25, TP0.50, TP0.75, TP1.00`);
  console.log("Universe: Tiered V3 directional signals across all asset classes\n");

  console.log("Loading gate artifacts...");
  const gateMap = buildGateMap();
  const cotContext = await buildCotGateContext();
  console.log("Ready.\n");

  const records: TradeRecord[] = [];

  for (const weekOpenUtc of weekOpens) {
    const label = weekLabel(weekOpenUtc);
    const nextWeekOpenUtc = DateTime.fromISO(weekOpenUtc, { zone: "utc" }).plus({ weeks: 1 }).toISO();
    console.log(`Processing ${label} (${weekOpenUtc})...`);

    let computed;
    try {
      computed = await computeTieredWeekForSystem({ weekOpenUtc, system: "v3" });
    } catch (error) {
      console.log(`  Failed to compute week: ${error}`);
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

        const record: TradeRecord = {
          week: weekOpenUtc,
          weekLabel: label,
          pair,
          direction,
          tier,
          model: modelRow.model,
          assetClass,
          gateDecision: gate.decision,
          gateReasons: gate.reasons,
          signalMode: classifySignalMode(gate.decision),
          weekOpenPrice: null,
          weekClosePrice: null,
          adrPct: null,
          dipEntryPrice: null,
          eligible: false,
          dipFilled: false,
          fillBarIndex: null,
          variantReturns: makeVariantReturnMap(),
          variantTpHit: makeVariantHitMap(),
        };

        const [weeklyRows, adrRows] = await Promise.all([
          query<{ open_price: string; close_price: string }>(
            `SELECT open_price, close_price
             FROM pair_period_returns
             WHERE symbol = $1
               AND period_type = 'weekly'
               AND period_open_utc >= $2::timestamptz
               AND period_open_utc < $3::timestamptz
             ORDER BY period_open_utc ASC
             LIMIT 1`,
            [pair, weekOpenUtc, nextWeekOpenUtc],
          ),
          query<{ open_price: string; high_price: string; low_price: string }>(
            `SELECT open_price, high_price, low_price
             FROM pair_period_returns
             WHERE symbol = $1
               AND period_type = 'daily'
               AND period_open_utc < $2::timestamptz
             ORDER BY period_open_utc DESC
             LIMIT $3`,
            [pair, weekOpenUtc, ADR_LOOKBACK_DAYS],
          ),
        ]);

        record.weekOpenPrice = toFinite(weeklyRows[0]?.open_price);
        record.weekClosePrice = toFinite(weeklyRows[0]?.close_price);

        const adrRanges = adrRows
          .map((row) => {
            const openPrice = toFinite(row.open_price);
            const highPrice = toFinite(row.high_price);
            const lowPrice = toFinite(row.low_price);
            if (openPrice === null || openPrice <= 0 || highPrice === null || lowPrice === null) return null;
            return ((highPrice - lowPrice) / openPrice) * 100;
          })
          .filter((value): value is number => value !== null && Number.isFinite(value));

        if (
          record.weekOpenPrice === null ||
          record.weekOpenPrice <= 0 ||
          record.weekClosePrice === null ||
          adrRanges.length < ADR_MIN_REQUIRED_DAYS
        ) {
          records.push(record);
          continue;
        }

        record.adrPct = adrRanges.reduce((sum, value) => sum + value, 0) / adrRanges.length;
        const thresholdPct = record.adrPct * ADR_MULTIPLIER;
        record.dipEntryPrice =
          direction === "LONG"
            ? record.weekOpenPrice * (1 - (thresholdPct / 100))
            : record.weekOpenPrice * (1 + (thresholdPct / 100));

        const dailyBars = await query<PriceBar>(
          `SELECT period_open_utc, high_price, low_price
           FROM pair_period_returns
           WHERE symbol = $1
             AND period_type = 'daily'
             AND period_open_utc >= $2::timestamptz
             AND period_open_utc < $3::timestamptz
           ORDER BY period_open_utc ASC`,
          [pair, weekOpenUtc, nextWeekOpenUtc],
        );

        record.eligible = dailyBars.length > 0;
        if (!record.eligible || record.dipEntryPrice === null) {
          records.push(record);
          continue;
        }

        record.fillBarIndex = findDipFillIndex(direction, record.dipEntryPrice, dailyBars);
        record.dipFilled = record.fillBarIndex !== null;

        if (record.dipFilled && record.fillBarIndex !== null) {
          const { returns, tpHits } = evaluateVariantReturns({
            direction,
            adrPct: record.adrPct,
            dipEntryPrice: record.dipEntryPrice,
            weekClosePrice: record.weekClosePrice,
            dailyBars,
            fillBarIndex: record.fillBarIndex,
          });
          record.variantReturns = returns;
          record.variantTpHit = tpHits;
        }

        records.push(record);
      }
    }
  }

  const combinedRecords = buildModeRecords(records, "COMBINED");
  const gatedRecords = buildModeRecords(records, "GATED");
  const nonGatedRecords = buildModeRecords(records, "NON_GATED");

  const modeTables: Array<{ title: string; records: TradeRecord[] }> = [
    { title: "COMBINED", records: combinedRecords },
    { title: "GATED (PASS / NO_DATA)", records: gatedRecords },
    { title: "NON-GATED (SKIP / REDUCE)", records: nonGatedRecords },
  ];

  console.log("\nUniverse Summary");
  console.log(renderMarkdownTable(
    ["Metric", "Value"],
    [
      ["Signals processed", String(records.length)],
      ["GATED signals", String(gatedRecords.length)],
      ["NON-GATED signals", String(nonGatedRecords.length)],
      ["Eligible ADR setups", String(combinedRecords.filter((record) => record.eligible).length)],
      ["Filled ADR setups", String(combinedRecords.filter((record) => record.dipFilled).length)],
    ],
  ));
  console.log("");
  console.log(renderMarkdownTable(["Gate Decision", "Signals"], buildGateDecisionSummary(records)));

  for (const modeTable of modeTables) {
    console.log(`\n${modeTable.title}`);
    console.log(renderMarkdownTable(
      ["Variant", "Trades", "Avg Return", "Total Return", "Win Rate", "Fill Rate"],
      buildComparisonRows(modeTable.records),
    ));
    console.log("");
    console.log(renderMarkdownTable(
      ["Week", "Eligible", "Filled", "Fill Rate", ...TP_VARIANTS.map((variant) => `${variant.shortLabel} Tot`)],
      buildPerWeekRows(modeTable.records, weekOpens),
    ));
  }

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
