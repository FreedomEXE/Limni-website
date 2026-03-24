# ADR Dynamic Running Extreme — Research Spec

Created: 2026-03-24
Status: **Not yet approved for implementation. Spec only.**

## Origin

This concept emerged from chart review on EURNZD and other pairs where price repeatedly moved approximately 1 ADR from a local high or low before reversing. The move was visible and tradeable on the chart, but was not captured by either weekly-open or daily-open anchoring because the swing point did not align with a fixed time boundary.

The question: can we measure ADR exhaustion from the price structure itself, rather than from a time-based anchor?

## Core Concept

Instead of anchoring ADR levels to a fixed point in time (weekly open, daily open), track a **running extreme** — the highest high (for LONG setups) or lowest low (for SHORT setups) — and trigger when price moves 1.0x ADR away from that extreme.

### Anchor Rule

For a LONG-biased pair:
- Track `anchorHigh = max(anchorHigh, currentBarHigh)` on every H1 bar
- The anchor only moves upward. It never resets downward on its own.
- Trigger fires when: `anchorHigh - currentBarLow >= 1.0 * ADR`

For a SHORT-biased pair:
- Track `anchorLow = min(anchorLow, currentBarLow)` on every H1 bar
- The anchor only moves downward. It never resets upward on its own.
- Trigger fires when: `currentBarHigh - anchorLow >= 1.0 * ADR`

### Incomplete Move Rule

If price moves partway toward the trigger (e.g., 0.8x ADR) then reverses, but does NOT make a new extreme beyond the current anchor, the anchor stays. The incomplete move is treated as noise. Only a full 1.0x ADR excursion from the anchor fires the trigger.

This means:
- A bounce that does not create a new high/low does not reset anything
- The measurement always runs from the most extreme point seen since the last reset

### TP

Same as all other ADR tests: `0.25 * ADR` back toward the anchor from the fill price.

### Weekly Directional Bias

The weekly Tiered V3 directional bias still applies:
- LONG bias pairs only track running highs (looking for pullback entries)
- SHORT bias pairs only track running lows (looking for rally entries)
- NEUTRAL pairs: TBD (could track both sides, or be excluded)

## Post-Trigger Anchor Reset — Three Options

The central unresolved question: after a trigger fires and the trade exits (TP or period close), what becomes the new anchor?

### Option A: Fresh Start

After any exit (TP hit or period close), reset the anchor to `na`. Begin tracking a new running max/min from the very next bar after exit. The new anchor is whatever extreme forms from that point forward.

**Properties:**
- Cleanest state machine: only 2 states (TRACKING, IN_TRADE)
- Zero memory of prior structure
- Naturally produces the most signals — new anchor starts immediately
- No hindsight bias — every trigger is measured from a post-exit fresh extreme
- Risk: in a choppy market, small bounces after exit create shallow anchors that trigger quickly on noise

**State machine:**
```
TRACKING → (price moves 1 ADR from anchor) → IN_TRADE → (TP or period close) → TRACKING
```

**Recommended as the first test** because it maximizes sample size and has the simplest logic.

### Option B: Consumed Trigger

After a trigger fires, the anchor stays at its current value but is marked as "used." It cannot trigger again. The anchor only resets when price makes a new extreme **beyond** the old anchor value.

**Properties:**
- More conservative — after a LONG trigger from a high, silence until a new higher high forms
- In a slow downtrend: exactly one trigger, then nothing until the trend reverses
- Prevents rapid re-triggering in choppy conditions
- Risk: in a strong trend, the anchor might not reset for a very long time, missing valid setups

**State machine:**
```
TRACKING → (1 ADR trigger) → IN_TRADE → (exit) → WAITING_FOR_NEW_EXTREME → (new high/low beyond old anchor) → TRACKING
```

### Option C: Side Flip

After a LONG trigger fires from a running high, the low near the fill point becomes the anchor for measuring a SHORT trigger upward. The system alternates between tracking highs and lows.

**Properties:**
- Bidirectional — captures reversals in both directions
- More aggressive signal generation
- Introduces complexity: now tracking both sides, need to handle bias conflicts
- May conflict with weekly directional bias gate (LONG-biased pair getting SHORT triggers)
- Risk: if bias gate blocks the flipped direction, this degenerates into Option A anyway

**State machine:**
```
TRACKING_HIGH → (1 ADR down) → LONG_TRADE → (exit) → TRACKING_LOW → (1 ADR up) → SHORT_TRADE → (exit) → TRACKING_HIGH
```

**Not recommended for first test.** Introduces too many variables. Save for later if Option A shows the concept has merit.

## Scope Boundary

Even with a running extreme, a scope boundary may be needed to prevent stale anchors from persisting indefinitely.

Options:
- **Weekly reset**: anchor resets to `na` at each week boundary regardless of state. Clean, matches existing infrastructure.
- **Daily reset**: anchor resets at each 17:00 ET boundary. More aggressive, may fragment valid multi-day moves.
- **No reset**: truly continuous. Anchor only changes via the running max/min rule or post-trigger reset. Simplest logic but anchors could persist for days.

**Recommended for first test: weekly reset.** This keeps the scope aligned with the weekly signal universe and prevents pathological anchor persistence.

## ADR Calculation

Same as all other tests:
- `(dailyHigh - dailyLow) / dailyOpen * 100`, averaged over last 10 completed daily bars, minimum 5 required
- ADR is recalculated at each scope boundary (weekly or daily, depending on chosen boundary)

## Known Risks

1. **Confirmation bias in chart review**: the swings that look obvious on EURNZD are visible *after the fact*. A running max tracks them honestly, but the reversal quality may be worse than it appears visually.

2. **Choppy market noise**: a running max in a sideways range creates small anchors that trigger on minor fluctuations. The weekly bias gate helps, but may not fully solve this.

3. **Signal density**: Option A (fresh start) could produce many more signals than weekly or daily anchoring. High signal density is only valuable if win rate and MAE hold up.

4. **Comparison complexity**: comparing a variable-frequency system (running extreme, triggers whenever) against a fixed-frequency baseline (one per week, one per day) requires careful normalization.

## Comparison Framework

When this is eventually tested, compare against:
- Weekly baseline (Test 3 Variant A: one entry per pair per week, TP 0.25 ADR, no re-entries)
- Daily baseline (Test 6: one entry per pair per day, TP 0.25 ADR)

Metrics:
- Fill rate (triggers per pair per week, normalized)
- Avg return per fill
- Total return
- Win rate
- MAE distribution (xADR buckets)
- Losing weeks
- Signal density vs return quality curve

## Development Sequence

1. Wait for Test 6 (daily anchor) results
2. If daily anchoring shows promise, build Option A (fresh start) as the first running-extreme test
3. Compare all three: weekly, daily, running-extreme Option A
4. Only then evaluate Option B or C as refinements

## What This Document Is Not

- This is NOT an implementation spec. No script should be built from this yet.
- This is NOT a Codex prompt. It needs further refinement before handoff.
- This does NOT approve any of the three options. They are candidates for future testing.

The purpose of this document is to capture the current thinking precisely enough that it can be revisited after Test 6 results are in, without losing the reasoning or the specific options discussed.
