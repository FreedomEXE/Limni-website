# Current Work

Status: active checklist. Keep this short and update it when gates change.

Persistent memory stays in
`C:/Users/User/Documents/GitHub/freedom-ops/.codex/`; this file tracks the
current Limni work plan so Freedom does not have to reconstruct it from chat.

## Active Gate

Gate 60D: bpr-source-eligibility.

Objective: resolve BPR source eligibility before any Regime transform, broad
matrix, Regime LONG/SHORT side, Alpha v2, risk, execution, MT5/live, app work,
or source mutation.

Status: complete, committed, and pushed for review on
`codex/gate50-macro-source-promotion-proof`. Gate 60D proof commit:
`7a57e3b` (`Gate 60D BPR source eligibility proof`). This ledger update records
the current Gate 60D review state after external verification.

Verdict:
`FAIL_CLOSED_BPR_SOURCE_ELIGIBILITY_UNRESOLVED_ROWS_REMAIN__NO_REGIME_SIDE`.

Gate 60D command:
`npm run engine:gate60d:bpr-source-eligibility`.

Durable artifacts:

- Report:
  `docs/research/gates/gate60d/GATE60D_BPR_SOURCE_ELIGIBILITY_2026-06-27.md`
- BPR source registry v2:
  `docs/research/gates/gate60d/artifacts/gate60d-bpr-source-eligibility/gate60d-bpr-source-registry-v2.contract.json`
- BPR publication timing proof JSONL:
  `docs/research/gates/gate60d/artifacts/gate60d-bpr-source-eligibility/gate60d-bpr-publication-timing-proof.rows.jsonl`
- BPR currency-week atom ledger JSONL:
  `docs/research/gates/gate60d/artifacts/gate60d-bpr-source-eligibility/gate60d-bpr-currency-week-atom-ledger.rows.jsonl`
- BPR unresolved rows JSONL:
  `docs/research/gates/gate60d/artifacts/gate60d-bpr-source-eligibility/gate60d-bpr-unresolved-rows.rows.jsonl`
- BPR raw artifact, raw observation, and availability-event hash maps:
  `docs/research/gates/gate60d/artifacts/gate60d-bpr-source-eligibility/gate60d-bpr-raw-artifact-hash-map.json`
  `docs/research/gates/gate60d/artifacts/gate60d-bpr-source-eligibility/gate60d-bpr-raw-observation-hash-map.json`
  `docs/research/gates/gate60d/artifacts/gate60d-bpr-source-eligibility/gate60d-bpr-availability-event-hash-map.json`
- Summary JSON and Markdown:
  `docs/research/gates/gate60d/artifacts/gate60d-bpr-source-eligibility/gate60d-bpr-source-eligibility.summary.json`
  and
  `docs/research/gates/gate60d/artifacts/gate60d-bpr-source-eligibility/gate60d-bpr-source-eligibility.summary.md`
- Query/probe receipt:
  `docs/research/gates/gate60d/artifacts/gate60d-bpr-source-eligibility/gate60d-bpr-source-eligibility.query-receipt.md`
- SHA identity:
  `docs/research/gates/gate60d/artifacts/gate60d-bpr-source-eligibility/gate60d-bpr-source-eligibility.sha256.txt`

Validation: `npm run engine:gate60d:bpr-source-eligibility` passed; targeted
ESLint on the Gate 60D verifier passed; `git diff --check` and
`git diff --cached --check` passed before the proof commit.

Denominator result: Gate 59 Alpha v1 remained `10,444` rows, `373` weeks, and
`28` symbols/week with `0` duplicate input row keys, `0` duplicate input
week-symbol rows, `5,968` BPR currency-week atom rows, `1,472` BPR publication
timing proof rows, and `0` duplicate BPR proof row keys.

Source result: BPR remains unusable for Regime construction. Gate 60D emitted
`5,968` BPR atom rows, of which `1,999` filled and `3,969` failed closed. The
unresolved-row ledger contains `4,001` rows: `3,941` are dominated by missing
numeric `netShareOfGross` values, and `32` are late-2025 publication timing /
promotion-blocked rows across `2025-10-07` and `2025-11-04` for both BPR
contracts.

