# Codex Prompt: Risk Management Layer Research

**Date:** 2026-04-02
**Author:** Nyx (research handoff to Codex)
**Priority:** CRITICAL — This decides which system Freedom trades on funded accounts next week

---

## Mission

Build a single research script that answers: **which strategy + risk management combo gives the best funded-account survival profile?**

Funded accounts (prop firms) have hard rules:
- **Max daily drawdown** — one bad day and you're done
- **Max total drawdown** — cumulative equity can't drop below threshold
- **Consistency** — losing weeks must be rare, and when they happen, small

We are NOT optimizing for max return. We are optimizing for: **highest return that never blows through a daily/weekly drawdown limit.** A system that makes +60% with 0 losing weeks beats one that makes +150% with 3 losing weeks.

---

## What Exists (Read These First)

Reference scripts in `scripts/` — reuse their patterns:
- `backtest-strength-tiered-agreement-matrix.ts` — most recent research script, loads signals + computes custom voting
- `backtest-basket-trailing-stop.ts` — daily P&L path tracking, trailing stop simulation
- `backtest-basket-adr-tp-all-strategies.ts` — basket TP with ADR normalization
- `backtest-basket-tp-final.ts` — TP vs trail vs hybrid comparison, `computeAgg()` pattern

Key source files:
- `src/lib/performance/weeklyHoldEngine.ts` — `resolveDirections()`, `computeWeeklyHold()`, `applyOverlay()` for ADR normalization
- `src/lib/performance/adrLookup.ts` — `loadWeeklyAdrMap()`, `getAdrPct()`, `getTargetAdrPct()` (= 1.0%)
- `src/lib/performance/basketSource.ts` — `getCanonicalBasketWeek()` for base signals
- `src/lib/performance/strategyConfig.ts` — all 10 strategy IDs
- `src/lib/strength/weeklyStrength.ts` — `readWeeklyPairStrengths()` for strength signal
- `src/lib/canonicalPriceBars.ts` — `getCanonicalBars(symbol, '1d', from, to)` for daily bars
- `src/lib/pairReturns.ts` — `getWeeklyPairReturns()` for weekly open/close

### Key infrastructure facts

1. **ADR normalization** is mandatory for all tests. Use the same overlay as the app engine: `multiplier = targetAdr / pairAdr` where targetAdr = 1.0%. This means each pair's return is scaled so that 1 ADR move ≈ 1% return regardless of pair.

2. **Daily bars** exist in `canonical_price_bars` (timeframe='1d'). Load 7 days within each week window to build intra-week P&L paths. All existing scripts use this pattern.

3. **Basket P&L** = sum of all positions' ADR-normalized returns. With normalization, each pair contributes roughly ±1% per ADR move. A basket of 24 pairs has basket_ADR ≈ 24% (theoretical max daily move if all pairs move 1 ADR in same direction — unrealistic, but it's the scale).

4. **Weeks**: The app currently has 10 closed weeks. Load them dynamically using the same method as `backtest-strength-tiered-agreement-matrix.ts` (query `pair_period_returns` for distinct `period_open_utc` where `period_type='weekly'`). Include current week if data available.

---

## Script: `scripts/backtest-risk-management-matrix.ts`

### Phase 1: ADR-Normalized Baselines (All 10 Strategies)

For each of the 10 strategies, compute weekly hold with ADR normalization:

**Strategies:**
```
dealer, sentiment, strength, commercial, tandem,
tiered_v3, tiered_3_nocomm, agree_2of3, agree_2of3_nocomm,
selector_sentiment_override
```

Use the engine's `computeWeeklyHold()` + `applyOverlay()` with `getStrengthGate("adr_normalized")` for each strategy across all weeks.

**Metrics per strategy:**
- Total return (%)
- Max drawdown (%) — equity curve peak-to-trough
- R/DD ratio
- Losing weeks count
- Worst single week (%)
- Best single week (%)
- Win rate (% of weeks positive)
- Avg pairs per basket per week
- Worst single day across all weeks (%) — **CRITICAL for prop accounts**
- Max consecutive losing weeks

**Per-asset-class breakdown** (FX, crypto, commodities, indices):
- Return contribution
- Trade count

**Output:** Sorted table by R/DD descending. This is the "no risk management" baseline.

### Phase 2: Stop Loss Sweep

For EACH of the 10 strategies, test basket-level stop loss at these absolute levels:

```
SL levels: [-2%, -3%, -4%, -5%, -6%, -8%, -10%, none]
```

**SL logic:**
- Build daily normalized basket P&L path for each week (sum of all positions' ADR-normalized unrealized P&L at each day's close)
- If basket P&L at any day's close ≤ SL level → close all positions at that day's close price
- If SL never triggers → hold to Friday close (normal weekly hold)
- SL is active from Day 1 of the week

**Daily P&L calculation per position:**
```typescript
// For each day within the week:
const rawDayPnl = ((dayClosePrice - weekOpenPrice) / weekOpenPrice) * 100;
const directedPnl = (direction === "SHORT") ? -rawDayPnl : rawDayPnl;
const normalizedPnl = directedPnl * (targetAdr / pairAdr);

// Basket P&L for the day = sum of all positions' normalizedPnl
```

**Metrics per strategy × SL level:**
- Total return (%)
- Max drawdown (%)
- R/DD ratio
- Losing weeks count
- Worst single week (%)
- Worst single day (%)
- SL activations: count + which weeks
- Return given up (vs no-SL baseline)

**Output:** Table per strategy showing all SL levels side by side. Highlight the "sweet spot" where losing weeks drop without destroying return.

### Phase 3: Trailing Stop Sweep

