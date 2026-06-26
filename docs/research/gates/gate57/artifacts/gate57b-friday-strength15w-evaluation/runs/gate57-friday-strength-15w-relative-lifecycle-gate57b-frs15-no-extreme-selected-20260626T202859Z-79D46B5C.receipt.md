# Gate 57B: friday-strength-15w-relative-lifecycle Research Decision Manifest Evaluation

Generated: 2026-06-26T20:28:59.875Z

## Result

- Run ID: `gate57-friday-strength-15w-relative-lifecycle-gate57b-frs15-no-extreme-selected-20260626T202859Z-79D46B5C`
- Status: `diagnostic`
- Hypothesis: `friday_strength_15w_relative_lifecycle`
- Signal: `gate57b_frs15_no_extreme_selected` / `friday_relative_strength_15w_v1`
- Decision scope: `fx_28pair_weekly_friday_relative_strength_15w_no_extreme_selected`
- Price bundle ID: `gate55e_fx_m1_oanda_ny5_v1_20181217_20260607_8E37E953`
- Feature bundle ID: `gate57b_friday_relative_strength_15w_v1`
- Manifest hash: `79D46B5CE925611550811F5560AA52C991DC688528838CB4CA5458F278B64A4D`
- Evaluator version: `research_decision_evaluator_adr_grid_weekly_hold_v1`
- Evaluators: `adr_grid,weekly_hold`
- Path resolution: `1m`
- Git commit: `884c91bf92d7c287ee3483398b13e8ba9ffbefe9`
- Rerun reason: -

## Runtime Controls

- Runtime mode: `warehouse_aggregation`
- Wall-clock seconds: `6.2`
- Manifest count evaluated in process: `1`
- Union week count: `373`
- Row count evaluated in process: `7833`
- Clear runtime cache between weeks: `false`
- Runtime cache entries after run: `0`
- Runtime cache gets/hits/misses: `0/0/0`
- Runtime cache clear-all calls: `0`
- Path outcome warehouse ID: `gate57a0b_pair_week_path_outcomes_47B8F40AFB3B`

Runtime/cache controls are memory and speed controls only. They are not signal logic, strategy logic, or evaluator semantics.

## Coverage

- Weeks: 373
- Universe symbols: 28
- Decision rows: 7833
- Long rows: 3939
- Short rows: 3894

## Metrics

| Evaluator | Weeks | Rows | ADR | DD | R/DD | PF | Win rate | Missing price rows | Fills | TP | Reset | Week close |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| adr_grid | 373 | 7833 | 1269.8468 | -354.3502 | 3.5836 | 1.3665 | 0.6702 | 0 | 86895 | 68740 | 10604 | 7551 |
| weekly_hold | 373 | 7833 | -155.1935 | -274.7993 | -0.5648 | 0.8951 | 0.4799 | 0 | - | - | - | - |

## Files

- Manifest: docs/research/gates/gate57/artifacts/gate57b-friday-strength15w-evaluation/manifests/gate57-friday-strength-15w-relative-lifecycle-gate57b-frs15-no-extreme-selected-20260626T202859Z-79D46B5C.manifest.json
- Result: docs/research/gates/gate57/artifacts/gate57b-friday-strength15w-evaluation/results/gate57-friday-strength-15w-relative-lifecycle-gate57b-frs15-no-extreme-selected-20260626T202859Z-79D46B5C.result.json
- Hashes: docs/research/gates/gate57/artifacts/gate57b-friday-strength15w-evaluation/hashes/gate57-friday-strength-15w-relative-lifecycle-gate57b-frs15-no-extreme-selected-20260626T202859Z-79D46B5C.hashes.json
- Registry: docs/research/gates/gate57/artifacts/gate57b-friday-strength15w-evaluation/registry/research-run-registry.jsonl

## Command

`C:\Users\User\AppData\Local\Volta\tools\image\node\24.8.0\node.exe C:\Users\User\Documents\GitHub\limni-website\engine\scripts\verification\evaluate-research-decision-manifest.ts --manifest=engine/reports/gate57b-friday-strength15w/manifests/gate57b-friday-relative-strength-15w-no_extreme_selected.manifest.json --artifact-gate=gate57 --out-dir=docs/research/gates/gate57/artifacts/gate57b-friday-strength15w-evaluation --price-bundle-id=gate55e_fx_m1_oanda_ny5_v1_20181217_20260607_8E37E953 --path-resolution=1m --evaluators=adr_grid,weekly_hold --status=diagnostic --path-outcome-warehouse-id=gate57a0b_pair_week_path_outcomes_47B8F40AFB3B`

## Boundary

This command scores a frozen manifest only. Signal derivation, bucket construction, regime filters, COT retuning, COT+Strength combination, execution optimization, risk overlays, live/MT5, and final system selection remain outside this receipt.

Receipt hash: `D2DF8278D1ABA245C204A5D86854890102C4AA3852322B84A6228691ADE69C37`
