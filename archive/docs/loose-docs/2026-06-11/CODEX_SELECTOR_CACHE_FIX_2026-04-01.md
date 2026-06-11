# Codex Task: Selector Engine Cache Invalidation Fix

## Context

The selector engine (`src/lib/performance/selectorEngine.ts`) was fixed by reverting broken data-quality guards (commit `e6d792b`). The engine version was bumped from `selector-engine-v3` to `selector-engine-v4`. The strategy artifact cache version was also bumped from `strategy-artifact-v8` to `strategy-artifact-v9` (commit `e179ccb`).

**Problem:** The app still shows stale cached results (+100% instead of the correct +134%) because:
1. The strategy artifact cache in the database (`strategy_artifacts` table) stores precomputed results
2. The old Vercel deployment (running the broken v3 engine) keeps re-filling the DB with stale data
3. There's no way to flush the cache after a new deployment goes live

## Task

### 1. Add admin API endpoint to flush strategy artifacts

Create `src/app/api/admin/flush-strategy-cache/route.ts`:

- Accept `POST` requests only
- Require the existing admin auth token: check `request.headers.get("x-admin-token")` against `process.env.ADMIN_API_TOKEN`
- Delete ALL rows from the `strategy_artifacts` table using the existing `query()` function from `@/lib/db`
- Also call `clearAllStrategyArtifactEntries()` from `@/lib/performance/strategyArtifactCache` to clear the in-memory cache
- Also call `clearRuntimeCacheByPrefix("selectorEngine")` from `@/lib/runtimeCache` to clear the selector runtime cache
- Return JSON with `{ flushed: true, message: "Strategy artifact cache flushed" }`
- On auth failure return 401
- On error return 500

Follow the exact pattern of the existing admin endpoint at `src/app/api/admin/clear-cache/route.ts`.

Use the Freedom_EXE file header standard:
```
/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
```

### 2. Include selector engine version in the artifact fingerprint

In `src/lib/performance/strategyPageData.ts`, in the function that builds the fingerprint (around line 250-260 where `engineVersion` is set), change the `engineVersion` field to ALSO include the selector engine version so that bumping the selector engine version automatically invalidates the artifact cache:

Current code (approximately):
```typescript
engineVersion: STRATEGY_ARTIFACT_ENGINE_VERSION,
```

Import `SELECTOR_ENGINE_VERSION` from `selectorEngine.ts` (you'll need to export it first) and change to:
```typescript
engineVersion: `${STRATEGY_ARTIFACT_ENGINE_VERSION}:${SELECTOR_ENGINE_VERSION}`,
```

In `src/lib/performance/selectorEngine.ts`, export the version constant:
```typescript
export const SELECTOR_ENGINE_VERSION = "selector-engine-v4";
```

### 3. Verification

After making changes:

1. Run `npx vitest run` — all 142 tests must pass
2. Run `npx eslint src/lib/performance/selectorEngine.ts src/lib/performance/strategyPageData.ts src/app/api/admin/flush-strategy-cache/route.ts` — must be clean
3. Run `npx tsx scripts/verify-selector-parity.ts` — must show:
   - Return: +134.30%
   - Max DD: -4.71%
   - `PARITY OK`

### Important

- Do NOT modify any logic in `selectorEngine.ts` other than exporting the version constant
- Do NOT modify any logic in `strategyPageData.ts` other than the fingerprint engineVersion field
- The selector engine must NOT have any "data-quality guards" (no COT freshness gate, no sentiment zero-variance guard, no thin-lookback guard). These were reverted in commit `e6d792b`. If you see them, they should NOT be there.
- Keep changes minimal and focused
