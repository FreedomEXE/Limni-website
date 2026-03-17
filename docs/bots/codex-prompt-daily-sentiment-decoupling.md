# Codex Prompt — Phase 2: Daily Sentiment Decoupling (Safe Additive Build)

## Objective
Add a **daily sentiment lock pipeline** for Flagship and daily gating without changing weekly swing-bot behavior.

This phase is additive only:
- Keep existing weekly sentiment flow (`getAggregatesForWeekStartWithBackfill`) untouched.
- Add a separate daily snapshot layer sourced from `sentiment_aggregates`.
- Expose daily snapshots via API for Flagship and future daily backtests.

## Critical Safety Constraint
Do **not** modify weekly sentiment functions used by Universal/Katarakti/weekly backtests:
- `src/lib/sentiment/store.ts` functions:
  - `getAggregatesForWeekStart`
  - `getAggregatesForWeekStartWithBackfill`
  - `getLatestAggregatesLocked`

Weekly system behavior must remain unchanged.

## Existing Context
- Raw provider snapshots are already written to `sentiment_data`.
- Aggregated sentiment snapshots are already written to `sentiment_aggregates`.
- Current refresh route: `src/app/api/cron/sentiment-refresh/route.ts`
- Existing types in `src/lib/sentiment/types.ts`

## Build Scope

### 1) Migration: daily sentiment snapshot table
Create:
- `migrations/018_sentiment_daily_snapshots.sql`

SQL:
```sql
CREATE TABLE IF NOT EXISTS sentiment_daily_snapshots (
  id SERIAL PRIMARY KEY,
  snapshot_date_utc DATE NOT NULL,
  snapshot_time_utc TIMESTAMP NOT NULL,
  symbol VARCHAR(16) NOT NULL,
  agg_long_pct NUMERIC(6,2) NOT NULL,
  agg_short_pct NUMERIC(6,2) NOT NULL,
  agg_net NUMERIC(8,4) NOT NULL,
  confidence_score NUMERIC(6,3) NOT NULL,
  crowding_state VARCHAR(32) NOT NULL,
  flip_state VARCHAR(32) NOT NULL,
  sentiment_direction VARCHAR(16) NOT NULL, -- LONG | SHORT | NEUTRAL
  source_mode VARCHAR(32) NOT NULL DEFAULT 'DAILY_LOCK_FROM_AGG',
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sent_daily_date ON sentiment_daily_snapshots (snapshot_date_utc DESC);
CREATE INDEX IF NOT EXISTS idx_sent_daily_symbol_date ON sentiment_daily_snapshots (symbol, snapshot_date_utc DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_sent_daily_unique
  ON sentiment_daily_snapshots (snapshot_date_utc, symbol);
```

### 2) New library module for daily snapshots
Create:
- `src/lib/sentiment/daily.ts`

Include Freedom_EXE file header block (same style used in repo).

Implement:

```ts
export type DailySentimentRow = {
  snapshotDateUtc: string;        // YYYY-MM-DD
  snapshotTimeUtc: string;        // locked aggregate timestamp for symbol
  symbol: string;
  aggLongPct: number;
  aggShortPct: number;
  aggNet: number;
  confidenceScore: number;
  crowdingState: string;
  flipState: string;
  sentimentDirection: "LONG" | "SHORT" | "NEUTRAL";
  sourceMode: "DAILY_LOCK_FROM_AGG";
};

export function sentimentDirectionFromAggregate(
  agg: { crowding_state: string; flip_state: string }
): "LONG" | "SHORT" | "NEUTRAL";

export async function buildDailySentimentLock(
  asOfUtc?: string
): Promise<{ snapshotDateUtc: string; rows: DailySentimentRow[] }>;

export async function writeDailySentimentLock(
  snapshotDateUtc: string,
  rows: DailySentimentRow[]
): Promise<number>;

export async function readLatestDailySentimentLock(): Promise<{ snapshotDateUtc: string; rows: DailySentimentRow[] } | null>;

export async function readDailySentimentLockByDate(
  snapshotDateUtc: string
): Promise<DailySentimentRow[]>;

export async function readDailySentimentHistory(
  symbol: string,
  daysBack: number
): Promise<DailySentimentRow[]>;
```

