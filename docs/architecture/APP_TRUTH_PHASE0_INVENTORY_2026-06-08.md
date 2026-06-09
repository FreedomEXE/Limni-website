# App Truth Phase 0 Inventory

Date: 2026-06-08
Status: Phase 0 inventory, pending review
Scope: Data/Performance historical fetch, cache, preload, fallback, scheduler, and Status diagnostics containment

## Guardrail

This document began as inventory only. Later app-truth gates used it as the working register.

Not authorized:

- broad app/runtime code changes outside the named app-truth gates
- IndexedDB redesign
- Data cache implementation
- Performance payload optimization
- cron cadence changes
- UI redesign patches
- canon regeneration
- release tagging
- baseline retirement

## Evidence Notes

- The worktree was already dirty before this Phase 0 pass. This inventory does not classify prior code changes as Codex changes.
- `docs/FUTURE_UPGRADES.md` is referenced by `AGENTS.md` and older handoffs, but it is missing in the current repo state.
- The original recovery/guardrail said Phase 0 was approved only. Current session work has since advanced into narrow Status, baseline, Performance parity, lifecycle visibility, cron register, and scheduler/materialization receipt gates.

## Architecture Inventory

| Route/page | Domain | Data entity | Frozen/live/private | Current fetch owner | Current cache owner | Kernel/preloader involvement | Manifest/namespace used | Fallback path | Legacy risk | Replacement owner | Migration status | Deletion gate | Acceptance test | Status diagnostic required |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `/dashboard` | Data / Market Intelligence | COT, Sentiment, Strength, provenance, report options | Frozen closed weeks mixed with current/live week | `src/app/dashboard/page.tsx` calls `loadCachedMarketIntelligence("all", includeAllReports: true)` | Server `runtimeCache` key `marketIntelligence:*`, default 5 minutes; client memory store | `preloadRegistry` has `market-intelligence` active task, but no RouteTruthContract gate | No active baseline manifest; uses Data section weeks and source freeze ledgers where available | Current week is prepended and broad Data-section weeks come from `pair_period_returns` | Data active mode can expose archive weeks and route entry can reload all reports | Data domain store plus `ActiveBaselineManifest`, `FrozenSourceLedger`, `WeeklyLifecycleLedger` | Temporarily allowed | Data active mode uses the active baseline manifest and page no longer server-loads all historical reports on route entry | Data active weeks equal Performance active weeks for clean14; Archive weeks only in explicit Archive mode | Active baseline id, Data domain readiness, source freeze ledger coverage, archive-vs-active mode, fallback usage |
| `/api/dashboard/payload` | Data / Market Intelligence | Dashboard payload | Frozen/live mixed | API route calls `loadCachedMarketIntelligence()` | Server runtime cache only | None beyond caller | No route truth manifest | Request accepts `allReports=1` and returns historical payload on demand | `cache: no-store` client call treats frozen data as live page payload | Data domain materialization endpoint or domain bundle endpoint | Temporarily allowed | Replaced by versioned Data domain bundle or explicit whole-bundle endpoint with namespace | Repeated navigation does not refetch frozen closed-week Data when namespace matches | Payload source, namespace, cache source, active/archive mode |
| `src/lib/dashboard/marketIntelligenceStore.ts` | Data / Market Intelligence | Client Data store | Frozen/live mixed | Fetches `/api/dashboard/payload` | Memory-only store plus inflight map; no durable frozen cache | Preload can call it, but it reports no shared domain readiness contract | None | Hourly refresh timer calls same payload path | Logout/navigation/session can lose public frozen data; no namespace validation | Data domain store with readiness and durable public cache after truth records are stable | Temporarily allowed | Store exposes manifest/readiness/cache source and no longer owns active week universe independently | Logout preserves public frozen Data cache; live refresh failure does not blank closed weeks | Domain readiness, cache source, last good version, live overlay status |
| `src/lib/dataSectionWeeks.ts` | Data | Week/report universe | Frozen historical universe | SQL from `pair_period_returns` | Server runtime cache default 15 seconds | None | None | All weekly rows become Data options | Active verification window can drift from Performance clean14 | `ActiveBaselineManifest` and Archive manifest | Quarantine | Data active options come from active baseline, not broad `pair_period_returns`; broad list only feeds Archive mode | clean14 Data options exactly match Performance active weeks | Active baseline weeks, archive availability, source of week list |
| `src/lib/sourceFreeze/sourceLedger.ts` | Data / Source Truth | Frozen source ledger weeks and signals | Frozen closed-week truth | Ledger build/read functions and scripts | Database tables `source_freeze_ledger_weeks/signals` | Status reads recent summaries; Data/Performance consume ledger in source paths | `FRIDAY_FREEZE_LEDGER_VERSION`, release window strings | If missing, callers can still derive/live-resolve in some paths | Missing ledger may not consistently block trusted closed-week display | `FrozenSourceLedger` under weekly lifecycle | Still authoritative but incomplete as a route gate | RouteTruthContract requires closed active weeks to have trusted ledger before trusted Data/Performance display | Missing freeze ledger produces blocked/degraded state, not valid zero/current fallback | Per-week ledger status, trusted rows, incidents, missing inputs |
| `/performance` | Performance | Selected strategy runtime shell | Frozen closed-week Performance plus current/live overlay | `src/app/performance/page.tsx` mounts client with empty maps and `initialWeek` | Client stores and API payload caches after mount | `AppPreloadGate` and `PerformanceStrategyViewSection` start kernel/session work | Release manifest, canon version/cache namespace, strategy selection | Page can render unavailable text or stale sidebar state depending selected payload/session | Route shell is fast but truth readiness is split across kernel/session/payload | Performance domain store plus RouteTruthContract | Temporarily allowed | Route render waits on required selected execution/trade-row truth or shows one consistent degraded state | Selector switch cannot show ready sidebar with unavailable main panel | Route readiness, selected runtime id, selected ledger ids, degraded reason |
| `src/components/AppPreloadGate.tsx` | Kernel / Preloader | Route readiness gate | Control plane | Starts kernel, legacy canon, and strategy session preload | Local state; kernel/canon/session stores | Central but currently route-specific and mixed | Release manifest/cache namespace; no RouteTruthContract record | For `/performance`, `appHistoricalReady` is true by route before kernel ready; legacy canon fallback can start when kernel degrades/errors | Preloader can release route without proving required truth; old and new paths coexist | Kernel RouteTruthContract and domain readiness | Quarantine | Preloader releases Data/Performance only when required route truth is known, valid, and consistent; Status bypass remains boot-safe | Missing freeze ledger or missing trade rows blocks/degrades route visibly; Status remains reachable | Route requirements, readiness decision, legacy fallback used, namespace comparison |
| `src/lib/canon/canonKernelStore.ts` and `/api/canon/[version]/inventory|week` | Performance / Kernel | Active variant canon shard inventory and week shards | Frozen closed-week Performance history | Kernel fetches version, inventory, week shards | IndexedDB `weekShards`, `inventories`, `kernelMeta`; memory composed bundle | Existing kernel path | `releaseManifest.canonVersion`, `cacheNamespace`, per-shard hashes | Degraded path says legacy preload remains active | Kernel is useful but not yet app truth control plane for all route requirements | Kernel control plane plus Performance domain store | Temporarily allowed | Kernel owns route/domain requirements, active baseline, namespace compare, lifecycle snapshot, and safe-render decision | Kernel ready only when active baseline and selected route truth are complete | Kernel phase, total/ready/missing weeks, active baseline, route contract result |
| `src/lib/canon/canonStore.ts` and `/api/canon/[version]/historical` | Performance / Legacy canon | Monolithic release canon bundles | Frozen closed-week release canon | Legacy canon preload fetches all release variants | IndexedDB `bundles`/`meta`; memory bundles; `localStorage` manifest/namespace | AppPreloadGate can invoke it as fallback | `canonVersion`, `cacheNamespace`, variant hashes | Monolithic bundle fallback | Can reintroduce full historical preload and mask kernel gaps | Per-week kernel shards / domain bundle | Quarantine | Legacy monolithic path is either deleted or Status-visible fallback after kernel parity passes | Migrated Performance cannot be populated by monolithic fallback unless explicitly flagged degraded | Legacy canon fallback usage and deletion gate |
| `/api/performance/strategy-kernel-payload` | Performance | StrategyClientPayload for clean14 | Frozen closed-week runtime payload | API calls `loadStrategyPageData(... historyWindow: v2.0.3-clean14)` | Client memory payload cache; endpoint `Cache-Control: no-store` | Used by session store with `kernel: true` | `historyWindow` string, strategy artifact engine version | Can request `all-data-section` via query | Separate source from canon kernel inventory; can be complete while Basket/trade rows mismatch | `ExecutionLedger` and `TradeRowLedger` domain records | Temporarily allowed | Endpoint returns selected ledger ids and trade-row source, or is replaced by Performance domain bundle | Summary, Basket, exports, parity all match selected trade rows | Payload source, history window, selected ledger ids, missing rows vs valid zero |
| `/api/performance/strategy-page-data` | Performance / Legacy strategy payload | StrategyClientPayload broad history | Frozen/live mixed | API calls `loadStrategyPageData()` with default `data-section` window | Browser Cache Storage `limni-strategy-payload-v3`, localStorage meta, memory payload cache | Used when `useKernelPayload` is false | `GLOBAL_PRELOAD_CACHE_VERSION`, engine version | Persistent cache and artifact status repairs | Can silently preserve broad-history/deprecated payloads | Performance domain bundle / selected ledger endpoint | Quarantine | Not used by migrated Performance route; only explicit Archive/legacy diagnostic if retained | No `/api/performance/strategy-page-data` request during migrated Performance boot | Legacy payload cache presence, contract version, stale reason |
| `src/lib/performance/strategySessionStore.ts` | Performance / Preload | Strategy sessions, current-week, weekly returns | Frozen/live mixed | Calls strategy client payloads, current-week endpoint, matrix weekly returns | Client memory plus global preload stamp | AppPreloadGate invokes active and post-gate tasks | `GLOBAL_PRELOAD_CACHE_VERSION`; optional kernel payload | Background repairs, version checks, weekly returns no-store fetch | Hidden repairs/stamps can bypass route truth and blur live vs frozen | Performance domain readiness and live overlay store | Quarantine | No invisible background repair can mark trusted route ready; repairs become materialization run ledger entries | Status shows any repair/backfill and route remains degraded until ledger truth is complete | Preload phase, repair status, global stamp status, current-week live overlay |
| `/api/performance/engine-stats` and `StrategySidebar` | Performance / Sidebar legacy stats | Single-week and multi-week sidebar stats | Frozen/live mixed | Sidebar fetches endpoint outside `/performance`; endpoint recomputes `computeWeeklyHold()` and `computeMultiWeekHold()` | None beyond underlying runtime caches | Not part of current Performance kernel contract | Uses broad `listDataSectionWeeks()` universe | Recomputes stats independently from selected clean14 runtime | Can show all-time/sidebar stats from a different week universe and ledger source | Selected Performance summary from `ExecutionLedger` / `TradeRowLedger` | Quarantine | Sidebar stats are emitted from selected Performance domain state, not separate API recompute | Sidebar total return/trades/DD match selected runtime and baseline | Sidebar stats source, baseline id, selected ledger id |
| `/api/performance/report` and `PerformanceComparisonPanel` | Performance / Canonical report | Canonical performance report and flagships | Frozen release/candidate report | Client fetches `/api/performance/report`; route calls `getCanonicalPerformanceApiModel()` | Server runtime cache inside report readers | Not in route truth contract | Canonical report files/version state | Separate force-dynamic report surface | Can diverge from active clean14 runtime, selected trade rows, or candidate state | Performance domain report view backed by same active baseline or explicit Archive/Release mode | Temporarily allowed | Report panel labels whether it is active candidate, release archive, or unavailable; not used as selected Performance truth unless matching baseline | Report totals either match active baseline or are isolated as release/archive | Report source, release/candidate id, baseline id |
| `/api/performance/comparison` | Performance / Legacy comparison | Mixed-source comparison payload | Historical research/legacy | Legacy route reads snapshots/files/strategy histories | Mixed underlying stores | None | Legacy source keys and files | Explicit compatibility API | Can reintroduce mixed-source numbers into active Performance | Research/Archive-only comparison source | Quarantine | Not reachable from active Performance verification path | Active Performance makes no `/api/performance/comparison` requests | Legacy comparison usage and caller |
| `src/lib/basket/basketDataSource.ts` and `BasketHierarchy` | Performance / Basket | Closed-history basket rows | Frozen closed-week trade hierarchy | Reads canon kernel snapshot or legacy canon snapshot; API fallback still defined | Memory snapshot, closed-history promise map if API source used | Depends on kernel/canon stores | Strategy variant and scope only | API `/api/basket/closed-history` and legacy renderer fallback remain in code | Basket can show engine-header P&L while drilldown rows sum differently | `TradeRowLedger` shared by Summary/Basket/export/parity | Quarantine | Basket rows are selected trade rows; API fallback deleted or Status-visible | Basket row totals equal Summary/header P&L; missing rows do not display as 0.00% | Basket source, trade-row ledger id, mismatch flag, fallback usage |
| `/api/basket/closed-history` | Performance / Basket legacy API | Closed-history bundle | Frozen closed-week | Builds closed history on request | None beyond server runtime internals | None | Strategy variant/scope only | Direct force-dynamic API | Page-local historical fetch path can bypass kernel/domain truth | Performance trade-row/domain bundle | Quarantine | Deleted for migrated Performance or retained only as explicit Archive diagnostic | No request to `/api/basket/closed-history` during migrated active Performance | Legacy endpoint hit count and caller route |
| `/api/basket/weeks`, `/api/basket/week-pairs`, and `BasketAllTimeBrowser` | Performance / Basket legacy pagination | Paginated all-time Basket weeks/pairs | Historical archive | Component still contains no-store fetches; endpoints are quarantined and return 410 | None | None | Strategy variant, anchor, limit/offset | Disabled paginated path | Even disabled, component code can imply pagination is acceptable for closed-week canon | Whole-bundle/domain bundle or explicit Archive browser | Delete-now after reachability check | Component and endpoints removed or proven unreachable outside archived code | Source search and Playwright show no active all-time pagination path | Quarantined endpoint/component reachability |
| `/api/trades/drilldown` and `TradeDrilldownModal` | Performance / Trade drilldown | Parent trade rows and fills | Frozen backtest/simulation, live optional | Modal fetches no-store drilldown; route reads `getTradesForSurface()` / `getFillsForParentTrade()` | Database trade ledger tables | Not tied to selected Performance route truth | Query params: strategy variant, week, anchor, origin | Missing execution rows warn only inside modal | Drilldown can be right independently while Summary/Basket use another source | `TradeRowLedger` selected-row drilldown | Temporarily allowed | Drilldown reads same selected trade-row ledger as Summary/Basket/export/parity | Drilldown count/fills match selected basket row and Summary trade count | Drilldown ledger id, source surface, warnings, capped rows |
| `/api/performance/strategy-current-week` | Performance live overlay | Current/open week strategy payload | Live/current only | API computes current week or loads current-inclusive page data | Client current-week inflight cache by hour | StrategySessionStore only | Current hour bucket; no lifecycle record | Fallback computes signals only if page data missing | Current week can leak into historical readiness if not gated centrally | WeeklyLifecycleLedger live overlay state | Temporarily allowed | Current week is never counted as closed/frozen readiness | Live overlay failure does not blank closed history | Current week status, source, last success, failed reason |
| `/api/cron/strategy-artifacts` | Scheduler / Performance materialization | Strategy week shard finalization | Materialization producer | Cron route calls `ensureHistoricalWeekShardsForSelection()` and emits app-truth receipts | Server/database artifact stores plus `app_truth_*_run_ledger` | Indirectly supports kernel payloads | Strategy artifact engine version | Still no lifecycle state transition after receipt | Receipt exists, but lifecycle does not yet consume it for `closed_ready` promotion | `SchedulerRunLedger` / `MaterializationRunLedger` | First receipt gate implemented | Every run writes inspectable run ledger with inputs, outputs, namespaces, status, retries | Status shows latest Performance materialization run and missing inputs | Last run, outputs, missing inputs, retries, degraded reasons |
| `vercel.json` cron routes and source-freeze scripts | Scheduler / Source truth | COT, prices, sentiment, news, performance, strategy artifacts, snapshots, strength, bot, canonical refresh | Live refresh and materialization mixed | Vercel cron and manual/package scripts | Route-level revalidation and runtime caches; materialization producers and source-freeze build now emit receipt rows | No central lifecycle state machine | Cron schedule strings plus app-truth receipts for selected materialization routes | Receipt rows are diagnostic only until lifecycle consumes them outside Status | Cron freshness can be mistaken for frozen truth if receipts are not tied to lifecycle | WeeklyLifecycleLedger plus Scheduler/Materialization ledgers | Temporarily allowed | Jobs publish run receipts and move week lifecycle only after required inputs exist | Cron/live overlay failure does not invalidate frozen closed weeks | Job class, cadence, latest run, produced namespace, affected domain |
| `/status` | Status | Diagnostics | Boot-safe diagnostic route | Server page queries DB, source ledgers, kernel inventory, app-truth run receipts | Server runtime only | Bypasses AppPreloadGate | Release manifest/cache namespace/canon version | Does not yet use receipts to drive lifecycle transitions | Status is useful but not yet the full authoritative control plane | Boot-safe Status diagnostics | Partially implemented | Status shows route truth, namespace comparison, legacy path usage, active baseline, scheduler/materialization runs | Status renders when Data and Performance fail | All required app truth diagnostics |

