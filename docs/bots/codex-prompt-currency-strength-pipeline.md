# Codex Prompt — Currency Strength Pipeline (Phase 1)

## Objective
Build an internal currency strength index computed from OANDA H1 candles for the 8 major currencies (EUR, USD, GBP, JPY, AUD, NZD, CAD, CHF). This replaces the need for MarketMilk scraping. Includes: calculation logic, DB storage, hourly ingestion cron endpoint, read API, and a minimal Flagship data panel.

## Context
- The project is a Next.js app at `C:/Users/User/Documents/GitHub/limni-website`
- OANDA candle fetching exists at `src/lib/oandaPrices.ts`:
  - `fetchOandaCandleSeries(symbol, fromUtc, toUtc)` returns `OandaHourlyCandle[]` with `{ts, open, close}`
  - `getOandaInstrument(symbol)` maps pair names to OANDA instrument IDs
  - Has retry logic (3 attempts, 400ms backoff), pagination
  - Requires `OANDA_API_KEY` and `OANDA_ACCOUNT_ID` env vars
- Cron endpoints live at `src/app/api/cron/` and use `isCronAuthorized(request)` from `src/lib/cronAuth.ts`
- API routes use Next.js App Router pattern: `export async function GET(request: Request)` returning `NextResponse.json()`
- Display timezone is ET (Eastern Time), defined in `src/lib/time.ts`
- The Flagship page exists at `src/app/flagship/page.tsx` → `src/components/flagship/FlagshipBoard.tsx`
- The existing design system uses CSS variables: `var(--panel)`, `var(--panel-border)`, `var(--foreground)`, `var(--muted)`, `var(--accent)`

## File header standard
Every new code file must include this header (adapt description per file):
```
/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: <filename>
 *
 * Description:
 * <high-level description>
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/
```

## The 8 Major Currencies
```
EUR, USD, GBP, JPY, AUD, NZD, CAD, CHF
```

## The 28 FX Pairs (from `src/lib/cotPairs.ts`)
Each pair has a base (first 3 chars) and quote (last 3 chars):
```
EURUSD, GBPUSD, AUDUSD, NZDUSD, USDJPY, USDCHF, USDCAD,
EURGBP, EURJPY, EURCHF, EURAUD, EURNZD, EURCAD,
GBPJPY, GBPCHF, GBPAUD, GBPNZD, GBPCAD,
AUDJPY, AUDCHF, AUDCAD, AUDNZD,
NZDJPY, NZDCHF, NZDCAD,
CADJPY, CADCHF, CHFJPY
```

Each currency appears in exactly 7 pairs (as base or quote).

## Tasks

### 1. Create currency strength calculation module
**Create:** `src/lib/currencyStrength.ts`

#### Calculation Logic

For each currency `C`, compute its strength as the average performance across all 7 pairs containing it over a rolling window:

```typescript
const MAJOR_CURRENCIES = ["EUR", "USD", "GBP", "JPY", "AUD", "NZD", "CAD", "CHF"] as const;
type MajorCurrency = typeof MAJOR_CURRENCIES[number];

// For a given rolling window of H1 candles:
// 1. For each pair, compute: return_pct = ((last_close - first_open) / first_open) * 100
// 2. For each currency C:
//    - If C is the BASE of a pair: contribution = +return_pct
//    - If C is the QUOTE of a pair: contribution = -return_pct
//    (e.g., EURUSD up = EUR strong, USD weak)
// 3. Raw strength = average of all 7 contributions
// 4. Normalize: scale all 8 currencies to 0-100 range where:
//    - Strongest currency = 100
//    - Weakest currency = 0
//    - Others linearly interpolated
```

#### Functions to implement

```typescript
type CurrencyStrengthSnapshot = {
  currency: MajorCurrency;
  raw: number;           // raw average return across pairs
  normalized: number;    // 0-100 scaled
};

type CurrencyStrengthResult = {
  snapshotTimeUtc: string;
  window: "1h" | "4h" | "24h";
  strengths: CurrencyStrengthSnapshot[];
};

/**
 * Compute currency strength for all 8 majors over a given window.
 * Fetches H1 candles from OANDA for all 28 FX pairs within the window.
 *
 * @param windowHours - lookback window in hours (1, 4, or 24)
 * @param asOfUtc - the reference time (defaults to now)
 * @returns strengths for all 8 currencies
 */
export async function computeCurrencyStrength(
  windowHours: 1 | 4 | 24,
  asOfUtc?: DateTime,
): Promise<CurrencyStrengthResult>;

/**
 * Compute all three windows (1h, 4h, 24h) in a single call.
 * Optimizes by fetching 24h of candles once and slicing for shorter windows.
 */
export async function computeAllCurrencyStrengths(
  asOfUtc?: DateTime,
): Promise<CurrencyStrengthResult[]>;
```

