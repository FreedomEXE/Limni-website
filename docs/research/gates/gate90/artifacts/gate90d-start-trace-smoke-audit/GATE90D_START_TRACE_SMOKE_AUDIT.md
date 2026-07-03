# Gate 90D Triangle Feature Shadow Audit

Generated: 2026-07-02

## Verdict

`PASS_GATE90D_TRIANGLE_FEATURE_SHADOW_AUDIT_BUILT_NO_REPLAY_NO_FULL_HANDSHAKE`

This is the first Gate 90D evidence pass. It is not a trading replay, not an MT5 build, and not a full currency-family handshake implementation.

## Scope

- Warehouse manifest: `gate74b_trade_leg_path_ECDE7C4A6553`
- Price bundle: `gate55e_fx_m1_oanda_ny5_v1_20181217_20260607_8E37E953`
- Weeks: `2022-01-10T00:00:00.000Z..2022-01-10T00:00:00.000Z` (1)
- Pairs: `1`
- Grid quantum used for trigger/lock shadow: `0.2 ADR`
- Signal brick: `0.05 ADR`
- Close-event source: `docs/research/gates/gate90/artifacts/gate90d-start-trace-smoke/close-events.rows.csv`

## Summary

| scope | rows | weeks | pairs | trigger_candidates | pairs_with_trigger | long_triggers | short_triggers | lock_preserve_candidates | shadow_preserved_adr |
|---|---|---|---|---|---|---|---|---|---|
| trigger_feature_ledger | 1 | 1 | 1 | 4 | 1 | 4 | 0 |  |  |
| lock_shadow_ledger | 5 | 1 | 1 |  |  |  |  | 1 | 0.227065 |

## Trigger Context

| bucket | trigger_candidates | distinct_pair_weeks | long_triggers | short_triggers | bb_true | family_positive | candidate_b_aligned | candidate_b_contra_aligned |
|---|---|---|---|---|---|---|---|---|
| all | 4 | 1 | 4 | 0 | 2 | 4 | 0 | 4 |
| candidate_b_aligned | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| candidate_b_contra_aligned | 4 | 1 | 4 | 0 | 2 | 4 | 0 | 4 |
| bb_true | 2 | 1 | 2 | 0 | 2 | 2 | 0 | 2 |
| family_positive | 4 | 1 | 4 | 0 | 2 | 4 | 0 | 4 |

## Geometry Regimes

| geometry_regime | pair_weeks | trigger_candidates | avg_path_efficiency_week | avg_week_range_adr | avg_range_ratio_pair | range_condition_pass_pair_weeks | harvestable_candidate_pair_weeks |
|---|---|---|---|---|---|---|---|
| harvestable_chop_candidate | 1 | 4 | 0.014899 | 2.815116 | 1 | 1 | 1 |

## Session Geometry Regimes

| geometry_regime | sessions | trigger_candidates | avg_entry_path_efficiency | avg_session_range_adr | avg_entry_range_adr | range_condition_pass_sessions | harvestable_candidate_sessions |
|---|---|---|---|---|---|---|---|
| harvestable_chop_candidate | 5 | 0 | 0.015491 | 0.828444 | 0.502649 | 5 | 5 |
| dead_chop_cost_churn | 4 | 4 | 0.069898 | 0.444268 | 0.803454 | 0 | 0 |

## Lock Shadow By Variant

| variant_id | close_reason | rows | preserve_candidates | shadow_preserved_adr | avg_shadow_preserved_adr |
|---|---|---|---|---|---|
| RAW_GRID_T100_S020_GATE90_RAW_BOTH | session_flatten | 2 | 1 | 0.227065 | 0.227065 |
| RAW_GRID_T100_S020_GATE90_RAW_BOTH | target | 3 | 0 | 0 |  |

## Start Traceability

