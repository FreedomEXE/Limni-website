# Gate 91 Formulaic V2.2 Terminal-Horizon / Basket-Solvency Diagnostic

Generated: 2026-07-03

## Verdict

`FAIL_V2_2_TERMINAL_HORIZON_SOLVENCY_NOT_BETTER_THAN_V2_1_NO_PROMOTION`

Gate 91 v2.2 tested the cleanest outside-review recommendation:

```text
v2.1 floor-pin base
+ terminal-horizon add feasibility
+ basket green-close solvency
```

Result:

```text
Basket solvency was non-binding.
Terminal-horizon gating reduced depth, but lowered return, PF, Sharpe,
Sortino, Calmar, and Return/DD.
```

This v2.2 shape is not the next keeper. The current best pure-geometry base
remains v2.1 floor-pin / surplus.

## What Was Tested

Base activation:

```text
triangle_formulaic_directionless_geometry_v2_floorpin
```

New v2.2 activations:

```text
triangle_formulaic_directionless_geometry_v2_floorpin_horizon
triangle_formulaic_directionless_geometry_v2_floorpin_solvency
triangle_formulaic_directionless_geometry_v2_floorpin_horizon_solvency
```

All rows stayed directionless:

- No Candidate B.
- No David side bias.
- No Katarakti trigger.
- No red-news logic.
- No MT5/live/app work.

Execution surface:

- all 28 pairs
- bar path `open`
- signal clock `m1`
- target mode `session_center_band_reversion`
- grid adds `adverse_only`
- session mode `ny_daily_window`
- trade window `18:05..15:45 ET`
- flatten `16:00 ET`
- Sunday start `20:00 ET`
- protection mode `baseline`

## v2.2 Add Feasibility

V2.2 keeps v2.1 start eligibility:

```text
geometry_quality >= 1
and Q_bend / Q_floor >= 1.25
```

Then it evaluates each proposed adverse add.

### Basket Solvency

For long baskets:

```text
basket_green_price = harmonic_average_entry + break_even_buffer
solvency_pass = basket_green_price <= target_high
```

For short baskets:

```text
basket_green_price = harmonic_average_entry - break_even_buffer
solvency_pass = basket_green_price >= target_low
```

### Terminal Horizon

Long required reversion:

```text
required_reversion_adr =
  max(target_low, basket_green_price) - current_price
```

Short required reversion:

```text
required_reversion_adr =
  current_price - min(target_high, basket_green_price)
```

Available reversion budget:

```text
bend_speed_adr_per_min = B_cost / clean_session_minutes

available_reversion_adr =
  bend_speed_adr_per_min
  * minutes_until_flatten
  * balance

available_reversion_adr =
  max(available_reversion_adr - Q_cost, 0)
```

Pass condition:

```text
required_reversion_adr <= available_reversion_adr
```

Receipt:

```text
RFR = required_reversion_adr / max(available_reversion_adr, epsilon)
```

Caveat: average RFR can explode when available budget approaches zero. For this
diagnostic, block rate, average required/available ADR, and realized performance
are more useful than raw average RFR.

## Smoke Result

Window: `AUDCHF`, week `2019-04-14`.

| Row | ADR units | Account % | PF | Entries | Max open | Max depth | Target net | Flatten net |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| v2.1 floor-pin base | `1.836110` | `0.0774` | `2.271787` | `28` | `5` | `4` | `13.73` | `-5.99` |
| v2.2 horizon | `1.863377` | `0.0794` | `2.348348` | `27` | `4` | `3` | `13.73` | `-5.79` |
| v2.2 solvency | `1.836110` | `0.0774` | `2.271787` | `28` | `5` | `4` | `13.73` | `-5.99` |
| v2.2 horizon+solvency | `1.863377` | `0.0794` | `2.348348` | `27` | `4` | `3` | `13.73` | `-5.79` |

Smoke validation: `56` rows, `0` failed.

Read: one-week smoke looked fine, but the bounded windows falsified the idea.

## Old Base vs V2.2

### 2019 All Pairs, Open Path

| Row | ADR units | Raw market % | Account % | PF | Weekly PF | Entries | Max open | Max depth | Max DD % | Return/DD | Target net | Flatten net |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| v2.1 floor-pin base | `728.107258` | `459.119667` | `23.5524` | `1.097770` | `1.393284` | `32772` | `277` | `46` | `-24.7650` | `0.951036` | `19306.69` | `-16951.45` |
| v2.2 horizon | `676.670419` | `409.418419` | `19.2513` | `1.082586` | `1.335438` | `29757` | `251` | `27` | `-24.6443` | `0.781166` | `19005.49` | `-17080.36` |
| v2.2 solvency | `728.107258` | `459.119667` | `23.5524` | `1.097770` | `1.393284` | `32772` | `277` | `46` | `-24.7650` | `0.951036` | `19306.69` | `-16951.45` |
| v2.2 horizon+solvency | `676.670419` | `409.418419` | `19.2513` | `1.082586` | `1.335438` | `29757` | `251` | `27` | `-24.6443` | `0.781166` | `19005.49` | `-17080.36` |

