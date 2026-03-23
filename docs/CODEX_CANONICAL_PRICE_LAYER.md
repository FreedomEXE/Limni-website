/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
# Codex Brief: Institutional Canonical Price Layer
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

## Purpose

Build the canonical historical price substrate for the entire project.

This is not just a weekly returns table. It must support:

- current weekly-hold reconstruction work
- current and future intraday / Katarakti research
- shared UI data reads from one authoritative source
- reproducible backtests without re-fetching provider data every time
- future zoom from weekly -> daily -> intraday without redesign

The old `pair_period_returns`-only plan is too shallow to be the root layer. Returns are derived data. The source of truth must be canonical bars.

## Current Problem

Today, price truth is fragmented:

- `performance_snapshots.pair_details.percent` stores returns inside model snapshots
- `market_snapshots` stores cached weekly performance views, not canonical history
- strategy scripts often fetch Oanda / Bitget directly for their own research runs
- there is no first-class way to ask:
  - "How did EURUSD perform during the week of 2026-01-19?"
  - "Show BTCUSD daily path inside that week"
  - "Recompute this strategy on a tighter exit window without refetching price data"

That architecture is serviceable for experiments, but it is not institutional grade.

## Institutional Architecture

Use a 3-layer stack:

```text
Layer 0: instrument_registry
         Canonical symbol master and provider mapping

Layer 1: raw_price_bars
         Provider-native append-only bars from Oanda / Bitget
         Audit trail. Never strategy-specific.

Layer 2: canonical_price_bars
         Normalized house view of history
         One canonical symbol, one timeframe, one bar-open

Layer 3: pair_period_returns
         Derived weekly / daily / session returns from canonical bars
         Convenience and speed layer, not root truth
```

Existing layers remain above this:

```text
Layer 4: performance_snapshots
         Model opinions: "Dealer says LONG EURUSD"

Layer 5: reconstruction / strategy engines
         Netting, tiering, filters, gates

Layer 6: strategy_backtest_* and UI
         Persisted system outcomes and product surfaces
```

## Design Principles

- Canonical bars are the lowest trusted layer for research.
- Returns are derived from bars, never treated as primary truth.
- Provider fetch logic must be separated from strategy logic.
- Session / window definitions must be centralized.
- Historical data must be idempotently backfillable.
- Provider-native raw bars must remain available for audit.
- All higher layers should eventually read canonical derived data, not fetch providers directly.

## Scope For This Brief

Implement the canonical historical price substrate in a way that works now and does not need redesign later.

This brief includes:

- symbol master
- raw provider bars
- canonical normalized bars
- derived pair period returns
- backfill for weekly and daily
- verification against existing `performance_snapshots`
- query helpers for shared reads

This brief does not yet rewire weekly reconstruction or intraday engines to consume the new layer. That is the next phase after validation.

## Execution Clarifications

The current provider helpers are not fully sufficient for canonical OHLC ingestion as-is.

Codex is explicitly allowed to make targeted, minimal extensions to provider utilities where needed for this price-layer work:

- extend Oanda response parsing to capture `high` and `low`
- add Oanda daily series support
- add dedicated canonical-ingestion fetch helpers if that is cleaner than overloading existing ones
- add Bitget daily series support if needed for provider-native daily ingestion

Do not rewrite provider modules broadly. Keep changes narrow and backward-compatible.

## What "Canonical" Means Here

Canonical means:

- one row per canonical symbol
- one row per timeframe
- one row per bar-open timestamp
- deterministic window boundaries
- deterministic symbol mapping
- deterministic return derivation

For example:

- `EURUSD`, `fx`, `5m`, `2026-01-19T22:05:00.000Z`
- `BTCUSD`, `crypto`, `1d`, `2026-02-09T00:00:00.000Z`

It must be possible to derive weekly, daily, and intraday views from the same underlying bar history.

## Timeframe Strategy

Do not build this around weekly-only storage.

