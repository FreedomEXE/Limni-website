# App Truth Architecture Implementation Plan

> Planning document only. This does not authorize app code changes, canon regeneration, release tagging, or baseline retirement.

Date: 2026-06-08
Status: Narrow app-truth gates active; active-baseline certification gate implemented
Source spec: `APP_TRUTH_ARCHITECTURE_V1_SPEC_2026-06-08.md`

## Current Phase 0 Artifacts

- `docs/architecture/APP_TRUTH_ARCHITECTURE_INDEX.md`
- `docs/architecture/APP_TRUTH_PHASE0_INVENTORY_2026-06-08.md`
- `docs/handoffs/NEXT_SESSION_PHASE0_APP_TRUTH_GUARDRAIL_2026-06-08.md`

## Phase 0 Guardrail

Historical guardrail from the planning handoff:

Only Phase 0 was approved before the architecture index/inventory review.

Current session state has moved past that guardrail into narrow app-truth implementation gates:

- boot-safe Status projection
- active baseline/Data active-week alignment
- Performance selected runtime Basket parity
- weekly lifecycle visibility
- static scheduler cron register
- durable scheduler/materialization run receipts
- generic active-baseline receipt certification

Still not authorized:

- IndexedDB rewrite
- broad Data cache implementation
- Performance payload optimization
- cron cadence changes
- visual redesign
- canon regeneration
- release tagging
- baseline retirement

## Objective

Make Limni reliable enough for verification-stage work:

- load once after a new namespace/version
- keep frozen historical truth usable across navigation and login/logout
- refresh only live/current data in the background
- keep Data and Performance on the same active baseline
- make weekly rollover/freeze/materialization inspectable
- make Performance Summary/Basket/exports/parity consume the same trade rows
- prevent old page-local fetch/cache paths from silently driving active UI

## Target User Experience Walkthrough

This is the target behavior before implementation starts. It is the user-facing acceptance model for the phases below.

### First Load After A New Truth Namespace

When Freedom opens the app after a data/source/engine namespace changes:

1. Status remains reachable immediately.
2. The app may show a short route readiness state for Data or Performance.
3. The readiness text is plain and specific, for example:
   - `Preparing active baseline`
   - `Checking source freeze ledgers`
   - `Preparing Performance trade rows`
4. The app does not show broad internal walls of missing-week diagnostics on the main page.
5. Once the required route truth is known, the route either renders trusted data or a consistent degraded/blocked state.
6. The first load is allowed to be slower because frozen bundles or ledgers may need to hydrate.

### Normal Navigation After First Load

After a valid namespace has loaded once:

1. Data -> Performance -> Data should not reload all frozen closed-week history.
2. Performance tab switches should not refetch broad historical payloads.
3. Week/model/risk-overlay changes use already-known active baseline/domain state where available.
4. Live overlays can refresh in the background without blanking closed historical truth.
5. Logout/login clears private session/account state, not public frozen market/performance truth.

### Data Page

In active verification mode:

1. Data shows the same active weeks as Performance.
2. For clean14, Data active options equal the 14 active clean14 weeks.
3. Older weeks are available only through an explicit Archive/History mode.
4. A missing source freeze ledger blocks or degrades the relevant closed week; it does not silently use live/current fallback.
5. Source timestamps are shown from the frozen source ledger for closed weeks.
6. Current/open week is marked live or in progress and cannot count as frozen truth.

Expected Data failure behavior:

- If live/current refresh fails, closed active weeks remain visible.
- If a closed week ledger is missing, the week is flagged missing/degraded.
- If Archive data is unavailable, active verification mode remains unaffected.

### Performance Page

Performance has one selected truth context at a time:

- active baseline
- selected week
- signal model
- execution model
- risk overlay
- selected execution ledger
- selected trade-row ledger

Expected behavior:

