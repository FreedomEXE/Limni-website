# Codex Prompt - MenthorQ Overlay Pipeline (DB-Backed, Account Workflow)

## Objective
Harden existing MenthorQ integration so your current account workflow is usable every day without brittle CSV-only logic.

Use your existing browser capture flow as ingestion input, then move runtime gating to a normalized DB table.

This is **not** a full MenthorQ API integration. It is a robust account-driven pipeline:
1. Capture from account pages (existing script)
2. Import into DB (new)
3. Read from DB in Flagship/gating (new)
4. Explicit `NO_DATA` when coverage is missing/stale (required)

## Existing Context (must reuse)
- Existing capture script:
  - `scripts/capture-menthorq-gamma-browser.ts`
  - Writes: `reports/bias-gate/menthorq-gamma-daily.csv`
- Existing pair map CSV:
  - `reports/bias-gate/menthorq-gamma-symbol-map-template.csv`
- Existing runtime gate logic (CSV-based):
  - `src/app/api/performance/gated-setups/route.ts`
  - functions: `buildGammaContext`, `evaluateMenthorqGate`
- Existing selector relying on MenthorQ coverage:
  - `scripts/select-daily-max-conviction-trade.ts`

Goal is to keep behavior consistent while replacing CSV-at-runtime dependency with DB-at-runtime.

## Critical Requirements
- Runtime gating must be **DB-first**.
- CSV remains ingestion input and fallback only.
- Missing or stale MenthorQ data must produce explicit `NO_DATA` (never silent PASS).
- No changes to weekly bias calculation logic.
- No new npm dependencies.

## Build Scope

### 1) Migration: MenthorQ overlay snapshots table
Create:
- `migrations/021_menthorq_overlay_snapshots.sql`

SQL:
```sql
CREATE TABLE IF NOT EXISTS menthorq_overlay_snapshots (
  id SERIAL PRIMARY KEY,
  snapshot_date_utc DATE NOT NULL,
  symbol VARCHAR(16) NOT NULL,
  gamma_condition VARCHAR(16) NOT NULL,   -- POSITIVE | NEGATIVE | NEUTRAL | UNKNOWN
  net_gex_text VARCHAR(64),
  total_gex_text VARCHAR(64),
  timestamp_text VARCHAR(128),
  source_url TEXT,
  captured_at_utc TIMESTAMP,
  parse_confidence VARCHAR(16),           -- HIGH | MEDIUM | LOW
  notes TEXT,
  source_mode VARCHAR(32) NOT NULL DEFAULT 'MENTHORQ_BROWSER_CAPTURE',
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mq_overlay_date
  ON menthorq_overlay_snapshots (snapshot_date_utc DESC);

CREATE INDEX IF NOT EXISTS idx_mq_overlay_symbol_date
  ON menthorq_overlay_snapshots (symbol, snapshot_date_utc DESC);

-- One row per symbol per day (latest import wins)
CREATE UNIQUE INDEX IF NOT EXISTS idx_mq_overlay_unique
  ON menthorq_overlay_snapshots (snapshot_date_utc, symbol);
```

### 2) New module: DB + CSV import helpers
Create:
- `src/lib/menthorqOverlay.ts`

Include Freedom_EXE file header block.

Implement:
```ts
export type MenthorqGammaCondition = "POSITIVE" | "NEGATIVE" | "NEUTRAL" | "UNKNOWN";

export type MenthorqOverlayRow = {
  snapshotDateUtc: string; // YYYY-MM-DD
  symbol: string;          // normalized symbol (6E, 6B, 6J, GC, SI, CL, ES, NQ, DX...)
  gammaCondition: MenthorqGammaCondition;
  netGexText: string | null;
  totalGexText: string | null;
  timestampText: string | null;
  sourceUrl: string | null;
  capturedAtUtc: string | null;
  parseConfidence: "HIGH" | "MEDIUM" | "LOW" | null;
  notes: string | null;
  sourceMode: "MENTHORQ_BROWSER_CAPTURE";
};

export async function importMenthorqDailyCsv(options?: {
  csvPath?: string;
  targetDateUtc?: string; // default today UTC
}): Promise<{
  snapshotDateUtc: string;
  rowsParsed: number;
  rowsUpserted: number;
  symbols: string[];
}>;

export async function readMenthorqSnapshotsByDate(snapshotDateUtc: string): Promise<MenthorqOverlayRow[]>;

export async function readLatestMenthorqDate(): Promise<string | null>;

export async function readLatestMenthorqSnapshots(): Promise<{ snapshotDateUtc: string; rows: MenthorqOverlayRow[] } | null>;

export async function readMenthorqHistory(symbol: string, daysBack: number): Promise<MenthorqOverlayRow[]>;
```