Recommended approach:

- store canonical daily bars immediately for the full 36-pair universe
- store canonical weekly returns derived from daily bars immediately
- support intraday-capable schema from day one
- phase intraday bar backfill separately if needed

If feasible now, use these base granularities:

- FX / indices / commodities base granularity: `5m`
- crypto base granularity: `5m`

If cost, time, or provider constraints make full historical `5m` backfill too heavy for this phase, then:

- still build the schema for intraday bars now
- backfill `1d` first for the full 36-pair universe
- derive weekly returns from `1d`
- treat intraday bar backfill as Phase 2

The key architectural rule is: the schema must be intraday-capable even if the first backfill is only daily + weekly.

## Job 1: Symbol Master

Create `src/lib/canonicalInstruments.ts`

This file should define the canonical instrument universe for the current flagship stack:

- 28 FX pairs
- 3 indices
- 2 crypto pairs
- 3 commodities

Each canonical instrument row should include:

- `symbol`
- `assetClass`
- `primaryProvider`
- `oandaInstrument` or `null`
- `bitgetBaseCoin` or `null`
- `isActive`

Example shape:

```typescript
export type CanonicalInstrument = {
  symbol: string;
  assetClass: AssetClass;
  primaryProvider: "oanda" | "bitget";
  oandaInstrument: string | null;
  bitgetBaseCoin: string | null;
  isActive: boolean;
};
```

This becomes the single source of truth for symbol selection.

Do not scatter symbol lists across multiple new files.

Use the existing override mapping in [oandaPrices.ts](c:/Users/User/Documents/GitHub/limni-website/src/lib/oandaPrices.ts) as the source of truth for Oanda instrument naming. The seeded `oandaInstrument` values in `instrument_registry` must resolve exactly the same way as `getOandaInstrument()`.

## Job 2: Migrations

Create `migrations/022_canonical_price_layer.sql`

This migration must create these tables:

### `instrument_registry`

```sql
CREATE TABLE IF NOT EXISTS instrument_registry (
  id BIGSERIAL PRIMARY KEY,
  symbol TEXT NOT NULL UNIQUE,
  asset_class TEXT NOT NULL,
  primary_provider TEXT NOT NULL,
  oanda_instrument TEXT,
  bitget_base_coin TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### `raw_price_bars`

Provider-native audit trail.

```sql
CREATE TABLE IF NOT EXISTS raw_price_bars (
  id BIGSERIAL PRIMARY KEY,
  provider TEXT NOT NULL,
  provider_symbol TEXT NOT NULL,
  asset_class TEXT NOT NULL,
  timeframe TEXT NOT NULL,
  bar_open_utc TIMESTAMPTZ NOT NULL,
  bar_close_utc TIMESTAMPTZ NOT NULL,
  open_price DOUBLE PRECISION NOT NULL,
  high_price DOUBLE PRECISION NOT NULL,
  low_price DOUBLE PRECISION NOT NULL,
  close_price DOUBLE PRECISION NOT NULL,
  volume DOUBLE PRECISION,
  is_final BOOLEAN NOT NULL DEFAULT TRUE,
  source_batch_key TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (provider, provider_symbol, timeframe, bar_open_utc)
);

CREATE INDEX IF NOT EXISTS idx_raw_price_bars_lookup
  ON raw_price_bars (provider, provider_symbol, timeframe, bar_open_utc DESC);
```

### `canonical_price_bars`

House-normalized view used by research and application logic.

```sql
CREATE TABLE IF NOT EXISTS canonical_price_bars (
  id BIGSERIAL PRIMARY KEY,
  symbol TEXT NOT NULL,
  asset_class TEXT NOT NULL,
  timeframe TEXT NOT NULL,
  bar_open_utc TIMESTAMPTZ NOT NULL,
  bar_close_utc TIMESTAMPTZ NOT NULL,
  open_price DOUBLE PRECISION NOT NULL,
  high_price DOUBLE PRECISION NOT NULL,
  low_price DOUBLE PRECISION NOT NULL,
  close_price DOUBLE PRECISION NOT NULL,
  source_provider TEXT NOT NULL,
  quality_status TEXT NOT NULL DEFAULT 'verified',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (symbol, timeframe, bar_open_utc)
);

