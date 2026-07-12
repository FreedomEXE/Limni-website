# Gate 74B Trade-Leg Path Materialization

Generated: `2026-06-29T04:06:30.381Z`

## Verdict

`PASS_GATE74B_TRADE_LEG_PATH_MATERIALIZATION__POLICY_NEUTRAL_PAIR_WEEK_PATH_WAREHOUSE_READY`

## Scope

- Materializes policy-neutral Candidate B pair/trade-leg path primitives.
- Stores directed pair OHLC ADR paths in a compressed columnar pair-week warehouse.
- Supports future replay adapters such as per-pair fixed ADR targets without testing those policies in this gate.
- Does not run exit-policy replay, target selection, promotion, risk, MT5/live, or Brain/source mutation.

## Warehouse

```json
{
  "manifest_id": "gate74b_trade_leg_path_ECDE7C4A6553",
  "config_hash": "ECDE7C4A6553A1797C249D8B0754D2F62D551B38BEBBC141F52C3E3D5833A362",
  "warehouse_hash": "36290BFDD28B47AFF31CA798C75ED1E7736A4778EBAA3E5FFAB64ECA07C462CC",
  "contract_id": "gate74_trade_leg_path_base_primitives_v1",
  "warehouse_version": "trade_leg_path_week_pair_columnar_gzip_v1",
  "path_payload_codec": "gzip+json+columnar_trade_leg_path_points_v1",
  "price_bundle_id": "gate55e_fx_m1_oanda_ny5_v1_20181217_20260607_8E37E953",
  "path_resolution": "1m",
  "candidate_id": "candidate_b_macro_anchor_with_cot_warning",
  "locked_algorithm_id": "gate69_locked_unnamed_forced28_candidate_b_default",
  "candidate_b_final_ledger_hash": "5158742FE3E74221D1F2577A38F3169C6AF9B1FA7BC593B90C901A4F0E562390",
  "candidate_b_ledger_file_sha256": "92C9E090F14B3EF2F96C78E749D9783F0F8F0E8E6CEA4900FDEFB115ED1BAD03",
  "entry_exposure_model_id": "gate71_clean_weekly_basket_hold_v1",
  "adr_target_pct": 1,
  "week_count": 373,
  "pair_week_count": 10444,
  "path_point_count": 67650431,
  "chunk_count": 373,
  "materialization_runtime_seconds": 3290.2
}
```

## Coverage

