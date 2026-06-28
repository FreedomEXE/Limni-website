# Current Work

Status: active checklist. Keep this short and update it when gates change.

Persistent memory stays in
`C:/Users/User/Documents/GitHub/freedom-ops/.codex/`; this file tracks the
current Limni work plan so Freedom does not have to reconstruct it from chat.

## Active Gate

Gate 68F: review-packet-completeness.

Objective: package Gate 68 after defining and testing a deterministic Brain
Mode Selector, freezing the seven-year reference capsule, defining append-only
forward receipts/drift monitoring, and completing architecture readiness review.

Status: complete and ready for review on
`codex/gate50-macro-source-promotion-proof`.

Architecture version: `gate66_brain_cells_atoms_v3`.

Gate 68 current state:

- Gate 68A:
  `PASS_BRAIN_MODE_SELECTOR_CONTRACT__ONE_SELECTOR_THREE_MODES_NO_OUTCOME_INPUTS`
- Gate 68B:
  `PASS_BRAIN_MODE_SELECTOR_TEST_MATRIX__EXACTLY_FOUR_CANDIDATES__FORCED28_PRESERVED__NO_PROMOTION`
- Gate 68C:
  `PASS_FROZEN_SEVEN_YEAR_REFERENCE_CAPSULE__HASH_BOUND_APPEND_ONLY_NO_DRIFT`
- Gate 68D:
  `PASS_FORWARD_DECISION_RECEIPT_AND_DRIFT_MONITOR__ALERT_ONLY_APPEND_ONLY_NO_LEARNING`
- Gate 68E:
  `PASS_ARCHITECTURE_LOCK_READINESS_REVIEW__CLEAR_VERDICT_NO_RISK_EXITS_LEARNING_STARTED`
- Gate 68F:
  `PASS_REVIEW_PACKET_COMPLETENESS__GATE68_ARTIFACTS_REPO_VISIBLE__COMMANDS_PRESENT`

Gate 68 readiness verdict:
`NOT_READY_LOCK_CANDIDATE_B_REFERENCE_AND_CARRY_C_SHADOW`.

Gate 68 commands:

- `npm run engine:gate68a:brain-mode-selector-contract`
- `npm run engine:gate68b:brain-mode-selector-test-matrix`
- `npm run engine:gate68c:frozen-seven-year-reference-capsule`
- `npm run engine:gate68d:forward-decision-receipt-and-drift-monitor`
- `npm run engine:gate68e:architecture-lock-readiness-review`
- `npm run engine:gate68f:review-packet-completeness`

Gate 68 key findings:

- Candidate D = one deterministic Brain Mode Selector:
  NORMAL -> Candidate B, PROTECTION -> Candidate C, CONSERVATIVE -> Candidate A.
- Candidate D mode counts: CONSERVATIVE `6,762`, NORMAL `2,811`,
  PROTECTION `871`.
- Candidate D is genuinely new versus Gate 64/65/67, but weaker than Candidate
  B on ADR Grid R/DD and does not preserve Candidate C zero-negative-year
  behavior.
- Candidate D metrics: ADR Grid `2235.61899`, DD `-388.935048`, R/DD
  `5.748052`, PF `1.239439`; Weekly Hold `846.072114`, DD `-116.320546`,
  R/DD `7.273626`, PF `1.159472`; negative ADR Grid years `1`.
- Frozen capsule:
  `gate68c_frozen_reference_capsule_C8DC7E99DE640C2D`.
- Capsule SHA:
  `C8DC7E99DE640C2DEA0817C0F48F604575D4FB5CCBC9A9C787261FB4E63073A3`.
- Gate 68E recommends Candidate B as default lock target and Candidate C as
  shadow/canary. Candidate D is rejected for next lock readiness.

Historical Gate 67 verdicts:

- Gate 67A:
  `PASS_CELL_OPINION_PACKET_CONTRACT__THREE_CELLS_FORCED28_JOINABLE__NO_FINAL_ALGORITHM_DIRECTION`
- Gate 67B:
  `PASS_FINAL_FORCED28_CANDIDATE_CONTRACT__EXACTLY_THREE_UNNAMED_SIMPLE_CANDIDATES`
- Gate 67C:
  `PASS_FINAL_FORCED28_TEST_MATRIX__EXACTLY_THREE_CANDIDATES__FORCED28_PRESERVED__NO_PROMOTION`
- Gate 67D:
  `READY_TO_LOCK_BRAIN_CELLS_ATOMS_ARCHITECTURE_AND_OPEN_EXITS_RISK_PREP`
- Gate 67E:
  `PASS_REVIEW_PACKET_COMPLETENESS__ARTIFACTS_REPO_VISIBLE__COMMANDS_PRESENT`

