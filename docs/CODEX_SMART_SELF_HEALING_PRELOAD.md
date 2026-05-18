# Codex Task: Smart Self-Healing Preload System

> Priority: CRITICAL — the app currently lazy-loads each strategy independently, causing slow page transitions and leaving broken/missing week shards unrepaired.

---

## Context

The shard-native "video game architecture" is now in place (`loadStrategyPageData` reads from `strategy_week_shards`, computes current week live, assembles in memory). However, three critical gaps remain:

1. **No session preload.** Each strategy loads independently when the user navigates to it. Strategy switching is slow because data is fetched on demand. The user should see a loading spinner on login that preloads the active selection, then everything is instant.

2. **Missing shards are not auto-repaired.** `loadStrategyPageData` only auto-repairs the previous week's shard (`onlyPreviousWeek: true`). If an older week's shard is missing or corrupt (e.g., May 4th has been broken for weeks), it stays broken forever. The system must self-heal — detect any missing shard and rebuild it on the fly.

3. **No smart invalidation.** After a deploy that changes the engine version, the app has no mechanism to detect "my shards are stale, I need to rebuild." It should compare the expected engine version against what's in the DB and trigger reconstruction only for what's changed.

## The Mental Model

**The app is a video game.** When you enter a zone (strategy selection), it loads that zone's data. If the zone's map data is missing or corrupted, it regenerates it. If the map data is current, it serves instantly. The user sees either a loading screen with progress or a fully loaded page — never broken data.

**The rule:** Data changed → reconstruct it. Data didn't change → don't touch it. No manual intervention ever.

**Critical invariant:** `loadStrategyPageData` may return partial historical data ONLY when `artifactMeta.missingWeeks.length > 0`. The UI must NEVER auto-select or render a missing week. Available weeks render normally; missing weeks stay out of `weekOptions` entirely. Repair continues in the background (cron) or on next page load. This is what "never broken data" means precisely: the user sees real data for available weeks, and missing weeks simply don't appear in the week selector until they're repaired.

---

## What Needs to Change

### 1. Backend: Auto-repair missing shards on page load (bounded budget)

**File:** `src/lib/performance/strategyPageData.ts`

**Current behavior (line 695):**
```typescript
const prepared = await ensureHistoricalWeekShardsForSelection(selection, {
  onlyPreviousWeek: true,
});
```

**Required behavior:**
```typescript
const prepared = await ensureHistoricalWeekShardsForSelection(selection, {
  onlyPreviousWeek: false,
  timeBudgetMs: PAGE_LOAD_SHARD_BUDGET_MS,
});
```

Add a **page-load-specific time budget** that is smaller than the default shard build budget. This allows the page load to repair a few missing shards without turning into a long spinner. The cron handles deeper repairs.

```typescript
const PAGE_LOAD_SHARD_BUDGET_MS = Number(
  process.env.PAGE_LOAD_SHARD_BUDGET_MS ?? "15000",
);
```

- **15 seconds** is enough to build ~3-5 missing shards (each takes 2-4s).
- If more shards are missing, the page returns partial data and the cron finishes the rest.
- The page still loads quickly — the user sees what's available plus whatever was just repaired.

### 2. Backend: Cron repairs ALL missing shards with global route budget

**File:** `src/app/api/cron/strategy-artifacts/route.ts`

**Current behavior (line 39):**
```typescript
const result = await ensureHistoricalWeekShardsForSelection(selection, {
  onlyPreviousWeek: true,
});
```

**Required behavior:**
```typescript
const result = await ensureHistoricalWeekShardsForSelection(selection, {
  onlyPreviousWeek: false,
  timeBudgetMs: perSelectionBudgetMs,
});
```

Add a **global route-level time budget** that prevents one selection from consuming the entire 120s max duration. Divide the budget across selections:

```typescript
const CRON_ROUTE_BUDGET_MS = 100_000; // 100s — leave 20s headroom for the 120s max duration
const startedAt = Date.now();

for (const selection of selections) {
  const elapsedMs = Date.now() - startedAt;
  if (elapsedMs >= CRON_ROUTE_BUDGET_MS) {
    // Route-level cutoff — remaining selections will be handled next cron cycle
    break;
  }
  const remainingMs = CRON_ROUTE_BUDGET_MS - elapsedMs;
  const perSelectionBudgetMs = Math.min(remainingMs, 20_000); // Max 20s per selection

  const result = await ensureHistoricalWeekShardsForSelection(selection, {
    onlyPreviousWeek: false,
    timeBudgetMs: perSelectionBudgetMs,
  });
  // ... rest of loop
}
```

