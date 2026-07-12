# Gate 55B Strength Source Owner Inventory

Date: 2026-06-24

## Verdict

Status: `SOURCE_OWNERS_MAPPED_REBUILD_REQUIRED`

The repo already contains the right architectural direction for rebuilt
Strength: M1-backed, coverage-aware, versioned historical Strength snapshots.
But the current historical materialization and frozen matrix receipts are not
complete enough to reopen selected-vs-fade testing.

Gate 55B should build from the Gate 43 historical Strength path, not from the
legacy live snapshot path alone.

## Scope

This is a read-only source-owner inventory. It does not rebuild Strength,
backfill sources, change matrix rows, optimize thresholds, combine COT with
Strength, or select a final Signal Model.

## Fresh DB Inventory

Read-only table-count probe through the repo DB owner reported:

| Table | Rows |
|---|---:|
| `currency_strength_snapshots` | 70,488 |
| `asset_strength_snapshots` | 70,542 |
| `strength_weekly_snapshots` | 912 |
| `strength_history_snapshots` | 1,022,400 |
| `research_matrix_source_contexts` | 15,876 |

The Gate 55A smoke receipt remains the coverage receipt for the frozen Friday
Strength baseline:

- `currency_strength_snapshots`: min `2026-01-19T00:00:00.000Z`, max
  `2026-06-24T04:00:00.000Z`
- `strength_history_snapshots`: min `2024-12-30T00:15:00.000Z`, max
  `2026-06-12T21:00:00.000Z`
- `strength_weekly_snapshots`: min `2026-01-19T00:00:00.000Z`, max
  `2026-05-24T20:00:00.000Z`

## Source Owners

| Layer | Owner | Current Role | Gate 55B Classification |
|---|---|---|---|
| Live FX Strength ingestion | `app/src/lib/currencyStrength.ts` | Computes 1h/4h/24h OANDA H1 currency strength for 8 FX currencies. | Useful live snapshot owner, not enough for historical institutional contract. |
| Live non-FX Strength ingestion | `app/src/lib/assetStrength.ts` | Computes crypto/commodity/index 1h/4h/24h asset strength. | Out of scope for FX Gate 55 testing, but part of app source-freeze plumbing. |
| Live cron writers | `app/src/app/api/cron/currency-strength/route.ts`, `app/src/app/api/cron/asset-strength/route.ts` | Hourly ingestion endpoints for live snapshot tables. | Current/live only; not a backfill or historical governance path. |
| Weekly Strength lock | `app/src/lib/strength/weeklyStrength.ts` | Reads latest live snapshots at or before week cutoff, optionally locks them into `strength_weekly_snapshots`, and derives pair strength from 1h/4h/24h windows. | Useful app owner, but current table starts in 2026 and lacks full historical lineage. |
| Canonical weekly direction | `app/src/lib/strength/canonicalDirection.ts` | Combines weekly Strength rows with stored/provider prior weekly returns and fallback branches to force a non-neutral pair direction. | Design input only; not promotion-grade because fallback/provider/default-long behavior needs explicit governance. |
| Historical M1 Strength | `app/src/lib/strength/historicalStrength.ts` | Derives coverage-aware FX currency Strength from canonical 1m price bars across 15m/30m/1h/4h/24h/1w/1m windows. | Preferred Gate 55B rebuild base. |
| Historical verifier/exporter | `app/scripts/verification/export-strength-history-context.ts` | Estimates storage, derives/writes/read-backs Strength history, compares legacy, and builds weekly Friday/open context. | Preferred proof harness for Gate 55B source-contract receipts. |
| Local historical warehouse | `app/src/lib/research/localM1Warehouse.ts` | Optional SQLite warehouse for local M1 bars and FX Strength history snapshots. | Useful for seven-year backfill scale, but must be explicitly selected as source storage mode. |
| Research matrix schema | `app/src/lib/research/matrixDataset.ts`, `database/migrations/028_research_matrix_warehouse.sql` | Stores final Friday/open Strength directions, source timestamps, coverage flags, and empty `source_scores`. | Frozen matrix is not enough to audit raw Strength calculations. |
| Matrix exporter/side-selector | `app/scripts/verification/audit-fx-hedged-adr-grid-side-selectors.ts` | Uses `readFxWeeklyStrengthContexts` for Friday and market-open Strength during matrix/source-context export. | Correct consumer path once historical coverage exists. |

