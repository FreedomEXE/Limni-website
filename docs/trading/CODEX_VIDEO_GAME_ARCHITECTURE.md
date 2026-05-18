# Codex Task: Replace Artifact Pipeline with Video Game Architecture

> Priority: CRITICAL — the current architecture breaks every Sunday.
> This replaces the monolithic artifact + staleness system entirely.

---

## Context

The current performance data pipeline uses a monolithic cached artifact per strategy/filter combo (30 total) with fingerprint-based staleness detection. Every Sunday when the week anchor changes, all 30 artifacts go "stale" and must be rebuilt by a cron. This creates a weekly breakage cycle.

We have been patching this system for weeks. Burst modes, recompute notices, fallback chains — all of it is treating symptoms. The architecture is wrong.

## The New Architecture: "Video Game Loading"

The mental model: a video game loads its map data once. After that, it just renders. It doesn't re-download the map every time you open the menu.

### Core Principles

1. **Shards are the source of truth.** Each historical week has exactly one permanent, immutable shard per selection key + engine version. Once computed, never recomputed (unless engine version changes).

2. **Page load = read shards + compute current week.** No monolithic artifact needed. Read permanent shards from DB, compute current week live, assemble in memory, serve.

3. **Week finalization is the only write operation.** When a new week starts, the just-ended week gets one final shard computation. This is a one-time event, not a recurring rebuild.

4. **No staleness concept for shards.** A shard is either present or absent. If present, it's valid. No fingerprint comparison, no `stale_week`, no `stale_options`.

5. **The cron becomes minimal.** Its only job: check if the just-ended week's shard exists. If not, compute and persist it. Check if current week data is healthy. That's it. No 30-artifact rebuild cycle.

### Data Flow

```
[Page Load]
  1. Read all permanent shards for this selection key + engine version
  2. Compute current week live (trade results + path engine)
  3. Assemble into StrategyPageData in memory
  4. Serve to client
  → This should take 1-3 seconds max

[Week Transition (Sunday 23:00 UTC)]
  1. Cron detects new week anchor
  2. For each selection key: check if previous week has a shard
  3. If missing: compute the shard (trade results + path engine) and persist
  4. Done — one-time operation, not recurring

[Engine Version Change (deploy)]
  1. New engine version invalidates all shards
  2. Cron recomputes all shards (one-time migration)
  3. This is the ONLY scenario that triggers a full rebuild
```

### What Gets Removed

- `strategy_artifacts` table (monolithic cache) — no longer needed
- `StrategyArtifactFingerprint` and all fingerprint logic — no staleness
- `getArtifactStaleReason`, `getReadPathArtifactStaleReason` — gone
- `readReadyStrategyArtifactPayload` — replaced by direct shard reads
- `buildStrategyArtifact` — replaced by shard-only computation
- `overlayCurrentWeekOnStrategyPageData` — integrated into assembly
- `StrategyArtifactRecomputeNotice` — no stale states to show
- All fallback chains (monolithic → shards → singleWeekToSimulation)
- The complex `loadStrategyPageData` function with its 300+ lines of cache logic

### What Gets Kept

- `strategy_week_shards` table — this is the source of truth
- `readWeekShards` — reads all shards for a selection
- `persistWeekShard` — writes a single week's shard
- `computeBasketPathArrays` — the path engine (the actual computation)
- `singleWeekToSimulation` — ONLY for the current week live overlay, never persisted
- `assembleStrategyPageData` — assembles the final payload from shards + current week
- Week result computation (`weeklyHoldEngine`) — produces trade results per week

### New Read Path (replaces `readReadyStrategyArtifactPayload`)

```typescript
async function loadPerformanceData(
  selection: StrategyBootstrapSelection,
): Promise<StrategyPageData | null> {
  const selectionKey = buildStrategySelectionKey(selection);
  const biasSource = getStrategy(selection.strategyId);
  if (!biasSource) return null;

  const entryStyle = getEntryStyle(selection.f1);
  const riskOverlay = getStrengthGate(selection.f2);
  const engineVersion = buildStrategyArtifactEngineVersion({ entryStyle, riskOverlay });
  const currentWeekOpenUtc = getDisplayWeekOpenUtc();

  // 1. Read permanent shards (historical weeks)
  const shards = await readWeekShards(selectionKey, engineVersion);
  const historicalWeeks = shards
    .filter(s => s.weekOpenUtc !== currentWeekOpenUtc)
    .sort((a, b) => Date.parse(b.weekOpenUtc) - Date.parse(a.weekOpenUtc));

  // 2. Compute current week live
  const currentWeekResult = await computeCurrentWeekResult({
    selectionKey, biasSource, currentWeekOpenUtc, entryStyle, riskOverlay,
  });

  // 3. Assemble from shards + current week
  return assembleFromShards({
    biasSource, entryStyle, riskOverlay, currentWeekOpenUtc,
    historicalShards: historicalWeeks,
    currentWeekResult,
  });
}
```

### New Cron (replaces strategy-artifacts warm/burst logic)

