# Codex Prompt: Weekly Data Pipeline Hardening

## Goal

Fix three critical issues in the weekly data pipeline that cause missing weeks, stale reports, and invisible snapshot provenance:

1. **Missing current week after Friday COT release** — The active trading week (still open) disappears from the Performance page week strip when the display anchor flips to next week
2. **Manual `CANONICAL_WEEKS` array** — The reconstruct-weekly-systems script requires a developer to manually add each new week. This must become automatic.
3. **No snapshot provenance** — The Data section shows "Last refresh" (when data was fetched) but not **what canonical snapshot** each week's signals are based on. We need to show the snapshot timestamp per data source per week.

## Problem 1: Missing Active Trading Week

### Root Cause

When it's Friday after 3:30 PM ET (COT release time), `getDisplayWeekOpenUtc()` in `src/lib/weekAnchor.ts` flips the "current" pointer forward to the upcoming week. This is correct behavior — after COT release, the default view should be next week's planned trades.

But the active trading week (e.g., Mar 30) is still open through Friday close (5 PM ET for FX, Sunday for crypto). After the display flip:

- The active week is **no longer `currentWeekOpenUtc`** (that's now the upcoming week)
- The active week may **not yet be in `pair_period_returns`** if the canonical-refresh cron hasn't run the final Friday close prices
- The active week may **not be in `performance_snapshots`** if the performance-refresh cron hasn't completed
- Result: the active week falls through both data sources and vanishes from the week strip

### Fix

In `src/lib/weekOptions.ts`, `buildDataWeekOptions()` needs to include **both** the display week (upcoming) AND the actual canonical trading week when they differ.

**File: `src/lib/weekAnchor.ts`**

Add a new export:

```typescript
/**
 * Returns the actual canonical trading week (always the current or most recent
 * Sunday 19:00 ET open), regardless of display anchor flip.
 * Use this when you need to guarantee the active trading week is represented.
 */
export function getActiveTradingWeekOpenUtc(now = DateTime.utc()): string {
  return getCanonicalWeekOpenUtc(now);
}
```

**File: `src/lib/weekOptions.ts`**

Modify `buildDataWeekOptions()` to accept an optional `activeTradingWeekOpenUtc` and always include it:

```typescript
type BuildDataWeekOptionsInput = {
  historicalWeeks: string[];
  currentWeekOpenUtc: string;
  activeTradingWeekOpenUtc?: string;  // NEW
  includeAll?: boolean;
  limit?: number;
  maxFutureWeeks?: number;
};

export function buildDataWeekOptions(input: BuildDataWeekOptionsInput): WeekOption[] {
  const {
    historicalWeeks,
    currentWeekOpenUtc,
    activeTradingWeekOpenUtc,
    includeAll = false,
    limit,
    maxFutureWeeks = 1,
  } = input;

  // Merge the active trading week into historical so it's never orphaned
  const mergedHistorical = activeTradingWeekOpenUtc
    ? [...historicalWeeks, activeTradingWeekOpenUtc]
    : historicalWeeks;

  const currentMs = DateTime.fromISO(currentWeekOpenUtc, { zone: "utc" }).toMillis();
  const futureCapMs =
    Number.isFinite(currentMs) && maxFutureWeeks >= 0
      ? currentMs + maxFutureWeeks * 7 * 24 * 60 * 60 * 1000
      : Number.POSITIVE_INFINITY;

  return buildNormalizedWeekOptions({
    historicalWeeks: mergedHistorical,
    currentWeekOpenUtc,
    includeAll,
    includeCurrent: true,
    includeFuture: true,
    currentPosition: "sorted",
    limit,
    filterWeek: (weekOpenUtc) => {
      const weekMs = DateTime.fromISO(weekOpenUtc, { zone: "utc" }).toMillis();
      if (!Number.isFinite(weekMs)) return false;
      return weekMs <= futureCapMs;
    },
  });
}
```

**File: `src/app/performance/page.tsx`**

Update the call site (~line 1094-1122):

```typescript
import { getDisplayWeekOpenUtc, getActiveTradingWeekOpenUtc } from "@/lib/weekAnchor";

// ...
const currentWeekOpenUtc = getDisplayWeekOpenUtc();
const activeTradingWeekOpenUtc = getActiveTradingWeekOpenUtc();

// ...
const weekOptions = buildDataWeekOptions({
  historicalWeeks,
  currentWeekOpenUtc,
  activeTradingWeekOpenUtc,
}) as string[];
```

**Apply the same fix everywhere `buildDataWeekOptions` is called:**
- `src/app/performance/page.tsx`
- `src/app/automation/research/universal/page.tsx`
- `src/app/automation/research/baskets/page.tsx`
- Any other call site (grep for `buildDataWeekOptions`)

### Acceptance Criteria — Problem 1

1. On Friday after 3:30 PM ET, both the upcoming week (Apr 6) AND the active trading week (Mar 30) appear in the week strip
2. The upcoming week is the default selected tab (display anchor behavior unchanged)
3. The active trading week shows its data normally (even if returns show 0% because the week is still in progress)
4. On Monday morning, the previous week becomes historical and the new week becomes both active and display — no gap
5. No duplicate weeks in the strip

## Problem 2: Manual CANONICAL_WEEKS

### Root Cause

`scripts/reconstruct-weekly-systems.ts` line 293-303 has a hardcoded `CANONICAL_WEEKS` array:

```typescript
export const CANONICAL_WEEKS = [
  "2026-01-19T00:00:00.000Z",
  "2026-01-26T00:00:00.000Z",
  // ... 9 entries total, ending at 2026-03-15
];
```

Every time a new week passes, someone has to manually add it to this array and re-run the script. The report JSON file (`reports/comprehensive-reconstruction.json`) then becomes stale.

### Fix

Replace the hardcoded array with a dynamic query that discovers all weeks with `performance_snapshots` data.

**File: `scripts/reconstruct-weekly-systems.ts`**

Replace the static `CANONICAL_WEEKS` with a function that queries the DB:

```typescript
async function discoverCanonicalWeeks(): Promise<string[]> {
  const { listPerformanceWeeks } = await import("../src/lib/performanceSnapshots");
  const weeks = await listPerformanceWeeks(52);  // up to 52 weeks
  // Sort ascending for reconstruction order
  return [...weeks].sort((a, b) => a.localeCompare(b));
}
```

Then at the top of `main()` or `runReconstruction()`:

```typescript
const CANONICAL_WEEKS = await discoverCanonicalWeeks();
if (CANONICAL_WEEKS.length === 0) {
  console.error("No performance snapshot weeks found in database.");
  process.exit(1);
}
console.log(`Discovered ${CANONICAL_WEEKS.length} canonical weeks.`);
```

Update every reference to the old `const CANONICAL_WEEKS` to use this dynamically loaded value.

**Important:** `listPerformanceWeeks()` in `src/lib/performanceSnapshots.ts` (line 159) already queries `performance_snapshots` for distinct `week_open_utc` values and normalizes them. This is the canonical source.

### Acceptance Criteria — Problem 2

1. `CANONICAL_WEEKS` is no longer a hardcoded array
2. The script discovers weeks dynamically from the `performance_snapshots` table
3. Running `npx tsx scripts/reconstruct-weekly-systems.ts` with no code changes picks up all available weeks including new ones
4. The output `reports/comprehensive-reconstruction.json` contains all discovered weeks in `canonical_weeks`
5. If no weeks exist in the DB, the script exits with a clear error message
6. Old static array is removed entirely

## Problem 3: Snapshot Provenance per Week

### Current State

The Data section (Dashboard, Antikythera, etc.) shows a `RefreshControl` component (`src/components/RefreshControl.tsx`) that displays "COT last: [timestamp]". This is the `fetched_at` field from `cot_snapshots` — it tells you when the cron last ran, NOT what snapshot the weekly signals are based on.

For each data source per week, we need to know the **canonical snapshot timestamp** — the exact moment the data was captured that drove that week's trading signals.

### Data Source Snapshot Timing

| Source | Canonical Snapshot Timing | Where Stored |
|--------|--------------------------|--------------|
| COT (Dealer, Commercial) | Friday ~3:30 PM ET when CFTC releases | `cot_snapshots.fetched_at` per `report_date` |
| Sentiment | Sunday 19:00 ET (week open lock) | `sentiment_daily_snapshots.snapshot_time_utc` |
| Strength | Hourly snapshots, canonical = Sunday 19:00 ET hour | `currency_strength_snapshots.snapshot_time_utc` |

### What to Build

#### 3a. New helper: `getWeekSnapshotProvenance(weekOpenUtc: string)`

**New file: `src/lib/performance/snapshotProvenance.ts`**

```typescript
export type SnapshotProvenance = {
  weekOpenUtc: string;
  cot: {
    reportDate: string | null;
    snapshotUtc: string | null;
    source: "cftc";
  };
  sentiment: {
    snapshotUtc: string | null;
    source: "sentiment_daily_snapshots";
  };
  strength: {
    snapshotUtc: string | null;
    source: "currency_strength_snapshots";
  };
};

export async function getWeekSnapshotProvenance(weekOpenUtc: string): Promise<SnapshotProvenance>;
```

Implementation:

1. **COT**: Derive the `report_date` for the week (existing `deriveCotReportDate(weekOpenUtc)`), then query `cot_snapshots` for the `MAX(fetched_at)` where `report_date = $1` and limit 1. That's the canonical COT snapshot time.

2. **Sentiment**: Query `sentiment_daily_snapshots` for the `snapshot_time_utc` where `snapshot_date_utc` = the week open date (Sunday). That's the sentiment lock time.

3. **Strength**: Query `currency_strength_snapshots` for the `MAX(snapshot_time_utc)` where `snapshot_time_utc <= weekOpenUtc` (at or before week open). That's the strength snapshot used.

#### 3b. Display snapshot provenance in the Data section

In each Data section page (Dashboard/Antikythera/COT sections), replace or augment the "last refresh" display with per-source snapshot timestamps for the selected week.

**Modify `src/components/RefreshControl.tsx`** to accept and display provenance:

```typescript
type RefreshControlProps = {
  lastRefreshUtc?: string | null;
  provenance?: {
    cot?: { label: string; snapshotUtc: string | null };
    sentiment?: { label: string; snapshotUtc: string | null };
    strength?: { label: string; snapshotUtc: string | null };
  } | null;
};
```

When provenance is provided, render:

```
Snapshot Timing
  COT:        Fri Mar 28, 3:32 PM ET
  Sentiment:  Sun Mar 29, 7:00 PM ET
  Strength:   Sun Mar 29, 7:00 PM ET
```

When provenance is not provided (null), fall back to the existing "COT last: ..." display for backward compatibility.

#### 3c. Wire provenance into the Performance page

The Performance page already knows the selected week. Pass it through to compute provenance:

```typescript
const provenance = selectedWeek !== "all"
  ? await getWeekSnapshotProvenance(selectedWeek)
  : null;
```

Display it in the sidebar or as a small info section below the week strip.

### Acceptance Criteria — Problem 3

1. New `getWeekSnapshotProvenance()` function returns COT, sentiment, and strength snapshot times per week
2. RefreshControl component can display per-source snapshot timestamps
3. When a specific week is selected, the snapshot provenance for that week is visible
4. When "All Time" is selected, provenance is hidden (not meaningful for aggregate)
5. Provenance data is server-side computed (no extra client API calls)
6. Existing "last refresh" display still works as fallback when provenance is not available

## Global: Automated Weekly Pipeline

### Current Manual Steps That Must Be Eliminated

Every week, to keep the system current, someone must:

1. Ensure `canonical-refresh` cron runs to populate `pair_period_returns` for the new week
2. Ensure `performance-refresh` cron runs to populate `performance_snapshots` for the new week
3. Manually add the new week to `CANONICAL_WEEKS` in the reconstruct script
4. Manually run `npx tsx scripts/reconstruct-weekly-systems.ts`
5. Commit and deploy the updated `comprehensive-reconstruction.json`

### Target State

Steps 1 and 2 already run automatically via Vercel cron jobs. Steps 3-5 are the manual bottleneck.

**Solution: Make the canonical report self-updating.**

Instead of reading from a static JSON file, the canonical performance report should be able to reconstruct from the database on-demand (with caching).

**Option A (Recommended): Cron-triggered reconstruction**

Add a new cron endpoint that runs the reconstruction automatically:

**New file: `src/app/api/cron/reconstruct-report/route.ts`**

```typescript
// Runs weekly (Saturday morning after all Friday data is settled)
// 1. Discovers all weeks from performance_snapshots
// 2. Runs the reconstruction logic
// 3. Writes updated comprehensive-reconstruction.json to filesystem
// 4. Clears the canonical report cache
```

This reuses the existing reconstruction logic from `scripts/reconstruct-weekly-systems.ts` but runs it as a cron job. The JSON file on disk serves as a warm cache — the cron keeps it fresh.

**Vercel cron config** (add to `vercel.json`):

```json
{
  "crons": [
    {
      "path": "/api/cron/reconstruct-report",
      "schedule": "0 8 * * 6"
    }
  ]
}
```

That's Saturday at 8 AM UTC — well after Friday markets close and all data settles.

### Acceptance Criteria — Automation

1. New cron endpoint at `/api/cron/reconstruct-report` exists
2. It discovers weeks dynamically (same as Problem 2 fix)
3. It writes the updated report JSON to the filesystem
4. It clears the runtime cache so the next page load picks up the new report
5. Manual script still works for local development / ad-hoc runs
6. The cron uses `isCronAuthorized()` for security (same pattern as other crons)

## File References

| File | Purpose | Changes |
|------|---------|---------|
| `src/lib/weekAnchor.ts` | Week anchor logic | Add `getActiveTradingWeekOpenUtc()` |
| `src/lib/weekOptions.ts` | Week strip builder | Accept `activeTradingWeekOpenUtc`, merge it in |
| `src/app/performance/page.tsx` | Performance page | Pass both display and active week |
| `src/app/automation/research/universal/page.tsx` | Research page | Same fix |
| `src/app/automation/research/baskets/page.tsx` | Baskets page | Same fix |
| `scripts/reconstruct-weekly-systems.ts` | Reconstruction script | Dynamic week discovery |
| `src/lib/performanceSnapshots.ts` | Snapshot store | Already has `listPerformanceWeeks()` |
| `src/lib/performance/snapshotProvenance.ts` | **NEW** — Provenance queries |
| `src/components/RefreshControl.tsx` | Refresh display | Add provenance display mode |
| `src/app/api/cron/reconstruct-report/route.ts` | **NEW** — Automated reconstruction cron |
| `src/lib/dataSectionWeeks.ts` | Data week listing | Reference only |
| `src/lib/sentiment/daily.ts` | Sentiment lock logic | Reference only |
| `src/lib/currencyStrength.ts` | Strength snapshots | Reference only |
| `src/lib/cotStore.ts` | COT snapshot timing | Reference only |

## Problem 4: Formalize Strength Weekly Lock

### Current State

Strength has **no weekly lock mechanism**. Unlike sentiment (which reads from `sentiment_aggregates` locked at week open), strength is read live from `currency_strength_snapshots` and `asset_strength_snapshots` via:

```sql
-- src/lib/strength/weeklyStrength.ts lines 141-156
SELECT DISTINCT ON ("window", currency)
       "window", currency, snapshot_time_utc, raw_strength, normalized_strength
  FROM currency_strength_snapshots
 WHERE snapshot_time_utc <= $1::timestamptz
   AND "window" IN ('1h', '4h', '24h')
 ORDER BY "window", currency, snapshot_time_utc DESC
```

This query selects the latest hourly snapshot at or before `weekOpenUtc`. Because hourly snapshots only grow forward (newer timestamps), historical lookups are functionally stable — the same query for a past week returns the same result. But there's no explicit frozen record, and the runtime cache TTL is only 30 seconds.

### Why This Matters

Strength participates in voting for 4+ strategies:
- `agree_2of3_nocomm` (2-of-3 agreement: Dealer, Sentiment, **Strength**)
- `tiered_3_nocomm` (3-source tiered: Dealer, Sentiment, **Strength**)
- `strength` (standalone)
- `tandem` (independent sleeve)
- `selector_sentiment_override` (tiebreak role)

At Sunday 19:00 ET (week open), the strength 1h/4h windows reflect mostly flat weekend prices. This is fine — backtests already use this timing and the system works. But we need the data frozen explicitly so there's no ambiguity.

### Fix: Create `strength_weekly_snapshots` Table

**New migration:**

```sql
CREATE TABLE IF NOT EXISTS strength_weekly_snapshots (
  week_open_utc TIMESTAMP NOT NULL,
  source_type VARCHAR(20) NOT NULL,  -- 'currency' or 'asset'
  "window" VARCHAR(10) NOT NULL,     -- '1h', '4h', '24h'
  key VARCHAR(30) NOT NULL,          -- currency code (EUR, USD...) or asset symbol (BTC, ETH...)
  asset_class VARCHAR(20),           -- null for currency, 'crypto'/'commodities'/'indices' for asset
  raw_strength DECIMAL(12, 6),
  normalized_strength DECIMAL(12, 6),
  source_snapshot_utc TIMESTAMP,     -- the original hourly snapshot this was locked from
  locked_at_utc TIMESTAMP NOT NULL DEFAULT NOW(),
  PRIMARY KEY (week_open_utc, source_type, "window", key)
);
```

**New lock function in `src/lib/strength/weeklyStrength.ts`:**

```typescript
export async function lockStrengthForWeek(weekOpenUtc: string): Promise<void> {
  // 1. Read current strength using existing readCurrencyStrengthRows + readAssetStrengthRows
  // 2. Upsert all rows into strength_weekly_snapshots with week_open_utc
  // 3. This is idempotent — re-locking overwrites with same data
}

export async function readLockedStrengthForWeek(weekOpenUtc: string): Promise<...> {
  // Read from strength_weekly_snapshots instead of live tables
  // Falls back to live query if no locked data exists (backward compat)
}
```

**Modify `readWeeklyPairStrengths()` to prefer locked data:**

```typescript
export async function readWeeklyPairStrengths(weekOpenUtc: string): Promise<WeeklyPairStrength[]> {
  // Try locked data first
  const locked = await readLockedStrengthForWeek(weekOpenUtc);
  if (locked) return buildPairStrengthsFromLocked(locked);
  // Fall back to live query (existing behavior)
  return buildPairStrengthsFromLive(weekOpenUtc);
}
```

**Trigger the lock:**

Add to the sentiment-daily API or a new cron endpoint that runs at Sunday 19:00 ET:

```typescript
// When locking sentiment for the new week, also lock strength
await lockStrengthForWeek(weekOpenUtc);
```

Or add to the existing `sentiment-refresh` cron — after sentiment aggregates are updated, check if it's a new week open and lock strength too.

### Acceptance Criteria — Problem 4

1. `strength_weekly_snapshots` table created with auto-migration
2. `lockStrengthForWeek()` function persists frozen strength data for a given week
3. `readWeeklyPairStrengths()` prefers locked data, falls back to live
4. Lock is triggered at week open (Sunday 19:00 ET) alongside sentiment
5. Historical weeks without locked data continue working via live fallback
6. All strength-dependent strategies produce identical results with locked vs live data for past weeks
7. Idempotent — re-locking the same week is safe

## Problem 5: Upcoming Week Basket Pending State

### Current State

After Friday 3:30 PM ET (COT release), the display anchor flips to the upcoming week. The upcoming week tab shows but with 0.00% returns and no trade details. This is confusing — users don't know whether the basket is empty, incomplete, or just waiting for data.

### Signal Availability Timeline

| Time | COT | Sentiment | Strength | Basket Status |
|------|-----|-----------|----------|---------------|
| Friday 3:30 PM ET | Available | Previous week's lock | Previous week's data | **Partial** — COT only |
| Saturday | Available | Stale (no refresh) | Stale | **Partial** |
| Sunday 19:00 ET | Available | **Locks for new week** | **Locks for new week** | **Complete** |

The basket should show different states:

1. **Friday 3:30 PM to Sunday 19:00 ET:** Show COT-derived signals (dealer, commercial directions) with a banner: `"Basket pending — Sentiment & Strength lock at week open (Sun 7 PM ET)"`
2. **Sunday 19:00 ET onward:** Full basket with all signals locked. Banner removed.

### What to Build

**New helper: `getWeekSignalReadiness(weekOpenUtc: string)`**

**File: `src/lib/performance/signalReadiness.ts`**

```typescript
export type SignalReadiness = {
  weekOpenUtc: string;
  cot: { ready: boolean; lockedUtc: string | null };
  sentiment: { ready: boolean; lockedUtc: string | null };
  strength: { ready: boolean; lockedUtc: string | null };
  basketComplete: boolean;
  pendingMessage: string | null;
};

export async function getWeekSignalReadiness(weekOpenUtc: string): Promise<SignalReadiness> {
  // For historical/current weeks: all signals are ready
  // For upcoming week:
  //   COT ready = cot_snapshots exists for this week's report_date
  //   Sentiment ready = sentiment lock exists for this week's open date
  //   Strength ready = strength_weekly_snapshots exists for this week
  //   basketComplete = all three ready
  //   pendingMessage = human-readable status if not complete
}
```

**Display in Performance page and Matrix:**

When viewing an upcoming week where `basketComplete === false`:

- Show the available signals (COT pairs + directions) in the basket/trade view
- Display a subtle banner above the trade list: the `pendingMessage` string
- Pair rows for sentiment/strength-dependent strategies show "Pending" in the direction column until those signals lock

When `basketComplete === true`:
- Normal display, no banner

### Acceptance Criteria — Problem 5

1. `getWeekSignalReadiness()` returns per-source readiness for any week
2. Upcoming weeks between Friday COT release and Sunday 19:00 ET show partial basket with pending banner
3. COT-only signals are visible during the pending window
4. After Sunday 19:00 ET, all signals resolve and banner disappears
5. Historical weeks always show `basketComplete: true`
6. The pending state is computed server-side and passed to components

## Updated File References

| File | Purpose | Changes |
|------|---------|---------|
| `src/lib/weekAnchor.ts` | Week anchor logic | Add `getActiveTradingWeekOpenUtc()` |
| `src/lib/weekOptions.ts` | Week strip builder | Accept `activeTradingWeekOpenUtc`, merge it in |
| `src/app/performance/page.tsx` | Performance page | Pass both display and active week, wire provenance + readiness |
| `src/app/automation/research/universal/page.tsx` | Research page | Same week fix |
| `src/app/automation/research/baskets/page.tsx` | Baskets page | Same week fix |
| `scripts/reconstruct-weekly-systems.ts` | Reconstruction script | Dynamic week discovery |
| `src/lib/performanceSnapshots.ts` | Snapshot store | Already has `listPerformanceWeeks()` |
| `src/lib/performance/snapshotProvenance.ts` | **NEW** — Provenance queries |
| `src/lib/performance/signalReadiness.ts` | **NEW** — Per-source readiness checks |
| `src/lib/strength/weeklyStrength.ts` | Strength reading | Add lock/read locked functions, prefer locked data |
| `src/components/RefreshControl.tsx` | Refresh display | Add provenance display mode |
| `src/app/api/cron/reconstruct-report/route.ts` | **NEW** — Automated reconstruction cron |
| `src/lib/dataSectionWeeks.ts` | Data week listing | Reference only |
| `src/lib/sentiment/daily.ts` | Sentiment lock logic | Reference only |
| `src/lib/currencyStrength.ts` | Strength snapshots | Reference only |
| `src/lib/cotStore.ts` | COT snapshot timing | Reference only |
| `db/schema.sql` or new migration | DB schema | Add `strength_weekly_snapshots` table |

## Overall Acceptance Criteria

1. Active trading week never disappears from the week strip, regardless of day/time
2. Upcoming week appears correctly after Friday COT release
3. No manual `CANONICAL_WEEKS` maintenance required
4. Reconstruction runs automatically via cron every Saturday
5. Each week shows per-source snapshot timestamps (COT, Sentiment, Strength)
6. "Weeks Tracked" count updates automatically as new weeks are added
7. Strength has a formal weekly lock table, locked at Sunday 19:00 ET alongside sentiment
8. Upcoming week shows partial basket (COT only) with pending banner until all signals lock
9. All existing functionality (performance cards, sidebar stats, basket view) continues working
10. All strength-dependent strategies produce identical results with locked data
11. Include the standard file header on all new files (Property of Freedom_EXE (c) 2026)
12. No new npm dependencies
