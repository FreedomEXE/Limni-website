# Codex Prompt — Phase 4: Crypto & Commodity Strength Meters

## Objective
Build separate strength meters for Crypto (BTC, ETH) and Commodities (XAU, XAG, WTI), modeled after the existing FX currency strength pipeline. Each asset's strength is computed as its percentage change vs USD over rolling windows (1h, 4h, 24h), normalized to a 0-100 scale within its asset class. Uses OANDA H1 candles (same data source as FX strength). Includes: calculation logic, DB storage, hourly ingestion cron endpoint, read API, and Flagship panels.

## Context
- The project is a Next.js app at `C:/Users/User/Documents/GitHub/limni-website`
- OANDA candle fetching exists at `src/lib/oandaPrices.ts`:
  - `fetchOandaCandleSeries(symbol, fromUtc, toUtc)` returns `OandaHourlyCandle[]` with `{ts, open, close}`
  - `getOandaInstrument(symbol)` maps pair names to OANDA instrument IDs
  - Already maps: `BTCUSD → BTC_USD`, `ETHUSD → ETH_USD`, `XAUUSD → XAU_USD`, `XAGUSD → XAG_USD`, `WTIUSD → WTICO_USD`
  - Has retry logic (3 attempts, 400ms backoff), pagination
  - Requires `OANDA_API_KEY` and `OANDA_ACCOUNT_ID` env vars
- The FX currency strength pipeline exists at `src/lib/currencyStrength.ts` — reference it for patterns but do NOT modify it
- Cron endpoints live at `src/app/api/cron/` and use `isCronAuthorized(request)` from `src/lib/cronAuth.ts`
- API routes use Next.js App Router pattern: `export async function GET(request: Request)` returning `NextResponse.json()`
- The Flagship page exists at `src/app/flagship/page.tsx` → `src/components/flagship/FlagshipBoard.tsx`
- Existing design system uses CSS variables: `var(--panel)`, `var(--panel-border)`, `var(--foreground)`, `var(--muted)`, `var(--accent)`
- Asset class pairs are defined in `src/lib/cotPairs.ts` under `PAIRS_BY_ASSET_CLASS`

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

## Asset Classes & Instruments

### Crypto (2 instruments)
All quoted in USD. Data source: OANDA.
```
BTCUSD (BTC_USD)  — Bitcoin
ETHUSD (ETH_USD)  — Ethereum
```

### Commodities (3 instruments)
All quoted in USD. Data source: OANDA.
```
XAUUSD (XAU_USD)   — Gold
XAGUSD (XAG_USD)   — Silver
WTIUSD (WTICO_USD) — WTI Crude Oil
```

## Strength Calculation Methodology

Unlike FX strength (which averages across 7 cross-pairs per currency), crypto and commodity strength is simpler:

**Each asset's strength = its percentage change vs USD over the rolling window.**

```typescript
// For each asset in the class:
// 1. Fetch H1 candles for ASSET/USD pair over the window
// 2. return_pct = ((last_close - first_open) / first_open) * 100
// 3. That IS the raw strength — no cross-pair averaging needed
// 4. Normalize across the asset class to 0-100:
//    - Strongest asset in class = 100
//    - Weakest asset in class = 0
//    - Others linearly interpolated
//    - If all values identical (span ≈ 0), set all to 50
```

**Why this is a good proxy:** MarketMilk runs separate strength meters per asset class. For FX, each currency appears in 7 cross-pairs so averaging is needed. For crypto and commodities in this system, each asset has a single USD pair, so the USD return is a practical strength proxy. The normalization step makes assets within a class comparable. Treat this as a "MarketMilk-style" meter, not an exact clone of a proprietary formula.

## Tasks

### 1. Create asset strength calculation module
**Create:** `src/lib/assetStrength.ts`

#### Types
```typescript
export type AssetClass = "crypto" | "commodities";

export type AssetStrengthSnapshot = {
  asset: string;          // "BTC", "ETH", "XAU", "XAG", "WTI"
  raw: number;            // raw % change vs USD
  normalized: number;     // 0-100 scaled within class
};

export type AssetStrengthResult = {
  snapshotTimeUtc: string;
  assetClass: AssetClass;
  window: "1h" | "4h" | "24h";
  strengths: AssetStrengthSnapshot[];
};
```

#### Asset class definitions
Build static maps from `PAIRS_BY_ASSET_CLASS` in `src/lib/cotPairs.ts`:

