# ADR Indicator Review Brief

## Goal

Get a focused review on the next evolution of the Pine Script ADR indicator in:

`scripts/pinescript/limni-adr-levels.pine`

The review should preserve the simplified indicator structure we already converged on and help decide the best next test.

## Current Decision

The immediate next step is now decided:

- test **daily anchoring**
- compare it directly against the **weekly baseline**
- do **not** add confirmation logic yet
- do **not** implement the more dynamic anchor idea yet

## Current State

The current indicator is intentionally simple.

It currently does all of the following:

- Computes ADR as the average of `(daily high - daily low) / daily open` over the last `N` completed daily bars.
- Anchors levels to the **weekly open**.
- Uses weekly pair bias mapping via copy-paste text areas:
  - `LONG Pairs`
  - `SHORT Pairs`
- Treats anything not mapped as `NEUTRAL`.
- For crypto:
  - `BTCUSD` and `ETHUSD` define regime
  - if both are `LONG`, other crypto defaults `LONG`
  - if both are `SHORT`, other crypto defaults `SHORT`
  - if they disagree or are neutral, other crypto defaults `NEUTRAL`
- Shows only the current week’s levels.
- Plots:
  - long ADR entry
  - long TP
  - short ADR entry
  - short TP
- Shows a compact info table with bias, ADR pips, and TP distance in pips.

## Important Constraint

Do **not** reintroduce unnecessary complexity.

We do **not** want a review that adds back:

- fills
- outer zones
- midlines
- week-open display lines
- arrows
- extra decorative visuals
- multi-layered UI clutter

The current script is deliberately minimal and should stay that way unless there is a very strong reason otherwise.

## Current Concept Being Challenged

Right now the entry logic is **weekly anchored**:

- long bias: `weekly open - 1 ADR`
- short bias: `weekly open + 1 ADR`
- TP: `0.25 ADR` back toward the anchor

This is coherent, but it may be too rigid.

The new question is whether weekly anchoring is the wrong first-order framing for how the move actually happens intraday.

## Additional Motivation From Recent Chart Review

A key reason to challenge weekly anchoring is that it appears to miss valid moves even when the higher-level weekly bias is correct.

Example observation:

- on pairs like `EURJPY`, the bias may have been `LONG` for multiple consecutive weeks
- across those weeks, price still made repeated downside moves of roughly `1 ADR`
- but the weekly-open anchored levels were not reached, so no ADR entries were triggered

This suggests the problem may not be the ADR distance itself.

The problem may be the **anchor**.

In other words:

- the market may still be offering repeated ADR-sized pullbacks
- but those pullbacks are occurring relative to more local structures, not the fixed weekly open

That is the main practical reason to test daily anchoring next.

## New Idea 1: Daily Anchoring

The first next test should likely be **daily anchoring**.

### Rationale

- It resets levels every day.
- It naturally supports **one entry per pair per day**.
- It is objective and easy to backtest.
- It may better reflect how ADR exhaustion or pullback setups actually appear in live intraday price action.

### Proposed First-Pass Daily Model

Keep the same ADR calculation, but change the anchor from weekly open to daily open.

- Long bias:
  - entry = `daily open - 1 ADR`
  - TP = `entry + 0.25 ADR`
- Short bias:
  - entry = `daily open + 1 ADR`
  - TP = `entry - 0.25 ADR`
- Neutral:
  - show both sides
- Only allow one entry per pair per day.
- Reset levels on each new daily candle.

### Important Implementation Detail

The daily open must be defined explicitly in the backtest.

For FX, the preferred definition is:

- the day boundary implied by the broker feed / OANDA rollover
- effectively the first bar after **5 PM ET**

This should be written explicitly into any research or backtest implementation so the result is not ambiguous.

### Why This Is Attractive

This keeps the system structured and measurable while moving closer to the actual daily move profile visible on charts.

It also addresses the specific failure mode seen in recent chart review:

- a pair can remain biased in one direction for several weeks
- yet still deliver daily or intraday ADR-sized pullbacks
- weekly anchoring may be too slow or too distant to capture them
- daily anchoring may surface more of those opportunities without becoming fully subjective

## New Idea 2: Dynamic ADR Move Measurement

There is also a more ambitious concept that may be better long-term, but it is **not yet well quantified**.

The intuition is:

- sometimes price simply travels about `1 ADR` from a local high to a local low
- that move can create a good setup
- but the move is not necessarily cleanly anchored to a weekly open or daily open

Example intuition:

- on EURJPY or USDJPY, price may fall about `98 pips`
- if ADR is about `98 pips`, the raw move itself may matter more than whether that move started exactly from weekly open

### Problem

This concept is not yet precise enough.

The immediate issue is:

- **from which high?**
- **from which low?**
- **what is the anchor event?**
- **how do we prevent hindsight bias or overfitting?**

Without a clear definition, “price moved 1 ADR” becomes too subjective.

### Important Constraint On This Future Idea

A session-high/session-low freeze model is one possible structured definition, but it is **not** the preferred direction right now.

Current preference:

- do **not** move to session high/low anchoring yet
- do **not** force the future dynamic model into a fixed session framework just because it is easy to code
- keep the future “dynamic move” idea open until it can be defined in a way that matches the real chart intuition more closely

In short:

- daily anchoring is the next concrete test
- the future dynamic concept still needs better thought

## Important Risk: Blind ADR Touch May Be Too Crude

