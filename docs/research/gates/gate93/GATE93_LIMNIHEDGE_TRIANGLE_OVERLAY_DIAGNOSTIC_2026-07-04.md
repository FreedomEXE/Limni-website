# Gate 93 LimniHedge Triangle Overlay Diagnostic

Date: 2026-07-04

Verdict: `PASS_GATE93_TRIANGLE_OVERLAY_DIAGNOSTIC_NO_KEEPER_NO_PROMOTION`

## Scope

Gate 93 is a repo-side overlay diagnostic after Gate 92 parity. It does not mutate `automation/mt5/Experts/LimniHedge_V1.mq5`, does not add LRMG direction, does not add Katarakti-lite, and does not run a broad optimization matrix.

This pass asks one narrow question: if Gate91-style Triangle geometry is measured on the verified broker H1 parity path around each saved LimniHedge V1 entry, does it identify a cleaner subset of the legacy Type 1/Type 3 entries?

Important boundary: this is not a canonical M1 Triangle replay. It is an H1 overlay on the Gate92 parity ledger so the first reconstruction remains anchored to the MT5 reports Freedom saved.

## Configuration

- Gate92 artifact input: `docs/research/gates/gate92/artifacts/limnihedge-legacy-parity-intake`
- H1 lookback per entry: `24` bars
- ADR lookback: `20` complete UTC days
- Low path-efficiency threshold: `0.35`
- V2 geometry quality floor: `1`
- V2.1 floor-pin ratio: `1.25`

## Aggregate Read

| variant_id | entries_accepted | entries_rejected | accepted_pct | accepted_net_profit | baseline_net_profit | net_delta_vs_baseline | accepted_profit_factor | terminal_liquidations_accepted | terminal_liquidations_baseline | terminal_liquidations_removed | verdict |
|---|---|---|---|---|---|---|---|---|---|---|---|
| baseline_all_limnihedge_v1 | 3856 | 0 | 100 | 26739.3 | 26739.3 | 0 | 12.396126 | 76 | 76 | 0 | BASELINE |
| h1_triangle_center_reversion_side | 606 | 3250 | 15.715768 | 4862.51 | 26739.3 | -21876.79 | 33.744175 | 6 | 76 | 70 | PROFILED_FILTER_LOSS |
| h1_triangle_v1_directionless | 68 | 3788 | 1.763485 | 515.73 | 26739.3 | -26223.57 | 235.422727 | 0 | 76 | 76 | PROFILED_FILTER_LOSS |
| h1_triangle_v2_geometry | 254 | 3602 | 6.587137 | 2078.46 | 26739.3 | -24660.84 | 945.754545 | 0 | 76 | 76 | PROFILED_FILTER_LOSS |
| h1_triangle_v21_floorpin | 243 | 3613 | 6.301867 | 2001.75 | 26739.3 | -24737.55 | 910.886364 | 0 | 76 | 76 | PROFILED_FILTER_LOSS |
| h1_triangle_v21_surplus | 243 | 3613 | 6.301867 | 2001.75 | 26739.3 | -24737.55 | 910.886364 | 0 | 76 | 76 | PROFILED_FILTER_LOSS |

## Case Read

