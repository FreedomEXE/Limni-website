# Gate 55 Research Workflow

Status: Gate 55H architecture cleanup superseded by Gate 56E parity. The
manifest/evaluator path is now the accepted shared research scoring path for
frozen weekly decision manifests after Gate 56E reproduced the frozen Gate 55G
selected/fade ADR Grid and weekly-hold metrics exactly.

Gate 55H defines the forward research path for future COT restatement, Strength
selected/fade, Strength buckets, regime-filtered manifests, and later combined
manifests:

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
- Fast cached price/path loading lives under `engine/src/price/`.
- ADR Grid and Weekly Hold evaluation lives under
  `engine/src/research/decisionManifestEvaluator.ts`.
- Existing Gate 44 research matrix warehouse remains in
  `engine/src/warehouse/matrixDataset.ts`.
- The manifest evaluator consumes arbitrary weekly decision rows.
- The append-only duplicate-prevention registry lives at
  `engine/src/research/researchRunRegistry.ts`.
- The shared evaluator command is:
  `npm run engine:research-manifest:evaluate -- --manifest=<manifest.json>`.

Gate 56B moved manifest/evaluator/hash/registry ownership out of app, Gate 56D
extracted engine price/path primitives, and Gate 56E proved Gate 55G equivalent
selected/fade parity. Older Gate 55H receipts that name
`app/src/lib/research/...` are historical path evidence and are superseded for
forward work.

Gate-specific receipt scripts such as
`archive/app/scripts/verification/audit-gate55-friday-strength-baseline.ts` remain
historical evidence. New research should not add new Gate-specific scorer
functions when a frozen decision manifest can go through the shared evaluator.

## Folders

- `docs/research/gates/gate55/manifests/` - reviewed manifest examples and
  manifest standards.
- `docs/research/gates/gate55/configs/` - command shapes and future run
  configuration notes.
- `docs/research/gates/gate55/receipts/` - durable receipts for manifest
  evaluations and architecture cleanup.
- `docs/research/gates/gate55/registry/` - registry policy and duplicate
  prevention notes.
- `docs/research/gates/gate55/inventory/` - active cleanup inventories and
  package command classifications.
- `archive/docs/research/gates/gate55/` - root archive mirror for archive
  manifests.
- `engine/reports/data-verification/gate55/` - machine artifacts written by the
  evaluator.

## Current Boundary

Gate 55H did not run COT restatement, Strength bucket tests, regime filters,
COT+Strength combinations, execution optimization, or risk overlays.
