# Gate 99B - LRMG Scale / Phase Stability Audit

Date: 2026-07-06

## Scope

This is a verifier/export gate only. It does not change the visible
`LimniLRMGPriceLine` indicator, any trading EA, or any entry/exit rule.

The purpose is to answer one upstream question:

> Is the current LRMG price line stable enough to become an event spine, or is
> it materially sensitive to q scale, grid origin/phase, or both?

## Current Verdict

The first `AUDCAD.i` run is a useful failure and a hard stop for downstream
indicator construction.

Requested start:

`2014.01.01 00:00`

Resolved first M1 source bar:

`2026.03.30 08:01`

That run is therefore `DIAGNOSTIC_AUDIT`, not institutional proof. Even as a
short-history diagnostic, it showed material q-window, phase, and anchor
sensitivity. Do not build Event Stoch, Event David, Event Katarakti, visual
sidecar logic, EA logic, PnL tests, or parameter exploration on top of current
LRMG until the LRMG event-spine contract is stabilized.

## AUDCAD.i v1.02 Rerun

Artifact folder:

`docs/research/gates/gate99/artifacts/lrmg-stability-check-2026-07-06/audcad-i-v102-run/`

Source:

- Symbol: `AUDCAD.i`
- Broker: `Eightcap Global Limited`
- Requested anchor: `2014.01.01 00:00`
- Resolved first M1 source bar: `2026.03.30 08:01`
- End resolved: `2026.07.06 05:34`
- Source bars: `100332`
- `history_shortfall=true`
- `institutional_audit=false`
- `diagnostic_audit=true`
- Baseline q: `0.0007433`

Key diagnostic rows:

| comparison_type | variant / shift | q_change_pct | p95_abs_q | p99_abs_q | side_disagreement_pct |
| --- | ---: | ---: | ---: | ---: | ---: |
| `scale_q_window_base_held` | `1440` bars | `15.5896` | `3.634915` | `6.634915` | `7.7772` |
| `scale_q_window_base_held` | `4320` bars | `411.1688` | `18.329874` | `19.220781` | `32.6805` |
| `scale_q_window_base_held` | `10080` bars | `686.8953` | `17.524188` | `19.524188` | `28.7496` |
| `scale_q_window_base_held` | `43200` bars | `1218.9417` | `17.026457` | `22.621165` | `31.6380` |
| `phase_base_shift_q_held` | `-0.50q` | `0.0000` | `1.500000` | `2.500000` | `6.8861` |
| `phase_base_shift_q_held` | `+0.50q` | `0.0000` | `1.500000` | `2.500000` | `6.8632` |
| `anchor_shift_q_and_base` | `720` bars | `27.3094` | `5.717406` | `7.809784` | `12.5346` |
| `anchor_shift_q_and_base` | `1440` bars | `140.6985` | `16.284345` | `18.743715` | `25.6027` |
| `anchor_shift_q_and_base` | `4320` bars | `240.5496` | `14.462379` | `15.462379` | `25.8030` |
| `anchor_shift_base_only_q_held` | `720` bars | `0.0000` | `1.089761` | `2.089761` | `3.3520` |
| `anchor_shift_base_only_q_held` | `1440` bars | `0.0000` | `0.982131` | `1.017869` | `0.7523` |
| `anchor_shift_base_only_q_held` | `4320` bars | `0.0000` | `1.888161` | `3.111839` | `5.4847` |

Read:

The v1.02 decomposition confirms the hard stop. The dominant failure is q scale
instability. Base/phase instability exists and should still be solved, but it is
not the whole problem. Anchor shifts become severe when q is recomputed.

## Script

Repo source:

`automation/mt5/Scripts/LimniLRMGStabilityCheck.mq5`

Installed active-terminal source:

`C:/Users/User/AppData/Roaming/MetaQuotes/Terminal/94497F60A2BFEA1AFAB110FCF3E331BB/MQL5/Scripts/LimniLRMGStabilityCheck.mq5`

The script reuses:

`automation/mt5/Indicators/Include/LimniRadialMovementGrid.mqh`

## Default Comparisons

Baseline:

- Source timeframe: `PERIOD_M1`
- Anchor request: `2014.01.01 00:00`
- Closed source bars only: `true`
- Baseline bootstrap: `720` M1 bars
- Median brick window: `55`

