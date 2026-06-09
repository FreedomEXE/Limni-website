# App Truth Architecture v1 Spec

> Post-review architecture spec. This document does not authorize implementation, canon regeneration, release tagging, or retirement of any existing baseline.

Date: 2026-06-08
Status: Draft for implementation planning after review
Supersedes: `APP_DOMAIN_CACHE_ARCHITECTURE_V1_SPEC_2026-06-08.md`

## 1. Verdict

The approved direction is:

> App truth architecture with domain-owned caches.

The earlier domain-cache framing was directionally useful but incomplete. Cache is not the core. The core is:

- one authoritative active baseline/window
- one authoritative weekly lifecycle state machine
- one authoritative source freeze ledger
- one authoritative execution/trade-row ledger per selected Performance runtime/week
- domain manifests and diagnostics
- pages as renderers, not owners of truth

## 2. Current Promotion Blockers

The current candidate cannot be promoted while these are true:

- Data and Performance do not share the active baseline/window.
- Data active mode can expose archive-era weeks that are outside clean14.
- June weekly rollover/freeze/materialization state is inconsistent.
- Performance Basket/drilldown does not read the same trade-row source as Summary/sidebar.
- Performance selection switching can show split-brain ready/unavailable states.
- Version badge/popover does not cleanly separate live/stable release from local pending candidate.

## 3. Authoritative Records

The app needs explicit authoritative records before expanding persistent caching:

- `ReleaseManifest`: live/stable and candidate identity.
- `ActiveBaselineManifest`: active verification window and included weeks.
- `WeeklyLifecycleLedger`: week open/current/closed/frozen/materialized state.
- `FrozenSourceLedger`: source snapshots and provenance for closed weeks.
- `ExecutionLedger`: selected strategy/runtime/week execution output.
- `TradeRowLedger`: exact trade rows consumed by Summary, Basket, Research, exports, and parity tests.
- `DomainManifest`: per-domain namespace, fingerprint, readiness, and cache identity.
- `RouteTruthContract`: route-level requirements before trusted render.
- `SchedulerRunLedger` / `MaterializationRunLedger`: cron/materialization receipts proving inputs, outputs, namespaces, status, retries, and degraded reasons.
- `LegacyPathRegister`: old fetch/cache/preload/fallback paths, replacement owner, migration status, and deletion gate.

Domain stores consume these records. Pages do not infer readiness independently.

### 3.1 Route Truth Contract

Purpose:

> Define what each route requires before it can render trusted data.

Without this, the preloader can become vague again.

Minimum examples:

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

Rules:

- Kernel can say what each route requires.
- Preloader cannot release a route as trusted without required truth.
- Status route is never blocked by Data/Performance hydration failure.
- No page decides week readiness independently.

### 3.2 Scheduler / Materialization Run Ledger

Purpose:

> Prove what cron/materialization produced, from which inputs, under which namespace.

Without this, weekly lifecycle still depends on assumptions.

Minimum fields:

```ts
type SchedulerRunLedgerRecord = {
  jobId: string;
  jobType: string;
  triggerType: "schedule" | "manual" | "dependency-ready" | "retry" | "backfill";
  scheduledAtUtc: string | null;
  startedAtUtc: string;
  completedAtUtc: string | null;
  inputArtifacts: string[];
  requiredInputs: string[];
  missingInputs: string[];
  outputArtifacts: string[];
  namespaceProduced: string | null;
  status: "running" | "succeeded" | "failed" | "degraded" | "skipped";
  retryPolicy: string | null;
  backfillStatus: string | null;
  degradedReasons: string[];
};
```

Rules:

- Cron is not proof of freshness by itself.
- Cron/materialization jobs must produce inspectable receipts.
- Status must show recent run state for source freeze, Data materialization, Performance materialization, and trade-row materialization.

### 3.3 Legacy Path Register

Purpose:

> Track old fetch/cache/preload/fallback paths, their replacement, and deletion gate.

Without this, legacy paths will survive and create split-brain state again.

Minimum fields:

```ts
type LegacyPathRegisterEntry = {
  legacyPathName: string;
  category: "fetch" | "cache" | "preload" | "fallback" | "doc" | "route";
  reasonItExists: string;
  currentSurfaces: string[];
  replacementOwner: string;
  migrationStatus: "delete-now" | "quarantine" | "temporarily-allowed" | "still-authoritative" | "unknown";
  deletionGate: string;
  statusDiagnosticRequired: string;
};
```

Rules:

- Every fallback must be Status-visible.
- Every compatibility path must have a deletion gate.
- Migrated Data/Performance routes cannot be populated by page-local historical fetches or invisible fallbacks.

## 4. Active Baseline Manifest

Data and Performance must share one active baseline/window manifest.

Minimum shape:

```ts
type ActiveBaselineManifest = {
  baselineId: string;
  activeWeeks: string[];
  sourceNamespace: string;
  performanceNamespace: string;
  engineNamespace: string;
  executionLedgerNamespace: string;
  generatedAtUtc: string;
  approvalStatus: "draft" | "under-review" | "approved" | "blocked";
  archiveAvailable: boolean;
};
```

Rule:

> If Performance says `14 WEEKS TRACKED`, Data active mode must expose that same active week set, not broader archive history.

Archive/history can exist only as an explicit mode and must be visually separated from active verification.

## 5. Weekly Lifecycle Ledger

Weekly rollover must be centralized.

Recommended lifecycle:

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

Minimum shape:

```ts
type WeeklyLifecycleRecord = {
  weekId: string;
  calendarStartUtc: string;
  calendarEndUtc: string;
  status: string;
  sourceFreezeStatus: string;
  sourceLedgerId: string | null;
  dataMaterializationStatus: string;
  performanceMaterializationStatus: string;
  executionLedgerId: string | null;
  missingInputs: string[];
  degradedReasons: string[];
  lastUpdatedAtUtc: string;
};
```

Rules:

- Closed weeks require frozen source ledger visibility.
- Current/open week is live overlay.
- Data and Performance must consume the same lifecycle state.
- Pages must not infer whether a week is ready.

## 6. Performance Ledger Parity

For a selected strategy/runtime/week:

> Summary, Basket, Research/drilldown, exports, and parity tests must consume the same execution ledger and trade-row ledger.

Acceptance rules:

- Summary trade count equals selected trade-row count.
- Summary P/L equals sum of selected trade rows.
- Basket rows equal selected execution ledger rows.
- Exports equal visible selected trade rows.
- Parity fixtures equal the same selected trade rows.
- Missing rows must not display as valid zero rows.

The app must distinguish:

- valid zero trades
- missing execution ledger
- missing trade rows
- failed materialization
- stale cached state
- partial materialization

## 7. Atomic Performance Selection State

Changing any selector must atomically update every Performance surface:

- signal model
- execution model
- risk overlay
- week
- metric
- runtime

Affected surfaces:

- sidebar
- summary
- charts
- basket
- drilldown
- warnings
- exports
- diagnostics

If the selected runtime is unavailable, all surfaces show the same unavailable/degraded state. Internal missing-week/stale-version details belong in Status/details, not as a wall of main-page text.

## 8. Domain Stores

Domain stores remain the right implementation boundary, but only after authoritative records are defined.

Initial critical domains:

- Status
- Baseline/Manifest
- Data / Market Intelligence
- Performance

Later domains:

- Accounts
- Automation
- Research Lab
- Documents
- Agents
- News

Every domain should eventually expose:

- manifest
- readiness
- active namespace
- cache source
- degraded reasons
- last good version
- active version
- live overlay status where applicable

## 8.1 Kernel / Preloader Control Plane

The existing kernel/preloader/versioning structure should not be bypassed or duplicated.

It should become the app truth control plane:

```text
Version manifests define identity and namespace.
Baseline manifests define the active verification window.
Kernel coordinates readiness and safe rendering.
Preloader executes route/domain readiness policy.
Domain stores own data, hydration, cache, selectors, and live overlays.
Status displays kernel/domain truth and survives failures.
Pages render selectors only.
```

Kernel responsibilities:

- active release/candidate identity
- active baseline/window selection
- route-to-domain requirements
- domain namespace comparison
- readiness decisions
- degraded/error aggregation
- weekly lifecycle visibility
- diagnostic publication
- safe-render decisions

Kernel non-responsibilities:

