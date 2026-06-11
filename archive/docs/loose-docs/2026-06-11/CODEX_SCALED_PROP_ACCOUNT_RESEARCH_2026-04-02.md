# Codex Prompt: Scaled Prop Account Weekly Consistency Research

**Date:** 2026-04-02
**Author:** Nyx
**Priority:** CRITICAL — Final research before picking a live system
**Depends on:** `scripts/backtest-risk-management-matrix.ts` (read for patterns)

---

## Context

The previous risk management research measured basket returns at full size. But prop accounts don't need full size. Making **1-2% per week consistently** is excellent for prop account evaluations. With baskets returning +5% to +30% per week at full size, we can reduce position size by 5-10x and still hit that target.

This changes everything:
- A strategy with -8.77% worst day at full size → **-0.88% at 1/10th size** → no DD limit concern
- The winning strategy is no longer "smallest drawdown" — it's **"most weeks hitting 1-2% return at a given scale"**
- Trailing logic shifts from ADR-based to **account-profit-based**: hit +1% for the week → start trailing by 0.5%

### What exists
- `scripts/backtest-risk-management-matrix.ts` — full-size research with SL/TP/trailing. Read this for data loading patterns, daily path building, and metric aggregation. Reuse the same infrastructure.
- All 10 strategies' ADR-normalized weekly returns are computed there. You can reuse `buildStrategyWeekInputs()` or the same data loading approach.

---

## Task: `scripts/backtest-scaled-prop-consistency.ts`

### Phase 1: Scale Factor Grid

For ALL 10 strategies, compute scaled weekly returns at these size fractions:

```
Scale factors: [1/5, 1/6, 1/7, 1/8, 1/9, 1/10]
```

Scaled return = `baseline_weekly_return * scale_factor`

For each strategy × scale factor, report:
- Weekly returns (all 10 weeks)
- How many weeks hit ≥ +1% (the target)
- How many weeks hit ≥ +1.5%
- How many weeks hit ≥ +2%
- Losing weeks (how many < 0%)
- Worst week (%)
- Best week (%)
- Total return over 10 weeks (%)
- Max drawdown (%)
- **Worst single EOD day proxy (%)** — scale the daily path too
- **Consistency score** = weeks_hitting_1pct / total_weeks

Output: Table per strategy showing all scale factors. Sorted by consistency score descending within each strategy.

Then a **cross-strategy leaderboard** sorted by: consistency score first, then R/DD as tiebreaker. Show the best scale factor per strategy.

### Phase 2: Account-Level Trailing Stop

For each strategy, at its **best scale factor from Phase 1** (the one with highest consistency score while keeping losing weeks ≤ 1), test account-level trailing:

```
Activation levels: [+0.75%, +1.0%, +1.25%, +1.5%]
Trail distances:   [+0.25%, +0.5%, +0.75%, +1.0%]
```

**Trailing logic** (operates on scaled basket P&L):
- Build daily scaled basket P&L path: `daily_basket_pnl * scale_factor`
- When scaled basket P&L first hits activation level → trailing active
- Track peak. If P&L drops from peak by trail distance → close all at `peak - trail_distance`
- If trail never activates → hold to Friday close
- This is the same logic as the previous research, just operating on scaled numbers

**Critical:** SL is NOT tested here. At these scale factors, the worst-day numbers are so small that SL would rarely fire. We're optimizing for locking in the +1-2% target, not preventing large losses.

Metrics per strategy × trailing config:
- Total return (%)
- Max DD (%)
- R/DD
- Weeks hitting ≥ 1%
- Losing weeks
- Worst week
- Trail activations (how many weeks hit the activation level)
- Avg return captured when trail fires
- **Consistency score** (same as Phase 1)

Output: Per strategy, table of all activation × distance combos at the chosen scale.

### Phase 3: TP Bank-Out vs Trailing

For each strategy at its best scale factor, also test a simple **bank-out** model:

```
TP levels: [+1.0%, +1.25%, +1.5%, +2.0%]
```

**Bank-out logic** (simplest possible — good for manual execution on 3 accounts):
- Build daily scaled basket P&L path
- When scaled basket P&L first hits TP level → close everything, bank the profit
- If TP never hits → hold to Friday close

This is the "set it and forget it" model. No trailing complexity. Just: did we hit the target this week? Yes → close. No → hold.

