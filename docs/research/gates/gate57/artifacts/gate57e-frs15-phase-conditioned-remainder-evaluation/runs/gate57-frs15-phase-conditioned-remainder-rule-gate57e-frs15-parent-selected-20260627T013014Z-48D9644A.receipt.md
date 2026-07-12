# Gate 57E: frs15-phase-conditioned-remainder-rule Research Decision Manifest Evaluation

Generated: 2026-06-27T01:30:15.100Z

## Result

- Run ID: `gate57-frs15-phase-conditioned-remainder-rule-gate57e-frs15-parent-selected-20260627T013014Z-48D9644A`
- Status: `diagnostic`
- Hypothesis: `frs15_phase_conditioned_remainder_rule`
- Signal: `gate57e_frs15_parent_selected` / `friday_relative_strength_15w_v1`
- Decision scope: `fx_28pair_weekly_frs15_phase_conditioned_remainder_parent_selected`
- Price bundle ID: `gate55e_fx_m1_oanda_ny5_v1_20181217_20260607_8E37E953`
- Feature bundle ID: `gate57e_frs15_phase_conditioned_remainder_rule_v1`
- Manifest hash: `48D9644A123489D653435584FB1BA392CF496872146671CF9B3D21894A5A5480`
- Evaluator version: `research_decision_evaluator_adr_grid_weekly_hold_v1`
- Evaluators: `adr_grid,weekly_hold`
- Path resolution: `1m`
- Git commit: `49743886e769f2c7f28eeda864b05d8d33141c5e`
- Rerun reason: -

## Runtime Controls

- Runtime mode: `warehouse_aggregation`
- Wall-clock seconds: `13.8`
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

- Manifest: docs/research/gates/gate57/artifacts/gate57e-frs15-phase-conditioned-remainder-evaluation/manifests/gate57-frs15-phase-conditioned-remainder-rule-gate57e-frs15-parent-selected-20260627T013014Z-48D9644A.manifest.json
- Result: docs/research/gates/gate57/artifacts/gate57e-frs15-phase-conditioned-remainder-evaluation/results/gate57-frs15-phase-conditioned-remainder-rule-gate57e-frs15-parent-selected-20260627T013014Z-48D9644A.result.json
- Hashes: docs/research/gates/gate57/artifacts/gate57e-frs15-phase-conditioned-remainder-evaluation/hashes/gate57-frs15-phase-conditioned-remainder-rule-gate57e-frs15-parent-selected-20260627T013014Z-48D9644A.hashes.json
- Registry: docs/research/gates/gate57/artifacts/gate57e-frs15-phase-conditioned-remainder-evaluation/registry/research-run-registry.jsonl

## Command

`C:\Users\User\AppData\Local\Volta\tools\image\node\24.8.0\node.exe C:\Users\User\Documents\GitHub\limni-website\engine\scripts\verification\evaluate-research-decision-manifest.ts --manifest=engine/reports/gate57e-frs15-phase-conditioned-remainder/manifests/gate57e-frs15-phase-conditioned-remainder-parent_selected.manifest.json --artifact-gate=gate57 --out-dir=docs/research/gates/gate57/artifacts/gate57e-frs15-phase-conditioned-remainder-evaluation --price-bundle-id=gate55e_fx_m1_oanda_ny5_v1_20181217_20260607_8E37E953 --path-resolution=1m --evaluators=adr_grid,weekly_hold --status=diagnostic --path-outcome-warehouse-id=gate57a0b_pair_week_path_outcomes_47B8F40AFB3B`

## Boundary

This command scores a frozen manifest only. Signal derivation, bucket construction, regime filters, COT retuning, COT+Strength combination, execution optimization, risk overlays, live/MT5, and final system selection remain outside this receipt.

Receipt hash: `D1B8768FF4EAE585DCAE4595BEB6F6693E7C0954B4BA3721A947F0884FED57F3`