1. Summary, sidebar, charts, Basket, exports, and drilldown agree on the selected truth context.
2. Switching strategy/execution/risk/week updates every surface atomically.
3. There is no state where the sidebar shows full ready stats while the main panel says the runtime is missing.
4. Missing rows are not displayed as valid `0.00%`.
5. Valid zero trades are explicitly different from missing trade rows.
6. If a selected runtime is unavailable, every Performance surface shows the same unavailable/degraded state.

### Basket

Basket is a verification surface, not a separate calculator.

For a closed active week:

1. Basket rows come from the same selected trade-row ledger as Summary/sidebar/export/parity.
2. Basket header P/L equals the sum of visible selected trade rows.
3. Engine trade count equals selected trade-row count.
4. Pair rows open into fills without changing the source of truth.
5. Pair Fill Cap displays active fill state and cap violations from ledger rows, not inferred UI math.
6. If rows are missing, Basket says rows are missing/degraded; it does not show an empty valid basket.

For all-time Basket:

1. It uses the active baseline bundle/ledger set.
2. It does not lazy-page closed-week canon in active verification mode.
3. Archive all-time browsing is allowed only if explicitly labelled Archive/History.

For current/open week Basket:

1. It is live overlay only.
2. It is labelled as current/incomplete.
3. It cannot satisfy closed-week historical readiness.
4. Live failure does not alter closed-week Basket data.

### Trade Drilldown And Exports

1. Opening a trade drilldown uses the same selected trade-row ledger as Basket and Summary.
2. Drilldown warnings show missing execution rows, capped result sets, or live/research origin clearly.
3. Exports include the same rows the UI is verifying.
4. If an export cannot prove the selected ledger identity, it is blocked or labelled degraded.

### Weekly Rollover

Weekly rollover should feel calm and inspectable.

When a new week opens:

1. The old current week does not automatically become trusted closed history.
2. The old week enters a lifecycle state such as `source_collection`, `source_snapshot_locked`, `freeze_ledger_written`, `data_materialized`, `performance_materialized`, then `closed_ready`.
3. Until required inputs are present, the old week is shown as pending/degraded, not empty.
4. The new week appears as current/open/live overlay.
5. Closed historical weeks remain visible from cache while the new week is being collected.
6. Materialization jobs publish run receipts showing inputs, outputs, missing inputs, namespace, status, retries, and degraded reasons.
7. When the old week reaches `closed_ready`, Data and Performance both see it through the same manifest/lifecycle update.
8. The app fetches or materializes only the newly closed week delta, not the whole frozen history.

### Cron And Live Refresh Failures

1. Cron jobs do not own UI truth.
2. Cron success is not treated as proof unless a scheduler/materialization run ledger exists.
3. COT/Sentiment/Strength/news/price live refresh failures do not invalidate closed history.
4. Freeze/materialization failures are visible in Status.
5. A failed live overlay may show stale/live-degraded current data while closed active weeks remain trusted.

### Status Page

Status is the escape hatch.

It should render even if Data and Performance fail, and should show:

- live/stable release id
- candidate/local release id
- active baseline id and weeks
- Data domain readiness
- Performance domain readiness
- weekly lifecycle state
- source freeze ledger state
- selected execution/trade-row ledger state
- cache namespace comparisons
- legacy fallback usage
- scheduler/materialization run receipts
- current/live overlay health
- promotion blockers

### Version Badge / Popover

The badge/popover should explain what app the user is actually looking at:

1. Live/stable release and local/candidate release are separate.
2. It says whether the candidate changes UI only or changes data/cache namespaces.
3. It lists unresolved gates and blockers.
4. It shows whether legacy fallbacks were used.
5. It does not imply local dev and production are the same artifact.

### What Freedom Should Notice When This Is Done

- First load after a real namespace change may take time.
- Second load and route navigation should feel materially faster.
- Closed-week data should not disappear because live data failed.
- Data and Performance should stop disagreeing about what active weeks exist.
- Basket should become a reliable trade-row verification surface.
- Weekly rollover should show a visible lifecycle, not mysterious empty or future-dated states.
- Status should answer "what is broken and why" without requiring browser devtools.

