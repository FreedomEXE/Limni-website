# Gate 55H Research Workflow Architecture Cleanup

Generated: 2026-06-25

## Verdict

PASS WITH CAVEATS.

The repo now has a blessed manifest-based workflow for future research:

```text
decision manifest -> shared evaluator -> result/receipt/hash writer -> registry
```

This is not a new backtest engine. It extracts the reusable Gate 55G scoring
surface into a shared library and keeps the existing Gate 44 matrix warehouse,
path loaders, weekly-hold engine, and historical receipt scripts intact.

## What Changed

- Added `ResearchDecisionManifest` contract:
  `app/src/lib/research/decisionManifest.ts`.
- Added shared ADR Grid / weekly hold manifest evaluator:
  `app/src/lib/research/decisionManifestEvaluator.ts`.
- Added append-only run registry and duplicate-prevention key:
  `app/src/lib/research/researchRunRegistry.ts`.
- Added blessed CLI:
  `app/scripts/verification/evaluate-research-decision-manifest.ts`.
- Added package command:
  `npm run verification:research-manifest:evaluate`.
- Added Gate 55 folder organization under `docs/research/gates/gate55/`.
- Added archive inventory and archive manifest with zero moves.

## What Did Not Run

- No COT restatement.
- No new Strength bucket tests.
- No regime filters.
- No COT+Strength combination.
- No execution optimization.
- No risk overlays.
- No source reconstruction.
- No matrix warehouse DB write.

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
`app/scripts/verification/audit-gate55-friday-strength-baseline.ts`.

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
- Moving legacy scripts without a dedicated reference-migration/archive gate.
