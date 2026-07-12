# Gate 71B Basket ADR Path Diagnostics

Generated: `2026-06-28T20:34:02.055Z`

## Verdict

`PASS_GATE71B_BASKET_ADR_PATH_DIAGNOSTICS__CLEAN_PATH_LEDGER_BUILT`

## Scope

- Builds the non-selective Candidate B weekly basket ADR path diagnostic ledger.
- Uses the Gate 71A clean weekly basket-hold exposure model, not legacy ADR Grid.
- Records compact MFE/MAE/threshold/giveback diagnostics; full minute paths are regenerated deterministically for matrix scoring.
- Does not select exits, apply risk filters, prune pairs, or mutate Candidate B.

## Validation

```json
{
  "gate71a_passed": true,
  "candidate_b_forced28_preserved": true,
  "clean_entry_exposure_model_id": "gate71_clean_weekly_basket_hold_v1",
  "legacy_adr_grid_used_as_foundation": false,
  "legacy_adr_grid_control_only": true,
  "weeks_built": 2,
  "expected_weeks": 2,
  "all_weeks_have_28_rows": true,
  "missing_price_weeks": 0,
  "default_adr_weeks": 0,
  "exit_selection_started": false,
  "risk_filters_started": false,
  "brain_truth_mutated": false,
  "runtime_seconds": 36.2,
  "path_ledger_sha256": "219D4177C4C9A9178A6A00D447708BE75CB51B3FD6779C05D8DCCBC19A74CB9C"
}
```

## Diagnostic Summary

```json
{
  "gate_id": "Gate 71B: basket-adr-path-diagnostics",
  "weeks": 2,
  "positive_hit_rates": {
    "plus_025": 1,
    "plus_050": 1,
    "plus_075": 1,
    "plus_100": 1,
    "plus_125": 1,
    "plus_150": 1,
    "plus_200": 1
  },
  "adverse_hit_rates": {
    "minus_050": 1,
    "minus_100": 1,
    "minus_150": 1,
    "minus_200": 1,
    "minus_300": 1
  },
  "profit_before_drawdown_rate": 0.5,
  "drawdown_before_profit_rate": 0.5,
  "average_peak_to_friday_giveback_adr": 17.025348,
  "max_mfe_adr": 7.761032,
  "min_mae_adr": -17.528852,
  "missing_price_weeks": 0,
  "default_adr_weeks": 0
}
```

## Artifacts

- Weekly path diagnostics: `docs/research/gates/gate71b/artifacts/gate71b-basket-adr-path-diagnostics-smoke-sqlite/candidate-b-basket-adr-path-diagnostics.rows.jsonl`
- Threshold summary: `docs/research/gates/gate71b/artifacts/gate71b-basket-adr-path-diagnostics-smoke-sqlite/threshold-hit-summary.json`
- Summary: `docs/research/gates/gate71b/artifacts/gate71b-basket-adr-path-diagnostics-smoke-sqlite/gate71b-summary.json`
- SHA identity: `docs/research/gates/gate71b/artifacts/gate71b-basket-adr-path-diagnostics-smoke-sqlite/gate71b-sha256.txt`

## Stop Line

Gate 71B is diagnostics only. Exit selection and promotion are not performed here.