## Implementation Order

Use this order:

```text
inventory/docs
kernel contract
boot-safe Status
version namespaces
active baseline
lifecycle visibility
Performance ledger parity
atomic selection
scheduler/materialization state machine
durable cache
version popover
cleanup/extension
```

Do not start with IndexedDB.

Do not start with broad Performance payload optimization unless that optimization is required to expose the single selected execution/trade-row truth.

## First Code Steps After Phase 0 Acceptance

These are the first implementation steps if Freedom approves moving from Phase 0 docs into Phase 1 code. They are intentionally small and reversible.

### Step 1 - Add Shared Truth Types Only

Add a small app-truth module, likely under `src/lib/appTruth/`, with types/interfaces only:

- `RouteTruthContract`
- `RouteTruthSnapshot`
- `DomainReadinessSnapshot`
- `ActiveBaselineSnapshot`
- `WeeklyLifecycleSnapshot`
- `LegacyPathUsage`
- `NamespaceComparison`

This step should not change route behavior, fetch behavior, cache behavior, cron behavior, or UI rendering.

Acceptance:

- TypeScript passes.
- No route starts using new truth as authority yet.
- Status and implementation docs can point to the same field names.

### Step 2 - Add Boot-Safe Status Projection

Add a read-only Status projection that composes current known evidence into the shared truth shape:

- release/candidate identity from existing version manifest
- current active baseline placeholder or explicit `missing`
- Data readiness from existing Data/source-freeze evidence
- Performance readiness from existing kernel inventory and selected runtime metadata
- legacy path register entries from the Phase 0 inventory
- scheduler/materialization ledger status as `missing_contract` until durable receipts exist

This may add a compact Status section, but should not change Data or Performance runtime behavior.

Acceptance:

- `/status` still renders when Data/Performance are broken.
- `/status` shows Data and Performance separately.
- `/status` shows legacy fallback contract status rather than hiding it.

### Step 3 - Instrument Legacy Path Usage Passively

Add passive reporting hooks/counters for legacy path usage where it is safe:

- monolithic canon preload
- `strategy-page-data`
- `engine-stats`
- `basket/closed-history`
- Data `includeAllReports`
- global preload stamp trust

This should report only. It should not block or redirect behavior yet.

Acceptance:

- Status can say whether a legacy path was used in the current browser/session or latest server request where available.
- No user-facing Data/Performance behavior changes.

### Step 4 - Define Active Baseline Contract Before Moving Data

Define the active baseline shape and current clean14 expectation:

- baseline id
- active closed weeks
- current/open week
- archive availability
- required source freeze ledger status

This still may be a static/derived contract at first. It becomes authoritative only after review.

Acceptance:

- Status can show the active baseline and whether Data/Performance match it.
- Data route has not yet been migrated to use it.

### Step 5 - Only Then Touch Data/Performance Behavior

After the above is visible and reviewed:

1. Move Data active week options to the active baseline contract.
2. Make Performance selected truth context a single object.
3. Migrate sidebar stats to selected Performance truth instead of `/api/performance/engine-stats`.
4. Migrate Basket to selected trade-row ledger source.
5. Add Playwright coverage for navigation, selector switching, Basket mismatch, and Status survivability.

What not to do in the first code step:

- no IndexedDB rewrite
- no cron cadence change
- no visual redesign
- no Simulation rewrite
- no Basket hierarchy expansion
- no Matrix/Flagship reactivation
- no canon regeneration
- no release promotion

## Phase 0 — Planning Lock And Stale-Path Containment

Goal: stop new drift before touching app behavior.

Deliverables:

- canonical architecture index
- superseded banners on old docs
- architecture inventory table
- legacy path register
- route/domain truth inventory
- no-new-page-fetch rule
- no-new-page-local-cache rule
- no-new-invisible-fallback rule