```typescript
import { PAIRS_BY_ASSET_CLASS } from "./cotPairs";

const CRYPTO_ASSETS = PAIRS_BY_ASSET_CLASS.crypto.map((p) => ({
  pair: p.pair.trim().toUpperCase(),
  asset: p.base.trim().toUpperCase(),
}));
// Result: [{ pair: "BTCUSD", asset: "BTC" }, { pair: "ETHUSD", asset: "ETH" }]

const COMMODITY_ASSETS = PAIRS_BY_ASSET_CLASS.commodities.map((p) => ({
  pair: p.pair.trim().toUpperCase(),
  asset: p.base.trim().toUpperCase(),
}));
// Result: [{ pair: "XAUUSD", asset: "XAU" }, { pair: "XAGUSD", asset: "XAG" }, { pair: "WTIUSD", asset: "WTI" }]

const ASSET_CLASS_MAP: Record<AssetClass, Array<{ pair: string; asset: string }>> = {
  crypto: CRYPTO_ASSETS,
  commodities: COMMODITY_ASSETS,
};
```

#### Functions to implement

```typescript
/**
 * Compute asset strength for all instruments in a given asset class over a rolling window.
 * Fetches H1 candles from OANDA for each USD pair within the window.
 *
 * @param assetClass - "crypto" or "commodities"
 * @param windowHours - lookback window (1, 4, or 24)
 * @param asOfUtc - reference time (defaults to now, truncated to hour)
 */
export async function computeAssetClassStrength(
  assetClass: AssetClass,
  windowHours: 1 | 4 | 24,
  asOfUtc?: DateTime,
): Promise<AssetStrengthResult>;

/**
 * Compute all windows (1h, 4h, 24h) for a single asset class.
 * Optimizes by fetching 24h of candles once per pair and slicing for shorter windows.
 */
export async function computeAllWindowsForClass(
  assetClass: AssetClass,
  asOfUtc?: DateTime,
): Promise<AssetStrengthResult[]>;

/**
 * Compute ALL strength results: both crypto and commodities, all 3 windows.
 * Returns 6 results total (2 classes × 3 windows).
 */
export async function computeAllAssetStrengths(
  asOfUtc?: DateTime,
): Promise<AssetStrengthResult[]>;
```

#### Calculation logic (per asset class, per window)

```typescript
function computeClassWindowStrength(
  assetClass: AssetClass,
  windowHours: 1 | 4 | 24,
  asOfHourUtc: DateTime,
  candlesByPair: Map<string, OandaHourlyCandle[]>,
): AssetStrengthResult {
  const assets = ASSET_CLASS_MAP[assetClass];
  const windowStartMs = asOfHourUtc.minus({ hours: windowHours }).toMillis();
  const asOfMs = asOfHourUtc.toMillis();

  const rawRows = assets.map(({ pair, asset }) => {
    const candles = (candlesByPair.get(pair) ?? []).filter(
      (c) => c.ts >= windowStartMs && c.ts < asOfMs,
    );
    if (candles.length < 1) return { asset, raw: 0 };
    const first = candles[0];
    const last = candles[candles.length - 1];
    if (!(first.open > 0)) return { asset, raw: 0 };
    const raw = ((last.close - first.open) / first.open) * 100;
    return { asset, raw };
  });

  // Normalize within this asset class
  const minRaw = Math.min(...rawRows.map((r) => r.raw));
  const maxRaw = Math.max(...rawRows.map((r) => r.raw));
  const span = maxRaw - minRaw;

  const strengths = rawRows.map((r) => ({
    asset: r.asset,
    raw: r.raw,
    normalized: span > 1e-12 ? ((r.raw - minRaw) / span) * 100 : 50,
  }));

  return {
    snapshotTimeUtc: asOfHourUtc.toISO() ?? new Date(asOfHourUtc.toMillis()).toISOString(),
    assetClass,
    window: HOURS_TO_WINDOW[windowHours],
    strengths,
  };
}
```

#### Performance optimization
- Fetch 24h of H1 candles for all 5 pairs (5 OANDA API calls total — 2 crypto + 3 commodities)
- Add 100ms delay between OANDA calls (same pattern as `currencyStrength.ts`)
- Slice the 24h candle array for 4h and 1h windows (no extra API calls)
- Cache results in-memory for 5 minutes keyed by `asOfHourUtc`

```typescript
type AssetStrengthCacheEntry = {
  asOfHourUtc: string;
  expiresAtMs: number;
  results: AssetStrengthResult[];
};

let assetStrengthCache: AssetStrengthCacheEntry | null = null;
```

