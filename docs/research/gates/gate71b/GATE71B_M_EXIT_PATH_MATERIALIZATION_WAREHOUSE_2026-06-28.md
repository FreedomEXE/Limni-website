# Gate 71B-M Exit Path Materialization Warehouse

Generated: `2026-06-28T23:15:17.207Z`

## Verdict

`PASS_GATE71BM_EXIT_PATH_MATERIALIZATION_WAREHOUSE__FROZEN_PATH_READY_FOR_REPLAY`

## Scope

- Materializes the clean Candidate B weekly basket floating P/L path once per input/exposure version.
- Separates expensive M1 path construction from cheap exit-policy replay.
- Uses the Gate 71A clean weekly basket-hold exposure model; legacy ADR Grid remains control-only.
- Does not select, optimize, or promote an exit rule.

## Warehouse

```json
{
  "manifest_id": "gate71bm_basket_path_1A8231225169",
  "config_hash": "1A8231225169933BBAB7D5A478429D191305F660F1F59E2F188696E80F88A252",
  "warehouse_hash": "CD8A18C163A7B19515F8EFB948481535704704D75C3C70F620B76DA6384EB8F0",
  "point_contract_id": "gate71_candidate_b_clean_basket_path_points_v1",
  "price_bundle_id": "gate55e_fx_m1_oanda_ny5_v1_20181217_20260607_8E37E953",
  "path_resolution": "1m",
  "candidate_id": "candidate_b_macro_anchor_with_cot_warning",
  "locked_algorithm_id": "gate69_locked_unnamed_forced28_candidate_b_default",
  "candidate_b_ledger_hash": "92C9E090F14B3EF2F96C78E749D9783F0F8F0E8E6CEA4900FDEFB115ED1BAD03",
  "entry_exposure_model_id": "gate71_clean_weekly_basket_hold_v1",
  "adr_target_pct": 1,
  "weeks": 373,
  "point_count": 2484553
}
```

## Validation

```json
{
  "gate71a_passed": true,
  "candidate_b_forced28_preserved": true,
  "clean_entry_exposure_model_id": "gate71_clean_weekly_basket_hold_v1",
  "legacy_adr_grid_used_as_foundation": false,
  "exit_policy_replay_started": false,
  "exit_policy_promoted": false,
  "risk_filters_started": false,
  "brain_truth_mutated": false,
  "weeks_materialized": 373,
  "expected_weeks": 373,
  "missing_week_count": 0,
  "duplicate_week_count": 0,
  "missing_price_weeks": 0,
  "default_adr_weeks": 10,
  "runtime_seconds": 3233.8
}
```

## Artifacts

- Summary: `docs/research/gates/gate71b/artifacts/gate71bm-exit-path-materialization-warehouse/gate71bm-summary.json`
- SHA identity: `docs/research/gates/gate71b/artifacts/gate71bm-exit-path-materialization-warehouse/gate71bm-sha256.txt`

## Stop Line

Gate 71B-M is materialization only. Gate 71C must replay exit policies from this warehouse rather than rebuilding raw M1 paths.
