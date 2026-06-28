# Gate 71B-M Exit Path Materialization Warehouse

Generated: `2026-06-28T22:18:07.209Z`

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
  "manifest_id": "gate71bm_smoke_basket_path",
  "config_hash": "C2E8272AFAC6AA45306FFBCD516FCF4AC636091AAD7B60F407DF369C65003AFA",
  "warehouse_hash": "D2AD02FC148C11933D853D7013975FEBA14FCB817DDFF0A2AF9066EEBEDC42CC",
  "point_contract_id": "gate71_candidate_b_clean_basket_path_points_v1",
  "price_bundle_id": "gate55e_fx_m1_oanda_ny5_v1_20181217_20260607_8E37E953",
  "path_resolution": "1m",
  "candidate_id": "candidate_b_macro_anchor_with_cot_warning",
  "locked_algorithm_id": "gate69_locked_unnamed_forced28_candidate_b_default",
  "candidate_b_ledger_hash": "92C9E090F14B3EF2F96C78E749D9783F0F8F0E8E6CEA4900FDEFB115ED1BAD03",
  "entry_exposure_model_id": "gate71_clean_weekly_basket_hold_v1",
  "adr_target_pct": 1,
  "weeks": 2,
  "point_count": 13322
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
  "weeks_materialized": 2,
  "expected_weeks": 2,
  "missing_week_count": 0,
  "duplicate_week_count": 0,
  "missing_price_weeks": 0,
  "default_adr_weeks": 0,
  "runtime_seconds": 19.3
}
```

## Artifacts

- Summary: `docs/research/gates/gate71b/artifacts/gate71bm-exit-path-materialization-warehouse-smoke/gate71bm-summary.json`
- SHA identity: `docs/research/gates/gate71b/artifacts/gate71bm-exit-path-materialization-warehouse-smoke/gate71bm-sha256.txt`

## Stop Line

Gate 71B-M is materialization only. Gate 71C must replay exit policies from this warehouse rather than rebuilding raw M1 paths.
