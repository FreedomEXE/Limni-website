# Gate 57A: strength-preflight-role-lock Research Decision Manifest Evaluation

Generated: 2026-06-26T19:36:22.994Z

## Result

- Run ID: `gate57-gate57a-strength-preflight-role-lock-gate57a-strength-abs-spread-strongest-quartile-selected-20260626T193622Z-97A12B87`
- Status: `diagnostic`
- Hypothesis: `gate57a_strength_preflight_role_lock`
- Signal: `gate57a_strength_abs_spread_strongest_quartile_selected` / `fx_m1_currency_strength_v1_gate55g_friday_close_v1_gate57a_preflight`
- Decision scope: `fx_28pair_weekly_strength_abs_spread_top_quartile_7of28_selected_preflight`
- Price bundle ID: `gate55e_fx_m1_oanda_ny5_v1_20181217_20260607_8E37E953`
- Feature bundle ID: `gate55f_fx_m1_currency_strength_v1_friday_close_context`
- Manifest hash: `97A12B8702F32ED1232BB7D3D7B0445049C5BA240A94E9661817D4AE2AFF60B9`
- Evaluator version: `research_decision_evaluator_adr_grid_weekly_hold_v1`
- Evaluators: `adr_grid,weekly_hold`
- Path resolution: `1m`
- Git commit: `884c91bf92d7c287ee3483398b13e8ba9ffbefe9`
- Rerun reason: -

## Runtime Controls

- Runtime mode: `warehouse_aggregation`
- Wall-clock seconds: `6.4`
- Manifest count evaluated in process: `1`
- Union week count: `387`
- Row count evaluated in process: `2709`
- Clear runtime cache between weeks: `false`
- Runtime cache entries after run: `0`
- Runtime cache gets/hits/misses: `0/0/0`
- Runtime cache clear-all calls: `0`
- Path outcome warehouse ID: `gate57a0b_pair_week_path_outcomes_47B8F40AFB3B`

Runtime/cache controls are memory and speed controls only. They are not signal logic, strategy logic, or evaluator semantics.

## Coverage

- Weeks: 387
- Universe symbols: 28
- Decision rows: 2709
- Long rows: 1428
- Short rows: 1281

## Metrics

| Evaluator | Weeks | Rows | ADR | DD | R/DD | PF | Win rate | Missing price rows | Fills | TP | Reset | Week close |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| adr_grid | 387 | 2709 | 174.7853 | -373.2471 | 0.4683 | 1.0834 | 0.7261 | 0 | 29749 | 23328 | 3550 | 2871 |
| weekly_hold | 387 | 2709 | -112.1407 | -177.0966 | -0.6332 | 0.8989 | 0.4755 | 0 | - | - | - | - |

## Files

- Manifest: docs/research/gates/gate57/artifacts/gate57a-strength-role-evaluation/manifests/gate57-gate57a-strength-preflight-role-lock-gate57a-strength-abs-spread-strongest-quartile-selected-20260626T193622Z-97A12B87.manifest.json
- Result: docs/research/gates/gate57/artifacts/gate57a-strength-role-evaluation/results/gate57-gate57a-strength-preflight-role-lock-gate57a-strength-abs-spread-strongest-quartile-selected-20260626T193622Z-97A12B87.result.json
- Hashes: docs/research/gates/gate57/artifacts/gate57a-strength-role-evaluation/hashes/gate57-gate57a-strength-preflight-role-lock-gate57a-strength-abs-spread-strongest-quartile-selected-20260626T193622Z-97A12B87.hashes.json
- Registry: docs/research/gates/gate57/artifacts/gate57a-strength-role-evaluation/registry/research-run-registry.jsonl

## Command

`C:\Users\User\AppData\Local\Volta\tools\image\node\24.8.0\node.exe C:\Users\User\Documents\GitHub\limni-website\engine\scripts\verification\evaluate-research-decision-manifest.ts --manifest=engine/reports/gate57a-strength-role-evaluation/manifests/gate57a_strength_abs_spread_strongest_quartile_selected_manifest_v1.json --artifact-gate=gate57 --out-dir=docs/research/gates/gate57/artifacts/gate57a-strength-role-evaluation --price-bundle-id=gate55e_fx_m1_oanda_ny5_v1_20181217_20260607_8E37E953 --path-resolution=1m --evaluators=adr_grid,weekly_hold --status=diagnostic --path-outcome-warehouse-id=gate57a0b_pair_week_path_outcomes_47B8F40AFB3B`

## Boundary

This command scores a frozen manifest only. Signal derivation, bucket construction, regime filters, COT retuning, COT+Strength combination, execution optimization, risk overlays, live/MT5, and final system selection remain outside this receipt.

Receipt hash: `D6309CA46127FC00849C5DCB8895E49F0DC24FC774BD9AF1693AC9AA89627E7A`