## Legacy Path Register

| Legacy path name | Category | Reason it exists | Current surfaces | Replacement owner | Migration status | Deletion gate | Status diagnostic required |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Data page server `includeAllReports` load | fetch | Original Data route loads broad report universe on entry | `/dashboard` | Data domain store + ActiveBaselineManifest | temporarily-allowed | Data route consumes active baseline bundle and Archive mode owns broad history | Data page historical fetch owner and active/archive source |
| `/api/dashboard/payload?allReports=1` | fetch | Client/server refresh path for market intelligence payload | Data page, preload task | Data domain materialization/bundle endpoint | temporarily-allowed | Closed-week Data bundle is versioned and namespace-validated | Data payload source and namespace |
| `marketIntelligenceStore` memory-only cache | cache | Client reuse during same session | Data page | Data domain store with readiness/cache source | temporarily-allowed | Store persists public frozen data and reports live overlay separately | Data cache source, last valid domain bundle |
| `dataSectionWeeks` from `pair_period_returns` for active options | fallback | Broad Data week/report discovery | Data page | ActiveBaselineManifest | quarantine | Active mode no longer derives weeks from broad returns table | Active baseline source and archive flag |
| Legacy monolithic canon preload | preload/cache | v2 release canon full-bundle cache | AppPreloadGate, Basket fallback | Kernel week shards / domain bundles | quarantine | Migrated Performance never needs monolithic bundle to render trusted active state | Legacy canon fallback used true/false |
| `/api/canon/[version]/historical` | fetch | Monolithic release canon API | Legacy canon preload | Per-week shard/domain bundle | quarantine | No active migrated route requests it | Endpoint hit and caller |
| Global preload stamp | cache/fallback | Skip broad strategy preload after successful preload | StrategySessionStore | Kernel/domain manifest readiness | quarantine | Route readiness no longer trusts a global stamp | Stamp version, active route, whether trusted |
| `/api/performance/strategy-page-data` | fetch/cache | Broad historical strategy payload API | StrategySessionStore legacy mode | Performance domain selected ledger endpoint | quarantine | No active Performance boot calls it | Legacy strategy payload request/fallback |
| `/api/performance/engine-stats` | fetch | Legacy sidebar stats recompute outside active Performance route | Shared StrategySidebar outside `/performance` and `/matrix` | Performance domain selected summary state | quarantine | Sidebar stats no longer recompute broad Data-section universe | Sidebar stats source and selected baseline |
| `/api/performance/report` | fetch | Canonical report panel source | PerformanceComparisonPanel | Performance domain report mode or release archive | temporarily-allowed | Report is explicitly active-baseline-matching or Archive/Release-only | Report baseline/source mode |
| `/api/performance/comparison` | fetch | Backward-compatible mixed-source comparison route | Older/internal research surfaces | Research/Archive-only comparison source | quarantine | Not used by active Performance verification | Caller and legacy status |
| Browser Cache Storage `limni-strategy-payload-v3` | cache | Persistent strategy payload fast path | Performance legacy client cache | Domain bundle cache keyed by namespace | quarantine | Replaced by ledger/domain cache with explicit namespace taxonomy | Cache name, contract version, selected payload namespace |
| Background strategy repairs | fallback/materialization | Repair missing/stale artifacts from client/session flow | StrategySessionStore | MaterializationRunLedger and scheduler jobs | quarantine | Repairs are server/materialization jobs with Status-visible receipts | Repair runs, affected selection, missing weeks |
| `/api/basket/closed-history` | fetch | API-backed basket hierarchy before canon/domain bundle | Basket hierarchy | TradeRowLedger / Performance domain bundle | quarantine | Basket consumes selected trade rows from shared ledger | Basket data source and mismatch status |
| `/api/basket/weeks` and `/api/basket/week-pairs` | fetch | Old all-time Basket pagination | Quarantined BasketAllTimeBrowser path | Explicit Archive bundle or deletion | delete-now after reachability check | Removed or proven unreachable outside archived code | Quarantined endpoint reachability |
| Basket legacy flattened fallback | fallback | Current-week/non-hierarchy fallback renderer | Basket tab | TradeRowLedger plus explicit live overlay renderer | temporarily-allowed | Closed history never falls back to flattened rows after migration | Renderer path used and selected week state |
| `/api/trades/drilldown` independent modal fetch | fetch | Audit modal for ledger trades/fills | PairPerformanceTable, BasketAllTimeBrowser, FlagshipBoard, Basket hierarchy flow | Selected TradeRowLedger drilldown | temporarily-allowed | Modal receives selected ledger context and cannot show a different trade source silently | Drilldown ledger id and selected source match |
| `/api/matrix/weekly-returns` from Performance session | fetch | Weekly returns supplement for existing surfaces | Performance/session | Active baseline/domain return ledger | unknown | Uses same active baseline and missing-vs-zero semantics or is isolated to Matrix | Weekly returns source and baseline id |
| Cron route revalidation of `/dashboard` and `/performance` | route/cache | Refresh live pages after source updates | Cron routes | Scheduler/Materialization ledgers plus domain invalidation | temporarily-allowed | Revalidation no longer implies closed-history invalidation | Last revalidation, affected domain, frozen namespace changed false/true |

