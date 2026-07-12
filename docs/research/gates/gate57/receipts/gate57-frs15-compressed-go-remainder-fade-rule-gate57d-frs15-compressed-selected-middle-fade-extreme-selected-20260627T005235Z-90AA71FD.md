# Gate 57D: frs15-compressed-go-remainder-fade-rule Research Decision Manifest Evaluation

Generated: 2026-06-27T00:52:36.371Z

## Result

- Run ID: `gate57-frs15-compressed-go-remainder-fade-rule-gate57d-frs15-compressed-selected-middle-fade-extreme-selected-20260627T005235Z-90AA71FD`
- Status: `diagnostic`
- Hypothesis: `frs15_compressed_go_remainder_fade_rule`
- Signal: `gate57d_frs15_compressed_selected_middle_fade_extreme_selected` / `friday_relative_strength_15w_v1`
- Decision scope: `fx_28pair_weekly_frs15_compressed_remainder_fade_compressed_selected_middle_fade_extreme_selected`
- Price bundle ID: `gate55e_fx_m1_oanda_ny5_v1_20181217_20260607_8E37E953`
- Feature bundle ID: `gate57d_frs15_compressed_go_remainder_fade_rule_v1`
- Manifest hash: `90AA71FD06B870EBC3CC1AE92F7FD12FF2580D85FD13627B1941FADE94EE4FD7`
- Evaluator version: `research_decision_evaluator_adr_grid_weekly_hold_v1`
- Evaluators: `adr_grid,weekly_hold`
- Path resolution: `1m`
- Git commit: `69efd13bacbaface8fd545eff018e44f71ec2989`
- Rerun reason: -

## Runtime Controls

- Runtime mode: `warehouse_aggregation`
- Wall-clock seconds: `9.4`
- Manifest count evaluated in process: `1`
- Union week count: `373`
- Row count evaluated in process: `10444`
- Clear runtime cache between weeks: `false`
- Runtime cache entries after run: `0`
- Runtime cache gets/hits/misses: `0/0/0`
- Runtime cache clear-all calls: `0`
- Path outcome warehouse ID: `gate57a0b_pair_week_path_outcomes_47B8F40AFB3B`

Runtime/cache controls are memory and speed controls only. They are not signal logic, strategy logic, or evaluator semantics.

## Coverage

- Weeks: 373
- Universe symbols: 28
- Decision rows: 10444
- Long rows: 5277
- Short rows: 5167

## Metrics

| Evaluator | Weeks | Rows | ADR | DD | R/DD | PF | Win rate | Missing price rows | Fills | TP | Reset | Week close |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| adr_grid | 373 | 10444 | 1316.0476 | -564.9370 | 2.3295 | 1.3211 | 0.6622 | 0 | 114395 | 90239 | 14206 | 9950 |
| weekly_hold | 373 | 10444 | 209.9584 | -86.6383 | 2.4234 | 1.2461 | 0.5603 | 0 | - | - | - | - |

## Files

- Manifest: docs/research/gates/gate57/artifacts/gate57d-frs15-compressed-remainder-fade-evaluation/manifests/gate57-frs15-compressed-go-remainder-fade-rule-gate57d-frs15-compressed-selected-middle-fade-extreme-selected-20260627T005235Z-90AA71FD.manifest.json
- Result: docs/research/gates/gate57/artifacts/gate57d-frs15-compressed-remainder-fade-evaluation/results/gate57-frs15-compressed-go-remainder-fade-rule-gate57d-frs15-compressed-selected-middle-fade-extreme-selected-20260627T005235Z-90AA71FD.result.json
- Hashes: docs/research/gates/gate57/artifacts/gate57d-frs15-compressed-remainder-fade-evaluation/hashes/gate57-frs15-compressed-go-remainder-fade-rule-gate57d-frs15-compressed-selected-middle-fade-extreme-selected-20260627T005235Z-90AA71FD.hashes.json
- Registry: docs/research/gates/gate57/artifacts/gate57d-frs15-compressed-remainder-fade-evaluation/registry/research-run-registry.jsonl

## Command

`C:\Users\User\AppData\Local\Volta\tools\image\node\24.8.0\node.exe C:\Users\User\Documents\GitHub\limni-website\engine\scripts\verification\evaluate-research-decision-manifest.ts --manifest=engine/reports/gate57d-frs15-compressed-remainder-fade/manifests/gate57d-frs15-compressed-remainder-fade-compressed_selected_middle_fade_extreme_selected.manifest.json --artifact-gate=gate57 --out-dir=docs/research/gates/gate57/artifacts/gate57d-frs15-compressed-remainder-fade-evaluation --price-bundle-id=gate55e_fx_m1_oanda_ny5_v1_20181217_20260607_8E37E953 --path-resolution=1m --evaluators=adr_grid,weekly_hold --status=diagnostic --path-outcome-warehouse-id=gate57a0b_pair_week_path_outcomes_47B8F40AFB3B`

## Boundary

This command scores a frozen manifest only. Signal derivation, bucket construction, regime filters, COT retuning, COT+Strength combination, execution optimization, risk overlays, live/MT5, and final system selection remain outside this receipt.

Receipt hash: `A994A272F8198EB4CC0C1CB00D81D55CF8D9DF87C9BFE0BC948AADDD75B26B7A`