- raw Performance data
- raw Data/Market Intelligence payloads
- trade rows
- source ledgers
- account/news/research payloads
- domain-specific cache internals
- page rendering state

Preloader responsibilities:

- resolve route requirements through the kernel
- check required domain manifests/namespaces
- hydrate valid frozen data through domain stores
- fetch missing/stale frozen data only when required
- release the route when required truth is known and consistent
- start live overlays after frozen truth is usable
- never block Status diagnostics

Preloader anti-patterns:

- full historical preload on every route entry
- page-specific preload logic
- silently repairing or inventing truth
- hiding split-brain data
- blocking closed history because a live overlay failed
- allowing page fetches to bypass domain truth after migration

Preloader success means:

> The required truth for this route is known, valid, and consistently exposed.

It does not mean:

> Some async tasks finished.

## 8.2 Cron / Scheduler Role

Cron and scheduled jobs are part of the truth architecture, but they are producers of artifacts and lifecycle transitions, not UI truth owners.

Cron must be split by responsibility:

1. Live/source ingestion refreshers
   Examples: COT refresh, sentiment refresh, strength refresh, prices, news, market snapshots.

2. Freeze/materialization jobs
   Examples: source freeze ledger writing, Data materialization, Performance/execution/trade-row materialization.

3. Operational jobs
   Examples: bot status, account/broker sync, scans, backfills.

Observed current schedule shape as of 2026-06-08:

- COT refresh: hourly, plus 10-minute bursts Friday/Monday `19-23 UTC`.
- Prices refresh: hourly.
- Sentiment refresh: hourly.
- Currency strength and asset strength: hourly.
- Market snapshots: hourly.
- Performance refresh: hourly.
- Strategy artifacts/materialization: hourly.
- News: every 15 minutes.
- Bitget bot: every minute.
- A current source-freeze build command exists, but weekly source-freeze/materialization must be made explicit in the truth lifecycle rather than assumed from page behavior.

Required rule:

> Cron freshness is not page cache invalidation.

Cron should update live overlays and materialize new frozen artifacts. It should not cause every page to reload closed historical data.

For the desired user experience:

```text
first load for a new namespace may take time
then frozen data stays available from local/domain cache
new live/current data refreshes in the background
newly closed weeks are added as small manifest/delta updates
route navigation does not reload all frozen history
```

Cadence decision:

- Do not blindly change every hourly cron to every 5 minutes.
- Use 5-minute cadence only where freshness matters and rate/cost limits allow it.
- Recommended candidate policy:
  - COT: 5-minute burst after the known Friday 3:30 PM ET release window until the new report is observed, with hourly fallback outside the burst.
  - Sentiment/Strength: 5-minute burst around the Friday 5:00 PM ET lock window, with hourly or normal cadence outside that window.
  - Live overlays/current-week views: 5-minute refresh can be acceptable if provider limits/cost are safe.
  - Freeze/materialization: trigger immediately after required source inputs are present, with hourly retry/backfill.
  - Performance/strategy artifact materialization: trigger after source freeze ledger readiness, with hourly fallback.

Open decision:

> Whether to move any existing hourly cron to 5 minutes must be decided per job, based on freshness need, provider limits, cost, and whether the job updates live overlay or frozen materialization.

## 9. Namespace Taxonomy

Use explicit namespace dimensions. Do not invalidate all frozen data on every deploy.

Recommended dimensions:

- `appShellVersion`
- `uiVersion`
- `sourceContractVersion`
- `sourceSnapshotNamespace`
- `baselineWindowId`
- `engineLogicVersion`
- `executionLogicVersion`
- `riskOverlayVersion`
- `tradeRowSchemaVersion`
- `performanceMaterializationVersion`
- `domainBundleVersion`

Rules:

- UI-only change: no frozen data invalidation.
- Execution logic change: invalidate Performance materialization/trade rows, not necessarily raw Data/source ledgers.
- Source parser/snapshot semantics change: invalidate Data/source namespace and downstream Performance as needed.

## 10. Cache Position

Durable cache is important, but not first.

Storage model after truth records are stable:

- Memory: fast session access.
- IndexedDB: large frozen bundles and materialized ledgers.
- localStorage: small manifests and namespace stamps only.
- Server/runtime/CDN: accelerator, not authority.

