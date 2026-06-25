# Gate 55H Research Workflow Architecture Cleanup

Generated: 2026-06-25

## Verdict

PASS WITH CAVEATS.

The repo now has a manifest-based candidate shared workflow for future research:

```text
decision manifest -> candidate shared evaluator -> result/receipt/hash writer -> registry
```

This is not a new backtest engine. It wraps existing reusable price/path,
weekly-hold, and research-matrix infrastructure. The evaluator is not yet
accepted as final architecture because Gate 55G equivalent-manifest parity is
still pending.

## What Changed

- Added `ResearchDecisionManifest` contract:
  `app/src/lib/research/decisionManifest.ts`.
- Added ADR Grid / weekly hold manifest evaluator:
  `app/src/lib/research/decisionManifestEvaluator.ts`.
- Added append-only run registry and duplicate-prevention key:
  `app/src/lib/research/researchRunRegistry.ts`.
- Added candidate evaluator CLI. Gate 56 later moved it to:
  `engine/scripts/verification/evaluate-research-decision-manifest.ts`.
- Added package command:
  `npm run engine:research-manifest:evaluate`.
- Added repo-wide loose artifact inventory generator:
  `archive/app/scripts/verification/inventory-loose-research-artifacts.ts`.
- Added file-by-file loose artifact inventory:
  `docs/research/gates/gate55/inventory/LOOSE_ARTIFACT_INVENTORY_2026-06-25.md`.
- Added package research/backtest/tester command classification:
  `docs/research/gates/gate55/inventory/PACKAGE_COMMAND_CLASSIFICATION_2026-06-25.md`.
- Moved safe deprecated ADR JavaScript backtest scripts with `git mv` into the
  root archive mirror under `archive/app/scripts/`.
- Moved the archive manifest into the root archive mirror:
  `archive/docs/research/gates/gate55/ARCHIVE_MANIFEST_2026-06-25.md`.
- Moved active inventory documentation under:
  `docs/research/gates/gate55/inventory/`.

## Cleanup Result

- File-by-file candidate inventory rows: `893`.
- Deprecated and safe to archive: `9`.
- Archived with `git mv`: `9`.
- Active evidence receipts retained: `29`.
- Historical receipt scripts retained: `31`.
- Deprecated but referenced files retained with deprecation classification:
  `247`.
- Unknown files left for Freedom review: `561`.

Archived files:

- `archive/app/scripts/adr-backtest-agreement.js`
- `archive/app/scripts/adr-backtest-comparison.js`
- `archive/app/scripts/adr-backtest-dynamic-tp.js`
- `archive/app/scripts/adr-backtest-extended.js`
- `archive/app/scripts/adr-backtest-grid-final.js`
- `archive/app/scripts/adr-backtest-neutral.js`
- `archive/app/scripts/adr-backtest-sentiment.js`
- `archive/app/scripts/adr-backtest-stoch.js`
- `archive/app/scripts/adr-backtest-tandem.js`

## What Did Not Run

- No COT restatement.
- No new Strength bucket tests.
- No regime filters.
- No COT+Strength combination.
- No execution optimization.
- No risk overlays.
- No source reconstruction.
- No matrix warehouse DB write.
- No MT5/live work.

## Reuse Boundary

Kept reusable infrastructure:

- Canonical price bundle truth: Gate 55E
  `gate55e_fx_m1_oanda_ny5_v1_20181217_20260607_8E37E953`.
- Cached path/price loaders:
  `app/src/lib/performance/pathBarLoader.ts`.
- App weekly-hold engine:
  `app/src/lib/performance/weeklyHoldEngine.ts`.
- Gate 44 research matrix warehouse helpers:
  `app/src/lib/research/matrixDataset.ts`.
- Strength source derivation owner:
  `app/src/lib/strength/historicalStrength.ts`.

Historical scripts remain historical evidence, including
`archive/app/scripts/verification/audit-gate55-friday-strength-baseline.ts`.

## Durable Evidence Path Rule

The evaluator now uses absolute paths only for filesystem writes. Registry and
receipt fields store repo-relative paths for manifest, result, receipt, hash,
and registry artifacts.

## Parity Status

Gate 55G equivalent-manifest parity is pending. Until a parity receipt proves
the new evaluator reproduces the frozen Gate 55G selected/fade ADR Grid and
weekly-hold metrics under the Gate 55E price bundle, the evaluator is a
candidate shared evaluator and outputs are diagnostic-only.

Parity placeholder:
`docs/research/gates/gate55/receipts/GATE55H_EVALUATOR_PARITY_PENDING_2026-06-25.md`.

## Duplicate Prevention

The registry equivalence key is:

```text
input_manifest_hash
+ price_bundle_id
+ feature_bundle_id
+ source_context_ids
+ evaluator_version
+ evaluators
+ path_resolution
+ config_hash
```

Equivalent prior runs are printed and not rerun unless
`--rerun-reason=<reason>` is supplied.

## COT Restatement Readiness

Locked Gate 54 CLP decisions can be restated under the Gate 55E price bundle
without retuning if a manifest is generated from the existing locked COT
decision logic. The restatement must produce a new Gate 55 receipt and must not
edit Gate 54 truth.

## No-Go List

Still blocked until explicitly opened:

- Running the COT restatement.
- Running Strength bucket manifests.
- Running regime-filtered manifests.
- Combining COT and Strength.
- Changing COT signal logic or tie policy.
- Optimizing ADR Grid/execution/risk.
- Running MT5/live work.
- Moving additional legacy scripts without a dedicated reference-migration or
  archive review.
