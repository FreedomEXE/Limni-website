# Codex Prompt: Systemic Data Preload & Self-Healing Fix (Phase 1)

## Problem Statement

The app has shard-native infrastructure (engine versioning, candle-aligned cache, per-selection versions) but the user experience is broken:

1. **Preload is invisible** — `DashboardLayout` calls `startStrategySessionPreload` on mount but nothing shows progress. The user sees Next.js's generic "Loading Dashboard Page".

2. **Preload is slow** — `startStrategySessionPreload` fetches ~30 selections sequentially (concurrency=1). Each triggers server-side shard repair with 15s budget. Worst case: 450s.

3. **Missing weeks persist** — Weeks like May 4th stay missing. The preload never finishes, the cron only processes ~5 selections per hourly run.

4. **Preload is hardcoded** — `DashboardLayout` hardcodes `DEFAULT_APP_STRATEGY_SELECTION = { strategy: "tandem", f1: "adr_grid", f2: "exposure_cap" }`. If strategies change, defaults change, or the user deep-links into a different selection, the preload loads the wrong thing first.

5. **Two preload owners** — `DashboardLayout` calls `startStrategySessionPreload` on mount, AND `useStrategySession` calls it again in its `useEffect`. Conflicting ownership of global preload state.

## Critical Design Principle: Data Domains ≠ Pages

**Pages are views. Data is shared.** Multiple pages consume the same underlying data:

- Dashboard (dealer/commercial/sentiment/strength tabs) = one "market intelligence" dataset
- Performance + Matrix = one "strategy" dataset (30 selections)
- News = "news" dataset
- Accounts = "accounts" dataset

The preload system is organized by **data domains**, not by pages.

**Phase 1 implements only the strategy domain.** Market intelligence, news, and accounts are added in Phase 2/3 with their own real loaders. Phase 1 does NOT show labels or phases for unimplemented domains — no fake progress.

## Design: Preload Manifest + Registry

### Architecture

```
┌──────────────────────────────────────────────────────┐
│  Preload Registry (preloadRegistry.ts)               │
│  - Defines domain/task types (extensible)            │
│  - Builds manifest with only real tasks              │
│  - Each task carries its own run() function           │
│  - Determines active task from route params           │
│  - Centralized fallback default                      │
└──────────────────┬───────────────────────────────────┘
                   │ manifest
┌──────────────────▼───────────────────────────────────┐
│  Preload Engine (strategySessionStore.ts)             │
│  - Single owner of all preload state                 │
│  - Executes manifest tasks via run()                 │
│  - Tracks phase + progress                           │
│  - Detects version changes, resets if needed          │
│  - Concurrency control (3 parallel for background)   │
└──────────────────┬───────────────────────────────────┘
                   │ reads state
┌──────────────────▼───────────────────────────────────┐
│  Preload Gate (AppPreloadGate.tsx)                    │
│  - Full-screen gate, blocks page render              │
│  - Shows Limni spinner + phase labels                │
│  - Generic labels — no strategy/page names           │
│  - Skips /status route (diagnostics must be live)    │
│  - Never re-blocks after reaching "ready"            │
│  - Lifts when engine reports "ready"                 │
└──────────────────────────────────────────────────────┘
```

**One owner**: the preload engine owns all preload state. `useStrategySession` does NOT trigger preload — it only reads session state and calls `ensureStrategySession` as a fallback for individual selections. The gate triggers the engine on mount.

## Implementation

### 1. Preload Registry

**File: `src/lib/preload/preloadRegistry.ts` (NEW)**

Each task carries its own `run()` function. No switch statement or stub dispatcher needed. Phase 2/3 will add tasks with their own runners — the registry and engine never change.