#### Helper: normalize asOfHour (same pattern as currencyStrength.ts)
```typescript
function normalizeAsOfHour(asOfUtc?: DateTime): DateTime {
  const raw = (asOfUtc ?? DateTime.utc()).toUTC();
  return raw.startOf("hour");
}
```

### 2. Create DB migration
**Create:** `migrations/020_asset_strength_snapshots.sql`

```sql
CREATE TABLE IF NOT EXISTS asset_strength_snapshots (
  id SERIAL PRIMARY KEY,
  snapshot_time_utc TIMESTAMP NOT NULL,
  asset_class VARCHAR(16) NOT NULL,         -- 'crypto', 'commodities'
  "window" VARCHAR(10) NOT NULL,            -- '1h', '4h', '24h'
  asset VARCHAR(10) NOT NULL,               -- 'BTC', 'ETH', 'XAU', 'XAG', 'WTI'
  raw_strength NUMERIC(12,6) NOT NULL,      -- raw % change vs USD
  normalized_strength NUMERIC(6,2) NOT NULL, -- 0-100 scale
  source VARCHAR(20) NOT NULL DEFAULT 'OANDA',
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_as_snapshot_time
  ON asset_strength_snapshots (snapshot_time_utc DESC);

CREATE INDEX IF NOT EXISTS idx_as_asset_class_window
  ON asset_strength_snapshots (asset_class, "window", snapshot_time_utc DESC);

CREATE INDEX IF NOT EXISTS idx_as_asset_window
  ON asset_strength_snapshots (asset, "window", snapshot_time_utc DESC);

-- One row per asset per window per snapshot time
CREATE UNIQUE INDEX IF NOT EXISTS idx_as_unique_snapshot
  ON asset_strength_snapshots (snapshot_time_utc, "window", asset);
```

**IMPORTANT:** The column name `window` is a PostgreSQL reserved word. Always double-quote it in all SQL: `"window"`.

### 3. Add DB read/write functions
**Add to:** `src/lib/assetStrength.ts` (same file as calculation logic)

```typescript
/**
 * Write asset strength snapshots to the DB.
 * Uses upsert (ON CONFLICT DO UPDATE) to handle re-runs.
 */
export async function writeAssetStrengthSnapshots(
  results: AssetStrengthResult[],
): Promise<number>; // returns rows written

/**
 * Read the latest asset strength snapshot for a given asset class and window.
 */
export async function readLatestAssetStrength(
  assetClass: AssetClass,
  window: "1h" | "4h" | "24h",
): Promise<AssetStrengthResult | null>;

/**
 * Read asset strength history for a specific asset and window.
 */
export async function readAssetStrengthHistory(
  asset: string,
  window: "1h" | "4h" | "24h",
  hoursBack: number,
): Promise<Array<{ snapshotTimeUtc: string; raw: number; normalized: number }>>;

/**
 * Read all latest snapshots for a given asset class (all 3 windows).
 */
export async function readAllLatestAssetStrengths(
  assetClass: AssetClass,
): Promise<AssetStrengthResult[]>;

/**
 * Read all latest snapshots for ALL asset classes (both crypto and commodities).
 */
export async function readAllLatestAssetStrengthsAll(): Promise<AssetStrengthResult[]>;
```

Use `getPool()` from `src/lib/db.ts`.

#### Write function pattern
Follow the exact pattern from `currencyStrength.ts` → `writeCurrencyStrengthSnapshots`:
- `BEGIN` transaction
- Loop through results and strengths
- `INSERT ... ON CONFLICT (snapshot_time_utc, "window", asset) DO UPDATE SET ...`
- `COMMIT` on success, `ROLLBACK` on error
- `client.release()` in finally block

#### Read function — timezone bug prevention
**CRITICAL:** When chaining two queries (first query gets the latest `snapshot_time_utc`, second query filters by it), pass the raw Date object from the first query directly to the second query. Do NOT convert through `toISOString()` or any date formatting before the second query — the PostgreSQL driver handles Date objects correctly, but string conversion can introduce timezone offset errors.

```typescript
// CORRECT:
const rawSnapshotTime = latest.rows[0].snapshot_time_utc; // keep as Date
const rows = await pool.query(
  `...WHERE snapshot_time_utc = $1::timestamp...`,
  [rawSnapshotTime], // pass raw Date
);
const snapshotTimeUtc = toIsoUtc(rawSnapshotTime); // convert only for JSON response

// WRONG — do not do this:
const snapshotTimeUtc = toIsoUtc(latest.rows[0].snapshot_time_utc); // converts to string
const rows = await pool.query(
  `...WHERE snapshot_time_utc = $1::timestamp...`,
  [snapshotTimeUtc], // string may have wrong timezone offset
);
```