Key hashes:

- BPR source registry hash:
  `9226D3707F3EE4AA4B64587FCE3A68CD8A659F912C0C4C1116E59FA27D7F62AF`
- BPR source content invariant hash:
  `20F5A88FCA8B5901FC879C076E3DF21872E9126D87C1BD5419709A5203DE5894`
- BPR currency-week atom ledger hash:
  `7B1B809CCA1CBB6B60A1E1AFECB44A4F1B4E308244DB4F37611CFD46CD55DCC7`
- BPR unresolved rows hash:
  `3EB3D6C671CE93263AA3E28A860DF3185970CF15877C045F3815DB60E28BF354`

## Next Requested Review

Stop after Gate 60D. Do not proceed to Regime atom transforms, broad matrix,
Regime LONG/SHORT side, support/oppose/fade labels, P&L, attribution, Alpha v2,
risk overlays, execution work, MT5/live, app work, COT changes, Strength
changes, Alpha v1 changes, Gate 59 row changes, macro source row changes, or
source promotion.

Next gate: Gate 60E, BPR value extraction / source-contract rescue. It remains
BPR-only. The objective is to explain and, only if the source contract permits,
repair missing `netShareOfGross` values before any Regime progress. Keep the
late-2025 timing ambiguity separate from the value-missing issue. Emit a new
fail-closed receipt and stop.

## Current Ownership Model

- `app/` keeps only app runtime, public assets, release evidence, and app config.
- `engine/` owns reusable local institutional research/backtest source code,
  commands, cached data, and generated engine reports.
- `database/` owns neutral DB access used by app server code and engine code.
- `automation/` owns MT5 assets, bots, sentiment scraper, voice helpers, and
  Playwright automation.
- `archive/` owns stale historical reports, research workspaces, and one-off
  scripts mirrored by original path.

## Gate 56 Checklist

- Move tracked `app/reports`, `app/research`, `app/scripts`, `app/services`, and
  `app/tests` out of active `app/`.
- Flatten the old nested reports archive content into
  `archive/app/reports/legacy`.
- Keep only forward reusable research command surface under `engine/`.
- Keep MT5/bots/scraper/voice/test automation under `automation/`.
- Patch package scripts, workflows, ignores, docs, and local path defaults to the
  new layout.
- Verify no tracked active app files remain under `app/reports`, `app/research`,
  `app/scripts`, `app/services`, or `app/tests`.
- Do not run new Strength bucket tests, regime filters, COT+Strength tests,
  execution optimization, or research-engine rebuilds in this cleanup gate.

## Gate 56B Checklist

- Inventory every tracked file under `app/src/lib`.
- Move engine-owned manifest/evaluator/hash/registry code to
  `engine/src/research`.
- Move local M1 warehouse ownership to `engine/src/price`.
- Move research matrix and macro warehouse helpers to `engine/src/warehouse`.
- Archive obvious unreferenced stale app-lib leftovers under root `archive/`.
- Keep deprecated but referenced app research UI/API support under
  `app/src/lib/research` until a later app refactor gate.
- Document boundary debt instead of extracting shared DB/path primitives in this
  gate.

## Gate 56C Checklist

- Move the real DB client from `app/src/lib/db.ts` to
  `database/db/client.ts`.
- Move the root env loader from `app/src/lib/server/rootEnv.ts` to
  `database/db/rootEnv.ts`.
- Leave app compatibility re-exports at the old app paths.
- Patch engine DB imports to `@database/db/client`.
- Remove the engine local M1 adapter dependency on app repo-path helpers.
- Mark app `backtestEngine.ts` as deprecated mock visualization debt.
- Do not run new research tests or strategy variants.

## Gate 56D Checklist

- Move runtime cache ownership to `engine/src/cache/runtimeCache.ts`.
- Move COT market constants and week-anchor helpers to `engine/src/contracts`.
- Move canonical price bars/windows, ADR lookup, path resolution, and path bar
  loading to `engine/src/price`.
- Move execution weekly window helpers to `engine/src/evaluation`.
- Leave compatibility re-exports at the old `app/src/lib/*` paths.
- Prove `engine/src` and `engine/scripts` contain no `@/lib/` imports.
- Do not run Gate 55G parity, new research variants, Strength buckets, or regime
  filters in this cleanup gate.

