# App Domain Cache Architecture v1 Spec

> Review-only architecture spec. This document does not authorize implementation, canon regeneration, release tagging, or retirement of any existing baseline.

Date: 2026-06-08
Status: Superseded after external review by `APP_TRUTH_ARCHITECTURE_V1_SPEC_2026-06-08.md`
Scope: App-wide data/cache architecture for all pages

## Superseded

External review agreed with the domain-store direction but corrected the framing:

> Cache is implementation detail. The real architecture is app truth, lifecycle, versioning, and parity.

Use:

- `docs/architecture/APP_TRUTH_ARCHITECTURE_V1_SPEC_2026-06-08.md`

as the current post-review target.

## 1. Correction

The earlier Data-only cache spec was too narrow.

The real architecture problem is not only the Data page and not only the preloader. The repo has repeated page-local fetch/cache behavior across multiple surfaces. That violates the basic engineering principle this app needs:

> Data domains own data. Pages are views. Versioned frozen data and live mutable overlays must be shared consistently everywhere.

Data and Performance should not behave differently at the architecture level. They may have different domain payloads, but they should follow the same lifecycle model.

## 2. Problem

Current app behavior shows systemic drift:

- Some pages server-load large payloads on route entry.
- Some pages use memory-only stores.
- Some pages use `cache: "no-store"` for data that is actually historical/frozen.
- Some routes are `force-dynamic` even when large portions of their data are immutable under a version.
- Preload/gate behavior is inconsistent across routes.
- Cron freshness and historical cache invalidation are mixed together.
- Logout/login and route navigation can cause data reloads that should be unnecessary.

This creates the user-facing failure:

- First load may be acceptable.
- Returning to a page is still slow.
- Different pages have different truth/cache behavior.
- The app feels fragile because each page has its own data rules.

## 3. Core Principle

The app should be organized around domain stores, not pages.

```text
Kernel / App Boot
  version manifest
  cache namespace comparison
  global readiness policy
  diagnostics

Domain Stores
  performance
  market-intelligence
  accounts
  automation
  research
  documents
  agents
  news
  status

Pages
  render selectors from domain stores
  do not own duplicate fetch/cache logic
```

The kernel coordinates lifecycle. Domain stores own data. Pages render.

## 4. Universal Domain Model

Each domain must explicitly classify its data into one or more lanes.

### Frozen Versioned Data

Immutable or effectively immutable under a version/contract.

Examples:

- closed-week Performance history
- closed-week Data / Market Intelligence snapshots
- release docs and version manifests
- historical research artifacts after approval
- broker/static account metadata when not user-private

Required behavior:

- versioned cache namespace
- persistent browser storage where appropriate
- route navigation reuses local data
- logout does not clear non-private frozen public data
- UI-only deploys do not invalidate domain data
- data-contract deploys invalidate exactly the affected namespace

### Live Mutable Overlay

Fresh/current data that can change without changing historical truth.

Examples:

- current/open week Performance
- current Data/provider freshness overlay
- account balances/positions
- bot status
- latest news
- cron status
- external service health

Required behavior:

- small payloads
- no-store allowed
- background refresh
- failure does not blank frozen history
- stale/error states are visible and local to the domain/page

### Private Session Data

User/account-specific data.

Examples:

- connected account state
- auth/session state
- trading credentials
- account-specific bot controls

Required behavior:

- cleared on logout where required
- never stored in public frozen domain caches
- separate namespace from public market/performance data

## 5. Required Cache Contract

Every domain store needs a manifest.

Minimum shape:

```ts
type DomainCacheManifest = {
  schemaVersion: string;
  domain: string;
  appVersion: string;
  domainVersion: string;
  dataContractVersion: string;
  sourceFingerprint: string | null;
  latestClosedWeekOpenUtc?: string | null;
  currentWeekOpenUtc?: string | null;
  generatedAtUtc: string;
  payloadHash?: string | null;
  payloadSizeBytes?: number | null;
};
```

Logical cache key:

```text
limni::{domain}::{schemaVersion}::{domainVersion}::{dataContractVersion}::{sourceFingerprint}
```

Pages should never invent unrelated cache keys for the same domain data.

## 5.1 Active Baseline Window

The app must distinguish active verification baseline from archival history.

Current example:

- Performance is operating on the `clean14` working baseline.
- Data can still expose report/week options going back to December.
- That makes the two core truth surfaces disagree about the active research universe.

Required rule:

> Data and Performance must consume the same active baseline/window manifest for the main verification workflow.

Older historical data may still exist, but it must be presented as archive/history mode, not as the default active Data page universe.

The active baseline/window manifest should define:

- baseline id, such as `v2.0.3-clean14`
- included week opens / report dates
- latest closed week
- current/open week, if shown as live overlay
- excluded archival weeks
- reason for exclusion, when relevant

Acceptance requirement:

