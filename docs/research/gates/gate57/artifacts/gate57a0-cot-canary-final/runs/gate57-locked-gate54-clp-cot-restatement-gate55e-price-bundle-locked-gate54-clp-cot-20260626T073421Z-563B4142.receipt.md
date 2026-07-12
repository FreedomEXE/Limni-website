# Gate 56F: gate54-cot-restatement-through-engine Research Decision Manifest Evaluation

Generated: 2026-06-26T07:34:21.754Z

## Result

- Run ID: `gate57-locked-gate54-clp-cot-restatement-gate55e-price-bundle-locked-gate54-clp-cot-20260626T073421Z-563B4142`
- Status: `diagnostic`
- Hypothesis: `locked_gate54_clp_cot_restatement_gate55e_price_bundle`
- Signal: `locked_gate54_clp_cot` / `CLP carry-forward + carry-previous tie fill`
- Decision scope: `fx_28pair_weekly_locked_gate54_clp_cot`
- Price bundle ID: `gate55e_fx_m1_oanda_ny5_v1_20181217_20260607_8E37E953`
- Feature bundle ID: `gate54_clp_cot_lifecycle_carry_forward_tie_fill_v1`
- Manifest hash: `563B4142312DD7B84541C3378AF68402E06BC68AEBF00D3F289E936B58005781`
- Evaluator version: `research_decision_evaluator_adr_grid_weekly_hold_v1`
- Evaluators: `adr_grid,weekly_hold`
- Path resolution: `1m`
- Git commit: `0cda44b400ce4564052913f273317885b09eab28`
- Rerun reason: -

## Runtime Controls

- Runtime mode: `single_manifest`
- Wall-clock seconds: `2945.9`
- Manifest count evaluated in process: `1`
- Union week count: `388`
- Row count evaluated in process: `10864`
- Clear runtime cache between weeks: `true`
- Runtime cache entries after run: `0`
- Runtime cache gets/hits/misses: `776/0/776`
- Runtime cache clear-all calls: `388`

Runtime/cache controls are memory and speed controls only. They are not signal logic, strategy logic, or evaluator semantics.

## Coverage

- Weeks: 388
- Universe symbols: 28
- Decision rows: 10864
- Long rows: 5443
- Short rows: 5421

## Metrics

| Evaluator | Weeks | Rows | ADR | DD | R/DD | PF | Win rate | Missing price rows | Fills | TP | Reset | Week close |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| adr_grid | 388 | 10864 | 1493.8161 | -344.9941 | 4.33 | 1.3204 | 0.6753 | 0 | 118785 | 93809 | 14366 | 10610 |
| weekly_hold | 388 | 10864 | 367.5166 | -151.9313 | 2.419 | 1.1929 | 0.5309 | 0 | - | - | - | - |

## Files

- Manifest: docs/research/gates/gate57/artifacts/gate57a0-cot-canary-final/manifests/gate57-locked-gate54-clp-cot-restatement-gate55e-price-bundle-locked-gate54-clp-cot-20260626T073421Z-563B4142.manifest.json
- Result: docs/research/gates/gate57/artifacts/gate57a0-cot-canary-final/results/gate57-locked-gate54-clp-cot-restatement-gate55e-price-bundle-locked-gate54-clp-cot-20260626T073421Z-563B4142.result.json
- Hashes: docs/research/gates/gate57/artifacts/gate57a0-cot-canary-final/hashes/gate57-locked-gate54-clp-cot-restatement-gate55e-price-bundle-locked-gate54-clp-cot-20260626T073421Z-563B4142.hashes.json
- Registry: -

## Command

`C:\Users\User\AppData\Local\Volta\tools\image\node\24.8.0\node.exe C:\Users\User\Documents\GitHub\limni-website\engine\scripts\verification\evaluate-research-decision-manifest.ts --manifest=docs/research/gates/gate56/manifests/gate56f-locked-gate54-clp-cot-restatement.manifest.json --artifact-gate=gate57 --out-dir=docs/research/gates/gate57/artifacts/gate57a0-cot-canary-final --price-bundle-id=gate55e_fx_m1_oanda_ny5_v1_20181217_20260607_8E37E953 --path-resolution=1m --evaluators=adr_grid,weekly_hold --status=diagnostic --clear-runtime-cache-between-weeks --no-registry-write --no-doc-copy`

## Boundary

This command scores a frozen manifest only. Signal derivation, bucket construction, regime filters, COT retuning, COT+Strength combination, execution optimization, risk overlays, live/MT5, and final system selection remain outside this receipt.

Receipt hash: `765082927EB7BB0272055168F506F250672B327DA16D16AEE44BA104EE67B43B`