| case_id | variant_id | entries_accepted | accepted_pct | accepted_net_profit | baseline_net_profit | net_delta_vs_baseline | accepted_profit_factor | terminal_liquidations_accepted | terminal_liquidations_removed | verdict |
|---|---|---|---|---|---|---|---|---|---|---|
| audcad_1_hour_chart | baseline_all_limnihedge_v1 | 260 | 100 | 1333.04 | 1333.04 | 0 | 12.385719 | 11 | 0 | BASELINE |
| audcad_1_hour_chart | h1_triangle_center_reversion_side | 43 | 16.538462 | 211.82 | 1333.04 | -1121.22 | 13.939524 | 1 | 10 | PROFILED_FILTER_LOSS |
| audcad_1_hour_chart | h1_triangle_v1_directionless | 5 | 1.923077 | 16.56 | 1333.04 | -1316.48 |  | 0 | 11 | PROFILED_FILTER_LOSS |
| audcad_1_hour_chart | h1_triangle_v2_geometry | 16 | 6.153846 | 78.76 | 1333.04 | -1254.28 |  | 0 | 11 | PROFILED_FILTER_LOSS |
| audcad_1_hour_chart | h1_triangle_v21_floorpin | 16 | 6.153846 | 78.76 | 1333.04 | -1254.28 |  | 0 | 11 | PROFILED_FILTER_LOSS |
| audcad_1_hour_chart | h1_triangle_v21_surplus | 16 | 6.153846 | 78.76 | 1333.04 | -1254.28 |  | 0 | 11 | PROFILED_FILTER_LOSS |
| audcad_h1_12y_type1_type3_primary | baseline_all_limnihedge_v1 | 1432 | 100 | 5039.46 | 5039.46 | 0 | 5.147328 | 16 | 0 | BASELINE |
| audcad_h1_12y_type1_type3_primary | h1_triangle_center_reversion_side | 228 | 15.921788 | 951.19 | 5039.46 | -4088.27 | 14.035357 | 2 | 14 | PROFILED_FILTER_LOSS |
| audcad_h1_12y_type1_type3_primary | h1_triangle_v1_directionless | 27 | 1.885475 | 78.24 | 5039.46 | -4961.22 | 36.563636 | 0 | 16 | PROFILED_FILTER_LOSS |
| audcad_h1_12y_type1_type3_primary | h1_triangle_v2_geometry | 98 | 6.843575 | 423.12 | 5039.46 | -4616.34 | 193.327273 | 0 | 16 | PROFILED_FILTER_LOSS |
| audcad_h1_12y_type1_type3_primary | h1_triangle_v21_floorpin | 93 | 6.494413 | 404.35 | 5039.46 | -4635.11 | 184.795455 | 0 | 16 | PROFILED_FILTER_LOSS |
| audcad_h1_12y_type1_type3_primary | h1_triangle_v21_surplus | 93 | 6.494413 | 404.35 | 5039.46 | -4635.11 | 184.795455 | 0 | 16 | PROFILED_FILTER_LOSS |
| audcad_h1_type3_ma_changed_primary | baseline_all_limnihedge_v1 | 260 | 100 | 5140.6 | 5140.6 | 0 | 15.780334 | 2 | 0 | BASELINE |
| audcad_h1_type3_ma_changed_primary | h1_triangle_center_reversion_side | 43 | 16.538462 | 1067.52 | 5140.6 | -4073.08 |  | 0 | 2 | PROFILED_FILTER_LOSS |
| audcad_h1_type3_ma_changed_primary | h1_triangle_v1_directionless | 5 | 1.923077 | 127.27 | 5140.6 | -5013.33 |  | 0 | 2 | PROFILED_FILTER_LOSS |
| audcad_h1_type3_ma_changed_primary | h1_triangle_v2_geometry | 16 | 6.153846 | 347.75 | 5140.6 | -4792.85 |  | 0 | 2 | PROFILED_FILTER_LOSS |
| audcad_h1_type3_ma_changed_primary | h1_triangle_v21_floorpin | 16 | 6.153846 | 347.75 | 5140.6 | -4792.85 |  | 0 | 2 | PROFILED_FILTER_LOSS |
| audcad_h1_type3_ma_changed_primary | h1_triangle_v21_surplus | 16 | 6.153846 | 347.75 | 5140.6 | -4792.85 |  | 0 | 2 | PROFILED_FILTER_LOSS |
| audchf_h1_type3_secondary | baseline_all_limnihedge_v1 | 386 | 100 | 3260.96 | 3260.96 | 0 | 10.156399 | 36 | 0 | BASELINE |
| audchf_h1_type3_secondary | h1_triangle_center_reversion_side | 61 | 15.803109 | 567.41 | 3260.96 | -2693.55 | 10.591109 | 3 | 33 | PROFILED_FILTER_LOSS |
| audchf_h1_type3_secondary | h1_triangle_v1_directionless | 6 | 1.554404 | 48.67 | 3260.96 | -3212.29 |  | 0 | 36 | PROFILED_FILTER_LOSS |
| audchf_h1_type3_secondary | h1_triangle_v2_geometry | 20 | 5.181347 | 229.41 | 3260.96 | -3031.55 |  | 0 | 36 | PROFILED_FILTER_LOSS |
| audchf_h1_type3_secondary | h1_triangle_v21_floorpin | 19 | 4.92228 | 221.39 | 3260.96 | -3039.57 |  | 0 | 36 | PROFILED_FILTER_LOSS |
| audchf_h1_type3_secondary | h1_triangle_v21_surplus | 19 | 4.92228 | 221.39 | 3260.96 | -3039.57 |  | 0 | 36 | PROFILED_FILTER_LOSS |
| audjpy_h1_type3_primary | baseline_all_limnihedge_v1 | 1518 | 100 | 11965.24 | 11965.24 | 0 | 39.570176 | 11 | 0 | BASELINE |
| audjpy_h1_type3_primary | h1_triangle_center_reversion_side | 231 | 15.217391 | 2064.57 | 11965.24 | -9900.67 |  | 0 | 11 | PROFILED_FILTER_LOSS |
| audjpy_h1_type3_primary | h1_triangle_v1_directionless | 25 | 1.646904 | 244.99 | 11965.24 | -11720.25 |  | 0 | 11 | PROFILED_FILTER_LOSS |
| audjpy_h1_type3_primary | h1_triangle_v2_geometry | 104 | 6.85112 | 999.42 | 11965.24 | -10965.82 |  | 0 | 11 | PROFILED_FILTER_LOSS |
| audjpy_h1_type3_primary | h1_triangle_v21_floorpin | 99 | 6.521739 | 949.5 | 11965.24 | -11015.74 |  | 0 | 11 | PROFILED_FILTER_LOSS |
| audjpy_h1_type3_primary | h1_triangle_v21_surplus | 99 | 6.521739 | 949.5 | 11965.24 | -11015.74 |  | 0 | 11 | PROFILED_FILTER_LOSS |