Inventory table columns:

```text
route/page
domain
data entity
frozen/live/private classification
current fetch owner
current cache owner
kernel/preloader involvement
manifest/namespace used
fallback path
legacy risk
replacement owner
migration status
deletion gate
acceptance test
Status diagnostic required
```

Definition of done:

- Every Data and Performance historical fetch/cache path is listed.
- Every legacy fallback has an owner and deletion gate.
- Old authoritative docs are marked superseded.
- One current architecture index exists.
- No implementation starts from stale docs.

## Phase 1 — Kernel / Preloader Responsibility Contract

Goal: define the control plane before changing domain behavior.

Kernel exposes:

- release/candidate identity
- active baseline id
- route truth requirements
- domain readiness snapshot
- namespace comparison
- weekly lifecycle snapshot
- degraded reasons
- legacy fallback usage
- safe-render decision

Route Truth Contract:

```text
Route: Data
Required:
  active baseline manifest
  Data domain manifest
  frozen source ledger readiness for closed active weeks
Allowed degraded:
  live/current overlay failed

Route: Performance
Required:
  active baseline manifest
  Performance domain manifest
  selected execution ledger
  selected trade-row ledger
Allowed degraded:
  live/current overlay failed

Route: Status
Required:
  boot-safe kernel diagnostics only
Allowed degraded:
  Data failed
  Performance failed
```

Definition of done:

- Kernel can say what each major route requires.
- Preloader cannot release a route as trusted without required truth.
- Status route is never blocked by Data/Performance hydration failure.
- No page decides week readiness independently.

## Phase 2 — Boot-Safe Status Diagnostics

Goal: make truth visible before fixing everything.

Minimum Status visibility:

- live/stable release
- candidate/local release
- active baseline
- domain readiness
- route readiness
- weekly lifecycle state
- cache namespace comparison
- missing freeze ledgers
- missing execution ledgers
- missing trade rows
- legacy fallback usage
- last successful frozen load source
- live overlay status
- promotion blockers

Definition of done:

- Status renders when Data fails.
- Status renders when Performance fails.
- Status shows active baseline.
- Status shows Data/Performance readiness separately.
- Status shows whether any legacy path or fallback was used.
- Status shows whether a route is blocked, degraded, or safe.

## Phase 3 — Version Namespace Model

Goal: prevent UI deploys from invalidating frozen truth and prevent data changes from preserving stale truth.

Required namespace dimensions:

- `liveReleaseId`
- `candidateReleaseId`
- `appShellVersion`
- `uiVersion`
- `baselineWindowId`
- `sourceContractVersion`
- `sourceSnapshotNamespace`
- `sourceFreezeLedgerNamespace`
- `dataMaterializationNamespace`
- `engineLogicVersion`
- `executionLogicVersion`
- `riskOverlayVersion`
- `tradeRowSchemaVersion`
- `performanceMaterializationVersion`
- `domainBundleVersion`

Definition of done:

- Kernel can compare active namespaces.
- Status can show namespace match/mismatch.
- UI-only changes are distinguishable from data-affecting changes.
- Data-affecting changes identify affected domains only.

## Phase 4 — Shared Active Baseline Manifest

Goal: force Data and Performance into the same active verification universe.

For clean14:

```text
Data active weeks === Performance active weeks
```

Definition of done:

- Data active mode exposes only clean14 weeks.
- Performance active mode exposes the same clean14 weeks.
- Archive weeks are visually separated.
- Archive weeks cannot silently affect active verification metrics.
- Status shows active baseline and archive availability.

## Phase 5 — Weekly Lifecycle Ledger Visibility

Goal: make rollover/freeze/materialization state explicit.

Lifecycle states:

```text
week_open
source_collection
source_snapshot_locked
freeze_ledger_written
data_materialized
performance_materialized
closed_ready
degraded
blocked
```