Variants:

- `1440` M1 bars
- `4320` M1 bars
- `10080` M1 bars
- `43200` M1 bars

Phase shifts:

- `-0.50q`
- `-0.25q`
- `+0.25q`
- `+0.50q`

Anchor shifts:

- `720` source bars forward
- `1440` source bars forward
- `4320` source bars forward

These are perturbation checks, not strategy optimization settings. The goal is
to separate:

- scale instability: q changes while base is held fixed
- phase instability: base/phase changes while q is held fixed
- combined instability: shifted anchor changes both q and base
- anchor/base instability with q held fixed

## Output

Run the script from MT5 Navigator on the current chart symbol.

Default output location:

`Common/Files/LimniLRMGStability/`

Summary CSV pattern:

`<SYMBOL>_PERIOD_M1_lrmg_stability_<timestamp>_summary.csv`

Detail CSV pattern:

`<SYMBOL>_PERIOD_M1_lrmg_stability_<timestamp>_detail.csv`

Important summary columns:

- `broker_company`
- `comparison_type`
- `anchor_shift_bars`
- `phase_shift_q`
- `history_shortfall`
- `institutional_audit`
- `diagnostic_audit`
- `baseline_q`
- `variant_q`
- `q_change_pct`
- `baseline_q_per_source_bar`
- `variant_q_per_source_bar`
- `baseline_q_pct_price`
- `variant_q_pct_price`
- `baseline_q_pct_bootstrap_movement`
- `variant_q_pct_bootstrap_movement`
- `baseline_q_pct_median_daily_movement`
- `variant_q_pct_median_daily_movement`
- `base_delta_in_q`
- `mean_abs_pips`
- `max_abs_pips`
- `p50_abs_pips`
- `p95_abs_pips`
- `p99_abs_pips`
- `mean_abs_q`
- `p95_abs_q`
- `p99_abs_q`
- `side_disagreement_pct`

## Interpretation

Read `comparison_type` first:

- `scale_q_window_base_held`: tests q-window sensitivity with base fixed.
- `phase_base_shift_q_held`: tests grid-origin/phase sensitivity with q fixed.
- `anchor_shift_q_and_base`: tests true anchor shift sensitivity where both q
  and base can change.
- `anchor_shift_base_only_q_held`: tests anchor/base sensitivity with q fixed.
- `reference`: self-check row; drift should be zero.

If `history_shortfall=true`, the run is diagnostic evidence only. It can block
downstream work, but it cannot support a six-year or institutional continuity
claim.

If `scale_q_window_base_held` rows are stable but `phase_base_shift_q_held` rows
drift materially, the weakness is grid origin/phase, not q.

If q changes materially but `side_disagreement_pct` and q-distance columns stay
small, the line may absorb some scale variation, but event identity still needs
inspection before LRMG can be treated as an institutional spine.

If `side_disagreement_pct`, `p95_abs_q`, or `p99_abs_q` are high, the weakness is
not just a cosmetic line offset. LRMG side/state is sensitive to calibration or
phase and should not be used as the upstream event spine yet.

This audit still does not select a new LRMG formula. It decides whether the
current formula is stable enough, whether only phase needs a contract, or
whether q and phase both need redesign.

## Compile Receipts

Repo compile log:

`docs/research/gates/gate99/artifacts/lrmg-stability-check-2026-07-06/limni-lrmg-stability-check-repo-compile-log.txt`

Active terminal compile log:

`docs/research/gates/gate99/artifacts/lrmg-stability-check-2026-07-06/limni-lrmg-stability-check-active-terminal-compile-log.txt`

Both compile logs report:

`Result: 0 errors, 0 warnings`

Source hash parity for repo and active terminal source after the scale/phase
expansion:

`092AE52F0FA353CE94DF83E9388259C073D83DEF04F3991DB79D2692D0B49ED7`

## Stop Lines

- No `LimniLRMGPriceLine.mq5` visual formula change from this gate.
- No `LimniKataraktiEA.mq5` mutation.
- No `LimniHedge_V1.mq5` mutation.
- No `LimniTrendFollow.mq5` mutation.
- No promotion claim from compile-only evidence.