#### Performance optimization
- Fetch 24h of H1 candles for all 28 pairs (28 OANDA API calls)
- Add 100ms delay between OANDA calls to respect rate limits (same pattern as `backtest-session-top-pick.ts`)
- Slice the 24h candle array for 4h and 1h windows (no extra API calls)
- Cache results in-memory for 5 minutes to avoid redundant fetches within the same cron cycle

#### Pair-to-currency mapping
Build a static map from the 28 pairs to their base/quote currencies. Reuse the pair definitions from `PAIRS_BY_ASSET_CLASS.fx` in `src/lib/cotPairs.ts`:

```typescript
import { PAIRS_BY_ASSET_CLASS } from "./cotPairs";

// Build mapping: { pair: { base, quote } }
const FX_PAIR_MAP = new Map<string, { base: MajorCurrency; quote: MajorCurrency }>();
for (const pairDef of PAIRS_BY_ASSET_CLASS.fx) {
  FX_PAIR_MAP.set(pairDef.pair.toUpperCase(), {
    base: pairDef.base.toUpperCase() as MajorCurrency,
    quote: pairDef.quote.toUpperCase() as MajorCurrency,
  });
}
```

### 2. Create DB migration
**Create:** `migrations/017_currency_strength_snapshots.sql`

```sql
CREATE TABLE IF NOT EXISTS currency_strength_snapshots (
  id SERIAL PRIMARY KEY,
  snapshot_time_utc TIMESTAMP NOT NULL,
  window VARCHAR(10) NOT NULL,           -- '1h', '4h', '24h'
  currency VARCHAR(3) NOT NULL,          -- 'EUR', 'USD', etc.
  raw_strength NUMERIC(10,6) NOT NULL,   -- raw average return %
  normalized_strength NUMERIC(6,2) NOT NULL, -- 0-100 scale
  source VARCHAR(20) NOT NULL DEFAULT 'OANDA',
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cs_snapshot_time ON currency_strength_snapshots (snapshot_time_utc DESC);
CREATE INDEX IF NOT EXISTS idx_cs_currency_window ON currency_strength_snapshots (currency, window, snapshot_time_utc DESC);

-- Unique constraint: one row per currency per window per snapshot time
CREATE UNIQUE INDEX IF NOT EXISTS idx_cs_unique_snapshot
  ON currency_strength_snapshots (snapshot_time_utc, window, currency);
```

### 3. Create DB read/write functions
**Add to:** `src/lib/currencyStrength.ts` (same file as calculation logic)

```typescript
/**
 * Write a batch of currency strength snapshots to the DB.
 * Uses upsert (ON CONFLICT DO UPDATE) to handle re-runs.
 */
export async function writeCurrencyStrengthSnapshots(
  results: CurrencyStrengthResult[],
): Promise<number>; // returns rows written

/**
 * Read the latest currency strength snapshot for a given window.
 * Returns null if no data exists.
 */
export async function readLatestCurrencyStrength(
  window: "1h" | "4h" | "24h",
): Promise<CurrencyStrengthResult | null>;

/**
 * Read currency strength history for a specific currency and window.
 * Used for sparkline charts on the dashboard.
 */
export async function readCurrencyStrengthHistory(
  currency: MajorCurrency,
  window: "1h" | "4h" | "24h",
  hoursBack: number,
): Promise<Array<{ snapshotTimeUtc: string; raw: number; normalized: number }>>;

/**
 * Read all latest snapshots (all windows, all currencies).
 * Single query, used by the API endpoint.
 */
export async function readAllLatestStrengths(): Promise<CurrencyStrengthResult[]>;
```

Use `getPool()` from `src/lib/db.ts` for database access.

### 4. Create cron endpoint for hourly ingestion
**Create:** `src/app/api/cron/currency-strength/route.ts`

Follow the existing cron pattern (see `src/app/api/cron/market-snapshots/route.ts`):

```typescript
import { NextResponse } from "next/server";
import { isCronAuthorized } from "@/lib/cronAuth";
import { computeAllCurrencyStrengths, writeCurrencyStrengthSnapshots } from "@/lib/currencyStrength";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startedAt = new Date().toISOString();
  try {
    const results = await computeAllCurrencyStrengths();
    const rowsWritten = await writeCurrencyStrengthSnapshots(results);

    return NextResponse.json({
      ok: true,
      rows_written: rowsWritten,
      windows: results.map((r) => r.window),
      snapshot_time: results[0]?.snapshotTimeUtc ?? null,
      started_at: startedAt,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Currency strength ingestion failed",
        started_at: startedAt,
        timestamp: new Date().toISOString(),
      },
      { status: 503 },
    );
  }
}
```

### 5. Create read API endpoint
**Create:** `src/app/api/flagship/currency-strength/route.ts`

