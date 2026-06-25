# Gate 55 Research Workflow

Status: Gate 55H architecture cleanup.

Gate 55H defines the blessed research path for future COT restatement,
Strength selected/fade, Strength buckets, regime-filtered manifests, and later
combined manifests:

```text
ResearchDecisionManifest
-> shared decision manifest evaluator
-> result/receipt/hash writer
-> append-only research run registry
```

The path is intentionally a wrapper around existing reusable infrastructure,
not a new backtest engine:

- Canonical price truth remains `canonical_price_bars` under the Gate 55E
  price bundle ID
  `gate55e_fx_m1_oanda_ny5_v1_20181217_20260607_8E37E953`.
- Fast cached price/path loading remains in
  `app/src/lib/performance/pathBarLoader.ts`.
- Existing app weekly-hold runtime remains in
  `app/src/lib/performance/weeklyHoldEngine.ts`.
- Existing Gate 44 research matrix warehouse remains in
  `app/src/lib/research/matrixDataset.ts`.
- The manifest evaluator lives at
  `app/src/lib/research/decisionManifestEvaluator.ts` and consumes arbitrary
  weekly decision rows.
- The append-only duplicate-prevention registry lives at
  `app/src/lib/research/researchRunRegistry.ts`.
- The blessed command is:
  `npm run verification:research-manifest:evaluate -- --manifest=<manifest.json>`.

Gate-specific receipt scripts such as
`app/scripts/verification/audit-gate55-friday-strength-baseline.ts` remain
historical evidence. New research should not add new Gate-specific scorer
functions when a frozen decision manifest can go through the shared evaluator.

## Folders

- `docs/research/gates/gate55/manifests/` - reviewed manifest examples and
  manifest standards.
- `docs/research/gates/gate55/configs/` - blessed command shapes and future run
  configuration notes.
- `docs/research/gates/gate55/receipts/` - durable receipts for manifest
  evaluations and architecture cleanup.
- `docs/research/gates/gate55/registry/` - registry policy and duplicate
  prevention notes.
- `docs/research/gates/gate55/archive/` - strategy/tester inventory and archive
  manifests.
- `app/reports/data-verification/gate55/` - machine artifacts written by the
  evaluator.

## Current Boundary

Gate 55H did not run COT restatement, Strength bucket tests, regime filters,
COT+Strength combinations, execution optimization, or risk overlays.
