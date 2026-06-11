# Strength With-Trend Research

Date: `2026-03-30`

## Status

This note replaces the earlier strength-fade optimism.

The earlier fade research was skewed by a timestamp parsing bug in the research scripts:

- `currency_strength_snapshots.snapshot_time_utc` is stored as `timestamp without time zone`
- JS `new Date(snapshot_time_utc)` treated those values as local time
- that shifted some week-open reads forward by several hours
- result: research sometimes used stale or wrong strength snapshots

The parity-correct scripts now use a shared UTC-naive parser:

- [utcNaive.ts](/c:/Users/User/Documents/GitHub/limni-website/scripts/lib/utcNaive.ts)

## Core takeaway

`Strength as a fade gate` did not hold up.

The more promising direction is:

- `raw strength`
- `with-trend`
- either as:
  - a standalone source
  - or an agreement source with an existing model

## Scripts

Parity-correct standalone test:

- [tmp-strength-standalone-withtrend.ts](/c:/Users/User/Documents/GitHub/limni-website/scripts/tmp-strength-standalone-withtrend.ts)

Parity-correct agreement test:

- [tmp-strength-withtrend-agreement.ts](/c:/Users/User/Documents/GitHub/limni-website/scripts/tmp-strength-withtrend-agreement.ts)

Parity-correct `2/4`, `3/4`, `4/4` audit harness:

- [tmp-strength-3of4-agree-audit.ts](/c:/Users/User/Documents/GitHub/limni-website/scripts/tmp-strength-3of4-agree-audit.ts)

Parity-correct literal signed-sum `t1` comparison (`strength agree` vs `strength fade`):

- [tmp-strength-t1-fade-vs-agree.ts](/c:/Users/User/Documents/GitHub/limni-website/scripts/tmp-strength-t1-fade-vs-agree.ts)

Updated parity-correct strength research scripts:

- [tmp-fx-composite-strength-gates.ts](/c:/Users/User/Documents/GitHub/limni-website/scripts/tmp-fx-composite-strength-gates.ts)
- [tmp-weekly-hold-strength-fx.ts](/c:/Users/User/Documents/GitHub/limni-website/scripts/tmp-weekly-hold-strength-fx.ts)
- [tmp-weekly-hold-strength-fx-halves.ts](/c:/Users/User/Documents/GitHub/limni-website/scripts/tmp-weekly-hold-strength-fx-halves.ts)
- [tmp-weekly-hold-selector-vs-agree.ts](/c:/Users/User/Documents/GitHub/limni-website/scripts/tmp-weekly-hold-selector-vs-agree.ts)
- [tmp-adr-strength-fx-4h.ts](/c:/Users/User/Documents/GitHub/limni-website/scripts/tmp-adr-strength-fx-4h.ts)
- [adr-backtest-strength-buckets-all-systems.ts](/c:/Users/User/Documents/GitHub/limni-website/scripts/adr-backtest-strength-buckets-all-systems.ts)
- [adr-backtest-cs-weekopen.ts](/c:/Users/User/Documents/GitHub/limni-website/scripts/adr-backtest-cs-weekopen.ts)
- [adr-backtest-cs-filter.js](/c:/Users/User/Documents/GitHub/limni-website/scripts/adr-backtest-cs-filter.js)

## Standalone strength

Rule:

- use the canonical raw composite direction from the Strength data layer
- not faded
- keep when `abs(compositeScore) >= threshold`

### Weekly hold

| Threshold | Net | Max DD | Losing Weeks | Trades | WR |
|---|---:|---:|---:|---:|---:|
| `>= 1` | `+73.12%` | `-39.36%` | `1/10` | `335` | `54.6%` |
| `>= 2` | `+49.84%` | `-39.70%` | `2/10` | `268` | `55.6%` |
| `>= 3` | `+51.85%` | `-33.09%` | `3/10` | `235` | `56.6%` |

Read:

- profitable
- but still too violent in all-asset form

### ADR pullback

| Threshold | Net | Max DD | Losing Weeks | Trades | WR |
|---|---:|---:|---:|---:|---:|
| `>= 1` | `+41.76%` | `0.00%` | `0/10` | `262` | `90.8%` |
| `>= 2` | `+22.45%` | `-2.39%` | `1/10` | `210` | `91.0%` |
| `>= 3` | `+20.84%` | `-2.84%` | `1/10` | `194` | `91.2%` |