## Feature Buckets

These buckets are diagnostic only. They show whether Triangle geometry behaves as a risk score even when hard-gating is too restrictive.

| bucket_family | bucket_id | entries | net_profit | avg_net_profit | profit_factor | terminal_liquidations | avg_hold_hours |
|---|---|---|---|---|---|---|---|
| geometry_quality | gq_0_5_1 | 21 | 109.88 | 5.232381 | 135 | 0 | 321.427897 |
| geometry_quality | gq_1_2 | 72 | 515.55 | 7.160417 | 5.851779 | 0 | 866.749379 |
| geometry_quality | gq_2_4 | 291 | 1885.36 | 6.4789 | 8.312699 | 6 | 679.518276 |
| geometry_quality | gq_gte_4 | 3470 | 24219.83 | 6.979778 | 13.223286 | 70 | 572.279773 |
| geometry_quality | gq_lt_0_5 | 2 | 8.68 | 4.34 |  | 0 | 124.999305 |
| path_efficiency | pe_high_gt_0_6 | 98 | 596.76 | 6.089388 | 6.68722 | 0 | 461.815697 |
| path_efficiency | pe_low_le_0_35 | 2996 | 20608.15 | 6.878555 | 12.979881 | 62 | 538.054776 |
| path_efficiency | pe_mid_0_35_0_6 | 762 | 5534.39 | 7.262979 | 11.618757 | 14 | 781.740842 |
| side_distance | distance_0_0_25 | 437 | 3535.14 | 8.089565 | 25.163636 | 6 | 513.987936 |
| side_distance | distance_0_25_0_5 | 121 | 980.91 | 8.106694 | 1258.576923 | 0 | 763.958062 |
| side_distance | distance_gte_0_5 | 48 | 346.46 | 7.217917 | 244.985915 | 0 | 669.332656 |
| side_distance | wrong_side_of_center | 3250 | 21876.79 | 6.73132 | 10.953723 | 70 | 585.777523 |

## Validation