CREATE INDEX IF NOT EXISTS idx_canonical_price_bars_lookup
  ON canonical_price_bars (symbol, timeframe, bar_open_utc DESC);

CREATE INDEX IF NOT EXISTS idx_canonical_price_bars_asset_timeframe
  ON canonical_price_bars (asset_class, timeframe, bar_open_utc DESC);
```

### `pair_period_returns`

Derived layer. Keep it because weekly and daily queries will use it heavily.

```sql
CREATE TABLE IF NOT EXISTS pair_period_returns (
  id BIGSERIAL PRIMARY KEY,
  symbol TEXT NOT NULL,
  asset_class TEXT NOT NULL,
  period_type TEXT NOT NULL,
  period_open_utc TIMESTAMPTZ NOT NULL,
  period_close_utc TIMESTAMPTZ NOT NULL,
  open_price DOUBLE PRECISION NOT NULL,
  close_price DOUBLE PRECISION NOT NULL,
  high_price DOUBLE PRECISION,
  low_price DOUBLE PRECISION,
  return_pct DOUBLE PRECISION NOT NULL,
  source TEXT NOT NULL,
  derived_from_timeframe TEXT NOT NULL,
  derivation_version TEXT NOT NULL DEFAULT 'v1',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (symbol, asset_class, period_type, period_open_utc)
);

CREATE INDEX IF NOT EXISTS idx_pair_period_returns_lookup
  ON pair_period_returns (symbol, period_type, period_open_utc DESC);

CREATE INDEX IF NOT EXISTS idx_pair_period_returns_asset_period
  ON pair_period_returns (asset_class, period_type, period_open_utc DESC);
