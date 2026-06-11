# FX Strength Filter Research

Date: `2026-03-30`

## Goal

Test whether Limni week-open strength can improve current surfaced systems, especially:

- `ADR pullback`
- `weekly_hold`
- `FX only`
- systems:
  - `dealer`
  - `commercial`
  - `sentiment`
  - `tiered_v3`
  - `agree_2of3`
  - `selector_sentiment_override`

## Data / Method

- Engine path: app-backed `computeMultiWeekHold`
- ADR source run: `strategy_backtest_runs.id = 54`
- Window tested: `2026-01-19T00:00:00.000Z` through `2026-03-22T23:00:00.000Z`
- Realized weeks: `10`
- Strength timing: most recent snapshot available at `week_open_utc`
- Strength windows tested:
  - `4h`
  - `24h`

### Signed strength definition

For FX:

- raw spread = `base normalized strength - quote normalized strength`
- signed spread =
  - `LONG`: `raw spread`
  - `SHORT`: `-raw spread`

Interpretation:

- negative signed spread = strength is `against` the trade
- positive signed spread = strength is `with` the trade

### Buckets

- `strongly_against`: `< -25`
- `against`: `-25 to -5`
- `neutral`: `-5 to +5`
- `with`: `+5 to +25`
- `strongly_with`: `> +25`

## Scripts used

- [adr-backtest-strength-buckets-all-systems.ts](/c:/Users/User/Documents/GitHub/limni-website/scripts/adr-backtest-strength-buckets-all-systems.ts)
- [tmp-fx-only-adr-summary.ts](/c:/Users/User/Documents/GitHub/limni-website/scripts/tmp-fx-only-adr-summary.ts)
- [tmp-weekly-hold-strength-fx.ts](/c:/Users/User/Documents/GitHub/limni-website/scripts/tmp-weekly-hold-strength-fx.ts)

## Main findings

### 1. ADR pullback: counter-strength is not a universal sitewide filter

Across all surfaced systems and all supported assets, `against / strongly against` did **not** hold up as a universal pass/fail filter for ADR pullback.

What happened:

- it often reduced profit too much
- it did not improve drawdown enough to justify itself
- some systems had their best ADR buckets in `strongly_with`, not `against`

Conclusion:

- do **not** add a global ADR strength filter to the site based on this result alone

### 2. FX-only ADR baselines are still useful context

FX-only ADR baselines on the same 10-week window:

| System | Return | Max DD | Losing Weeks | Trades | WR |
|---|---:|---:|---:|---:|---:|
| `dealer` | `+9.66%` | `-1.76%` | `2/10` | `134` | `85.82%` |
| `commercial` | `+3.80%` | `-2.14%` | `1/10` | `59` | `93.22%` |
| `sentiment` | `+31.40%` | `-2.27%` | `2/10` | `378` | `88.62%` |
| `tiered_v3` | `+30.80%` | `-2.07%` | `2/10` | `382` | `88.22%` |
| `agree_2of3` | `+14.05%` | `-0.67%` | `1/10` | `189` | `88.89%` |
| `selector` | `+21.34%` | `-0.43%` | `1/10` | `210` | `88.10%` |

### 3. FX-only weekly hold: counter-strength looks very strong

This is the surprising result.

For `weekly_hold`, `FX only`, several systems improved materially when keeping trades where week-open strength was `against / strongly against` the trade direction.

This is the opposite of the original momentum-alignment hypothesis.

## Weekly hold FX-only results

### Baselines

| System | Baseline Return | Baseline Max DD | Losing Weeks | Trades |
|---|---:|---:|---:|---:|
| `dealer` | `+25.00%` | `-3.21%` | `3/10` | `150` |
| `commercial` | `-24.82%` | `-24.82%` | `7/10` | `144` |
| `sentiment` | `+45.73%` | `-18.44%` | `4/10` | `215` |
| `tiered_v3` | `+45.92%` | `-19.64%` | `3/10` | `193` |
| `agree_2of3` | `+23.70%` | `-6.48%` | `3/10` | `101` |
| `selector` | `+31.53%` | `-14.67%` | `3/10` | `280` |

