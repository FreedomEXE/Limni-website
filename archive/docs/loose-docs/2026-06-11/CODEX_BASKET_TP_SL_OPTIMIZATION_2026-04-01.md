# Codex Prompt: Basket TP + SL Optimization

**Date:** 2026-04-01
**Author:** Nyx (session handoff to Codex)
**Priority:** HIGH — Research task, find optimal basket exit config

---

## Context

We've been testing basket-level take profit and trailing stops for weekly hold strategies with ADR normalization. Results so far are inconclusive — no single configuration works across all strategies. The missing piece is a **basket-level stop loss** combined with TP/trailing.

### What exists already

Scripts in `scripts/` (read these for reference, reuse their patterns):
- `backtest-basket-adr-tp-all-strategies.ts` — Dynamic basket TP (0.25% × trade count), tests fixed TP across all strategies
- `backtest-basket-trailing-stop.ts` — Trailing stop variations (Dealer/Sentiment/Strength)
- `backtest-basket-tp-final.ts` — Pure TP vs Pure Trail vs Hybrid (50% TP + 50% trail) comparison
- `backtest-adr-normalization.ts` — ADR normalization across all combos (reference for engine usage)

### Key findings so far

1. **ADR normalization is always on** — use engine with `f2=adr_normalized` overlay for app parity
2. **Dynamic TP = 0.25% × trade_count** per week (scales with basket size)
3. **Trailing stop**: activate at 0.25 × basket_ADR, trail distance = fraction × basket_ADR
4. **Pure trail (0.20 distance) is best for Dealer** (+86% vs +73% baseline, 9.5x R/DD)
5. **Trail hurts Strength** (choppy winning weeks get stopped out prematurely)
6. **Sentiment has 4-5 losing weeks** that no TP/trail can fix — they go negative from Day 1
7. **Hybrid (close 50%, trail 50%) underperforms pure trail** across all strategies
8. **Stop loss has NOT been tested yet** — this is the gap

### Parity reference (engine f2=adr_normalized baselines)

| Strategy | Engine Net | Engine DD |
|----------|-----------|-----------|
| Dealer | +73.18% | -2.19% |
| Sentiment | +92.40% | -19.56% |
| Strength | +80.89% | -14.98% |
| Tiered V3 | +96.79% | -19.57% |
| 2-of-3 Agree | +59.83% | -4.82% |
| Selector | +76.50% | -14.99% |

---

## Task: Comprehensive Basket TP + SL Grid Search

### Goal

Find **one standard basket exit configuration** (TP + trailing + SL) that improves risk-adjusted returns across ALL strategies. The config should be a single set of parameters that gets added to the app as a new Filter 1 entry style.

### Architecture

Write a single script: `scripts/backtest-basket-exit-grid.ts`

Use the exact same patterns as the existing scripts:
- Load weeks from DB (`strategy_backtest_trades WHERE run_id = 54`)
- Run engine with `computeMultiWeekHold(strategy, WEEKS, entryStyle, overlay)` where overlay = `getStrengthGate("adr_normalized")`
- Load daily bars from `canonical_price_bars` for intra-week P&L tracking
- Use `loadWeeklyAdrMap` + `getAdrPct` from `src/lib/performance/adrLookup.ts` for ADR (same source as engine)
- Compute normalized basket P&L daily path using multiplier = `targetAdr / pairAdr`

### Parameters to grid search

All parameters are expressed as fractions of **basket_ADR** (= 1% × trade_count):

```
basket_adr = 1.0 * trade_count  // e.g., 24 trades → 24%

// Take Profit
tp_frac: [0.15, 0.20, 0.25, 0.30]  // activation level as fraction of basket_ADR
// 0.25 × 24% = 6% TP for 24 trades

// Trailing Stop (only active after TP hit)
trail_frac: [0, 0.15, 0.20, 0.25, 0.30]  // 0 = no trail (pure TP, close all at activation)
// trail distance = trail_frac × basket_ADR

// Stop Loss (always active from Day 1)
sl_frac: [0, 0.10, 0.15, 0.20, 0.25, 0.30]  // 0 = no SL (week close fallback)
// SL level = -(sl_frac × basket_ADR)
// e.g., 0.15 × 24% = -3.6% SL for 24 trades
```

Total combos: 4 × 5 × 6 = 120 parameter sets × 6 strategies = 720 runs.

### Exit logic per week

