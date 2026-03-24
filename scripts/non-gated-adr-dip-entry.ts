/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: non-gated-adr-dip-entry.ts
 *
 * Description:
 * Tests ADR dip-entry as a conditional filter for NON-GATED tiered V3 signals.
 * For each of the last 9 completed weeks:
 *   1. Gets ALL tiered_v3 signals (before gating) via computeTieredWeekForSystem
 *   2. Evaluates gates → splits into PASS vs non-PASS (SKIP/REDUCE/NO_DATA)
 *   3. For non-PASS signals, checks if an ADR dip entry would have filled
 *   4. Calculates returns: gated (week-open), non-gated (dip entry), combined
 *
 * Two-tier hypothesis:
 *   Tier A (Gated PASS)  → enter at week open, hold to close
 *   Tier B (Non-gated)   → enter only if ADR dip fills during week, hold to close
 *
 * Since non-gated trades are currently skipped entirely, any ADR fill is pure
 * bonus alpha with zero opportunity cost.
 *
 * Usage: .\node_modules\.bin\tsx.cmd scripts/non-gated-adr-dip-entry.ts
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import { readFileSync } from "node:fs";
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

import { query } from "@/lib/db";
import { DateTime } from "luxon";
import { getCanonicalWeekOpenUtc } from "@/lib/weekAnchor";
import { computeTieredWeekForSystem } from "@/lib/performance/tiered";
import {
  buildGateMap,
  buildCotGateContext,
  evaluatePairWithGate,
} from "@/lib/performance/gateEvaluation";

/* ─── Constants ─── */
const LOOKBACK_WEEKS = 9;
const ADR_LOOKBACK_DAYS = 10;
const ADR_MIN_REQUIRED_DAYS = 5;
const ADR_MULTIPLIER = 1.0;

/* ─── Types ─── */
const MODEL_TO_TIER: Record<string, string | null> = {
  antikythera: null,
  antikythera_v2: null,
  antikythera_v3: "HIGH",
  blended: null,
  dealer: "MEDIUM",
  commercial: "LOW",
  sentiment: null,
};

type SignalRecord = {
  week: string;
  weekLabel: string;
  pair: string;
  direction: "LONG" | "SHORT";
  tier: string;
  model: string;
  assetClass: string;
  gateDecision: string;
  gateReasons: string[];
  weekOpenReturn: number | null;
  adrPct: number | null;
  dipEntryPrice: number | null;
  dipFilled: boolean;
  dipEntryReturn: number | null;
};