### Best simple filter by system

Using the simplest deployable rule first: `keep 4h against + strongly against`

| System | Filtered Return | Filtered Max DD | Losing Weeks | Trades | Notes |
|---|---:|---:|---:|---:|---|
| `dealer` | `+30.99%` | `-2.98%` | `1/10` | `76` | Strong improvement |
| `commercial` | `-2.93%` | `-10.00%` | `3/10` | `56` | Less bad, still not good |
| `sentiment` | `+68.53%` | `-3.39%` | `1/10` | `96` | Massive improvement |
| `tiered_v3` | `+54.03%` | `-3.39%` | `1/10` | `90` | Massive improvement |
| `agree_2of3` | `+27.00%` | `-2.44%` | `1/10` | `44` | Strong improvement |
| `selector` | `+38.78%` | `0.00%` | `0/10` | `136` | Strongest result in the study |

### Stronger combined rules

These look even better on this sample, but are also more likely to be overfit because they are stricter.

#### `agree_2of3`

- baseline: `+23.70%`, DD `-6.48%`, losing weeks `3/10`
- `4h and 24h both against+`: `+25.86%`, DD `-0.86%`, losing weeks `1/10`
- `4h or 24h against+`: `+26.41%`, DD `-2.44%`, losing weeks `1/10`
- `4h against+ and 24h not with+`: `+27.67%`, DD `-0.86%`, losing weeks `1/10`

#### `selector`

- baseline: `+31.53%`, DD `-14.67%`, losing weeks `3/10`
- `4h and 24h both against+`: `+27.23%`, DD `-0.25%`, losing weeks `2/10`
- `4h or 24h against+`: `+40.36%`, DD `0.00%`, losing weeks `0/10`
- `4h against+ and 24h not with+`: `+29.25%`, DD `-0.01%`, losing weeks `1/10`

#### `sentiment`

- baseline: `+45.73%`, DD `-18.44%`, losing weeks `4/10`
- `4h and 24h both against+`: `+59.32%`, DD `-0.64%`, losing weeks `1/10`
- `4h or 24h against+`: `+68.03%`, DD `-3.39%`, losing weeks `2/10`
- `4h against+ and 24h not with+`: `+62.19%`, DD `0.00%`, losing weeks `0/10`

#### `tiered_v3`

- baseline: `+45.92%`, DD `-19.64%`, losing weeks `3/10`
- `4h and 24h both against+`: `+50.88%`, DD `-0.64%`, losing weeks `1/10`
- `4h or 24h against+`: `+53.52%`, DD `-3.39%`, losing weeks `2/10`
- `4h against+ and 24h not with+`: `+53.74%`, DD `0.00%`, losing weeks `0/10`

## Interpretation

Current working hypothesis:

- for FX weekly hold, short-term aligned strength may indicate the move is already extended
- short-term counter-strength may indicate better entry context for a higher-timeframe weekly thesis
- that makes `against / strongly against` look more like a quality filter than a contradiction

## Product implication

If this is turned into a site feature, the safest first version is probably:

1. expose signed week-open strength bucket on the board
2. do **not** hard-filter by default yet
3. allow users to view:
   - `against / strongly against`
   - `neutral`
   - `with / strongly with`
4. if a default filter is later added, start with:
   - `FX only`
   - `weekly_hold`
   - `4h against + strongly against`

Why this version first:

- simplest to explain
- strongest broad behavior across the positive systems
- less likely to be overfit than a more complicated `4h + 24h` combination

## Caveats

- sample size is still small: `10` realized weeks
- these are not independent market regimes
- combined rules that look nearly perfect may be genuine, but may also be overfit to this short window
- index strength is not yet available in the stored strength system, so this research is strongest for `FX`

