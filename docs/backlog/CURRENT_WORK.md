# Current Work

Status: active checklist. Keep this short and update it when gates change.

Persistent memory stays in
`C:/Users/User/Documents/GitHub/freedom-ops/.codex/`; this file tracks the
current Limni work plan so Freedom does not have to reconstruct it from chat.

## Active Gate

Gate 56E: gate55g-equivalent-manifest-parity.

Objective: prove the engine-owned manifest/evaluator path can reproduce the
accepted Gate 55G selected/fade ADR Grid and weekly-hold metrics under the Gate
55E price bundle, without running buckets, regimes, COT restatement, COT +
Strength, or execution/risk/live work.

Status: parity proof complete. Remaining work is validation, commit, push, and
session update.

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

## Frozen Areas

- `app/releases/v2/canon/*.json`
- research result retuning or new backtests
- COT signal logic
- Strength bucket or regime-filter testing
- execution/risk/live/MT5 promotion claims
- release canon regeneration

## Active Gate Doc

`docs/research/gates/gate56/PUBLIC_LOCAL_REPO_SPLIT_2026-06-25.md`

`docs/research/gates/gate56/GATE56B_APP_SRC_LIB_OWNERSHIP_AUDIT_2026-06-25.md`

`docs/research/gates/gate56/GATE56C_NEUTRAL_DB_CLIENT_BOUNDARY_2026-06-25.md`

`docs/research/gates/gate56/GATE56D_ENGINE_PRICE_PATH_PRIMITIVE_EXTRACTION_2026-06-25.md`

`docs/research/gates/gate56/GATE56E_GATE55G_EQUIVALENT_MANIFEST_PARITY_2026-06-25.md`

## Forward Research Command

After Gate 56E parity, the shared engine evaluator entry point is:

```powershell
npm run engine:research-manifest:evaluate -- --manifest=<manifest.json> --artifact-gate=gate55 --price-bundle-id=gate55e_fx_m1_oanda_ny5_v1_20181217_20260607_8E37E953 --path-resolution=1m --evaluators=adr_grid,weekly_hold --status=diagnostic
```