Read:

- this is the most interesting first result
- `ADR + raw with-trend strength` looks materially better than `strength fade`

## Agreement tests

Agreement rule:

- base model direction must match raw strength composite direction
- strength confidence threshold:
  - `abs(score) >= 1`
  - `abs(score) >= 2`
  - `abs(score) >= 3`

## Dealer + strength

### Weekly hold

| Config | Net | Max DD | Losing Weeks | Trades | WR |
|---|---:|---:|---:|---:|---:|
| `dealer baseline` | `+116.64%` | `-40.71%` | `2/10` | `230` | `56.5%` |
| `dealer + strength >= 1` | `+77.28%` | `-26.49%` | `2/10` | `94` | `61.7%` |
| `dealer + strength >= 2` | `+48.45%` | `-15.24%` | `4/10` | `76` | `63.2%` |
| `dealer + strength >= 3` | `+51.53%` | `-15.24%` | `4/10` | `70` | `65.7%` |

Read:

- strong DD improvement
- cleaner trade quality
- return drops, but not catastrophically

### ADR pullback

| Config | Net | Max DD | Losing Weeks | Trades | WR |
|---|---:|---:|---:|---:|---:|
| `dealer baseline` | `+28.80%` | `-11.13%` | `1/10` | `202` | `86.1%` |
| `dealer + strength >= 1` | `+25.90%` | `0.00%` | `0/10` | `100` | `91.0%` |
| `dealer + strength >= 2` | `+9.05%` | `-2.31%` | `2/10` | `72` | `90.3%` |
| `dealer + strength >= 3` | `+8.26%` | `-2.31%` | `2/10` | `70` | `90.0%` |

Read:

- `>= 1` is the notable one
- almost baseline return, much cleaner path, half the trades

## Commercial + strength

### Weekly hold

| Config | Net | Max DD | Losing Weeks | Trades | WR |
|---|---:|---:|---:|---:|---:|
| `commercial baseline` | `+28.92%` | `-69.34%` | `5/10` | `224` | `45.1%` |
| `commercial + strength >= 1` | `+42.30%` | `-41.31%` | `5/10` | `102` | `51.0%` |
| `commercial + strength >= 2` | `-2.35%` | `-35.45%` | `5/10` | `81` | `51.9%` |
| `commercial + strength >= 3` | `-4.33%` | `-29.60%` | `6/10` | `65` | `50.8%` |

### ADR pullback

| Config | Net | Max DD | Losing Weeks | Trades | WR |
|---|---:|---:|---:|---:|---:|
| `commercial baseline` | `+20.63%` | `-10.05%` | `3/10` | `129` | `89.1%` |
| `commercial + strength >= 1` | `+20.93%` | `-0.54%` | `1/10` | `65` | `90.8%` |
| `commercial + strength >= 2` | `+2.56%` | `-1.51%` | `2/10` | `39` | `87.2%` |
| `commercial + strength >= 3` | `+2.59%` | `-1.50%` | `2/10` | `31` | `90.3%` |

Read:

- `commercial + strength >= 1` is respectable for ADR
- weekly hold remains too unstable to prioritize

## Sentiment + strength

### Weekly hold

| Config | Net | Max DD | Losing Weeks | Trades | WR |
|---|---:|---:|---:|---:|---:|
| `sentiment baseline` | `+129.13%` | `-21.66%` | `3/10` | `265` | `60.8%` |
| `sentiment + strength >= 1` | `+94.59%` | `-9.59%` | `2/10` | `153` | `64.7%` |
| `sentiment + strength >= 2` | `+45.57%` | `-14.72%` | `3/10` | `118` | `65.3%` |
| `sentiment + strength >= 3` | `+42.18%` | `-15.03%` | `4/10` | `106` | `64.2%` |

Read:

- `>= 1` is strong
- much better DD than baseline
- still large absolute return

### ADR pullback

| Config | Net | Max DD | Losing Weeks | Trades | WR |
|---|---:|---:|---:|---:|---:|
| `sentiment baseline` | `+49.47%` | `-8.78%` | `1/10` | `456` | `88.4%` |
| `sentiment + strength >= 1` | `+39.69%` | `0.00%` | `0/10` | `256` | `91.0%` |
| `sentiment + strength >= 2` | `+21.40%` | `-2.39%` | `1/10` | `206` | `91.3%` |
| `sentiment + strength >= 3` | `+19.79%` | `-2.84%` | `1/10` | `190` | `91.6%` |