```

## Job 3: Session And Window Rules

Create `src/lib/canonicalPriceWindows.ts`

This file centralizes all session and aggregation rules.

It must define:

- canonical weekly windows
- canonical daily windows
- mapping from `week_open_utc` to daily child windows
- asset-class-specific session rules

Rules to support now:

- FX weekly: Sunday 17:00 New York -> Friday 17:00 New York
- indices weekly: current `pricePerformance.ts` convention
- commodities weekly: current `pricePerformance.ts` convention
- crypto weekly: Monday 00:00 UTC -> Monday 00:00 UTC
- FX daily: 17:00 New York -> 17:00 New York next day
- indices daily: 18:00 New York -> 17:00 New York next day
- commodities daily: 18:00 New York -> 17:00 New York next day
- crypto daily: 00:00 UTC -> 00:00 UTC next day

Use the same logic conventions currently embedded in [pricePerformance.ts](c:/Users/User/Documents/GitHub/limni-website/src/lib/pricePerformance.ts), but move the shared window math into a dedicated reusable module for all future price derivations.

Do not leave session rules buried across multiple scripts.

## Job 4: Backfill Script

Create `scripts/backfill-canonical-price-layer.ts`

This script should be phase-aware and idempotent.

Suggested flags:

- `--seed-instruments`
- `--daily`
- `--weekly`
- `--intraday-5m`
- `--from=...`
- `--to=...`
- `--symbols=EURUSD,BTCUSD`

### Phase 1 Required

Backfill the full 36-pair universe for:

- canonical daily bars
- derived weekly returns
- derived daily returns

Use the existing fetch utilities:

- [oandaPrices.ts](c:/Users/User/Documents/GitHub/limni-website/src/lib/oandaPrices.ts)
- [bitget.ts](c:/Users/User/Documents/GitHub/limni-website/src/lib/bitget.ts)

It is acceptable to extend these utilities in a backward-compatible way for canonical ingestion.

### Ingestion Flow

For each instrument:

1. fetch provider data
2. upsert `raw_price_bars`
3. normalize into `canonical_price_bars`
4. derive `pair_period_returns`

### Provider Ingestion Requirements

For Oanda:

- canonical ingestion must capture `open`, `high`, `low`, `close`
- daily ingestion should use provider-native daily candles rather than aggregating hourly bars unless there is no clean provider-native path
- if the current helpers do not expose these fields or granularities, extend them or add dedicated canonical-ingestion helpers

For Bitget:

- canonical ingestion must capture `open`, `high`, `low`, `close`
- use provider-native daily candles if the API supports them cleanly
- otherwise derive daily canonical bars from lower-timeframe canonical bars, not from ad hoc strategy code

The important architectural rule is that `raw_price_bars` and `canonical_price_bars` must retain full OHLC, not just open/close.

### Minimum Weekly Scope

Use the existing canonical weeks:

```typescript
const CANONICAL_WEEKS = [
  "2026-01-19T00:00:00.000Z",
  "2026-01-26T00:00:00.000Z",
  "2026-02-02T00:00:00.000Z",
  "2026-02-09T00:00:00.000Z",
  "2026-02-16T00:00:00.000Z",
  "2026-02-23T00:00:00.000Z",
  "2026-03-02T00:00:00.000Z",
  "2026-03-08T23:00:00.000Z",
  "2026-03-15T23:00:00.000Z"
];
```

### Phase 2 Optional In This Same Script

If practical, also support `--intraday-5m` backfill for the same universe and date range.

If that is too heavy for this pass, the script structure must still support it cleanly later.

## Job 5: Canonical Derivation Rules

Derive `pair_period_returns` from `canonical_price_bars`, not directly from provider fetches.

That means:

- weekly rows should be derived from canonical daily bars or lower
- daily rows should be derived from canonical daily bars or lower
- future session returns should also be derived from canonical bars

Return formula:

```typescript
returnPct = ((closePrice - openPrice) / openPrice) * 100;
```

For derived rows:

- `open_price` = first canonical bar open in the window
- `close_price` = last canonical bar close in the window
- `high_price` = max high across the window
- `low_price` = min low across the window

Never let strategy scripts define their own period-return math once this layer exists.

## Job 6: Verification

Create `scripts/verify-canonical-price-layer.ts`

This script must perform two validations:

### A. Internal Consistency

Verify:

- every `pair_period_returns` weekly row can be recomputed from canonical bars
- every `pair_period_returns` daily row can be recomputed from canonical bars
- there are no missing periods for the 36-pair universe inside the requested windows

### B. Legacy Cross-Verification

Compare weekly canonical returns against `performance_snapshots.pair_details.percent`.

Expected output:

- total comparisons
- matches within tolerance
- mismatches
- biggest deltas
- per-provider summary

Write report:

- `reports/canonical-price-layer-verification.json`

Flag any row where `|delta_pct| > 1.0`

This is required because it tells us whether the old model-layer return storage materially diverges from the new canonical price layer.

## Job 7: Query Helpers

Create:

- `src/lib/canonicalPriceBars.ts`
- `src/lib/pairReturns.ts`

### `canonicalPriceBars.ts`

Expose helpers such as:

```typescript
export async function getCanonicalBars(
  symbol: string,
  timeframe: string,
  fromUtc: string,
  toUtc: string,
): Promise<Array<...>>

export async function getLatestCanonicalBar(
  symbol: string,
  timeframe: string,
): Promise<... | null>
```

### `pairReturns.ts`

Expose helpers such as:

```typescript
export async function getPairReturn(
  symbol: string,
  periodType: "weekly" | "daily",
  periodOpenUtc: string,
): Promise<{ returnPct: number; openPrice: number; closePrice: number } | null>

export async function getWeeklyPairReturns(
  weekOpenUtc: string,
  assetClass?: AssetClass,
): Promise<Array<...>>

