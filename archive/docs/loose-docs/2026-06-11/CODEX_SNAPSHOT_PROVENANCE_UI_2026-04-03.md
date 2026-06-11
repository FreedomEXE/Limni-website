# Codex Prompt: Snapshot Provenance UI

## Goal

Replace "Last refresh" timestamps in the Data section (Dashboard) and Antikythera with **canonical snapshot timestamps** per data source per selected week. Users need to know exactly what snapshot drove each week's signals — not when data was last fetched.

---

## Current State

**File: `src/components/dashboard/DashboardViewSection.tsx` lines 199-203, 239**

```typescript
const headerRefresh = selectedBias === "sentiment"
  ? sentimentPayload?.latestAggregateTimestamp ?? null
  : selectedBias === "strength"
    ? strengthPayload?.latestSnapshotUtc ?? null
  : cotPayload?.combinedRefresh ?? null;

// line 239:
{headerRefresh ? `Last refresh ${formatDateTimeET(headerRefresh)}` : "No refresh yet"}
```

This shows when data was last FETCHED — not the canonical snapshot for the selected week.

**File: `src/app/antikythera/page.tsx` lines 159-168, 252-254**

Same issue — shows `latestAntikytheraRefresh` which is the latest `last_refresh_utc` from COT snapshots.

---

## What to Build

### Step 1: Server-side provenance helper

**New file: `src/lib/performance/snapshotProvenance.ts`**

```typescript
/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: snapshotProvenance.ts
 *
 * Description:
 * Computes the canonical snapshot timestamp per data source for a given trading week.
 * Used to show users exactly what data drove each week's signals.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

export type SourceProvenance = {
  label: string;           // "COT", "Sentiment", "Strength"
  snapshotUtc: string | null;
  source: string;          // table/origin description
};

export type WeekSnapshotProvenance = {
  weekOpenUtc: string;
  cot: SourceProvenance;
  sentiment: SourceProvenance;
  strength: SourceProvenance;
};

export async function getWeekSnapshotProvenance(weekOpenUtc: string): Promise<WeekSnapshotProvenance>;
```

Implementation:

1. **COT (Dealer + Commercial)**: The COT report is released Friday ~3:30 PM ET for the prior Tuesday's data. Query `cot_snapshots` for the `MAX(fetched_at)` where the `report_date` corresponds to this week. Use the existing `deriveCotReportDate()` helper from `src/lib/cotStore.ts` (or derive the Friday before `weekOpenUtc`). The result is the actual timestamp the COT data was captured.

   ```sql
   SELECT MAX(fetched_at) AS snapshot_utc
   FROM cot_snapshots
   WHERE report_date = $1
   ```

   Where `$1` is the report date for this week. If `deriveCotReportDate` doesn't exist as a standalone helper, derive it: the COT report date for a week is the Tuesday before the week's Sunday open. Alternatively, find the most recent `report_date` from `cot_snapshots` that is `<= weekOpenUtc`.

2. **Sentiment**: Query `sentiment_daily_snapshots` for the snapshot used at week open:

   ```sql
   SELECT MAX(snapshot_time_utc) AS snapshot_utc
   FROM sentiment_daily_snapshots
   WHERE snapshot_time_utc <= $1::timestamptz
   ```

   Where `$1` is `weekOpenUtc`. If `sentiment_daily_snapshots` doesn't have `snapshot_time_utc`, check `sentiment_aggregates` instead — use the `MAX(timestamp_utc) WHERE timestamp_utc <= weekOpenUtc`.

3. **Strength**: First try the frozen lock table:

   ```sql
   SELECT MIN(source_snapshot_utc) AS snapshot_utc, MIN(locked_at_utc) AS locked_utc
   FROM strength_weekly_snapshots
   WHERE week_open_utc = $1::timestamp
   ```

   If no rows, fall back to the live query pattern:

   ```sql
   SELECT MAX(snapshot_time_utc) AS snapshot_utc
   FROM currency_strength_snapshots
   WHERE snapshot_time_utc <= $1::timestamptz
     AND "window" = '24h'
   ```

Return the result with human-readable labels.

### Step 2: Pass provenance through Dashboard data flow

**File: `src/app/dashboard/page.tsx`**

The Dashboard page pre-computes data per report date and passes it to `DashboardViewSection`. Add provenance per week:

```typescript
import { getWeekSnapshotProvenance } from "@/lib/performance/snapshotProvenance";

// In the data loading section, for each report date (week):
const provenanceByReport: Record<string, WeekSnapshotProvenance> = {};
for (const reportDate of reportDates) {
  // reportDate maps to a weekOpenUtc — use the existing mapping
  try {
    provenanceByReport[reportDate] = await getWeekSnapshotProvenance(weekOpenUtcForReport);
  } catch {
    // Skip if provenance unavailable
  }
}
```