- If Performance says `14 WEEKS TRACKED`, the default Data page should not expose unrelated December-era weeks as if they are part of the same active verification baseline.
- If the user deliberately enters archive mode, the UI must clearly show that the week is outside the active baseline.

## 6. Required Store Contract

Every domain store should expose the same lifecycle shape:

```ts
type DomainStatus =
  | "idle"
  | "checking-manifest"
  | "hydrating-local"
  | "fetching-frozen"
  | "ready"
  | "refreshing-live"
  | "degraded"
  | "error";
```

Every domain store should expose:

- `manifest`
- `status`
- `frozenReady`
- `liveStatus`
- `lastHydratedUtc`
- `lastLiveRefreshUtc`
- `cacheSource`: `memory | indexeddb | localstorage | server | network | none`
- `degradedReasons`
- `error`

This gives Status and debug tooling one consistent way to explain app behavior.

## 7. Storage Rules

Recommended storage:

- Memory store for current session speed.
- IndexedDB for large frozen payloads.
- localStorage for small manifests and namespace stamps.
- Server/runtime/CDN cache as a secondary accelerator, not the only cache.

Rules:

- Browser persistent cache should be keyed by domain version, not route.
- Logout clears private/session data, not public frozen market/performance caches.
- Hard app/data version changes should invalidate affected domains predictably.
- Current/live overlays should not invalidate closed-week frozen data.

## 8. Page Responsibilities

Pages should:

- read URL/view state
- select data from domain stores
- show local loading/stale/error states
- trigger domain hydration if needed

Pages should not:

- own duplicate historical fetch logic
- server-load full historical bundles on every route entry
- use no-store for closed historical data
- mix live freshness failure with historical truth failure
- clear shared domain state on unmount

## 9. Domain Mapping

### Performance

Frozen:

- closed-week strategy history
- strategy/kernel shards
- approved historical simulation/path payloads
- closed-week execution ledger/trade rows used by basket and drilldown views

Live overlay:

- current/open week performance
- active strategy live status
- stale-canon warnings

Private:

- none unless linked to account execution

Required consistency rule:

> Performance summary, basket, research/drilldown, exports, and parity tests must read the same execution ledger/trade-row source for a selected strategy/week.

Current failure example from 2026-06-08:

- Selected route: Tandem / ADR Grid / Pair Fill Cap, May 25 2026.
- Sidebar/header showed selected-week engine metrics.
- Basket tab showed warning: `Basket header is using the engine ledger P/L. Drilldown row totals currently sum to 0.00%.`
- Basket body showed `Basket data is syncing. Kernel: error. Preload: idle.`
- This means the app cannot use the Basket tab to verify grids/trades for app parity.

Acceptance requirement:

- If the header says there are engine trades/P&L for a week, Basket must render the underlying rows from the same source or fail loudly with a single clear missing-ledger state.
- The app must not show contradictory `engine trades` and `0 trades`/empty drilldown for the same selected week.
- App parity workflows must be able to export or inspect the exact rows visible in Basket/Research.

Selection switching rule:

> Changing signal model, execution, risk overlay, week, or metric must atomically move every Performance surface to the same selected data state.

Current failure example from 2026-06-08:

- Switching from ADR Grid / Pair Fill Cap to Weekly Hold left the sidebar showing `14 WEEKS TRACKED` and large performance stats.
- Main content showed `Clean14 Performance runtime is not ready`, `expected weeks: 14`, and `missing weeks: 10`.
- This is split-brain UI: one surface says the selected runtime is usable, another says it is not.

Acceptance requirement:

- If the selected runtime is missing weeks, sidebar, header, tabs, basket, and summary must all show the same unavailable/degraded state.
- Internal diagnostics such as stale canon versions and missing week counts belong in Status/details, not as a wall of user-facing text on the main workflow.
- Weekly Hold must not be a special broken path; it uses the same domain lifecycle and selection-state contract as ADR Grid.

### Data / Market Intelligence

Frozen:

- closed-week Dealer/Commercial/Sentiment/Strength snapshots
- snapshot provenance
- source freeze ledger diagnostics

Live overlay:

- current/open week source availability
- latest provider freshness
- invalid/future snapshot warnings

### Accounts

Frozen:

- static broker/profile metadata where non-secret

Live/private:

- balances
- positions
- reconciliation state
- connected account health

### Automation

Frozen:

- bot configuration templates
- strategy-to-bot mapping definitions

Live/private:

- running bot status
- execution locks
- account-specific risk state
- kill switch status

### Research Lab

Frozen:

- approved research artifacts
- completed backtest reports after parity approval

Live overlay:

- active research runs
- candidate generation jobs

### Documents

Frozen:

- release docs
- handoffs
- specs
- versioned compliance artifacts

Live overlay:

- latest available document index if editable

### Agents

Frozen:

- agent definitions/instructions
- approved workflow specs

Live overlay:

- agent runtime state
- recent task status

### News

Frozen:

- none by default, unless archived snapshots are introduced

