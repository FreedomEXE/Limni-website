# Gate 56C Neutral DB Client Boundary

Date: 2026-06-25
Status: READY_FOR_REVIEW

## Verdict

PASS for the narrow DB ownership correction.

This gate does not do a broad app refactor. It removes the direct engine
dependency on app-owned DB/repo-path helpers and makes `database/` the owner of
shared DB access.

## What Changed

| Old owner | New owner | Notes |
|---|---|---|
| `app/src/lib/db.ts` implementation | `database/db/client.ts` | Owns `getPool`, `query`, `queryOne`, `getClient`, and `transaction`. |
| `app/src/lib/server/rootEnv.ts` implementation | `database/db/rootEnv.ts` | Owns root `.env.local` / `.env` loading and repo-root detection used by DB client. |
| `app/src/lib/db.ts` | compatibility re-export | App imports can remain stable during later app simplification. |
| `app/src/lib/server/rootEnv.ts` | compatibility re-export | App auth/diagnostics compatibility path. |
| engine DB imports | `@database/db/client` | Engine no longer imports `@/lib/db`. |
| `engine/src/price/localM1Warehouse.ts` repo path helper | `@database/db/rootEnv` | Engine no longer imports `@/lib/server/repoPaths`. |

`app/src/lib/research/backtestEngine.ts` now has an explicit deprecation marker:
it is app research UI mock behavior, not institutional engine truth.

## Boundary

The target ownership model is:

- `database/` owns low-level DB client, migrations, schema, contracts, and root
  env loading needed by DB access.
- `engine/` owns research truth, feature builders, decision manifests,
  evaluator, run registry, cache policy, and research data adapters.
- `app/` remains a display/read-model layer and can keep compatibility imports
  until the larger app simplification gate.
- `automation/` owns MT5, bots, sidecars, and tests.
- `archive/` owns stale mock/demo/old strategy/backtest code.

## Remaining Debt

- The evaluator still imports app-owned non-UI price/path helpers:
  `executionPriceWindows`, `performance/adrLookup`,
  `performance/pathBarLoader`, and `runtimeCache`.
- App research pages still reference deprecated app research UI/API support
  files under `app/src/lib/research`.
- App code still imports `@/lib/db` broadly, but that path is now a compatibility
  re-export over `database/db/client.ts`.

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
rg -n '@/lib/db|@/lib/server/repoPaths|@/lib/server/rootEnv' engine/src engine/scripts --glob '!engine/reports/**'
node -e "JSON.parse(require('fs').readFileSync('package.json','utf8')); JSON.parse(require('fs').readFileSync('tsconfig.json','utf8')); console.log('json ok')"
npx tsc --noEmit --pretty false
npx tsc --noEmit --project app/tsconfig.json --pretty false
npm test -- app/src/lib/__tests__/backtestEngine.test.ts app/src/lib/__tests__/researchCommon.test.ts app/src/lib/__tests__/labConfigQuery.test.ts
npm run engine:research-manifest:evaluate -- --help
npm run build
git diff --check -- . ':!app/releases/v2/canon/*.json'
```

The engine boundary scan returned no matches. Focused Vitest result: `3` files
passed, `10` tests passed. Build completed under Next.js `16.1.1` with the
existing middleware/proxy deprecation warning.