Scheduler / Materialization Run Ledger status:

- First durable receipt contract implemented in code.
- Tables: `app_truth_scheduler_run_ledger`, `app_truth_materialization_run_ledger`.
- Status displays recent receipt rows.
- Initial producer coverage: canonical refresh, performance refresh, strategy artifacts, ADR trade scan.
- Source-freeze build script now emits receipts for `source_freeze_ledger`.
- Status now separates legacy evidence readiness from receipt-backed closed readiness.
- Generic active-baseline certification now audits the active manifest and writes receipts only when source-freeze, weekly-return, and strategy-shard rows satisfy expected keys.
- Clean14 certification result: source-freeze `14/14`, weekly returns `1008/1008`, visible strategy shards `168/168`.
- Active baseline comparison tolerates extra archive/stale kernel weeks after all required active weeks match; extra weeks remain visible on Status and do not block the active baseline.
- Data and Performance route pages now read receipt-backed active-baseline readiness before their heavier route payloads load.
- The route gate is invisible when ready and blocks the route when source-freeze, Data materialization, or Performance materialization receipts are missing/degraded.
- Evidence: `releases/v2/screenshots/route-readiness-2026-06-09/`.
- Remaining work: Data/Performance DomainManifest plus selected ExecutionLedger / TradeRowLedger identity.

Definition of done:

- Closed weeks show source freeze ledger status.
- Current week shows live overlay status.
- Data and Performance consume the same active-baseline lifecycle receipt state.
- Missing freeze ledger blocks trusted closed-week display.
- Materialization failures are visible in Status.
- Cron/materialization jobs produce inspectable run receipts.

## Phase 6 — Performance Execution / Trade-Row Source Unification

Goal: fix Basket, Summary, Research, exports, and parity to read the same selected truth.

Selected Performance state resolves to:

- `selectedBaseline`
- `selectedWeek`
- `selectedSignalModel`
- `selectedExecutionModel`
- `selectedRiskOverlay`
- `selectedRuntime`
- `selectedExecutionLedgerId`
- `selectedTradeRowLedgerId`

Status after 2026-06-09 selected Basket gate:

- Selected runtime trade-row bundles now carry compact deterministic execution/trade-row ledger IDs.
- Performance Basket requires the selected runtime trade-row bundle and no longer silently falls back to `basketDataSource` closed-history state.
- Basket exposes selected ledger IDs and row count as DOM evidence.
- Verified route: `/performance?view=basket&strategy=tandem&f1=adr_grid&f2=pair_fill_cap`.
- Evidence: `releases/v2/screenshots/selected-trade-row-ledger-2026-06-09/`.
- Remaining work: Summary, exports, drilldown, Research, and parity must consume/prove the same selected ledger identity.

Definition of done:

- Summary trade count equals selected trade-row count.
- Summary P/L equals sum of selected trade rows.
- Basket rows equal selected trade rows. Started for active Basket view.
- Exports equal selected trade rows.
- Research/drilldown equals selected trade rows.
- Parity tests use selected trade rows.
- Missing rows never display as valid zero.

## Phase 7 — Atomic Performance Selection State

Goal: eliminate split-brain UI.

Changing any selector must atomically move all Performance surfaces:

- signal model
- execution model
- risk overlay
- week
- metric
- runtime

Definition of done:

- No stale sidebar with unavailable main panel.
- No Basket from old selection while Summary uses new selection.
- No full stats shown when selected runtime is missing.
- Unavailable runtime produces one consistent degraded state.
- Detailed missing-week diagnostics move to Status/details.
- Test the observed failure: ADR Grid / Pair Fill Cap to Weekly Hold switching.

## Phase 8 — Central Rollover / Freeze / Materialization State Machine

Goal: make weekly progression explicit and scheduler-driven.

The state machine owns:

- source collection
- COT capture
- Sentiment/Strength lock
- source freeze ledger writing
- Data materialization
- Performance materialization
- execution/trade-row materialization
- `closed_ready` promotion
- backfill/retry