## Gate 56E Checklist

- [x] Move only the historical Strength source/manifest slice needed for parity into
  `engine/src/signals/strength`.
- [x] Generate frozen Gate 55G selected and fade `ResearchDecisionManifest` files.
- [x] Score both manifests through `npm run engine:research-manifest:evaluate`.
- [x] Compare selected/fade ADR Grid and weekly-hold metrics against the accepted
  Gate 55G receipt.
- [x] Mark evaluator parity pass/fail in a Gate 56E receipt.
- Do not run Strength buckets, regime filters, COT restatement, COT + Strength,
  execution optimization, risk overlays, MT5/live, or final system selection.

## Gate 56F Checklist

- [x] Locate locked Gate 54 CLP carry-forward + carry-previous tie-fill source truth.
- [x] Add engine-owned COT manifest builder only; no scorer/evaluator fork.
- [x] Emit frozen Gate 54 CLP COT `ResearchDecisionManifest`.
- [x] Validate manifest shape before evaluator scoring.
- [x] Score through `npm run engine:research-manifest:evaluate`.
- [x] Rerun the exact evaluator command once to prove duplicate detection.
- [x] Record old Gate 54 metrics, new engine-restated metrics, hashes, runtime,
  commits, and runtime caveat.
- Do not run Strength buckets, regime filters, COT + Strength, execution
  optimization, risk overlays, MT5/live, or final system selection.

## Gate 57A0 Checklist

- [x] Add runtime/cache telemetry to the shared engine runtime cache.
- [x] Add repeated-`--manifest` batch support to the shared evaluator command.
- [x] Use week-major batch evaluation for multiple manifests sharing the same
  price bundle.
- [x] Scope shared price/path cache keys by `price_bundle_id`.
- [x] Record cache/runtime settings as runtime controls only.
- [x] Preserve duplicate detection before scoring.
- [x] Prove Gate 56E selected/fade metrics remain identical in final-code batch
  canary.
- [x] Prove Gate 56F COT restatement metrics remain identical in final-code
  canary.
- [x] Run final diff/type/status verification.
- Do not start Gate 57A Strength context/bucket preflight until explicitly
  approved.

## Gate 57A0B Checklist

- [x] Add durable `research_pair_week_path_outcome_manifests` and
  `research_pair_week_path_outcomes` storage.
- [x] Materialize Gate 55E long/short FX pair-week outcomes once for `391`
  weeks, `28` symbols, and `21,896` expected rows.
- [x] Keep warehouse rows strategy-agnostic; COT/Strength labels remain
  manifest-level only.
- [x] Add explicit `--path-outcome-warehouse-id=<id>` aggregation mode.
- [x] Fail closed on missing/hash-invalid warehouse rows instead of silently
  rerunning M1 path simulation.
- [x] Prove Gate 56F COT warehouse canary exactly matches the accepted
  restatement metrics.
- [x] Prove Gate 56E Strength selected/fade warehouse canary exactly matches
  accepted parity metrics.
- [x] Record cold materialization and warm aggregation runtimes.
- [x] Record warehouse manifest/hash, canary result/hash JSONs, receipts, and
  registry rows.
- [x] Prove duplicate detection returns the existing equivalent warehouse run.
- [x] Commit final Gate 57A0B evidence state.
- Gate 57A Strength context/bucket preflight is now explicitly opened as the
  next gate.

## Gate 57A Checklist

- [x] Define fixed Strength selected/fade, strongest quartile, weakest quartile,
  and rolling 52-week historical-context candidate contracts.
- [x] Prove candidate decision timestamps and resolved Strength timestamps do
  not occur after the target trade week opens.
- [x] Report row counts, week coverage, duplicate counts, and manifest
  IDs/hashes.
- [x] Check exact `week_open_utc + symbol + side` coverage against the Gate 57A0B
  warehouse.
- [x] Bind candidates to Gate 55E, Gate 55F, Gate 55G, Gate 56E, and Gate 57A0B
  evidence.
- [x] Run only the approved warehouse-only evaluation for the five preflighted
  candidates.
