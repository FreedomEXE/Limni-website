# Codex Prompt: Phase 2 — Market Intelligence Session Store

> **Prerequisite:** Phase 1 (CODEX_SYSTEMIC_PRELOAD_FIX.md) must be implemented first.
> This prompt builds on the preload registry and gate from Phase 1.

## Problem Statement

The Dashboard page (`/dashboard`) is a ~950-line server component with `force-dynamic` + `revalidate = 0`. Every time the user navigates to it, Next.js re-runs the entire function — hitting PostgreSQL for COT snapshots across all asset classes and weeks, sentiment aggregates, strength readings, pair returns, provenance, and myfxbook positioning. This takes seconds and happens on every single navigation.

The data barely changes between visits. COT reports update weekly (Tuesday). Sentiment and strength refresh hourly. Yet the page refetches everything from scratch every time.

The client component (`DashboardViewSection`) already handles report/bias/view switching entirely client-side via `useMemo` — it just needs the data seeded once and cached.

## Design

### Data Shape

The dashboard server component builds these payloads and passes them as props:

```
cotDataByReport         — Record<reportDate, { dealer, commercial }>
sentimentDataByReport   — Record<reportDate, SentimentPayload>
strengthDataByReport    — Record<reportDate, StrengthPayload>
myfxbookPositioningBySymbol — Record<symbol, MyfxbookPositioning>
provenanceByReport      — Record<reportDate, WeekSnapshotProvenance>
```

Plus metadata: `assetOptions`, `reportOptions`, `selectedAsset`, `currentWeekOpenUtc`.

All of this is one logical dataset — **market intelligence** — keyed by report date. Fetch once, cache client-side, refresh hourly.

### Architecture

```
┌─────────────────────────────────────────────────────────┐
│  /api/dashboard/payload (NEW API route)                 │
│  - Calls loadMarketIntelligence()                       │
│  - Returns full market intelligence payload JSON        │
│  - Called by preload engine + hourly refresh             │
└──────────────────┬──────────────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────────────┐
│  Market Intelligence Store (marketIntelligenceStore.ts)  │
│  - Client-side session store (useSyncExternalStore)     │
│  - Seeded from server props on first render             │
│  - Seeded from API during preload                       │
│  - Hourly refresh for current week only                 │
└──────────────────┬──────────────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────────────┐
│  DashboardViewSection (existing)                        │
│  - Reads from store instead of (or in addition to) props│
│  - On first render: seeds store from server props       │
│  - On subsequent navigation: store already populated    │
│  - All report/bias/view switching stays client-side     │
└─────────────────────────────────────────────────────────┘
```

## Phase 0: Analyze Before Implementing

Read the full Dashboard page (`src/app/dashboard/page.tsx`) and `DashboardViewSection.tsx`. Understand:

1. What data the server component fetches and how it's structured
2. What props `DashboardViewSection` receives
3. How `DashboardViewSection` switches between reports/biases/views (all client-side via `useMemo`)
4. What helper functions in `page.tsx` build the payloads (`buildCotPayloadForReport`, `buildSentimentPayloadForWeek`, `buildStrengthPayloadForWeek`, etc.)

The goal is to extract data-fetching into a shared function that both the server component and the API route call.

## Implementation

### 1. Market Intelligence Payload Type

**File: `src/lib/dashboard/marketIntelligencePayload.ts` (NEW)**

Define the payload type shared between API and store:

```typescript
import type { DashboardCotPayload, DashboardSentimentPayload, DashboardStrengthPayload } from "@/components/dashboard/DashboardViewSection";
import type { MyfxbookPositioning } from "@/components/SentimentHeatmap";
import type { WeekSnapshotProvenance } from "@/lib/performance/snapshotProvenance";

export type MarketIntelligencePayload = {
  assetOptions: Array<{ id: string; label: string }>;
  reportOptions: Array<{ value: string; label: string }>;
  selectedAsset: string;
  currentWeekOpenUtc: string;
  cotDataByReport: Record<string, { dealer: DashboardCotPayload; commercial: DashboardCotPayload }>;
  sentimentDataByReport: Record<string, DashboardSentimentPayload>;
  strengthDataByReport: Record<string, DashboardStrengthPayload>;
  myfxbookPositioningBySymbol: Record<string, MyfxbookPositioning | undefined>;
  provenanceByReport: Record<string, WeekSnapshotProvenance>;
  fetchedAtUtc: string;
};
```

### 2. Extract Data-Fetching Logic

**File: `src/lib/dashboard/loadMarketIntelligence.ts` (NEW)**

Extract all data-fetching from `src/app/dashboard/page.tsx` into a standalone async function:

1. Accept `asset` parameter (defaults to `"all"`)
2. Perform all the same fetching the server component currently does inline
3. Move the helper functions that are private to `page.tsx` (`buildCotPayloadForReport`, `buildSentimentPayloadForWeek`, `buildStrengthPayloadForWeek`, `buildBiasDetails`, `buildCanonicalPairPerformance`, `parseMyfxbookPositioning`, `buildReportOptions`, etc.) into this file or a helper alongside it
4. Return a `MarketIntelligencePayload`

**Do not duplicate logic.** The page.tsx should import and call `loadMarketIntelligence()`:

```typescript
// src/app/dashboard/page.tsx becomes thin:
export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const resolved = await Promise.resolve(searchParams);
  const rawAsset = /* extract from params */;
  const payload = await loadMarketIntelligence(rawAsset);

  // Resolve report/bias/view from params (unchanged logic)
  return (
    <DashboardLayout>
      <DashboardViewSection
        {...payload}
        initialReport={selectedReportDate}
        initialBias={biasMode}
        initialView={view}
      />
    </DashboardLayout>
  );
}
```

### 3. API Route

**File: `src/app/api/dashboard/payload/route.ts` (NEW)**

```typescript
import { NextResponse } from "next/server";
import { loadMarketIntelligence } from "@/lib/dashboard/loadMarketIntelligence";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const asset = searchParams.get("asset") ?? undefined;

  try {
    const payload = await loadMarketIntelligence(asset);
    return NextResponse.json(payload);
  } catch (error) {
    console.error("Market intelligence API error:", error);
    return NextResponse.json({ error: "Failed to load market intelligence" }, { status: 500 });
  }
}
```

### 4. Market Intelligence Session Store

**File: `src/lib/dashboard/marketIntelligenceStore.ts` (NEW)**

Client-side session store using `useSyncExternalStore`, same pattern as `strategySessionStore`:

```typescript
import { useSyncExternalStore } from "react";
import type { MarketIntelligencePayload } from "./marketIntelligencePayload";

type StoreState = {
  payload: MarketIntelligencePayload | null;
  status: "idle" | "loading" | "ready" | "error";
  lastFetchedUtc: string | null;
};

// Store state, listeners, emit(), subscribe(), getSnapshot() — standard pattern.

/**
 * Seed the store from server-rendered props (first visit).
 * Only seeds if the store is empty — does not overwrite preloaded data.
 */
export function seedMarketIntelligence(payload: MarketIntelligencePayload): void { ... }

/**
 * Fetch from API and update the store.
 * Called by preload task run() and hourly refresh.
 */
export async function fetchAndSeedMarketIntelligence(asset?: string): Promise<void> { ... }

/** React hook. */
export function useMarketIntelligence() {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/** Hourly refresh aligned to ~5 min past hour. */
export function scheduleMarketIntelligenceRefresh(): void { ... }
export function clearMarketIntelligenceRefresh(): void { ... }
```

### 5. Wire Into DashboardViewSection

**File: `src/components/dashboard/DashboardViewSection.tsx`**

On mount, seed the store from server props. Read from store for rendering. Fall back to props if store is empty (first render before seed completes).

```typescript
import { seedMarketIntelligence, useMarketIntelligence, scheduleMarketIntelligenceRefresh, clearMarketIntelligenceRefresh } from "@/lib/dashboard/marketIntelligenceStore";

export default function DashboardViewSection(props: DashboardViewSectionProps) {
  // Seed store from server props on mount
  useEffect(() => {
    seedMarketIntelligence({
      assetOptions: props.assetOptions,
      reportOptions: props.reportOptions,
      selectedAsset: props.selectedAsset,
      currentWeekOpenUtc: props.currentWeekOpenUtc,
      cotDataByReport: props.cotDataByReport,
      sentimentDataByReport: props.sentimentDataByReport,
      strengthDataByReport: props.strengthDataByReport,
      myfxbookPositioningBySymbol: props.myfxbookPositioningBySymbol,
      provenanceByReport: props.provenanceByReport ?? {},
      fetchedAtUtc: new Date().toISOString(),
    });
  }, []);

  // Start hourly refresh
  useEffect(() => {
    scheduleMarketIntelligenceRefresh();
    return () => clearMarketIntelligenceRefresh();
  }, []);

  // Read from store — preloaded data or server-seeded data
  const store = useMarketIntelligence();
  const cotDataByReport = store.payload?.cotDataByReport ?? props.cotDataByReport;
  const sentimentDataByReport = store.payload?.sentimentDataByReport ?? props.sentimentDataByReport;
  const strengthDataByReport = store.payload?.strengthDataByReport ?? props.strengthDataByReport;
  const myfxbookPositioningBySymbol = store.payload?.myfxbookPositioningBySymbol ?? props.myfxbookPositioningBySymbol;
  const provenanceByReport = store.payload?.provenanceByReport ?? props.provenanceByReport ?? {};

  // ... rest unchanged, uses the variables above ...
}
```