## Robustness check

I also split the strongest weekly-hold FX rule into the first `5` weeks vs the last `5` weeks.

Rule checked:

- `4h keep against + strongly against`
- missing early strength snapshots passed through unchanged, matching the main study

### Result

The effect did not disappear in the back half of the sample.

#### `selector`

- full sample baseline: `+31.53%`, DD `-14.67%`
- full sample filtered: `+38.78%`, DD `0.00%`
- first 5 weeks baseline: `+5.90%`
- first 5 weeks filtered: `+26.51%`
- last 5 weeks baseline: `+25.63%`
- last 5 weeks filtered: `+12.28%`, DD `0.00%`

#### `agree_2of3`

- full sample baseline: `+23.70%`, DD `-6.48%`
- full sample filtered: `+27.00%`, DD `-2.44%`
- first 5 weeks baseline: `+26.37%`
- first 5 weeks filtered: `+25.24%`
- last 5 weeks baseline: `-2.67%`
- last 5 weeks filtered: `+1.76%`

#### `sentiment`

- full sample baseline: `+45.73%`, DD `-18.44%`
- full sample filtered: `+68.53%`, DD `-3.39%`
- first 5 weeks baseline: `+55.41%`
- first 5 weeks filtered: `+65.81%`
- last 5 weeks baseline: `-9.67%`
- last 5 weeks filtered: `+2.73%`

#### `tiered_v3`

- full sample baseline: `+45.92%`, DD `-19.64%`
- full sample filtered: `+54.03%`, DD `-3.39%`
- first 5 weeks baseline: `+56.79%`
- first 5 weeks filtered: `+51.46%`
- last 5 weeks baseline: `-10.87%`
- last 5 weeks filtered: `+2.57%`

Interpretation:

- the filter is not just juicing already-good weeks
- in several cases it materially improved the bad back half of the sample
- that makes the result more credible, though still not production-proven

## Current recommendation

### For research

- continue with `FX only`
- focus on `weekly_hold`
- prioritize:
  - `selector`
  - `agree_2of3`
  - `sentiment`
  - `tiered_v3`

### For product

Build a non-destructive strength overlay first:

- signed week-open `4h` strength
- signed week-open `24h` strength
- bucket label per pair
- optional board filter for `against / strongly against`

That gives validation in the UI before hard-coding it into strategy selection logic.

## Focused head-to-head

Direct comparison requested:

- `selector`
- `agree_2of3`
- `FX only`
- `weekly_hold`
- filter: `4h against + strongly against`

### `agree_2of3`

- baseline: `+23.70%`, DD `-6.48%`, losing weeks `3/10`, trades `101`, WR `56.4%`
- filtered: `+27.00%`, DD `-2.44%`, losing weeks `1/10`, trades `44`, WR `77.3%`

Notable week changes:

- `2026-03-15T23:00:00.000Z`: baseline `-2.38%` -> filtered `+1.38%`
- `2026-03-22T23:00:00.000Z`: baseline `-3.28%` -> filtered `0.00%`

### `selector`

- baseline: `+31.53%`, DD `-14.67%`, losing weeks `3/10`, trades `280`, WR `57.9%`
- filtered: `+38.78%`, DD `0.00%`, losing weeks `0/10`, trades `136`, WR `66.2%`

Notable week changes:

- `2026-01-26T00:00:00.000Z`: baseline `-0.59%` -> filtered `+1.65%`
- `2026-02-09T00:00:00.000Z`: baseline `-14.67%` -> filtered `+1.84%`
- `2026-03-15T23:00:00.000Z`: baseline `-5.16%` -> filtered `+1.89%`

### Practical conclusion

On this exact setup, `selector` is the stronger filtered weekly-hold FX model.

If forced to choose one candidate to put in front of users first, it would be:

- `selector`
- `FX only`
- `weekly_hold`
- `4h against + strongly against`

But I still recommend:

1. launch as an overlay / optional board filter first
2. keep the strength bucket visible
3. watch a few more closed weeks before making it a hard default

Reason:

- the result is extremely strong
- but it is still only a `10` week sample
- the correct product move is to expose the information now without overcommitting the engine default yet

## Normalized multi-timeframe gate study

After the `4h` and `4h/24h` runs, I tested a more robust gate built from the full recorded FX strength stack:

- `1h`
- `4h`
- `24h`

Instead of using exact bucket magnitudes, each window is collapsed to:

- `against`
- `neutral`
- `with`

where:

- `against` = signed spread `< -5`
- `neutral` = `-5 to +5`
- `with` = signed spread `> +5`

### Composite gate candidates tested

- `net_counter`
- `majority_counter`
- `any_counter_no_with`
- `avg_signed_lt_0`
- `avg_signed_lt_neg5`
- `non_pro_majority`
- `no_with_all_windows`

### Recommended normalized gate

The strongest product candidate is:

- `net_counter`

Definition:

- classify `1h`, `4h`, and `24h` as `against / neutral / with`
- score `against = -1`, `neutral = 0`, `with = +1`
- keep the FX pair if the summed score is `< 0`

Plain English:

- more short-term windows must be counter-trend than pro-trend

Why this is the best normalized gate:

- uses every recorded timeframe
- collapses `against` and `strongly against` into one robust state
- avoids hand-picking one timeframe
- avoids relying on a more fragile exact spread threshold average
- performs very similarly to the best composite rules while being easier to explain and maintain

## Neutral normalization check

The final open question was whether `neutral` should be treated like `against` inside the normalized gate.

Two explicit variants were tested:

- `non_pro_majority`
  - at least `2/3` windows are `neutral` or `against`
- `no_with_all_windows`
  - all windows are `neutral` or `against`

Conclusion:

- `neutral` should **not** be normalized into `against` for the one-size-fits-all engine gate

Why:

- for `weekly_hold`, the strongest systems were usually better with strict counter-trend pressure than with neutral folded in
- for `ADR`, folding neutral in was often less harmful than strict counter-only, but it still usually cut return versus baseline
- that means `neutral = against` is not the more robust universal rule

Practical product implication:

- keep `neutral` as a true middle state internally
- let the gate pass only when counter-trend pressure outweighs pro-trend pressure
- that keeps the single user-facing filter simple while preserving the cleaner cross-system behavior

## Composite gate results

### Weekly hold, FX only

#### `selector`

- baseline: `+31.53%`, DD `-14.67%`, losing weeks `3/10`, trades `280`
- `net_counter`: `+29.76%`, DD `0.00%`, losing weeks `0/10`, trades `141`

#### `agree_2of3`

- baseline: `+23.70%`, DD `-6.48%`, losing weeks `3/10`, trades `101`
- `net_counter`: `+26.79%`, DD `-2.44%`, losing weeks `1/10`, trades `49`

#### `sentiment`

- baseline: `+45.73%`, DD `-18.44%`, losing weeks `4/10`, trades `215`
- `net_counter`: `+60.80%`, DD `-3.39%`, losing weeks `1/10`, trades `97`

#### `tiered_v3`

- baseline: `+45.92%`, DD `-19.64%`, losing weeks `3/10`, trades `193`
- `net_counter`: `+52.35%`, DD `-3.39%`, losing weeks `1/10`, trades `95`

Interpretation:

- the normalized gate still preserves the core weekly-hold edge
- it is not dependent on one specific timeframe
- `selector` still looks like the cleanest weekly-hold implementation if the priority is smoothness and no losing weeks

### ADR pullback, FX only

#### `selector`

- baseline: `+21.34%`, DD `-0.43%`, losing weeks `1/10`, trades `210`
- `net_counter`: `+12.18%`, DD `-0.43%`, losing weeks `1/10`, trades `116`