- [x] Add same-window selected/fade controls for rolling 52-week interpretation.
- [x] Record ADR Grid and Weekly Hold metrics, runtime cache `0/0/0`, result
  hashes, receipt hashes, and duplicate detection keys.
- [x] Stop before more windows, buckets, regimes, COT+Strength, risk overlays,
  MT5/live, or app work.
- Do not run raw M1 ADR Grid simulation, regimes, COT+Strength, risk overlays,
  MT5/live, app work, or evaluator changes.

## Gate 57B Checklist

- [x] Implement a Friday-only 15-week relative Strength manifest builder.
- [x] Use Gate 55E canonical FX M1 prices only.
- [x] Use latest 1m bar close at or before Friday freeze; no open confirmation.
- [x] Isolate each major currency across its seven related FX crosses.
- [x] Normalize the eight weekly currency scores to 0-100.
- [x] Emit parent selected/fade plus compressed, middle, extreme, no-extreme,
  persistent, and flip manifests.
- [x] Prove coverage, duplicate counts, row counts, manifest hashes, and build
  receipt hash.
- [x] Evaluate all eight manifests through Gate 57A0B warehouse aggregation
  only.
- [x] Record ADR Grid and Weekly Hold metrics, runtime cache `0/0/0`, result
  hashes, receipt hashes, and duplicate detection proof.
- [x] Stop before more windows, buckets, regimes, COT+Strength, risk overlays,
  MT5/live, app work, or evaluator changes.

## Frozen Areas

- `app/releases/v2/canon/*.json`
- research result retuning or new backtests
- COT signal logic
- Strength bucket or regime-filter testing
- execution/risk/live/MT5 promotion claims
- release canon regeneration

## Active Gate Doc

`docs/research/gates/gate58/GATE58_COT_STRENGTH_FORENSIC_MATRIX_2026-06-27.md`

`docs/research/gates/gate58b/GATE58B_COT_STRENGTH_DIRECTIONAL_HYPOTHESIS_CONFIRMATION_2026-06-27.md`

`docs/research/gates/gate58c/GATE58C_FORCED28_COT_STRENGTH_DIRECTIONAL_ARBITRATION_LOCK_TEST_2026-06-27.md`

`docs/research/gates/gate59/GATE59_ALPHA_V1_ATOM_LEDGER_CONTRACT_2026-06-27.md`

`docs/research/gates/gate60/GATE60_REGIME_SOURCE_INTEGRITY_2026-06-27.md`

`docs/research/gates/gate60a/GATE60A_ALPHA_V1_MACRO_JOIN_MAP_PROOF_2026-06-27.md`

`docs/research/gates/gate60b/GATE60B_REGIME_SOURCE_FOUNDATION_2026-06-27.md`

`docs/research/gates/gate60c/GATE60C_REGIME_SOURCE_ATOM_FILL_2026-06-27.md`

`docs/research/gates/gate60d/GATE60D_BPR_SOURCE_ELIGIBILITY_2026-06-27.md`

## Forward Research Command

After Gate 56E parity, the shared engine evaluator entry point is:

```powershell
npm run engine:research-manifest:evaluate -- --manifest=<manifest.json> --artifact-gate=gate55 --price-bundle-id=gate55e_fx_m1_oanda_ny5_v1_20181217_20260607_8E37E953 --path-resolution=1m --evaluators=adr_grid,weekly_hold --status=diagnostic
```

For multi-manifest ladders, repeat `--manifest=<path>` in the same command to
use Gate 57A0 week-major batch mode.

For fast manifest aggregation over the durable Gate 57A0B path-outcome
warehouse, add the explicit warehouse ID. This mode validates the warehouse and
fails closed if rows are missing or hash-invalid; it does not silently rerun M1
path simulation:

```powershell
npm run engine:research-manifest:evaluate -- --manifest=<manifest.json> --artifact-gate=gate57 --price-bundle-id=gate55e_fx_m1_oanda_ny5_v1_20181217_20260607_8E37E953 --path-resolution=1m --evaluators=adr_grid,weekly_hold --status=diagnostic --path-outcome-warehouse-id=gate57a0b_pair_week_path_outcomes_47B8F40AFB3B
```