Read:

- this is the best agreement result so far
- `sentiment + strength >= 1` preserves strong return
- drawdown collapses to `0.00%` on this sample
- trade quality improves

## Current read

The strongest next candidates are:

1. `sentiment + strength >= 1 + adr_pullback`
2. `dealer + strength >= 1 + adr_pullback`
3. `sentiment + strength >= 1 + weekly_hold`

What this suggests:

- strength probably belongs on the `with-trend` side
- it may be better as a confirming source than as a fade filter
- sentiment is currently the most promising partner

## Next tests

Best next research sequence:

1. `strength + sentiment + dealer`
2. `strength + sentiment + commercial`
3. `3-of-4 agree` using:
   - dealer
   - commercial
   - sentiment
   - strength
4. compare those directly against:
   - `sentiment`
   - `agree_2of3`
   - `selector`

The most likely high-value target right now is:

- `3-of-4 agree`
- `ADR pullback`
- then compare against current surfaced ADR leaders

## `2/4`, `3/4`, `4/4` audit

This section exists specifically because the earlier zero-DD strength results were too easy to overread.

The audit harness:

- uses parity-correct timestamp handling
- shows both `all` and `fx` slices
- keeps the strength source as `raw with-trend`
- tests `2/4`, `3/4`, `4/4`
- tests three strength thresholds:
  - `t1 = abs(score) >= 1`
  - `t2 = abs(score) >= 2`
  - `t3 = abs(score) >= 3`

Sources:

- dealer
- commercial
- sentiment
- strength

### Weekly hold

| Config | Scope | Net | Max DD | Losing Weeks | Trades | WR |
|---|---|---:|---:|---:|---:|---:|
| `2of4_t1` | `all` | `+159.22%` | `-56.89%` | `2/10` | `252` | `61.5%` |
| `2of4_t1` | `fx` | `+70.10%` | `-15.10%` | `2/10` | `179` | `63.7%` |
| `3of4_t1` | `all` | `+100.43%` | `-23.99%` | `2/10` | `94` | `60.6%` |
| `3of4_t1` | `fx` | `+15.64%` | `-7.78%` | `3/10` | `58` | `56.9%` |
| `4of4_t1` | `all` | `+33.73%` | `-10.66%` | `2/10` | `8` | `75.0%` |
| `2of4_t2` | `all` | `+150.33%` | `-57.31%` | `2/10` | `236` | `61.4%` |
| `2of4_t2` | `fx` | `+64.42%` | `-13.94%` | `2/10` | `166` | `63.9%` |
| `3of4_t2` | `all` | `+88.45%` | `-25.01%` | `2/10` | `82` | `62.2%` |
| `3of4_t2` | `fx` | `+12.88%` | `-8.27%` | `3/10` | `49` | `57.1%` |
| `2of4_t3` | `all` | `+151.98%` | `-52.26%` | `2/10` | `240` | `61.3%` |
| `2of4_t3` | `fx` | `+60.84%` | `-15.28%` | `2/10` | `165` | `63.0%` |
| `3of4_t3` | `all` | `+86.48%` | `-25.11%` | `2/10` | `73` | `61.6%` |
| `3of4_t3` | `fx` | `+13.78%` | `-7.31%` | `3/10` | `46` | `58.7%` |

Read:

- `3/4` is cleaner than `2/4` on all-assets weekly hold, but still not obviously deployable
- on the `fx` slice, `3/4` is materially weaker than `2/4`
- `4/4` is too sparse to matter

### ADR pullback