```typescript
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const window = url.searchParams.get("window") as "1h" | "4h" | "24h" | null;
    const currency = url.searchParams.get("currency")?.toUpperCase() ?? null;
    const hoursBack = Number(url.searchParams.get("hoursBack")) || 0;

    // If specific currency + history requested
    if (currency && hoursBack > 0 && window) {
      const history = await readCurrencyStrengthHistory(
        currency as MajorCurrency,
        window,
        hoursBack,
      );
      return NextResponse.json({ currency, window, history });
    }

    // Default: return all latest strengths (all windows, all currencies)
    const latest = await readAllLatestStrengths();
    return NextResponse.json({ strengths: latest });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to read currency strength" },
      { status: 500 },
    );
  }
}
```

### 6. Add minimal Flagship data panel
**Modify:** `src/components/flagship/FlagshipBoard.tsx`

Add a collapsible "Currency Strength" panel to the Flagship board. This is a read-only data display — NOT a full redesign.

#### Data fetching
Add a separate `useEffect` to fetch from `/api/flagship/currency-strength` on mount and every 60 seconds:

```typescript
const [strengthData, setStrengthData] = useState<CurrencyStrengthResult[] | null>(null);
const [strengthLoading, setStrengthLoading] = useState(true);

useEffect(() => {
  let cancelled = false;
  async function fetchStrength() {
    try {
      const res = await fetch("/api/flagship/currency-strength");
      if (!res.ok) throw new Error("Failed to fetch currency strength");
      const json = await res.json();
      if (!cancelled) setStrengthData(json.strengths ?? null);
    } catch {
      // silently fail — panel shows "no data"
    } finally {
      if (!cancelled) setStrengthLoading(false);
    }
  }
  fetchStrength();
  const interval = setInterval(fetchStrength, 60_000);
  return () => { cancelled = true; clearInterval(interval); };
}, []);
```

#### Display
Add the panel AFTER the session timeline bar and any existing panels, BEFORE the signal cards:

```tsx
{/* Currency Strength Panel */}
<details open className="rounded-xl border border-[var(--panel-border)] bg-[var(--panel)]/60">
  <summary className="cursor-pointer px-4 py-2 text-sm font-semibold text-[var(--foreground)]">
    Currency Strength
  </summary>
  <div className="px-4 pb-3">
    {strengthLoading ? (
      <p className="text-xs text-[color:var(--muted)]">Loading…</p>
    ) : !strengthData || strengthData.length === 0 ? (
      <p className="text-xs text-[color:var(--muted)]">No currency strength data available. Run the cron endpoint to populate.</p>
    ) : (
      <div className="space-y-2">
        {strengthData.map((windowResult) => (
          <div key={windowResult.window}>
            <p className="mb-1 text-xs font-medium text-[color:var(--muted)] uppercase">{windowResult.window} window</p>
            <div className="grid grid-cols-4 gap-1 sm:grid-cols-8">
              {windowResult.strengths
                .sort((a, b) => b.normalized - a.normalized)
                .map((cs) => (
                  <div
                    key={cs.currency}
                    className="rounded-lg border border-[var(--panel-border)] bg-[var(--panel)] px-2 py-1 text-center"
                  >
                    <span className="text-xs font-bold text-[var(--foreground)]">{cs.currency}</span>
                    <div
                      className="mt-0.5 text-sm font-mono"
                      style={{
                        color: cs.normalized >= 60
                          ? "var(--accent-strong)"
                          : cs.normalized <= 40
                            ? "rgb(239 68 68)"
                            : "var(--muted)",
                      }}
                    >
                      {cs.normalized.toFixed(0)}
                    </div>
                  </div>
                ))}
            </div>
          </div>
        ))}
        {strengthData[0]?.snapshotTimeUtc ? (
          <p className="text-[10px] text-[color:var(--muted)]">
            As of {new Date(strengthData[0].snapshotTimeUtc).toLocaleString("en-US", { timeZone: "America/New_York" })} ET
          </p>
        ) : null}
      </div>
    )}
  </div>
</details>
```

The panel shows all 8 currencies sorted strongest to weakest, for each window (1h, 4h, 24h). Color coding: green (≥60) = strong, red (≤40) = weak, muted (41-59) = neutral.

## Testing

After implementing, run the migration:
```bash
psql $DATABASE_URL -f migrations/017_currency_strength_snapshots.sql
```

Then test the cron endpoint manually:
```bash
curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/currency-strength
```

Then verify the API returns data:
```bash
curl http://localhost:3000/api/flagship/currency-strength
```

Then check the Flagship page at `/flagship` — the Currency Strength panel should display.

## Do NOT
- Do not modify `src/lib/oandaPrices.ts` — use it as-is
- Do not modify `src/lib/cotPairs.ts` — import from it
- Do not modify existing cron endpoints
- Do not modify `DashboardLayout.tsx`
- Do not add npm dependencies
- Do not create README or documentation files
- Do not restructure the existing FlagshipBoard component — add the panel as a new section only
- Do not build real-time 1-minute currency strength yet — that comes in a future phase
- Do not touch backtest scripts
