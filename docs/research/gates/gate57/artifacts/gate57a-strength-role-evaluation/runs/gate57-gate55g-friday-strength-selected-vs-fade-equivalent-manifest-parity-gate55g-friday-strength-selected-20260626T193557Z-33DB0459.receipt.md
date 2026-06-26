# Gate 56E: gate55g-equivalent-manifest-parity Research Decision Manifest Evaluation

Generated: 2026-06-26T19:35:57.835Z

## Result

- Run ID: `gate57-gate55g-friday-strength-selected-vs-fade-equivalent-manifest-parity-gate55g-friday-strength-selected-20260626T193557Z-33DB0459`
- Status: `diagnostic`
- Hypothesis: `gate55g_friday_strength_selected_vs_fade_equivalent_manifest_parity`
- Signal: `gate55g_friday_strength_selected` / `fx_m1_currency_strength_v1_gate55g_friday_close_v1`
- Decision scope: `fx_28pair_weekly_friday_strength_selected`
- Price bundle ID: `gate55e_fx_m1_oanda_ny5_v1_20181217_20260607_8E37E953`
- Feature bundle ID: `gate55f_fx_m1_currency_strength_v1_friday_close_context`
- Manifest hash: `33DB04595F371AF4943E2E83E0E40EBEF8C51F7AE89CF96ACF17FF0B71E53ADE`
- Evaluator version: `research_decision_evaluator_adr_grid_weekly_hold_v1`
- Evaluators: `adr_grid,weekly_hold`
- Path resolution: `1m`
- Git commit: `884c91bf92d7c287ee3483398b13e8ba9ffbefe9`
- Rerun reason: -

## Runtime Controls

- Runtime mode: `warehouse_aggregation`
- Wall-clock seconds: `5.6`
- Manifest count evaluated in process: `1`
- Union week count: `387`
- Row count evaluated in process: `10836`
- Clear runtime cache between weeks: `false`
- Runtime cache entries after run: `0`
- Runtime cache gets/hits/misses: `0/0/0`
- Runtime cache clear-all calls: `0`
- Path outcome warehouse ID: `gate57a0b_pair_week_path_outcomes_47B8F40AFB3B`

Runtime/cache controls are memory and speed controls only. They are not signal logic, strategy logic, or evaluator semantics.

## Coverage

- Weeks: 387
- Universe symbols: 28
- Decision rows: 10836
- Long rows: 5612
- Short rows: 5224

## Metrics

| Evaluator | Weeks | Rows | ADR | DD | R/DD | PF | Win rate | Missing price rows | Fills | TP | Reset | Week close |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| adr_grid | 387 | 10836 | 1311.8526 | -698.5889 | 1.8779 | 1.2674 | 0.6512 | 0 | 119147 | 93777 | 14487 | 10883 |
| weekly_hold | 387 | 10836 | -315.1911 | -377.0083 | -0.836 | 0.8666 | 0.4755 | 0 | - | - | - | - |

## Files

- Manifest: docs/research/gates/gate57/artifacts/gate57a-strength-role-evaluation/manifests/gate57-gate55g-friday-strength-selected-vs-fade-equivalent-manifest-parity-gate55g-friday-strength-selected-20260626T193557Z-33DB0459.manifest.json
- Result: docs/research/gates/gate57/artifacts/gate57a-strength-role-evaluation/results/gate57-gate55g-friday-strength-selected-vs-fade-equivalent-manifest-parity-gate55g-friday-strength-selected-20260626T193557Z-33DB0459.result.json
- Hashes: docs/research/gates/gate57/artifacts/gate57a-strength-role-evaluation/hashes/gate57-gate55g-friday-strength-selected-vs-fade-equivalent-manifest-parity-gate55g-friday-strength-selected-20260626T193557Z-33DB0459.hashes.json
- Registry: docs/research/gates/gate57/artifacts/gate57a-strength-role-evaluation/registry/research-run-registry.jsonl

## Command

`C:\Users\User\AppData\Local\Volta\tools\image\node\24.8.0\node.exe C:\Users\User\Documents\GitHub\limni-website\engine\scripts\verification\evaluate-research-decision-manifest.ts --manifest=docs/research/gates/gate56/manifests/gate56e-gate55g-friday-strength-selected-equivalent.manifest.json --artifact-gate=gate57 --out-dir=docs/research/gates/gate57/artifacts/gate57a-strength-role-evaluation --price-bundle-id=gate55e_fx_m1_oanda_ny5_v1_20181217_20260607_8E37E953 --path-resolution=1m --evaluators=adr_grid,weekly_hold --status=diagnostic --path-outcome-warehouse-id=gate57a0b_pair_week_path_outcomes_47B8F40AFB3B`

## Boundary

This command scores a frozen manifest only. Signal derivation, bucket construction, regime filters, COT retuning, COT+Strength combination, execution optimization, risk overlays, live/MT5, and final system selection remain outside this receipt.

Receipt hash: `5B2B5ABB456AB1DDF06633742BE92EC1F41C8F8EDCCC4FA031A7E4620F8C8FAA`