| Config | Scope | Net | Max DD | Losing Weeks | Trades | WR |
|---|---|---:|---:|---:|---:|---:|
| `2of4_t1` | `all` | `+46.66%` | `-8.13%` | `1/10` | `311` | `90.0%` |
| `2of4_t1` | `fx` | `+23.17%` | `-2.38%` | `1/10` | `240` | `90.8%` |
| `3of4_t1` | `all` | `+29.84%` | `-9.58%` | `1/10` | `175` | `89.1%` |
| `3of4_t1` | `fx` | `+9.92%` | `-1.71%` | `2/10` | `110` | `90.9%` |
| `4of4_t1` | `all` | `+15.24%` | `0.00%` | `0/10` | `17` | `94.1%` |
| `2of4_t2` | `all` | `+48.08%` | `-6.96%` | `1/10` | `310` | `90.6%` |
| `2of4_t2` | `fx` | `+24.59%` | `-1.07%` | `1/10` | `239` | `91.6%` |
| `3of4_t2` | `all` | `+26.12%` | `-9.59%` | `2/10` | `157` | `88.5%` |
| `3of4_t2` | `fx` | `+8.56%` | `-2.31%` | `2/10` | `96` | `90.6%` |
| `2of4_t3` | `all` | `+48.17%` | `-10.74%` | `1/10` | `320` | `90.0%` |
| `2of4_t3` | `fx` | `+23.91%` | `-1.52%` | `1/10` | `239` | `90.8%` |
| `3of4_t3` | `all` | `+25.36%` | `-8.07%` | `2/10` | `147` | `89.1%` |
| `3of4_t3` | `fx` | `+8.75%` | `-2.31%` | `2/10` | `93` | `91.4%` |

Read:

- `3/4` is not the sweet spot
- `2/4` is clearly stronger than `3/4` on this sample
- `4/4` again becomes too sparse to trust
- the best-looking family here is `2of4`, especially `t2`

### Current conclusion after the audit

The audit changed the earlier instinct.

Instead of:

- `3/4 agree` as the likely next production candidate

the current evidence says:

- `3/4` is too restrictive
- `4/4` is mostly unusable
- `2/4` is the stronger candidate family

Most promising current combinations:

1. `2of4_t2 + adr_pullback`
2. `sentiment + strength >= 1 + adr_pullback`
3. `dealer + strength >= 1 + adr_pullback`

The main practical read is:

- strength still looks more useful as a `with-trend` source than as a fade gate
- but the strongest next path is probably not `3/4`
- it is more likely a selective `2/4` or a specific pairwise agreement involving sentiment or dealer

## Literal signed-sum `t1`: strength agree vs strength fade

This section uses the exact equal-weight vote model discussed after the earlier audit.

Rule:

- sources:
  - dealer
  - commercial
  - sentiment
  - strength
- per-source vote:
  - bullish `= +1`
  - bearish `= -1`
  - neutral `= 0`
- final bias:
  - sum `> 0` => `LONG`
  - sum `< 0` => `SHORT`
  - sum `= 0` => no trade

This is the literal `t1` version. It is different from the earlier thresholded majority-count audit.

### Weekly hold

| Config | Scope | Net | Max DD | Losing Weeks | Trades | WR |
|---|---|---:|---:|---:|---:|---:|
| `t1_agree` | `all` | `+155.33%` | `-62.13%` | `2/10` | `283` | `59.0%` |
| `t1_agree` | `fx` | `+66.21%` | `-16.50%` | `3/10` | `210` | `60.0%` |
| `t1_fade` | `all` | `+58.44%` | `-24.58%` | `3/10` | `230` | `52.6%` |
| `t1_fade` | `fx` | `-16.90%` | `-23.52%` | `5/10` | `161` | `48.4%` |

Read:

- `strength agree` clearly beats `strength fade`
- `fade` collapses on the `fx` slice
- weekly hold still carries too much drawdown in all-asset form either way

### ADR pullback

| Config | Scope | Net | Max DD | Losing Weeks | Trades | WR |
|---|---|---:|---:|---:|---:|---:|
| `t1_agree` | `all` | `+46.89%` | `-8.13%` | `1/10` | `323` | `89.8%` |
| `t1_agree` | `fx` | `+23.40%` | `-2.38%` | `1/10` | `252` | `90.5%` |
| `t1_fade` | `all` | `+23.69%` | `-10.06%` | `2/10` | `223` | `84.8%` |
| `t1_fade` | `fx` | `+8.65%` | `-2.01%` | `1/10` | `152` | `84.2%` |

Read:

- `strength agree` is again clearly stronger than `strength fade`
- ADR is the cleaner place to keep exploring strength
- the fade variant is not completely dead in all-assets ADR, but it is materially worse than agree

### Current conclusion after the literal `t1` check

This closes the loop on the original question.

If strength is included as an equal fourth vote:

- `use strength agree`
- not `strength fade`

That is true on both:

- `weekly_hold`
- `adr_pullback`

And the cleaner lane remains:

- `ADR pullback`