Rules:
- Pull lock candidates from `sentiment_aggregates` only.
- For each symbol, choose the **latest aggregate with `timestamp_utc <= asOfUtc`**.
- `snapshotDateUtc` = UTC date of `asOfUtc` (not aggregate timestamp date).
- Direction mapping must match existing production logic and include crowding/extreme catch-alls:
  - If `flip_state = FLIPPED_UP` -> `LONG`
  - If `flip_state = FLIPPED_DOWN` -> `SHORT`
  - If `flip_state = FLIPPED_NEUTRAL` -> `NEUTRAL`
  - Else if `crowding_state IN (CROWDED_LONG, EXTREME_LONG)` -> `SHORT` (contrarian)
  - Else if `crowding_state IN (CROWDED_SHORT, EXTREME_SHORT)` -> `LONG` (contrarian)
  - Else `NEUTRAL`
- Upsert by `(snapshot_date_utc, symbol)` for idempotent reruns.
- Use `getPool()` from `src/lib/db.ts`.
- `confidenceScore` is **not derived** in this phase. Copy directly from `sentiment_aggregates.confidence_score`
  for the selected latest row per symbol. No custom formula.

### 3) Cron endpoint for daily lock ingestion
Create:
- `src/app/api/cron/sentiment-daily-lock/route.ts`

Pattern:
- Auth with `isCronAuthorized(request)` from `src/lib/cronAuth.ts`.
- `dynamic = "force-dynamic"`, `runtime = "nodejs"`.
- Optional query param `asOf` (ISO UTC) for backfill/testing.
- Flow:
  1. `buildDailySentimentLock(asOf)`
  2. `writeDailySentimentLock(snapshotDateUtc, rows)`
  3. return summary JSON

Response example:
```json
{
  "ok": true,
  "task": "sentiment_daily_lock",
  "snapshot_date_utc": "2026-03-17",
  "rows_locked": 56,
  "started_at": "...",
  "finished_at": "..."
}
```

### 4) Flagship read API for daily sentiment
Create:
- `src/app/api/flagship/sentiment-daily/route.ts`

Behavior:
- `GET /api/flagship/sentiment-daily`
  - returns latest daily lock snapshot
- `GET /api/flagship/sentiment-daily?date=YYYY-MM-DD`
  - returns snapshot for that date
- `GET /api/flagship/sentiment-daily?symbol=EURUSD&daysBack=14`
  - returns symbol history

### 5) Minimal Flagship panel
Modify:
- `src/components/flagship/FlagshipBoard.tsx`

Add a collapsible panel:
- Title: `Daily Sentiment Lock`
- Fetch `/api/flagship/sentiment-daily` every 60s
- Show top rows as table:
  - symbol
  - direction
  - crowding_state
  - flip_state
  - confidence_score
  - as-of time

UI constraints:
- Use existing CSS variables (`var(--panel)`, `var(--panel-border)`, `var(--foreground)`, `var(--muted)`).
- No layout rewrite; add as a new section only.

### 6) Optional scheduler note (no infra edits in code)
No Vercel/infra changes required in this PR. Endpoint is ready to be added to scheduler manually:
- `/api/cron/sentiment-daily-lock` hourly (or every 4h).

## Tests / Validation
Run:
1. Migration:
```bash
psql $DATABASE_URL -f migrations/018_sentiment_daily_snapshots.sql
```
2. Cron dry run:
```bash
curl -H "Authorization: Bearer $CRON_SECRET" "http://localhost:3000/api/cron/sentiment-daily-lock"
```
3. Read API:
```bash
curl "http://localhost:3000/api/flagship/sentiment-daily"
curl "http://localhost:3000/api/flagship/sentiment-daily?date=2026-03-17"
```
4. UI:
- Open `/flagship`
- Verify `Daily Sentiment Lock` panel shows rows.

## Do Not
- Do not modify `src/lib/sentiment/store.ts` weekly lock functions.
- Do not modify existing `sentiment-refresh` behavior.
- Do not touch backtest scripts in this phase.
- Do not add new npm dependencies.
- Do not change Universal/Katarakti signal classification logic.
