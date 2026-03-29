# Weekly Bias Context Engine Spec

> Owner: Freedom_EXE
> Status: Draft research/design spec
> Last updated: 2026-03-29

---

## 1. Why This Exists

The current weekly stack is good at producing directional signals, but not yet good enough at deciding which directional source should matter most in a given week.

Current reality:

- `dealer` and `commercial` often disagree
- the basket can end up effectively deferring to `sentiment`
- ADR and other tactical filters can improve entries, but they do not fix weak weekly bias quality
- recent research suggests we should improve the weekly bias layer first, then add entry filters on top

This workstream is a pivot away from "more entry filters" and toward a better **weekly context engine**.

---

## 2. Core Problem

Right now we mostly treat weekly sources like simple votes:

- Dealer says `LONG` or `SHORT`
- Commercial says `LONG` or `SHORT`
- Sentiment says `LONG` or `SHORT`
- composite strategies then aggregate those outputs

That is too shallow.

It ignores:

- how extended a source already is
- whether the source is becoming more or less extreme
- whether an extreme should be treated as continuation or exhaustion
- whether one source is materially more reliable than another in the current context

We need to move from **vote counting** to **context scoring**.

---

## 3. Existing Gate: What It Actually Does Today

Limni already has a COT-based crowding gate in [gateEvaluation.ts](/C:/Users/User/Documents/GitHub/limni-website/src/lib/performance/gateEvaluation.ts).

### What the existing COT gate does

- It is a **risk overlay**, not a bias selector.
- It evaluates a proposed trade and returns:
  - `PASS`
  - `REDUCE`
  - `SKIP`
  - `NO_DATA`
- It supports `fx`, `indices`, and `commodities`.
- It loads historical COT snapshots, currently up to about 260 weeks.
- It computes a **directional percentile** for the current COT net positioning relative to history.
- Default thresholds:
  - `REDUCE` above `75`
  - `SKIP` above `90`
- It can evaluate both the base and quote side of a pair.
- In default overlay usage, `REDUCE` is effectively treated as `SKIP`.

### What the existing COT gate does not do

- It does not choose between `dealer` and `commercial`.
- It does not score `sentiment`.
- It does not combine all three sources into one weekly bias model.
- It does not distinguish "extreme but still strengthening" from "extreme and rolling over".
- It does not explicitly model reversal context.
- It does not replace the weekly bias engine.

### Important conclusion

The current COT gate is a useful first-generation **crowding brake**.

It is not yet a second-generation **weekly context engine**.

---

## 4. Design Goal

Build a weekly bias context layer that behaves more like a human analyst:

- If `dealer` is bullish but historically overextended, reduce trust in blind continuation.
- If `commercial` is bearish but not overextended, it may deserve more weight.
- If `sentiment` is at an extreme, decide whether that means continuation or reversal risk.
- If all three agree and none are crowded, confidence should be high.

This engine should answer:

**Which weekly source deserves to be trusted most this week, and with what confidence?**

---

## 5. Two Research Concepts

This workstream should now be treated as two separate concepts.

### Concept A: Selective gate

This is the original framing.

- start from an existing weekly source
- use context to `PASS`, `REDUCE`, or `SKIP`
- fewer trades
- stronger filtering
- higher risk of shrinking the sample too much over a short test window

This is useful later because it may produce cleaner high-conviction baskets.

### Concept B: Always-on weekly selector

This is the new preferred starting point.

- every pair gets a weekly direction
- no skipped pairs
- if a source is stretched, discount it or fade it
- if all sources are weak or neutral, still force a directional choice using fallback rules

This is not really a gate.

It is a **weekly bias selector**.

### Why start with Concept B first

- avoids cherry-picking
- preserves full sample size
- keeps a full 36-pair weekly basket
- directly measures whether the context engine is better at picking direction than current weekly sources
- aligns with the real objective: a weekly basket that works over time, not a sparse filter that only looks good in a small sample

### Research order

