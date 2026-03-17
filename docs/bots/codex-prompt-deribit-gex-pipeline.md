# Codex Prompt — Phase 3: Crypto GEX Pipeline (Deribit)

## Objective
Build a Gamma Exposure (GEX) pipeline for BTC and ETH using the Deribit public API. Compute net dealer GEX per strike and aggregate totals. Store hourly snapshots in DB. Expose via API and add a minimal Flagship panel.

## Context
- The project is a Next.js app at `C:/Users/User/Documents/GitHub/limni-website`
- Deribit's public REST API requires NO authentication for market data endpoints
- Base URL: `https://www.deribit.com/api/v2`
- Rate limits: ~20 req/s for public endpoints (credit-based system, 500 credits/req, 10,000 credits/s refill). Add 200ms delay between requests to stay safe.
- Cron endpoints live at `src/app/api/cron/` and use `isCronAuthorized(request)` from `src/lib/cronAuth.ts`
- The Flagship page exists at `src/app/flagship/page.tsx` → `src/components/flagship/FlagshipBoard.tsx`
- Existing design system uses CSS variables: `var(--panel)`, `var(--panel-border)`, `var(--foreground)`, `var(--muted)`, `var(--accent)`

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

## Deribit API Reference

### Endpoint 1: List option instruments
```
GET /public/get_instruments?currency=BTC&kind=option&expired=false
```
Returns array of active option instruments. Key fields per instrument:
- `instrument_name` — e.g. `"BTC-28MAR26-90000-C"`
- `strike` — strike price in USD (e.g. `90000.0`)
- `option_type` — `"call"` or `"put"`
- `expiration_timestamp` — ms since epoch
- `contract_size` — e.g. `1.0`
- `is_active` — boolean

### Endpoint 2: Get ticker (includes greeks + OI)
```
GET /public/ticker?instrument_name=BTC-28MAR26-90000-C
```
Returns ticker data for a single instrument. Key fields:
- `open_interest` — outstanding interest (Deribit reports this in base units in many responses; normalize units before final GEX math)
- `mark_price` — current mark price (in BTC for BTC options)
- `underlying_price` — current underlying spot price (USD)
- `greeks.gamma` — Black-Scholes gamma
- `greeks.delta` — Black-Scholes delta
- `greeks.vega` — vega
- `greeks.theta` — theta
- `instrument_name` — echoed back

### Endpoint 3: Bulk summary (alternative to per-instrument ticker)
```
GET /public/get_book_summary_by_currency?currency=BTC&kind=option
```
Returns array of summaries for ALL option instruments at once. Key fields per entry:
- `instrument_name`
- `open_interest`
- `mark_price`
- `underlying_price`
- `volume`

**Important:** `get_book_summary_by_currency` does NOT include greeks. To get gamma, you must call `public/ticker` per instrument. However, `get_book_summary_by_currency` returns OI for all instruments in a single call, which is useful for filtering (skip instruments with OI = 0 before fetching individual tickers).

### Recommended fetch strategy
1. Call `get_instruments` to list all active options (1 call per currency)
2. Call `get_book_summary_by_currency` to get OI for all at once (1 call per currency)
3. Filter to instruments with `open_interest > 0`
4. Call `public/ticker` for each remaining instrument to get gamma (N calls, rate-limited)

This minimizes API calls since many strikes have zero OI.

## GEX Calculation Formula

### Per-strike GEX (for a single option contract)
```
GEX_per_contract = gamma × open_interest × contract_size × spot_price² × 0.01
```

Where:
- `gamma` = from ticker greeks
- `open_interest` = normalized OI used for notional math (after unit normalization)
- `contract_size` = from instrument definition (typically 1.0 for Deribit BTC/ETH)
- `spot_price` = underlying price in USD
- `0.01` = normalizes to "per 1% move"

Unit normalization note:
- Do not assume `open_interest` is always in contracts.
- First verify OI units from Deribit responses for options in this feed.
- Convert to an effective contract count before applying the formula (or set effective multiplier to 1 if OI is already in equivalent contract units for your chosen gamma convention).

### Call vs Put sign convention
Market makers are assumed net short all options:
- **Call GEX** = `+GEX_per_contract` (positive — dampens moves)
- **Put GEX** = `-GEX_per_contract` (negative — amplifies moves)

