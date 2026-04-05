/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: backtest-tiebreaker.ts
 *
 * Description:
 * Tests forced-direction (tiebreaker) mode for all 4 sources.
 * Instead of emitting NEUTRAL when the data is ambiguous, each source
 * is forced to pick a side using the underlying magnitude data:
 *
 *   COT (dealer/commercial): when both currencies have same bias,
 *     compare normalized net positioning (net / total OI) — stronger
 *     lean wins the relative direction.
 *
 *   Sentiment: when crowding is neutral (35-65% band), use agg_long_pct
 *     vs 50% to pick contrarian direction.
 *
 *   Strength: when composite score is 0 (tied windows), use raw spread
 *     sum across windows as tiebreaker.
 *
 * Compares raw (with neutrals) vs tiebreaker (no neutrals) per source.
 * Then shows how neutral count changes affect veto coverage.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import { DateTime } from "luxon";
import { listDataSectionWeeks } from "../src/lib/dataSectionWeeks";
import { deriveCotReportDate } from "../src/lib/dataSectionWeeks";
import { readSnapshot } from "../src/lib/cotStore";
import { getCanonicalBasketWeek, filterByModel } from "../src/lib/performance/basketSource";
import { getAggregatesForWeekStartWithBackfill } from "../src/lib/sentiment/store";
import { sentimentDirectionFromAggregate } from "../src/lib/sentiment/daily";
import { readWeeklyPairStrengths } from "../src/lib/strength/weeklyStrength";
import { loadWeeklyAdrMap, getAdrPct, getTargetAdrPct } from "../src/lib/performance/adrLookup";
import { getWeeklyPairReturns } from "../src/lib/pairReturns";
import { getDisplayWeekOpenUtc, normalizeWeekOpenUtc } from "../src/lib/weekAnchor";
import { PAIRS_BY_ASSET_CLASS } from "../src/lib/cotPairs";
import type { AssetClass } from "../src/lib/cotMarkets";
import type { MarketSnapshot } from "../src/lib/cotTypes";

type Direction = "LONG" | "SHORT";

function buildWeekLabel(weekOpenUtc: string) {
  return DateTime.fromISO(weekOpenUtc, { zone: "utc" }).toFormat("MMM dd");
}

// ─── COT tiebreaker ───────────────────────────────────────────────

type CotDirectionResult = {
  pair: string;
  assetClass: AssetClass;
  rawDirection: Direction | null;     // current system (null = neutral)
  tieDirection: Direction | null;     // tiebreaker (null only if truly missing data)
  tieBroken: boolean;                 // was this a tiebreaker override?
};

function normalizeLean(net: number, long: number, short: number): number {
  const total = long + short;
  return total > 0 ? net / total : 0;
}

