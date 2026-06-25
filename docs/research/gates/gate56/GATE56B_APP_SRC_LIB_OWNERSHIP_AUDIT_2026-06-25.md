# Gate 56B App Src Lib Ownership Audit

Date: 2026-06-25
Status: READY_FOR_REVIEW

## Verdict

PASS WITH CAVEATS for ownership cleanup.

Gate 56B does not run new research, does not retune strategy logic, and does not
start Gate 55G parity. It moves obvious institutional research ownership out of
`app/src/lib`, archives unreferenced stale app-lib leftovers, and documents the
remaining app/engine boundary debt.

## Inventory

Full file-by-file inventory:

- `docs/research/gates/gate56/inventory/app-src-lib-ownership-inventory-2026-06-25.jsonl`

Rows: `362` tracked files under `app/src/lib` before Gate 56B moves.

Each row records:

- path
- purpose inferred from code/imports
- imports
- imported by
- package/script references
- active app runtime usage
- engine command/evaluator usage
- automation/bots/MT5 usage
- old/deprecated strategy/report references
- classification
- proposed action

## Moved To Engine

| Old path | New path | Classification |
|---|---|---|
| `app/src/lib/research/decisionManifest.ts` | `engine/src/research/decisionManifest.ts` | engine core |
| `app/src/lib/research/decisionManifestEvaluator.ts` | `engine/src/research/decisionManifestEvaluator.ts` | engine core |
| `app/src/lib/research/hash.ts` | `engine/src/research/hash.ts` | engine core |
| `app/src/lib/research/researchRunRegistry.ts` | `engine/src/research/researchRunRegistry.ts` | engine core |
| `app/src/lib/research/localM1Warehouse.ts` | `engine/src/price/localM1Warehouse.ts` | engine price adapter |
| `app/src/lib/research/matrixDataset.ts` | `engine/src/warehouse/matrixDataset.ts` | engine warehouse helper |
| `app/src/lib/research/macroRegimeDataset.ts` | `engine/src/warehouse/macroRegimeDataset.ts` | engine warehouse helper |

Active imports were patched to use `@engine/*` for engine-owned modules.

## Archived

Archive manifest:

- `docs/research/gates/gate56/inventory/app-src-lib-archive-manifest-2026-06-25.jsonl`

Archived source files:

- `app/src/lib/basket/basketDataSource.ts`
- `app/src/lib/performance/performanceEventTrace.ts`
- `app/src/lib/performance/strategyBacktestIngestion.ts`
- `app/src/lib/performance/strategyBootstrap.server.ts`
- `app/src/lib/sentiment/providers/mock.ts`

Reason: no active app, engine, or automation importers found by the Gate 56B
reference scan. Historical copies now live under root `archive/app/src/lib/...`.

## Kept In App

`app/src/lib/research/` still contains:

- `backtestEngine.ts`
- `bankComparison.ts`
- `bankParticipation.ts`
- `common.ts`
- `labConfigQuery.ts`
- `types.ts`

These are deprecated but referenced app research UI/API support files. The old
`backtestEngine.ts` is deterministic mock app-research behavior and must not be
treated as institutional engine truth.

## Boundary Debt

- `engine/src/research/decisionManifestEvaluator.ts` still imports app-owned
  non-UI price/path helpers:
  `app/src/lib/executionPriceWindows.ts`,
  `app/src/lib/performance/adrLookup.ts`,
  `app/src/lib/performance/pathBarLoader.ts`, and
  `app/src/lib/runtimeCache.ts`.
- `engine/src/price/localM1Warehouse.ts` still imports app-owned canonical price
  and repo-path helpers.
- `engine/src/warehouse/*` still imports `app/src/lib/db.ts`.
- Shared database and price/path primitives should move out of app only in a
  later focused extraction gate.
- Automation-owned app-lib candidates such as bot, broker, and MT5 page helpers
  remain marked `unknown / needs Freedom review` in the inventory because they
  need a separate app/API dependency audit.

## No-Go List Preserved

- no new Strength bucket tests
- no regime filters
- no COT restatement
- no COT + Strength combination
- no execution optimization
- no risk overlays
- no MT5/live promotion
- no new backtest engine
- no research result production

## Validation

Passed:

```powershell
node -e "JSON.parse(require('fs').readFileSync('package.json','utf8')); JSON.parse(require('fs').readFileSync('tsconfig.json','utf8')); console.log('json ok')"
npx tsc --noEmit --pretty false
npx tsc --noEmit --project app/tsconfig.json --pretty false
npm test -- app/src/lib/__tests__/backtestEngine.test.ts app/src/lib/__tests__/researchCommon.test.ts app/src/lib/__tests__/labConfigQuery.test.ts
npm run engine:research-manifest:evaluate -- --help
npm run build
git diff --check -- . ':!app/releases/v2/canon/*.json'
```

Focused Vitest result: `3` files passed, `10` tests passed.

`npm run build` completed under Next.js `16.1.1` with the expected existing
middleware/proxy deprecation warning.

The root TypeScript check initially exposed ignored `Local Environment/**`
scripts being included by `tsconfig.json`; Gate 56B excludes that ignored local
folder so root TypeScript checks repo-owned code.
