# Gate 71B Basket ADR Path Diagnostics

Generated: `2026-06-28T23:16:32.069Z`

## Verdict

`PASS_GATE71B_BASKET_ADR_PATH_DIAGNOSTICS__CLEAN_PATH_LEDGER_BUILT`

## Scope

- Builds the non-selective Candidate B weekly basket ADR path diagnostic ledger.
- Reads Gate 71B-M materialized basket paths by default; raw M1 rebuild requires an explicit diagnostic flag.
- Uses the Gate 71A clean weekly basket-hold exposure model, not legacy ADR Grid.
- Records compact MFE/MAE/threshold/giveback diagnostics for exit replay.
- Does not select exits, apply risk filters, prune pairs, or mutate Candidate B.

## Validation

```json
{
  "gate71a_passed": true,
  "candidate_b_forced28_preserved": true,
  "clean_entry_exposure_model_id": "gate71_clean_weekly_basket_hold_v1",
  "legacy_adr_grid_used_as_foundation": false,
  "legacy_adr_grid_control_only": true,
  "weeks_built": 373,
  "expected_weeks": 373,
  "all_weeks_have_28_rows": true,
  "missing_price_weeks": 0,
  "default_adr_weeks": 10,
  "path_materialization_source": "basket_path_warehouse",
  "basket_path_warehouse_id": "gate71bm_basket_path_1A8231225169",
  "basket_path_warehouse_hash": "CD8A18C163A7B19515F8EFB948481535704704D75C3C70F620B76DA6384EB8F0",
  "raw_m1_rebuild_performed": false,
  "exit_selection_started": false,
  "risk_filters_started": false,
  "brain_truth_mutated": false,
  "runtime_seconds": 1.9,
  "path_ledger_sha256": "92B34156E40AC144A779FEDB98C36F8B552BA206ED9B86FCF2701A49FDE714DB"
}
```

## Diagnostic Summary

```json
{
  "gate_id": "Gate 71B: basket-adr-path-diagnostics",
  "weeks": 373,
  "positive_hit_rates": {
    "plus_025": 0.981233,
    "plus_050": 0.965147,
    "plus_075": 0.9437,
    "plus_100": 0.927614,
    "plus_125": 0.911528,
    "plus_150": 0.887399,
    "plus_200": 0.855228
  },
  "adverse_hit_rates": {
    "minus_050": 0.932976,
    "minus_100": 0.898123,
    "minus_150": 0.871314,
    "minus_200": 0.841823,
    "minus_300": 0.769437
  },
  "profit_before_drawdown_rate": 0.723861,
  "drawdown_before_profit_rate": 0.276139,
  "average_peak_to_friday_giveback_adr": 9.104318,
  "max_mfe_adr": 65.312854,
  "min_mae_adr": -41.478023,
  "missing_price_weeks": 0,
  "default_adr_weeks": 10
}
```

## Artifacts

- Weekly path diagnostics: `docs/research/gates/gate71b/artifacts/gate71b-basket-adr-path-diagnostics/candidate-b-basket-adr-path-diagnostics.rows.jsonl`
- Threshold summary: `docs/research/gates/gate71b/artifacts/gate71b-basket-adr-path-diagnostics/threshold-hit-summary.json`
- Summary: `docs/research/gates/gate71b/artifacts/gate71b-basket-adr-path-diagnostics/gate71b-summary.json`
- SHA identity: `docs/research/gates/gate71b/artifacts/gate71b-basket-adr-path-diagnostics/gate71b-sha256.txt`

## Stop Line

Gate 71B is diagnostics only. Exit selection and promotion are not performed here.