### 2026 All Pairs, Open Path

| Row | ADR units | Raw market % | Account % | PF | Weekly PF | Entries | Max open | Max depth | Max DD % | Return/DD | Target net | Flatten net |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| v2.1 floor-pin base | `496.655106` | `332.547785` | `10.7569` | `1.069909` | `1.335111` | `21065` | `187` | `83` | `-10.1006` | `1.064976` | `12388.39` | `-11312.70` |
| v2.2 horizon | `378.061345` | `254.522204` | `5.2694` | `1.034445` | `1.158803` | `19240` | `176` | `33` | `-13.4422` | `0.392004` | `12319.76` | `-11792.82` |
| v2.2 solvency | `496.655106` | `332.547785` | `10.7569` | `1.069909` | `1.335111` | `21065` | `187` | `83` | `-10.1006` | `1.064976` | `12388.39` | `-11312.70` |
| v2.2 horizon+solvency | `378.061345` | `254.522204` | `5.2694` | `1.034445` | `1.158803` | `19240` | `176` | `33` | `-13.4422` | `0.392004` | `12319.76` | `-11792.82` |

## Fund-Manager Metric Targets

Metric conventions:

- Sharpe and Sortino use weekly `equity_delta_usd / initial_deposit_usd`.
- Sharpe uses sample standard deviation.
- Sortino uses negative-week downside sample deviation.
- Calmar uses geometric annualized return over replayed weeks divided by max
  equity drawdown.
- MFE/MAE uses close-cycle/grid basket MFE and MAE, not fill-level trades.
- Expectancy uses average realized ADR per close-cycle/grid basket.
- Losing days are not available in these summary-only artifacts. Losing weeks
  are reported.

Target scale:

| Metric | Goal |
|---|---:|
| Profit factor | `1.5+` |
| Sharpe | `1.5+` |
| Sortino | `2.0+` |
| Calmar | `2.0+` |
| MFE/MAE | `2.0+` |
| Expectancy ADR / grid cycle | `1.0+` |
| Return/DD | `2.0+` |
| Profitable weeks | `65%+` |
| Max losing weeks in row | `<= 3` |
| Max DD duration | `<= 4 weeks` research target |

### 2019 Target Scorecard

| Row | PF | Sharpe | Sortino | Calmar | MFE/MAE | Expectancy | DD duration | Return/DD | Profitable weeks | Max losing weeks |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| v2.1 floor-pin base | `1.097770` | `0.778916` | `0.704984` | `1.355321` | `0.641967` | `0.068787` | `21` | `0.951036` | `21/38` | `4` |
| v2.2 horizon | `1.082586` | `0.708841` | `0.686731` | `1.105446` | `0.656989` | `0.063927` | `21` | `0.781166` | `20/38` | `4` |
| v2.2 solvency | `1.097770` | `0.778916` | `0.704984` | `1.355321` | `0.641967` | `0.068787` | `21` | `0.951036` | `21/38` | `4` |
| v2.2 horizon+solvency | `1.082586` | `0.708841` | `0.686731` | `1.105446` | `0.656989` | `0.063927` | `21` | `0.781166` | `20/38` | `4` |

### 2026 Target Scorecard

| Row | PF | Sharpe | Sortino | Calmar | MFE/MAE | Expectancy | DD duration | Return/DD | Profitable weeks | Max losing weeks |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| v2.1 floor-pin base | `1.069909` | `0.780145` | `0.879052` | `2.244511` | `0.591998` | `0.070218` | `13` | `1.064976` | `14/26` | `3` |
| v2.2 horizon | `1.034445` | `0.393346` | `0.397090` | `0.804665` | `0.623450` | `0.053451` | `13` | `0.392004` | `14/26` | `3` |
| v2.2 solvency | `1.069909` | `0.780145` | `0.879052` | `2.244511` | `0.591998` | `0.070218` | `13` | `1.064976` | `14/26` | `3` |
| v2.2 horizon+solvency | `1.034445` | `0.393346` | `0.397090` | `0.804665` | `0.623450` | `0.053451` | `13` | `0.392004` | `14/26` | `3` |