/* ─── Helpers ─── */
function buildCompletedWeekOpens(count: number): string[] {
  const now = DateTime.utc();
  const currentWeekOpen = getCanonicalWeekOpenUtc(now);
  const currentWeekOpenDt = DateTime.fromISO(currentWeekOpen, { zone: "utc" });
  const lastCompleted = currentWeekOpenDt.minus({ weeks: 1 });
  const weeks: string[] = [];
  for (let i = count - 1; i >= 0; i--) {
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

function toFinite(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function fmtPct(v: number | null, width = 0): string {
  if (v === null || !Number.isFinite(v)) return "—".padStart(width);
  const sign = v > 0 ? "+" : "";
  return `${sign}${v.toFixed(2)}%`.padStart(width);
}

/* ─── Main ─── */
async function main() {
  const weekOpens = buildCompletedWeekOpens(LOOKBACK_WEEKS);
  console.log(`\nADR Dip-Entry Analysis on NON-GATED Signals`);
  console.log(`${weekOpens.length} completed weeks | ADR ${ADR_LOOKBACK_DAYS}-day lookback | ${ADR_MULTIPLIER}x multiplier`);
  console.log(`All asset classes: FX, Indices, Commodities, Crypto\n`);

  // Load gate artifacts once
  console.log("Loading gate artifacts...");
  const gateMap = buildGateMap();
  const cotContext = await buildCotGateContext();

  console.log("Ready.\n");

  const gatedSignals: SignalRecord[] = [];
  const nonGatedSignals: SignalRecord[] = [];

  for (const weekOpenUtc of weekOpens) {
    const label = weekLabel(weekOpenUtc);
    console.log(`Processing ${label} (${weekOpenUtc})...`);

    // Get ALL tiered V3 signals before gating
    let computed;
    try {
      computed = await computeTieredWeekForSystem({ weekOpenUtc, system: "v3" });
    } catch (err) {
      console.log(`  ⚠ Failed: ${err}`);
      continue;
    }
    if (!computed) { console.log(`  ⚠ No data`); continue; }

    // Build pair → assetClass map from perAsset grouping
    const pairToAssetClass = new Map<string, string>();
    for (const [assetClass, models] of Object.entries(computed.perAsset)) {
      for (const modelRow of models) {
        for (const detail of (modelRow as any).pair_details ?? []) {
          pairToAssetClass.set(detail.pair.toUpperCase(), assetClass);
        }
      }
    }

    // Next week open for daily bar windowing
    const nextWeekOpenDt = DateTime.fromISO(weekOpenUtc, { zone: "utc" }).plus({ weeks: 1 });
    const nextWeekOpenUtc = nextWeekOpenDt.toISO()!;

    // Process all signals from combined (pre-gated)
    for (const modelRow of computed.combined) {
      const tier = MODEL_TO_TIER[modelRow.model];
      if (!tier) continue;

      for (const detail of (modelRow as any).pair_details ?? []) {
        const pair = (detail.pair as string).toUpperCase();
        const direction = detail.direction as string;
        if (direction !== "LONG" && direction !== "SHORT") continue;

        const assetClass = pairToAssetClass.get(pair) ?? "fx";

        // Evaluate gate (matching flagship behavior: reduceAsSkip=true)
        let gate: { decision: string; reasons: string[] };
        try {
          gate = evaluatePairWithGate({
            pair,
            weekOpenUtc,
            direction: direction as "LONG" | "SHORT",
            assetClass: assetClass as "fx" | "indices" | "crypto" | "commodities",
            gateMap,
            cotContext,
            reduceAsSkip: true,
          });
        } catch {
          gate = { decision: "NO_DATA", reasons: ["gate_eval_error"] };
        }

        const isPass = gate.decision === "PASS";

        // Get weekly OHLC
        const weeklyRows = await query<{ open_price: string; close_price: string }>(
          `SELECT open_price, close_price
           FROM pair_period_returns
           WHERE symbol = $1 AND period_type = 'weekly'
           AND period_open_utc >= $2::timestamptz
           AND period_open_utc < $3::timestamptz
           ORDER BY period_open_utc ASC LIMIT 1`,
          [pair, weekOpenUtc, nextWeekOpenUtc],
        );

        const weekOpen = toFinite(weeklyRows[0]?.open_price);
        const weekClose = toFinite(weeklyRows[0]?.close_price);

        // Week-open return (signed by direction)
        let weekOpenReturn: number | null = null;
        if (weekOpen && weekClose && weekOpen > 0) {
          const rawPct = ((weekClose - weekOpen) / weekOpen) * 100;
          weekOpenReturn = direction === "LONG" ? rawPct : -rawPct;
        }

        // ADR + dip analysis (only for non-gated signals)
        let adrPct: number | null = null;
        let dipEntryPrice: number | null = null;
        let dipFilled = false;
        let dipEntryReturn: number | null = null;

        if (!isPass && weekOpen && weekOpen > 0) {
          // Compute ADR from 10-day lookback
          const adrRows = await query<{ open_price: string; high_price: string; low_price: string }>(
            `SELECT open_price, high_price, low_price
             FROM pair_period_returns
             WHERE symbol = $1 AND period_type = 'daily'
             AND period_open_utc < $2::timestamptz
             ORDER BY period_open_utc DESC LIMIT $3`,
            [pair, weekOpenUtc, ADR_LOOKBACK_DAYS],
          );

          const adrRanges = adrRows
            .map((r: any) => {
              const o = toFinite(r.open_price);
              const h = toFinite(r.high_price);
              const l = toFinite(r.low_price);
              if (!o || o <= 0 || h === null || l === null) return null;
              return ((h - l) / o) * 100;
            })
            .filter((v: any): v is number => v !== null && Number.isFinite(v));

          if (adrRanges.length >= ADR_MIN_REQUIRED_DAYS) {
            adrPct = adrRanges.reduce((a: number, b: number) => a + b, 0) / adrRanges.length;
            const thresholdPct = adrPct * ADR_MULTIPLIER;

            // Dip entry: LONG → price drops 1 ADR, SHORT → price rises 1 ADR
            dipEntryPrice = direction === "LONG"
              ? weekOpen * (1 - thresholdPct / 100)
              : weekOpen * (1 + thresholdPct / 100);

            // Check if dip was hit during the week
            const dailyBars = await query<{ high_price: string; low_price: string }>(
              `SELECT high_price, low_price
               FROM pair_period_returns
               WHERE symbol = $1 AND period_type = 'daily'
               AND period_open_utc >= $2::timestamptz
               AND period_open_utc < $3::timestamptz
               ORDER BY period_open_utc ASC`,
              [pair, weekOpenUtc, nextWeekOpenUtc],
            );

            for (const bar of dailyBars) {
              const barHigh = toFinite(bar.high_price);
              const barLow = toFinite(bar.low_price);
              if (barHigh === null || barLow === null) continue;
              if (direction === "LONG" && barLow <= dipEntryPrice) { dipFilled = true; break; }
              if (direction === "SHORT" && barHigh >= dipEntryPrice) { dipFilled = true; break; }
            }

            // Return from dip entry to week close
            if (dipFilled && weekClose && dipEntryPrice > 0) {
              const rawPct = ((weekClose - dipEntryPrice) / dipEntryPrice) * 100;
              dipEntryReturn = direction === "LONG" ? rawPct : -rawPct;
            }
          }
        }

        const record: SignalRecord = {
          week: weekOpenUtc, weekLabel: label, pair, direction: direction as "LONG" | "SHORT",
          tier, model: modelRow.model, assetClass,
          gateDecision: gate.decision, gateReasons: gate.reasons,
          weekOpenReturn, adrPct, dipEntryPrice, dipFilled, dipEntryReturn,
        };

        if (isPass) gatedSignals.push(record);
        else nonGatedSignals.push(record);
      }
    }
  }

  const allSignals = [...gatedSignals, ...nonGatedSignals];

  // ═══════════════════════════════════════════════════════════════
  // OVERVIEW
  // ═══════════════════════════════════════════════════════════════
  console.log("\n" + "═".repeat(100));
  console.log("OVERVIEW");
  console.log("═".repeat(100));
  console.log(`Total signals across ${LOOKBACK_WEEKS} weeks: ${allSignals.length}`);
  console.log(`  Gated (PASS):     ${gatedSignals.length}`);
  console.log(`  Non-gated:        ${nonGatedSignals.length}`);
  console.log(`    SKIP:           ${nonGatedSignals.filter(s => s.gateDecision === "SKIP").length}`);
  console.log(`    REDUCE:         ${nonGatedSignals.filter(s => s.gateDecision === "REDUCE").length}`);
  console.log(`    NO_DATA:        ${nonGatedSignals.filter(s => s.gateDecision === "NO_DATA").length}`);

  const ngWithAdr = nonGatedSignals.filter(s => s.adrPct !== null);
  const ngFilled = nonGatedSignals.filter(s => s.dipFilled);
  console.log(`\n  ADR computed:     ${ngWithAdr.length}`);
  console.log(`  ADR dip filled:   ${ngFilled.length} (${ngWithAdr.length > 0 ? ((ngFilled.length / ngWithAdr.length) * 100).toFixed(1) : 0}%)`);
  console.log(`  ADR dip missed:   ${ngWithAdr.length - ngFilled.length}`);

  // ═══════════════════════════════════════════════════════════════
  // TIER A — GATED PASS (week-open entry)
  // ═══════════════════════════════════════════════════════════════
  console.log("\n" + "═".repeat(100));
  console.log("TIER A — GATED PASS (Week-Open Entry, Current Behavior)");
  console.log("═".repeat(100));
  const gRet = gatedSignals.map(s => s.weekOpenReturn).filter((r): r is number => r !== null);
  if (gRet.length > 0) {
    const avg = gRet.reduce((a, b) => a + b, 0) / gRet.length;
    const total = gRet.reduce((a, b) => a + b, 0);
    const wins = gRet.filter(r => r > 0).length;
    console.log(`  Trades:     ${gRet.length}`);
    console.log(`  Avg return: ${fmtPct(avg)}`);
    console.log(`  Total:      ${fmtPct(total)}`);
    console.log(`  Win rate:   ${((wins / gRet.length) * 100).toFixed(1)}%`);
    console.log(`  Best:       ${fmtPct(Math.max(...gRet))}`);
    console.log(`  Worst:      ${fmtPct(Math.min(...gRet))}`);
  }

  // ═══════════════════════════════════════════════════════════════
  // TIER B — NON-GATED (ADR dip entry)
  // ═══════════════════════════════════════════════════════════════
  console.log("\n" + "═".repeat(100));
  console.log("TIER B — NON-GATED (ADR Dip Entry, Currently Skipped)");
  console.log("═".repeat(100));
  const dRet = ngFilled.map(s => s.dipEntryReturn).filter((r): r is number => r !== null);
  if (dRet.length > 0) {
    const avg = dRet.reduce((a, b) => a + b, 0) / dRet.length;
    const total = dRet.reduce((a, b) => a + b, 0);
    const wins = dRet.filter(r => r > 0).length;
    console.log(`  Filled:     ${dRet.length} of ${ngWithAdr.length} (${((dRet.length / ngWithAdr.length) * 100).toFixed(1)}%)`);
    console.log(`  Avg return: ${fmtPct(avg)}`);
    console.log(`  Total:      ${fmtPct(total)}`);
    console.log(`  Win rate:   ${((wins / dRet.length) * 100).toFixed(1)}%`);
    console.log(`  Best:       ${fmtPct(Math.max(...dRet))}`);
    console.log(`  Worst:      ${fmtPct(Math.min(...dRet))}`);
  } else {
    console.log("  No filled ADR dip entries.");
  }

  // ═══════════════════════════════════════════════════════════════
  // BASELINE: Non-gated at week-open (if gate was ignored)
  // ═══════════════════════════════════════════════════════════════
  console.log("\n" + "═".repeat(100));
  console.log("BASELINE: NON-GATED AT WEEK-OPEN (If Gate Was Ignored)");
  console.log("═".repeat(100));
  const ngWoRet = nonGatedSignals.map(s => s.weekOpenReturn).filter((r): r is number => r !== null);
  if (ngWoRet.length > 0) {
    const avg = ngWoRet.reduce((a, b) => a + b, 0) / ngWoRet.length;
    const total = ngWoRet.reduce((a, b) => a + b, 0);
    const wins = ngWoRet.filter(r => r > 0).length;
    console.log(`  Trades:     ${ngWoRet.length}`);
    console.log(`  Avg return: ${fmtPct(avg)}`);
    console.log(`  Total:      ${fmtPct(total)}`);
    console.log(`  Win rate:   ${((wins / ngWoRet.length) * 100).toFixed(1)}%`);
  }

  // ═══════════════════════════════════════════════════════════════
  // COMBINED TWO-TIER SYSTEM
  // ═══════════════════════════════════════════════════════════════
  console.log("\n" + "═".repeat(100));
  console.log("COMBINED TWO-TIER SYSTEM (Gated@Open + NonGated@ADR)");
  console.log("═".repeat(100));
  const combinedRet = [...gRet, ...dRet];
  if (combinedRet.length > 0) {
    const avg = combinedRet.reduce((a, b) => a + b, 0) / combinedRet.length;
    const total = combinedRet.reduce((a, b) => a + b, 0);
    const wins = combinedRet.filter(r => r > 0).length;
    console.log(`  Total trades: ${combinedRet.length} (${gRet.length} gated + ${dRet.length} ADR fills)`);
    console.log(`  Avg return:   ${fmtPct(avg)}`);
    console.log(`  Total:        ${fmtPct(total)}`);
    console.log(`  Win rate:     ${((wins / combinedRet.length) * 100).toFixed(1)}%`);
  }

  // vs gated-only delta
  if (gRet.length > 0 && combinedRet.length > 0) {
    const gatedTotal = gRet.reduce((a, b) => a + b, 0);
    const combinedTotal = combinedRet.reduce((a, b) => a + b, 0);
    const delta = combinedTotal - gatedTotal;
    console.log(`\n  Delta vs gated-only: ${fmtPct(delta)} additional return from ADR fills`);
  }

  // ═══════════════════════════════════════════════════════════════
  // PER-WEEK BREAKDOWN
  // ═══════════════════════════════════════════════════════════════
  console.log("\n" + "═".repeat(110));
  console.log("PER-WEEK BREAKDOWN");
  console.log("═".repeat(110));
  console.log(
    "WEEK".padEnd(10) +
    "GATED".padStart(7) + "G.AVG".padStart(9) + "G.TOT".padStart(9) +
    "  │" +
    "NON-G".padStart(7) + "FILL".padStart(6) + "D.AVG".padStart(9) + "D.TOT".padStart(9) +
    "  │" +
    "COMB.TOT".padStart(10)
  );
  console.log("─".repeat(110));

  for (const wo of weekOpens) {
    const wl = weekLabel(wo);
    const wg = gatedSignals.filter(s => s.week === wo);
    const wng = nonGatedSignals.filter(s => s.week === wo);
    const wf = wng.filter(s => s.dipFilled);

    const gr = wg.map(s => s.weekOpenReturn).filter((r): r is number => r !== null);
    const dr = wf.map(s => s.dipEntryReturn).filter((r): r is number => r !== null);
    const all = [...gr, ...dr];

    const gAvg = gr.length > 0 ? gr.reduce((a, b) => a + b, 0) / gr.length : null;
    const gTot = gr.length > 0 ? gr.reduce((a, b) => a + b, 0) : null;
    const dAvg = dr.length > 0 ? dr.reduce((a, b) => a + b, 0) / dr.length : null;
    const dTot = dr.length > 0 ? dr.reduce((a, b) => a + b, 0) : null;
    const cTot = all.length > 0 ? all.reduce((a, b) => a + b, 0) : null;

    console.log(
      wl.padEnd(10) +
      String(wg.length).padStart(7) + fmtPct(gAvg, 9) + fmtPct(gTot, 9) +
      "  │" +
      String(wng.length).padStart(7) + String(wf.length).padStart(6) + fmtPct(dAvg, 9) + fmtPct(dTot, 9) +
      "  │" +
      fmtPct(cTot, 10)
    );
  }

  // ═══════════════════════════════════════════════════════════════
  // NON-GATED FILLED TRADES (detail)
  // ═══════════════════════════════════════════════════════════════
  console.log("\n" + "═".repeat(130));
  console.log("NON-GATED FILLED TRADES (detail)");
  console.log("═".repeat(130));
  console.log(
    "WEEK".padEnd(10) + "PAIR".padEnd(12) + "DIR".padEnd(7) + "TIER".padEnd(7) +
    "CLASS".padEnd(8) + "GATE".padEnd(10) +
    "ADR%".padStart(8) + "WK-OPEN".padStart(10) + "DIP-RET".padStart(10) +
    "  GATE REASONS"
  );
  console.log("─".repeat(130));

  for (const s of ngFilled.sort((a, b) => a.week.localeCompare(b.week) || a.pair.localeCompare(b.pair))) {
    console.log(
      s.weekLabel.padEnd(10) + s.pair.padEnd(12) + s.direction.padEnd(7) + s.tier.padEnd(7) +
      s.assetClass.padEnd(8) + s.gateDecision.padEnd(10) +
      (s.adrPct !== null ? `${s.adrPct.toFixed(2)}%` : "—").padStart(8) +
      fmtPct(s.weekOpenReturn, 10) + fmtPct(s.dipEntryReturn, 10) +
      `  ${s.gateReasons.join(", ")}`
    );
  }

  // ═══════════════════════════════════════════════════════════════
  // NON-GATED BY ASSET CLASS
  // ═══════════════════════════════════════════════════════════════
  console.log("\n" + "═".repeat(80));
  console.log("NON-GATED BY ASSET CLASS");
  console.log("═".repeat(80));

  const assetClasses = [...new Set(nonGatedSignals.map(s => s.assetClass))].sort();
  for (const ac of assetClasses) {
    const acSigs = nonGatedSignals.filter(s => s.assetClass === ac);
    const acAdr = acSigs.filter(s => s.adrPct !== null);
    const acFilled = acSigs.filter(s => s.dipFilled);
    const acDipRet = acFilled.map(s => s.dipEntryReturn).filter((r): r is number => r !== null);
    const acWoRet = acSigs.map(s => s.weekOpenReturn).filter((r): r is number => r !== null);

    console.log(`\n  ${ac.toUpperCase()}`);
    console.log(`    Non-gated:    ${acSigs.length}`);
    console.log(`    ADR computed: ${acAdr.length}`);
    console.log(`    Dip filled:   ${acFilled.length} (${acAdr.length > 0 ? ((acFilled.length / acAdr.length) * 100).toFixed(1) : 0}%)`);

    if (acDipRet.length > 0) {
      const avg = acDipRet.reduce((a, b) => a + b, 0) / acDipRet.length;
      const total = acDipRet.reduce((a, b) => a + b, 0);
      const wins = acDipRet.filter(r => r > 0).length;
      console.log(`    Dip avg ret:  ${fmtPct(avg)}`);
      console.log(`    Dip total:    ${fmtPct(total)}`);
      console.log(`    Dip win rate: ${((wins / acDipRet.length) * 100).toFixed(1)}%`);
    }
    if (acWoRet.length > 0) {
      const woAvg = acWoRet.reduce((a, b) => a + b, 0) / acWoRet.length;
      const woTotal = acWoRet.reduce((a, b) => a + b, 0);
      console.log(`    Wk-open avg:  ${fmtPct(woAvg)} (if gate ignored)`);
      console.log(`    Wk-open tot:  ${fmtPct(woTotal)}`);
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // CRYPTO DETAIL (BTC/ETH)
  // ═══════════════════════════════════════════════════════════════
  const cryptoSigs = nonGatedSignals.filter(s => s.assetClass === "crypto");
  if (cryptoSigs.length > 0) {
    console.log("\n" + "═".repeat(110));
    console.log("CRYPTO NON-GATED DETAIL (BTC/ETH)");
    console.log("═".repeat(110));
    console.log(
      "WEEK".padEnd(10) + "PAIR".padEnd(12) + "DIR".padEnd(7) +
      "GATE".padEnd(10) + "ADR%".padStart(8) +
      "WK-OPEN".padStart(10) + "FILLED".padStart(8) + "DIP-RET".padStart(10) +
      "  REASONS"
    );
    console.log("─".repeat(110));

    for (const s of cryptoSigs.sort((a, b) => a.week.localeCompare(b.week) || a.pair.localeCompare(b.pair))) {
      console.log(
        s.weekLabel.padEnd(10) + s.pair.padEnd(12) + s.direction.padEnd(7) +
        s.gateDecision.padEnd(10) +
        (s.adrPct !== null ? `${s.adrPct.toFixed(2)}%` : "—").padStart(8) +
        fmtPct(s.weekOpenReturn, 10) +
        (s.dipFilled ? "YES" : "NO").padStart(8) +
        fmtPct(s.dipEntryReturn, 10) +
        `  ${s.gateReasons.join(", ")}`
      );
    }
  }

  console.log("\nDone.");
  process.exit(0);
}

main().catch((error) => {
  console.error("Fatal:", error);
  process.exit(1);
});
