/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: adrTradeScanner.ts
 *
 * Description:
 * Scans H1 candles for a single pair within a week and detects ADR trades
 * using the Fresh Start state machine. Used by both the backfill script
 * and the ongoing hourly cron to persist trades to the DB.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import type { BacktestTradeInsertRow } from "@/lib/performance/strategyBacktestStore";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export type AdrTradeDirection = "LONG" | "SHORT";

export type AdrTradeResult = {
  pair: string;
  assetClass: string;
  direction: AdrTradeDirection;
  weekOpenUtc: string;
  tradeNumber: number; // 1-based: 1st, 2nd, 3rd trade of the week
  entryPrice: number;
  tpPrice: number;
  entryUtc: string; // ISO timestamp of entry bar
  exitUtc: string | null; // ISO timestamp of exit bar (null if active)
  exitPrice: number | null;
  exitType: "TP_HIT" | "WEEK_CLOSE" | null; // null = still active
  anchorPrice: number; // weekHigh (LONG) or weekLow (SHORT) at entry time
  adrPct: number;
  returnPct: number | null; // null if active
  maePct: number | null; // max adverse excursion as % of entry price
  metadata?: Record<string, unknown>; // gamma context etc
};

export type H1Bar = {
  ts: number; // unix timestamp ms
  open: number;
  high: number;
  low: number;
  close: number;
};

export type ScanAdrTradesInput = {
  pair: string;
  assetClass: string;
  direction: AdrTradeDirection;
  weekOpenUtc: string;
  adrPct: number; // e.g. 0.63 meaning 0.63% — stored in metadata
  adrAbsoluteDistance?: number; // absolute price distance (matches PineScript indicator). If omitted, computed from adrPct + first bar open
  bars: H1Bar[]; // H1 candles for the week, sorted chronologically
  entryMultiple?: number; // default 1.0
  tpMultiple?: number; // default 0.25
  metadata?: Record<string, unknown>; // attached to every trade
};

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function tsToIso(ts: number): string {
  return new Date(ts).toISOString();
}

/* ------------------------------------------------------------------ */
/*  Core scan — Fresh Start ADR state machine                          */
/* ------------------------------------------------------------------ */