### 4. Create cron endpoint
**Create:** `src/app/api/cron/asset-strength/route.ts`

Follow the existing cron pattern:

```typescript
import { NextResponse } from "next/server";
import { isCronAuthorized } from "@/lib/cronAuth";
import { computeAllAssetStrengths, writeAssetStrengthSnapshots } from "@/lib/assetStrength";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startedAt = new Date().toISOString();
  try {
    const results = await computeAllAssetStrengths();
    const rowsWritten = await writeAssetStrengthSnapshots(results);

    return NextResponse.json({
      ok: true,
      task: "asset_strength",
      rows_written: rowsWritten,
      asset_classes: [...new Set(results.map((r) => r.assetClass))],
      windows: [...new Set(results.map((r) => r.window))],
      snapshot_time: results[0]?.snapshotTimeUtc ?? null,
      started_at: startedAt,
      finished_at: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Asset strength ingestion failed",
        started_at: startedAt,
        finished_at: new Date().toISOString(),
      },
      { status: 503 },
    );
  }
}
```

### 5. Create read API endpoint
**Create:** `src/app/api/flagship/asset-strength/route.ts`

```typescript
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const assetClass = url.searchParams.get("class") as AssetClass | null;
    const asset = url.searchParams.get("asset")?.toUpperCase() ?? null;
    const window = url.searchParams.get("window") as "1h" | "4h" | "24h" | null;
    const hoursBack = Number(url.searchParams.get("hoursBack")) || 0;

    // History for a specific asset
    if (asset && hoursBack > 0 && window) {
      const history = await readAssetStrengthHistory(asset, window, hoursBack);
      return NextResponse.json({ asset, window, history });
    }

    // Specific asset class
    if (assetClass) {
      const strengths = await readAllLatestAssetStrengths(assetClass);
      return NextResponse.json({ assetClass, strengths });
    }

    // Default: return all latest (both crypto and commodities)
    const all = await readAllLatestAssetStrengthsAll();
    return NextResponse.json({ strengths: all });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to read asset strength" },
      { status: 500 },
    );
  }
}
```

### 6. Add Flagship panels
**Modify:** `src/components/flagship/FlagshipBoard.tsx`

Add TWO new collapsible panels — one for Crypto Strength, one for Commodity Strength. Place them AFTER the Currency Strength panel and BEFORE the Crypto GEX panel (if it exists).

#### Data fetching
Add a single `useEffect` to fetch from `/api/flagship/asset-strength` on mount and every 60 seconds:

```typescript
const [assetStrengthData, setAssetStrengthData] = useState<AssetStrengthResult[] | null>(null);
const [assetStrengthLoading, setAssetStrengthLoading] = useState(true);

useEffect(() => {
  let cancelled = false;
  async function fetchAssetStrength() {
    try {
      const res = await fetch("/api/flagship/asset-strength", { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to fetch asset strength");
      const json = await res.json();
      if (!cancelled) setAssetStrengthData(json.strengths ?? null);
    } catch {
      // silently fail — panels show "no data"
    } finally {
      if (!cancelled) setAssetStrengthLoading(false);
    }
  }
  fetchAssetStrength();
  const interval = setInterval(fetchAssetStrength, 60_000);
  return () => { cancelled = true; clearInterval(interval); };
}, []);
```

#### Helper to split data by asset class
```typescript
const cryptoStrengths = assetStrengthData?.filter((r) => r.assetClass === "crypto") ?? [];
const commodityStrengths = assetStrengthData?.filter((r) => r.assetClass === "commodities") ?? [];
```

