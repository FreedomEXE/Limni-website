# Codex Prompt: Per-Trade Stop Loss Impact Backtest

## Goal

Measure the impact of adding per-trade (per-pair) stop losses to the existing **2-of-3 NoComm + Calendar Additive Layering** system. Some prop firms (5ers specifically) require a mandatory SL on every trade. We need to know what that costs before deploying to prop accounts.

## Context

The live system is:

- **Strategy:** 2-of-3 NoComm (`agree_2of3_nocomm`)
- **Entry style:** Weekly Hold, ADR Normalized
- **Layering:** Calendar additive — Mon 1/5, Tue +1/10, Wed +1/10 (max 2/5 scale)
- **Trail:** +1.25% basket activation, 0.5% trail distance
- **Safety:** S1 — skip adds if basket P&L < -1%
- **Data window:** Last 10 closed weeks

The existing backtest at `scripts/backtest-additive-layering.ts` already simulates this system with daily bar data. The winning config is **P2 | TR 1.25/0.5 | S1**.

## What to Build

Create `scripts/backtest-per-trade-sl.ts` — a research script that extends the existing layering simulation with per-trade stop loss logic.

### Per-Trade SL Definition

A per-trade SL is a **price-level stop loss on each individual position** (not the basket). When a position's adverse move from its entry price exceeds the SL threshold, that position is closed at the SL level. The rest of the basket continues.

SL is expressed as **% of account nominal** per trade. For example, with a $100k account and 2% SL cap:
- The max allowed loss per position = $2,000
- Given the lot size and pip value, this translates to a maximum adverse price move

But in our backtesting context, we work with **% of basket return contribution**, not dollar amounts. Since each pair's contribution is ADR-normalized and scaled:
- A pair's contribution to basket P&L on any given day can be computed from daily bars (the existing backtest already does this via `positionContributionAtDay()`)
- The SL threshold per pair should be: `sl_threshold_pct / scale_factor` in unscaled terms, or simply check if the pair's **scaled contribution** to the basket exceeds the threshold

### Simplification for backtest purposes

