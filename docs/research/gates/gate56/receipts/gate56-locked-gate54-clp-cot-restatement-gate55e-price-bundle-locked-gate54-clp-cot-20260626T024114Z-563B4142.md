# Gate 56F: gate54-cot-restatement-through-engine Research Decision Manifest Evaluation

Generated: 2026-06-26T03:33:51.889Z

## Result

- Run ID: `gate56-locked-gate54-clp-cot-restatement-gate55e-price-bundle-locked-gate54-clp-cot-20260626T024114Z-563B4142`
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
- Git commit: `b2801b356bb7754f3fd9c8f6337148fb4c61dc0e`
- Rerun reason: -

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

- Manifest: docs/research/gates/gate56/artifacts/gate54-cot-restatement-engine/manifests/gate56-locked-gate54-clp-cot-restatement-gate55e-price-bundle-locked-gate54-clp-cot-20260626T024114Z-563B4142.manifest.json
- Result: docs/research/gates/gate56/artifacts/gate54-cot-restatement-engine/results/gate56-locked-gate54-clp-cot-restatement-gate55e-price-bundle-locked-gate54-clp-cot-20260626T024114Z-563B4142.result.json
- Hashes: docs/research/gates/gate56/artifacts/gate54-cot-restatement-engine/hashes/gate56-locked-gate54-clp-cot-restatement-gate55e-price-bundle-locked-gate54-clp-cot-20260626T024114Z-563B4142.hashes.json
- Registry: docs/research/gates/gate56/artifacts/gate54-cot-restatement-engine/registry/research-run-registry.jsonl

## Command

`C:\Users\User\AppData\Local\Volta\tools\image\node\24.8.0\node.exe C:\Users\User\Documents\GitHub\limni-website\engine\scripts\verification\evaluate-research-decision-manifest.ts --manifest=docs/research/gates/gate56/manifests/gate56f-locked-gate54-clp-cot-restatement.manifest.json --artifact-gate=gate56 --out-dir=docs/research/gates/gate56/artifacts/gate54-cot-restatement-engine --docs-receipt-dir=docs/research/gates/gate56/receipts --price-bundle-id=gate55e_fx_m1_oanda_ny5_v1_20181217_20260607_8E37E953 --path-resolution=1m --evaluators=adr_grid,weekly_hold --status=diagnostic --clear-runtime-cache-between-weeks`

## Boundary

This command scores a frozen manifest only. Signal derivation, bucket construction, regime filters, COT retuning, COT+Strength combination, execution optimization, risk overlays, live/MT5, and final system selection remain outside this receipt.

Receipt hash: `F069819D4F294FE48067EE1D2D5596834424A4687182C1FCBE952B66965380E8`