| check | value | expected | passed |
|---|---|---|---|
| gate92_parity_prerequisite_passed | PASS_GATE92_LIMNIHEDGE_LEGACY_PARITY_INTAKE_READY_FOR_FULL_REPLAY | PASS_GATE92_LIMNIHEDGE_LEGACY_PARITY_INTAKE_READY_FOR_FULL_REPLAY | true |
| pnl_exit_rows_loaded | 3856 | >=1 | true |
| feature_rows_match_pnl_rows | 3856 | 3856 | true |
| feature_rows_have_h1_geometry | 0 | 0 | true |
| baseline_decisions_match_pnl_rows | 3856 | 3856 | true |
| expected_variant_count | 6 | 6 | true |
| aggregate_triangle_variants_evaluated | 5 | 5 | true |
| feature_bucket_rows_emitted | 12 | >=1 | true |
| mt5_ea_not_mutated_by_gate93_script | repo-side artifact diagnostic only | reference-only EA | true |

## Artifacts

- featureJson: `docs/research/gates/gate93/artifacts/limnihedge-triangle-overlay-diagnostic/triangle-entry-features.rows.json`
- featureCsv: `docs/research/gates/gate93/artifacts/limnihedge-triangle-overlay-diagnostic/triangle-entry-features.rows.csv`
- decisionsJson: `docs/research/gates/gate93/artifacts/limnihedge-triangle-overlay-diagnostic/triangle-overlay-decisions.rows.json`
- decisionsCsv: `docs/research/gates/gate93/artifacts/limnihedge-triangle-overlay-diagnostic/triangle-overlay-decisions.rows.csv`
- summaryJson: `docs/research/gates/gate93/artifacts/limnihedge-triangle-overlay-diagnostic/triangle-overlay-summary.rows.json`
- summaryCsv: `docs/research/gates/gate93/artifacts/limnihedge-triangle-overlay-diagnostic/triangle-overlay-summary.rows.csv`
- aggregateJson: `docs/research/gates/gate93/artifacts/limnihedge-triangle-overlay-diagnostic/triangle-overlay-aggregate.rows.json`
- aggregateCsv: `docs/research/gates/gate93/artifacts/limnihedge-triangle-overlay-diagnostic/triangle-overlay-aggregate.rows.csv`
- bucketsJson: `docs/research/gates/gate93/artifacts/limnihedge-triangle-overlay-diagnostic/triangle-feature-buckets.rows.json`
- bucketsCsv: `docs/research/gates/gate93/artifacts/limnihedge-triangle-overlay-diagnostic/triangle-feature-buckets.rows.csv`
- validationJson: `docs/research/gates/gate93/artifacts/limnihedge-triangle-overlay-diagnostic/validation.rows.json`
- validationCsv: `docs/research/gates/gate93/artifacts/limnihedge-triangle-overlay-diagnostic/validation.rows.csv`
- metricsJson: `docs/research/gates/gate93/artifacts/limnihedge-triangle-overlay-diagnostic/metric-definitions.rows.json`
- metricsCsv: `docs/research/gates/gate93/artifacts/limnihedge-triangle-overlay-diagnostic/metric-definitions.rows.csv`
- commandReceipt: `docs/research/gates/gate93/artifacts/limnihedge-triangle-overlay-diagnostic/command-receipt.json`
- runSummary: `docs/research/gates/gate93/artifacts/limnihedge-triangle-overlay-diagnostic/gate93-run-summary.json`
- shaManifest: `docs/research/gates/gate93/artifacts/limnihedge-triangle-overlay-diagnostic/gate93-limnihedge-triangle-overlay-sha256.txt`
- report: `docs/research/gates/gate93/GATE93_LIMNIHEDGE_TRIANGLE_OVERLAY_DIAGNOSTIC_2026-07-04.md`

## Stop Line

Do not promote this overlay into MT5 or replace David/Type 3 from this result alone. If the overlay improves shape, the next gate should replay the best one or two rows on the canonical M1 Triangle/LRMG path. If it fails, preserve the ledger and return to parity-safe design rather than tuning thresholds.
