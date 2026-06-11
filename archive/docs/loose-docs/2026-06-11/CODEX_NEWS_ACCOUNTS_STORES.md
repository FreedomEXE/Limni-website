# Codex Prompt: Phase 3 — News & Accounts Session Stores

> **Prerequisites:** Phase 1 (CODEX_SYSTEMIC_PRELOAD_FIX.md) and Phase 2 (CODEX_MARKET_INTELLIGENCE_STORE.md) must be implemented first.
> Follow the exact same pattern established in Phase 2 for market intelligence.

## Problem Statement

Two more pages reload all their data from scratch on every navigation:

1. **News** (`/news`) — reads ForexFactory weekly snapshots from the database, normalizes week keys, refreshes current week if stale, builds calendar/announcement payloads. All re-runs on every visit.

2. **Accounts** (`/accounts`) — reads MT5 accounts, Bitget bot state, connected accounts from the database. All re-runs on every visit.

Both should fetch once, cache client-side, and refresh on a schedule — same pattern as market intelligence.

## Phase 0: Analyze Before Implementing

Read these files and understand the data flow before writing code:

**News:**
- `src/app/news/page.tsx` — server component
- `src/components/news/NewsContentTabs.tsx` — client component
- `src/lib/news/store.ts` — `listNewsWeeks`, `readNewsWeeklySnapshot`, `writeNewsWeeklySnapshot`
- `src/lib/news/refresh.ts` — `refreshNewsSnapshot`, `shouldRefreshForPendingActuals`
- `src/lib/news/types.ts` — `NewsEvent`, `NewsWeeklySnapshot`

**Accounts:**
- `src/app/accounts/page.tsx` — server component
- `src/components/AccountsDirectory.tsx` — client component
- `src/lib/accounts/accountsDirectoryData.ts` — `buildMt5AccountCards`, `buildConnectedAccountCards`, `computeAccountsOverview`
- `src/lib/mt5Store.ts`, `src/lib/connectedAccounts.ts`, `src/lib/botState.ts`

Identify:
1. What data each server component fetches
2. What props the client components receive
3. What helper functions should be extracted into shared loaders

## Implementation Pattern

For each domain, follow the Phase 2 pattern exactly:

### Per Domain (News, Accounts):

1. **Define payload type** — `src/lib/news/newsPayload.ts`, `src/lib/accounts/accountsPayload.ts`

2. **Extract data-fetching into a loader** — `src/lib/news/loadNewsPayload.ts`, `src/lib/accounts/loadAccountsPayload.ts`. Move inline server-side fetching from `page.tsx` into a shared function. Page imports and calls the loader.

3. **Create API route** — `src/app/api/news/payload/route.ts`, `src/app/api/accounts/payload/route.ts`. Calls the loader, returns JSON.

4. **Create session store** — `src/lib/news/newsSessionStore.ts`, `src/lib/accounts/accountsSessionStore.ts`. Same `useSyncExternalStore` pattern: `seed()`, `fetchAndSeed()`, `useXxx()` hook, hourly refresh.

5. **Update client components** — seed store from server props on mount, read from store for rendering, fall back to props if store is empty.

6. **Slim down server component** — page.tsx calls the loader, passes result as props.

7. **Register as preload tasks** — add to `buildPreloadManifest()` in `preloadRegistry.ts` with real `run()` functions.

### News-Specific Notes

- The news page has complex week-key normalization logic (`normalizeNewsWeekKeys`, `inferWeekFromEvents`, `isWeekSnapshotUsable`). This stays server-side in the loader.
- Conditional refreshes (`refreshNewsSnapshot` if current week is missing or has pending actuals) happen in the loader, not the client.
- The store should cache all week snapshots so the user can switch weeks client-side without refetching.
- The news page currently renders a `ScrollableWeekStrip` for week selection — week switching should read from the store.

### Accounts-Specific Notes

- The accounts page is simpler — reads MT5 accounts, Bitget state, connected accounts, then builds cards.
- Sub-pages (`/accounts/[accountId]`, `/accounts/connected/[accountKey]`) load individual account detail — do NOT share the same store. Those are separate data needs.
- The store caches the accounts list/overview data only.