| start_trace_status | rows | session_flatten_rows | target_rows | avg_minutes_from_trigger_to_start |
|---|---|---|---|---|
| missing_start_timestamp | 0 | 0 | 0 |  |
| invalid_start_timestamp | 0 | 0 | 0 |  |
| matched_prior_trigger | 0 | 0 | 0 |  |
| no_in_session_trigger | 5 | 2 | 3 |  |

## Read

- Formula contract hash: `BC4D946A6EECE49F34AC8061ED87423B9AFFE937B346CE2460D56857DC897831`.
- `pair-week-feature.rows.*` records week-level path efficiency, range ratio, range-condition pass/fail, geometry regime, derived grid quantum, signal brick, and log-only family context.
- `session-geometry.rows.*` records the same efficiency/range regime test at Katarakti session-box resolution so low-efficiency dead churn is not confused with harvestable chop.
- `katarakti-trigger-candidates.rows.*` records session sweep / rejection / displacement trigger candidates in ADR/grid units.
- `geometry-regime-summary.rows.*` separates harvestable chop candidates from dead chop, efficient tail risk, and mixed regimes.
- `grid-lock-shadow.rows.*` reads existing full-stat close events and estimates where a grid-unit lock floor could have preserved MFE.
- `start-traceability.rows.*` matches close-event cycle starts to prior Katarakti trigger candidates when source close events include `start_timestamp_utc`.
- Existing OOS4 close events do not include cycle start timestamps, so this generated pass reports them as `missing_start_timestamp`. Future Gate 90 close-event rows now expose start timestamps and cycle IDs for traceability.

## Post-Review Caveat

After outsider review, the Gate 90D proposal splits lock behavior into default
entry/add lockout versus optional explicit profit-stop. The `grid-lock-shadow`
rows in this report are therefore protection receipts only. They show where MFE
giveback might be worth controlling; they do not prove forced-close replay
behavior, lockout timing, or that protection would have acted before session
flatten. The next evidence pass must distinguish lockout receipts from
profit-stop receipts using start-level traceability and after-cost basket
quantum units.

## Artifacts

- `docs/research/gates/gate90/artifacts/gate90d-start-trace-smoke-audit/pair-week-feature.rows.csv`
- `docs/research/gates/gate90/artifacts/gate90d-start-trace-smoke-audit/session-geometry.rows.csv`
- `docs/research/gates/gate90/artifacts/gate90d-start-trace-smoke-audit/katarakti-trigger-candidates.rows.csv`
- `docs/research/gates/gate90/artifacts/gate90d-start-trace-smoke-audit/grid-lock-shadow.rows.csv`
- `docs/research/gates/gate90/artifacts/gate90d-start-trace-smoke-audit/gate90d-summary.rows.csv`
- `docs/research/gates/gate90/artifacts/gate90d-start-trace-smoke-audit/trigger-context-summary.rows.csv`
- `docs/research/gates/gate90/artifacts/gate90d-start-trace-smoke-audit/grid-lock-shadow-by-variant.rows.csv`
- `docs/research/gates/gate90/artifacts/gate90d-start-trace-smoke-audit/geometry-regime-summary.rows.csv`
- `docs/research/gates/gate90/artifacts/gate90d-start-trace-smoke-audit/session-geometry-regime-summary.rows.csv`
- `docs/research/gates/gate90/artifacts/gate90d-start-trace-smoke-audit/start-traceability.rows.csv`
- `docs/research/gates/gate90/artifacts/gate90d-start-trace-smoke-audit/start-traceability-summary.rows.csv`
- `docs/research/gates/gate90/artifacts/gate90d-start-trace-smoke-audit/gate90d-config.json`
- `docs/research/gates/gate90/artifacts/gate90d-start-trace-smoke-audit/gate90d-formula-config.json`
- `docs/research/gates/gate90/artifacts/gate90d-start-trace-smoke-audit/gate90d-triangle-shadow-audit-sha256.txt`

## Stop Line

No Triangle trading replay, no long matrix, no 2020 year run, no MT5/live/app work, and no full seven-pair handshake gating were performed.