Pass `provenanceByReport` to `DashboardViewSection` as a new prop.

### Step 3: Update DashboardViewSection to show provenance

**File: `src/components/dashboard/DashboardViewSection.tsx`**

Add to props type:

```typescript
type DashboardViewSectionProps = {
  // ... existing props ...
  provenanceByReport?: Record<string, WeekSnapshotProvenance>;
};
```

Replace the `headerRefresh` logic (lines 199-203) and the display (line 239):

```typescript
const provenance = provenanceByReport?.[selectedReport] ?? null;

const headerRefreshLabel = (() => {
  if (!provenance) {
    // Fallback to existing behavior
    const fallback = selectedBias === "sentiment"
      ? sentimentPayload?.latestAggregateTimestamp ?? null
      : selectedBias === "strength"
        ? strengthPayload?.latestSnapshotUtc ?? null
      : cotPayload?.combinedRefresh ?? null;
    return fallback ? `Last refresh ${formatDateTimeET(fallback)}` : "No refresh yet";
  }

  // Show canonical snapshot time for the selected data source
  if (selectedBias === "sentiment") {
    return provenance.sentiment.snapshotUtc
      ? `Snapshot ${formatDateTimeET(provenance.sentiment.snapshotUtc)}`
      : "No snapshot yet";
  }
  if (selectedBias === "strength") {
    return provenance.strength.snapshotUtc
      ? `Snapshot ${formatDateTimeET(provenance.strength.snapshotUtc)}`
      : "No snapshot yet";
  }
  // Dealer and Commercial both use COT
  return provenance.cot.snapshotUtc
    ? `Snapshot ${formatDateTimeET(provenance.cot.snapshotUtc)}`
    : "No snapshot yet";
})();
```

Then in the JSX:

```tsx
<div className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
  {headerRefreshLabel}
</div>
```

### Step 4: Update Antikythera page

**File: `src/app/antikythera/page.tsx`**

Apply the same pattern. The Antikythera page has its own "Last refresh" at line 253. Replace with provenance for the selected week/tab.

Compute provenance for the selected report date and pass it through. Use the same `getWeekSnapshotProvenance()` helper.

---

## Important Implementation Notes

### Report date → Week mapping

The Dashboard uses COT `report_date` values (Tuesdays) as its week key in `reportOptions` and `cotDataByReport`. The provenance helper takes `weekOpenUtc` (Sunday 7 PM ET). You need to map between them. The Dashboard page already has this mapping — look at how it derives `weekOpenUtc` from the report date for sentiment/strength queries. Use the same approach.

### What NOT to change

- Do NOT change the Status page "Last refresh" timestamps — those are operational health indicators and should stay as-is
- Do NOT change the Accounts page refresh timestamps
- Do NOT change RefreshControl.tsx — it's currently unused in the Data section and can be left for future use
- Do NOT add API endpoints — provenance is computed server-side in the page data loaders

### Format

The snapshot timestamp should display in the same format as the current "Last refresh" — using `formatDateTimeET()`. Just change the label from "Last refresh" to "Snapshot".

---

## Acceptance Criteria

1. New `getWeekSnapshotProvenance()` helper returns COT, sentiment, and strength snapshot times for any week
2. Dashboard Dealer tab shows: `SNAPSHOT [COT snapshot time for selected week]` instead of "LAST REFRESH"
3. Dashboard Commercial tab shows: same COT snapshot time (same data source)
4. Dashboard Sentiment tab shows: `SNAPSHOT [sentiment lock time for selected week]`
5. Dashboard Strength tab shows: `SNAPSHOT [strength lock time for selected week]`
6. Antikythera page shows the same provenance-based timestamps
7. Switching weeks in the trading week strip updates the snapshot timestamp to match that week's data
8. When provenance is unavailable (e.g., no data for a week), falls back to existing "Last refresh" behavior
9. "All Time" view shows no provenance (not meaningful for aggregate)
10. Standard file header on new files (Property of Freedom_EXE (c) 2026)
11. No new npm dependencies

## File References

| File | Purpose | Changes |
|------|---------|---------|
| `src/lib/performance/snapshotProvenance.ts` | **NEW** — Provenance queries |
| `src/app/dashboard/page.tsx` | Dashboard data loader | Compute provenance per report, pass to view |
| `src/components/dashboard/DashboardViewSection.tsx` | Dashboard view | Replace "Last refresh" with provenance |
| `src/app/antikythera/page.tsx` | Antikythera page | Replace "Last refresh" with provenance |
| `src/lib/cotStore.ts` | COT data | Reference — has report date / fetched_at |
| `src/lib/sentiment/daily.ts` | Sentiment | Reference — has snapshot timing |
| `src/lib/strength/weeklyStrength.ts` | Strength | Reference — has locked snapshot timing |