## Route Truth Contract Inventory

| Route | Required trusted records | Current status | Immediate Phase 1 need |
| --- | --- | --- | --- |
| Data | `ActiveBaselineManifest`, Data `DomainManifest`, trusted `FrozenSourceLedger` for closed active weeks, `WeeklyLifecycleLedger` for current/closed split | Missing as a formal route contract. Data currently derives active options from Data-section weeks and broad payload loading. | Define Data route contract and make active/archive distinction explicit before code migration. |
| Performance | `ActiveBaselineManifest`, Performance `DomainManifest`, selected `ExecutionLedger`, selected `TradeRowLedger`, selected runtime readiness, `WeeklyLifecycleLedger` | Partial. Kernel inventory exists, clean14 payload exists, but selected trade-row ledger identity and Summary/Basket parity are not authoritative. | Define selected ledger ids and route blocked/degraded states. |
| Status | Boot-safe kernel/domain diagnostics only | Partially implemented. It bypasses preload and shows kernel/source ledgers, but lacks active baseline, legacy path register, route contract result, and scheduler/materialization receipts. | Make Status the diagnostic control plane before risky route migrations. |

## Scheduler And Materialization Ledger Inventory

| Producer | Current evidence | Current run ledger status | Required ledger fields |
| --- | --- | --- | --- |
| COT refresh | `vercel.json` hourly plus 10-minute Friday/Monday bursts | No durable scheduler run ledger found in Phase 0 audit | job id, trigger, start/end, report observed, missing inputs, output artifacts, status |
| Sentiment refresh | Hourly cron route | No durable scheduler run ledger found | provider/source versions, cutoff readiness, output rows, degraded reasons |
| Strength refresh | Hourly `currency-strength` and `asset-strength` cron routes | No durable scheduler run ledger found | source snapshots, cutoff readiness, output rows, degraded reasons |
| Source freeze ledger build | `source:freeze:build-clean14` and `source:freeze:build-current` scripts | Emits `SchedulerRunLedger` and `MaterializationRunLedger` receipts for `source_freeze_ledger` | input artifacts, required inputs, missing inputs, produced ledger version, trusted rows, incidents |
| Performance strategy artifacts | `/api/cron/strategy-artifacts` hourly | Emits `SchedulerRunLedger` and `MaterializationRunLedger` receipts | selected strategy, engine namespace, source fingerprint, weeks computed, missing/stale weeks, status |
| Canonical refresh | `/api/cron/canonical-refresh?includeHourly=1` hourly | Emits `SchedulerRunLedger` and `MaterializationRunLedger` receipts for price/weekly-return materialization | input source versions, affected domains, output namespace, revalidated paths, status |
| Performance snapshots | `/api/cron/performance-refresh` hourly | Emits scheduler/materialization receipts for transitional `performance_snapshots` | week window, snapshots written, status |
| ADR trade scan | `/api/cron/adr-trade-scan` hourly | Emits scheduler/materialization receipts for current-week ADR trade rows | week, rows touched, scanner errors, status |
| Live overlays/news/bot/account data | Cron/live API mix | Operational statuses exist in some places, but not part of app truth lifecycle | live overlay status, last success, failure isolation from frozen data |