### Register Both as Preload Tasks

**File: `src/lib/preload/preloadRegistry.ts`**

Add to `buildPreloadManifest()`:

```typescript
import { fetchAndSeedNews } from "@/lib/news/newsSessionStore";
import { fetchAndSeedAccounts } from "@/lib/accounts/accountsSessionStore";

// In buildPreloadManifest():

// ── News domain ──
tasks.push({
  id: "news",
  domain: "news",
  priority: "background",
  run: () => fetchAndSeedNews(),
});

// ── Accounts domain ──
tasks.push({
  id: "accounts",
  domain: "accounts",
  priority: "background",
  run: () => fetchAndSeedAccounts(),
});
```

Both are `"background"` priority — they run alongside background strategy tasks in the concurrent phase, not before the gate lifts. This keeps preload fast. The gate already lifts after strategy + market intelligence; news and accounts load in the background and are ready by the time the user navigates to those pages.

### Add Phase Labels (if needed)

If news/accounts tasks run during the `"loading-strategies"` phase alongside background strategy tasks, no new phase label is needed — they're part of the background batch.

If you prefer a distinct phase after strategies complete, add `"loading-app-data"` to `PreloadPhase` and `PHASE_LABELS`:

```typescript
"loading-app-data": "Loading app data...",
```

Choose whichever produces a better UX. The constraint is: do not show a phase label that corresponds to no real work.

## Acceptance Criteria

1. **News loads instantly on return navigation** — no server round-trip.
2. **Accounts loads instantly on return navigation** — no server round-trip.
3. **First visit works identically** — server components still run, seed stores from props.
4. **Preload populates both stores** — tasks run during preload, stores are seeded.
5. **Week switching on News stays instant** — all week snapshots cached in the store.
6. **Hourly refresh** — both domains refresh on schedule.
7. **Account detail sub-pages unaffected** — `/accounts/[accountId]` still server-renders independently.
8. **No regressions** — all news and accounts features work identically.

## Files to Create/Modify

| File | Change |
|------|--------|
| `src/lib/news/newsPayload.ts` | **NEW** — payload type |
| `src/lib/news/loadNewsPayload.ts` | **NEW** — extracted data-fetching |
| `src/app/api/news/payload/route.ts` | **NEW** — API route |
| `src/lib/news/newsSessionStore.ts` | **NEW** — client-side session store |
| `src/app/news/page.tsx` | Slim down — call loader, pass as props |
| `src/components/news/NewsContentTabs.tsx` | Read from store, seed from props |
| `src/lib/accounts/accountsPayload.ts` | **NEW** — payload type |
| `src/lib/accounts/loadAccountsPayload.ts` | **NEW** — extracted data-fetching |
| `src/app/api/accounts/payload/route.ts` | **NEW** — API route |
| `src/lib/accounts/accountsSessionStore.ts` | **NEW** — client-side session store |
| `src/app/accounts/page.tsx` | Slim down — call loader, pass as props |
| `src/components/AccountsDirectory.tsx` | Read from store, seed from props |
| `src/lib/preload/preloadRegistry.ts` | Add news + accounts tasks with `run()` |

## Do NOT

- Do not change the preload gate or strategy store.
- Do not change the market intelligence store.
- Do not cache account detail sub-pages.
- Do not duplicate data-fetching logic between page.tsx and API routes.
- Do not change how the Status page works.
- Do not add fake phase labels for work that isn't happening.

## Verification

1. `npm run lint` passes
2. `npx tsc --noEmit` passes
3. `npm test` passes
4. Navigate to `/news` → works normally → navigate away → navigate back → **instant**
5. Navigate to `/accounts` → works normally → navigate away → navigate back → **instant**
6. Switch news weeks → **instant** (cached in store)
7. Full preload sequence works end-to-end: all phases complete, gate lifts, all pages instant
8. `/accounts/[accountId]` sub-pages still server-render independently