function resolveCotDirections(
  currencies: Record<string, MarketSnapshot>,
  assetClass: AssetClass,
  mode: "dealer" | "commercial",
): CotDirectionResult[] {
  const pairDefs = PAIRS_BY_ASSET_CLASS[assetClass] ?? [];
  const results: CotDirectionResult[] = [];

  for (const pd of pairDefs) {
    const baseMarket = currencies[pd.base];
    const quoteMarket = currencies[pd.quote];

    if (!baseMarket || !quoteMarket) {
      results.push({ pair: pd.pair, assetClass, rawDirection: null, tieDirection: null, tieBroken: false });
      continue;
    }

    let baseNet: number;
    let baseLong: number;
    let baseShort: number;
    let quoteNet: number;
    let quoteLong: number;
    let quoteShort: number;

    if (mode === "dealer") {
      baseNet = baseMarket.dealer_net;
      baseLong = baseMarket.dealer_long;
      baseShort = baseMarket.dealer_short;
      quoteNet = quoteMarket.dealer_net;
      quoteLong = quoteMarket.dealer_long;
      quoteShort = quoteMarket.dealer_short;
    } else {
      baseNet = baseMarket.commercial_net ?? 0;
      baseLong = baseMarket.commercial_long ?? 0;
      baseShort = baseMarket.commercial_short ?? 0;
      quoteNet = quoteMarket.commercial_net ?? 0;
      quoteLong = quoteMarket.commercial_long ?? 0;
      quoteShort = quoteMarket.commercial_short ?? 0;
    }

    const baseBias = baseNet > 0 ? "BULLISH" : baseNet < 0 ? "BEARISH" : "NEUTRAL";
    const quoteBias = quoteNet > 0 ? "BULLISH" : quoteNet < 0 ? "BEARISH" : "NEUTRAL";

    // Standard direction (current system)
    let rawDirection: Direction | null = null;
    if (assetClass === "fx") {
      // FX: cross-currency
      if (baseBias !== "NEUTRAL" && quoteBias !== "NEUTRAL" && baseBias !== quoteBias) {
        rawDirection = baseBias === "BULLISH" ? "LONG" : "SHORT";
      }
    } else {
      // Non-FX: base only
      if (baseBias === "BULLISH") rawDirection = "LONG";
      else if (baseBias === "BEARISH") rawDirection = "SHORT";
    }

    // Tiebreaker direction
    let tieDirection: Direction | null = rawDirection;
    let tieBroken = false;

    if (rawDirection === null) {
      if (assetClass === "fx") {
        // Both same direction or one/both neutral — compare normalized lean
        const baseLean = normalizeLean(baseNet, baseLong, baseShort);
        const quoteLean = normalizeLean(quoteNet, quoteLong, quoteShort);

        if (baseBias === quoteBias && baseBias !== "NEUTRAL") {
          // Both same direction — who leans harder?
          const baseStrength = Math.abs(baseLean);
          const quoteStrength = Math.abs(quoteLean);
          if (baseStrength !== quoteStrength) {
            // Both BULLISH: stronger bullish = more bullish currency
            // If base is more bullish → LONG (base outperforms)
            // If quote is more bullish → SHORT (quote outperforms, pair falls)
            tieDirection = baseStrength > quoteStrength ? "LONG" : "SHORT";
            tieBroken = true;
          }
        } else if (baseBias === "NEUTRAL" || quoteBias === "NEUTRAL") {
          // One side neutral — use the non-neutral side
          if (baseBias === "BULLISH") { tieDirection = "LONG"; tieBroken = true; }
          else if (baseBias === "BEARISH") { tieDirection = "SHORT"; tieBroken = true; }
          else if (quoteBias === "BULLISH") { tieDirection = "SHORT"; tieBroken = true; }
          else if (quoteBias === "BEARISH") { tieDirection = "LONG"; tieBroken = true; }
        }
      } else {
        // Non-FX: base is neutral — use lean
        const baseLean = normalizeLean(baseNet, baseLong, baseShort);
        if (baseLean > 0) { tieDirection = "LONG"; tieBroken = true; }
        else if (baseLean < 0) { tieDirection = "SHORT"; tieBroken = true; }
      }
    }

    results.push({ pair: pd.pair, assetClass, rawDirection, tieDirection, tieBroken });
  }

  return results;
}

// ─── Sentiment tiebreaker ─────────────────────────────────────────

type SentimentDirectionResult = {
  pair: string;
  rawDirection: Direction | null;
  tieDirection: Direction | null;
  tieBroken: boolean;
  aggLongPct: number | null;
};

function resolveSentimentDirections(
  aggregates: Array<{ symbol: string; crowding_state: string; flip_state: string; agg_long_pct: number }>,
): SentimentDirectionResult[] {
  return aggregates.map((agg) => {
    const dir = sentimentDirectionFromAggregate(agg);
    const rawDirection: Direction | null = dir === "NEUTRAL" ? null : dir;

    let tieDirection: Direction | null = rawDirection;
    let tieBroken = false;

    if (rawDirection === null && agg.agg_long_pct !== null && agg.agg_long_pct !== 50) {
      // Crowd is slightly long → contrarian SHORT, slightly short → contrarian LONG
      tieDirection = agg.agg_long_pct > 50 ? "SHORT" : "LONG";
      tieBroken = true;
    }

    return { pair: agg.symbol, rawDirection, tieDirection, tieBroken, aggLongPct: agg.agg_long_pct };
  });
}