## Data/Performance Path Map

```text
Data active route today:
  /dashboard
    -> loadCachedMarketIntelligence(includeAllReports: true)
    -> runtimeCache marketIntelligence:* (short TTL)
    -> loadMarketIntelligence()
    -> listDataSectionWeekEntries() from pair_period_returns
    -> readFrozenSourceLedgerWeek() where available
    -> client seedMarketIntelligence()
    -> optional fetch /api/dashboard/payload?allReports=1 no-store

Performance active route today:
  /performance
    -> AppPreloadGate
      -> startCanonKernelSync(selection)
        -> /api/version/current no-store
        -> /api/canon/{version}/inventory no-store
        -> /api/canon/{version}/week force-cache/no-store
        -> IndexedDB weekShards/inventories/kernelMeta
      -> possible startCanonPreload()
        -> /api/canon/{version}/historical force-cache
        -> IndexedDB bundles/meta
      -> startStrategySessionPreload(useKernelPayload: true)
        -> /api/performance/strategy-kernel-payload?history=clean14 no-store
        -> loadStrategyPageData(historyWindow: v2.0.3-clean14)
    -> PerformanceStrategyViewSection
      -> session payload
      -> PerformanceViewSection
      -> BasketHierarchy
        -> canon kernel snapshot or legacy canon snapshot
        -> warns if engine header P/L differs from drilldown row sum
```