```typescript
import {
  listVisibleStrategyBootstrapSelections,
  buildStrategySelectionKey,
  toRuntimeStrategySelection,
  type RuntimeStrategySelection,
} from "@/lib/performance/strategySelection";
import {
  resolveStrategyId,
  normalizeFilterSelection,
} from "@/lib/performance/strategyConfig";
import { ensureStrategySession } from "@/lib/performance/strategySessionStore";

// ── Task types ──

export type PreloadDomain = "strategy" | "market-intelligence" | "news" | "accounts";

export type PreloadTask = {
  id: string;
  domain: PreloadDomain;
  priority: "active" | "background";
  run: () => Promise<void>;
};

export type PreloadManifest = {
  tasks: PreloadTask[];
  activeTaskId: string | null;
};

// ── Centralized default ──
// Only used when no route/session context exists.
// If this needs to change, change it here — not in scattered files.
export const FALLBACK_DEFAULT_SELECTION: RuntimeStrategySelection = {
  strategy: "tandem",
  f1: "adr_grid",
  f2: "exposure_cap",
};

/**
 * Derive the active selection from URL search params.
 * Returns null if the current route has no strategy context.
 */
export function deriveActiveSelectionFromParams(
  searchParams: URLSearchParams | null,
): RuntimeStrategySelection | null {
  if (!searchParams) return null;
  const strategyParam = searchParams.get("strategy") ?? searchParams.get("bias");
  const f1Param = searchParams.get("f1") ?? searchParams.get("filter");
  const f2Param = searchParams.get("f2");
  if (!strategyParam && !f1Param && !f2Param) return null;
  const normalized = normalizeFilterSelection({ f1: f1Param, f2: f2Param });
  return {
    strategy: resolveStrategyId(strategyParam),
    f1: normalized.f1,
    f2: normalized.f2,
  };
}

/**
 * Build the preload manifest.
 * Phase 1: only strategy tasks with real loaders.
 * Phase 2/3 will add market-intelligence, news, accounts tasks here.
 */
export function buildPreloadManifest(
  activeOverride?: RuntimeStrategySelection | null,
): PreloadManifest {
  const tasks: PreloadTask[] = [];
  const active = activeOverride ?? FALLBACK_DEFAULT_SELECTION;
  const activeKey = buildStrategySelectionKey({
    strategyId: active.strategy,
    f1: active.f1,
    f2: active.f2,
  });

  // ── Strategy domain: all visible selections ──
  const allSelections = listVisibleStrategyBootstrapSelections();

  for (const sel of allSelections) {
    const key = buildStrategySelectionKey(sel);
    const selection = toRuntimeStrategySelection(sel);
    tasks.push({
      id: key,
      domain: "strategy",
      priority: key === activeKey ? "active" : "background",
      run: () => ensureStrategySession(selection, { currentWeek: false }),
    });
  }

  // Ensure active task exists even if not in the visible list
  if (!tasks.some((t) => t.id === activeKey)) {
    tasks.unshift({
      id: activeKey,
      domain: "strategy",
      priority: "active",
      run: () => ensureStrategySession(active, { currentWeek: false }),
    });
  }

  // Phase 2 will add: market-intelligence task with real run()
  // Phase 3 will add: news + accounts tasks with real run()

  return { tasks, activeTaskId: activeKey };
}
```

### 2. Preload Engine

**File: `src/lib/performance/strategySessionStore.ts`**

#### A. Add phase tracking to preload state

Phase 1 only has phases that correspond to real work:

```typescript
export type PreloadPhase =
  | "checking-updates"       // fetchStrategyArtifactStatus — version check
  | "loading-active"         // run() for the active strategy task
  | "loading-strategies"     // background strategy tasks with X/Y progress
  | "computing-live-data"    // current week for active selection
  | "ready";                 // gate lifts
```

Add to preload state:

```typescript
preload: {
  phase: PreloadPhase;
  status: "idle" | "loading" | "ready" | "partial" | "error";
  completedOnce: boolean;  // Once true, gate never re-blocks
  queuedSelectionKeys: string[];
  loadingSelectionKeys: string[];
  readySelectionKeys: string[];
  failedSelectionKeys: Record<string, string>;
};
```

Initialize `phase: "ready"` and `completedOnce: false`.

#### B. Add `usePreloadStatus` hook

```typescript
export function usePreloadStatus() {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  return snapshot.preload;
}
```

#### C. Restructure `startStrategySessionPreload` to accept a manifest

The engine calls `task.run()` — it doesn't know or care what domain a task belongs to:

