# Gate 57D: frs15-compressed-go-remainder-fade-rule Research Decision Manifest Evaluation

Generated: 2026-06-27T00:51:19.356Z

## Result

- Run ID: `gate57-frs15-compressed-go-remainder-fade-rule-gate57d-frs15-parent-fade-20260627T005119Z-90820405`
- Status: `diagnostic`
- Hypothesis: `frs15_compressed_go_remainder_fade_rule`
- Signal: `gate57d_frs15_parent_fade` / `friday_relative_strength_15w_v1`
- Decision scope: `fx_28pair_weekly_frs15_compressed_remainder_fade_parent_fade`
- Price bundle ID: `gate55e_fx_m1_oanda_ny5_v1_20181217_20260607_8E37E953`
- Feature bundle ID: `gate57d_frs15_compressed_go_remainder_fade_rule_v1`
- Manifest hash: `90820405FA8708B6A657A618F1219DC7CB245CFF403AACEA8A98984DBF10FC90`
- Evaluator version: `research_decision_evaluator_adr_grid_weekly_hold_v1`
- Evaluators: `adr_grid,weekly_hold`
- Path resolution: `1m`
- Git commit: `69efd13bacbaface8fd545eff018e44f71ec2989`
- Rerun reason: -

## Runtime Controls

- Runtime mode: `warehouse_aggregation`
- Wall-clock seconds: `8.4`
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
- Long rows: 5051
- Short rows: 5393

## Metrics

| Evaluator | Weeks | Rows | ADR | DD | R/DD | PF | Win rate | Missing price rows | Fills | TP | Reset | Week close |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| adr_grid | 373 | 10444 | 877.5425 | -436.3846 | 2.0109 | 1.1657 | 0.6783 | 0 | 114394 | 90130 | 14010 | 10254 |
| weekly_hold | 373 | 10444 | 268.2949 | -209.9643 | 1.2778 | 1.1246 | 0.5201 | 0 | - | - | - | - |

## Files

- Manifest: docs/research/gates/gate57/artifacts/gate57d-frs15-compressed-remainder-fade-evaluation/manifests/gate57-frs15-compressed-go-remainder-fade-rule-gate57d-frs15-parent-fade-20260627T005119Z-90820405.manifest.json
- Result: docs/research/gates/gate57/artifacts/gate57d-frs15-compressed-remainder-fade-evaluation/results/gate57-frs15-compressed-go-remainder-fade-rule-gate57d-frs15-parent-fade-20260627T005119Z-90820405.result.json
- Hashes: docs/research/gates/gate57/artifacts/gate57d-frs15-compressed-remainder-fade-evaluation/hashes/gate57-frs15-compressed-go-remainder-fade-rule-gate57d-frs15-parent-fade-20260627T005119Z-90820405.hashes.json
- Registry: docs/research/gates/gate57/artifacts/gate57d-frs15-compressed-remainder-fade-evaluation/registry/research-run-registry.jsonl

## Command

`C:\Users\User\AppData\Local\Volta\tools\image\node\24.8.0\node.exe C:\Users\User\Documents\GitHub\limni-website\engine\scripts\verification\evaluate-research-decision-manifest.ts --manifest=engine/reports/gate57d-frs15-compressed-remainder-fade/manifests/gate57d-frs15-compressed-remainder-fade-parent_fade.manifest.json --artifact-gate=gate57 --out-dir=docs/research/gates/gate57/artifacts/gate57d-frs15-compressed-remainder-fade-evaluation --price-bundle-id=gate55e_fx_m1_oanda_ny5_v1_20181217_20260607_8E37E953 --path-resolution=1m --evaluators=adr_grid,weekly_hold --status=diagnostic --path-outcome-warehouse-id=gate57a0b_pair_week_path_outcomes_47B8F40AFB3B`

## Boundary

This command scores a frozen manifest only. Signal derivation, bucket construction, regime filters, COT retuning, COT+Strength combination, execution optimization, risk overlays, live/MT5, and final system selection remain outside this receipt.

Receipt hash: `C06043E30CC045588D0744E5CB314FD8E73F09F3FC8F5023E9CA77E42925C68B`