Since all positions are ADR-normalized to equal risk:
- Use **per-pair contribution to basket P&L** as the SL metric
- A pair is stopped out when its individual scaled contribution falls below `-threshold`
- Once stopped, that pair contributes a fixed `-threshold` from that day forward (it's flat)

### SL Thresholds to Test

Test three SL levels that correspond to typical prop firm requirements:

| Label | Threshold | Meaning |
|-------|-----------|---------|
| SL_1.0 | -1.0% | 1% of account per trade |
| SL_1.5 | -1.5% | 1.5% of account per trade |
| SL_2.0 | -2.0% | 2% of account per trade (5ers standard) |

Each threshold applies **per pair, per layer**. If Monday's EURUSD position hits -2% contribution, it's stopped. But Tuesday's EURUSD add (entered at a different price) is tracked independently.

### Also test "SL_NONE" as the control

Run the same P2 | TR 1.25/0.5 | S1 configuration **without** per-trade SL as the control benchmark so we can see the exact delta.

## Implementation

### Approach

Fork the simulation logic from `backtest-additive-layering.ts`. The key modification is in the daily P&L accumulation loop inside `simulateWeek()`:

```
For each day:
  For each layer:
    For each position:
      If position is not already stopped:
        Compute position's scaled contribution from layer entry to current day
        If contribution < -sl_threshold:
          Mark position as stopped at -sl_threshold
          Lock its contribution at -sl_threshold
      Sum all contributions (active + locked stopped positions)
```

### Data loading

Reuse the same functions from `backtest-additive-layering.ts`:
- `getClosedWeeks()` — last 10 closed weeks
- `loadBarsForWeekSymbol()` — daily OHLC bars
- `buildWeekInputs()` — builds `StrategyWeekInput[]` with positions, multipliers, scale factors
- `positionContributionAtDay()` — computes per-position P&L contribution
- `entryPriceForLayer()` — gets entry price for each layer day

### Types

Add these types:

```typescript
type SlConfig = {
  key: string;
  label: string;
  /** Per-pair basket contribution threshold (negative). null = no SL. */
  threshold: number | null;
};

type PerPairSlState = {
  symbol: string;
  layerDay: number;
  stoppedAtDay: number | null;
  lockedContribution: number;
};

type SlWeekResult = WeekResult & {
  slConfig: SlConfig;
  pairsStoppedCount: number;
  /** How many unique pair-layers hit SL */
  layerStopsCount: number;
  /** Worst single pair contribution (most negative) */
  worstPairContribution: number;
  /** Per-pair breakdown of stopped pairs */
  stoppedPairs: Array<{
    symbol: string;
    layerDay: number;
    stoppedAtDay: number;
    worstContributionBeforeSl: number;
  }>;
};
```

### Output Format

Print results in three sections:

**Section 1: Summary Table**

```
╔══════════════════════════════════════════════════════════════════╗
║ PER-TRADE STOP LOSS IMPACT — 2-of-3 NoComm P2 TR1.25/0.5 S1  ║
╠══════════════════════════════════════════════════════════════════╣

SL       Return    MaxDD     R/DD    Wins  Losses  Worst Wk  Stops/Wk  Avg Stopped  Delta vs None
──────── ──────── ──────── ──────── ───── ─────── ──────── ──────── ──────────── ─────────────
NONE     +41.27%  -1.76%   23.4x    9     1       -2.13%   0.0       0.0          —
SL_2.0   +XX.XX%  -X.XX%   XX.Xx    X     X       -X.XX%   X.X       X.X          -X.XX%
SL_1.5   +XX.XX%  -X.XX%   XX.Xx    X     X       -X.XX%   X.X       X.X          -X.XX%
SL_1.0   +XX.XX%  -X.XX%   XX.Xx    X     X       -X.XX%   X.X       X.X          -X.XX%
```

**Section 2: Per-Week Comparison**

For each week, show the return under each SL level and how many pairs were stopped:

```
Week         NONE      SL_2.0    SL_1.5    SL_1.0    Stops@2%  Stops@1.5%  Stops@1%
──────────── ──────── ──────── ──────── ──────── ──────── ─────────── ────────
Jan 27       +4.52%   +4.52%   +4.38%   +3.91%   0         1           3
Feb 03       +3.21%   +3.21%   +3.21%   +2.88%   0         0           2
...
Mar 22       -2.13%   -1.98%   -1.75%   -1.50%   2         4           8
```

**Section 3: Worst Offender Pairs**

Across all 10 weeks, list every pair-layer that would have been stopped at the 2% level, sorted by worst contribution:

```
╔══════════════════════════════════════════════════════════════════╗
║ PAIRS STOPPED AT 2% THRESHOLD (sorted by worst contribution)   ║
╠══════════════════════════════════════════════════════════════════╣

Week       Symbol    Layer   Worst Contrib   Stopped Day   Final Contrib (no SL)
────────── ──────── ─────── ─────────────── ───────────── ─────────────────────
Mar 22     NZDUSD   Mon     -3.41%          Day 3          -2.87%
Mar 22     AUDUSD   Mon     -2.95%          Day 2          -1.92%
...
```

This tells us:
1. Which pairs are the worst offenders
2. Whether SL would have actually helped or hurt (pair may have recovered by Friday)
3. How early the SL triggers (Day 1 vs Day 4 matters for recovery potential)

## Key Questions to Answer

The output should clearly answer:

1. **How much return do we sacrifice?** Delta between NONE and each SL level.
2. **Does SL actually reduce max drawdown?** Or does it just cap individual pair losses while the basket still loses?
3. **How many pair-layers hit each SL per week on average?** If it's 0-1, the SL is nearly free. If it's 5+, it's significantly reshaping the portfolio.
4. **Is 2% (5ers standard) practically free?** If very few pairs ever breach -2% contribution, then 5ers compliance costs almost nothing.
5. **On the Mar 22 losing week specifically:** Would per-trade SL have helped or hurt? (Some stopped pairs may have recovered.)

## File References

- `scripts/backtest-additive-layering.ts` — base simulation to fork from (types, data loading, simulation loop)
- `src/lib/performance/adrLookup.ts` — ADR normalization
- `src/lib/performance/weeklyHoldEngine.ts` — `computeWeeklyHold()` for getting per-pair trade data
- `src/lib/performance/strategyConfig.ts` — strategy/filter/gate config
- `src/lib/canonicalPriceBars.ts` — daily OHLC bar data
- `src/lib/dataSectionWeeks.ts` — week listing
- `src/lib/weekAnchor.ts` — current week detection

## Acceptance Criteria

1. Script runs with `npx tsx scripts/backtest-per-trade-sl.ts`
2. Tests 4 SL levels: NONE, 2.0%, 1.5%, 1.0%
3. Uses exact same underlying data and week inputs as the additive layering backtest
4. Fixed config: P2 (Base 1/5 + Tue/Wed 1/10) | TR 1.25/0.5 | S1
5. Outputs summary table, per-week comparison, and worst offender list
6. Per-pair SL tracking is per-layer (Monday entry tracked separately from Tuesday add)
7. Stopped pairs lock contribution at -threshold (no recovery, no further contribution)
8. NONE config output should match existing P2 | TR 1.25/0.5 | S1 results from `backtest-additive-layering.ts` (parity check)
9. Include the standard file header (Property of Freedom_EXE (c) 2026)
10. No new dependencies — use only what the existing backtest already imports