## Status Diagnostics Requirements

Add these diagnostics before or during the first implementation phase:

- active baseline id, active week list, archive week availability
- Data route truth status: ready, degraded, blocked, and why
- Performance route truth status: ready, degraded, blocked, and why
- selected Performance runtime id
- selected execution ledger id
- selected trade-row ledger id
- Summary/Basket/export/parity trade-row source match/mismatch
- missing freeze ledger weeks in the active baseline
- missing execution ledger weeks in the active baseline
- missing trade-row ledger weeks in the active baseline
- valid zero trades vs missing rows distinction
- domain namespace comparison by Data and Performance
- legacy path usage: page fetch, monolithic canon, strategy-page-data, basket closed-history, global preload stamp
- scheduler/materialization latest run receipts and failed/missing inputs
- live overlay status separated from frozen closed-week readiness
- public frozen cache source: memory, IndexedDB, server, network, fallback

## Broad Route And UI Simplification Pass

Freedom asked for one more pass across the app before code changes, especially to avoid overbuilding a simple app before future pages exist.

This pass is source-level only. It inspected route ownership, fetch/cache signals, shared controls, Performance/Simulation/Basket state ownership, and known quarantined surfaces. Runtime reachability still requires Playwright before deleting or declaring a UI surface inactive.

### Top-Level Route Findings

