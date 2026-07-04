# Gate 91F Marginal Add Value Audit

Generated: 2026-07-03

## Verdict

`PASS_GATE91F_MARGINAL_ADD_VALUE_AUDIT_COMPLETE_NO_PROMOTION`

Gate 91F confirms the v2.3 outside-review concern:

```text
The v2.3 add-throttle signals do not identify a stable bad-add population.
```

The audit explains why late-session reversion evidence improved 2019 but
damaged 2026. On the continued-add surface, the same late/no-bend population
that was weak in 2019 became strongly positive by direct add value in 2026.

Current pure-grid keeper remains:

```text
triangle_formulaic_directionless_geometry_v2_floorpin
```

Do not promote v2.3. Do not implement a tiered late-session reversion throttle
as the next keeper from this evidence.

## Scope

This was a diagnostic-only audit over the v2.1 floor-pin baseline:

```text
triangle_formulaic_directionless_geometry_v2_floorpin
```

Frozen:

- No MT5/live/app work.
- No promotion.
- No red-news implementation.
- No 2020/year-by-year expansion.
- No full matrix restart.
- No full seven-pair handshake gate.
- No Candidate B direction dependency.
- No David side bias.
- No Katarakti trigger integration.

## Counterfactual Boundary

Gate 91F does not run a full branch-and-replay simulator for every candidate
add. That would require a second future replay path per add.

Instead, it records a bounded marginal direct-fill receipt for each actually
opened adverse add on the baseline:

```text
candidate_direct_net_usd
candidate_direct_price_pnl_adr
candidate_direct_swap_usd
candidate_direct_commission_usd
without_candidate_target_eligible_at_actual_close
```

The `without_candidate_target_eligible_at_actual_close` field asks whether the
remaining basket, with only that candidate fill removed, would still satisfy the
selected target condition at the actual close mark. This is useful but not a
full causal path proof.

## Implementation

The runner now writes:

```text
marginal-add-audit.rows.json
marginal-add-audit.rows.csv
```

Rows are emitted only for actual allowed adverse adds on:

```text
triangle_formulaic_directionless_geometry_v2_floorpin
protection_mode=baseline
```

Each row carries:

- v2.3 local reversion evidence fields.
- late-session and progress-last3 fields.
- depth and time-to-flatten buckets.
- floor-pin and surplus-quality buckets.
- close reason and full cycle outcome.
- direct future value of the candidate fill.
- actual-close target eligibility without that candidate fill.

## Test Set

Same bounded Gate 91 v2.3 surface:

```text
bar_path_mode=open
signal_clock=m1
signal_adr_brick=0.1
session_mode=ny_daily_window
trade window=18:05..15:45 ET
flatten=16:00 ET
sunday start=20:00 ET
target_mode=session_center_band_reversion
target_adr=1
spacing_adr=0.2
grid_add_mode=adverse_only
```

## Validation

| Run | Weeks | Pairs | Validation rows | Failed | Add shadow rows | Marginal audit rows |
|---|---:|---:|---:|---:|---:|---:|
| AUDCHF smoke | `1` | `1` | `61` | `0` | `12` | `12` |
| 2019 bounded | `38` | `28` | `61` | `0` | `22187` | `22187` |
| 2026 bounded | `26` | `28` | `61` | `0` | `13992` | `13992` |

## Baseline Replay Check

| Run | Account % | ADR units | PF | Weekly PF | Entries | Max open | Max depth | Max DD % | Target net | Flatten net |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 2019 floor-pin | `23.5524` | `728.107258` | `1.097770` | `1.393284` | `32772` | `277` | `46` | `-24.7650` | `19306.69` | `-16951.45` |
| 2026 floor-pin | `10.7569` | `496.655106` | `1.069909` | `1.335111` | `21065` | `187` | `83` | `-10.1006` | `12388.39` | `-11312.70` |

These match the v2.3 baseline rows.

## Continued Add Audit

The main read excludes first adverse adds because v2.3 deliberately bypassed
the first adverse add.

| Split | Rows | Avg direct net | Avg direct ADR | Positive % | Target % | Flatten % |
|---|---:|---:|---:|---:|---:|---:|
| 2019 all continued adds | `16884` | `0.140727` | `0.033337` | `55.96` | `23.37` | `76.63` |
| 2026 all continued adds | `10567` | `0.096745` | `0.032316` | `55.89` | `24.02` | `75.98` |

Continued adds are not globally negative by direct-fill value in either bounded
period. That weakens the premise that another universal pure add throttle is
the next keeper.

## Reversion Evidence

| Split | Rows | Avg direct net | Avg direct ADR | Positive % | Target % | Flatten % |
|---|---:|---:|---:|---:|---:|---:|
| 2019 reversion pass | `11005` | `0.127877` | `0.033255` | `56.20` | `22.76` | `77.24` |
| 2019 reversion fail | `5879` | `0.164780` | `0.033489` | `55.52` | `24.51` | `75.49` |
| 2026 reversion pass | `7103` | `0.009940` | `0.017369` | `54.41` | `23.60` | `76.40` |
| 2026 reversion fail | `3464` | `0.274739` | `0.062965` | `58.92` | `24.88` | `75.12` |

All-session reversion fail is not bad by direct value. In 2026 it is materially
better than the pass population.

## Late Reversion Evidence