// ─── Main ─────────────────────────────────────────────────────────

type WeekEntry = { weekLabel: string; ret: number; trades: number; wins: number; losses: number };

function computeResults(entries: WeekEntry[]) {
  let cumulative = 0;
  let peak = 0;
  let maxDD = 0;
  for (const e of entries) {
    cumulative += e.ret;
    if (cumulative > peak) peak = cumulative;
    const dd = peak - cumulative;
    if (dd > maxDD) maxDD = dd;
  }
  const totalTrades = entries.reduce((s, e) => s + e.trades, 0);
  const totalWins = entries.reduce((s, e) => s + e.wins, 0);
  const losingWeeks = entries.filter((e) => e.ret < 0).length;
  const winningWeeks = entries.filter((e) => e.ret >= 0).length;
  const worstWeek = entries.length > 0 ? Math.min(...entries.map((e) => e.ret)) : 0;
  return { total: cumulative, maxDD, totalTrades, totalWins, losingWeeks, winningWeeks, worstWeek };
}

function printRow(label: string, entries: WeekEntry[], tiesBroken: number) {
  const r = computeResults(entries);
  const winRate = r.totalTrades > 0 ? (r.totalWins / r.totalTrades) * 100 : 0;
  console.log(
    "  " +
    label.padEnd(28) +
    String(r.totalTrades).padStart(8) +
    r.total.toFixed(2).padStart(10) +
    r.maxDD.toFixed(2).padStart(10) +
    (r.maxDD > 0 ? (r.total / r.maxDD).toFixed(1) : "∞").padStart(8) +
    `${winRate.toFixed(1)}`.padStart(8) +
    r.worstWeek.toFixed(2).padStart(10) +
    String(tiesBroken).padStart(10),
  );
}