## Table Contracts

### `currency_strength_snapshots`

Migration: `database/migrations/017_currency_strength_snapshots.sql`

Current contract:

- `snapshot_time_utc`
- `window`
- `currency`
- `raw_strength`
- `normalized_strength`
- `source`
- `created_at`

Calculation owner: `app/src/lib/currencyStrength.ts`

Formula:

- Fetch OANDA H1 candles for the 28 FX pairs.
- Compute pair return over 1h/4h/24h.
- For each currency, average signed contributions across its seven pairs.
- Normalize all eight currencies to 0-100 within the snapshot.

Gate 55B deficiency:

- No coverage counts.
- No contributing pair list.
- No immutable source hash.
- No derivation version.
- No historical depth before 2026 in the live table.
- H1 snapshots are not the preferred historical raw truth for source-governed
  seven-year testing.

### `asset_strength_snapshots`

Migration: `database/migrations/020_asset_strength_snapshots.sql`

Current contract:

- `snapshot_time_utc`
- `asset_class`
- `window`
- `asset`
- `raw_strength`
- `normalized_strength`
- `source`
- `created_at`

Gate 55B classification:

Non-FX Strength is out of scope for the current FX Strength rebuild, but the
table is part of app source-freeze provenance and should not be confused with
the FX Signal Model source contract.

### `strength_weekly_snapshots`

Owner: `app/src/lib/strength/weeklyStrength.ts`

Current contract:

- `week_open_utc`
- `source_type`
- `window`
- `key`
- `asset_class`
- `raw_strength`
- `normalized_strength`
- `source_snapshot_utc`
- `locked_at_utc`

Gate 55B deficiency:

The table is a current/live weekly lock layer. It does not cover the full
2019-2026 matrix window and should not be used as the primary historical
Strength contract without backfill, provenance hashes, and explicit point-in-
time rules.

### `strength_history_snapshots`

Migration: `database/migrations/027_strength_history_snapshots.sql`

Owner: `app/src/lib/strength/historicalStrength.ts`

Current contract:

- `snapshot_time_utc`
- `asset_class`
- `source_type`
- `window`
- `key`
- `raw_strength`
- `normalized_strength`
- `coverage_expected_bars`
- `coverage_actual_bars`
- `coverage_pct`
- `contributing_pairs`
- `source_timeframe`
- `source_provider`
- `derivation_version`

Current derivation version:

`fx_m1_currency_strength_v1`

Gate 55B classification:

This is the correct base for the rebuilt institutional Strength contract
because it is derived from canonical 1m price bars, stores coverage, separates
windows, and is versioned. It still needs historical backfill and lineage
receipts before testing reopens.

### `research_matrix_source_contexts`

Migration: `database/migrations/028_research_matrix_warehouse.sql`

Current Strength fields:

- `friday_strength_direction`
- `market_open_strength_direction`
- `source_timestamps`
- `source_scores`
- `coverage`
- `flags`

Gate 55B deficiency:

The frozen matrix stores final directions and timestamps, but not the raw
Strength values, pair deltas, z-scores, ranks, percentiles, trend fields, or
bucket inputs required to audit a rebuilt Strength algorithm. Gate 55A also
confirmed `source_scores` was empty for the Friday Strength rows used in the
legacy baseline.

## Formula And Fallback Findings

### Legacy live formula

The live FX formula is simple and defensible as a current snapshot:

`currency raw strength = average signed return across seven FX pairs`

Then each snapshot is normalized 0-100 across the eight currencies.

That is not enough for Gate 55B by itself because it lacks historical coverage,
source hashes, coverage metadata, and richer feature fields.