Compare bank-out vs best trailing config from Phase 2.

Metrics: same as Phase 2.

### Phase 4: Final Prop Account Ranking

Rank ALL strategy × scale × exit combos by **prop account suitability**:

```
Prop Score = consistency_score * 100
           + (total_return / 10)           // avg weekly return bonus
           - (losing_weeks * 5)            // penalty per losing week
           - (worst_week < -1% ? 10 : 0)   // harsh penalty for any week worse than -1%
```

**Hard disqualifiers at scaled level:**
- Worst EOD day proxy > -2% (at scale) → disqualified
- Max DD > -4% (at scale) → disqualified
- Losing weeks ≥ 3 → disqualified

Top 15 table:
```
Rank | Strategy | Scale | Exit Config | TotalRet | MaxDD | R/DD | PropScore | Wks≥1% | LoseWk | WorstWk | WorstDay | AvgWkRet
```

### Phase 5: Week-by-Week Detail for Top 5

For each of the top 5 ranked combos, print:
- Per-week return, exit reason, exit day
- Daily scaled basket P&L path per week
- Asset-class breakdown (FX, crypto, indices, commodities) — at scaled level
- Which weeks would have passed a prop account daily check (worst day < -2% scaled)
- Which weeks hit the 1% weekly target

---

## Data Loading

Reuse the same infrastructure as `backtest-risk-management-matrix.ts`:

```typescript
import { computeWeeklyHold } from "../src/lib/performance/weeklyHoldEngine";
import { getEntryStyle, getStrategy, getStrengthGate } from "../src/lib/performance/strategyConfig";
import { loadWeeklyAdrMap, getAdrPct, getTargetAdrPct } from "../src/lib/performance/adrLookup";
import { getCanonicalBars } from "../src/lib/canonicalPriceBars";
```

- Weekly hold with ADR normalization for all strategies
- Daily bars from `canonical_price_bars` for intra-week path tracking
- Same `buildDailyNormalizedPath()` and `sumPaths()` pattern
- Just multiply everything by the scale factor

**IMPORTANT:** The daily path at full size is already built in the existing script. You just need to multiply `basketDailyPath[i] * scaleFactor` for each day. Same for weekly return. The ADR normalization stays at full size — scaling is a pure multiplier on top.

---

## Strategy IDs (all 10)

```
dealer, sentiment, strength, commercial, tandem,
tiered_v3, tiered_3_nocomm, agree_2of3, agree_2of3_nocomm,
selector_sentiment_override
```

---

## Output Format

Standard research format:

```
╔══════════════════════════════════════════════════════════════════╗
║   SCALED PROP ACCOUNT RESEARCH                                  ║
║   All strategies × scale factors × trailing/TP                  ║
║   Target: 1-2% per week consistently                            ║
║   Engine: f2=adr_normalized (app parity)                        ║
╚══════════════════════════════════════════════════════════════════╝
```

Use same `fmt()` and `fmtR()` helpers. Show weekly returns inline for each combo so Freedom can eyeball the distribution.

---

## Execution

```bash
npx tsx scripts/backtest-scaled-prop-consistency.ts
```

Uses production DB (same as all research scripts).

---

## What NOT To Do

- Do NOT modify any production code
- Do NOT skip any strategy — test all 10
- Do NOT add SL to this research (DD is not the concern at scale — consistency is)
- Do NOT hardcode week dates — load dynamically
- Do NOT change the ADR normalization — it stays at full size. Scale factor is a pure position-size multiplier on top

---

## Success Criteria

1. Script runs clean: `npx tsx scripts/backtest-scaled-prop-consistency.ts`
2. Phase 1 baselines at scale=1/1 match the existing research (Dealer = +73.18%, etc.)
3. Consistency scores make sense (strategies with more positive weeks score higher)
4. Final ranking identifies top 5 combos with clear differentiation
5. Output is self-contained — Freedom reads terminal output and picks his system

---

## Why This Matters

Freedom has 3 funded prop accounts. At reduced size (1/5 to 1/10), even "risky" strategies become safe. The question is no longer about survival — it's about **hitting the weekly profit target consistently**. A strategy that hits +1% in 9 out of 10 weeks at 1/8th size is better than one that hits +3% in 6 weeks but loses in 4.

The winning system will be run on all 3 accounts starting next week.