| Surface | Current role | Complexity level | App truth stance |
| --- | --- | --- | --- |
| `/` | Redirects to `/dashboard?bias=dealer` | Low | No domain contract needed. |
| `/login` | Auth form/redirect | Low | Keep outside app truth preload. |
| `/dashboard` | Active Data surface | Medium/high | Must consume active baseline and Data domain readiness. Do not keep broad report history as default active mode. |
| `/performance` | Active Performance surface | High | Main migration target after contracts/Status. Needs selected truth context before UI refactor. |
| `/status` | Operational diagnostics | Medium/high | First visible implementation target. It must become boot-safe app truth diagnostics before changing Data/Performance behavior. |
| `/research` and `/automation/research` | Canonical research hub backed by canonical report helpers | Medium | Secondary domain. Keep as report/archive/research until active baseline contract exists. |
| `/accounts` | Server-built account payload plus client session store | Medium | Future domain readiness contract only. Do not include in first app-truth migration unless it blocks private account UX. |
| `/news` | Server-built weekly news payload plus client week switching | Medium | Future live/news domain contract. Not part of first Data/Performance truth gate. |
| `/documents` | Filesystem release docs renderer | Low/medium | Leave alone; docs surface is not a data truth owner. |
| `/agents` | Placeholder/planned surface | Low | Leave alone. |
| `/automation/bots/*` | Bot detail/config surfaces | Medium | Operational/private-ish surfaces. Keep outside first app truth migration. |
| `/matrix` | Quarantine notice only in active page | Low active / high preserved code | Do not reactivate or inherit Matrix state machinery during Data/Performance migration. |
| `/flagship/*` | Redirects to `/matrix` | Low active / high preserved code | Treat `FlagshipBoard` and related API calls as preserved/quarantined code until runtime reachability is proven. |
| `/sentiment` | Redirects to Data sentiment mode | Low | Keep as compatibility redirect. |

