# Gate 57A0B Pair-Week Path Outcome Warehouse Materialization

Generated: 2026-06-26T15:22:41.818Z

## Result

- Manifest ID: `gate57a0b_pair_week_path_outcomes_47B8F40AFB3B`
- Price bundle ID: `gate55e_fx_m1_oanda_ny5_v1_20181217_20260607_8E37E953`
- Asset class: `fx`
- Path resolution: `1m`
- Evaluator version: `research_decision_evaluator_adr_grid_weekly_hold_v1`
- Path contract ID: `research_decision_pair_week_path_outcome_adr_grid_weekly_hold_v1`
- Evaluator params hash: `984D9A590226CF8E2EEE4907D8C7798E1CA996C44BFB3BBE602FACBDC5839C87`
- Config hash: `47B8F40AFB3B94004BC64F57F1F183CBB8AC09224AF119ABAA80D7B12121D38E`
- Warehouse hash: `5600A36ED56C5EACCF9082AC2DCFE505BADE7B95649A0742816434FAEB2DF68C`
- Warehouse manifest hash: `407F7EBABC83422BBBF5C7F6DEA0F6BE88B950ACD1A8371EEAAA4DF64D997B25`
- Git commit: `4f39e5e35d9f4b30e2ae593d665027ffc74e37bd`

## Coverage

- Weeks: `391`
- Symbols: `28`
- Directions: `2`
- Expected rows: `21896`
- Materialized rows: `21896`
- Missing outcome count: `0`
- Duplicate outcome count: `0`
- Row counts by evaluator: `{"adr_grid":21896,"weekly_hold":21896}`
- Row counts by direction: `{"LONG":10948,"SHORT":10948}`

Full row counts by symbol and week are in the warehouse manifest JSON.

## Runtime Controls

- Cold materialization runtime seconds: `3308.4`
- Clear runtime cache between weeks: `true`
- Runtime cache gets/hits/misses: `782/0/782`
- Runtime cache clear-all calls: `391`

Runtime/cache settings are memory and speed controls only. They are not signal logic, strategy logic, or evaluator semantics.

## Files

- Warehouse manifest JSON: docs/research/gates/gate57/artifacts/gate57a0b-pair-week-path-outcomes/gate57a0b_pair_week_path_outcomes_47B8F40AFB3B.warehouse-manifest.json
- Hashes JSON: docs/research/gates/gate57/artifacts/gate57a0b-pair-week-path-outcomes/gate57a0b_pair_week_path_outcomes_47B8F40AFB3B.hashes.json

## Command

`C:\Users\User\AppData\Local\Volta\tools\image\node\24.8.0\node.exe C:\Users\User\Documents\GitHub\limni-website\engine\scripts\verification\materialize-pair-week-path-outcomes.ts --expected-weeks=391 --expected-symbols=28 --expected-rows=21896 --out-dir=docs/research/gates/gate57/artifacts/gate57a0b-pair-week-path-outcomes --overwrite --clear-runtime-cache-between-weeks --log-progress`

## Boundary

This materializes strategy-agnostic pair-week long/short path outcomes only. It does not change COT logic, Strength logic, ADR Grid semantics, Weekly Hold semantics, regimes, risk overlays, or live/MT5 behavior.

Receipt hash: `8572E06B78CF85ABB27608B98CE86C1EB1D6BC5CBFAC25AE58526A2AC69251E2`