```json
{
  "complete_pair_weeks": 0,
  "partial_pair_weeks": 10444,
  "missing_pair_weeks": 0,
  "default_adr_pair_weeks": 270,
  "min_actual_bars": 3002,
  "max_actual_bars": 6658,
  "partial_samples": [
    {
      "week_open_utc": "2019-04-14T23:00:00.000Z",
      "pair": "AUDCAD",
      "expected_bar_count": 6660,
      "actual_bar_count": 6608,
      "coverage_state": "partial"
    },
    {
      "week_open_utc": "2019-04-14T23:00:00.000Z",
      "pair": "AUDCHF",
      "expected_bar_count": 6660,
      "actual_bar_count": 5715,
      "coverage_state": "partial"
    },
    {
      "week_open_utc": "2019-04-14T23:00:00.000Z",
      "pair": "AUDJPY",
      "expected_bar_count": 6660,
      "actual_bar_count": 6634,
      "coverage_state": "partial"
    },
    {
      "week_open_utc": "2019-04-14T23:00:00.000Z",
      "pair": "AUDNZD",
      "expected_bar_count": 6660,
      "actual_bar_count": 6580,
      "coverage_state": "partial"
    },
    {
      "week_open_utc": "2019-04-14T23:00:00.000Z",
      "pair": "AUDUSD",
      "expected_bar_count": 6660,
      "actual_bar_count": 4969,
      "coverage_state": "partial"
    },
    {
      "week_open_utc": "2019-04-14T23:00:00.000Z",
      "pair": "CADCHF",
      "expected_bar_count": 6660,
      "actual_bar_count": 5651,
      "coverage_state": "partial"
    },
    {
      "week_open_utc": "2019-04-14T23:00:00.000Z",
      "pair": "CADJPY",
      "expected_bar_count": 6660,
      "actual_bar_count": 6630,
      "coverage_state": "partial"
    },
    {
      "week_open_utc": "2019-04-14T23:00:00.000Z",
      "pair": "CHFJPY",
      "expected_bar_count": 6660,
      "actual_bar_count": 6637,
      "coverage_state": "partial"
    },
    {
      "week_open_utc": "2019-04-14T23:00:00.000Z",
      "pair": "EURAUD",
      "expected_bar_count": 6660,
      "actual_bar_count": 5972,
      "coverage_state": "partial"
    },
    {
      "week_open_utc": "2019-04-14T23:00:00.000Z",
      "pair": "EURCAD",
      "expected_bar_count": 6660,
      "actual_bar_count": 6644,
      "coverage_state": "partial"
    },
    {
      "week_open_utc": "2019-04-14T23:00:00.000Z",
      "pair": "EURCHF",
      "expected_bar_count": 6660,
      "actual_bar_count": 5595,
      "coverage_state": "partial"
    },
    {
      "week_open_utc": "2019-04-14T23:00:00.000Z",
      "pair": "EURGBP",
      "expected_bar_count": 6660,
      "actual_bar_count": 5964,
      "coverage_state": "partial"
    },
    {
      "week_open_utc": "2019-04-14T23:00:00.000Z",
      "pair": "EURJPY",
      "expected_bar_count": 6660,
      "actual_bar_count": 6022,
      "coverage_state": "partial"
    },
    {
      "week_open_utc": "2019-04-14T23:00:00.000Z",
      "pair": "EURNZD",
      "expected_bar_count": 6660,
      "actual_bar_count": 6635,
      "coverage_state": "partial"
    },
    {
      "week_open_utc": "2019-04-14T23:00:00.000Z",
      "pair": "EURUSD",
      "expected_bar_count": 6660,
      "actual_bar_count": 6160,
      "coverage_state": "partial"
    },
    {
      "week_open_utc": "2019-04-14T23:00:00.000Z",
      "pair": "GBPAUD",
      "expected_bar_count": 6660,
      "actual_bar_count": 6621,
      "coverage_state": "partial"
    },
    {
      "week_open_utc": "2019-04-14T23:00:00.000Z",
      "pair": "GBPCAD",
      "expected_bar_count": 6660,
      "actual_bar_count": 6644,
      "coverage_state": "partial"
    },
    {
      "week_open_utc": "2019-04-14T23:00:00.000Z",
      "pair": "GBPCHF",
      "expected_bar_count": 6660,
      "actual_bar_count": 6606,
      "coverage_state": "partial"
    },
    {
      "week_open_utc": "2019-04-14T23:00:00.000Z",
      "pair": "GBPJPY",
      "expected_bar_count": 6660,
      "actual_bar_count": 6499,
      "coverage_state": "partial"
    },
    {
      "week_open_utc": "2019-04-14T23:00:00.000Z",
      "pair": "GBPNZD",
      "expected_bar_count": 6660,
      "actual_bar_count": 6608,
      "coverage_state": "partial"
    },
    {
      "week_open_utc": "2019-04-14T23:00:00.000Z",
      "pair": "GBPUSD",
      "expected_bar_count": 6660,
      "actual_bar_count": 5857,
      "coverage_state": "partial"
    },
    {
      "week_open_utc": "2019-04-14T23:00:00.000Z",
      "pair": "NZDCAD",
      "expected_bar_count": 6660,
      "actual_bar_count": 6590,
      "coverage_state": "partial"
    },
    {
      "week_open_utc": "2019-04-14T23:00:00.000Z",
      "pair": "NZDCHF",
      "expected_bar_count": 6660,
      "actual_bar_count": 5865,
      "coverage_state": "partial"
    },
    {
      "week_open_utc": "2019-04-14T23:00:00.000Z",
      "pair": "NZDJPY",
      "expected_bar_count": 6660,
      "actual_bar_count": 6605,
      "coverage_state": "partial"
    },
    {
      "week_open_utc": "2019-04-14T23:00:00.000Z",
      "pair": "NZDUSD",
      "expected_bar_count": 6660,
      "actual_bar_count": 5302,
      "coverage_state": "partial"
    },
    {
      "week_open_utc": "2019-04-14T23:00:00.000Z",
      "pair": "USDCAD",
      "expected_bar_count": 6660,
      "actual_bar_count": 5682,
      "coverage_state": "partial"
    },
    {
      "week_open_utc": "2019-04-14T23:00:00.000Z",
      "pair": "USDCHF",
      "expected_bar_count": 6660,
      "actual_bar_count": 4596,
      "coverage_state": "partial"
    },
    {
      "week_open_utc": "2019-04-14T23:00:00.000Z",
      "pair": "USDJPY",
      "expected_bar_count": 6660,
      "actual_bar_count": 6336,
      "coverage_state": "partial"
    },
    {
      "week_open_utc": "2019-04-21T23:00:00.000Z",
      "pair": "AUDCAD",
      "expected_bar_count": 6660,
      "actual_bar_count": 6624,
      "coverage_state": "partial"
    },
    {
      "week_open_utc": "2019-04-21T23:00:00.000Z",
      "pair": "AUDCHF",
      "expected_bar_count": 6660,
      "actual_bar_count": 5780,
      "coverage_state": "partial"
    },
    {
      "week_open_utc": "2019-04-21T23:00:00.000Z",
      "pair": "AUDJPY",
      "expected_bar_count": 6660,
      "actual_bar_count": 6616,
      "coverage_state": "partial"
    },
    {
      "week_open_utc": "2019-04-21T23:00:00.000Z",
      "pair": "AUDNZD",
      "expected_bar_count": 6660,
      "actual_bar_count": 6587,
      "coverage_state": "partial"
    },
    {
      "week_open_utc": "2019-04-21T23:00:00.000Z",
      "pair": "AUDUSD",
      "expected_bar_count": 6660,
      "actual_bar_count": 5068,
      "coverage_state": "partial"
    },
    {
      "week_open_utc": "2019-04-21T23:00:00.000Z",
      "pair": "CADCHF",
      "expected_bar_count": 6660,
      "actual_bar_count": 5809,
      "coverage_state": "partial"
    },
    {
      "week_open_utc": "2019-04-21T23:00:00.000Z",
      "pair": "CADJPY",
      "expected_bar_count": 6660,
      "actual_bar_count": 6627,
      "coverage_state": "partial"
    },
    {
      "week_open_utc": "2019-04-21T23:00:00.000Z",
      "pair": "CHFJPY",
      "expected_bar_count": 6660,
      "actual_bar_count": 6596,
      "coverage_state": "partial"
    },
    {
      "week_open_utc": "2019-04-21T23:00:00.000Z",
      "pair": "EURAUD",
      "expected_bar_count": 6660,
      "actual_bar_count": 6148,
      "coverage_state": "partial"
    },
    {
      "week_open_utc": "2019-04-21T23:00:00.000Z",
      "pair": "EURCAD",
      "expected_bar_count": 6660,
      "actual_bar_count": 6649,
      "coverage_state": "partial"
    },
    {
      "week_open_utc": "2019-04-21T23:00:00.000Z",
      "pair": "EURCHF",
      "expected_bar_count": 6660,
      "actual_bar_count": 5716,
      "coverage_state": "partial"
    },
    {
      "week_open_utc": "2019-04-21T23:00:00.000Z",
      "pair": "EURGBP",
      "expected_bar_count": 6660,
      "actual_bar_count": 5983,
      "coverage_state": "partial"
    },
    {
      "week_open_utc": "2019-04-21T23:00:00.000Z",
      "pair": "EURJPY",
      "expected_bar_count": 6660,
      "actual_bar_count": 6133,
      "coverage_state": "partial"
    },
    {
      "week_open_utc": "2019-04-21T23:00:00.000Z",
      "pair": "EURNZD",
      "expected_bar_count": 6660,
      "actual_bar_count": 6646,
      "coverage_state": "partial"
    },
    {
      "week_open_utc": "2019-04-21T23:00:00.000Z",
      "pair": "EURUSD",
      "expected_bar_count": 6660,
      "actual_bar_count": 6293,
      "coverage_state": "partial"
    },
    {
      "week_open_utc": "2019-04-21T23:00:00.000Z",
      "pair": "GBPAUD",
      "expected_bar_count": 6660,
      "actual_bar_count": 6607,
      "coverage_state": "partial"
    },
    {
      "week_open_utc": "2019-04-21T23:00:00.000Z",
      "pair": "GBPCAD",
      "expected_bar_count": 6660,
      "actual_bar_count": 6646,
      "coverage_state": "partial"
    },
    {
      "week_open_utc": "2019-04-21T23:00:00.000Z",
      "pair": "GBPCHF",
      "expected_bar_count": 6660,
      "actual_bar_count": 6607,
      "coverage_state": "partial"
    },
    {
      "week_open_utc": "2019-04-21T23:00:00.000Z",
      "pair": "GBPJPY",
      "expected_bar_count": 6660,
      "actual_bar_count": 6508,
      "coverage_state": "partial"
    },
    {
      "week_open_utc": "2019-04-21T23:00:00.000Z",
      "pair": "GBPNZD",
      "expected_bar_count": 6660,
      "actual_bar_count": 6611,
      "coverage_state": "partial"
    },
    {
      "week_open_utc": "2019-04-21T23:00:00.000Z",
      "pair": "GBPUSD",
      "expected_bar_count": 6660,
      "actual_bar_count": 5968,
      "coverage_state": "partial"
    },
    {
      "week_open_utc": "2019-04-21T23:00:00.000Z",
      "pair": "NZDCAD",
      "expected_bar_count": 6660,
      "actual_bar_count": 6619,
      "coverage_state": "partial"
    }
  ]
}
```