Live overlay:

- latest headlines
- feed fetch status
- sentiment/news freshness

### Status

Frozen:

- release manifest
- cache/domain manifests

Live overlay:

- cron health
- diagnostics
- current cache readiness
- provider health

Status must not be blocked by the normal app preload gate. It is the diagnostic escape hatch.

### Version Badge / Release Popover

Frozen:

- live/stable release identity
- release line metadata
- approved release notes

Dev/pending:

- local candidate version
- pending change summary
- unresolved gates/blockers
- cache/domain invalidation impact

Required rule:

> Live/stable version and local pending/dev candidate are separate identities.

The UI should not force live production and local development to share one version label. The badge/popover should make clear:

- what is currently live/stable
- what local/dev candidate is being inspected
- what changes are pending
- what gates block promotion
- whether the candidate changes data/cache namespaces or only UI

Current failure noted on 2026-06-08:

- Version badge/popover behavior was forced toward `v2` plus `v2.0.3 pending`, implying local dev and live version identity should move together.
- Freedom corrected this: the useful popover is the pending/dev candidate with what is being worked on, not a claim that live and local should always match.

## 10. App Boot / Preload Rules

Preload should be domain-aware, not page-aware.

The app boot should:

1. Check app/version manifest.
2. Compare domain manifests.
3. Hydrate required frozen domain data from persistent cache.
4. Fetch missing/stale frozen data once per namespace.
5. Release the app when the active route's required frozen domains are usable.
6. Refresh live overlays in the background.

The app boot should not:

- preload every possible domain before showing the app
- re-run full historical preload on every route entry
- block all pages because one live overlay failed
- make Status inaccessible during data failures

## 11. API Rules

Each domain should prefer this shape:

```text
GET /api/{domain}/manifest
GET /api/{domain}/frozen-bundle?version=<domainVersion>
GET /api/{domain}/live-overlay
```

Not every domain needs all three endpoints, but every domain must define which parts are frozen and which parts are live.

Existing compatibility endpoints can remain temporarily, but they should be marked as transport/fallback, not canonical store ownership.

## 12. Cron Rules

Cron refreshes live/current data and materializes newly closed frozen data.

Cron must not imply:

- every page should be revalidated as if all data changed
- closed-week frozen bundles should reload every few minutes
- current-week failure should blank historical UI

Recommended split:

- frequent cron for live overlays
- explicit freeze/materialization path for newly closed weeks
- explicit data-contract/version bump for historical recalculation

## 13. Acceptance Tests

App-wide acceptance tests:

1. First visit after cache clear may fetch required frozen bundles.
2. Route navigation does not refetch already-ready frozen bundles.
3. Logout/login preserves public frozen caches and clears private session caches.
4. UI-only deploy does not invalidate frozen domain data.
5. Data-contract deploy invalidates only affected domains.
6. Live overlay failure does not blank frozen history.
7. Status remains reachable during preload/cache failures.
8. Playwright route trace proves Data -> Performance -> Data avoids duplicate frozen bundle fetches.
9. Playwright route trace proves Performance -> Data -> Performance avoids duplicate frozen strategy history fetches.
10. Domain diagnostics show cache source and version for every major page.

## 14. Implementation Order

Do not implement everything at once.

Recommended order:

1. Inventory current route/fetch/cache ownership by page and domain.
2. Add diagnostics to show cache source and domain readiness.
3. Define shared domain store interface.
4. Migrate Performance and Data first because they are the core truth surfaces.
5. Migrate Status diagnostics so failures are visible.
6. Migrate Accounts/Automation with private-data rules.
7. Migrate Research/Documents/Agents/News as appropriate.
8. Delete duplicate page-local caches only after route traces prove parity.

## 15. Review Questions

Reviewer must answer:

1. Is the domain-store model the right app-wide contract?
2. Which domains require IndexedDB persistence versus memory/session only?
3. What is the canonical source for each domain's version/fingerprint?
4. Which deploy types invalidate which domains?
5. Which domains are public/frozen versus private/session?
6. What should be the first two implementation targets: Performance/Data or Data/Status?
7. What current page-local caches must be deleted after migration?
8. What Playwright traces are mandatory before accepting the migration?

## 16. CTO Recommendation

Approve the app-wide domain cache contract before implementing any more preload patches.

Performance and Data should be treated as sibling domain stores under the same architecture:

- frozen historical bundle
- live mutable overlay
- persistent versioned cache
- shared diagnostics
- thin page views

The current narrow Data reload is only one symptom. The real fix is to stop allowing every page to define its own truth/cache lifecycle.

## Human Breakdown

What changed: this spec generalizes the cache/preload model from Data-only to the whole app.

Why it matters: Performance, Data, and every major page should share one architectural principle instead of behaving differently.

What passed/failed: no app code changed. The previous Data-only spec was too narrow and is now marked superseded.

Next gate: review this app-wide domain cache contract before implementation.
