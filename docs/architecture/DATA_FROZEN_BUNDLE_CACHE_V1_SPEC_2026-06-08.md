# Data Frozen Bundle Cache v1 Spec

> Review-only architecture spec. This document does not authorize implementation, canon regeneration, release tagging, or retirement of any existing baseline.

Date: 2026-06-08
Status: Superseded by `APP_DOMAIN_CACHE_ARCHITECTURE_V1_SPEC_2026-06-08.md`
Scope: Data page / Market Intelligence domain only

## Superseded

This document was intentionally narrow around the visible Data page reload failure. That scope is insufficient.

The correct architecture is app-wide: Data, Performance, Status, News, Accounts, Automation, Research Lab, Documents, and future pages must consume shared domain stores with explicit versioning, persistence, invalidation, and live-overlay boundaries.

Use:

- `docs/architecture/APP_TRUTH_ARCHITECTURE_V1_SPEC_2026-06-08.md`
- `docs/architecture/APP_TRUTH_ARCHITECTURE_INDEX.md`

as the current architecture authority.

## 1. Problem

The Data page currently behaves like a dynamic page payload instead of a versioned frozen data product.

Observed current behavior:

- First Data load can be slow, which is acceptable.
- Navigating away from Data and back can trigger another heavy reload.
- This also appears to exist in v2.0.2, so it is older architecture debt, not only a v2.0.3 regression.
- The current route and store path treats closed historical weeks as live page data.

Current code shape causing the problem:

- `src/app/dashboard/page.tsx` is `force-dynamic` with `revalidate = 0`.
- `src/app/dashboard/page.tsx` loads `includeAllReports: true` server-side when the page is entered.
- `src/lib/dashboard/marketIntelligenceStore.ts` is memory-only.
- `fetchAndSeedMarketIntelligence()` calls `/api/dashboard/payload` with `cache: "no-store"`.
- `src/app/api/dashboard/payload/route.ts` is also `force-dynamic`.
- `loadCachedMarketIntelligence()` uses short server runtime cache only, currently defaulting to 5 minutes.
- Cron routes revalidate `/dashboard`, which is valid for live data but wrong if it causes closed historical data to feel freshly recomputed on normal navigation.

This violates the intended app contract:

> Closed/frozen historical Data should load once per data version, persist locally, survive page navigation and login/logout, and change only when the data/cache namespace changes.

## 2. Design Principle

Pages are views. Data domains own data.

The Data page should not own the full historical payload lifecycle. It should consume a Market Intelligence domain cache.

Market Intelligence has two lanes:

1. Frozen historical bundle
   Versioned, immutable under a source/data contract, persisted in the browser, reusable across navigation and login/logout.

2. Live/current overlay
   Small, fresh, background-refreshed by cron/API, never allowed to invalidate the frozen history bundle by itself.

## 3. Goals

- Data page first load may show a preload screen while the frozen bundle is fetched and stored.
- Returning to Data from Performance, Status, Accounts, or any other page should hydrate from local cache without a full reload.
- Logout/login should not clear the frozen bundle.
- UI-only deploys should not invalidate the frozen Data bundle.
- Data-contract/source changes should invalidate exactly the affected namespace.
- Current/live data freshness should be handled separately from frozen historical data.
- The UI should be able to explain what it is showing: frozen bundle version, latest closed week, live overlay status, and cache hit/miss state.

## 4. Non-Goals

- No canon regeneration.
- No 19-week retirement.
- No clean14 release decision.
- No Performance strategy truth claim.
- No rewrite of Accounts, Automation, Research Lab, Documents, Agents, News, or Status in this spec.
- No new lazy/paginated closed-week fetching model for historical Data unless explicitly approved.

## 5. Required Data Contract

Introduce a Market Intelligence cache namespace. The exact field names can change during implementation, but the contract must include:

- `schemaVersion`
- `appVersion`
- `dataBundleVersion`
- `sourceLedgerVersion` or source fingerprint
- `latestClosedWeekOpenUtc`
- `currentWeekOpenUtc`
- `generatedAtUtc`
- `payloadHash`
- `payloadSizeBytes`
- `reportDates`
- `weekKeySemantics`

The cache key must be based on data identity, not page identity.

Example logical key:

```text
market-intelligence::{schemaVersion}::{dataBundleVersion}::{sourceLedgerVersion}
```

If the app deploy is UI-only and these values do not change, the Data cache remains valid.

If the source ledger, source resolver semantics, report window, snapshot semantics, or payload schema changes, the cache namespace changes and one controlled refetch is expected.

## 6. Browser Persistence

The frozen bundle should be stored in persistent browser storage.

Recommended:

- IndexedDB for the full payload.
- localStorage only for small manifest metadata and fast boot checks.

Reason:

- The current all-report Data payload is multiple MB.
- localStorage is not suitable for full payload storage.
- Memory-only state disappears on reload, hard refresh, tab close, and sometimes auth transitions.

Persistence rule:

Logout should clear private/account/session data, but should not clear public/versioned frozen market data unless the user explicitly clears app cache.

## 7. Server/API Shape

Split the current single dynamic payload endpoint into separate responsibilities.

Recommended endpoints:

```text
GET /api/dashboard/market-intelligence/manifest
GET /api/dashboard/market-intelligence/frozen-bundle?version=<dataBundleVersion>
GET /api/dashboard/market-intelligence/live-overlay
```

`manifest`:

- Small.
- Cheap.
- Can be checked on boot and periodically in background.
- Tells the client whether the frozen local bundle is still valid.

`frozen-bundle`:

- Full closed-week Data payload.
- Versioned.
- Cacheable when release-ready.
- Should not be reloaded on every page navigation.

`live-overlay`:

- Small.
- No-store.
- Updated by cron/current provider state.
- Handles current/open week and latest provider freshness.

## 8. Client Lifecycle

Boot sequence:

1. Load local Market Intelligence manifest from localStorage.
2. If local manifest matches current server manifest, hydrate frozen bundle from IndexedDB.
3. If IndexedDB has the matching frozen bundle, Data domain becomes `ready` without network-heavy payload fetch.
4. If missing/stale, fetch `frozen-bundle`, validate hash/shape, persist to IndexedDB, then publish to memory store.
5. Fetch `live-overlay` in background after frozen data is usable.

Navigation rule:

- Page navigation must not reset the Data domain store.
- Returning to `/dashboard` should read from the existing domain store or IndexedDB.
- A full-screen app preload may run once per namespace, not every route visit.

Current-week rule:

- Current/open week data can show loading, stale, invalid, or missing states.
- Current/open week status must not blank or invalidate closed historical weeks.

## 9. Cron/Freshness Model

Cron should refresh live/current provider state independently of frozen history.

Recommended cadence:

- Live/current overlay: every 5 minutes if desired.
- Frozen closed-week bundle: only after a new week is formally frozen or after an approved source/data contract change.

Important distinction:

- Cron freshness is not cache invalidation.
- A 5-minute cron should not cause the closed-week Data bundle to reload every 5 minutes.

## 10. AppPreloadGate Relationship

The global preload gate should not treat every route as needing the same historical preload.

Market Intelligence should expose its own domain readiness:

- `idle`
- `checking-manifest`
- `hydrating-local-bundle`
- `fetching-frozen-bundle`
- `ready`
- `live-refreshing`
- `degraded`
- `error`

Once `ready` has been reached for the current namespace, normal navigation should not show the full-screen loader again.

If live refresh fails, keep frozen Data usable and show a local stale/live warning.

## 11. Dashboard Page Responsibility

The Dashboard/Data page should become a thin view shell.

It should:

- Read URL state: bias, report, asset, view.
- Render from Market Intelligence domain selectors.
- Trigger domain hydration only if the domain is not ready.
- Never own the full historical payload lifecycle.

It should not:

- Server-load `includeAllReports: true` every time the route is entered.
- Treat historical closed-week data as `no-store` page data.
- Clear the Data domain store on route change.

## 12. Acceptance Tests

Minimum verification before this design is accepted as implemented:

1. First Data load after cache clear fetches the frozen bundle once.
2. Data -> Performance -> Data does not refetch the frozen bundle.
3. Data -> Status -> Data does not refetch the frozen bundle.
4. Bias switching Dealer/Commercial/Sentiment/Strength does not refetch the frozen bundle.
5. Week switching among closed weeks does not refetch the frozen bundle.
6. Logout -> login -> Data reuses the frozen bundle.
7. UI-only version bump does not invalidate the frozen bundle.
8. Data-contract/source-ledger version bump invalidates the frozen bundle exactly once.
9. Live-overlay refresh failure does not blank closed weeks.
10. DevTools/Playwright evidence shows zero heavy `/api/dashboard/payload?allReports=1` style refetches after first namespace load.

## 13. Review Questions

Reviewer should answer these before implementation:

1. What exact version source should define `dataBundleVersion`?
2. Should the source fingerprint include Sentiment timestamp semantics and raw-provider provenance policy?
3. Should frozen Market Intelligence include current week, or should current week always live only in `live-overlay`?
4. Is IndexedDB acceptable as the durable browser cache, with localStorage manifest metadata?
5. Should the existing `/api/dashboard/payload` be kept as a temporary compatibility endpoint or replaced immediately?
6. Which deploy types should invalidate Data: UI-only, source resolver, snapshot cutoff rule, report schema, source ledger, source payload?
7. Should the frozen bundle be one whole bundle now, or split by domain source while still preserving one first-load contract?

## 14. Recommended Rollout

Phase 1: Read-only instrumentation

- Add diagnostics showing whether Data rendered from server, memory, IndexedDB, or network.
- Add Playwright route trace for Data -> Performance -> Data.
- Do not change behavior yet.

Phase 2: Persistent frozen bundle cache

- Add Market Intelligence manifest and IndexedDB cache.
- Hydrate from local cache before network.
- Keep existing API as fallback.

Phase 3: Thin Dashboard shell

- Remove heavy all-report server load from `/dashboard`.
- Make Data page consume the domain store.

Phase 4: Live overlay separation

- Split current/open week freshness from closed historical bundle.
- Change cron revalidation behavior so live refresh does not imply closed-week reload.

Phase 5: Cleanup

- Retire duplicate fetch paths.
- Remove temporary compatibility fallbacks only after Playwright evidence proves route navigation remains instant.

## 15. CTO Recommendation

Do not patch the spinner first.

The spinner is exposing the real problem: frozen Data is not a durable versioned domain cache. Fixing only the loading screen would hide the issue and preserve the bad architecture.

The correct next move is to approve or revise this domain-cache contract, then implement it behind tests and Playwright traces.

## Human Breakdown

What changed: this spec defines Data as a versioned frozen bundle plus a separate live overlay.

Why it matters: closed historical weeks should not reload just because the user changed pages.

What passed/failed: current architecture fails the desired cache contract because Data is dynamic, memory-only, and no-store.

Next gate: review and approve the cache namespace, IndexedDB persistence model, and live-overlay split before implementation.