## Reconstruction Audit

```json
{
  "source_basket_manifest_id": "gate71bm_basket_path_1A8231225169",
  "source_basket_warehouse_hash": "CD8A18C163A7B19515F8EFB948481535704704D75C3C70F620B76DA6384EB8F0",
  "weeks_checked": 373,
  "max_abs_delta_adr": 0.000005,
  "mismatch_count_gt_0001": 0,
  "largest_delta_rows": [
    {
      "week_open_utc": "2023-04-30T23:00:00.000Z",
      "pair_sum_friday_close_adr": 6.15087,
      "gate71bm_friday_close_adr": 6.150875,
      "delta_adr": -0.000005
    },
    {
      "week_open_utc": "2021-07-25T23:00:00.000Z",
      "pair_sum_friday_close_adr": -8.878605,
      "gate71bm_friday_close_adr": -8.878601,
      "delta_adr": -0.000004
    },
    {
      "week_open_utc": "2021-10-03T23:00:00.000Z",
      "pair_sum_friday_close_adr": 10.417856,
      "gate71bm_friday_close_adr": 10.417852,
      "delta_adr": 0.000004
    },
    {
      "week_open_utc": "2023-05-07T23:00:00.000Z",
      "pair_sum_friday_close_adr": -3.475986,
      "gate71bm_friday_close_adr": -3.47599,
      "delta_adr": 0.000004
    },
    {
      "week_open_utc": "2023-09-10T23:00:00.000Z",
      "pair_sum_friday_close_adr": -5.435765,
      "gate71bm_friday_close_adr": -5.435761,
      "delta_adr": -0.000004
    },
    {
      "week_open_utc": "2025-08-24T23:00:00.000Z",
      "pair_sum_friday_close_adr": -4.444418,
      "gate71bm_friday_close_adr": -4.444414,
      "delta_adr": -0.000004
    },
    {
      "week_open_utc": "2025-09-07T23:00:00.000Z",
      "pair_sum_friday_close_adr": -8.268062,
      "gate71bm_friday_close_adr": -8.268058,
      "delta_adr": -0.000004
    },
    {
      "week_open_utc": "2019-04-21T23:00:00.000Z",
      "pair_sum_friday_close_adr": -7.753745,
      "gate71bm_friday_close_adr": -7.753742,
      "delta_adr": -0.000003
    },
    {
      "week_open_utc": "2019-07-21T23:00:00.000Z",
      "pair_sum_friday_close_adr": -0.903321,
      "gate71bm_friday_close_adr": -0.903318,
      "delta_adr": -0.000003
    },
    {
      "week_open_utc": "2019-07-28T23:00:00.000Z",
      "pair_sum_friday_close_adr": 21.18108,
      "gate71bm_friday_close_adr": 21.181077,
      "delta_adr": 0.000003
    }
  ],
  "sample_reconstruction": [
    {
      "week_open_utc": "2019-04-14T23:00:00.000Z",
      "pair": "AUDCAD",
      "summary_friday_close_adr": 0.198296,
      "payload_friday_close_adr": 0.198296,
      "path_hash_matches_payload": true,
      "point_count_matches_payload": true
    },
    {
      "week_open_utc": "2022-11-07T00:00:00.000Z",
      "pair": "EURUSD",
      "summary_friday_close_adr": 3.013331,
      "payload_friday_close_adr": 3.013331,
      "path_hash_matches_payload": true,
      "point_count_matches_payload": true
    },
    {
      "week_open_utc": "2026-05-31T23:00:00.000Z",
      "pair": "USDJPY",
      "summary_friday_close_adr": -2.001787,
      "payload_friday_close_adr": -2.001787,
      "path_hash_matches_payload": true,
      "point_count_matches_payload": true
    }
  ]
}
```

