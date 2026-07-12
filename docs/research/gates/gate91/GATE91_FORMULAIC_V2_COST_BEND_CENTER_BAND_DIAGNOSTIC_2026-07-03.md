# Gate 91 Formulaic V2 Cost-Bend Center-Band Diagnostic

Generated: 2026-07-03

## Verdict

`PASS_V2_SCAFFOLD_AND_BOUNDED_EVIDENCE__FAIL_STANDALONE_RISK_SHAPE_TOO_CHURNY`

Gate 91 now has a second formulaic directionless geometry scaffold behind:

```text
triangle_formulaic_directionless_geometry_v2
```

V2 is mechanically valid and materially improves the first v1 2026 baseline
cash result, but it is not a deployable standalone grid geometry. It makes
positive account return in the 2026 baseline row, but does so by opening too
many cost-floor grids, carrying too much inventory, and realizing very large
session-flatten losses.

The next Gate 91 step should not add Direction or Katarakti yet. It should fix
the v2 geometry selectivity/churn contract.

## Implemented V2 Scaffold

Activation id:

```text
triangle_formulaic_directionless_geometry_v2
```

Formula id:

```text
gate91_formulaic_directionless_grid_geometry_v2_cost_bend_center_band_2026_07_03
```

Target mode:

```text
session_center_band_reversion
```

Direction policy:

- Directionless symmetric long/short.
- No Candidate B.
- No David side filter.
- No Katarakti trigger requirement.

Core v2 receipts:

```text
R = completed session range in ADR units
P_raw = completed-session total absolute close-path movement in ADR units
D = absolute completed-session open-to-close displacement in ADR units
P_cost = sum(max(abs(delta_close_path_adr) - one_way_cost_ADR, 0))
B_cost = max(P_cost - D, 0)
Q_cost = 4 * round_trip_cost_ADR
N_effective = 1 + sqrt(B_cost / Q_cost)
Q = max(Q_cost, current_volatility_floor, R / N_effective)
event_brick = max(Q / 4, Q_cost / 2)
target_band = max(Q / 4, Q_cost / 2)
center = median M1 close of completed session
geometry_quality = (B_cost / Q) * balance
```

First-pass eligibility:

```text
geometry_quality >= 1
```

Entry displacement:

```text
long allowed when price <= center - Q
short allowed when price >= center + Q
```

Close condition:

```text
long closes when price returns to center - target_band and price PnL is positive
short closes when price returns to center + target_band and price PnL is positive
```

Risk A/B:

- `baseline`
- `pain_1q_stop_adds_before_profit_0_5q`

Daily flatten remains active.

Cost caveat:

- The runner models entry commission and swap.
- Explicit spread and slippage are still not modeled.
- V2 derives round-trip cost in ADR units from modeled commission when USD
  conversion is available.
- The legacy fallback remains visible through `Q_cost`; in the smoke, many
  cycles sat on `Q = 0.05 ADR`, which is a key warning.

## Smoke Result

Command shape:

- Pair: `AUDCHF`
- Window: `2019-04-14`, one week
- Bar path: `open`
- Target: `session_center_band_reversion`
- Protection: baseline and pain stop-add

| Window | Protection | ADR units | Raw market % | Fixed-lot account % | PF | Win % | Entries | Max open | Max depth | Target net | Flatten net |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| AUDCHF 2019 1w | baseline | `6.443656` | `4.578658` | `0.2822` | `3.468662` | `85.19` | `73` | `14` | `10` | `38.60` | `-10.38` |
| AUDCHF 2019 1w | pain stop-add | `5.711655` | `4.058521` | `0.2622` | `5.554794` | `81.48` | `42` | `11` | `10` | `31.89` | `-5.66` |

Smoke validation: `0` failed rows.

Receipt check: close-event rows now carry:

- `reversion_target_band_adr`
- `triangle_geometry_center_type`
- `triangle_geometry_q_cost_adr`
- `triangle_geometry_round_trip_cost_adr`
- `triangle_geometry_p_raw_adr`
- `triangle_geometry_p_cost_adr`
- `triangle_geometry_b_cost_adr`
- `triangle_geometry_balance`
- `triangle_geometry_quality`
- `triangle_geometry_current_volatility_adr`

## Bounded A/B Evidence

| Window | Protection | ADR units | Raw market % | Fixed-lot account % | PF | Win % | Entries | Max open | Max depth | Max DD % | Target net | Flatten net | Commission | Swap |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 2019 all pairs open | baseline | `1934.799847` | `1262.318526` | `60.3858` | `1.096497` | `88.62` | `95294` | `392` | `71` | `-45.8216` | `54331.73` | `-48293.14` | `-5717.64` | `-1701.21` |
| 2019 all pairs open | pain stop-add | `557.274686` | `375.063311` | `3.6031` | `1.014275` | `86.10` | `46478` | `211` | `53` | `-18.2310` | `20806.76` | `-20446.45` | `-2788.68` | `-671.54` |
| 2026 all pairs open | baseline | `900.585056` | `624.802386` | `10.8944` | `1.026063` | `89.45` | `64743` | `377` | `127` | `-39.8192` | `32675.24` | `-31585.80` | `-3884.58` | `-1062.10` |
| 2026 all pairs open | pain stop-add | `333.497407` | `275.544608` | `-1.0146` | `0.994187` | `86.78` | `32550` | `203` | `110` | `-25.8044` | `14049.08` | `-14150.55` | `-1953.00` | `-393.05` |