### Shared UI And Component Findings

| Area | Finding | Simplification decision |
| --- | --- | --- |
| `DashboardLayout` | Top-level shell is simple. Only Performance gets section sidebar controls through `StrategySidebar`. | Do not make a global section-control framework now. Future pages should own route-local controls unless they share a real contract. |
| `SegmentedToggle` / `ViewModeControls` | Existing shared primitives are small and reused. | Keep. Do not replace with a new UI system during truth migration. |
| `DashboardViewSection` | Data owns local selected asset/report/bias/view state, URL sync, memory store seeding, and `includeAllReports` fetches. | Data needs domain readiness and active/archive baseline split before durable cache work. |
| `PerformanceViewSection` | Single large component owns view/week/scope/mode/system/style, URL sync, sidebar events, Summary/Simulation/Basket/Notes rendering, and Basket fallback routing. | Do not start with a broad visual rewrite. First extract/define selected Performance truth state, then migrate consumers. |
| `PerformanceSimulationSection` | Simulation is a consumer/projection of active selected payload plus local sleeve display state. | Do not rewrite Simulation first. Once selected truth context is stable, Simulation should consume it passively. |
| `ReturnsCalendar` | Calendar modes are local display state over already-provided week/path data. | Leave until Performance source truth is fixed. |
| `StrategySelector` / `StrategySidebar` | Selector and sidebar communicate through URL mutation plus browser `CustomEvent`s; sidebar also fetches `/api/performance/engine-stats`. | Treat as a split-brain risk. Replace/restrict sidebar stats with selected Performance domain state after route contract exists. |
| `PerformanceComparisonPanel` | Fetches canonical report and current-week flagship summaries independently from selected Performance runtime. | Keep as report/archive/research unless it can prove it matches the active baseline. |
| `BasketHierarchy` | Uses canon kernel/legacy canon snapshot and exposes a mismatch warning when header P/L differs from drilldown rows. | Keep visible as degraded evidence. Basket must become a trade-row ledger consumer before hierarchy expansion. |
| `BasketAllTimeBrowser` | Old paginated browser still exists; endpoints now return 410 and no active imports were found in source search. | Delete only after Playwright reachability proof. Do not build active all-time canon around pagination. |
| `TradeDrilldownModal` | Active modal fetches `/api/trades/drilldown` independently where used. | Temporarily allowed, but must receive/prove selected trade-row ledger identity before it can be trusted for parity. |
| `MatrixViewSection` / `FlagshipBoard` | Preserved components still contain many no-store live API fetches, but active routes redirect/quarantine. | Do not use them as architecture examples for new pages. Cleanup is later unless runtime shows reachability. |