Another important observation from chart review:

- even if daily anchoring or dynamic anchoring produces more entries
- blindly entering the moment ADR distance is hit may still be too aggressive
- some of these moves appear to continue well past the ADR threshold before reversing

So the issue may become:

- better anchoring finds more opportunities
- but entry timing may still be weak without confirmation

This means the next review should also comment on whether a later version needs a confirmation layer such as:

- lower-timeframe engulfing confirmation
- reclaim back through a short-term EMA such as the 5-minute `20 EMA`
- other simple reversal confirmation after the ADR excursion occurs

This is **not** a request to add that immediately.

It is a request to evaluate whether:

1. anchoring should change first, and
2. confirmation should become the next test after that

Current answer:

- yes, anchoring should change first
- confirmation should remain a separate stage

## Baseline Comparison Question

Part of the uncertainty is whether these apparent drawdowns are actually worse than the baseline system.

So another useful review question is:

- if daily anchoring or dynamic anchoring creates more entries, how should those entries be compared against the current baseline in terms of:
  - fill rate
  - drawdown after entry
  - win rate
  - return per triggered setup

This matters because visible chart drawdown may feel problematic, but it is not enough by itself to reject the concept unless it is worse than the existing baseline.

## Baseline Definition

The weekly baseline used for comparison must be defined clearly:

- **weekly anchored ADR**
- **one entry per pair per week**
- **no re-entries**

This is critical.

The comparison should be:

- weekly anchor, max one entry per pair per week
vs
- daily anchor, max one entry per pair per day

Without that constraint, the baseline is not aligned with the intended test.

## Review Request

Please review these two paths and recommend the best sequence for testing.

### Questions to answer

1. Is **daily open anchoring** the right first experiment after weekly anchoring?
2. Is there a cleaner way to define the future **dynamic ADR move** concept without introducing subjective hindsight?
3. If we later test a dynamic version, what is the most defensible first definition?
4. Should confirmation be treated as a separate second-stage filter after anchoring is solved, rather than mixed into the first anchoring experiment?
5. What is the best way to compare post-entry drawdown and fill quality against the current weekly-anchored baseline?

## Current Answers

These are the current working answers from review and discussion:

1. **Yes**: daily open anchoring is the correct next structured experiment.
2. **No final answer yet**: the dynamic ADR move concept is still under-defined and should not be forced into implementation prematurely.
3. **Deferred**: dynamic anchoring remains future work and still needs clearer quantification.
4. **Yes**: confirmation should be a separate second-stage test, not mixed into the first daily-anchor experiment.
5. Compare using the same framework as prior ADR tests:
   - fill rate
   - MAE distribution
   - win rate by MAE bucket
   - return per fill
   - total return
   - losing weeks

The key question is:

- does daily anchoring create more fills **without materially degrading MAE and win quality** relative to the weekly baseline?

## Preferred Development Sequence

The most logical order currently looks like this:

1. Keep the current weekly-anchored version as baseline.
2. Build a **daily-open anchored ADR variant** as the next clean test.
3. Compare weekly vs daily anchored behavior directly.
4. If daily anchoring is promising, test **confirmation** as a second-stage filter.
5. Only after that, define and test a more dynamic “raw ADR move” model.

## Explicit Research Note

A concern raised during review:

- repeated missed ADR entries on a pair like `EURJPY` do not automatically prove weekly anchoring is wrong
- they may simply reflect a market that stayed strong enough not to pull back 1 ADR from the weekly anchor

So the daily-anchor test should not be framed as “fixing” the weekly system.

It should be framed as:

- testing whether a finer anchor captures additional valid setups
- while preserving enough entry quality to justify the extra frequency

## Candidate Future Definitions For The Dynamic Version

These are examples only. They are not approved yet.

### Option A: Session Open Anchor

Use a session open instead of weekly or daily open:

- Asia open
- London open
- New York open

This is still anchored, but more intraday-aware.

### Option B: Daily Extreme Excursion

For long bias:

- track the current day’s highest high
- trigger once price falls `1 ADR` from that high

For short bias:

- track the current day’s lowest low
- trigger once price rises `1 ADR` from that low

This is closer to the chart intuition, but must be defined carefully to avoid messy logic.

### Option C: Session Extreme Excursion

Same as Option B, but limited to the active session instead of the whole day.

This may be cleaner than pure rolling intraday extremes.

These options are examples only.

They are **not** approved next steps.

## What Not To Do In The Review

Please do not:

- redesign the current indicator UI
- add back removed complexity
- broaden the ask into unrelated feature work
- assume the dynamic concept is ready to implement immediately

The main goal is to validate whether **daily anchoring** is the correct next structured test and to help define the more dynamic idea in a way that can actually be measured later.

## Recommendation Bias

If forced to choose today, the preferred first move is:

**test daily anchoring first**

because it is:

- concrete
- measurable
- easy to compare against the weekly baseline
- much less likely to overfit than a loosely defined dynamic excursion model

## Immediate Next Research Spec

If this is handed to another reviewer or researcher, the immediate ask should be:

1. Define a daily-open anchored ADR entry model using the same ADR math as the current weekly version.
2. Use **one entry per pair per day**.
3. Compare it against the weekly baseline defined as **one entry per pair per week, no re-entries**.
4. Do **not** add confirmation logic in the first test.
5. Do **not** implement dynamic/session-extreme anchoring yet.
