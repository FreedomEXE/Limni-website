# Codex Prompt: Unified Weekly Anchor & Pipeline Hardening

## Goal

Unify the entire weekly system around **one shared anchor time** — Sunday 7:00 PM ET — for price windows, signal locks, display logic, and backtests. Then harden the pipeline so no week ever goes missing and every data source shows its canonical snapshot provenance.

This is a **foundational change**. Every weekly return, every backtest, every signal lock must use the same start time. No more hybrid windows where FX starts at 5 PM, indices at 6 PM, and signals lock at 7 PM. One time. One truth.

---

## Part 1: Unified Price Windows

### Current State (BROKEN)

**File: `src/lib/canonicalPriceWindows.ts` lines 75-105**

```typescript
// Current — different open times per asset class:
if (assetClass === "fx") {
  return {
    periodOpenUtc: canonicalWeekOpenUtc,
    openUtc: weekKey.minus({ hours: 2 }),   // Sunday 5 PM ET — 2h BEFORE signal lock
    closeUtc: weekKey.plus({ hours: 118 }), // Friday 5 PM ET
  };
}
if (assetClass === "indices" || assetClass === "commodities") {
  return {
    periodOpenUtc: canonicalWeekOpenUtc,
    openUtc: weekKey.minus({ hours: 1 }),   // Sunday 6 PM ET — 1h BEFORE signal lock
    closeUtc: weekKey.plus({ hours: 117 }), // Friday 4 PM ET
  };
}
// crypto: weekKey or weekKey+1h to weekKey+7d
```

**Why this is wrong:** Signals (sentiment, strength, COT) lock at Sunday 7 PM ET. But FX price returns start at 5 PM — capturing 2 hours of price action that a real trader couldn't have acted on because signals weren't available yet. Backtests using this window are unrealistic.

### Fix

**File: `src/lib/canonicalPriceWindows.ts`**

Replace `getCanonicalWeekWindow()` so ALL asset classes open at `weekKey` (Sunday 7 PM ET):

```typescript
export function getCanonicalWeekWindow(
  weekOpenUtc: string,
  assetClass: AssetClass,
): CanonicalPriceWindow {
  const canonicalWeekOpenUtc = normalizeWeekOpenUtc(weekOpenUtc) ?? weekOpenUtc;
  const weekKey = parseWeekOpenUtc(canonicalWeekOpenUtc);

  if (assetClass === "crypto") {
    // Crypto: Sunday 7 PM ET → next Sunday 7 PM ET (168h / 7 full days)
    return {
      periodOpenUtc: canonicalWeekOpenUtc,
      openUtc: weekKey,
      closeUtc: weekKey.plus({ days: 7 }),
    };
  }

  // FX, indices, commodities: Sunday 7 PM ET → Friday 5 PM ET (118h)
  return {
    periodOpenUtc: canonicalWeekOpenUtc,
    openUtc: weekKey,
    closeUtc: weekKey.plus({ hours: 118 }),
  };
}
```

**Result:** All non-crypto assets get a 118h window (Sun 7 PM → Fri 5 PM). Crypto gets 168h (Sun 7 PM → Sun 7 PM). Entry price = signal lock time = Sunday 7 PM ET. No asset gets a head start.

### Daily windows