```typescript
import type { PreloadManifest, PreloadTask } from "@/lib/preload/preloadRegistry";

const preloadedEngineVersions = new Map<string, string>();

export function startStrategySessionPreload(manifest: PreloadManifest) {
  if (preloadInflight) return preloadInflight;

  // If preload already completed once and no version change detected, skip.
  // This prevents gate flash on DashboardLayout remount during navigation.
  if (state.preload.completedOnce) {
    // Still check versions asynchronously, but don't block.
    void checkVersionsAndRepreload(manifest);
    return Promise.resolve();
  }

  state = {
    ...state,
    preload: { ...state.preload, phase: "checking-updates", status: "loading" },
  };
  emit();

  const request = runPreload(manifest);
  preloadInflight = request;
  return request;
}

async function checkVersionsAndRepreload(manifest: PreloadManifest) {
  const status = await fetchStrategyArtifactStatus();
  if (!status) return;

  let versionChanged = false;
  for (const artifact of status.artifacts) {
    const prev = preloadedEngineVersions.get(artifact.key);
    if (prev && prev !== artifact.expectedEngineVersion) {
      versionChanged = true;
      break;
    }
  }

  if (!versionChanged) return;

  // Version changed (deploy) — reset and re-preload
  state = {
    ...state,
    records: {},
    preload: {
      phase: "checking-updates",
      status: "loading",
      completedOnce: false,
      queuedSelectionKeys: [],
      loadingSelectionKeys: [],
      readySelectionKeys: [],
      failedSelectionKeys: {},
    },
  };
  emit();

  preloadInflight = runPreload(manifest);
}

async function runPreload(manifest: PreloadManifest) {
  try {
    // ── Phase 1: checking-updates ──
    const status = await fetchStrategyArtifactStatus();
    if (!status) {
      state = { ...state, preload: { ...state.preload, phase: "ready", status: "error", completedOnce: true } };
      emit();
      return;
    }

    // Track current versions
    for (const artifact of status.artifacts) {
      preloadedEngineVersions.set(artifact.key, artifact.expectedEngineVersion);
    }

    // ── Phase 2: loading-active ──
    const activeTask = manifest.tasks.find((t) => t.priority === "active");
    if (activeTask) {
      state = { ...state, preload: { ...state.preload, phase: "loading-active" } };
      emit();
      await activeTask.run();
    }

    // ── Phase 3: loading-strategies (background, concurrency 3) ──
    const backgroundTasks = manifest.tasks.filter((t) => t.priority === "background");
    if (backgroundTasks.length > 0) {
      state = {
        ...state,
        preload: {
          ...state.preload,
          phase: "loading-strategies",
          queuedSelectionKeys: backgroundTasks.map((t) => t.id),
        },
      };
      emit();

      let index = 0;
      const concurrency = Math.min(3, backgroundTasks.length);
      await Promise.all(Array.from({ length: concurrency }, async () => {
        while (index < backgroundTasks.length) {
          const task = backgroundTasks[index];
          index += 1;
          if (!task) return;

          state = {
            ...state,
            preload: {
              ...state.preload,
              queuedSelectionKeys: state.preload.queuedSelectionKeys.filter((k) => k !== task.id),
              loadingSelectionKeys: [...new Set([...state.preload.loadingSelectionKeys, task.id])],
            },
          };
          emit();

          try {
            await task.run();
            state = {
              ...state,
              preload: {
                ...state.preload,
                loadingSelectionKeys: state.preload.loadingSelectionKeys.filter((k) => k !== task.id),
                readySelectionKeys: [...new Set([...state.preload.readySelectionKeys, task.id])],
              },
            };
          } catch (error) {
            state = {
              ...state,
              preload: {
                ...state.preload,
                loadingSelectionKeys: state.preload.loadingSelectionKeys.filter((k) => k !== task.id),
                failedSelectionKeys: {
                  ...state.preload.failedSelectionKeys,
                  [task.id]: error instanceof Error ? error.message : String(error),
                },
              },
            };
          }
          emit();
        }
      }));
    }

    // ── Phase 4: computing-live-data ──
    if (activeTask && activeTask.domain === "strategy") {
      state = { ...state, preload: { ...state.preload, phase: "computing-live-data" } };
      emit();
      // activeTask.run() loaded historical data; now load current week
      const activeStrategyTask = manifest.tasks.find(
        (t) => t.id === manifest.activeTaskId && t.domain === "strategy",
      );
      if (activeStrategyTask) {
        // loadCurrentWeekSession is already exposed — call it for the active selection
        const sel = (activeStrategyTask as any).selection ?? null;
        if (sel) await loadCurrentWeekSession(sel, { force: false });
      }
    }

    // ── Phase 5: ready ──
    const failedCount = Object.keys(state.preload.failedSelectionKeys).length;
    state = {
      ...state,
      preload: {
        ...state.preload,
        phase: "ready",
        status: failedCount > 0 ? "partial" : "ready",
        completedOnce: true,
      },
    };
    emit();
  } finally {
    preloadInflight = null;
  }
}
```

