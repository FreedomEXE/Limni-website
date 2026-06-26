# Gate 57A: strength-preflight-role-lock Research Decision Manifest Evaluation

Generated: 2026-06-26T19:37:16.144Z

## Result

- Run ID: `gate57-gate57a-strength-role-evaluation-control-gate57a-control-selected-same-window-rolling52-20260626T193715Z-C100B45F`
- Status: `diagnostic`
- Hypothesis: `gate57a_strength_role_evaluation_control`
- Signal: `gate57a_control_selected_same_window_rolling52` / `fx_m1_currency_strength_v1_gate55g_friday_close_v1_gate57a_control`
- Decision scope: `fx_28pair_weekly_strength_selected_same_window_as_rolling52_control`
- Price bundle ID: `gate55e_fx_m1_oanda_ny5_v1_20181217_20260607_8E37E953`
- Feature bundle ID: `gate55f_fx_m1_currency_strength_v1_friday_close_context`
- Manifest hash: `C100B45FDEB23E1F41B9EC3A5D0B9D0C9D301B2DC2EE6D72A9185C596038830C`
- Evaluator version: `research_decision_evaluator_adr_grid_weekly_hold_v1`
- Evaluators: `adr_grid,weekly_hold`
- Path resolution: `1m`
- Git commit: `884c91bf92d7c287ee3483398b13e8ba9ffbefe9`
- Rerun reason: -

## Runtime Controls

- Runtime mode: `warehouse_aggregation`
- Wall-clock seconds: `9.7`
- Manifest count evaluated in process: `1`
- Union week count: `335`
- Row count evaluated in process: `9380`
- Clear runtime cache between weeks: `false`
- Runtime cache entries after run: `0`
- Runtime cache gets/hits/misses: `0/0/0`
- Runtime cache clear-all calls: `0`
- Path outcome warehouse ID: `gate57a0b_pair_week_path_outcomes_47B8F40AFB3B`

Runtime/cache controls are memory and speed controls only. They are not signal logic, strategy logic, or evaluator semantics.

## Coverage

- Weeks: 335
- Universe symbols: 28
- Decision rows: 9380
- Long rows: 4880
- Short rows: 4500

## Metrics

| Evaluator | Weeks | Rows | ADR | DD | R/DD | PF | Win rate | Missing price rows | Fills | TP | Reset | Week close |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| adr_grid | 335 | 9380 | 1671.1975 | -364.7738 | 4.5815 | 1.4121 | 0.6687 | 0 | 103613 | 81854 | 12679 | 9080 |
| weekly_hold | 335 | 9380 | -165.6235 | -240.3576 | -0.6891 | 0.9164 | 0.4806 | 0 | - | - | - | - |

## Files

- Manifest: docs/research/gates/gate57/artifacts/gate57a-strength-role-evaluation/manifests/gate57-gate57a-strength-role-evaluation-control-gate57a-control-selected-same-window-rolling52-20260626T193715Z-C100B45F.manifest.json
- Result: docs/research/gates/gate57/artifacts/gate57a-strength-role-evaluation/results/gate57-gate57a-strength-role-evaluation-control-gate57a-control-selected-same-window-rolling52-20260626T193715Z-C100B45F.result.json
- Hashes: docs/research/gates/gate57/artifacts/gate57a-strength-role-evaluation/hashes/gate57-gate57a-strength-role-evaluation-control-gate57a-control-selected-same-window-rolling52-20260626T193715Z-C100B45F.hashes.json
- Registry: docs/research/gates/gate57/artifacts/gate57a-strength-role-evaluation/registry/research-run-registry.jsonl

## Command

`C:\Users\User\AppData\Local\Volta\tools\image\node\24.8.0\node.exe C:\Users\User\Documents\GitHub\limni-website\engine\scripts\verification\evaluate-research-decision-manifest.ts --manifest=engine/reports/gate57a-strength-role-evaluation/manifests/gate57a_control_selected_same_window_rolling52_manifest_v1.json --artifact-gate=gate57 --out-dir=docs/research/gates/gate57/artifacts/gate57a-strength-role-evaluation --price-bundle-id=gate55e_fx_m1_oanda_ny5_v1_20181217_20260607_8E37E953 --path-resolution=1m --evaluators=adr_grid,weekly_hold --status=diagnostic --path-outcome-warehouse-id=gate57a0b_pair_week_path_outcomes_47B8F40AFB3B`

## Boundary

This command scores a frozen manifest only. Signal derivation, bucket construction, regime filters, COT retuning, COT+Strength combination, execution optimization, risk overlays, live/MT5, and final system selection remain outside this receipt.

Receipt hash: `92FCC07E10D154DA16F3DC0CB9EDF99C4FA8A54D19EC8AE2D138BC68BC619F18`