Also review `listCanonicalDailyWindowsForWeek()` (lines 141-161). The daily sub-windows should start from the unified `weekly.openUtc` (no longer offset). The first trading day starts at `weekKey` and runs 24h (or 23h for indices/commodities if that's the existing convention). Keep the daily close-offset logic (`closeOffsetHours`) as-is — only the weekly open changes.

### Acceptance Criteria — Part 1

1. `getCanonicalWeekWindow("2026-03-30T23:00:00.000Z", "fx")` returns `openUtc` = Sunday 7 PM ET (the weekKey itself), NOT Sunday 5 PM ET
2. `getCanonicalWeekWindow("2026-03-30T23:00:00.000Z", "indices")` returns `openUtc` = Sunday 7 PM ET, NOT Sunday 6 PM ET
3. `getCanonicalWeekWindow("2026-03-30T23:00:00.000Z", "crypto")` returns `openUtc` = Sunday 7 PM ET
4. All non-crypto close at `weekKey + 118h` (Friday 5 PM ET)
5. Crypto closes at `weekKey + 7 days`
6. No per-asset-class offset on open times — everyone starts at weekKey
7. `listCanonicalDailyWindowsForWeek()` daily sub-windows align with the new unified open

---

## Part 2: Remove Display Anchor Flip

### Current State (BROKEN)

**File: `src/lib/weekAnchor.ts` lines 39-61**

`getDisplayWeekOpenUtc()` flips to the NEXT week after Friday 3:30 PM ET (COT release time). This causes:
- The current trading week (still active through Friday close) to **disappear** from the week strip
- The upcoming week (no trades yet) to become the "current" display
- Confusion about which week is active

**39 files** import `getDisplayWeekOpenUtc`. They all just want "what week should I show by default."

### Fix

**File: `src/lib/weekAnchor.ts`**

Make `getDisplayWeekOpenUtc()` return the canonical week — remove the Friday flip:

```typescript
export function getDisplayWeekOpenUtc(now = DateTime.utc()): string {
  return getCanonicalWeekOpenUtc(now);
}
```

**Why keep the function instead of deleting it:** 39 files import it. Replacing all imports is unnecessary churn. Making it an alias is safe and zero-risk. Every caller gets the current trading week until the next Sunday 7 PM ET, which is exactly what they need.

The current week stays "current" through the entire week lifecycle:
```
Monday–Friday:  Current week active, showing live returns
Friday 3:30 PM: COT drops → upcoming week signals start building
Saturday–Sunday: Current week still shows as "current" with settled returns
Sunday 7:00 PM: New week begins. Previous week becomes historical.
```

### Upcoming Week Tab

The upcoming week should appear as an **additional tab** in the week strip — NOT as a replacement for the current week. It appears when any signal data exists for the next week (typically after Friday COT release).

**File: `src/lib/weekOptions.ts`**

Modify `buildDataWeekOptions()` to always include the upcoming week (currentWeek + 7 days) in the strip. The existing `maxFutureWeeks: 1` + `includeFuture: true` already allow this — we just need to inject the upcoming week into the historical weeks list:

```typescript
export function buildDataWeekOptions(input: BuildDataWeekOptionsInput): WeekOption[] {
  const {
    historicalWeeks,
    currentWeekOpenUtc,
    includeAll = false,
    limit,
    maxFutureWeeks = 1,
  } = input;

  const currentMs = DateTime.fromISO(currentWeekOpenUtc, { zone: "utc" }).toMillis();
  const futureCapMs =
    Number.isFinite(currentMs) && maxFutureWeeks >= 0
      ? currentMs + maxFutureWeeks * 7 * 24 * 60 * 60 * 1000
      : Number.POSITIVE_INFINITY;

  // Always inject the upcoming week so it appears in the strip
  const upcomingWeekUtc = DateTime.fromISO(currentWeekOpenUtc, { zone: "utc" })
    .plus({ days: 7 })
    .toUTC()
    .toISO();
  const mergedHistorical = [...historicalWeeks];
  if (upcomingWeekUtc && !mergedHistorical.includes(upcomingWeekUtc)) {
    mergedHistorical.push(upcomingWeekUtc);
  }

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

The signal readiness system (Part 6) handles showing the upcoming week as "pending" when not all signals are locked.

### Acceptance Criteria — Part 2

1. On Friday after 3:30 PM ET: the **current** trading week is still the default selected tab
2. The **upcoming** week appears as an additional tab in the strip (not replacing current)
3. On Saturday/Sunday: current week still shows as default
4. On Sunday 7 PM ET: the new week becomes current, previous becomes historical
5. No week ever disappears from the strip during its active lifecycle
6. `getDisplayWeekOpenUtc()` signature and return type unchanged (still `string`)
7. All 39 importers of `getDisplayWeekOpenUtc` continue working without changes

---

## Part 3: Dynamic CANONICAL_WEEKS in Reconstruct Script

### Current State (BROKEN)

**File: `scripts/reconstruct-weekly-systems.ts` lines 293-303**

```typescript
export const CANONICAL_WEEKS = [
  "2026-01-19T00:00:00.000Z",
  "2026-01-26T00:00:00.000Z",
  // ... hardcoded 9 entries ending at 2026-03-15
];
```

Must be manually updated every week. Meanwhile, `src/lib/canonicalPriceWindows.ts` already has a dynamic `buildCanonicalWeeks()` (lines 28-55) that generates weeks from a start date.

### Fix

**File: `scripts/reconstruct-weekly-systems.ts`**

Replace the hardcoded `CANONICAL_WEEKS` with a dynamic DB query:

```typescript
import { CANONICAL_WEEKS as DYNAMIC_WEEKS } from "../src/lib/canonicalPriceWindows";

async function discoverCanonicalWeeks(): Promise<string[]> {
  // Primary: query performance_snapshots for all distinct weeks
  try {
    const { listPerformanceWeeks } = await import("../src/lib/performanceSnapshots");
    const dbWeeks = await listPerformanceWeeks(52);
    if (dbWeeks.length > 0) {
      return [...dbWeeks].sort((a, b) => a.localeCompare(b));
    }
  } catch {
    // DB unavailable — fall back to dynamic time-based list
  }
  // Fallback: use the dynamic builder from canonicalPriceWindows
  return [...DYNAMIC_WEEKS];
}
```

Then at the top of `main()`:

```typescript
const CANONICAL_WEEKS = await discoverCanonicalWeeks();
if (CANONICAL_WEEKS.length === 0) {
  console.error("No canonical weeks found.");
  process.exit(1);
}
console.log(`Discovered ${CANONICAL_WEEKS.length} canonical weeks.`);
```

Remove the old static array entirely.

### Acceptance Criteria — Part 3

1. No hardcoded week array in `reconstruct-weekly-systems.ts`
2. Weeks discovered dynamically from DB (with fallback)
3. Running `npx tsx scripts/reconstruct-weekly-systems.ts` picks up all available weeks including new ones
4. Old static `CANONICAL_WEEKS` export removed
5. If DB has no weeks, falls back to time-based generation from `canonicalPriceWindows`

---

## Part 4: Strength Weekly Lock

### Current State

Strength has **no weekly lock**. It reads live from `currency_strength_snapshots` and `asset_strength_snapshots`:

**File: `src/lib/strength/weeklyStrength.ts` lines 141-156**

```sql
SELECT DISTINCT ON ("window", currency)
       "window", currency, snapshot_time_utc, raw_strength, normalized_strength
  FROM currency_strength_snapshots
 WHERE snapshot_time_utc <= $1::timestamptz
   AND "window" IN ('1h', '4h', '24h')
 ORDER BY "window", currency, snapshot_time_utc DESC
```

Functionally stable for historical weeks (hourly snapshots only grow forward), but no explicit frozen record.

### Fix

#### 4a. New table

**File: `db/schema.sql`** (add to schema) and auto-migrate in store:

```sql
CREATE TABLE IF NOT EXISTS strength_weekly_snapshots (
  week_open_utc TIMESTAMP NOT NULL,
  source_type VARCHAR(20) NOT NULL,      -- 'currency' or 'asset'
  "window" VARCHAR(10) NOT NULL,         -- '1h', '4h', '24h'
  key VARCHAR(30) NOT NULL,              -- currency code (EUR, USD) or asset symbol (BTC, SPX)
  asset_class VARCHAR(20),               -- null for currency, 'crypto'/'commodities'/'indices' for asset
  raw_strength DECIMAL(12, 6),
  normalized_strength DECIMAL(12, 6),
  source_snapshot_utc TIMESTAMP,         -- original hourly snapshot this was locked from
  locked_at_utc TIMESTAMP NOT NULL DEFAULT NOW(),
  PRIMARY KEY (week_open_utc, source_type, "window", key)
);
```

#### 4b. Lock and read functions

**File: `src/lib/strength/weeklyStrength.ts`**

Add:

```typescript
export async function lockStrengthForWeek(weekOpenUtc: string): Promise<void> {
  // 1. Read currency strength via existing readCurrencyStrengthRows(weekOpenUtc)
  // 2. Read asset strength via existing readAssetStrengthRows(weekOpenUtc)
  // 3. Upsert all rows into strength_weekly_snapshots
  //    - source_type = 'currency' or 'asset'
  //    - source_snapshot_utc = the snapshot_time_utc from the source row
  // 4. Idempotent: ON CONFLICT DO UPDATE
}

export async function readLockedStrengthForWeek(weekOpenUtc: string): Promise<{
  currency: CurrencyStrengthRow[];
  asset: AssetStrengthRow[];
} | null> {
  // Read from strength_weekly_snapshots WHERE week_open_utc = $1
  // Return null if no locked data (triggers fallback to live)
  // Map rows back to CurrencyStrengthRow / AssetStrengthRow format
}
```

#### 4c. Prefer locked data in existing reads

Modify `readWeeklyPairStrengths()` (or wherever the weekly basket reads strength):

```typescript
// Try locked data first
const locked = await readLockedStrengthForWeek(weekOpenUtc);
if (locked) return buildPairStrengthsFromLocked(locked);
// Fall back to live query (existing behavior for historical weeks without locks)
return buildPairStrengthsFromLive(weekOpenUtc);
```

#### 4d. Trigger the lock

Add strength locking alongside sentiment. When the sentiment-daily API or cron runs for a new week open, also call `lockStrengthForWeek(weekOpenUtc)`.

Check where sentiment gets locked — likely in `src/app/api/flagship/sentiment-daily/route.ts` or a cron. Add a call to `lockStrengthForWeek()` at the same point.

### Acceptance Criteria — Part 4

1. `strength_weekly_snapshots` table created with auto-migration (`ensureStrengthWeeklySchema()`)
2. `lockStrengthForWeek()` persists frozen strength data for a given week
3. `readLockedStrengthForWeek()` reads frozen data, returns null if missing
4. Existing strength reads prefer locked data, fall back to live
5. Lock triggered at week open alongside sentiment
6. Historical weeks without locked data continue working via live fallback
7. Idempotent — re-locking same week is safe (ON CONFLICT UPDATE)
8. All strength-dependent strategies produce identical results with locked vs live for past weeks

---

## Part 5: Snapshot Provenance

### What to Build

For each week, show the canonical snapshot timestamp per data source — not "last refresh" but "what snapshot drove this week's signals."

#### 5a. Provenance helper

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
    source: "strength_weekly_snapshots" | "currency_strength_snapshots";
  };
};

export async function getWeekSnapshotProvenance(weekOpenUtc: string): Promise<SnapshotProvenance>;
```

Implementation:
1. **COT**: Derive `report_date` for the week (use existing `deriveCotReportDate()`), query `cot_snapshots` for `MAX(fetched_at)` where `report_date = $1`
2. **Sentiment**: Query `sentiment_daily_snapshots` for `snapshot_time_utc` where week matches
3. **Strength**: Query `strength_weekly_snapshots` for `locked_at_utc` where `week_open_utc = $1`. If no locked record, query `currency_strength_snapshots` for `MAX(snapshot_time_utc) WHERE snapshot_time_utc <= $1`

#### 5b. Display provenance in UI

**Modify `src/components/RefreshControl.tsx`** to accept optional provenance:

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

When provenance is provided, render snapshot timestamps per source:
```
Snapshot Timing:
  COT:         Fri Mar 28, 3:32 PM ET
  Sentiment:   Sun Mar 30, 7:00 PM ET
  Strength:    Sun Mar 30, 7:00 PM ET
```

When provenance is null, fall back to existing "Last refresh" display.

#### 5c. Wire into Performance page

The Performance page knows the selected week. Compute provenance server-side and pass it to RefreshControl:

```typescript
const provenance = selectedWeek !== "all"
  ? await getWeekSnapshotProvenance(selectedWeek)
  : null;
```

### Acceptance Criteria — Part 5

1. `getWeekSnapshotProvenance()` returns COT, sentiment, strength snapshot times per week
2. RefreshControl displays per-source timestamps when provenance is provided
3. When "All Time" is selected, provenance is hidden
4. Provenance computed server-side (no extra client API calls)
5. Existing "Last refresh" display works as fallback

---

## Part 6: Signal Readiness & Pending Basket State

### Problem

After Friday COT release, the upcoming week tab appears but shows empty data. Users can't tell if the basket is empty, incomplete, or waiting for signals.

### Signal Availability Timeline

| Time | COT | Sentiment | Strength | Status |
|------|-----|-----------|----------|--------|
| Friday 3:30 PM ET | Available | Previous week | Previous week | **Partial** |
| Saturday–Sunday | Available | Stale | Stale | **Partial** |
| Sunday 7:00 PM ET | Available | **Locks** | **Locks** | **Complete** |

### What to Build

**New file: `src/lib/performance/signalReadiness.ts`**

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
  // For historical/current weeks: all signals ready
  // For upcoming week:
  //   COT ready = cot_snapshots exists for this week's report_date
  //   Sentiment ready = sentiment lock exists for this week
  //   Strength ready = strength_weekly_snapshots exists for this week
  //   basketComplete = all three ready
  //   pendingMessage = e.g. "Basket pending — Sentiment & Strength lock at week open (Sun 7 PM ET)"
}
```

**Display in Performance page:**

When viewing a week where `basketComplete === false`:
- Show available COT-derived signals (dealer directions) in the basket view
- Display a subtle banner with `pendingMessage`
- Sentiment/strength-dependent columns show "Pending" until those signals lock

When `basketComplete === true`:
- Normal display, no banner

### Acceptance Criteria — Part 6

1. `getWeekSignalReadiness()` returns per-source readiness for any week
2. Upcoming weeks between Friday COT and Sunday 7 PM show partial basket with pending banner
3. COT-only signals visible during the pending window
4. After Sunday 7 PM, all signals resolve and banner disappears
5. Historical weeks always return `basketComplete: true`

---

## Part 7: Automated Reconstruction

### Problem

Every week, someone must manually add weeks to the reconstruct script and re-run it. Steps 1-2 (cron refresh) are automated. Steps 3-5 (reconstruction) are manual.

### Fix

**New file: `src/app/api/cron/reconstruct-report/route.ts`**

A cron endpoint that runs reconstruction automatically:

```typescript
// 1. Discover all weeks from performance_snapshots (same as Part 3)
// 2. Run the reconstruction logic (import from scripts or extract to shared lib)
// 3. Write updated comprehensive-reconstruction.json
// 4. Clear the canonical report cache
// Uses isCronAuthorized() for security (same pattern as other crons)
```

**Vercel cron config** (add to `vercel.json`):

```json
{
  "path": "/api/cron/reconstruct-report",
  "schedule": "0 8 * * 6"
}
```

Saturday 8 AM UTC — well after Friday markets close and all data settles.

### Acceptance Criteria — Part 7

1. Cron endpoint at `/api/cron/reconstruct-report` exists
2. Discovers weeks dynamically
3. Writes updated report JSON
4. Uses `isCronAuthorized()` for security
5. Manual script still works for local dev

---

## Part 8: One-Time Price Layer Recomputation

### Why

Changing the price windows (Part 1) means all stored `pair_period_returns` have stale open/close prices from the old FX 5 PM / indices 6 PM windows. The canonical-refresh cron only refreshes recent weeks.

### What to Do

After deploying the unified anchor changes:

1. Run a **full backfill** of `pair_period_returns` for all historical weeks using the new unified windows
2. Re-run the reconstruction script to regenerate `comprehensive-reconstruction.json` with correct returns
3. Verify that backtest results are consistent with the new windows

This can be triggered by running the existing `scripts/backfill-canonical-price-layer.ts` which iterates `CANONICAL_WEEKS` and refreshes all price data. After the Part 1 change, it will use the new unified windows automatically.

### Acceptance Criteria — Part 8

1. After deployment, running the backfill script regenerates all weekly price returns using unified 7 PM ET open
2. All FX pairs show returns starting from Sunday 7 PM ET (not 5 PM)
3. All indices/commodities show returns starting from Sunday 7 PM ET (not 6 PM)
4. Reconstruction report reflects the new price data

---

## File Reference Table

| File | Purpose | Changes |
|------|---------|---------|
| `src/lib/canonicalPriceWindows.ts` | Weekly price windows | **CRITICAL** — Unify all opens to weekKey, remove per-asset offsets |
| `src/lib/weekAnchor.ts` | Week anchor exports | Remove Friday flip from `getDisplayWeekOpenUtc()` |
| `src/lib/weekOptions.ts` | Week strip builder | Inject upcoming week into strip |
| `scripts/reconstruct-weekly-systems.ts` | Reconstruction script | Dynamic week discovery, remove hardcoded array |
| `src/lib/strength/weeklyStrength.ts` | Strength reading | Add lock/read locked functions, prefer locked data |
| `src/lib/performance/snapshotProvenance.ts` | **NEW** — Provenance queries |
| `src/lib/performance/signalReadiness.ts` | **NEW** — Signal readiness checks |
| `src/components/RefreshControl.tsx` | Refresh display | Add provenance display mode |
| `src/app/api/cron/reconstruct-report/route.ts` | **NEW** — Auto reconstruction cron |
| `db/schema.sql` | Schema | Add `strength_weekly_snapshots` table |
| `src/app/performance/page.tsx` | Performance page | Wire provenance + readiness |
| `src/app/api/flagship/sentiment-daily/route.ts` | Sentiment API | Trigger strength lock alongside sentiment |
| `src/lib/performanceSnapshots.ts` | Snapshot store | Reference — already has `listPerformanceWeeks()` |

## Global Acceptance Criteria

1. **One anchor**: All price returns, signal locks, and display logic use Sunday 7 PM ET
2. **No Friday flip**: Current week stays current until Sunday 7 PM ET
3. **Upcoming week**: Appears as additional tab after Friday COT, shows pending state
4. **No manual weeks**: `CANONICAL_WEEKS` discovered dynamically everywhere
5. **Reconstruction auto-runs**: Saturday cron regenerates the report
6. **Strength locked**: Formal `strength_weekly_snapshots` table, locked at week open
7. **Provenance visible**: Each week shows per-source snapshot timestamps
8. **Signal readiness**: Upcoming weeks show which signals are locked vs pending
9. **Backtest honest**: No asset class gets price data before signal lock time
10. **Backward compatible**: Historical weeks without strength locks still work via live fallback
11. **"Weeks Tracked" counts**: Update automatically — no hardcoded numbers anywhere
12. Standard file header on all new files (Property of Freedom_EXE (c) 2026)
13. No new npm dependencies
