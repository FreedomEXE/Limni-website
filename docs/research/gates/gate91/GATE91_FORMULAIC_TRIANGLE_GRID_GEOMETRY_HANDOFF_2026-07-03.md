# Gate 91 Formulaic Triangle Grid Geometry Handoff

Generated: 2026-07-03

## Verdict

`OPEN_NEXT_GATE_GATE91_FORMULAIC_TRIANGLE_GRID_GEOMETRY_NO_PROMOTION`

Gate 90D proved that the current strict Triangle scaffold has a real quality
signal, but the geometry is not final. Gate 91 should replace fixed clamp /
parameter thinking with a durable mathematical formula.

The standard for Gate 91 is:

> Build a formulaic grid algorithm that can stand across years because it
> derives its own grid quantum, signal clock, and reversion horizon from market
> structure. Do not optimize random constants until the formula is coherent.

## Why Gate 91 Exists

Freedom flagged the right issue:

- `range / 3 clamped 0.20..0.30 ADR` is adaptive, but the clamp is still a
  research rail, not a proven law.
- ADR-event `0.075` is pair-normalized, but still a fixed coefficient.
- David MA `50` updates with price, but the lookback is still fixed.
- A final system should not depend on cherry-picked clamp ladders or fixed MA
  lengths.

Gate 91 should therefore design and test a formula, not search for a prettier
parameter set.

## Current Gate 90D Evidence To Preserve

Current best strict no-Candidate-B execution shape:

- Activation: `triangle_v0_no_candidate_b`.
- Candidate B: omitted for bot simplicity.
- Bar path: `open` prices for fast diagnostics.
- Signal clock in latest tests: ADR-event `0.075`.
- David in latest tests: LWMA `50`, RSI `50`, OB/OS `60/40`.
- Session: New York clean daily window, flatten at `16:00 ET`.
- Target: profitable David MA reversion.
- Adds: adverse-only.
- Risk: `pain_1q_stop_adds_before_profit_0_5q`.

Important results:

| Window | Mode | ADR units | Fixed-lot account % | Max DD % | PF | Read |
|---|---|---:|---:|---:|---:|---|
| 2019 | baseline | `25.29` | `1.17` | `-2.19` | `1.230` | quality anchor |
| 2019 | pain stop-add | `32.98` | `2.29` | `-0.67` | `1.712` | current best strict protection |
| 2026 | baseline | `-5.58` | `-0.12` | `-2.39` | `0.974` | weak/red |
| 2026 | pain stop-add | `11.06` | `0.55` | `-1.34` | `1.196` | rescued, but weaker than 2019 |

Rejected protection branches:

- Uncapped hold-red: rejected. It created long zombie trades and worse account
  risk.
- Max-3D hold-red: rejected. It fixed zombie age but still did not beat normal
  daily flatten plus pain stop.
- Hard `-2Q` pain circuit: rejected as too blunt by itself.
- Naive global trailing: rejected as not the main fix. Most bad cycles did not
  first earn enough MFE for trailing to matter.

Reporting convention:

- `ADR units` = movement-normalized strategy harvest. This is not account
  return.
- `fixed-lot account %` = current `0.01` lot cash sanity check on a `$10,000`
  account.
- Gate 91 should add raw unnormalized market-percent movement columns before
  final replay freeze.

## Gate 91 System Pieces

### 1. Directional Algorithm

Gate 91 first pass should intentionally ignore direction.

Reason:

If the formulaic grid geometry is real, it should show some harvestable quality
without needing Candidate B or David bias. Direction can be added later as a
separate improvement layer.

First-pass direction policy:

- Directionless / side-neutral diagnostic.
- Either start both sides under the same geometry, or run long and short as
  symmetric separate legs with no directional filter.
- Do not use Candidate B for the first Gate 91 proof.
- Do not use David fixed MA as the primary direction source for the first Gate
  91 proof.

Later direction research can re-enter as:

- Candidate B as a direction evidence term.
- Formulaic David/inverted-David derived from the same adaptive event clock.
- A transparent direction score, not a static menu of variants.

### 2. Grid Geometry Formula

This is the core of Gate 91.

The final grid should not be:

```text
try clamp A, B, C, D and choose the best backtest
```

It should be:

```text
Q = formula(session range, path efficiency, cost floor, current volatility)
```