Rules:
- Reuse CSV parser style already used in repo (quote-safe parsing).
- Reuse/align symbol normalization with existing gate code (`normalizeGammaSymbol` behavior).
- Upsert by `(snapshot_date_utc, symbol)`.
- If multiple CSV rows exist for same symbol/date, keep the newest by `captured_at_utc` (or last row).
- Ignore malformed rows gracefully and continue.

### 3) Cron endpoint: import CSV to DB
Create:
- `src/app/api/cron/menthorq-overlay-import/route.ts`

Pattern:
- `dynamic = "force-dynamic"`, `runtime = "nodejs"`
- `isCronAuthorized(request)` auth
- Optional query params:
  - `date=YYYY-MM-DD`
  - `csv=relative/path.csv` (default env or `reports/bias-gate/menthorq-gamma-daily.csv`)

Response example:
```json
{
  "ok": true,
  "task": "menthorq_overlay_import",
  "snapshot_date_utc": "2026-03-17",
  "rows_parsed": 12,
  "rows_upserted": 9,
  "symbols": ["6E","6B","6J","6A","6S","6C","GC","SI","CL"],
  "started_at": "...",
  "finished_at": "..."
}
```

### 4) Flagship read API
Create:
- `src/app/api/flagship/menthorq-overlay/route.ts`

Behavior:
- `GET /api/flagship/menthorq-overlay` -> latest date snapshot
- `GET /api/flagship/menthorq-overlay?date=YYYY-MM-DD` -> snapshot by date
- `GET /api/flagship/menthorq-overlay?symbol=6E&daysBack=14` -> symbol history

### 5) Migrate gating route to DB-first
Modify:
- `src/app/api/performance/gated-setups/route.ts`

Requirements:
- Add `buildGammaContextFromDb()` and use it before CSV context.
- Fallback order:
  1. DB context for target day
  2. CSV context (existing)
  3. none -> preserve current behavior with explicit `NO_DATA`
- Keep existing decision semantics (`PASS/SKIP/NO_DATA`) and reason style.
- Add reason codes:
  - `MENTHORQ_DB_CONTEXT_USED`
  - `MENTHORQ_CSV_FALLBACK_USED`
  - `MENTHORQ_DB_NO_ROWS`
  - `MENTHORQ_DB_STALE`
- Staleness guard:
  - env: `PERFORMANCE_MENTHORQ_MAX_AGE_DAYS` (existing default 8)
  - if latest DB snapshot older than max age, treat as unavailable

### 6) Add Flagship panel: MenthorQ Overlay Coverage
Modify:
- `src/components/flagship/FlagshipBoard.tsx`

Add collapsible panel:
- Title: `MenthorQ Overlay Coverage`
- Fetch `/api/flagship/menthorq-overlay` every 60s
- Show:
  - snapshot date
  - symbol count
  - symbols list
  - per-symbol gamma condition
  - parse confidence
  - captured-at time
- Color code condition:
  - POSITIVE = green
  - NEGATIVE = red
  - NEUTRAL/UNKNOWN = muted

### 7) Keep daily selector aligned
Modify minimally:
- `scripts/select-daily-max-conviction-trade.ts`

Requirement:
- If DB snapshots exist for today, use DB coverage first.
- If not, continue current CSV coverage check.
- Preserve strict overlay behavior and drop reasons.

## Environment variables
Support these (all optional with safe defaults):
- `PERFORMANCE_MENTHORQ_GAMMA_CSV`
- `PERFORMANCE_MENTHORQ_PAIR_MAP_CSV`
- `PERFORMANCE_MENTHORQ_MAX_AGE_DAYS`

No new secrets required.

## Validation
1. Run migration:
```bash
psql $DATABASE_URL -f migrations/021_menthorq_overlay_snapshots.sql
```

2. Capture daily rows (existing flow):
```bash
npx tsx scripts/capture-menthorq-gamma-browser.ts --date=2026-03-17 --symbols=6E,6B,6J,6A,6S,6C,GC,SI,CL
```

3. Import CSV to DB:
```bash
curl -H "Authorization: Bearer $CRON_SECRET" "http://localhost:3000/api/cron/menthorq-overlay-import?date=2026-03-17"
```

4. Verify read API:
```bash
curl "http://localhost:3000/api/flagship/menthorq-overlay"
curl "http://localhost:3000/api/flagship/menthorq-overlay?symbol=6E&daysBack=7"
```

5. Verify gating source is DB-first:
```bash
curl "http://localhost:3000/api/performance/gated-setups"
```
Check `gateReasons`/`gateDecisionSource` contains DB usage signals when data is available.

6. Verify Flagship panel updates and shows latest capture date and coverage count.

## Do Not
- Do not remove CSV support entirely in this phase.
- Do not change weekly bias logic.
- Do not add Deribit/CME work in this phase.
- Do not introduce REDUCE decisions (keep skip-only behavior where configured).
- Do not modify unrelated performance pages.

## Deliverables
- Migration + module + 2 API routes + panel + DB-first gating patch
- No new dependencies
- ESLint clean on touched files