```typescript
// Runs every hour. Lightweight check.
async function weekTransitionCron() {
  const currentWeekOpenUtc = getDisplayWeekOpenUtc();
  const previousWeekOpenUtc = getPreviousWeekOpenUtc();
  const selections = listVisibleStrategyBootstrapSelections();

  for (const selection of selections) {
    const selectionKey = buildStrategySelectionKey(selection);
    const engineVersion = buildEngineVersion(selection);

    // Check if previous week has a shard
    const shards = await readWeekShards(selectionKey, engineVersion);
    const hasPreviousWeek = shards.some(s => s.weekOpenUtc === previousWeekOpenUtc);

    if (!hasPreviousWeek) {
      // Compute and persist the shard for the just-ended week
      const weekResult = await computeWeekResult(selection, previousWeekOpenUtc);
      const path = await computeBasketPathArrays(weekResult, ...);
      await persistWeekShard({
        selectionKey, weekOpenUtc: previousWeekOpenUtc,
        engineVersion, weekResult, path, ...
      });
    }
  }
}
```

### Performance Considerations

- **First load after cold start:** reads ~16-17 shards from DB + computes current week. Should be 1-3 seconds.
- **Subsequent loads:** if we add an in-memory or edge cache, near-instant.
- **Week transition:** 30 selections × 1 shard computation each. Can run sequentially within the cron's 120s budget since each shard computation takes ~2-4 seconds.
- **No more 4+ hour rebuild windows.** Week transitions take one cron cycle.

### Migration Plan

1. Build the new `loadPerformanceData` function alongside the existing code
2. Wire it into the API routes (`strategy-page-data`, `strategy-current-week`)
3. Verify it produces identical output to the current system
4. Remove the old code (monolithic artifacts, fingerprints, staleness detection)
5. Simplify the cron to the week-finalization-only model

### Files to Modify

- `src/lib/performance/strategyArtifactReadiness.ts` — gut and simplify. Remove fingerprint/staleness. Keep shard reads.
- `src/lib/performance/strategyPageData.ts` — replace `loadStrategyPageData` with direct shard assembly. Remove 300+ lines of cache patching logic.
- `src/app/api/cron/strategy-artifacts/route.ts` — simplify to week-finalization only.
- `src/app/api/performance/strategy-page-data/route.ts` — call new read path.
- `src/app/api/performance/strategy-current-week/route.ts` — same.
- `src/lib/performance/strategyWeekShardCache.ts` — keep as-is (it's already shard-native).
- `src/components/performance/StrategyArtifactRecomputeNotice.tsx` — can be removed entirely (no stale states).

### Acceptance Criteria

1. Performance page loads in < 3 seconds on any strategy, any week, any time.
2. Sunday week transitions cause ZERO visible disruption.
3. Historical weeks never show broken/0% data (unless genuinely no data exists).
4. Strategy switching is instant (< 1 second) because there's no staleness check.
5. The cron runs once after week transition, finalizes one shard per selection, done.
6. No `strategy_artifacts` monolithic table dependency for serving data.
7. The only time all shards rebuild is an engine version change (explicit deploy event).

### Session Loading Model (CRITICAL UX)

Think of this like a video game. When you enter a zone, it loads that zone's data with a visible loading screen showing progress. Once loaded, everything in that zone is instant. When you move to a new zone, it loads that zone.

**On login / session start / page navigation:**

1. Show the `LimniLoading` spinner (already exists at `src/components/LimniLoading.tsx`)
2. The spinner label should show real-time progress:
   - "Loading week 1 of 17..."
   - "Loading week 2 of 17..."
   - "Loading week 17 of 17..."
   - "Computing current week..."
   - "Assembling strategy data..."
   - "Ready."
3. The loading gate (already exists at `src/components/performance/StrategyArtifactLoadingGate.tsx`) blocks rendering until complete
4. Once loaded, all week switching and tab switching is instant — data is in memory

**On strategy/filter change:**

1. Check if the new selection's data is already in the client cache (e.g., React state or context)
2. If yes → instant switch, no loading screen
3. If no → show spinner with progress, load from API, cache in memory

**On new session or returning after time away:**

1. The API checks: do all expected shards exist for this selection?
2. If yes → read and serve immediately (fast path)
3. If a shard is missing (e.g., just-ended week not yet finalized) → compute it on the fly, persist it, then serve
4. The user sees a loading spinner with progress, NOT a broken page or recompute notice

**Key rule: the user should NEVER see broken data, 0% dots, or "recomputing" banners.** They either see the loading spinner (data is being fetched/computed) or they see the fully loaded page. Nothing in between.

### API Response Shape for Progress

The API endpoint should support streaming or chunked progress. Options:

**Option A (simpler):** Single API call that returns all data. Loading spinner shows generic "Loading performance data..." with the Limni animation. Fast enough if shard reads are quick.

**Option B (progressive):** API returns a manifest first (list of weeks), then the client fetches each week's data individually. Loading spinner updates with real-time progress ("Loading week 3 of 17..."). More complex but better UX.

**Recommendation:** Start with Option A. If page load exceeds 3 seconds, upgrade to Option B.

### What Already Exists

- `LimniLoading` component — spinner with label prop (`src/components/LimniLoading.tsx`)
- `StrategyArtifactLoadingGate` — wraps page content, shows spinner until ready (`src/components/performance/StrategyArtifactLoadingGate.tsx`)
- These just need the label to show progress instead of a static "Loading..." message

### Testing

1. Load performance page for each strategy × entry style × overlay combo
2. Verify loading spinner shows with progress label
3. Switch between strategies rapidly — verify instant response (no spinner for cached data)
4. Switch between weeks — verify all historical weeks have data
5. Wait for a week transition — verify no disruption, just a brief spinner for the new week
6. Compare output against current system to ensure numerical parity
7. Test with slow connection — verify spinner stays visible until data is ready, never shows broken state
