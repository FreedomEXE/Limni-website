# Gate 57A: strength-preflight-role-lock Research Decision Manifest Evaluation

Generated: 2026-06-26T19:36:58.510Z

## Result

- Run ID: `gate57-gate57a-strength-preflight-role-lock-gate57a-strength-rolling-52w-context-selected-20260626T193658Z-A2FB501D`
- Status: `diagnostic`
- Hypothesis: `gate57a_strength_preflight_role_lock`
- Signal: `gate57a_strength_rolling_52w_context_selected` / `fx_m1_currency_strength_v1_gate55g_friday_close_v1_gate57a_preflight`
- Decision scope: `fx_28pair_weekly_strength_selected_with_52w_prior_context_preflight`
- Price bundle ID: `gate55e_fx_m1_oanda_ny5_v1_20181217_20260607_8E37E953`
- Feature bundle ID: `gate55f_fx_m1_currency_strength_v1_friday_close_context`
- Manifest hash: `A2FB501DCA5EC099BFB372191C157B97DC9A523B529213D8632F810D73744157`
- Evaluator version: `research_decision_evaluator_adr_grid_weekly_hold_v1`
- Evaluators: `adr_grid,weekly_hold`
- Path resolution: `1m`
- Git commit: `884c91bf92d7c287ee3483398b13e8ba9ffbefe9`
- Rerun reason: -

## Runtime Controls

- Runtime mode: `warehouse_aggregation`
- Wall-clock seconds: `7.6`
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

- Manifest: docs/research/gates/gate57/artifacts/gate57a-strength-role-evaluation/manifests/gate57-gate57a-strength-preflight-role-lock-gate57a-strength-rolling-52w-context-selected-20260626T193658Z-A2FB501D.manifest.json
- Result: docs/research/gates/gate57/artifacts/gate57a-strength-role-evaluation/results/gate57-gate57a-strength-preflight-role-lock-gate57a-strength-rolling-52w-context-selected-20260626T193658Z-A2FB501D.result.json
- Hashes: docs/research/gates/gate57/artifacts/gate57a-strength-role-evaluation/hashes/gate57-gate57a-strength-preflight-role-lock-gate57a-strength-rolling-52w-context-selected-20260626T193658Z-A2FB501D.hashes.json
- Registry: docs/research/gates/gate57/artifacts/gate57a-strength-role-evaluation/registry/research-run-registry.jsonl

## Command

`C:\Users\User\AppData\Local\Volta\tools\image\node\24.8.0\node.exe C:\Users\User\Documents\GitHub\limni-website\engine\scripts\verification\evaluate-research-decision-manifest.ts --manifest=engine/reports/gate57a-strength-role-evaluation/manifests/gate57a_strength_rolling_52w_context_selected_manifest_v1.json --artifact-gate=gate57 --out-dir=docs/research/gates/gate57/artifacts/gate57a-strength-role-evaluation --price-bundle-id=gate55e_fx_m1_oanda_ny5_v1_20181217_20260607_8E37E953 --path-resolution=1m --evaluators=adr_grid,weekly_hold --status=diagnostic --path-outcome-warehouse-id=gate57a0b_pair_week_path_outcomes_47B8F40AFB3B`

## Boundary

This command scores a frozen manifest only. Signal derivation, bucket construction, regime filters, COT retuning, COT+Strength combination, execution optimization, risk overlays, live/MT5, and final system selection remain outside this receipt.

Receipt hash: `17E83E3E99E6D31CDD3D10F1A8FEB0FDD37DFD4C9074414B9B21F22D22C9241A`