### Over-Complexity Risks To Avoid

- Do not build a heavy all-domain framework before Data and Performance contracts are proven.
- Do not start with IndexedDB/cache. Durable cache before route truth would preserve stale or wrong states faster.
- Do not refactor Simulation/Basket visuals before selected Performance truth is a single object.
- Do not make `DashboardLayout` responsible for every future domain's controls.
- Do not keep `CustomEvent` and independent sidebar recompute paths as trusted Performance state.
- Do not treat route dynamic/no-store usage as automatically wrong for every page; the immediate problem is frozen public truth being mixed with live/current fetches.
- Do not reactivate Matrix/Flagship while solving Data/Performance truth.

### Confidence And Remaining Unknowns

The source pass covers every active `page.tsx`, the app shell, the preloader, the main Data/Performance stores, shared controls, Basket, Simulation, Strategy sidebar/selector, Status, cron shape, and known legacy API paths.

Remaining unknowns before deletion:

- Browser reachability of preserved/quarantined components such as `BasketAllTimeBrowser`, `MatrixViewSection`, `FlagshipBoard`, and `PerformanceComparisonPanel` in all normal navigation paths.
- Real runtime behavior after selected strategy/week changes, which needs Playwright traces before claiming split-brain fixes.
- Whether any external link/bookmark lands on a preserved legacy route and still reaches a live component.

Conclusion: the first implementation should be narrow contract and diagnostics work, not UI rewrite, cache implementation, cron tuning, or broad component cleanup.

## Phase 0 Definition Of Done Check

| Requirement | Status |
| --- | --- |
| Every audited Data/Performance historical fetch/cache/preload path is listed | Pending review |
| Stale authoritative docs are marked superseded or historical | In progress |
| Current architecture index points to new truth spec and implementation plan | Complete in `APP_TRUTH_ARCHITECTURE_INDEX.md` |
| Every known fallback has a deletion gate | Pending review |
| Status requirements include legacy-path and namespace diagnostics | Complete in this inventory |
| No broad app/runtime code started during Phase 0 | Superseded by later narrow app-truth gates; current code changes are limited to diagnostics, active baseline/Data alignment, selected Performance truth, lifecycle visibility, cron register, and receipts |

## Human Breakdown

What changed: this inventory names the active Data/Performance fetch, cache, preload, fallback, scheduler, and diagnostic paths, and now records the first durable scheduler/materialization receipt implementation.

Why it matters: implementation can now remove or migrate old paths deliberately instead of letting them keep driving the UI invisibly.

What passed/failed: Phase 0 inventory became the working register; narrow app-truth implementation gates have started, but full lifecycle/materialization state remains incomplete.

Next gate: connect durable receipts to weekly lifecycle/materialization state instead of only displaying recent evidence.