1. test Concept B first
2. test Concept A second
3. compare both directly

The key question is not just which one has better win rate.

The key question is:

**Does the lower-trade selective model actually beat the always-on selector after accounting for sample size, drawdown, and stability?**

---

## 5A. First Research Result: Concept B Baseline

First always-on selector run is now saved in:

- [backtest-weekly-bias-context-selector.ts](/C:/Users/User/Documents/GitHub/limni-website/scripts/backtest-weekly-bias-context-selector.ts)
- [weekly-bias-context-selector-latest.json](/C:/Users/User/Documents/GitHub/limni-website/reports/weekly-bias-context/weekly-bias-context-selector-latest.json)

### Test shape

- `10` fully populated closed weeks
- `36` pairs per week
- `360` forced-choice pair-weeks per policy
- no skips
- fallback:
  - `sentiment score`
  - then `dealer score`
  - then `commercial score`
  - then previous week return
  - then `LONG`

### First baseline ranking

- `selector_sentiment_context_override`: `+134.29%`, win rate `58.33%`, max DD `-4.71%`
- `selector_consensus_quality`: `+133.31%`, win rate `51.11%`, max DD `-18.06%`
- `selector_less_extreme_trend`: `+116.54%`, win rate `50.28%`, max DD `-30.31%`
- `selector_less_extreme_wins`: `+84.75%`, win rate `52.50%`, max DD `-23.06%`
- `dealer_forced_full_basket`: `+83.31%`, win rate `53.33%`, max DD `-27.90%`
- `sentiment_forced_full_basket`: `+62.81%`, win rate `50.28%`, max DD `-41.41%`

### Initial interpretation

- The always-on selector concept is viable.
- Adding slope and exhaustion context made a major difference.
- `selector_sentiment_context_override` is the first selector that is clearly competitive with canonical app baselines, not just the forced full-basket research baselines.
- Pure hard fading was too aggressive, but a conditional override on stretched and weakening sentiment worked well.

### Comparison warning

- These three single-source baselines are forced full-basket classifiers, not the app's canonical weekly-hold strategies.
- They intentionally emit one `LONG` or `SHORT` decision for every pair-week.
- They should not be compared directly to Limni app sidebar stats until both are run through the same engine and week set.

### Immediate implication

Concept B is not a dud.

The next job is to verify whether `selector_sentiment_context_override` holds up beyond this 10-week window and understand exactly which weeks it is fixing.

### Canonical app baseline check

Canonical app weekly-hold baselines were then rerun through the real app engine on the selector's exact 10-week closed window.

- `dealer`: `+116.64%`, max DD `-40.71%`
- `commercial`: `+28.92%`, max DD `-69.34%`
- `sentiment`: `+129.13%`, max DD `-21.66%`
- `tiered_v3`: `+137.21%`, max DD `-22.89%`
- `agree_2of3`: `+114.98%`, max DD `-21.30%`
- `selector_sentiment_context_override`: `+134.29%`, max DD `-4.71%`
- `selector_consensus_quality`: `+133.31%`, max DD `-18.06%`
- `selector_less_extreme_trend`: `+116.54%`, max DD `-30.31%`

Interpretation:

- `selector_sentiment_context_override` now beats canonical `sentiment` on return and crushes it on drawdown.
- It also beats canonical `agree_2of3` on both return and drawdown.
- It is still slightly behind canonical `tiered_v3` on return, but with dramatically lower drawdown.
- This is the first selector version that looks genuinely production-candidate rather than just research-grade.

---

## 6. Design Principle

Do not start with a complex weighted model.

Build both concepts in layers:

1. normalize each source
2. label each source's context
3. test simple policies
4. only then build composite scoring

This keeps the research falsifiable.

---

## 7. Proposed Weekly Context Model

Each weekly source should produce more than direction.

### Per-source output

For each of:

- `dealer`
- `commercial`
- `sentiment`

compute:

- `direction`: `LONG | SHORT | NEUTRAL`
- `extremity_index`: `0-100`
- `change_1w`: weekly change in normalized index
- `change_4w`: medium-term change in normalized index
- `state`: regime label
- `freshness`: current, stale, or missing

### Proposed state labels

- `trend_supportive`
- `crowded`
- `extreme`
- `reversal_risk`
- `neutral`
- `no_data`

---

## 8. COT Extremity Normalization

Use a standard min-max COT Index:

```text
COT Index =
((Current Net Position - Min Net Position over n weeks) /
 (Max Net Position over n weeks - Min Net Position over n weeks)) * 100
```

### Inputs

- `Current Net Position = longs - shorts`
- calculate separately for:
  - dealer
  - commercial

### Lookback

Recommended defaults:

- primary: `156 weeks` (3 years)
- research alternates:
  - `52 weeks`
  - `26 weeks`

### Initial interpretation

- `0-10`: bearish extreme
- `10-25`: crowded bearish
- `25-75`: neutral / usable trend range
- `75-90`: crowded bullish
- `90-100`: bullish extreme

This gives us a standard, explainable normalization instead of only a one-off percentile skip gate.

---

## 9. Sentiment Extremity Normalization

We need a sentiment equivalent of the COT Index.

### Candidate input series

Use one or both:

- `agg_net`
- long-short imbalance derived from aggregate positioning

### Sentiment Index formula

Use the same min-max normalization:

```text
Sentiment Index =
((Current Sentiment Net - Min Sentiment Net over n weeks) /
 (Max Sentiment Net over n weeks - Min Sentiment Net over n weeks)) * 100
```

### Recommended lookbacks to test

- `52 weeks`
- `26 weeks`
- `13 weeks`

Sentiment is structurally faster-moving than COT, so its optimal lookback may be shorter.

### Important warning

Sentiment extremes may behave differently from COT extremes.

Possible outcomes:

- extreme sentiment may mean trend continuation
- extreme sentiment may mean exhaustion
- `crowded + flipped` may be much more informative than `crowded` alone

This must be tested empirically, not assumed.

---

## 10. Phase 1 Research Questions

These are the first questions to answer before building any production logic.

### 9.1 Dealer

- When dealer is extreme bullish or bearish, does following dealer improve or worsen weekly hold returns?
- Does dealer work better in the middle of its range than at the ends?

### 9.2 Commercial

- Same question as dealer.
- Does commercial become more useful when dealer is crowded?

### 9.3 Sentiment

- Does extreme sentiment mean continuation or mean reversion?
- Is sentiment strongest in the mid-range or at the extremes?

### 9.4 Source conflict

When dealer and commercial disagree:

- should we follow the less extreme source?
- should we follow the source whose extremity is moving toward conviction?
- should sentiment break the tie only when it is not itself extreme?

---

## 11. Proposed Test Ladder

Do not jump straight to a composite score.

This ladder now applies to both:

- Concept A: selective gate
- Concept B: always-on selector

### Phase A: Diagnostics only

For each weekly signal, record:

- source direction
- source extremity index
- source 1-week change
- source 4-week change
- next-week raw hold return

Goal:

- understand how returns behave by extremity bucket

### Phase B: Simple source-specific filters

Test each source independently.

Examples:

- follow source only when index is between `25` and `75`
- follow source only when index is between `50` and `85`
- fade source when index is above `90` or below `10`

Goal:

- learn whether extremes are continuation or exhaustion for that source

### Phase C: Forced-choice selector rules

This phase is now the first implementation priority.

For every pair-week:

- the engine must output `LONG` or `SHORT`
- no neutral final output
- no skipped pair-weeks

Examples:

- prefer the less extreme source
- if one source is extreme, downgrade or fade it
- use sentiment as tiebreaker only when sentiment is not itself stretched
- if all signals are weak, still force a choice using fallback ranking

### Phase D: Conflict-resolution rules for selective gating

This is the second concept.

Here the engine is allowed to:

- pass
- reduce
- skip

This phase exists to test whether a lower-frequency, higher-conviction basket can outperform the always-on model enough to justify fewer trades.

### Phase E: Composite context score

Only after the above.

Examples:

- prefer the less extreme source
- prefer the source moving toward conviction, not away from it
- ignore sentiment if sentiment is at an extreme
- ignore COT if COT is at an extreme

Goal:

- find simple rules that beat equal-weight voting

Candidate components:

- direction vote
- extremity penalty
- agreement bonus
- freshness penalty
- acceleration / deceleration term

Goal:

- produce one weekly bias confidence score per pair

---

## 12. Initial Candidate Policies To Test

These are the first concrete policy ideas.

### Policy 1: Always-on less-extreme-wins

When `dealer` and `commercial` disagree:

- prefer the less stretched side
- sentiment breaks ties
- never output neutral

### Policy 2: Always-on fade-extremes

For every pair-week:

- follow a source normally when it is in a usable range
- if it is at a true extreme, reduce trust or invert it
- combine all three into one final `LONG` or `SHORT`

### Policy 3: Mid-range preference

Only trust a source when its index is not extreme.

Examples:

- use `dealer` only if dealer index is `25-85`
- use `commercial` only if commercial index is `25-85`
- use `sentiment` only if sentiment index is `20-80`

### Policy 4: Extreme means reversal risk

If a source is above `90` or below `10`:

- do not automatically reverse it
- downgrade its confidence
- require confirmation from another source before following it

### Policy 5: Agreement plus moderation

If 2 or 3 sources agree:

- high confidence only if none are extreme
- medium confidence if one is crowded
- low confidence if agreement exists but all agreeing sources are stretched

---

## 13. Metrics For Every Test

Each policy must be compared against:

- baseline weekly hold
- current dealer-only
- current commercial-only
- current sentiment-only
- current agreement strategies

Required metrics:

- net return
- trades
- win rate
- average weekly return
- max drawdown
- worst week
- losing weeks
- skipped-trade count
- pass rate by source

For the always-on selector specifically:

- pair-weeks classified
- final long count
- final short count
- accuracy by pair-week
- accuracy by asset class

For the selective gate specifically:

- skip rate
- reduce rate
- kept-trade win rate
- lost opportunity on skipped weeks

Additional diagnostic tables:

- returns by extremity bucket
- win rate by extremity bucket
- returns by agreement + extremity state

---

## 14. Non-Goals For Phase 1

Do not do these yet:

- no new intraday entry logic
- no ADR overlays
- no MSS confirmation layer
- no price-action reversal overlay
- no production strategy selection changes

Phase 1 is about understanding whether **historical extremes improve weekly bias quality**.

---

## 15. Expected Output Of This Research Track

By the end of the first pass, we should know:

1. whether COT extremes are useful as trend filters, reversal filters, or neither
2. whether sentiment extremes are useful as trend filters, reversal filters, or neither
3. whether less-extreme source selection improves dealer vs commercial conflict weeks
4. whether a composite weekly context engine is justified

---

## 16. Recommended First Implementation Order

1. Build a diagnostic script that computes:
   - dealer index
   - commercial index
   - sentiment index
   - weekly forward return
2. Bucket weekly outcomes by extremity range
3. Build the always-on forced-choice selector
4. Compare it against dealer / commercial / sentiment / current agreement baselines
5. Build the selective gate version second
6. Compare selective gate vs always-on selector directly
7. Only then design the production context score

This should begin as research code, not app code.

---

## 17. Immediate Next Step

First research script should support the always-on path first:

- generate normalized weekly extremity indexes for `dealer`, `commercial`, and `sentiment`
- join them to closed-week forward returns
- produce bucketed performance tables
- force one final `LONG` or `SHORT` decision for every pair-week

Then the second script or mode should run the selective gate variant so both concepts can be compared on the same data.

That is the minimum viable dataset needed before making any bias-selection decision.