### Historical formula

The M1-derived historical path computes currency Strength from canonical
1-minute bars. It supports:

- `15m`
- `30m`
- `1h`
- `4h`
- `24h`
- `1w`
- `1m`

It stores coverage and derivation version. This should be the base for
daily/weekly/monthly horizons.

### Current direction fallback caveat

`canonicalDirection.ts` already includes useful ideas:

- 1h/4h/24h snapshot vote.
- prior 1w return.
- prior 1m return.
- fallback to provider fill when stored prior weeks are missing.
- fallback branches when hybrid score cannot decide.

But it is not acceptable unchanged as the rebuilt source contract because
provider fallback, fallback order, and `fallback_long_default` must be
explicitly governed or removed before institutional testing.

### Current M1 weekly context caveat

`historicalStrength.ts` currently resolves a composite direction from available
windows. If directional votes and summed spread tie with at least one available
window, the current deterministic fallback returns `LONG`.

Gate 55B must decide a formal tie policy before scoring. A default-long tie
should not be silently inherited into the new source contract.

## Source-Freeze Findings

The app source-freeze route lists Strength inputs as:

- `currency_strength_snapshots`
- `asset_strength_snapshots`
- prior weekly returns

Snapshot provenance prefers `strength_weekly_snapshots` when locked, otherwise
falls back to live Strength snapshots.

Gate 55B implication:

Live/source-freeze app provenance and historical research provenance are not
yet the same contract. The rebuilt Strength contract needs one explicit
point-in-time rule for research and later live parity.

## Required Rebuild Direction

Gate 55B should treat `fx_m1_currency_strength_v1` as the likely base
derivation, but not automatically promote it. The next contract decision is
whether to freeze it as-is or define `fx_m1_currency_strength_v2`.

Minimum v2 contract questions:

1. Which raw bars are authoritative: Postgres `canonical_price_bars`, local
   SQLite M1 warehouse, or both with a declared precedence rule?
2. Which windows are frozen for first rebuilt testing: `1h`, `4h`, `24h`,
   `1w`, `1m`, or all seven historical windows?
3. What cadence is accepted for historical storage: 15m default, 5m, or
   decision-point-only snapshots?
4. What is the minimum coverage threshold per pair/window?
5. What is the formal missing policy when zero windows are available?
6. What is the formal tie policy when windows are available but net direction
   is tied?
7. Are provider fallbacks forbidden for historical research, or allowed only as
   separately hashed fallback rows?
8. Does the first 2019 trade week require a 2018 warmup backfill beginning at
   least one month before `2019-01-07`?
9. Which raw and derived feature fields must be persisted before scoring?
10. Which receipts prove no-lookahead and weekly 28-pair completeness?

## Recommended Next Smoke

Smallest Gate 55B smoke command is design/source-only:

```powershell
npm run verification:export-strength-history-context -- --week=2019-01-07 --estimate-only --windows=1h,4h,24h,1w,1m
```

Purpose:

- No source mutation.
- No scoring.
- Confirms the storage scale for the likely rebuilt horizons.
- Keeps Gate 55B in source-contract mode before approving any backfill.

Result:

```text
Gate 43 Strength history context | from=2019-01-06T22:00:00.000Z | to=2019-01-11T22:00:00.000Z | cadence=15m | windows=1h,4h,24h,1w,1m | write=false | readBack=false | readExistingOnly=false | weeklyContext=false | deriveWeeklyContextSnapshots=false
estimate cadence=1m  | snapshots=2620800 | currencyRows=104832000 | pairLookupCells=366912000
estimate cadence=5m  | snapshots=524160  | currencyRows=20966400  | pairLookupCells=73382400
estimate cadence=15m | snapshots=174720  | currencyRows=6988800   | pairLookupCells=24460800
```

After that, the next receipt should be a no-write backfill feasibility plan for
the 2018 warmup through the first 2019 trade week, including required M1 bar
coverage and source hash strategy.