Commands:

- `npm run engine:gate67a:cell-opinion-packet-contract`
- `npm run engine:gate67b:final-forced28-candidate-contract`
- `npm run engine:gate67c:final-forced28-test-matrix`
- `npm run engine:gate67d:architecture-lock-readiness-review`
- `npm run engine:gate67e:review-packet-completeness`

Durable artifacts:

- Gate 67A report:
  `docs/research/gates/gate67a/GATE67A_CELL_OPINION_PACKET_CONTRACT_2026-06-28.md`
- Gate 67A opinion ledger:
  `docs/research/gates/gate67a/artifacts/gate67a-cell-opinion-packet-contract/cell-opinion-ledger.rows.jsonl`
- Gate 67B report:
  `docs/research/gates/gate67b/GATE67B_FINAL_FORCED28_CANDIDATE_CONTRACT_2026-06-28.md`
- Gate 67B candidate contracts:
  `docs/research/gates/gate67b/artifacts/gate67b-final-forced28-candidate-contract/final-forced28-candidate-contracts.json`
- Gate 67C report:
  `docs/research/gates/gate67c/GATE67C_FINAL_FORCED28_TEST_MATRIX_2026-06-28.md`
- Gate 67C test matrix:
  `docs/research/gates/gate67c/artifacts/gate67c-final-forced28-test-matrix/final-forced28-test-matrix.rows.jsonl`
- Gate 67D report:
  `docs/research/gates/gate67d/GATE67D_ARCHITECTURE_LOCK_READINESS_REVIEW_2026-06-28.md`
- Gate 67D readiness summary:
  `docs/research/gates/gate67d/artifacts/gate67d-architecture-lock-readiness-review/architecture-lock-readiness-summary.json`
- Gate 67E report:
  `docs/research/gates/gate67e/GATE67E_REVIEW_PACKET_COMPLETENESS_2026-06-28.md`

Key findings:

- Active architecture remains Brain -> Cells -> Atoms.
- Deprecated architecture term active remaining count remains `0`.
- The final forced-28 algorithm remains unnamed.
- Gate 67A emitted `31,332` cell opinion packets: COT, Strength, and Regime
  for all `10,444` pair-weeks.
- Gate 67B defined exactly three candidates.
- Gate 67C scored exactly those three candidates and preserved `10,444` rows,
  `373` weeks, `28` pairs/week, and zero duplicate pair-weeks per candidate.
- Best ADR Grid R/DD and PF: `candidate_b_macro_anchor_with_cot_warning`
  with ADR Grid `2341.080708`, DD `-241.508971`, R/DD `9.693556`, and PF
  `1.25407`.
- Best zero-negative-year and best Weekly Hold candidate:
  `candidate_c_scenario_memory_guarded` with ADR Grid `2276.283276`, DD
  `-275.03638`, R/DD `8.276299`, PF `1.242893`, and `0` negative ADR Grid
  years.
- Two of the three Gate 67 candidate signatures are new versus Gate 64/65.
- Readiness review found no hard blockers, but did not lock, name, or promote a
  final algorithm.

Validation passed:

- Gate 67A command
- Gate 67B command
- Gate 67C command
- Gate 67D command
- Gate 67E command
- `npx tsc --noEmit --pretty false --project tsconfig.json`
- targeted Gate 67 ESLint

## Next Requested Review

Stop after Gate 68F. Do not proceed to final architecture lock, final algorithm
naming/branding, adaptive learning, rolling retraining, Alpha v2 promotion,
exits, risk layer, risk overlays, basket construction, sizing, P&L attribution,
execution, MT5/live, app/runtime, source mutation, COT retuning, Strength
retuning, Regime retuning, optimized threshold search, learned weights, pair
exclusions, date exclusions, or live trading unless Freedom explicitly opens
that scope.

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

`docs/research/gates/gate68a/GATE68A_BRAIN_MODE_SELECTOR_CONTRACT_2026-06-28.md`

`docs/research/gates/gate68b/GATE68B_BRAIN_MODE_SELECTOR_TEST_MATRIX_2026-06-28.md`

`docs/research/gates/gate68c/GATE68C_FROZEN_SEVEN_YEAR_REFERENCE_CAPSULE_2026-06-28.md`

`docs/research/gates/gate68d/GATE68D_FORWARD_DECISION_RECEIPT_AND_DRIFT_MONITOR_CONTRACT_2026-06-28.md`

`docs/research/gates/gate68e/GATE68E_ARCHITECTURE_LOCK_READINESS_REVIEW_2026-06-28.md`

`docs/research/gates/gate68f/GATE68F_REVIEW_PACKET_COMPLETENESS_2026-06-28.md`

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