Where:

- `Q` = grid quantum / spacing in ADR units.
- `R` = completed session range in ADR units.
- `PE` = path efficiency, where low values mean choppy/harvestable and high
  values mean clean/trendy.
- `C` = cost floor in ADR units.
- `Slots` = derived target slot count, not blindly optimized.

Candidate starting equation:

```text
Q_raw = R / (2 + 2 * (1 - PE))
Q = max(Q_raw, C)
```

Meaning:

- Choppier session: denominator moves toward `4`, so Q gets tighter.
- Less choppy session: denominator moves toward `2`, so Q gets wider.
- Too clean/trendy: reject before Q matters.
- Too tiny after costs: reject via cost floor.

This exact equation is not frozen. Gate 91 should test whether this style of
equation is coherent and durable.

### 3. Adaptive Signal Clock / Reversion Horizon

Gate 91 should remove fixed `ADR-event 0.075` as a standalone knob.

Preferred formula:

```text
signal_event_brick = Q / k
```

Likely first principle:

- `k = 3` or `4` as a structural relationship to grid quantum, not an optimized
  standalone clock.
- The signal clock should update faster when Q is small and slower when Q is
  large.

David MA50 should not be frozen as a fixed lookback in Gate 91.

If David-style state is used later, it should become:

```text
reversion_horizon_events = function(session duration, Q, R, PE)
```

But first pass should not depend on it.

### 4. Risk Layer

Preserve the current best simple risk rule:

```text
If cycle reaches -1Q before +0.5Q, stop adding.
```

This is not a stop loss.

- It does not immediately close the trade.
- It stops feeding the grid when pain came before even small profit.
- The cycle can still recover to target.
- If it does not recover, daily flatten closes it.

Daily flatten remains the default. Hold-red variants are rejected until a
stronger formulaic exception exists.

## Gate 91 First Test Shape

Build the formula first, then replay it with minimal comparisons.

Recommended first diagnostic:

- Window A: 2019 old problem window.
- Window B: 2026 recent window.
- Optional after A/B pass: full Gate 74B available history.
- Bar path: `open` first for speed.
- Direction: directionless / no directional bias.
- Geometry: formulaic Q from `R`, `PE`, and cost floor.
- Signal clock: derived from Q, not fixed `0.075`.
- Target: formulaic reversion target, preferably session midpoint / box mean or
  adaptive mean, not fixed David MA50.
- Risk: pain-first stop-add.
- Flatten: daily flatten.

Primary comparison:

1. Formulaic geometry without direction, no pain stop.
2. Formulaic geometry without direction, with pain stop.

Only after that:

3. Add David-style formulaic direction.
4. Add Candidate B direction evidence.
5. Add Katarakti premium class / larger target segmentation.

## What Not To Do In Gate 91

- Do not start MT5/live/app work.
- Do not promote strategy logic.
- Do not run 2020/year-by-year expansion before the formula exists.
- Do not restart the old 150-command full matrix.
- Do not optimize clamp ladders.
- Do not make Candidate B the first dependency.
- Do not freeze David MA50.
- Do not add red-news implementation yet.
- Do not build the full seven-pair handshake gate.

## Design Questions Gate 91 Must Answer

1. What exact formula defines Q from session range, path efficiency, and cost
   floor?
2. What is the reject rule for too-clean trend movement?
3. Should target be session midpoint, range mean, formulaic event mean, or
   another non-fixed reversion anchor?
4. Should signal_event_brick be `Q / 3`, `Q / 4`, or a structural function of
   Q and PE?
5. Does directionless geometry produce positive movement quality on 2019 and
   2026?
6. Does pain-stop improve formulaic geometry without hiding a weak base?
7. Are ADR units, raw market-percent movement, and fixed-lot account sanity
   reported separately?

## Recommended Next Chat Opening

Open Gate 91 only.

First task:

1. Read this handoff.
2. Inspect current Gate 90 runner and Triangle helper functions.
3. Add a formulaic geometry scaffold behind a new activation id.
4. Keep directionless first pass.
5. Run a one-pair smoke, then 2019/2026 A/B diagnostics only.

## Stop Line

Gate 91 is formulaic grid geometry research only. It does not open MT5/live/app
work, promotion, red-news implementation, year-by-year expansion, full matrix
restart, or full seven-pair handshake work.