### Aggregates
```
net_gex = Σ(call_gex) + Σ(put_gex)       // total across all strikes
call_gex_total = Σ(call_gex)               // all calls
put_gex_total = Σ(put_gex)                 // all puts (negative)
```

### Zero-gamma level
The strike price where cumulative GEX flips from positive to negative. This is the key level:
- Above zero-gamma: market makers dampen moves (mean-reverting)
- Below zero-gamma: market makers amplify moves (trending)

To compute: find the strike where the running sum of GEX (sorted by strike ascending) crosses zero.

### GEX interpretation for gating
For the Flagship signal chain:
- **Positive net GEX** → market is mean-reverting, favorable for counter-trend entries
- **Negative net GEX** → market is trending, favorable for trend-following entries
- **Spot vs zero-gamma** → if spot > zero-gamma, dealers are long gamma (stabilizing). If spot < zero-gamma, dealers are short gamma (volatile).

## Tasks

### 1. Create GEX calculation module
**Create:** `src/lib/deribitGex.ts`

#### Types
```typescript
type DeribitCurrency = "BTC" | "ETH";

type GexStrikeRow = {
  strike: number;
  optionType: "call" | "put";
  instrumentName: string;
  openInterest: number;
  gamma: number;
  delta: number;
  markPrice: number;
  gexNotional: number;        // signed GEX in USD
  expirationTimestamp: number; // ms
};

type GexSnapshot = {
  currency: DeribitCurrency;
  spotPrice: number;
  netGex: number;              // total net GEX (USD)
  callGexTotal: number;        // sum of call GEX
  putGexTotal: number;         // sum of put GEX (negative)
  zeroGammaStrike: number | null;  // strike where GEX flips sign
  topStrikes: GexStrikeRow[];  // top 10 strikes by |gexNotional|
  totalInstrumentsFetched: number;
  instrumentsWithOI: number;
  snapshotTimeUtc: string;
};
```

#### Functions
```typescript
/**
 * Fetch all active option instruments for a currency.
 */
async function fetchDeribitInstruments(currency: DeribitCurrency): Promise<Array<{
  instrumentName: string;
  strike: number;
  optionType: "call" | "put";
  contractSize: number;
  expirationTimestamp: number;
}>>;

/**
 * Fetch OI for all options via book summary (single bulk call).
 * Returns map of instrumentName → openInterest.
 */
async function fetchDeribitBulkOI(currency: DeribitCurrency): Promise<Map<string, number>>;

/**
 * Fetch ticker (greeks + OI) for a single instrument.
 */
async function fetchDeribitTicker(instrumentName: string): Promise<{
  openInterest: number;
  gamma: number;
  delta: number;
  markPrice: number;
  underlyingPrice: number;
} | null>;

/**
 * Compute full GEX snapshot for a currency.
 * 1. Fetch instruments
 * 2. Fetch bulk OI, filter to OI > 0
 * 3. Fetch ticker for each instrument with OI (rate-limited)
 * 4. Compute per-strike GEX
 * 5. Aggregate and find zero-gamma strike
 */
export async function computeGexSnapshot(currency: DeribitCurrency): Promise<GexSnapshot>;

/**
 * Compute GEX for both BTC and ETH.
 */
export async function computeAllGexSnapshots(): Promise<GexSnapshot[]>;
```

#### Rate limiting
Add 200ms delay between individual `ticker` API calls:
```typescript
await new Promise((resolve) => setTimeout(resolve, 200));
```

BTC typically has 500-1500 active option instruments, but only ~100-300 have meaningful OI. After the bulk OI filter, the ticker calls should be manageable (~100-300 calls × 200ms = 20-60 seconds per currency).

### 2. Create DB migration
**Create:** `migrations/019_gex_snapshots.sql`