Cron policy:

```text
COT:
  keep hourly baseline
  add 5-minute Friday release-window burst if safe

Sentiment/Strength:
  keep normal cadence
  add 5-minute Friday lock-window burst if safe

Live overlays:
  5-minute acceptable if provider/cost safe

Freeze/materialization:
  trigger after required inputs exist
  hourly retry/backfill

Performance/strategy artifacts:
  trigger after source freeze readiness
  hourly fallback
```

Definition of done:

- Cron does not invalidate frozen UI.
- Live overlay failure does not blank closed history.
- New closed weeks appear through manifest/lifecycle delta.
- Materialization waits for required source inputs.
- Backfill/retry state is visible in Status.

## Phase 9 — Durable Browser Persistence

Goal: deliver the load-once experience.

Only start this after truth paths are stable.

Storage split:

```text
Memory:
  current session fast path

IndexedDB:
  frozen bundles
  materialized ledgers
  large domain payloads

localStorage:
  tiny namespace stamps
  manifest ids
  last-known selected baseline

server/CDN/runtime:
  accelerator only
```

Definition of done:

- First load after namespace change may be slow.
- Second load uses valid local/domain cache.
- Data -> Performance -> Data does not reload frozen history.
- Logout clears private/session data only.
- Logout preserves public frozen market/performance data.
- Stale IndexedDB bundle is rejected by namespace/fingerprint mismatch.
- UI-only deploy does not invalidate frozen bundles.

## Phase 10 — Version Badge / Popover

Goal: make release identity truthful.

Popover shows:

- live/stable release
- candidate/local release
- active baseline
- domain namespace impact
- UI-only vs data-affecting
- pending gates
- failed gates
- promotion eligibility
- legacy fallback status

Definition of done:

- Local candidate is not presented as live stable.
- UI-only vs data-affecting change is visible.
- Blocked gates are visible.
- Data/cache namespace impact is visible.

## Phase 11 — Final Cleanup And Extension

Goal: remove remaining fallback paths and extend the pattern.

After Data and Performance pass:

- delete stale compatibility fallbacks
- delete replaced page fetches
- delete duplicate page-local caches
- delete stale preload tasks
- update handoff/release docs
- extend pattern to Accounts, Automation, Research, Documents, Agents, News

Definition of done:

- Migrated Data/Performance routes cannot be populated by legacy page fetches.
- Status shows zero invisible fallbacks.
- Architecture index points to current specs only.
- Superseded docs remain historical, not authoritative.

## Promotion Gate For v2.0.3-clean14

The candidate remains blocked until:

- Data active weeks equal Performance active weeks.
- Archive weeks are not in active mode.
- Closed weeks have visible freeze ledgers.
- Current week is live overlay.
- Status survives Data/Performance failure.
- Basket/Summary/export/parity use the same trade rows.
- Performance selection switching is atomic.
- Missing vs zero is explicit.
- Navigation does not reload frozen history after valid cache.
- Cron/live overlay failure does not blank frozen closed weeks.
- Version badge separates stable vs candidate.
- Migrated routes cannot be populated by legacy page fetches.

## Human Breakdown

What changed: this plan turns the reviewed architecture into phased implementation gates and records the completed scheduler/materialization receipt, active-baseline certification, route-readiness, and selected Basket ledger gates.

Why it matters: the clean14 unblock is now proved through generic baseline/materialization receipts, and Data/Performance route shells consume those receipts before trusting route data.

What passed/failed: Status can show receipt-backed clean14 closed readiness `14/14`; `/dashboard` and `/performance` gate-ready checks pass `14/14`; Basket uses selected rows with no closed-history fallback request; Summary/export/drilldown/parity still need selected ledger proof.

Next gate: selected ExecutionLedger / TradeRowLedger proof for Performance Summary and exports, then drilldown/parity.
