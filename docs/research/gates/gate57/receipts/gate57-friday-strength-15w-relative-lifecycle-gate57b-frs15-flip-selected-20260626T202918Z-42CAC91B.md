# Gate 57B: friday-strength-15w-relative-lifecycle Research Decision Manifest Evaluation

Generated: 2026-06-26T20:29:18.486Z

## Result

- Run ID: `gate57-friday-strength-15w-relative-lifecycle-gate57b-frs15-flip-selected-20260626T202918Z-42CAC91B`
- Status: `diagnostic`
- Hypothesis: `friday_strength_15w_relative_lifecycle`
- Signal: `gate57b_frs15_flip_selected` / `friday_relative_strength_15w_v1`
- Decision scope: `fx_28pair_weekly_friday_relative_strength_15w_flip_selected`
- Price bundle ID: `gate55e_fx_m1_oanda_ny5_v1_20181217_20260607_8E37E953`
- Feature bundle ID: `gate57b_friday_relative_strength_15w_v1`
- Manifest hash: `42CAC91BF2482AE8A4AAB87A05FDEF0929F617CF702A4819B04033B8C46EFCC0`
- Evaluator version: `research_decision_evaluator_adr_grid_weekly_hold_v1`
- Evaluators: `adr_grid,weekly_hold`
- Path resolution: `1m`
- Git commit: `884c91bf92d7c287ee3483398b13e8ba9ffbefe9`
- Rerun reason: -

## Runtime Controls

- Runtime mode: `warehouse_aggregation`
- Wall-clock seconds: `5.2`
- Manifest count evaluated in process: `1`
- Union week count: `352`
- Row count evaluated in process: `1299`
- Clear runtime cache between weeks: `false`
- Runtime cache entries after run: `0`
- Runtime cache gets/hits/misses: `0/0/0`
- Runtime cache clear-all calls: `0`
- Path outcome warehouse ID: `gate57a0b_pair_week_path_outcomes_47B8F40AFB3B`

Runtime/cache controls are memory and speed controls only. They are not signal logic, strategy logic, or evaluator semantics.

## Coverage

- Weeks: 352
- Universe symbols: 28
- Decision rows: 1299
- Long rows: 647
- Short rows: 652

## Metrics

| Evaluator | Weeks | Rows | ADR | DD | R/DD | PF | Win rate | Missing price rows | Fills | TP | Reset | Week close |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| adr_grid | 352 | 1299 | 211.7274 | -116.0877 | 1.8239 | 1.2306 | 0.7727 | 0 | 14292 | 11277 | 1585 | 1430 |
| weekly_hold | 352 | 1299 | 44.8026 | -61.7152 | 0.726 | 1.0907 | 0.5426 | 0 | - | - | - | - |

## Files

- Manifest: docs/research/gates/gate57/artifacts/gate57b-friday-strength15w-evaluation/manifests/gate57-friday-strength-15w-relative-lifecycle-gate57b-frs15-flip-selected-20260626T202918Z-42CAC91B.manifest.json
- Result: docs/research/gates/gate57/artifacts/gate57b-friday-strength15w-evaluation/results/gate57-friday-strength-15w-relative-lifecycle-gate57b-frs15-flip-selected-20260626T202918Z-42CAC91B.result.json
- Hashes: docs/research/gates/gate57/artifacts/gate57b-friday-strength15w-evaluation/hashes/gate57-friday-strength-15w-relative-lifecycle-gate57b-frs15-flip-selected-20260626T202918Z-42CAC91B.hashes.json
- Registry: docs/research/gates/gate57/artifacts/gate57b-friday-strength15w-evaluation/registry/research-run-registry.jsonl

## Command

`C:\Users\User\AppData\Local\Volta\tools\image\node\24.8.0\node.exe C:\Users\User\Documents\GitHub\limni-website\engine\scripts\verification\evaluate-research-decision-manifest.ts --manifest=engine/reports/gate57b-friday-strength15w/manifests/gate57b-friday-relative-strength-15w-flip_selected.manifest.json --artifact-gate=gate57 --out-dir=docs/research/gates/gate57/artifacts/gate57b-friday-strength15w-evaluation --price-bundle-id=gate55e_fx_m1_oanda_ny5_v1_20181217_20260607_8E37E953 --path-resolution=1m --evaluators=adr_grid,weekly_hold --status=diagnostic --path-outcome-warehouse-id=gate57a0b_pair_week_path_outcomes_47B8F40AFB3B`

## Boundary

This command scores a frozen manifest only. Signal derivation, bucket construction, regime filters, COT retuning, COT+Strength combination, execution optimization, risk overlays, live/MT5, and final system selection remain outside this receipt.

Receipt hash: `B848D22E6063CEC2622DEAFA4AA89848CDC3680EF978D952720A89D54D590F79`