#### Crypto Strength Panel
```tsx
{/* Crypto Strength Panel */}
<details open className="rounded-xl border border-[var(--panel-border)] bg-[var(--panel)]/60">
  <summary className="cursor-pointer px-4 py-2 text-sm font-semibold text-[var(--foreground)]">
    Crypto Strength
  </summary>
  <div className="px-4 pb-3">
    {assetStrengthLoading ? (
      <p className="text-xs text-[color:var(--muted)]">Loading...</p>
    ) : cryptoStrengths.length === 0 ? (
      <p className="text-xs text-[color:var(--muted)]">No crypto strength data available. Run the cron endpoint to populate.</p>
    ) : (
      <div className="space-y-2">
        {cryptoStrengths.map((windowResult) => (
          <div key={windowResult.window}>
            <p className="mb-1 text-xs font-medium text-[color:var(--muted)] uppercase">{windowResult.window} window</p>
            <div className="grid grid-cols-2 gap-1">
              {windowResult.strengths
                .sort((a, b) => b.normalized - a.normalized)
                .map((s) => (
                  <div
                    key={s.asset}
                    className="rounded-lg border border-[var(--panel-border)] bg-[var(--panel)] px-2 py-1 text-center"
                  >
                    <span className="text-xs font-bold text-[var(--foreground)]">{s.asset}</span>
                    <div
                      className="mt-0.5 text-sm font-mono"
                      style={{
                        color: s.normalized >= 60
                          ? "var(--accent-strong)"
                          : s.normalized <= 40
                            ? "rgb(239 68 68)"
                            : "var(--muted)",
                      }}
                    >
                      {s.normalized.toFixed(0)}
                    </div>
                  </div>
                ))}
            </div>
          </div>
        ))}
        {cryptoStrengths[0]?.snapshotTimeUtc ? (
          <p className="text-[10px] text-[color:var(--muted)]">
            As of {new Date(cryptoStrengths[0].snapshotTimeUtc).toLocaleString("en-US", { timeZone: "America/New_York" })} ET
          </p>
        ) : null}
      </div>
    )}
  </div>
</details>
```

#### Commodity Strength Panel
Same structure as crypto panel but for commodities. Use `commodityStrengths` and `grid-cols-3` (3 commodities).

```tsx
{/* Commodity Strength Panel */}
<details open className="rounded-xl border border-[var(--panel-border)] bg-[var(--panel)]/60">
  <summary className="cursor-pointer px-4 py-2 text-sm font-semibold text-[var(--foreground)]">
    Commodity Strength
  </summary>
  <div className="px-4 pb-3">
    {assetStrengthLoading ? (
      <p className="text-xs text-[color:var(--muted)]">Loading...</p>
    ) : commodityStrengths.length === 0 ? (
      <p className="text-xs text-[color:var(--muted)]">No commodity strength data available. Run the cron endpoint to populate.</p>
    ) : (
      <div className="space-y-2">
        {commodityStrengths.map((windowResult) => (
          <div key={windowResult.window}>
            <p className="mb-1 text-xs font-medium text-[color:var(--muted)] uppercase">{windowResult.window} window</p>
            <div className="grid grid-cols-3 gap-1">
              {windowResult.strengths
                .sort((a, b) => b.normalized - a.normalized)
                .map((s) => (
                  <div
                    key={s.asset}
                    className="rounded-lg border border-[var(--panel-border)] bg-[var(--panel)] px-2 py-1 text-center"
                  >
                    <span className="text-xs font-bold text-[var(--foreground)]">{s.asset}</span>
                    <div
                      className="mt-0.5 text-sm font-mono"
                      style={{
                        color: s.normalized >= 60
                          ? "var(--accent-strong)"
                          : s.normalized <= 40
                            ? "rgb(239 68 68)"
                            : "var(--muted)",
                      }}
                    >
                      {s.normalized.toFixed(0)}
                    </div>
                  </div>
                ))}
            </div>
          </div>
        ))}
        {commodityStrengths[0]?.snapshotTimeUtc ? (
          <p className="text-[10px] text-[color:var(--muted)]">
            As of {new Date(commodityStrengths[0].snapshotTimeUtc).toLocaleString("en-US", { timeZone: "America/New_York" })} ET
          </p>
        ) : null}
      </div>
    )}
  </div>
</details>
```

## Testing

After implementing, run the migration:
```bash
psql $DATABASE_URL -f migrations/020_asset_strength_snapshots.sql
```

Test the cron endpoint:
```bash
curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/asset-strength
```

Verify the API returns data:
```bash
curl http://localhost:3000/api/flagship/asset-strength
curl "http://localhost:3000/api/flagship/asset-strength?class=crypto"
curl "http://localhost:3000/api/flagship/asset-strength?class=commodities"
curl "http://localhost:3000/api/flagship/asset-strength?asset=BTC&window=1h&hoursBack=24"
```

Check the Flagship page at `/flagship` — Crypto Strength and Commodity Strength panels should display.

## Do NOT
- Do not modify `src/lib/oandaPrices.ts` — use it as-is
- Do not modify `src/lib/cotPairs.ts` — import from it
- Do not modify `src/lib/currencyStrength.ts` — this is a separate module
- Do not modify existing cron endpoints or API routes
- Do not modify `DashboardLayout.tsx`
- Do not add npm dependencies
- Do not create README or documentation files
- Do not build real-time 1-minute strength — that comes in a future phase
- Do not touch backtest scripts
- Do not add index strength (indices are not part of this phase)
