# Gate 56D Engine Price Path Primitive Extraction

Date: 2026-06-25
Status: READY_FOR_REVIEW

## Verdict

PASS for the narrow engine boundary correction.

This gate does not run Gate 55G parity, retune signals, run new research
variants, or change app behavior. It only moves reusable non-UI price, path,
cache, and contract primitives out of app ownership so the engine evaluator can
stand on engine-owned infrastructure.

## What Changed

| Old owner | New owner | Notes |
|---|---|---|
| `app/src/lib/runtimeCache.ts` | `engine/src/cache/runtimeCache.ts` | Runtime cache implementation. |
| `app/src/lib/cotMarkets.ts` | `engine/src/contracts/cotMarkets.ts` | Asset class and COT market definitions. |
| `app/src/lib/weekAnchor.ts` | `engine/src/contracts/weekAnchor.ts` | Canonical week-anchor helpers required by price windows. |
| `app/src/lib/canonicalPriceBars.ts` | `engine/src/price/canonicalPriceBars.ts` | Canonical price bar DB read helpers. |
| `app/src/lib/canonicalPriceWindows.ts` | `engine/src/price/canonicalPriceWindows.ts` | Canonical week/day price windows. |
| `app/src/lib/executionPriceWindows.ts` | `engine/src/evaluation/executionPriceWindows.ts` | Execution weekly window helpers used by evaluators. |
| `app/src/lib/performance/adrLookup.ts` | `engine/src/price/adrLookup.ts` | ADR lookup over canonical price bars. |
| `app/src/lib/performance/pathBarLoader.ts` | `engine/src/price/pathBarLoader.ts` | Path bar loading and mark-price matrix helpers. |
| `app/src/lib/performance/pathResolution.ts` | `engine/src/price/pathResolution.ts` | Canonical path resolution constant. |

The old app paths remain as compatibility re-exports over `@engine/*` so current
routes, app read models, and tests can keep importing their existing paths until
the app simplification gate.

## Boundary

The new rule is explicit:

```text
engine evaluator and engine source must not import @/lib/*.
```

Engine-owned implementation paths now import:

- DB access from `@database/db/client`
- root env/repo-root access from `@database/db/rootEnv`
- cache primitives from `@engine/cache/runtimeCache`
- asset and week contracts from `@engine/contracts/*`
- price/path primitives from `@engine/price/*`
- execution windows from `@engine/evaluation/executionPriceWindows`

## Remaining Debt

- App code still imports many old `@/lib/*` paths, but the extracted paths are
  compatibility wrappers rather than implementation owners.
- App research UI/API support under `app/src/lib/research` remains deprecated
  visualization debt for a later app simplification gate.
- Gate 55G equivalent-manifest parity is still pending and must be run as a
  separately authorized research verification gate.

## No-Go List Preserved

- no Gate 55G parity run
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
rg -n '@/lib/' engine/src engine/scripts --glob '!engine/reports/**'
node -e "JSON.parse(require('fs').readFileSync('package.json','utf8')); JSON.parse(require('fs').readFileSync('tsconfig.json','utf8')); console.log('json ok')"
npx tsc --noEmit --pretty false
npx tsc --noEmit --project app/tsconfig.json --pretty false
npm test -- app/src/lib/__tests__/executionPriceWindows.test.ts app/src/lib/__tests__/runtimeCache.test.ts app/src/lib/__tests__/weeklyHoldEngineAdrGrid.test.ts app/src/lib/__tests__/backtestEngine.test.ts app/src/lib/__tests__/researchCommon.test.ts app/src/lib/__tests__/labConfigQuery.test.ts
npm run engine:research-manifest:evaluate -- --help
npm run build
git diff --check -- . ':!app/releases/v2/canon/*.json'
```

The engine boundary scan returned no matches. Focused Vitest result: `6` files
passed, `20` tests passed. `npm run build` completed under Next.js `16.1.1`
with the existing middleware/proxy deprecation warning.