## No-Drift / No-Policy Audit

```json
{
  "forbidden_base_fields": [
    "policy_id",
    "policy_decision",
    "open_state",
    "closed_state",
    "close_reason",
    "realized_policy_pnl",
    "unrealized_policy_pnl",
    "policy_drawdown",
    "promotion_flag",
    "risk_sizing"
  ],
  "checked_field_count": 36,
  "forbidden_field_violations": [],
  "required_manifest_fields_present": true,
  "required_path_point_fields_present": true,
  "columnar_storage_note": "Path points are stored as compressed columnar arrays with pair-week path_hash and chunk_hash durability, not one physical DB row per minute point."
}
```

## Validation

```json
{
  "gate74a_passed": true,
  "gate71a_passed": true,
  "gate71bm_passed": true,
  "candidate_b_forced28_preserved": true,
  "candidate_b_file_hash_matches_gate74a": true,
  "selected_weeks": 373,
  "expected_weeks": 373,
  "selected_symbols": 28,
  "expected_symbols_per_week": 28,
  "missing_price_pair_weeks": 0,
  "partial_price_pair_weeks": 10444,
  "default_adr_pair_weeks": 270,
  "reconstruction_mismatch_count_gt_0001": 0,
  "no_policy_field_violations": 0,
  "replay_adapters_started": false,
  "fixed_adr_target_tests_started": false,
  "close_winners_hold_losers_started": false,
  "carry_until_flip_performance_started": false,
  "risk_layer_started": false,
  "mt5_live_runtime_started": false,
  "brain_truth_mutated": false,
  "source_mutation_started": false,
  "exit_promotion_started": false
}
```