```sql
CREATE TABLE IF NOT EXISTS gex_snapshots (
  id SERIAL PRIMARY KEY,
  snapshot_time_utc TIMESTAMP NOT NULL,
  currency VARCHAR(5) NOT NULL,            -- 'BTC', 'ETH'
  spot_price NUMERIC(16,4) NOT NULL,
  net_gex NUMERIC(20,4) NOT NULL,          -- total net GEX in USD
  call_gex_total NUMERIC(20,4) NOT NULL,
  put_gex_total NUMERIC(20,4) NOT NULL,
  zero_gamma_strike NUMERIC(16,4),         -- null if no crossover
  instruments_fetched INTEGER NOT NULL,
  instruments_with_oi INTEGER NOT NULL,
  top_strikes JSONB NOT NULL,              -- top 10 strikes by |gexNotional|
  source VARCHAR(20) NOT NULL DEFAULT 'DERIBIT',
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gex_snapshot_time ON gex_snapshots (snapshot_time_utc DESC);
CREATE INDEX IF NOT EXISTS idx_gex_currency_time ON gex_snapshots (currency, snapshot_time_utc DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_gex_unique_snapshot
  ON gex_snapshots (date_trunc('hour', snapshot_time_utc), currency);
```

### 3. Add DB read/write functions
**Add to:** `src/lib/deribitGex.ts`

```typescript
export async function writeGexSnapshots(snapshots: GexSnapshot[]): Promise<number>;

export async function readLatestGexSnapshot(currency: DeribitCurrency): Promise<GexSnapshot | null>;

export async function readGexHistory(
  currency: DeribitCurrency,
  hoursBack: number,
): Promise<Array<{
  snapshotTimeUtc: string;
  spotPrice: number;
  netGex: number;
  zeroGammaStrike: number | null;
}>>;

export async function readAllLatestGex(): Promise<GexSnapshot[]>;
```

Use `getPool()` from `src/lib/db.ts`. Upsert by `(date_trunc('hour', snapshot_time_utc), currency)`.

### 4. Create cron endpoint
**Create:** `src/app/api/cron/gex-snapshot/route.ts`

Follow existing cron pattern:
```typescript
import { NextResponse } from "next/server";
import { isCronAuthorized } from "@/lib/cronAuth";
import { computeAllGexSnapshots, writeGexSnapshots } from "@/lib/deribitGex";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startedAt = new Date().toISOString();
  try {
    const snapshots = await computeAllGexSnapshots();
    const rowsWritten = await writeGexSnapshots(snapshots);

    return NextResponse.json({
      ok: true,
      task: "gex_snapshot",
      rows_written: rowsWritten,
      currencies: snapshots.map((s) => s.currency),
      btc_net_gex: snapshots.find((s) => s.currency === "BTC")?.netGex ?? null,
      eth_net_gex: snapshots.find((s) => s.currency === "ETH")?.netGex ?? null,
      started_at: startedAt,
      finished_at: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "GEX snapshot failed",
        started_at: startedAt,
        finished_at: new Date().toISOString(),
      },
      { status: 503 },
    );
  }
}
```

### 5. Create read API endpoint
**Create:** `src/app/api/flagship/gex/route.ts`

```typescript
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const currency = url.searchParams.get("currency")?.toUpperCase() as DeribitCurrency | null;
    const hoursBack = Number(url.searchParams.get("hoursBack")) || 0;

    if (currency && hoursBack > 0) {
      const history = await readGexHistory(currency, hoursBack);
      return NextResponse.json({ currency, history });
    }

    if (currency) {
      const snapshot = await readLatestGexSnapshot(currency);
      return NextResponse.json({ snapshot });
    }

    const all = await readAllLatestGex();
    return NextResponse.json({ snapshots: all });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to read GEX data" },
      { status: 500 },
    );
  }
}
```

### 6. Add minimal Flagship panel
**Modify:** `src/components/flagship/FlagshipBoard.tsx`

Add a collapsible "Crypto GEX" panel. Fetch from `/api/flagship/gex` every 60 seconds.

