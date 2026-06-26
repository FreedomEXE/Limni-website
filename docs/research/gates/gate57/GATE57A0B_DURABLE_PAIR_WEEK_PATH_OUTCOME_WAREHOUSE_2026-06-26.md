# Gate 57A0B Durable Pair-Week Path Outcome Warehouse

Generated: 2026-06-26

## Verdict

PASS_WITH_RUNTIME_COMMIT_CAVEAT.

Gate 57A0B adds a durable, strategy-agnostic pair-week path outcome warehouse
for the Gate 55E canonical FX M1 price bundle. The warehouse materializes one
row per `price_bundle_id + symbol + week_open_utc + direction +
path_resolution + evaluator/path_contract_id + evaluator_params_hash`, then
`ResearchDecisionManifest` evaluation can aggregate those frozen outcomes
without rerunning M1 ADR Grid path simulation.

Runtime commit caveat: cold materialization and warehouse canaries ran from the
Gate 57A0B dirty worktree on top of pushed commit
`4f39e5e35d9f4b30e2ae593d665027ffc74e37bd`. The dirty worktree consisted of the
Gate 57A0B warehouse/evaluator/script/doc changes recorded in this gate. This
receipt therefore treats the materialization as accepted evidence with explicit
dirty-runtime disclosure, not as a clean-runtime promotion artifact.

Gate 57A0 was pushed before this gate began. Pushed Gate 57A0 head:
`4f39e5e35d9f4b30e2ae593d665027ffc74e37bd`.

This gate did not change COT logic, Strength logic, ADR Grid semantics, Weekly
Hold semantics, regime filters, COT+Strength logic, risk overlays, or live/MT5
behavior.

## Warehouse Contract

Warehouse table:

```text
research_pair_week_path_outcomes
```

Warehouse manifest table:

```text
research_pair_week_path_outcome_manifests
```

Required key fields are present:

```text
price_bundle_id
symbol
week_open_utc
direction
path_resolution
evaluator_version
path_contract_id
evaluator_params_hash
```

Strategy labels such as COT and Strength are not part of the warehouse row key.
They remain manifest-level concerns only.

## Materialized Warehouse

- Warehouse manifest ID:
  `gate57a0b_pair_week_path_outcomes_47B8F40AFB3B`
- Price bundle:
  `gate55e_fx_m1_oanda_ny5_v1_20181217_20260607_8E37E953`
- Asset class: `fx`
- Path resolution: `1m`
- Evaluator version:
  `research_decision_evaluator_adr_grid_weekly_hold_v1`
- Path contract ID:
  `research_decision_pair_week_path_outcome_adr_grid_weekly_hold_v1`
- Evaluator params hash:
  `984D9A590226CF8E2EEE4907D8C7798E1CA996C44BFB3BBE602FACBDC5839C87`
- Config hash:
  `47B8F40AFB3B94004BC64F57F1F183CBB8AC09224AF119ABAA80D7B12121D38E`
- Warehouse hash:
  `5600A36ED56C5EACCF9082AC2DCFE505BADE7B95649A0742816434FAEB2DF68C`
- Warehouse manifest hash:
  `407F7EBABC83422BBBF5C7F6DEA0F6BE88B950ACD1A8371EEAAA4DF64D997B25`

Coverage:

| Check | Value |
|---|---:|
| Gate 55E weeks | `391` |
| FX symbols | `28` |
| Directions | `2` |
| Expected rows | `21,896` |
| Materialized rows | `21,896` |
| ADR Grid rows | `21,896` |
| Weekly Hold rows | `21,896` |
| LONG rows | `10,948` |
| SHORT rows | `10,948` |
| Missing outcomes | `0` |
| Duplicate outcomes | `0` |

Materialization command:

```powershell
npm run engine:path-outcomes:materialize -- --expected-weeks=391 --expected-symbols=28 --expected-rows=21896 --out-dir=docs/research/gates/gate57/artifacts/gate57a0b-pair-week-path-outcomes --overwrite --clear-runtime-cache-between-weeks --log-progress
```

Cold materialization runtime:

```text
3308.4 seconds
```

Runtime/cache controls:

```text
clear_runtime_cache_between_weeks = true
cache gets/hits/misses = 782/0/782
cache clear-all calls = 391
```

These are memory/speed controls only. They are not strategy, signal, or
evaluator variants.

Artifacts:

- Warehouse manifest JSON:
  `docs/research/gates/gate57/artifacts/gate57a0b-pair-week-path-outcomes/gate57a0b_pair_week_path_outcomes_47B8F40AFB3B.warehouse-manifest.json`
- Warehouse hashes JSON:
  `docs/research/gates/gate57/artifacts/gate57a0b-pair-week-path-outcomes/gate57a0b_pair_week_path_outcomes_47B8F40AFB3B.hashes.json`
- Warehouse receipt:
  `docs/research/gates/gate57/artifacts/gate57a0b-pair-week-path-outcomes/gate57a0b_pair_week_path_outcomes_47B8F40AFB3B.receipt.md`