export function scanAdrTrades(input: ScanAdrTradesInput): AdrTradeResult[] {
  const {
    pair,
    assetClass,
    direction,
    weekOpenUtc,
    adrPct,
    adrAbsoluteDistance,
    bars,
    entryMultiple = 1.0,
    tpMultiple = 0.25,
    metadata,
  } = input;

  if (bars.length === 0) return [];

  // Use absolute distance if provided (matches PineScript indicator), otherwise fallback to pct-based
  const adrDistance = adrAbsoluteDistance !== undefined
    ? adrAbsoluteDistance * entryMultiple
    : bars[0]!.open * (adrPct * entryMultiple) / 100;
  const results: AdrTradeResult[] = [];

  let anchor: number | null = null;
  let inTrade = false;
  let tradeNumber = 0;

  let entryPrice = 0;
  let tpPrice = 0;
  let entryTs = 0;
  let maePrice = 0;
  let currentAnchor = 0; // anchor at time of entry, stored for the result

  for (let i = 0; i < bars.length; i += 1) {
    const bar = bars[i]!;

    /* ---- IN TRADE ---- */
    if (inTrade) {
      // Update MAE
      maePrice =
        direction === "LONG"
          ? Math.min(maePrice, bar.low)
          : Math.max(maePrice, bar.high);

      // Check TP
      const tpHit =
        direction === "LONG" ? bar.high >= tpPrice : bar.low <= tpPrice;

      if (tpHit) {
        results.push({
          pair,
          assetClass,
          direction,
          weekOpenUtc,
          tradeNumber,
          entryPrice,
          tpPrice,
          entryUtc: tsToIso(entryTs),
          exitUtc: tsToIso(bar.ts),
          exitPrice: tpPrice,
          exitType: "TP_HIT",
          anchorPrice: currentAnchor,
          adrPct,
          returnPct: tpMultiple * adrPct,
          maePct: Math.abs(maePrice - entryPrice) / entryPrice * 100,
          metadata,
        });
        inTrade = false;
        anchor = null; // Fresh Start
        continue;
      }
      continue;
    }

    /* ---- TRACKING PHASE ---- */
    if (anchor === null) {
      // Seed from current bar — no trigger allowed on seed bar
      anchor = direction === "LONG" ? bar.high : bar.low;
      continue;
    }

    // Snapshot anchor BEFORE updating — prevents circular dependency
    // where current bar's high/low influences anchor AND triggers on same bar
    const prevAnchor = anchor;
    anchor =
      direction === "LONG"
        ? Math.max(anchor, bar.high)
        : Math.min(anchor, bar.low);

    // Compute entry and TP from PREVIOUS bar's anchor
    const ep =
      direction === "LONG" ? prevAnchor - adrDistance : prevAnchor + adrDistance;
    const tp =
      direction === "LONG"
        ? ep + adrDistance * tpMultiple
        : ep - adrDistance * tpMultiple;

    // Check trigger
    const triggerHit =
      direction === "LONG" ? bar.low <= ep : bar.high >= ep;

    if (triggerHit) {
      entryPrice = ep;
      tpPrice = tp;
      entryTs = bar.ts;
      currentAnchor = anchor;
      inTrade = true;
      tradeNumber += 1;
      maePrice =
        direction === "LONG"
          ? Math.min(ep, bar.low)
          : Math.max(ep, bar.high);

      // Check same-bar TP
      const sameBarTp =
        direction === "LONG" ? bar.high >= tpPrice : bar.low <= tpPrice;

      if (sameBarTp) {
        results.push({
          pair,
          assetClass,
          direction,
          weekOpenUtc,
          tradeNumber,
          entryPrice,
          tpPrice,
          entryUtc: tsToIso(entryTs),
          exitUtc: tsToIso(bar.ts),
          exitPrice: tpPrice,
          exitType: "TP_HIT",
          anchorPrice: currentAnchor,
          adrPct,
          returnPct: tpMultiple * adrPct,
          maePct: Math.abs(maePrice - entryPrice) / entryPrice * 100,
          metadata,
        });
        inTrade = false;
        anchor = null; // Fresh Start
      }
    }
  }

  /* ---- Active trade at end of bars — leave open ---- */
  if (inTrade) {
    results.push({
      pair,
      assetClass,
      direction,
      weekOpenUtc,
      tradeNumber,
      entryPrice,
      tpPrice,
      entryUtc: tsToIso(entryTs),
      exitUtc: null,
      exitPrice: null,
      exitType: null,
      anchorPrice: currentAnchor,
      adrPct,
      returnPct: null,
      maePct: null,
      metadata,
    });
  }

  return results;
}

/* ------------------------------------------------------------------ */
/*  DB row converter                                                   */
/* ------------------------------------------------------------------ */

export function toBacktestTradeRows(
  trades: AdrTradeResult[],
): BacktestTradeInsertRow[] {
  return trades.map((trade) => ({
    weekOpenUtc: trade.weekOpenUtc,
    symbol: trade.pair,
    direction: trade.direction,
    entryTimeUtc: trade.entryUtc,
    exitTimeUtc: trade.exitUtc,
    entryPrice: trade.entryPrice,
    exitPrice: trade.exitPrice,
    pnlPct: trade.returnPct,
    exitReason:
      trade.exitType === "TP_HIT"
        ? "tp"
        : trade.exitType === "WEEK_CLOSE"
          ? "week_close"
          : "active",
    metadata: {
      ...trade.metadata,
      assetClass: trade.assetClass,
      tradeNumber: trade.tradeNumber,
      anchorPrice: trade.anchorPrice,
      adrPct: trade.adrPct,
      tpPrice: trade.tpPrice,
      maePct: trade.maePct,
    },
  }));
}