async function main() {
  console.log("╔══════════════════════════════════════════════════════════════╗");
  console.log("║   Tiebreaker Mode — Force Direction (ADR Normalized)       ║");
  console.log("╚══════════════════════════════════════════════════════════════╝");

  const currentWeekOpenUtc = getDisplayWeekOpenUtc();
  const allWeeks = await listDataSectionWeeks();
  const weeks = allWeeks
    .sort((a, b) => a.localeCompare(b))
    .filter((w) => w < currentWeekOpenUtc);

  console.log(`\nWeeks: ${weeks.length} (${buildWeekLabel(weeks[0]!)} → ${buildWeekLabel(weeks.at(-1)!)})`);

  const targetAdr = getTargetAdrPct();
  const ASSET_CLASSES: AssetClass[] = ["fx", "indices", "commodities", "crypto"];

  // Systems
  const systemKeys = [
    "dealer_raw", "dealer_tie",
    "comm_raw", "comm_tie",
    "sent_raw", "sent_tie",
    "str_raw", "str_tie",
  ] as const;

  const systems: Record<string, WeekEntry[]> = {};
  for (const k of systemKeys) systems[k] = [];

  let dealerTies = 0, commTies = 0, sentTies = 0, strTies = 0;

  // Per-pair detail for one example week
  const detailWeekIdx = 0;
  const detailTrades: { source: string; pair: string; raw: string; tie: string; ret: number }[] = [];

  for (let wi = 0; wi < weeks.length; wi++) {
    const weekOpenUtc = weeks[wi]!;
    const weekLabel = buildWeekLabel(weekOpenUtc);
    const normalizedWeek = normalizeWeekOpenUtc(weekOpenUtc) ?? weekOpenUtc;
    const reportDate = deriveCotReportDate(normalizedWeek);

    // Use canonical basketSource for baseline (verified to match app)
    const basketWeek = await getCanonicalBasketWeek(weekOpenUtc);
    const weeklyReturns = await getWeeklyPairReturns(weekOpenUtc);
    const adrMap = await loadWeeklyAdrMap(weekOpenUtc);

    const returnMap = new Map<string, { returnPct: number; assetClass: string }>();
    for (const r of weeklyReturns) {
      returnMap.set(r.symbol.toUpperCase(), { returnPct: r.returnPct, assetClass: r.assetClass });
    }

    function getNormRet(pair: string, direction: Direction): number | null {
      const r = returnMap.get(pair.toUpperCase());
      if (!r) return null;
      const directed = direction === "SHORT" ? -r.returnPct : r.returnPct;
      const pairAdr = getAdrPct(adrMap, pair.toUpperCase(), r.assetClass);
      const multiplier = pairAdr > 0 ? targetAdr / pairAdr : 1;
      return directed * multiplier;
    }

    function addToAcc(key: string, ret: number) {
      weekAcc[key].ret += ret;
      weekAcc[key].trades++;
      if (ret > 0) weekAcc[key].wins++;
      else weekAcc[key].losses++;
    }

    const weekAcc: Record<string, { ret: number; trades: number; wins: number; losses: number }> = {};
    for (const k of systemKeys) weekAcc[k] = { ret: 0, trades: 0, wins: 0, losses: 0 };

    // ── COT (dealer + commercial) — use basketSource for baseline ──
    // Load raw snapshots for tiebreaker data only
    const cotSnapshots: Record<string, Record<string, MarketSnapshot>> = {};
    for (const ac of ASSET_CLASSES) {
      const snapshot = await readSnapshot({ assetClass: ac, reportDate });
      if (snapshot) cotSnapshots[ac] = snapshot.currencies;
    }

    for (const mode of ["dealer", "commercial"] as const) {
      const signals = filterByModel(basketWeek, mode);
      const rawKey = mode === "dealer" ? "dealer_raw" : "comm_raw";
      const tieKey = mode === "dealer" ? "dealer_tie" : "comm_tie";

      for (const sig of signals) {
        const pair = sig.symbol.toUpperCase();
        const ac = sig.assetClass as AssetClass;

        if (sig.direction !== "NEUTRAL") {
          // Non-neutral: same for raw and tiebreaker
          const ret = getNormRet(pair, sig.direction as Direction);
          if (ret !== null) {
            addToAcc(rawKey, ret);
            addToAcc(tieKey, ret);
          }
        } else {
          // NEUTRAL in raw — try tiebreaker from COT data
          const currencies = cotSnapshots[ac];
          if (currencies) {
            const pairDef = (PAIRS_BY_ASSET_CLASS[ac] ?? []).find((pd) => pd.pair === sig.symbol);
            if (pairDef) {
              const tieResults = resolveCotDirections(currencies, ac, mode);
              const tieResult = tieResults.find((r) => r.pair === sig.symbol);
              if (tieResult?.tieBroken && tieResult.tieDirection) {
                if (mode === "dealer") dealerTies++;
                else commTies++;
                const ret = getNormRet(pair, tieResult.tieDirection);
                if (ret !== null) {
                  addToAcc(tieKey, ret);
                  if (wi === detailWeekIdx) {
                    detailTrades.push({
                      source: mode, pair: sig.symbol, raw: "NEUTRAL",
                      tie: tieResult.tieDirection, ret,
                    });
                  }
                }
              }
            }
          }
        }
      }
    }

    // ── Sentiment — use basketSource for baseline, aggregates for tiebreaker ──
    const sentSignals = filterByModel(basketWeek, "sentiment");
    const open = DateTime.fromISO(weekOpenUtc, { zone: "utc" });
    const close = open.plus({ days: 7 });
    const aggregates = await getAggregatesForWeekStartWithBackfill(
      open.toUTC().toISO()!, close.toUTC().toISO()!,
    );
    const aggMap = new Map(aggregates.map((a) => [a.symbol.toUpperCase(), a]));

    for (const sig of sentSignals) {
      const pair = sig.symbol.toUpperCase();

      if (sig.direction !== "NEUTRAL") {
        const ret = getNormRet(pair, sig.direction as Direction);
        if (ret !== null) {
          addToAcc("sent_raw", ret);
          addToAcc("sent_tie", ret);
        }
      } else {
        // Tiebreaker: use agg_long_pct
        const agg = aggMap.get(pair);
        if (agg && agg.agg_long_pct !== 50) {
          const tieDir: Direction = agg.agg_long_pct > 50 ? "SHORT" : "LONG";
          sentTies++;
          const ret = getNormRet(pair, tieDir);
          if (ret !== null) {
            addToAcc("sent_tie", ret);
            if (wi === detailWeekIdx) {
              detailTrades.push({
                source: "sentiment", pair: sig.symbol,
                raw: `NEUTRAL (${agg.agg_long_pct.toFixed(1)}%)`,
                tie: tieDir, ret,
              });
            }
          }
        }
      }
    }

    // ── Strength ──
    const strengthRows = await readWeeklyPairStrengths(weekOpenUtc);
    for (const row of strengthRows) {
      const rawDir: Direction | null = row.compositeDirection === "NEUTRAL" ? null : row.compositeDirection;

      let tieDir: Direction | null = rawDir;
      let tieBroken = false;

      if (rawDir === null && row.compositeScore === 0) {
        const spreadSum = row.windows.reduce((sum, w) => sum + (w.signedSpread ?? 0), 0);
        if (spreadSum > 0) { tieDir = "LONG"; tieBroken = true; }
        else if (spreadSum < 0) { tieDir = "SHORT"; tieBroken = true; }
      }

      if (tieBroken) strTies++;

      if (rawDir) {
        const ret = getNormRet(row.pair, rawDir);
        if (ret !== null) {
          addToAcc("str_raw", ret);
          addToAcc("str_tie", ret);
        }
      } else if (tieDir) {
        const ret = getNormRet(row.pair, tieDir);
        if (ret !== null) {
          addToAcc("str_tie", ret);
          if (wi === detailWeekIdx) {
            detailTrades.push({
              source: "strength", pair: row.pair,
              raw: `NEUTRAL (score=${row.compositeScore})`,
              tie: tieDir, ret,
            });
          }
        }
      }
    }

    for (const k of systemKeys) {
      systems[k].push({ weekLabel, ...weekAcc[k] });
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // SECTION 1: Summary table
  // ═══════════════════════════════════════════════════════════════

  const header =
    "  " +
    "System".padEnd(28) +
    "Trades".padStart(8) +
    "Total %".padStart(10) +
    "Max DD %".padStart(10) +
    "R/DD".padStart(8) +
    "Win %".padStart(8) +
    "Worst Wk".padStart(10) +
    "Ties Brkn".padStart(10);

  console.log(`\n${"═".repeat(94)}`);
  console.log("  RAW vs TIEBREAKER — PER SOURCE");
  console.log(`${"═".repeat(94)}`);
  console.log(header);
  console.log(`  ${"─".repeat(90)}`);
  printRow("Dealer Raw", systems["dealer_raw"], 0);
  printRow("Dealer Tiebreaker", systems["dealer_tie"], dealerTies);
  console.log(`  ${"─".repeat(90)}`);
  printRow("Commercial Raw", systems["comm_raw"], 0);
  printRow("Commercial Tiebreaker", systems["comm_tie"], commTies);
  console.log(`  ${"─".repeat(90)}`);
  printRow("Sentiment Raw", systems["sent_raw"], 0);
  printRow("Sentiment Tiebreaker", systems["sent_tie"], sentTies);
  console.log(`  ${"─".repeat(90)}`);
  printRow("Strength Raw", systems["str_raw"], 0);
  printRow("Strength Tiebreaker", systems["str_tie"], strTies);

  // ═══════════════════════════════════════════════════════════════
  // SECTION 2: Coverage analysis — neutrals before vs after
  // ═══════════════════════════════════════════════════════════════

  console.log(`\n${"═".repeat(70)}`);
  console.log("  NEUTRAL REDUCTION");
  console.log(`${"═".repeat(70)}`);

  for (const [label, rawKey, tieKey, tieCount] of [
    ["Dealer", "dealer_raw", "dealer_tie", dealerTies],
    ["Commercial", "comm_raw", "comm_tie", commTies],
    ["Sentiment", "sent_raw", "sent_tie", sentTies],
    ["Strength", "str_raw", "str_tie", strTies],
  ] as const) {
    const rawTrades = systems[rawKey].reduce((s, e) => s + e.trades, 0);
    const tieTrades = systems[tieKey].reduce((s, e) => s + e.trades, 0);
    console.log(
      `  ${String(label).padEnd(14)} Raw: ${String(rawTrades).padStart(4)} trades → Tiebreaker: ${String(tieTrades).padStart(4)} trades (+${tieTrades - rawTrades} from ${tieCount} tiebreaks)`,
    );
  }

  // ═══════════════════════════════════════════════════════════════
  // SECTION 3: Example week — what tiebreaker decided
  // ═══════════════════════════════════════════════════════════════

  if (detailTrades.length > 0) {
    console.log(`\n${"═".repeat(80)}`);
    console.log(`  TIEBREAKER DECISIONS — ${buildWeekLabel(weeks[detailWeekIdx]!)}`);
    console.log(`${"═".repeat(80)}`);
    for (const t of detailTrades.sort((a, b) => a.source.localeCompare(b.source) || a.pair.localeCompare(b.pair))) {
      const marker = t.ret > 0 ? "✓" : "✗";
      console.log(
        `  ${marker} ${t.source.padEnd(12)} ${t.pair.padEnd(12)} ${t.raw.padEnd(24)} → ${t.tie.padEnd(6)} ${t.ret >= 0 ? "+" : ""}${t.ret.toFixed(3)}%`,
      );
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // SECTION 4: Weekly equity curves
  // ═══════════════════════════════════════════════════════════════

  console.log(`\n${"═".repeat(100)}`);
  console.log("  WEEKLY EQUITY CURVES — RAW vs TIEBREAKER");
  console.log(`${"═".repeat(100)}`);
  console.log(
    "  " +
    "Week".padEnd(10) +
    "D:Raw".padStart(8) + "D:Tie".padStart(8) +
    "  │" + "C:Raw".padStart(8) + "C:Tie".padStart(8) +
    "  │" + "S:Raw".padStart(8) + "S:Tie".padStart(8) +
    "  │" + "STR:Raw".padStart(8) + "STR:Tie".padStart(9),
  );
  console.log(`  ${"─".repeat(96)}`);

  let dRawCum = 0, dTieCum = 0, cRawCum = 0, cTieCum = 0;
  let sRawCum = 0, sTieCum = 0, stRawCum = 0, stTieCum = 0;

  for (let i = 0; i < weeks.length; i++) {
    const wl = buildWeekLabel(weeks[i]!);
    dRawCum += systems["dealer_raw"][i]!.ret;
    dTieCum += systems["dealer_tie"][i]!.ret;
    cRawCum += systems["comm_raw"][i]!.ret;
    cTieCum += systems["comm_tie"][i]!.ret;
    sRawCum += systems["sent_raw"][i]!.ret;
    sTieCum += systems["sent_tie"][i]!.ret;
    stRawCum += systems["str_raw"][i]!.ret;
    stTieCum += systems["str_tie"][i]!.ret;

    console.log(
      "  " +
      wl.padEnd(10) +
      dRawCum.toFixed(1).padStart(8) + dTieCum.toFixed(1).padStart(8) +
      "  │" + cRawCum.toFixed(1).padStart(8) + cTieCum.toFixed(1).padStart(8) +
      "  │" + sRawCum.toFixed(1).padStart(8) + sTieCum.toFixed(1).padStart(8) +
      "  │" + stRawCum.toFixed(1).padStart(8) + stTieCum.toFixed(1).padStart(9),
    );
  }

  console.log("\nDone.");
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
