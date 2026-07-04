# Gate 94 LimniHedge Type 3 Movement-Candle Diagnostic

Date: 2026-07-04

Verdict: `PASS_GATE94_TYPE3_MOVEMENT_CANDLE_DIAGNOSTIC_NO_PROMOTION`

## Scope

Gate 94 answers Freedom's follow-up after Gate 93: the prior Triangle diagnostic used H1 time candles. This diagnostic does not. It projects saved Gate 92 LimniHedge Type 3 entries onto fixed ADR movement candles generated from the canonical Gate 74B M1-derived directed-ADR warehouse.

This is not a full Type 3 movement-candle replay yet. The entry/outcome ledger remains the saved MT5 report surface from Gate 92; only the candle geometry used to classify each saved Type 3 entry changes.

Frozen: no MT5 EA mutation, no LRMG promotion, no David redesign, no Type 3 rewrite, no Katarakti-lite integration, no lifecycle/trailing change, no live MT5 trading, and no broad optimization matrix.

## Source

- Gate 92 artifact input: `docs/research/gates/gate92/artifacts/limnihedge-legacy-parity-intake`
- Gate 74B manifest: `gate74b_trade_leg_path_ECDE7C4A6553`
- Price bundle: `gate55e_fx_m1_oanda_ny5_v1_20181217_20260607_8E37E953`
- Path resolution: `1m`
- Movement surfaces: `adr_event_0_025=0.025ADR`, `adr_event_0_05=0.05ADR`, `adr_event_0_075=0.075ADR`, `adr_event_0_10=0.1ADR`
- H1 bars used for movement candles: `0`

Coverage caveat: Gate 74B starts after the earliest saved AUDCAD Type 3 history and ends before the July 2026 MT5 liquidation boundary. Missing rows are profiled as `missing_coverage`, not silently filled from H1.

## Aggregate Read

| movement_surface_id | entries_total | entries_exact_type3_match | exact_match_pct | baseline_type3_net_profit | exact_match_net_profit | net_delta_vs_baseline | baseline_profit_factor | exact_match_profit_factor | baseline_terminal_liquidations | exact_match_terminal_liquidations | terminal_liquidations_removed_if_hard_gate | verdict |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| adr_event_0_025 | 3826 | 93 | 2.641295 | 25613.45 | 774.67 | -24838.78 | 18.228855 | 21.499338 | 51 | 2 | 49 | PROFILED_NO_PROMOTION |
| adr_event_0_05 | 3826 | 98 | 2.7833 | 25613.45 | 746.14 | -24867.31 | 18.228855 | 319.863248 | 51 | 0 | 51 | PROFILED_NO_PROMOTION |
| adr_event_0_075 | 3826 | 103 | 2.925305 | 25613.45 | 804.57 | -24808.88 | 18.228855 | 53.655105 | 51 | 1 | 50 | PROFILED_NO_PROMOTION |
| adr_event_0_10 | 3826 | 157 | 4.458961 | 25613.45 | 898.35 | -24715.1 | 18.228855 |  | 51 | 0 | 51 | PROFILED_NO_PROMOTION |

## Bucket Read

| movement_surface_id | match_bucket | entries | net_profit | profit_factor | win_pct | terminal_liquidations | avg_hold_hours | avg_entry_lag_minutes | avg_entry_side_move_adr_last4 |
|---|---|---|---|---|---|---|---|---|---|
| adr_event_0_025 | combo_only | 51 | 260.31 | 4.529149 | 98.039216 | 2 | 376.018981 | 18.647059 | 0.1 |
| adr_event_0_025 | david_only | 1979 | 16390.9 | 32.355741 | 96.917635 | 27 | 693.470305 | 24.827691 | -0.003032 |
| adr_event_0_025 | exact_type3_match | 93 | 774.67 | 21.499338 | 97.849462 | 2 | 842.13914 | 24.569892 | 0.1 |
| adr_event_0_025 | missing_coverage | 305 | 997.75 | 2.320282 | 91.147541 | 25 | 505.451873 |  |  |
| adr_event_0_025 | no_type3_shape | 1340 | 7918.15 | 10.584978 | 96.865672 | 20 | 441.506837 | 23.512687 | -0.00153 |
| adr_event_0_025 | opposite_type3 | 58 | 269.42 | 11.255805 | 96.551724 | 0 | 269.91318 | 33.086207 | -0.1 |
| adr_event_0_05 | combo_only | 34 | 154.6 |  | 100 | 0 | 156.440555 | 47.294118 | 0.2 |
| adr_event_0_05 | david_only | 2595 | 20965.81 | 26.280419 | 96.955684 | 38 | 586.338478 | 35.465896 | 0.002312 |
| adr_event_0_05 | exact_type3_match | 98 | 746.14 | 319.863248 | 97.959184 | 0 | 192.529969 | 39.795918 | 0.2 |
| adr_event_0_05 | missing_coverage | 305 | 997.75 | 2.320282 | 91.147541 | 25 | 505.451873 |  |  |
| adr_event_0_05 | no_type3_shape | 754 | 3640.24 | 7.195942 | 96.68435 | 13 | 668.910513 | 39.690981 | 0.004377 |
| adr_event_0_05 | opposite_type3 | 40 | 106.66 | 2.580851 | 95 | 0 | 676.349389 | 32.5 | -0.2 |
| adr_event_0_075 | combo_only | 42 | 219.98 | 7333.666667 | 97.619048 | 0 | 75.046977 | 79.5 | 0.3 |
| adr_event_0_075 | david_only | 2604 | 19660.2 | 22.319959 | 96.735791 | 39 | 577.124942 | 52.337174 | 0.028514 |
| adr_event_0_075 | exact_type3_match | 103 | 804.57 | 53.655105 | 97.087379 | 1 | 362.407133 | 57.834951 | 0.3 |
| adr_event_0_075 | missing_coverage | 305 | 997.75 | 2.320282 | 91.147541 | 25 | 505.451873 |  |  |
| adr_event_0_075 | no_type3_shape | 747 | 4625.87 | 9.466087 | 97.590361 | 11 | 640.466568 | 58.048193 | 0.036747 |
| adr_event_0_075 | opposite_type3 | 25 | 302.83 | 109.153571 | 96 | 0 | 2216.239378 | 42.8 | -0.3 |
| adr_event_0_10 | combo_only | 41 | 340.45 | 60.93838 | 90.243902 | 0 | 188.560359 | 95.414634 | 0.4 |
| adr_event_0_10 | david_only | 2620 | 17282 | 15.288313 | 96.908397 | 45 | 708.777995 | 78.80458 | 0.075954 |
| adr_event_0_10 | exact_type3_match | 157 | 898.35 |  | 100 | 0 | 180.031212 | 88.974522 | 0.4 |
| adr_event_0_10 | missing_coverage | 305 | 997.75 | 2.320282 | 91.147541 | 25 | 505.451873 |  |  |
| adr_event_0_10 | no_type3_shape | 698 | 7035.52 | 26.917336 | 96.704871 | 6 | 262.224284 | 71.578797 | 0.085673 |
| adr_event_0_10 | opposite_type3 | 5 | 57.13 |  | 100 | 0 | 224.199333 | 30.4 | -0.4 |

