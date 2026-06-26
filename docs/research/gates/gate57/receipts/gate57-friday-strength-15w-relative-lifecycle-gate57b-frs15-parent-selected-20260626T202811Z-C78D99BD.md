# Gate 57B: friday-strength-15w-relative-lifecycle Research Decision Manifest Evaluation

Generated: 2026-06-26T20:28:11.982Z

## Result

- Run ID: `gate57-friday-strength-15w-relative-lifecycle-gate57b-frs15-parent-selected-20260626T202811Z-C78D99BD`
- Status: `diagnostic`
- Hypothesis: `friday_strength_15w_relative_lifecycle`
- Signal: `gate57b_frs15_parent_selected` / `friday_relative_strength_15w_v1`
- Decision scope: `fx_28pair_weekly_friday_relative_strength_15w_parent_selected`
- Price bundle ID: `gate55e_fx_m1_oanda_ny5_v1_20181217_20260607_8E37E953`
- Feature bundle ID: `gate57b_friday_relative_strength_15w_v1`
- Manifest hash: `C78D99BD8252ACB6C38E33B9C78ABEF56771CD6311AEFE74188E1D86CC20043B`
- Evaluator version: `research_decision_evaluator_adr_grid_weekly_hold_v1`
- Evaluators: `adr_grid,weekly_hold`
- Path resolution: `1m`
- Git commit: `884c91bf92d7c287ee3483398b13e8ba9ffbefe9`
- Rerun reason: -

## Runtime Controls

- Runtime mode: `warehouse_aggregation`
- Wall-clock seconds: `6.7`
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
- Long rows: 5393
- Short rows: 5051

## Metrics

| Evaluator | Weeks | Rows | ADR | DD | R/DD | PF | Win rate | Missing price rows | Fills | TP | Reset | Week close |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| adr_grid | 373 | 10444 | 1244.3749 | -691.1957 | 1.8003 | 1.2442 | 0.6836 | 0 | 115320 | 90980 | 14229 | 10111 |
| weekly_hold | 373 | 10444 | -268.2949 | -526.9812 | -0.5091 | 0.8892 | 0.4799 | 0 | - | - | - | - |

## Files

- Manifest: docs/research/gates/gate57/artifacts/gate57b-friday-strength15w-evaluation/manifests/gate57-friday-strength-15w-relative-lifecycle-gate57b-frs15-parent-selected-20260626T202811Z-C78D99BD.manifest.json
- Result: docs/research/gates/gate57/artifacts/gate57b-friday-strength15w-evaluation/results/gate57-friday-strength-15w-relative-lifecycle-gate57b-frs15-parent-selected-20260626T202811Z-C78D99BD.result.json
- Hashes: docs/research/gates/gate57/artifacts/gate57b-friday-strength15w-evaluation/hashes/gate57-friday-strength-15w-relative-lifecycle-gate57b-frs15-parent-selected-20260626T202811Z-C78D99BD.hashes.json
- Registry: docs/research/gates/gate57/artifacts/gate57b-friday-strength15w-evaluation/registry/research-run-registry.jsonl

## Command

`C:\Users\User\AppData\Local\Volta\tools\image\node\24.8.0\node.exe C:\Users\User\Documents\GitHub\limni-website\engine\scripts\verification\evaluate-research-decision-manifest.ts --manifest=engine/reports/gate57b-friday-strength15w/manifests/gate57b-friday-relative-strength-15w-parent_selected.manifest.json --artifact-gate=gate57 --out-dir=docs/research/gates/gate57/artifacts/gate57b-friday-strength15w-evaluation --price-bundle-id=gate55e_fx_m1_oanda_ny5_v1_20181217_20260607_8E37E953 --path-resolution=1m --evaluators=adr_grid,weekly_hold --status=diagnostic --path-outcome-warehouse-id=gate57a0b_pair_week_path_outcomes_47B8F40AFB3B`

## Boundary

This command scores a frozen manifest only. Signal derivation, bucket construction, regime filters, COT retuning, COT+Strength combination, execution optimization, risk overlays, live/MT5, and final system selection remain outside this receipt.

Receipt hash: `9B34AADD9A831164DBAD386276F2B636DF20054F097F94433E60FF30230A8521`
