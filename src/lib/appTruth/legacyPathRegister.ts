/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: legacyPathRegister.ts
 *
 * Description:
 * Phase 0 legacy path register exposed to Status before passive runtime
 * instrumentation exists. These entries are intentionally static evidence.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import type { LegacyPathUsage } from "@/lib/appTruth/types";

export const APP_TRUTH_LEGACY_PATH_REGISTER: LegacyPathUsage[] = [
  {
    id: "data-include-all-reports",
    label: "Data includeAllReports payload",
    category: "fetch",
    status: "temporarily_allowed",
    replacementOwner: "data",
    currentSurface: "/dashboard and /api/dashboard/payload",
    risk: "Active Data can load broad archive history instead of the active baseline window.",
    observedInCurrentSession: "not_instrumented",
    deletionGate: "Data active mode reads ActiveBaselineManifest and Archive mode owns broad history.",
  },
  {
    id: "data-memory-only-store",
    label: "Data memory-only market intelligence store",
    category: "cache",
    status: "temporarily_allowed",
    replacementOwner: "data",
    currentSurface: "src/lib/dashboard/marketIntelligenceStore.ts",
    risk: "Frozen public Data can be lost across navigation/login and refetched as live page payload.",
    observedInCurrentSession: "not_instrumented",
    deletionGate: "Data domain store reports namespace, readiness, and durable frozen cache source.",
  },
  {
    id: "legacy-monolithic-canon",
    label: "Legacy monolithic canon preload",
    category: "preload",
    status: "quarantined",
    replacementOwner: "performance",
    currentSurface: "canonStore and /api/canon/[version]/historical",
    risk: "A full historical bundle can mask missing kernel shards or reintroduce broad preload work.",
    observedInCurrentSession: "not_instrumented",
    deletionGate: "Migrated Performance no longer needs monolithic canon to render trusted active state.",
  },
  {
    id: "strategy-page-data",
    label: "Legacy strategy-page-data payload",
    category: "fetch",
    status: "quarantined",
    replacementOwner: "performance",
    currentSurface: "/api/performance/strategy-page-data",
    risk: "Broad-history/deprecated strategy payloads can survive in persistent browser cache.",
    observedInCurrentSession: "not_instrumented",
    deletionGate: "Active Performance boot makes no strategy-page-data request.",
  },
  {
    id: "engine-stats-sidebar",
    label: "Sidebar engine-stats recompute",
    category: "fetch",
    status: "quarantined",
    replacementOwner: "performance",
    currentSurface: "StrategySidebar and /api/performance/engine-stats",
    risk: "Sidebar stats can be computed from a different week universe than the main Performance panel.",
    observedInCurrentSession: "not_instrumented",
    deletionGate: "Sidebar stats come from selected Performance truth context only.",
  },
  {
    id: "basket-closed-history-api",
    label: "Basket closed-history API fallback",
    category: "fetch",
    status: "quarantined",
    replacementOwner: "performance",
    currentSurface: "/api/basket/closed-history preserved; BasketHierarchy now requires selected trade-row bundle",
    risk: "Basket can bypass selected trade-row ledger identity.",
    observedInCurrentSession: "no",
    deletionGate: "Basket consumes selected trade rows from the Performance domain bundle.",
  },
  {
    id: "basket-pagination",
    label: "Basket paginated all-time browser",
    category: "ui",
    status: "quarantined",
    replacementOwner: "performance",
    currentSurface: "BasketAllTimeBrowser, /api/basket/weeks, /api/basket/week-pairs",
    risk: "Closed-week canon can be shaped around pagination instead of active baseline bundles.",
    observedInCurrentSession: "not_instrumented",
    deletionGate: "Source search and Playwright prove no active all-time pagination path.",
  },
  {
    id: "trade-drilldown-independent-fetch",
    label: "Trade drilldown independent fetch",
    category: "fetch",
    status: "temporarily_allowed",
    replacementOwner: "performance",
    currentSurface: "TradeDrilldownModal and /api/trades/drilldown",
    risk: "Drilldown can be correct independently while Summary/Basket use another source.",
    observedInCurrentSession: "not_instrumented",
    deletionGate: "Drilldown receives and proves selected trade-row ledger identity.",
  },
  {
    id: "global-preload-stamp",
    label: "Global preload stamp",
    category: "cache",
    status: "quarantined",
    replacementOwner: "performance",
    currentSurface: "src/lib/preload/preloadContract.ts",
    risk: "A global stamp can imply readiness without route-specific truth records.",
    observedInCurrentSession: "not_instrumented",
    deletionGate: "Route truth readiness no longer trusts a global stamp.",
  },
  {
    id: "cron-without-run-ledger",
    label: "Cron/materialization without run ledger",
    category: "scheduler",
    status: "temporarily_allowed",
    replacementOwner: "scheduler",
    currentSurface: "vercel.json cron routes and source freeze scripts",
    risk: "Cron freshness can be mistaken for frozen truth without durable run receipts.",
    observedInCurrentSession: "not_instrumented",
    deletionGate: "SchedulerRunLedger and MaterializationRunLedger records are visible in Status.",
  },
];
