# Gate 57B: friday-strength-15w-relative-lifecycle Research Decision Manifest Evaluation

Generated: 2026-06-26T20:28:49.799Z

## Result

- Run ID: `gate57-friday-strength-15w-relative-lifecycle-gate57b-frs15-extreme-selected-20260626T202849Z-D656F556`
- Status: `diagnostic`
- Hypothesis: `friday_strength_15w_relative_lifecycle`
- Signal: `gate57b_frs15_extreme_selected` / `friday_relative_strength_15w_v1`
- Decision scope: `fx_28pair_weekly_friday_relative_strength_15w_extreme_selected`
- Price bundle ID: `gate55e_fx_m1_oanda_ny5_v1_20181217_20260607_8E37E953`
- Feature bundle ID: `gate57b_friday_relative_strength_15w_v1`
- Manifest hash: `D656F556467B4B696E1D2B46B2D879DFC6FCA1AE03659A7EAA498CC0F71FA1C9`
- Evaluator version: `research_decision_evaluator_adr_grid_weekly_hold_v1`
- Evaluators: `adr_grid,weekly_hold`
- Path resolution: `1m`
- Git commit: `884c91bf92d7c287ee3483398b13e8ba9ffbefe9`
- Rerun reason: -

## Runtime Controls

- Runtime mode: `warehouse_aggregation`
- Wall-clock seconds: `6.1`
- Manifest count evaluated in process: `1`
- Union week count: `373`
- Row count evaluated in process: `2611`
- Clear runtime cache between weeks: `false`
- Runtime cache entries after run: `0`
- Runtime cache gets/hits/misses: `0/0/0`
- Runtime cache clear-all calls: `0`
- Path outcome warehouse ID: `gate57a0b_pair_week_path_outcomes_47B8F40AFB3B`

Runtime/cache controls are memory and speed controls only. They are not signal logic, strategy logic, or evaluator semantics.

## Coverage

- Weeks: 373
- Universe symbols: 28
- Decision rows: 2611
- Long rows: 1454
- Short rows: 1157

## Metrics

| Evaluator | Weeks | Rows | ADR | DD | R/DD | PF | Win rate | Missing price rows | Fills | TP | Reset | Week close |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| adr_grid | 373 | 2611 | -25.4719 | -430.7950 | -0.0591 | 0.9884 | 0.7641 | 0 | 28425 | 22240 | 3625 | 2560 |
| weekly_hold | 373 | 2611 | -113.1015 | -256.7215 | -0.4406 | 0.9013 | 0.4906 | 0 | - | - | - | - |

## Files

- Manifest: docs/research/gates/gate57/artifacts/gate57b-friday-strength15w-evaluation/manifests/gate57-friday-strength-15w-relative-lifecycle-gate57b-frs15-extreme-selected-20260626T202849Z-D656F556.manifest.json
- Result: docs/research/gates/gate57/artifacts/gate57b-friday-strength15w-evaluation/results/gate57-friday-strength-15w-relative-lifecycle-gate57b-frs15-extreme-selected-20260626T202849Z-D656F556.result.json
- Hashes: docs/research/gates/gate57/artifacts/gate57b-friday-strength15w-evaluation/hashes/gate57-friday-strength-15w-relative-lifecycle-gate57b-frs15-extreme-selected-20260626T202849Z-D656F556.hashes.json
- Registry: docs/research/gates/gate57/artifacts/gate57b-friday-strength15w-evaluation/registry/research-run-registry.jsonl

## Command

`C:\Users\User\AppData\Local\Volta\tools\image\node\24.8.0\node.exe C:\Users\User\Documents\GitHub\limni-website\engine\scripts\verification\evaluate-research-decision-manifest.ts --manifest=engine/reports/gate57b-friday-strength15w/manifests/gate57b-friday-relative-strength-15w-extreme_selected.manifest.json --artifact-gate=gate57 --out-dir=docs/research/gates/gate57/artifacts/gate57b-friday-strength15w-evaluation --price-bundle-id=gate55e_fx_m1_oanda_ny5_v1_20181217_20260607_8E37E953 --path-resolution=1m --evaluators=adr_grid,weekly_hold --status=diagnostic --path-outcome-warehouse-id=gate57a0b_pair_week_path_outcomes_47B8F40AFB3B`

## Boundary

This command scores a frozen manifest only. Signal derivation, bucket construction, regime filters, COT retuning, COT+Strength combination, execution optimization, risk overlays, live/MT5, and final system selection remain outside this receipt.

Receipt hash: `DA9E1B3ED08555D248F5CB60EDCC271880A08C9887DA7CA4E5D7699CBA4692BB`