## Artifacts

- Summary: `docs/research/gates/gate74b/artifacts/gate74b-trade-leg-path-materialization/gate74b-summary.json`
- Schema receipt: `docs/research/gates/gate74b/artifacts/gate74b-trade-leg-path-materialization/schema-receipt.json`
- Missing/partial report: `docs/research/gates/gate74b/artifacts/gate74b-trade-leg-path-materialization/missing-partial-report.json`
- Row counts: `docs/research/gates/gate74b/artifacts/gate74b-trade-leg-path-materialization/row-counts.json`
- Chunk hashes: `docs/research/gates/gate74b/artifacts/gate74b-trade-leg-path-materialization/chunk-hashes.json`
- Reconstruction audit: `docs/research/gates/gate74b/artifacts/gate74b-trade-leg-path-materialization/sample-reconstruction-audit.json`
- No-policy audit: `docs/research/gates/gate74b/artifacts/gate74b-trade-leg-path-materialization/no-policy-fields-audit.json`
- SHA identity: `docs/research/gates/gate74b/artifacts/gate74b-trade-leg-path-materialization/gate74b-sha256.txt`

## Stop Line

Gate 74B materializes base path primitives only. Gate 74C replay adapters, fixed 0.2 ADR per-pair target tests, close-winners/hold-losers, carry-until-flip performance, dynamic exits, risk, MT5/live, source mutation, Brain mutation, and promotion remain closed until explicitly opened.