### 6. Register as Preload Task

**File: `src/lib/preload/preloadRegistry.ts`**

Add a market-intelligence task to `buildPreloadManifest()` with a real `run()`:

```typescript
import { fetchAndSeedMarketIntelligence } from "@/lib/dashboard/marketIntelligenceStore";

export function buildPreloadManifest(activeOverride?: RuntimeStrategySelection | null): PreloadManifest {
  const tasks: PreloadTask[] = [];

  // ... existing strategy tasks ...

  // ── Market Intelligence domain ──
  tasks.push({
    id: "market-intelligence",
    domain: "market-intelligence",
    priority: "active",
    run: () => fetchAndSeedMarketIntelligence(),
  });

  return { tasks, activeTaskId: activeKey };
}
```

### 7. Add Phase Label for Market Data

**File: `src/components/AppPreloadGate.tsx`**

Add `"loading-market-data"` to `PreloadPhase` type and `PHASE_LABELS`:

```typescript
"loading-market-data": "Loading market data...",
```

**File: `src/lib/performance/strategySessionStore.ts`**

Add `"loading-market-data"` to the `PreloadPhase` union. In `runPreload`, after the active strategy task and before background strategy tasks, run active-priority non-strategy tasks:

```typescript
// After Phase 2 (loading-active strategy) and before Phase 3 (loading-strategies):
const activeNonStrategyTasks = manifest.tasks.filter(
  (t) => t.priority === "active" && t.domain !== "strategy",
);
if (activeNonStrategyTasks.length > 0) {
  state = { ...state, preload: { ...state.preload, phase: "loading-market-data" } };
  emit();
  await Promise.all(activeNonStrategyTasks.map((t) => t.run()));
}
```

This is generic — it runs any active-priority non-strategy task. When Phase 3 adds news/accounts as background tasks, they'll run in the background phase naturally.

## Acceptance Criteria

1. **Dashboard loads instantly on return navigation** — no server round-trip, reads from store.
2. **First visit works identically** — server component still runs, seeds store from props.
3. **Preload populates the store** — "Loading market data..." phase completes during preload, store is seeded before gate lifts.
4. **Hourly refresh** — current week data refreshes at ~5 min past the hour.
5. **Report/bias/view switching stays instant** — still client-side `useMemo`, unchanged.
6. **Server component is thin** — data-fetching lives in `loadMarketIntelligence()`, shared between page and API. No duplication.
7. **No regressions** — all dashboard features work identically.

## Files to Modify

| File | Change |
|------|--------|
| `src/lib/dashboard/marketIntelligencePayload.ts` | **NEW** — payload type |
| `src/lib/dashboard/loadMarketIntelligence.ts` | **NEW** — extracted data-fetching (from page.tsx helpers) |
| `src/app/api/dashboard/payload/route.ts` | **NEW** — API route |
| `src/lib/dashboard/marketIntelligenceStore.ts` | **NEW** — client-side session store |
| `src/app/dashboard/page.tsx` | Slim down — call `loadMarketIntelligence()`, remove inline helpers |
| `src/components/dashboard/DashboardViewSection.tsx` | Seed store from props, read from store |
| `src/lib/preload/preloadRegistry.ts` | Add market-intelligence task with `run()` |
| `src/lib/performance/strategySessionStore.ts` | Add `"loading-market-data"` phase, run active non-strategy tasks |
| `src/components/AppPreloadGate.tsx` | Add `"loading-market-data"` label |

## Do NOT

- Do not change how report/bias/view switching works in `DashboardViewSection`.
- Do not duplicate data-fetching logic — share via `loadMarketIntelligence()`.
- Do not add caching headers to the API route — the client-side store IS the cache.
- Do not change the preload gate's `completedOnce` behavior or `/status` bypass.
- Do not implement news or accounts stores — those are Phase 3.

## Verification

1. `npm run lint` passes
2. `npx tsc --noEmit` passes
3. `npm test` passes
4. Open `/dashboard` → data loads normally (server-rendered first visit)
5. Navigate to `/performance` → navigate back to `/dashboard` → **instant**, no loading spinner
6. During preload gate → "Loading market data..." phase visible → completes → gate lifts
7. Switch bias tabs (dealer/commercial/sentiment/strength) → instant
8. Switch report weeks → instant
9. Wait ~1 hour → data refreshes automatically