IndexedDB is not authoritative truth. It may cache a bundle only when its namespace/fingerprint matches the active manifest.

Logout clears private/session data, not public frozen market/performance data.

## 11. Status Requirements

Status is the diagnostic escape hatch and must survive app data failures.

Status should answer:

- What baseline is active?
- What domains are ready?
- Which cache namespaces are active?
- Which weeks are frozen?
- Which weeks are missing ledgers?
- Which materializations failed?
- Which selected runtime is unavailable?
- Was data loaded from memory, IndexedDB, server, network, or fallback?

Status must not depend on successful Performance/Data hydration.

## 12. Version Badge / Popover

Version UI must separate:

- live/stable release
- local/candidate release

Popover should show:

- live release
- candidate release
- active baseline
- domain namespace impact
- pending gates
- failed gates
- whether the change is UI-only or data-affecting

Do not force local dev and live production to share one release identity.

## 13. Implementation Order

Do not begin with durable Data cache.

Recommended order:

1. Architecture inventory and stale-path audit.
2. Canonical architecture index and immediate doc supersession banners.
3. Kernel/preloader responsibility definition.
4. Boot-safe Status diagnostics for kernel/domain truth.
5. Version namespace model and live/candidate identity model.
6. Shared Active Baseline Manifest.
7. Data/Performance active baseline alignment.
8. Weekly Lifecycle Ledger visibility.
9. Performance execution/trade-row source unification.
10. Atomic Performance selection state.
11. Central rollover/freeze/materialization state machine, including cron/scheduler responsibilities.
12. Durable browser persistence with IndexedDB/localStorage manifests after truth is stable.
13. Release/candidate version popover using real kernel/version diagnostics.
14. Extend pattern to Accounts, Automation, Research, Documents, Agents, and News.
15. Final removal of remaining legacy fallbacks.

Cleanup must not wait until the end:

- Before implementation: inventory, quarantine risky paths, mark superseded docs.
- During each migrated domain: disable/remove replaced legacy paths.
- After acceptance tests: delete remaining compatibility fallbacks.

## 14. Non-Negotiable Acceptance Tests

Promotion-blocking tests:

1. Data active weeks equal Performance active weeks for clean14.
2. Archive weeks are accessible only in explicit Archive/History mode.
3. Every closed active week has source freeze ledger and snapshot timestamp.
4. Current/open week is live overlay and cannot blank closed history.
5. Data and Performance see the same weekly lifecycle transition.
6. Summary/Basket/export/parity trade rows agree.
7. Performance selector changes update every surface atomically.
8. Missing and valid zero states are visually and semantically distinct.
9. Route navigation does not refetch frozen bundles when namespaces match.
10. Logout preserves public frozen caches and clears private/session state.
11. UI-only deploy does not invalidate frozen historical data.
12. Data-contract changes invalidate only affected domains.
13. Status remains reachable during Data/Performance hydration failures.
14. Version badge truthfully separates live/stable and candidate/dev state.
15. Preloader does not invent truth: missing freeze ledgers or trade rows produce visible degraded/blocked states.
16. Legacy path detection: migrated Data/Performance routes cannot be populated by page-local historical fetches or invisible fallbacks.
17. Cron/live overlay failure does not invalidate or blank frozen closed-week data.
18. Newly materialized weekly data appears through manifest/lifecycle updates without reloading all frozen history.

## 15. Explicit Rejections

Reject:

- page-level duplicate fetch/cache/materialization logic
- page-level week readiness inference
- treating IndexedDB as authoritative truth
- invalidating all frozen data on every deploy
- combining current/open week into frozen history
- archive weeks inside active verification by default
- Summary and Basket reading different sources
- a generic all-domain cache framework before Data/Performance truth is fixed
- a full event-sourcing platform for the app

## Human Breakdown

What changed: this spec incorporates external review and reframes the work as app truth architecture, not cache architecture.

Why it matters: caching wrong truth would make the app faster and less trustworthy.

What passed/failed: the domain-store direction passed review; implementation must start with manifests, diagnostics, lifecycle, and ledger parity before durable cache.

Next gate: turn this into a phased implementation plan only after Freedom approves the post-review spec.
