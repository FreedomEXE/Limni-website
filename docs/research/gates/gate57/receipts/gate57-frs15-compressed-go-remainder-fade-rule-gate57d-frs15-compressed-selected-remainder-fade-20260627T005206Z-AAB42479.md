# Gate 57D: frs15-compressed-go-remainder-fade-rule Research Decision Manifest Evaluation

Generated: 2026-06-27T00:52:07.097Z

## Result

- Run ID: `gate57-frs15-compressed-go-remainder-fade-rule-gate57d-frs15-compressed-selected-remainder-fade-20260627T005206Z-AAB42479`
- Status: `diagnostic`
- Hypothesis: `frs15_compressed_go_remainder_fade_rule`
- Signal: `gate57d_frs15_compressed_selected_remainder_fade` / `friday_relative_strength_15w_v1`
- Decision scope: `fx_28pair_weekly_frs15_compressed_remainder_fade_compressed_selected_remainder_fade`
- Price bundle ID: `gate55e_fx_m1_oanda_ny5_v1_20181217_20260607_8E37E953`
- Feature bundle ID: `gate57d_frs15_compressed_go_remainder_fade_rule_v1`
- Manifest hash: `AAB42479A02155CC55D96340890CDAB5390DBEBA02FF3ACC1867D988BA348399`
- Evaluator version: `research_decision_evaluator_adr_grid_weekly_hold_v1`
- Evaluators: `adr_grid,weekly_hold`
- Path resolution: `1m`
- Git commit: `69efd13bacbaface8fd545eff018e44f71ec2989`
- Rerun reason: -

## Runtime Controls

- Runtime mode: `warehouse_aggregation`
- Wall-clock seconds: `11.4`
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
- Long rows: 4980
- Short rows: 5464

## Metrics

| Evaluator | Weeks | Rows | ADR | DD | R/DD | PF | Win rate | Missing price rows | Fills | TP | Reset | Week close |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| adr_grid | 373 | 10444 | 1339.8105 | -285.5127 | 4.6926 | 1.2864 | 0.6702 | 0 | 114401 | 90236 | 14289 | 9876 |
| weekly_hold | 373 | 10444 | 436.1613 | -181.9718 | 2.3969 | 1.2349 | 0.5201 | 0 | - | - | - | - |

## Files

- Manifest: docs/research/gates/gate57/artifacts/gate57d-frs15-compressed-remainder-fade-evaluation/manifests/gate57-frs15-compressed-go-remainder-fade-rule-gate57d-frs15-compressed-selected-remainder-fade-20260627T005206Z-AAB42479.manifest.json
- Result: docs/research/gates/gate57/artifacts/gate57d-frs15-compressed-remainder-fade-evaluation/results/gate57-frs15-compressed-go-remainder-fade-rule-gate57d-frs15-compressed-selected-remainder-fade-20260627T005206Z-AAB42479.result.json
- Hashes: docs/research/gates/gate57/artifacts/gate57d-frs15-compressed-remainder-fade-evaluation/hashes/gate57-frs15-compressed-go-remainder-fade-rule-gate57d-frs15-compressed-selected-remainder-fade-20260627T005206Z-AAB42479.hashes.json
- Registry: docs/research/gates/gate57/artifacts/gate57d-frs15-compressed-remainder-fade-evaluation/registry/research-run-registry.jsonl

## Command

`C:\Users\User\AppData\Local\Volta\tools\image\node\24.8.0\node.exe C:\Users\User\Documents\GitHub\limni-website\engine\scripts\verification\evaluate-research-decision-manifest.ts --manifest=engine/reports/gate57d-frs15-compressed-remainder-fade/manifests/gate57d-frs15-compressed-remainder-fade-compressed_selected_remainder_fade.manifest.json --artifact-gate=gate57 --out-dir=docs/research/gates/gate57/artifacts/gate57d-frs15-compressed-remainder-fade-evaluation --price-bundle-id=gate55e_fx_m1_oanda_ny5_v1_20181217_20260607_8E37E953 --path-resolution=1m --evaluators=adr_grid,weekly_hold --status=diagnostic --path-outcome-warehouse-id=gate57a0b_pair_week_path_outcomes_47B8F40AFB3B`

## Boundary

This command scores a frozen manifest only. Signal derivation, bucket construction, regime filters, COT retuning, COT+Strength combination, execution optimization, risk overlays, live/MT5, and final system selection remain outside this receipt.

Receipt hash: `EDAEF0C8F2E5A485D37ABF6FDE264A2D7E85E4E752B64119FB23849179A4976B`