**Note on `activeTask.selection`**: The engine needs the selection to call `loadCurrentWeekSession`. Since `PreloadTask` carries `run()` but not necessarily `selection`, the simplest approach is: for strategy-domain tasks, add `selection` as an optional field on `PreloadTask`, or have the registry pass a `computeLiveData` runner alongside `run`. Codex should choose the cleanest implementation. The key constraint is: `loadCurrentWeekSession` must be called for the active strategy selection after all background tasks complete.

#### D. Remove preload trigger from `useStrategySession`

Currently `useStrategySession` calls `startStrategySessionPreload`. Remove this call. `useStrategySession` should only:

1. Call `setActiveStrategySessionSelection` (keep)
2. Call `ensureStrategySession` for this specific selection (keep — fallback if not preloaded)
3. Call `scheduleHourlyCurrentWeekRefresh` (keep)
4. **Remove** `startStrategySessionPreload` call
5. **Remove** the `preload` option if it becomes unused

### 3. Full-screen preload gate

**File: `src/components/AppPreloadGate.tsx` (NEW)**

Critical behaviors:

- **Skips `/status` route** — diagnostics must always be live, never blocked by preload.
- **Never re-blocks after `completedOnce`** — once the gate lifts, it stays lifted. Prevents visual flash when `DashboardLayout` remounts during page navigation.
- **Phase labels only for real work** — only shows labels for phases the engine is actually executing.

```tsx
"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import {
  startStrategySessionPreload,
  usePreloadStatus,
} from "@/lib/performance/strategySessionStore";
import {
  buildPreloadManifest,
  deriveActiveSelectionFromParams,
} from "@/lib/preload/preloadRegistry";

const PHASE_LABELS: Record<string, string> = {
  "checking-updates": "Checking data versions...",
  "loading-active": "Preparing active workspace...",
  "loading-strategies": "Preparing strategy data",
  "computing-live-data": "Computing live data...",
};

// Routes that bypass the gate entirely
const BYPASS_ROUTES = ["/status"];

export default function AppPreloadGate({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const preload = usePreloadStatus();

  useEffect(() => {
    // Don't trigger preload from bypassed routes
    if (BYPASS_ROUTES.some((route) => pathname.startsWith(route))) return;
    const activeFromRoute = deriveActiveSelectionFromParams(searchParams);
    const manifest = buildPreloadManifest(activeFromRoute);
    void startStrategySessionPreload(manifest);
  }, [pathname, searchParams]);

  // Bypass routes always pass through
  if (BYPASS_ROUTES.some((route) => pathname.startsWith(route))) {
    return <>{children}</>;
  }

  // Once preload has completed at least once, never re-block
  if (preload.completedOnce) {
    return <>{children}</>;
  }

  // Gate is open when ready or partial
  const gateOpen =
    preload.phase === "ready" ||
    preload.status === "ready" ||
    preload.status === "partial";

  if (gateOpen) {
    return <>{children}</>;
  }

  // ── Render gate UI ──
  const phase = preload.phase ?? "checking-updates";
  const baseLabel = PHASE_LABELS[phase] ?? "Preparing workspace...";

  const preloadTotal = preload.queuedSelectionKeys.length
    + preload.loadingSelectionKeys.length
    + preload.readySelectionKeys.length
    + Object.keys(preload.failedSelectionKeys).length;
  const preloadDone = preload.readySelectionKeys.length
    + Object.keys(preload.failedSelectionKeys).length;
  const showProgress = phase === "loading-strategies" && preloadTotal > 0;
  const label = showProgress
    ? `${baseLabel}... (${preloadDone}/${preloadTotal})`
    : baseLabel;

  return (
    <div
      className="flex min-h-screen w-full items-center justify-center px-6 py-10"
      style={{ background: "var(--background, #f8f7f2)" }}
    >
      <div className="flex flex-col items-center gap-4">
        {/* Limni spinner — reuse from LimniLoading (see section 5) */}

        <p className="text-xs uppercase tracking-[0.25em]"
           style={{ color: "var(--muted, #6b7280)" }}>
          {label}
        </p>

        {showProgress ? (
          <div className="w-48">
            <div className="h-1 rounded-full" style={{ background: "var(--panel-border)" }}>
              <div
                className="h-1 rounded-full transition-all"
                style={{
                  background: "var(--accent)",
                  width: `${(preloadDone / preloadTotal) * 100}%`,
                }}
              />
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
```