## Feasibility Receipts

### 2019

| Row | Horizon checks | Horizon blocked | Horizon block % | Solvency checks | Solvency blocked | Avg required ADR | Avg available ADR |
|---|---:|---:|---:|---:|---:|---:|---:|
| v2.2 horizon | `123899` | `104727` | `84.53%` | `0` | `0` | `0.997089` | `0.657956` |
| v2.2 solvency | `0` | `0` | n/a | `22187` | `0` | `0.599481` | `1.865964` |
| v2.2 horizon+solvency | `123899` | `104727` | `84.53%` | `123899` | `0` | `0.997089` | `0.657956` |

### 2026

| Row | Horizon checks | Horizon blocked | Horizon block % | Solvency checks | Solvency blocked | Avg required ADR | Avg available ADR |
|---|---:|---:|---:|---:|---:|---:|---:|
| v2.2 horizon | `77366` | `65199` | `84.27%` | `0` | `0` | `0.992085` | `0.688462` |
| v2.2 solvency | `0` | `0` | n/a | `13992` | `0` | `0.584316` | `2.069606` |
| v2.2 horizon+solvency | `77366` | `65199` | `84.27%` | `77366` | `0` | `0.992085` | `0.688462` |

Add-check caveat: these are check observations, not unique blocked add levels.
They are useful as a pressure gauge but should not be read as unique trade
events.

## Researcher Opinion

The outside reviewers were directionally right about the problem:

```text
The leak is adverse inventory that reaches daily flatten before it can close
green.
```

But this exact terminal-horizon formula is too blunt. It blocks about `84%` of
observed adverse-add checks, cuts depth, and still does not reduce flatten
loss. In 2026 it made flatten net worse from `-11312.70` to `-11792.82`, while
account return fell from `10.7569%` to `5.2694%`.

Basket solvency did not matter at all in this test. The proposed add almost
always still allowed a green basket close inside the target band, so solvency
was not the missing filter.

The important lesson is narrower:

```text
Do not stop feeding because a formula says the whole session budget is weak.
Stop feeding when the next add is late, deep, and not backed by recent
reversion evidence.
```

The next useful pure-grid test should be an add-feed throttle, not a universal
terminal-horizon veto:

1. Keep v2.1 floor-pin / surplus as the base.
2. Allow normal adds early in session.
3. In the final session segment, require recent MFE since last fill or a fresh
   center-band approach before another adverse add.
4. Make the threshold Q-based, not fixed:

```text
late_session = minutes_until_flatten < clean_session_minutes * t_late
recent_reversion = mfe_since_last_fill >= r * Q
or distance_to_target_band <= b * Q

if late_session and not recent_reversion:
  block next adverse add
```

First-pass structural constants can be scaffolded, but they should be treated
as research rails, not final law.

## Decision

Do not promote v2.2.

Do not keep this terminal-horizon rule as the next base.

Do not add Direction or Katarakti yet.

Gate 91 should continue with one more pure-grid test:

```text
v2.3 = v2.1 floor-pin / surplus
+ late-session add-feed throttle
+ recent-reversion evidence since last fill
```

If v2.3 also fails to lift PF/MFE-MAE/expectancy, then directionless geometry is
probably near its standalone ceiling under daily flatten and Direction /
Katarakti should re-enter as separate evidence layers.

## Artifacts

- v2.2 outside-review synthesis:
  `docs/research/gates/gate91/GATE91_V2_2_OUTSIDE_REVIEW_SYNTHESIS_2026-07-03.md`
- v2.2 smoke:
  `docs/research/gates/gate91/artifacts/gate91-formulaic-v22-smoke-audchf-2019-1w/GATE91_FORMULAIC_V22_SMOKE_AUDCHF_2019_1W.md`
- v2.2 2019 bounded run:
  `docs/research/gates/gate91/artifacts/gate91-formulaic-v22-ab-2019-open/GATE91_FORMULAIC_V22_AB_2019_OPEN.md`
- v2.2 2026 bounded run:
  `docs/research/gates/gate91/artifacts/gate91-formulaic-v22-ab-2026-open/GATE91_FORMULAIC_V22_AB_2026_OPEN.md`

Validation:

- smoke: `56` rows, `0` failed
- 2019: `56` rows, `0` failed
- 2026: `56` rows, `0` failed

## Stop Line

Gate 91 remains formulaic grid-geometry research only. No MT5/live/app work,
no promotion, no red-news implementation, no 2020/year-by-year expansion, no
full matrix restart, no full seven-pair handshake gate, and no Candidate B
direction dependency.