| Split | Rows | Avg direct net | Avg direct ADR | Positive % | Target % | Flatten % |
|---|---:|---:|---:|---:|---:|---:|
| 2019 early reversion pass | `8059` | `0.126533` | `0.035036` | `56.15` | `29.11` | `70.89` |
| 2019 early reversion fail | `4435` | `0.213855` | `0.045598` | `56.35` | `29.31` | `70.69` |
| 2019 late reversion pass | `2946` | `0.131554` | `0.028385` | `56.35` | `5.40` | `94.60` |
| 2019 late reversion fail | `1444` | `0.014055` | `-0.003701` | `52.98` | `9.76` | `90.24` |
| 2026 early reversion pass | `5382` | `-0.040906` | `0.011629` | `54.94` | `29.49` | `70.51` |
| 2026 early reversion fail | `2817` | `0.228537` | `0.058168` | `58.29` | `29.43` | `70.57` |
| 2026 late reversion pass | `1721` | `0.168950` | `0.035322` | `52.76` | `5.17` | `94.83` |
| 2026 late reversion fail | `647` | `0.475899` | `0.083850` | `61.67` | `5.10` | `94.90` |

This is the decisive Gate 91F read.

2019 late reversion fail was nearly flat by direct net and negative by direct
ADR, so blocking it was plausible.

2026 late reversion fail was the best late-reversion bucket by direct net and
ADR, so blocking it damaged the cycle economy.

## Progress Last3

| Split | Rows | Avg direct net | Avg direct ADR | Positive % | Target % | Flatten % |
|---|---:|---:|---:|---:|---:|---:|
| 2019 progress fail | `4359` | `0.064390` | `0.014314` | `55.13` | `6.56` | `93.44` |
| 2019 progress pass | `31` | `4.102430` | `0.512332` | `70.97` | `45.16` | `54.84` |
| 2026 progress fail | `2368` | `0.252816` | `0.048582` | `55.19` | `5.15` | `94.85` |

Progress pass had no useful 2026 population and only `31` continued-add rows in
2019. Progress fail is weak in 2019 but positive in 2026, so it is not a stable
block condition.

## Time To Flatten

| Split | Rows | Avg direct net | Avg direct ADR | Positive % | Target % | Flatten % |
|---|---:|---:|---:|---:|---:|---:|
| 2019 `>=360m` | `10959` | `0.161469` | `0.043222` | `56.61` | `31.80` | `68.20` |
| 2019 `180..360m` | `4490` | `0.162748` | `0.030896` | `55.19` | `9.31` | `90.69` |
| 2019 `60..180m` | `1238` | `-0.119002` | `-0.044943` | `52.10` | `3.39` | `96.61` |
| 2019 `<60m` | `197` | `0.117135` | `0.030980` | `61.93` | `0.51` | `99.49` |
| 2026 `>=360m` | `7196` | `-0.050964` | `0.012180` | `55.31` | `31.84` | `68.16` |
| 2026 `180..360m` | `2633` | `0.522493` | `0.093901` | `58.79` | `8.62` | `91.38` |
| 2026 `60..180m` | `570` | `0.086225` | `0.019485` | `54.21` | `3.51` | `96.49` |
| 2026 `<60m` | `168` | `-0.213314` | `-0.026847` | `41.07` | `0.00` | `100.00` |

The final-hour bucket is bad in 2026 and tiny in both periods. It is not enough
evidence to promote a new pure-grid rule. The broader late-session bucket is
mixed and includes the strongly positive `180..360m` 2026 population.

## Target Eligibility

The candidate fill rarely changed target eligibility at the actual close mark:

| Run | Continued rows | Changed target eligibility % |
|---|---:|---:|
| 2019 | `16884` | `0.78` |
| 2026 | `10567` | `1.17` |

This means most candidate adds were not the single reason a cycle became target
eligible at the actual close mark. Their value mostly came from direct exposure
inside target cycles and direct losses inside flatten cycles.

## Interpretation

Gate 91F turns the v2.3 result into a clearer mechanism:

```text
The bad population is not "continued adverse adds" in general.
The bad population is unresolved flatten-cycle exposure.
The tested local add-throttle signals do not separate it stably.
```

Late-session states are mostly flatten-bound, but the direct add value inside
those states is regime-dependent. A throttle can improve a period by reducing
exposure, then damage another period by blocking adds that are directly
profitable or help reduce loss.

## Decision

Do not implement the proposed tiered late-session reversion throttle as the
next keeper.

Do not run another pure-grid add-throttle row by default.

Preserve the Gate 91F receipts as diagnostic evidence:

```text
marginal-add-audit.rows.*
add-throttle-events.rows.*
```

The next strategy decision should be architectural after Freedom explicitly
opens it:

```text
Direction / side quality
Katarakti / trigger quality
Session lifecycle / flatten-risk quality
```

Gate 91 pure directionless geometry remains useful as the grid base, but it is
not a standalone fund-manager-quality engine under daily flatten.

## Artifacts

- Smoke:
  `docs/research/gates/gate91/artifacts/gate91f-marginal-add-audit-smoke-audchf-2019-1w/GATE91F_MARGINAL_ADD_AUDIT_SMOKE_AUDCHF_2019_1W.md`
- 2019 bounded:
  `docs/research/gates/gate91/artifacts/gate91f-marginal-add-audit-2019-open/GATE91F_MARGINAL_ADD_AUDIT_2019_OPEN.md`
- 2026 bounded:
  `docs/research/gates/gate91/artifacts/gate91f-marginal-add-audit-2026-open/GATE91F_MARGINAL_ADD_AUDIT_2026_OPEN.md`

## Stop Line

Gate 91F is complete as research-only diagnostics. No MT5/live/app work, no
promotion, no red-news implementation, no 2020/year-by-year expansion, no full
matrix restart, no full seven-pair handshake gate, no Candidate B direction
dependency, no David side bias, and no Katarakti trigger integration.