Validation:

- Smoke: `0` failed rows.
- 2019 A/B: `0` failed rows.
- 2026 A/B: `0` failed rows.

## Comparison To V1 Directionless Formula

The first v1 scaffold used:

```text
Q = max(R / (2 + 2 * (1 - PE)), 0.05)
target = session midpoint
event brick = Q / 4
```

V1 bounded rows:

| Window | Protection | ADR units | Fixed-lot account % | PF | Entries | Max open | Max depth | Max DD % |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| 2019 | baseline | `703.761268` | `27.9885` | `1.107479` | `32859` | `274` | `40` | `-16.6554` |
| 2019 | pain stop-add | `313.917648` | `6.9786` | `1.043660` | `19891` | `114` | `24` | `-12.3136` |
| 2026 | baseline | `117.366185` | `-6.7906` | `0.961920` | `21822` | `245` | `43` | `-19.5642` |
| 2026 | pain stop-add | `65.055410` | `-4.8150` | `0.953213` | `13072` | `179` | `43` | `-11.4058` |

V2 read versus v1:

- V2 baseline makes the 2026 account positive where v1 baseline was red.
- V2 baseline greatly increases ADR harvest.
- V2 also greatly increases entries, max open, max depth, drawdown, commission,
  swap, and session-flatten losses.
- V2 pain-stop reduces exposure but cuts too much harvest and is red in 2026.
- V2 therefore improves the movement-harvest equation but fails the live-shaped
  inventory/risk equation.

## Research Read

V2 confirms that the outside-review direction was useful:

```text
cost-adjusted bending path + median center + target band finds much more reversion movement.
```

But the first implementation is still too permissive:

```text
geometry_quality >= 1 is not selective enough when Q collapses to the cost floor.
```

The strongest warning is that target-close net and flatten net are nearly
canceling:

| Window | Protection | Target net | Flatten net | Read |
|---|---|---:|---:|---|
| 2019 baseline | `54331.73` | `-48293.14` | gross harvest mostly given back |
| 2026 baseline | `32675.24` | `-31585.80` | same failure repeats |
| 2026 pain stop-add | `14049.08` | `-14150.55` | pain stop cuts harvest to red |

This means the geometry is finding movement, but it is still feeding too many
low-quality or late-session grids whose unresolved inventory reaches daily
flatten.

## Decision

Do not promote v2.

Do not add Direction or Katarakti yet.

Do not start a broad v2 matrix.

V2 is a better research scaffold than v1 because it receipts the right economic
questions, but its first eligibility and Q floor are too loose.

## Next Gate 91 Question

The next question is:

```text
When v2 Q is pinned to Q_cost, is the session actually tradable or just cost-floor churn?
```

Recommended next bounded pass:

1. Analyze v2 close/flatten outcomes by:
   - `triangle_geometry_q_cost_adr`
   - `cycle_spacing_adr`
   - `triangle_geometry_quality`
   - `triangle_geometry_b_cost_adr`
   - `triangle_geometry_balance`
   - close reason
   - max depth
2. Add a no-replay diagnostic over the smoke close-event receipts first.
3. If needed, implement one v2b rule:

```text
Require Q_bend to carry part of Q, instead of allowing almost every valid session to trade at Q_cost.
```

Example design direction, not yet frozen:

```text
Q = max(Q_cost, current_volatility_floor, Q_bend)
session eligible only if Q_bend >= Q_cost * structural_ratio
```

But do not optimize `structural_ratio` as a ladder. First prove whether the
cost-floor-pinned rows are the churn source.

## Artifacts

- Smoke report:
  `docs/research/gates/gate91/artifacts/gate91-formulaic-v2-smoke-audchf-2019-1w/GATE91_FORMULAIC_V2_SMOKE_AUDCHF_2019_1W.md`
- Smoke close-event receipts:
  `docs/research/gates/gate91/artifacts/gate91-formulaic-v2-smoke-audchf-2019-1w/close-events.rows.csv`
- 2019 A/B report:
  `docs/research/gates/gate91/artifacts/gate91-formulaic-v2-ab-2019-open/GATE91_FORMULAIC_V2_AB_2019_OPEN.md`
- 2026 A/B report:
  `docs/research/gates/gate91/artifacts/gate91-formulaic-v2-ab-2026-open/GATE91_FORMULAIC_V2_AB_2026_OPEN.md`

## Stop Line

Research only. No MT5/live/app work, no promotion, no red-news implementation,
no 2020/year-by-year expansion, no full matrix restart, no full seven-pair
handshake gate, and no Candidate B direction dependency.