```
For each day (daily close):
  1. Compute normalized basket P&L

  2. CHECK STOP LOSS FIRST (if sl_frac > 0):
     If basket_pnl <= -(sl_frac × basket_adr):
       → Exit at stop loss level, week is done

  3. CHECK TP ACTIVATION (if not yet activated):
     If basket_pnl >= tp_frac × basket_adr:
       If trail_frac == 0:
         → Exit at TP level (pure TP), week is done
       Else:
         → Activate trailing, set peak = basket_pnl

  4. CHECK TRAIL STOP (if trailing is active):
     Update peak = max(peak, basket_pnl)
     stop_level = peak - (trail_frac × basket_adr)
     If basket_pnl <= stop_level:
       → Exit at stop_level, week is done

  5. If Friday (last day):
     → Exit at basket_pnl (week close)
```

### Strategies to test

ALL six active strategies: `dealer`, `sentiment`, `tiered_v3`, `agree_2of3`, `selector_sentiment_override`, `strength`

Skip: `tandem`, `commercial`

### Output format

**Phase 1: Per-strategy results** — For each strategy, show top 10 configs by R/DD:

```
Strategy: Dealer (baseline: +73.18%, DD: -2.19%)
#  TP    Trail  SL     Net      DD       R/DD    LWk  WR    │ Weekly returns
1  0.25  0.20   0.15   +XX.XX%  -X.XX%   XX.Xx   X    XX%   │ ...
2  ...
```

**Phase 2: Cross-strategy score** — For each config, compute average R/DD improvement across all strategies vs their baselines. Rank by this average improvement. Show top 20.

```
#  TP    Trail  SL     Avg ΔR/DD  │ Dealer  Sent   Tier   Agree  Select  Stren
1  0.25  0.20   0.15   +3.2x      │ 12.1x   5.2x   4.8x   9.1x   6.3x   8.0x
```

**Phase 3: Recommended config** — The single best config that improves the most strategies without hurting any. Print detailed per-strategy results for this config.

### Important technical notes

1. **Engine call**: Always pass the overlay: `computeMultiWeekHold(strategy, WEEKS, entryStyle, getStrengthGate("adr_normalized"))`
2. **ADR source**: Use `loadWeeklyAdrMap()` from `src/lib/performance/adrLookup.ts` — same as engine
3. **Position normalization**: `multiplier = targetAdr / getAdrPct(adrMap, symbol, assetClass)`, `targetAdr = getTargetAdrPct()` (= 1.0%)
4. **Basket P&L**: Sum of `directionalPnl × multiplier` across all positions, where `directionalPnl = rawPnl × (direction === "SHORT" ? -1 : 1)`
5. **Daily bars**: Load from `canonical_price_bars WHERE timeframe = '1d'` for the week window
6. **Preload**: Load all daily bars and ADR maps once before the grid search (don't query per-config)
7. **Batching**: The grid is 720 runs but the engine calls are only 6 (one per strategy). The 120 exit configs are applied to the same daily paths. So run engine once per strategy, compute daily paths once, then loop through exit configs on the paths.
8. **SL check comes BEFORE TP check** in each day's logic — if both are hit on the same day, SL takes precedence (conservative)
9. **Week close fallback**: If neither SL, TP, nor trail stop triggers during the week, exit at Friday close

### Acceptance criteria

- [ ] Script runs without errors: `npx tsx scripts/backtest-basket-exit-grid.ts`
- [ ] Parity check: "No TP, No Trail, No SL" config matches engine baseline for each strategy (within ±1%)
- [ ] All 120 configs tested across all 6 strategies
- [ ] Output includes Phase 1 (per-strategy top 10), Phase 2 (cross-strategy ranking), Phase 3 (recommendation)
- [ ] Script completes in under 3 minutes (engine calls are the bottleneck, exit sim is fast)
- [ ] Include the file header standard (Property of Freedom_EXE)

### What NOT to do

- Do NOT modify any engine or app code — this is a research script only
- Do NOT use hourly bars (we only have daily bars for historical weeks)
- Do NOT add ADR pullback entry style — this is weekly hold only
- Do NOT create helper files — everything in one script
- Do NOT skip any strategy — test all 6

---

## After this task

The results from this grid search will determine:
1. Whether a universal basket exit config exists
2. If so, what parameters to hard-code into a new Filter 1 entry ("Basket TP+Trail")
3. Whether different strategies need different exit configs (hope not)

Nyx will review the results and make the app integration decision.