- The cron runs hourly. With 30 selections, each gets up to 20s.
- If a selection has no missing shards, it returns instantly and the next selection gets more time.
- If many selections need repair, the cron handles as many as it can per cycle. Remaining ones are picked up in the next hourly run.

### 3. Backend: Engine version is per-selection, not one global value

**Important:** `buildStrategyArtifactEngineVersion` takes `entryStyle` and `riskOverlay` as inputs. Different f1/f2 combos produce different engine versions. A single top-level `engineVersion` in the status response would be wrong.

The status endpoint (`src/app/api/performance/strategy-artifacts/status/route.ts`) already returns `expectedEngineVersion` per artifact via `StrategyArtifactReadiness`. This is correct. Do NOT add a single top-level engine version.

**Instead, include `engineVersion` in `artifactMeta`** so the client gets it with every payload:

**File:** `src/lib/performance/strategyPageData.ts`

When building `artifactMeta` in `loadStrategyPageData` (around line 716), include the engine version:

```typescript
const artifactMeta: StrategyPageData["artifactMeta"] = {
  status: computedWeeks.length > 0 ? "patched" : "hit",
  selectionKey: context.selectionKey,
  cachedAtUtc: latestShardCachedAtUtc(shards),
  refreshedWeeks: computedWeeks,
  removedWeeks: [],
  missingWeeks,
  stale: false,
  staleReason: null,
  engineVersion: context.engineVersion, // <-- ADD THIS
};
```

**File:** `src/lib/performance/strategyPageData.ts` — update the `StrategyPageData["artifactMeta"]` type to include `engineVersion?: string`.

**File:** `src/lib/performance/strategyClientPayload.ts` — ensure `artifactMeta.engineVersion` is passed through to the client payload.

The client then stores and compares `engineVersion` per selection key when reading from the browser Cache API.

**File:** `src/lib/performance/strategyClientCache.ts`

When writing to the persistent payload cache, store the per-selection engine version:

```typescript
async function writePersistentPayload(url: string, data: StrategyClientPayload) {
  // ... existing logic ...
  window.localStorage.setItem(
    persistentPayloadMetaKey(absoluteUrl),
    JSON.stringify({
      storedAt: Date.now(),
      engineVersion: data.artifactMeta?.engineVersion ?? null,
    }),
  );
}
```

When reading, compare the stored engine version against what's in the new payload's `artifactMeta`:

```typescript
async function readPersistentPayload(
  url: string,
  selection: RuntimeStrategySelection,
  scope: StrategyClientPayloadScope,
): Promise<StrategyClientPayload | null> {
  // ... existing TTL check ...
  // Engine version check: if stored version doesn't match the one in the
  // latest status response for this selection, invalidate
  const storedMeta = readPersistentPayloadMeta(absoluteUrl);
  if (
    storedMeta?.engineVersion &&
    cachedSelectionEngineVersions.get(buildSelectionKey(selection)) &&
    storedMeta.engineVersion !== cachedSelectionEngineVersions.get(buildSelectionKey(selection))
  ) {
    await deletePersistentPayload(absoluteUrl);
    return null;
  }
  // ... rest of existing logic ...
}
```

The `cachedSelectionEngineVersions` map is populated once per session from the status endpoint response (each artifact already has `expectedEngineVersion`). This map is built in `fetchStrategyArtifactStatus`:

```typescript
const cachedSelectionEngineVersions = new Map<string, string>();

export async function fetchStrategyArtifactStatus(...) {
  // ... existing fetch ...
  // Populate engine version map for cache invalidation
  for (const artifact of status.artifacts) {
    cachedSelectionEngineVersions.set(artifact.key, artifact.expectedEngineVersion);
  }
  return status;
}
```

### 4. Frontend: Remove warm request dance, preload with backpressure

**File:** `src/lib/performance/strategySessionStore.ts`

**Changes to `ensureStrategySession` (line 224):**

