# Gate 56E: gate55g-equivalent-manifest-parity Research Decision Manifest Evaluation

Generated: 2026-06-26T06:43:53.988Z

## Result

- Run ID: `gate57-gate55g-friday-strength-selected-vs-fade-equivalent-manifest-parity-gate55g-friday-strength-fade-20260626T064353Z-BB3142AF`
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
- Git commit: `0cda44b400ce4564052913f273317885b09eab28`
- Rerun reason: -

## Runtime Controls

- Runtime mode: `batch_week_major`
- Wall-clock seconds: `3409.3`
- Manifest count evaluated in process: `2`
- Union week count: `387`
- Row count evaluated in process: `21672`
- Clear runtime cache between weeks: `true`
- Runtime cache entries after run: `0`
- Runtime cache gets/hits/misses: `774/0/774`
- Runtime cache clear-all calls: `387`

Runtime/cache controls are memory and speed controls only. They are not signal logic, strategy logic, or evaluator semantics.

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

- Manifest: docs/research/gates/gate57/artifacts/gate57a0-strength-batch-canary-final/manifests/gate57-gate55g-friday-strength-selected-vs-fade-equivalent-manifest-parity-gate55g-friday-strength-fade-20260626T064353Z-BB3142AF.manifest.json
- Result: docs/research/gates/gate57/artifacts/gate57a0-strength-batch-canary-final/results/gate57-gate55g-friday-strength-selected-vs-fade-equivalent-manifest-parity-gate55g-friday-strength-fade-20260626T064353Z-BB3142AF.result.json
- Hashes: docs/research/gates/gate57/artifacts/gate57a0-strength-batch-canary-final/hashes/gate57-gate55g-friday-strength-selected-vs-fade-equivalent-manifest-parity-gate55g-friday-strength-fade-20260626T064353Z-BB3142AF.hashes.json
- Registry: -

## Command

`C:\Users\User\AppData\Local\Volta\tools\image\node\24.8.0\node.exe C:\Users\User\Documents\GitHub\limni-website\engine\scripts\verification\evaluate-research-decision-manifest.ts --manifest=docs/research/gates/gate56/manifests/gate56e-gate55g-friday-strength-selected-equivalent.manifest.json --manifest=docs/research/gates/gate56/manifests/gate56e-gate55g-friday-strength-fade-equivalent.manifest.json --artifact-gate=gate57 --out-dir=docs/research/gates/gate57/artifacts/gate57a0-strength-batch-canary-final --price-bundle-id=gate55e_fx_m1_oanda_ny5_v1_20181217_20260607_8E37E953 --path-resolution=1m --evaluators=adr_grid,weekly_hold --status=diagnostic --clear-runtime-cache-between-weeks --no-registry-write --no-doc-copy`

## Boundary

This command scores a frozen manifest only. Signal derivation, bucket construction, regime filters, COT retuning, COT+Strength combination, execution optimization, risk overlays, live/MT5, and final system selection remain outside this receipt.

Receipt hash: `85E816915C8E3CF3F5338157F78064C0F0545F8B26E5E681E4485522E53E396D`