- Warehouse receipt hash:
  `8572E06B78CF85ABB27608B98CE86C1EB1D6BC5CBFAC25AE58526A2AC69251E2`

## Fail-Closed Evaluation Path

Warehouse aggregation is explicit:

```powershell
npm run engine:research-manifest:evaluate -- --manifest=<manifest.json> --path-outcome-warehouse-id=gate57a0b_pair_week_path_outcomes_47B8F40AFB3B
```

When this flag is present, evaluation uses `warehouse_aggregation` mode. It
validates:

- warehouse manifest exists,
- warehouse status is `complete`,
- current warehouse row hash matches the recorded warehouse hash,
- requested manifest rows have matching materialized outcomes,
- `price_bundle_id`, path resolution, evaluator version, path contract ID, and
  evaluator params hash match.

If any check fails, the evaluator throws. It does not silently fall back to M1
path simulation.

Duplicate proof:

```text
Equivalent research run already exists: gate57-locked-gate54-clp-cot-restatement-gate55e-price-bundle-locked-gate54-clp-cot-20260626T152323Z-563B4142
Equivalence key: 98B0C2AA4E5BD6E73AE6E35A3DFCB78B64CF562061E96C8C6208B8237FFF5270
```

## Gate 56F COT Canary

Command:

```powershell
npm run engine:research-manifest:evaluate -- --manifest=docs/research/gates/gate56/manifests/gate56f-locked-gate54-clp-cot-restatement.manifest.json --artifact-gate=gate57 --out-dir=docs/research/gates/gate57/artifacts/gate57a0b-cot-warehouse-canary --price-bundle-id=gate55e_fx_m1_oanda_ny5_v1_20181217_20260607_8E37E953 --path-resolution=1m --evaluators=adr_grid,weekly_hold --status=diagnostic --path-outcome-warehouse-id=gate57a0b_pair_week_path_outcomes_47B8F40AFB3B
```

Runtime mode:

```text
warehouse_aggregation
```

Warm aggregation runtime:

```text
10.4 seconds
```

Runtime cache gets/hits/misses:

```text
0/0/0
```

Parity:

| Metric | Accepted Gate 56F | Gate 57A0B warehouse | Delta |
|---|---:|---:|---:|
| ADR Grid ADR | `1493.8161` | `1493.8161` | `0.0000` |
| ADR Grid DD | `-344.9941` | `-344.9941` | `0.0000` |
| ADR Grid R/DD | `4.3300` | `4.3300` | `0.0000` |
| ADR Grid PF | `1.3204` | `1.3204` | `0.0000` |
| ADR Grid fills | `118785` | `118785` | `0` |
| ADR Grid missing price rows | `0` | `0` | `0` |
| Weekly Hold ADR | `367.5166` | `367.5166` | `0.0000` |
| Weekly Hold DD | `-151.9313` | `-151.9313` | `0.0000` |
| Weekly Hold R/DD | `2.4190` | `2.4190` | `0.0000` |
| Weekly Hold PF | `1.1929` | `1.1929` | `0.0000` |

Artifacts:

- Result JSON:
  `docs/research/gates/gate57/artifacts/gate57a0b-cot-warehouse-canary/results/gate57-locked-gate54-clp-cot-restatement-gate55e-price-bundle-locked-gate54-clp-cot-20260626T152323Z-563B4142.result.json`
- Result hash:
  `C388F38EEDF5111EF33707DB7CE9E67A138ECCFC1B3CDCD288BA4955881F3C6A`
- Result file SHA-256:
  `25581C6853365342D1375AF42531E5BFD9DFF29D9B85E00E27EA25D68902B740`
- Receipt hash:
  `62E7CEF7CB1DF8CBC861BCC297B58C0AD64A75A370C447AA960525FC65142469`
- Registry:
  `docs/research/gates/gate57/artifacts/gate57a0b-cot-warehouse-canary/registry/research-run-registry.jsonl`

## Gate 56E Strength Canary

Command:

```powershell
npm run engine:research-manifest:evaluate -- --manifest=docs/research/gates/gate56/manifests/gate56e-gate55g-friday-strength-selected-equivalent.manifest.json --manifest=docs/research/gates/gate56/manifests/gate56e-gate55g-friday-strength-fade-equivalent.manifest.json --artifact-gate=gate57 --out-dir=docs/research/gates/gate57/artifacts/gate57a0b-strength-warehouse-canary --price-bundle-id=gate55e_fx_m1_oanda_ny5_v1_20181217_20260607_8E37E953 --path-resolution=1m --evaluators=adr_grid,weekly_hold --status=diagnostic --path-outcome-warehouse-id=gate57a0b_pair_week_path_outcomes_47B8F40AFB3B
```

Runtime mode:

```text
warehouse_aggregation
```

Warm aggregation runtimes:

```text
selected = 11.9 seconds
fade = 8.9 seconds
```

Runtime cache gets/hits/misses:

```text
0/0/0
```

Selected parity:

| Metric | Accepted Gate 56E | Gate 57A0B warehouse | Delta |
|---|---:|---:|---:|
| ADR Grid ADR | `1311.8526` | `1311.8526` | `0.0000` |
| ADR Grid DD | `-698.5889` | `-698.5889` | `0.0000` |
| ADR Grid PF | `1.2674` | `1.2674` | `0.0000` |
| ADR Grid fills | `119147` | `119147` | `0` |
| Weekly Hold ADR | `-315.1911` | `-315.1911` | `0.0000` |

Fade parity:

| Metric | Accepted Gate 56E | Gate 57A0B warehouse | Delta |
|---|---:|---:|---:|
| ADR Grid ADR | `988.7181` | `988.7181` | `0.0000` |
| ADR Grid DD | `-653.5674` | `-653.5674` | `0.0000` |
| ADR Grid PF | `1.1794` | `1.1794` | `0.0000` |
| ADR Grid fills | `118460` | `118460` | `0` |
| Weekly Hold ADR | `315.1911` | `315.1911` | `0.0000` |

Artifacts:

- Selected result JSON:
  `docs/research/gates/gate57/artifacts/gate57a0b-strength-warehouse-canary/results/gate57-gate55g-friday-strength-selected-vs-fade-equivalent-manifest-parity-gate55g-friday-strength-selected-20260626T152354Z-33DB0459.result.json`
- Selected result hash:
  `B780A70DC4ECB7AAE090E6D168031D55399ED92D3025554EED26BDF9F0C752D9`
- Selected result file SHA-256:
  `76A80FCAD3D7E4435B3B34903B74A8ADF38E8E7F0DE8583CF18D40E276205ED7`
- Selected receipt hash:
  `4AC68B1231A15A6179420EC287BA7EC0C42712891A479EC073256306833D82E1`
- Fade result JSON:
  `docs/research/gates/gate57/artifacts/gate57a0b-strength-warehouse-canary/results/gate57-gate55g-friday-strength-selected-vs-fade-equivalent-manifest-parity-gate55g-friday-strength-fade-20260626T152354Z-BB3142AF.result.json`
- Fade result hash:
  `CC0581265D4CCC2C36869FA5BAB1F9089318D841299EBD7F36167891EE385DE8`
- Fade result file SHA-256:
  `FAB30422A810B8413FBCD847C060FFAD696B80459DA9D55BF973E9E8203607A1`
- Fade receipt hash:
  `C72D4EFB797B8867288B137439C9D135AD8A7AB65015CAC9CBC751598E2058FA`
- Registry:
  `docs/research/gates/gate57/artifacts/gate57a0b-strength-warehouse-canary/registry/research-run-registry.jsonl`

## Artifact Policy

Tracked evidence should include this receipt, warehouse materialization receipt,
warehouse manifest/hash JSON, canary result JSONs, canary hash JSONs, canary
receipts, and canary registries. Full normalized copied manifest JSONs are
ignored/reproducible and are not required because their source manifests are
already tracked under Gate 56.

## Validation

Passed before long runs:

```powershell
npx tsc --noEmit --pretty false
npm run engine:path-outcomes:materialize -- --help
npm run engine:research-manifest:evaluate -- --help
npm run engine:path-outcomes:materialize -- --max-weeks=1 --expected-weeks=1 --expected-symbols=28 --expected-rows=56 --manifest-id=gate57a0b_smoke_pair_week_path_outcomes --out-dir=engine/reports/gate57a0b-smoke --overwrite --clear-runtime-cache-between-weeks
```

Passed after long runs and receipt/protocol updates:

```powershell
npx tsc --noEmit --pretty false
npx tsc --noEmit --project app/tsconfig.json --pretty false
npm run engine:path-outcomes:materialize -- --help
npm run engine:research-manifest:evaluate -- --help
git diff --check
git status -sb --untracked-files=all
```

Commit identity:

```text
Reported after commit in the Gate 57A0B final handoff. The final commit hash is
not embedded in this self-hashed receipt because embedding it would change the
commit identity.
```

Dirty-tree status at evidence-recording time:

```text
Dirty only with Gate 57A0B code, docs, and generated evidence artifacts.
```

Dirty-tree status after commit:

```text
Reported after commit in the Gate 57A0B final handoff.
```

## Boundary

Still blocked until explicitly opened:

- Gate 57A Strength context/bucket preflight.
- Strength bucket evaluation.
- Regime filters.
- COT+Strength combined manifests.
- COT source/tie-policy changes.
- Strength logic changes.
- ADR Grid or Weekly Hold semantic changes.
- Risk overlays.
- MT5/live/bot work.
- App refactor work.
- Final combined system selection.

Receipt hash: `22316511E05229AB753D8048C96EB775CE4BBAE7DCB86358153DBE0640BA4907`