#### `agree_2of3`

- baseline: `+14.05%`, DD `-0.67%`, losing weeks `1/10`, trades `189`
- `net_counter`: `+9.29%`, DD `0.00%`, losing weeks `0/10`, trades `92`

#### `sentiment`

- baseline: `+31.40%`, DD `-2.27%`, losing weeks `2/10`, trades `378`
- `net_counter`: `+17.05%`, DD `0.00%`, losing weeks `0/10`, trades `182`

#### `tiered_v3`

- baseline: `+30.80%`, DD `-2.07%`, losing weeks `2/10`, trades `382`
- `net_counter`: `+16.45%`, DD `0.00%`, losing weeks `0/10`, trades `186`

Interpretation:

- for ADR, the normalized gate usually improves smoothness
- but it cuts return too much to call it the better default
- that means the same gate can still be exposed as an option, but ADR should likely default to `no strength gate`

## Neutral variant snapshots

### Weekly hold

- `selector`
  - `net_counter`: `+29.76%`, DD `0.00%`, losing weeks `0/10`
  - `non_pro_majority`: `+42.36%`, DD `-0.74%`, losing weeks `1/10`
- `agree_2of3`
  - `net_counter`: `+26.79%`, DD `-2.44%`, losing weeks `1/10`
  - `non_pro_majority`: `+22.43%`, DD `-4.13%`, losing weeks `2/10`
- `sentiment`
  - `net_counter`: `+60.80%`, DD `-3.39%`, losing weeks `1/10`
  - `non_pro_majority`: `+52.85%`, DD `-10.28%`, losing weeks `3/10`
- `tiered_v3`
  - `net_counter`: `+52.35%`, DD `-3.39%`, losing weeks `1/10`
  - `non_pro_majority`: `+45.72%`, DD `-10.44%`, losing weeks `3/10`

Takeaway:

- `selector` is the one notable case where neutral inclusion helped raw return a lot
- but across the stronger weekly-hold systems overall, `neutral = against` was less robust

### ADR pullback

- `selector`
  - `net_counter`: `+12.18%`, DD `-0.43%`, losing weeks `1/10`
  - `non_pro_majority`: `+16.07%`, DD `-0.43%`, losing weeks `1/10`
- `agree_2of3`
  - `net_counter`: `+9.29%`, DD `0.00%`, losing weeks `0/10`
  - `non_pro_majority`: `+13.92%`, DD `0.00%`, losing weeks `0/10`
- `sentiment`
  - `net_counter`: `+17.05%`, DD `0.00%`, losing weeks `0/10`
  - `non_pro_majority`: `+26.38%`, DD `0.00%`, losing weeks `0/10`
- `tiered_v3`
  - `net_counter`: `+16.45%`, DD `0.00%`, losing weeks `0/10`
  - `non_pro_majority`: `+25.79%`, DD `0.00%`, losing weeks `0/10`

Takeaway:

- neutral inclusion helps ADR more than it helps weekly hold
- but because the app needs one unified gate, the cleaner cross-style rule is still `net_counter`

## Current selector recommendation

If the selector is eventually refactored to:

- `Strategy`
- `Filter 1 = Entry Style`
- `Filter 2 = Strength Gate`

then the current best product logic looks like this:

### Entry styles

- `weekly_hold`
- `adr_pullback`

### Strength gate options

- `none`
- `weekly_strength_gate`

### `weekly_strength_gate` definition

- apply to `FX` only
- read week-open `1h`, `4h`, `24h` strength
- collapse each window to `against / neutral / with`
- keep if counter-trend windows outnumber pro-trend windows (`net_counter`)
- pass non-FX assets through unchanged for now

### Best current combinations

- `weekly_hold`: `selector + weekly_strength_gate`
- `adr_pullback`: `selector + none`

That is the cleanest single-gate design supported by the current tests.