```tsx
{/* Crypto GEX Panel */}
<details open className="rounded-xl border border-[var(--panel-border)] bg-[var(--panel)]/60">
  <summary className="cursor-pointer px-4 py-2 text-sm font-semibold text-[var(--foreground)]">
    Crypto GEX (Deribit)
  </summary>
  <div className="px-4 pb-3">
    {gexLoading ? (
      <p className="text-xs text-[color:var(--muted)]">Loading…</p>
    ) : !gexData || gexData.length === 0 ? (
      <p className="text-xs text-[color:var(--muted)]">No GEX data. Run the cron endpoint to populate.</p>
    ) : (
      <div className="space-y-3">
        {gexData.map((snapshot) => (
          <div key={snapshot.currency} className="rounded-lg border border-[var(--panel-border)] bg-[var(--panel)] p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-bold text-[var(--foreground)]">{snapshot.currency}</span>
              <span className="text-xs text-[color:var(--muted)]">
                Spot: ${Number(snapshot.spotPrice).toLocaleString()}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
              <div>
                <span className="text-[color:var(--muted)]">Net GEX</span>
                <div className="font-mono" style={{
                  color: snapshot.netGex >= 0 ? "var(--accent-strong)" : "rgb(239 68 68)"
                }}>
                  ${(snapshot.netGex / 1e6).toFixed(1)}M
                </div>
              </div>
              <div>
                <span className="text-[color:var(--muted)]">Call GEX</span>
                <div className="font-mono text-[var(--foreground)]">
                  ${(snapshot.callGexTotal / 1e6).toFixed(1)}M
                </div>
              </div>
              <div>
                <span className="text-[color:var(--muted)]">Put GEX</span>
                <div className="font-mono text-[var(--foreground)]">
                  ${(snapshot.putGexTotal / 1e6).toFixed(1)}M
                </div>
              </div>
              <div>
                <span className="text-[color:var(--muted)]">Zero-Γ</span>
                <div className="font-mono text-[var(--foreground)]">
                  {snapshot.zeroGammaStrike
                    ? `$${Number(snapshot.zeroGammaStrike).toLocaleString()}`
                    : "—"}
                </div>
              </div>
            </div>
            <div className="mt-2 text-[10px] text-[color:var(--muted)]">
              {snapshot.instrumentsWithOI} instruments with OI
              {snapshot.netGex >= 0
                ? " · Positive GEX — dealers dampen moves (mean-reverting)"
                : " · Negative GEX — dealers amplify moves (trending)"}
            </div>
          </div>
        ))}
        {gexData[0]?.snapshotTimeUtc ? (
          <p className="text-[10px] text-[color:var(--muted)]">
            As of {new Date(gexData[0].snapshotTimeUtc).toLocaleString("en-US", { timeZone: "America/New_York" })} ET
          </p>
        ) : null}
      </div>
    )}
  </div>
</details>
```

Data fetching pattern (same as currency strength panel):
```typescript
const [gexData, setGexData] = useState<GexSnapshot[] | null>(null);
const [gexLoading, setGexLoading] = useState(true);

useEffect(() => {
  let cancelled = false;
  async function fetchGex() {
    try {
      const res = await fetch("/api/flagship/gex");
      if (!res.ok) throw new Error("Failed to fetch GEX");
      const json = await res.json();
      if (!cancelled) setGexData(json.snapshots ?? null);
    } catch {
      // silently fail
    } finally {
      if (!cancelled) setGexLoading(false);
    }
  }
  fetchGex();
  const interval = setInterval(fetchGex, 60_000);
  return () => { cancelled = true; clearInterval(interval); };
}, []);
```

## Testing

After implementing, run the migration:
```bash
psql $DATABASE_URL -f migrations/019_gex_snapshots.sql
```

Test the cron endpoint:
```bash
curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/gex-snapshot
```

This may take 30-90 seconds (fetching tickers for all instruments with OI).

Verify the API:
```bash
curl http://localhost:3000/api/flagship/gex
curl "http://localhost:3000/api/flagship/gex?currency=BTC&hoursBack=24"
```

Check the Flagship page at `/flagship` — Crypto GEX panel should display BTC and ETH snapshots.

## Timeout consideration
The cron endpoint may take 60-120 seconds for both currencies. Ensure the route has sufficient timeout configured. If running on Vercel, serverless function timeout may be an issue (default 10s on hobby, 60s on pro). If timeout is a concern, split into two separate cron calls:
- `/api/cron/gex-snapshot?currency=BTC`
- `/api/cron/gex-snapshot?currency=ETH`

Add optional `currency` query param support to the cron endpoint for this purpose.

## Do NOT
- Do not add npm dependencies
- Do not create README or documentation files
- Do not modify existing cron endpoints or lib modules
- Do not modify `DashboardLayout.tsx`
- Do not change the currency strength or daily sentiment panels
- Do not implement GEX for FX/metals (that requires CME data — future phase)
- Do not authenticate with Deribit — all endpoints used are public
- Do not use WebSocket — REST polling is sufficient for hourly snapshots