## Validation

| check | value | expected | passed |
|---|---|---|---|
| gate92_parity_prerequisite_passed | PASS_GATE92_LIMNIHEDGE_LEGACY_PARITY_INTAKE_READY_FOR_FULL_REPLAY | PASS_GATE92_LIMNIHEDGE_LEGACY_PARITY_INTAKE_READY_FOR_FULL_REPLAY | true |
| gate92_validation_failures | 0 | 0 | true |
| type3_rows_loaded | 3826 | >0 | true |
| movement_feature_rows | 15304 | 15304 | true |
| gate74b_manifest_status | complete | complete | true |
| h1_bars_used_for_movement_candles | 0 | 0 | true |
| mt5_ea_mutated_by_gate94_script | repo-side artifact diagnostic only | reference-only EA | true |
| missing_week_pair_rows_profiled_not_failed | 368 | >=0 diagnostic coverage caveat | true |

## Interpretation

This diagnostic is a structure read, not a promotion. If exact movement-candle Type 3 matches retain a useful portion of net while removing terminal liquidations, the next gate should build a full movement-candle Type 3 replay with canonical M1 execution and explicit MT5 M1 export parity. If the hard match is too restrictive, preserve the buckets and look for risk-overlay use instead of rewriting the EA.

Missing coverage rows: `1220`.

## Artifacts

- featureJson: `docs/research/gates/gate94/artifacts/limnihedge-type3-movement-candle-diagnostic/type3-movement-candle-features.rows.json`
- featureCsv: `docs/research/gates/gate94/artifacts/limnihedge-type3-movement-candle-diagnostic/type3-movement-candle-features.rows.csv`
- summaryJson: `docs/research/gates/gate94/artifacts/limnihedge-type3-movement-candle-diagnostic/type3-movement-candle-summary.rows.json`
- summaryCsv: `docs/research/gates/gate94/artifacts/limnihedge-type3-movement-candle-diagnostic/type3-movement-candle-summary.rows.csv`
- aggregateJson: `docs/research/gates/gate94/artifacts/limnihedge-type3-movement-candle-diagnostic/type3-movement-candle-aggregate.rows.json`
- aggregateCsv: `docs/research/gates/gate94/artifacts/limnihedge-type3-movement-candle-diagnostic/type3-movement-candle-aggregate.rows.csv`
- missingCoverageJson: `docs/research/gates/gate94/artifacts/limnihedge-type3-movement-candle-diagnostic/missing-week-pair-coverage.rows.json`
- missingCoverageCsv: `docs/research/gates/gate94/artifacts/limnihedge-type3-movement-candle-diagnostic/missing-week-pair-coverage.rows.csv`
- validationJson: `docs/research/gates/gate94/artifacts/limnihedge-type3-movement-candle-diagnostic/validation.rows.json`
- validationCsv: `docs/research/gates/gate94/artifacts/limnihedge-type3-movement-candle-diagnostic/validation.rows.csv`
- metricsJson: `docs/research/gates/gate94/artifacts/limnihedge-type3-movement-candle-diagnostic/metric-definitions.rows.json`
- metricsCsv: `docs/research/gates/gate94/artifacts/limnihedge-type3-movement-candle-diagnostic/metric-definitions.rows.csv`
- commandReceipt: `docs/research/gates/gate94/artifacts/limnihedge-type3-movement-candle-diagnostic/command-receipt.json`
- runSummary: `docs/research/gates/gate94/artifacts/limnihedge-type3-movement-candle-diagnostic/gate94-run-summary.json`
- shaManifest: `docs/research/gates/gate94/artifacts/limnihedge-type3-movement-candle-diagnostic/gate94-limnihedge-type3-movement-candle-sha256.txt`
- report: `docs/research/gates/gate94/GATE94_LIMNIHEDGE_TYPE3_MOVEMENT_CANDLE_DIAGNOSTIC_2026-07-04.md`

## Stop Line

Do not promote this into MT5 from this report alone. The current result is a diagnostic projection of saved Type 3 entries onto movement candles, not a completed non-time-based LimniHedge replay.
