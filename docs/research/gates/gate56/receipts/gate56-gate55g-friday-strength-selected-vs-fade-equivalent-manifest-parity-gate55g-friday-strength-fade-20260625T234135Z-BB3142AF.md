# Gate 56E: gate55g-equivalent-manifest-parity Research Decision Manifest Evaluation

Generated: 2026-06-26T00:32:11.050Z

## Result

- Run ID: `gate56-gate55g-friday-strength-selected-vs-fade-equivalent-manifest-parity-gate55g-friday-strength-fade-20260625T234135Z-BB3142AF`
- Status: `diagnostic`
- Hypothesis: `gate55g_friday_strength_selected_vs_fade_equivalent_manifest_parity`
- Signal: `gate55g_friday_strength_fade` / `fx_m1_currency_strength_v1_gate55g_friday_close_v1`
- Decision scope: `fx_28pair_weekly_friday_strength_fade`
- Price bundle ID: `gate55e_fx_m1_oanda_ny5_v1_20181217_20260607_8E37E953`
- Feature bundle ID: `gate55f_fx_m1_currency_strength_v1_friday_close_context`
- Manifest hash: `BB3142AF507A5CEBE6467E8055467C1B2003126BACA896F3827206DB0755ED28`
- Evaluator version: `research_decision_evaluator_adr_grid_weekly_hold_v1`
- Evaluators: `adr_grid,weekly_hold`
- Path resolution: `1m`
- Git commit: `f9b57fcd7be88d3bf887207e4d6ed01447612407`
- Rerun reason: -

## Coverage

- Weeks: 387
- Universe symbols: 28
- Decision rows: 10836
- Long rows: 5224
- Short rows: 5612

## Metrics

| Evaluator | Weeks | Rows | ADR | DD | R/DD | PF | Win rate | Missing price rows | Fills | TP | Reset | Week close |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| adr_grid | 387 | 10836 | 988.7181 | -653.5674 | 1.5128 | 1.1794 | 0.6848 | 0 | 118460 | 93523 | 14643 | 10294 |
| weekly_hold | 387 | 10836 | 315.1911 | -230.8041 | 1.3656 | 1.154 | 0.5245 | 0 | - | - | - | - |

## Files

- Manifest: docs/research/gates/gate56/artifacts/gate55g-equivalent-manifest-parity/manifests/gate56-gate55g-friday-strength-selected-vs-fade-equivalent-manifest-parity-gate55g-friday-strength-fade-20260625T234135Z-BB3142AF.manifest.json
- Result: docs/research/gates/gate56/artifacts/gate55g-equivalent-manifest-parity/results/gate56-gate55g-friday-strength-selected-vs-fade-equivalent-manifest-parity-gate55g-friday-strength-fade-20260625T234135Z-BB3142AF.result.json
- Hashes: docs/research/gates/gate56/artifacts/gate55g-equivalent-manifest-parity/hashes/gate56-gate55g-friday-strength-selected-vs-fade-equivalent-manifest-parity-gate55g-friday-strength-fade-20260625T234135Z-BB3142AF.hashes.json
- Registry: docs/research/gates/gate56/artifacts/gate55g-equivalent-manifest-parity/registry/research-run-registry.jsonl

## Command

`C:\Users\User\AppData\Local\Volta\tools\image\node\24.8.0\node.exe C:\Users\User\Documents\GitHub\limni-website\engine\scripts\verification\evaluate-research-decision-manifest.ts --manifest=docs/research/gates/gate56/manifests/gate56e-gate55g-friday-strength-fade-equivalent.manifest.json --artifact-gate=gate56 --out-dir=docs/research/gates/gate56/artifacts/gate55g-equivalent-manifest-parity --docs-receipt-dir=docs/research/gates/gate56/receipts --price-bundle-id=gate55e_fx_m1_oanda_ny5_v1_20181217_20260607_8E37E953 --path-resolution=1m --evaluators=adr_grid,weekly_hold --status=diagnostic --log-progress --clear-runtime-cache-between-weeks`

## Boundary

This command scores a frozen manifest only. Signal derivation, bucket construction, regime filters, COT retuning, COT+Strength combination, execution optimization, risk overlays, live/MT5, and final system selection remain outside this receipt.

Receipt hash: `1278E7874F78461D7602D5B9125A3E6DA0E75161D2266F24E555F0CE2D554B4D`