export async function getPairReturnHistory(
  symbol: string,
  periodType: "weekly" | "daily",
): Promise<Array<...>>

export async function getPairDailyBreakdown(
  symbol: string,
  weekOpenUtc: string,
): Promise<Array<...>>
```

Use `getOrSetRuntimeCache()` for reads.

## Job 8: Application Boundaries

Do not change application behavior in this brief, but lock the boundaries now:

- `market_snapshots` remains a cache / view layer
- `performance_snapshots` remains the model-signal layer
- weekly reconstruction will later read `pair_period_returns`
- intraday research will later read `canonical_price_bars`

That separation is the whole point of this work.

## Execution Order

1. Create `src/lib/canonicalInstruments.ts`
2. Create migration `022_canonical_price_layer.sql`
3. Seed `instrument_registry`
4. Create `src/lib/canonicalPriceWindows.ts`
5. Create `scripts/backfill-canonical-price-layer.ts`
6. Backfill daily canonical bars for all 36 instruments
7. Derive weekly and daily `pair_period_returns`
8. Create `scripts/verify-canonical-price-layer.ts`
9. Run verification and write report
10. Create `src/lib/canonicalPriceBars.ts`
11. Create `src/lib/pairReturns.ts`
12. Run `npx tsc --noEmit`
13. Run `npm run build`

## Pragmatic Delivery Rule

If full intraday historical backfill is too expensive for this pass:

- still build the schema for `raw_price_bars` and `canonical_price_bars`
- backfill daily bars and derived weekly returns now
- ensure the backfill script can later be extended to `5m`
- do not collapse back to a returns-only architecture

This is the compromise that preserves future-proofing without stalling the current flagship work.

## DO NOT

- **DO NOT** make `pair_period_returns` the root source of truth
- **DO NOT** leave symbol mapping duplicated across scripts
- **DO NOT** keep session logic buried in strategy-specific code
- **DO NOT** modify `performance_snapshots` data
- **DO NOT** modify weekly reconstruction in this brief
- **DO NOT** modify strategy backtest persistence tables in this brief
- **DO NOT** modify UI files in this brief
- **DO NOT** create another direct-provider-fetch path for a strategy script if canonical bars can serve it

## Existing Code To Reuse

| What | Where |
|------|-------|
| Asset class type | `src/lib/cotMarkets.ts` |
| Pair definitions reference | `src/lib/cotPairs.ts` |
| Oanda instrument mapping | `src/lib/oandaPrices.ts` |
| Oanda override map source | `OANDA_OVERRIDES` in `src/lib/oandaPrices.ts` |
| Oanda candle series fetch | `src/lib/oandaPrices.ts` |
| Bitget candle range fetch | `src/lib/bitget.ts` |
| Bitget candle series fetch | `src/lib/bitget.ts` |
| Current week-window conventions | `src/lib/pricePerformance.ts` |
| Runtime cache | `src/lib/runtimeCache.ts` |
| DB query helper | `src/lib/db.ts` |
| Env loading pattern | `scripts/ingest-tiered-flagship-backtest.ts` |

## Script Bootstrap Requirement

Every new script in this brief must load `.env` and `.env.local` using the same manual env-loading pattern already used by existing repo scripts before importing DB or provider modules.

## Expected Outcome

After this brief is complete, the project should have:

- one canonical historical price substrate
- deterministic daily and weekly pair returns
- reusable query helpers for any page or strategy
- verified price truth independent of model snapshots
- a clean foundation for canonical gated weekly reruns
- a clean foundation for future intraday / Katarakti research

## Immediate Next Task After This

Once this layer is built and verified:

1. rewire weekly reconstruction to consume canonical `pair_period_returns`
2. build canonical gated reruns for all 6 weekly systems
3. choose the true weekly flagship
4. continue intraday research on top of canonical bars rather than ad hoc fetches