For EACH of the 10 strategies, test basket-level trailing stop:

```
Activation levels: [+2%, +3%, +4%, +5%]
Trail distances:   [1%, 1.5%, 2%, 2.5%, 3%]
```

**Trailing logic:**
- Track daily basket P&L path (same as Phase 2)
- When basket P&L first reaches activation level → trailing stop becomes active
- Once active, track peak basket P&L. If P&L drops from peak by trail distance → close all
- If trail never activates → hold to Friday close
- Trail is independent of SL (this phase tests trail alone)

**Metrics per strategy × trailing config:**
- Same metrics as Phase 2
- Trail activations: count + which weeks
- Avg peak P&L at trail activation
- Avg return captured vs peak (how much of the move did we keep?)

**Output:** For each strategy, table of all activation × distance combos. Identify best trailing config per strategy.

### Phase 4: Combined SL + Trailing

For EACH strategy, combine:
- **Best SL level** from Phase 2 (the one that best improves R/DD while keeping return)
- **Best trailing config** from Phase 3 (the one with best R/DD improvement)
- **Also test a tighter combo**: next-tighter SL + same trailing

**Combined logic:**
- SL is always active from Day 1
- Trailing activates when basket P&L reaches activation level
- Both can trigger — whichever hits first wins
- If neither triggers → Friday close

**Metrics:** Same as Phase 2/3 plus:
- Which exit mechanism fired per week (SL, Trail, or Hold)
- Net improvement vs baseline (return delta, DD delta, losing weeks delta)

### Phase 5: Final Ranking

Output a single table ranking ALL strategy + exit combos by **funded-account suitability score**:

```
Score = R/DD × (1 + bonus)
  where bonus = 0.5 if losing_weeks == 0
                0.25 if losing_weeks == 1
                0.0 if losing_weeks == 2
               -0.25 if losing_weeks >= 3

  DISQUALIFY any combo where worst_single_day < -5% (prop account instant fail)
  DISQUALIFY any combo where max_drawdown < -10% (prop account total DD fail)
```

**Top 10 table columns:**
```
Rank | Strategy | Exit Config | Return | MaxDD | R/DD | Score | LoseWk | WorstWk | WorstDay | AvgPairs | SL_Hits | Trail_Hits
```

**Also output:**
- Per-week breakdown for the top 5 combos (weekly returns, which exit fired each week)
- Asset-class breakdown for top 5
- A "changed weeks" comparison: for each top-5 combo, show which weeks changed vs their no-exit baseline and by how much

---

## Diagnostic Requirements

For EVERY strategy × exit combo, log per-pair-week diagnostics:

```typescript
type PairWeekDiagnostic = {
  week: string;
  pair: string;
  direction: "LONG" | "SHORT";
  rawReturnPct: number;
  adrPct: number;
  multiplier: number;
  normalizedReturnPct: number;
  dailyPath: number[];  // normalized basket P&L at each day's close
  exitDay: number | null;  // which day the exit fired (null = held to Friday)
  exitReason: "sl" | "trail" | "hold";
  exitReturnPct: number;  // what this position returned after exit logic
};
```

Don't print all of these — store them in arrays. Only print the per-pair detail for the top 5 final combos, and only for weeks where an exit fired.

---

## Output Format

Use the standard research output format:

```
╔══════════════════════════════════════════════════════════════════╗
║   RISK MANAGEMENT MATRIX — FUNDED ACCOUNT RESEARCH              ║
║   All strategies × SL × Trailing × Combined                     ║
║   Engine: f2=adr_normalized (app parity)                         ║
║   Weeks: N closed weeks                                          ║
╚══════════════════════════════════════════════════════════════════╝
```

Each phase gets its own section with clear headers. Use `fmt()` and `fmtR()` helpers:
```typescript
function fmt(v: number): string { return (v >= 0 ? "+" : "") + v.toFixed(2) + "%"; }
function fmtR(v: number): string { return Number.isFinite(v) ? v.toFixed(1) + "x" : "∞"; }
```

---

## Execution

```bash
npx tsx scripts/backtest-risk-management-matrix.ts
```

Must connect to the production database (same as all other research scripts — use the app's `src/lib/db.ts` connection).

---

## What NOT To Do

- Do NOT modify any production code, app routes, or strategy configs
- Do NOT create new strategy entries in strategyConfig.ts
- Do NOT add or change any database tables
- Do NOT use `computeMultiWeekHold()` for exit simulation — it only does open→close. Build daily path simulation from `canonical_price_bars` daily bars (same as existing trailing/TP scripts)
- Do NOT hardcode week dates — load them dynamically from the database
- Do NOT skip any strategy — test all 10. The whole point is comparing everything on equal footing
- Do NOT use mocks — this hits real production data

---

## Success Criteria

1. Script runs without errors: `npx tsx scripts/backtest-risk-management-matrix.ts`
2. Phase 1 baselines match existing app numbers (verify Dealer ADR ≈ +73.18%, Tiered V3 ADR ≈ +96.79%)
3. All 10 strategies × all exit configs produce results
4. Final ranking table clearly identifies top 5 funded-account configs
5. Diagnostic output shows per-week exit behavior for top 5
6. Output is self-contained — Freedom can read the terminal output and make a decision

---

## Why This Matters

Freedom has 3 funded prop accounts. He needs ONE system to run manually (weekly hold) starting next week. The system must:
- Never lose more than ~4-5% in a single day
- Have minimal losing weeks (ideally 0-1 in 10 weeks)
- Capture enough return to pass prop firm profit targets
- Be simple enough to execute manually on Sunday/Monday open

This research is the final input before that decision. Get it right.