### 4. Wire the gate into DashboardLayout

**File: `src/components/DashboardLayout.tsx`**

1. **Remove** lines 140-143 (`ensureStrategySession` + `startStrategySessionPreload` calls)
2. **Remove** the `ensureStrategySession` and `startStrategySessionPreload` imports
3. **Remove** the `DEFAULT_APP_STRATEGY_SELECTION` constant (lines 22-26 — now `FALLBACK_DEFAULT_SELECTION` in the registry)
4. **Wrap** the layout return in `AppPreloadGate`:

```tsx
import AppPreloadGate from "@/components/AppPreloadGate";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  // ... existing state, effects, handlers (minus the removed preload calls) ...

  return (
    <AppPreloadGate>
      <div className="relative flex min-h-screen bg-[var(--background)]">
        {/* ... existing sidebar + main content, unchanged ... */}
      </div>
    </AppPreloadGate>
  );
}
```

`DashboardLayout` becomes a pure layout shell. Zero preload logic.

### 5. Extract LimniLoading spinner

**File: `src/components/LimniLoading.tsx`**

Extract the spinner animation (rings + icon) into a reusable component or prop so `AppPreloadGate` renders the same visual. The gate needs the Limni spinner above the phase label text.

### 6. Clean up dead redirect routes

Remove `export const dynamic = "force-dynamic"` from these redirect-only files (a redirect does not need dynamic rendering):

- `src/app/antikythera/page.tsx`
- `src/app/sentiment/page.tsx`
- `src/app/flagship/page.tsx`
- `src/app/flagship/crypto/page.tsx`
- `src/app/flagship/intraday/page.tsx`
- `src/app/flagship/weekly-hold/page.tsx`

Keep the redirect logic for backward compatibility with old bookmarks.

## How Missing Weeks (May 4th) Get Fixed

1. User logs in → `AppPreloadGate` mounts → builds manifest from registry
2. Phase: **"Checking data versions..."** → `fetchStrategyArtifactStatus()` → versions match → proceed
3. Phase: **"Preparing active workspace..."** → `task.run()` → `ensureStrategySession` for active selection
4. Server: `loadStrategyPageData` → `ensureHistoricalWeekShardsForSelection`
5. Server: reads shards → all exist EXCEPT May 4th → `missingWeeks = ["2026-05-04T00:00:00.000Z"]`
6. Server: `computeAndPersistPermanentWeekShard` for May 4th only (skips all valid weeks)
7. Server: returns full data with May 4th rebuilt
8. Phase: **"Preparing strategy data... (5/30)"** → remaining selections via `task.run()`, concurrency 3
9. Phase: **"Computing live data..."** → current week computed
10. Phase: **ready** → `completedOnce = true` → gate lifts permanently → strategy switching instant

## How Deploys Are Handled

1. Code deploy changes engine version
2. User opens app → gate triggers `startStrategySessionPreload`
3. `completedOnce` is true, so gate doesn't block — but `checkVersionsAndRepreload` runs async
4. Version mismatch detected → `completedOnce` reset to false → preload state cleared → gate re-blocks
5. Full preload runs fresh → gate shows progress → lifts when done

## DashboardLayout Remount Safety

`DashboardLayout` is a client component rendered by each page's server component. It **remounts** on every page navigation. Without protection, the gate would flash on every navigation.

The `completedOnce` flag prevents this:
- First visit: `completedOnce = false` → gate blocks → preload runs → `completedOnce = true` → gate lifts
- Subsequent navigations: `completedOnce = true` → gate passes through immediately
- Deploy: `checkVersionsAndRepreload` detects change → resets `completedOnce` → gate re-blocks