Remove the warm request step entirely. The server now auto-repairs missing shards inline (change #1). The client flow becomes:

1. Check in-memory cache → if full payload exists, return instantly
2. Check browser persistent cache → if valid (not expired, engine version matches), return
3. Fetch from `/api/performance/strategy-page-data` → server reads shards + auto-repairs missing ones
4. If `artifactMeta.missingWeeks.length > 0`, some shards couldn't be built in the page-load budget. Mark the record but still show what we have. The cron will finish the rest.
5. If all weeks present, mark as fully ready.

Remove these lines (approximately lines 251-254 and 280-296):
```typescript
// DELETE: warm request step
if (warmMissingArtifact && (!payload || !hasFullPayload(payload))) {
  await requestStrategyArtifactWarm(selection);
  payload = await fetchStrategyClientPayload(selection, "full");
}

// DELETE: stale artifact re-warm
if (warmMissingArtifact && merged?.artifactMeta?.stale === true) {
  await requestStrategyArtifactWarm(selection);
  // ...
}
```

**Changes to `startStrategySessionPreload` (line 376):**

1. Load ALL visible strategies, not just ready ones:
```typescript
// BEFORE
const pending = status.artifacts
  .filter((artifact) => artifact.key !== activeKey && artifact.ready)

// AFTER
const pending = status.artifacts
  .filter((artifact) => artifact.key !== activeKey)
```

2. **Backpressure is already correct.** The existing code uses `workerCount = Math.min(1, ...)` which means concurrency of 1 (sequential). Keep this. The preload fetches one strategy at a time in the background, after the active selection is already loaded and the page is released.

3. **Load active first, release page, THEN preload.** This is already the behavior — `ensureStrategySession` loads the active selection, the gate releases when data arrives, then `startStrategySessionPreload` runs in the background. No change needed here.

### 5. Frontend: Generic loading labels (not fake progress)

**File:** `src/components/performance/StrategyArtifactLoadingGate.tsx`

With a single blocking API call, the client cannot know the server is on "week 3 of 17" — there is no streaming or progressive endpoint. **Do NOT fake progress labels.**

Instead, use phase-aware generic labels based on session status:

```typescript
type StrategyArtifactLoadingGateProps = {
  currentReady: boolean;
  pageLabel: string;
  children: ReactNode;
  phase?: "loading" | "current-week" | null;
};

export default function StrategyArtifactLoadingGate({
  currentReady,
  pageLabel,
  children,
  phase,
}: StrategyArtifactLoadingGateProps) {
  if (!currentReady) {
    const label = phase === "current-week"
      ? "Computing current week..."
      : `Loading ${pageLabel}...`;

    return (
      <div className="fixed inset-0 z-[100]">
        <LimniLoading label={label} compact />
      </div>
    );
  }

  return <>{children}</>;
}
```

Wire the `phase` prop from the session store:
- `session.status === "loading"` and `session.currentWeekStatus === "historical-only"` → `phase: "loading"`
- `session.currentWeekStatus === "current-loading"` → `phase: "current-week"`
- Otherwise → `null`

**Future upgrade path:** If page loads exceed 3 seconds, we can add a manifest/progressive endpoint where the client fetches week-by-week and shows real "Loading week 3 of 17..." progress. But that's a separate task — don't build it now.

### 6. Current week: candle-bucket cache, hourly auto-refresh

The current week's trade data is driven by hourly candles. Refreshing more frequently than hourly is wasteful — the underlying data hasn't changed. Refreshing less frequently means the user sees stale intraday positions.

**Server-side cache: candle-bucket key (NOT plain TTL)**

**File:** `src/lib/performance/strategyPageData.ts`

The current runtime cache key for current week data does NOT include a candle bucket. This means a 1-hour TTL creates a subtle bug: if the user logs in at 14:35 and the server caches the result, a 15:00 refresh still gets the 14:35 cached result (it doesn't expire until 15:35).

Fix: include the **hourly candle bucket** in the cache key so the cache naturally expires at each hour boundary:

```typescript
function currentHourBucket() {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-${String(now.getUTCDate()).padStart(2, "0")}T${String(now.getUTCHours()).padStart(2, "0")}`;
}
```

In `computeCurrentWeekResultCached` (around line 254), add the bucket to the cache key:

```typescript
const cacheKey = [
  "strategyCurrentWeek",
  buildStrategyRuntimeVersionKey(),
  selectionKey,
  currentWeekOpenUtc,
  entryStyle?.id ?? "weekly_hold",
  riskOverlay?.id ?? "none",
  currentHourBucket(), // <-- ADD THIS
].join(":");
```

Also add it to `computeCurrentWeekPathArtifactCached` (around line 284):

```typescript
const cacheKey = [
  "strategyCurrentWeekPath",
  buildStrategyRuntimeVersionKey(),
  selectionKey,
  entryStyle?.id ?? "weekly_hold",
  buildWeekResultRuntimeSignature(weekResult),
  currentHourBucket(), // <-- ADD THIS
].join(":");
```

Now the server cache naturally rotates at each hour boundary. A request at 14:59 and 15:01 use different cache keys — the 15:01 request computes fresh data from the latest hourly candle.

**Keep the TTL as a safety net** but it can stay at the existing 5-minute value (or increase to 1 hour — either works since the bucket key is the primary invalidation mechanism):

```typescript
const STRATEGY_CURRENT_WEEK_CACHE_TTL_MS = Number(
  process.env.STRATEGY_CURRENT_WEEK_CACHE_TTL_MS ?? "3600000",
);
```

**Client-side auto-refresh:**

**File:** `src/lib/performance/strategySessionStore.ts`

Add an hourly auto-refresh for the current week data:

1. **On login / session start:** always fetch fresh current week data (the existing `ensureCurrentWeekSession` call already does this).
2. **After login:** schedule a refresh at the next hour boundary, then repeat every hour.
3. **Only refresh the active selection's current week.** If the user switches strategies, the new one gets a fresh fetch. When they switch back, the cached data serves instantly until the next hourly tick.
4. **Key rule: current week data is fetched ONCE per strategy per hourly candle period.** Switching strategies does NOT trigger re-fetches. The only triggers are: (a) first load for that strategy in this session, (b) the hourly auto-refresh timer.

```typescript
let currentWeekRefreshTimer: ReturnType<typeof setTimeout> | null = null;
let currentWeekRefreshInterval: ReturnType<typeof setInterval> | null = null;

function scheduleHourlyCurrentWeekRefresh(selection: RuntimeStrategySelection) {
  clearHourlyCurrentWeekRefresh();

  const now = new Date();
  const msUntilNextHour =
    (60 - now.getMinutes()) * 60 * 1000 -
    now.getSeconds() * 1000 -
    now.getMilliseconds();

  currentWeekRefreshTimer = setTimeout(() => {
    void refreshCurrentWeekSession(selection);
    currentWeekRefreshInterval = setInterval(() => {
      void refreshCurrentWeekSession(selection);
    }, 3_600_000);
  }, Math.max(msUntilNextHour, 1000));
}

function clearHourlyCurrentWeekRefresh() {
  if (currentWeekRefreshTimer) {
    clearTimeout(currentWeekRefreshTimer);
    currentWeekRefreshTimer = null;
  }
  if (currentWeekRefreshInterval) {
    clearInterval(currentWeekRefreshInterval);
    currentWeekRefreshInterval = null;
  }
}
```

`refreshCurrentWeekSession` is the same as `ensureCurrentWeekSession` but bypasses the "already loaded" check — it always fetches fresh. Because the server cache key includes `currentHourBucket()`, the server computes fresh data from the latest candle.

5. **On strategy switch:** cancel existing timer, start new one for the new active selection. The previous strategy's current week stays cached — switching back serves from cache instantly.
6. **On page unmount / navigation away:** cancel the timer via `clearHourlyCurrentWeekRefresh()`.

Wire into `useStrategySession`:
```typescript
useEffect(() => {
  const activeSelection = { strategy, f1, f2 };
  setActiveStrategySessionSelection(activeSelection);
  void ensureStrategySession(activeSelection);
  scheduleHourlyCurrentWeekRefresh(activeSelection);
  if (options.preload !== false) {
    void startStrategySessionPreload(activeSelection);
  }
  return () => clearHourlyCurrentWeekRefresh();
}, [f1, f2, options.preload, strategy]);
```

**File:** `src/lib/performance/strategyClientCache.ts`

Add a `force` option to `fetchCurrentWeekStrategyClientPayload` so the hourly refresh bypasses the in-memory cache:

```typescript
export async function fetchCurrentWeekStrategyClientPayload(
  selection: RuntimeStrategySelection,
  scope: StrategyClientPayloadScope = "performance",
  options: { force?: boolean } = {},
): Promise<StrategyClientPayload | null> {
  const cacheKey = buildSelectionKey(selection);
  const inflightKey = `${cacheKey}:${scope}`;

  // When force=true, don't return from inflight — always issue a new fetch
  if (!options.force) {
    const inflight = currentWeekInflightCache.get(inflightKey);
    if (inflight) return inflight;
  }

  const request = (async () => {
    // ... existing retry logic, unchanged ...
  })().finally(() => {
    currentWeekInflightCache.delete(inflightKey);
  });

  currentWeekInflightCache.set(inflightKey, request);
  return request;
}
```

---

## What NOT to Change

- `strategyWeekShardCache.ts` — shard persistence layer is correct as-is
- `strategyArtifactVersions.ts` — version constants are correct
- `LimniLoading.tsx` — the spinner component is fine, just needs the right label
- `strategyClientPayload.ts` — only add `engineVersion` to `artifactMeta` passthrough

---

## Files to Modify

| File | Change |
|------|--------|
| `src/lib/performance/strategyPageData.ts` | `onlyPreviousWeek: false` + `PAGE_LOAD_SHARD_BUDGET_MS` (15s), add `engineVersion` to `artifactMeta`, candle-bucket cache key for current week |
| `src/app/api/cron/strategy-artifacts/route.ts` | `onlyPreviousWeek: false` + global route budget (100s) + per-selection cap (20s) |
| `src/lib/performance/strategySessionStore.ts` | Remove warm request dance, preload ALL strategies (keep concurrency=1), hourly current week auto-refresh with candle-aligned timer |
| `src/lib/performance/strategyClientCache.ts` | Per-selection engine version tracking in persistent cache, `force` option for current week fetch |
| `src/components/performance/StrategyArtifactLoadingGate.tsx` | Add `phase` prop for generic phase-aware labels (not fake week-by-week progress) |
| `src/components/performance/PerformanceStrategyViewSection.tsx` | Wire `phase` from session store to loading gate |
| `src/components/matrix/MatrixViewSection.tsx` | Same as above |

---

## Acceptance Criteria

1. **On login:** the active strategy loads with a spinner showing a generic phase label ("Loading Performance Page...", "Computing current week..."). Once loaded, ALL tabs and week switching for that strategy are instant.
2. **On strategy switch:** if the new strategy was preloaded in the background, switch is instant (no spinner). If not, show the spinner while it loads.
3. **Missing shards auto-repair:** if any historical week's shard is missing or corrupt, the page load rebuilds up to ~3-5 shards within 15s. Remaining missing shards are repaired by the hourly cron.
4. **After deploy with engine version change:** the first session detects per-selection version mismatch in browser cache, invalidates stale payloads, and triggers fresh loads from the server (which rebuilds shards at the new version).
5. **After deploy with NO engine version change:** cached data is still valid, no rebuild needed, instant load.
6. **The cron repairs ALL missing shards** with a global 100s route budget and 20s per-selection cap. Remaining selections are handled in the next hourly cycle.
7. **No manual intervention ever.** No Vercel cron UI, no burst mode, no admin endpoints. The system detects what's wrong and fixes it.
8. **Current week is fresh on login** — always computed from the latest candle data, never stale from a previous session.
9. **Current week auto-refreshes every hour** — aligned to the top of the hour (candle close). The user sees updated intraday positions without refreshing the page.
10. **No stale hourly data.** Server cache key includes the hourly candle bucket, so a refresh at 15:00 always gets data from the 15:00 candle, never the 14:35 cache.
11. **Switching strategies does NOT re-fetch current week.** Cached current week data sticks until the next hourly tick. Switching away and back serves from cache instantly.
12. **Background preload runs with backpressure.** Active selection loads first, page releases, then remaining strategies preload sequentially (concurrency=1) in the background.

---

## Testing

1. Load performance page → verify spinner shows with phase-aware label, then releases
2. Switch strategies → verify instant if preloaded, spinner if not
3. Delete a shard from the DB for a historical week → load that strategy → verify it auto-repairs (within 15s budget) and shows data
4. Delete shards for many weeks → verify page load repairs a few, then cron repairs the rest over subsequent cycles
5. Bump `STRATEGY_SHARD_ENGINE_VERSION` in `.env` → deploy → verify first load detects version change per selection and rebuilds
6. Verify May 4th week shows real data after loading (not 0% / empty)
7. Rapid strategy switching should never show broken data — only spinner or complete page
8. Leave app open for 2+ hours → verify current week data updates automatically at the top of each hour
9. Login at 14:35 → verify current week refreshes at ~15:00 with fresh candle data (not stale 14:35 cache)
10. Switch strategy A → B → A → verify A's current week is served from cache, no re-fetch
11. Verify cron doesn't exceed 120s even when many selections need repair