## Cron Continues As Background Healer

The cron (`/api/cron/strategy-artifacts`, runs at `:40` every hour) is unchanged. Preload and cron are complementary.

## Acceptance Criteria

1. **Full-screen gate on login** — Limni spinner + phase labels. No page content until "ready".
2. **Phase labels are real** — only for phases with actual work. No fake "Loading market data..." until Phase 2 implements it.
3. **Active task derived from route** — deep-linking to `/performance?strategy=agree_3plus&f1=adr_grid` preloads that selection first.
4. **Fallback default in one place** — `FALLBACK_DEFAULT_SELECTION` in the registry.
5. **Missing weeks rebuilt during preload** — server-side shard repair happens via `ensureHistoricalWeekShardsForSelection`.
6. **Gate reappears after deploy** — version mismatch resets `completedOnce` → fresh progress.
7. **Strategy switching instant** after preload — cached in memory.
8. **Single preload owner** — `useStrategySession` does NOT trigger preload.
9. **Concurrency 3** for background tasks.
10. **No gate flash on navigation** — `completedOnce` prevents re-blocking after first preload.
11. **Status page bypasses gate** — `/status` always renders immediately.
12. **Task runners are self-contained** — each task carries `run()`, no dispatcher switch.
13. **Dead redirect routes cleaned** — `force-dynamic` removed from shims.
14. **Cron unchanged** — continues as hourly background healer.
15. **No regressions** — StrategyArtifactLoadingGate, Matrix/Performance views, API routes unchanged.

## Files to Modify

| File | Change |
|------|--------|
| `src/lib/preload/preloadRegistry.ts` | **NEW** — manifest builder with `run()` tasks, strategy domain only, centralized fallback default |
| `src/lib/performance/strategySessionStore.ts` | Add `PreloadPhase`, `phase` + `completedOnce` to state, `usePreloadStatus` hook, restructure `startStrategySessionPreload` to accept manifest + run tasks + version check + concurrency 3 + `completedOnce` guard, remove preload from `useStrategySession` |
| `src/components/AppPreloadGate.tsx` | **NEW** — full-screen gate with Limni spinner, phase labels, progress bar, `/status` bypass, `completedOnce` guard |
| `src/components/LimniLoading.tsx` | Extract spinner for reuse |
| `src/components/DashboardLayout.tsx` | Remove preload calls + default constant, wrap in `AppPreloadGate` |
| `src/app/antikythera/page.tsx` | Remove `force-dynamic` |
| `src/app/sentiment/page.tsx` | Remove `force-dynamic` |
| `src/app/flagship/page.tsx` | Remove `force-dynamic` |
| `src/app/flagship/crypto/page.tsx` | Remove `force-dynamic` |
| `src/app/flagship/intraday/page.tsx` | Remove `force-dynamic` |
| `src/app/flagship/weekly-hold/page.tsx` | Remove `force-dynamic` |

## Do NOT

- Do not hardcode strategy names, page names, or selection values in the gate or engine.
- Do not put preload progress in the sidebar.
- Do not change the cron route or schedule.
- Do not change `StrategyArtifactLoadingGate.tsx`, `strategyPageData.ts`, or any API routes.
- Do not add new API routes (those come in Phase 2/3).
- Do not add fake phases or delays for unimplemented domains.
- Do not let `useStrategySession` trigger global preload.
- Do not use a switch/stub dispatcher — tasks carry their own `run()`.
- Do not write a page-by-page audit into source code — keep any analysis in `docs/` if needed.

## Verification

1. `npm run lint` passes
2. `npx tsc --noEmit` passes
3. `npm test` passes
4. Open `/dashboard` → full-screen gate with phase labels advancing → gate lifts → dashboard renders
5. Open `/performance?strategy=agree_3plus` → gate preloads agree_3plus first → gate lifts → that strategy loaded
6. Navigate between pages → no gate flash, instant transitions
7. Open `/status` → renders immediately, no gate
8. Switch strategies → instant, no loading gate
9. Previously missing week (May 4th) is now present
10. Deploy new code → reopen app → gate reappears → fresh data loads → gate lifts
11. Redirect routes (`/antikythera`, `/sentiment`, `/flagship/*`) still redirect correctly
