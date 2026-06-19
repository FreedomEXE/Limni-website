# Gate 43 Strength History And Continuous Context

Date: 2026-06-18

Status: active implementation slice. This is a source/context reconstruction
gate, not a strategy-sweep gate.

## Decision

Reconstruct Strength history as a reusable historical and continuous context
layer. Do not patch only Friday Strength for Gate 41.

The raw truth stays `canonical_price_bars` at `1m`. Derived Strength snapshots
are versioned and coverage-aware so the same layer can serve:

- Friday frozen Strength for weekly COT grids;
- Sunday/open confirmation;
- daily recalculation systems;
- intratrade or trade-management Strength checks;
- compact source masks for later seven-year backtests.

## Current Ownership

- Current live writers:
  - `app/src/lib/currencyStrength.ts`
  - `app/src/lib/assetStrength.ts`
- Current weekly/source readers:
  - `app/src/lib/strength/weeklyStrength.ts`
  - `app/src/lib/strength/canonicalDirection.ts`
- Source-freeze ledger:
  - `app/src/lib/sourceFreeze/sourceLedger.ts`
- Canonical execution bars:
  - `app/src/lib/canonicalHourlyBars.ts`
  - `app/src/lib/performance/pathBarLoader.ts`

Gate 43 adds a derived history owner under the existing Strength folder:

- `app/src/lib/strength/historicalStrength.ts`
- `app/scripts/verification/export-strength-history-context.ts`
- `database/migrations/027_strength_history_snapshots.sql`

## Snapshot Contract

Table: `strength_history_snapshots`

Each row is one derived Strength value:

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

```txt
fx_m1_currency_strength_v1
```

## Storage Estimate

For FX only, storing currency snapshots for `8` currencies across `7` windows:

| Cadence | Approx snapshots, 7y | Currency rows | Pair lookup cells if materialized |
| --- | ---: | ---: | ---: |
| 1m | 2,620,800 | 146,764,800 | 513,676,800 |
| 5m | 524,160 | 29,352,960 | 102,735,360 |
| 15m | 174,720 | 9,784,320 | 34,245,120 |

Read: do not materialize pair spreads as rows in the first design. Store
currency snapshots, then compute pair spreads from a compact in-memory index.
For the first broad historical backfill, `15m` is the pragmatic default unless
continuous trade-management proves that `5m` materially changes decisions.

## First Slice

The first implemented slice is FX only and M1-backed:

```powershell
npx tsx app/scripts/verification/export-strength-history-context.ts `
  --week=2026-06-08 `
  --cadence=15 `
  --windows=1h,4h,24h `
  --write `
  --read-back `
  --compare-legacy
```

Expected proof:

- rows derive from `canonical_price_bars` with `timeframe='1m'`;
- lookup works at Sunday/open and Friday/week-close time for the materialized
  slice;
- current-2026 M1-derived `1h`/`4h`/`24h` directions match the legacy cutoff
  resolver closely enough to preserve known source rows;
- clean-2025 remains a coverage blocker until historical M1 bars and Strength
  history are materialized for that period.

## Progress: First M1-Derived Slice

Implemented:

- `database/migrations/027_strength_history_snapshots.sql`
- `app/src/lib/strength/historicalStrength.ts`
- `app/scripts/verification/export-strength-history-context.ts`

The first persisted slice covers two current-2026 FX M1 weeks:

```txt
from: 2026-05-31T21:00:00.000Z
to:   2026-06-12T21:00:00.000Z
cadence: 15m
windows: 1h, 4h, 24h
```

DB proof after write/read-back:

```txt
strength_history_snapshots rows: 27,648
complete rows:                 21,164
min snapshot:                  2026-05-31 21:15:00+00
max snapshot:                  2026-06-12 21:00:00+00
derivation_version:            fx_m1_currency_strength_v1
```

Verification command:

```powershell
npx tsx app/scripts/verification/export-strength-history-context.ts `
  --from=2026-05-31T21:00:00.000Z `
  --to=2026-06-12T21:00:00.000Z `
  --cadence=15 `
  --windows=1h,4h,24h `
  --lookup-times=2026-06-05T21:00:00.000Z,2026-06-07T21:00:00.000Z,2026-06-12T21:00:00.000Z `
  --write `
  --read-back `
  --compare-legacy
```

Proof results:

- Prior-Friday cutoff `2026-06-05T21:00:00Z`: `84/84` legacy direction matches,
  average absolute spread delta `0.0022`.
- Friday/week-close cutoff `2026-06-12T21:00:00Z`: `84/84` legacy direction
  matches, average absolute spread delta `0.5367`.
- Sunday/open `2026-06-07T21:00:00Z`: the new M1 layer resolves to the latest
  real prior-Friday source state. The legacy hourly snapshot table has weekend
  neutral `50/50` rows at Sunday, so direct legacy cutoff comparison only
  matched `6/84`. Treat this as a source-model conflict to resolve before
  wiring Sunday/open decisions to the new layer.

Additional M1 materialization performed for the adjacent week needed by
Sunday/open proof:

```txt
week: 2026-05-31T23:00:00.000Z
fetched/upserted M1 bars: 199,184
coverage: 28/28 complete, lowest 93.26%
```

Current read: this proves the historical Strength context layer and fast lookup
shape. It does not yet clear clean-2025. Clean-2025 still needs historical M1
coverage plus source-context wiring before Gate 41 can score exact Gate 40
candidate rows.

## Progress: Weekly Decision Context

Added an explicit weekly Strength decision context on top of the derived M1
snapshot table:

- `friday_close`: latest complete Strength snapshot at or before the pre-week
  Friday 17:00 New York source freeze.
- `market_open_confirmation`: first complete Strength snapshot at or after the
  FX market-truth open from `getCanonicalWeekWindow(..., "fx").openUtc`,
  bounded by `--market-open-forward-minutes` so missing market-open data does
  not silently fall back to Friday. This is intentionally separate from the
  later execution window.

The verifier can now read existing `strength_history_snapshots` without
re-deriving M1:

```powershell
npx tsx app/scripts/verification/export-strength-history-context.ts `
  --from=2026-05-31T21:00:00.000Z `
  --to=2026-06-12T21:00:00.000Z `
  --cadence=15 `
  --windows=1h,4h,24h `
  --read-existing-only `
  --weekly-context `
  --context-weeks=2026-06-08T23:00:00.000Z
```

Cached-source proof for the current two-week slice:

```txt
readExisting rows=27648 elapsed=3.03s
weeklyContext week=2026-06-07T23:00:00.000Z
friday_close available=28/28, long=12, short=16, neutral=0
market_open_confirmation available=28/28, long=19, short=9, neutral=0
```

The corrected current-week proof resolves market-open confirmation rows to
`2026-06-07T22:15:00Z`, about 75 minutes after the actual FX market open and
well before the later execution window. Read: this is the runtime direction we
want. Historical derivation/backfill is allowed to be slower as a one-time
source build, but strategy sweeps should read prebuilt Strength contexts and
source masks. The next integration step is to feed this weekly context into the
side-selector source path instead of calling legacy Friday/open Strength
resolvers per receipt week. Coverage and directional resolution are separate:
a pair with at least one covered Strength window should resolve to LONG or
SHORT through the deterministic composite resolver; only zero covered windows
is source-blocked.

## Progress: Current-2026 Coverage Backfill

Gate 44's first `23`-week current-2026 warehouse proof showed that the
warehouse mechanics were fast, but Gate 43 M1-backed Strength only existed for
the latest current weeks. That was not source-complete enough to trust
Strength-dependent rankings.

Current-2026 M1 materialization was filled for the displayed weeks
`2026-01-05` through `2026-06-08`, plus the prior `2025-12-29` week needed for
the first Friday freeze. Stored local FX M1 coverage now spans the current
2026 proof window at `28/28` symbols, with about `4.75M` canonical 1m bars
including the prior-week fill.

The full current-2026 Strength derivation initially exposed a scaling bug:
`Math.min(...coverageValues)` overflowed the call stack on hundreds of
thousands of rows. The derivation summary now computes coverage min/max in a
streaming pass. This is a reusable seven-year-readiness fix, not a one-off
receipt patch.

Current-2026 Strength history proof:

```txt
from: 2025-12-29T00:00:00.000Z
to:   2026-06-12T21:00:00.000Z
cadence: 15m
windows: 1h, 4h, 24h
derived snapshots: 15,924
rows written: 382,176
complete rows: 250,489
derive time: 73.6s
write time: 98.8s
```

Weekly context proof for all `23` current-2026 displayed weeks:

```txt
friday_close: 28/28 directional every week
market_open_confirmation: 28/28 directional every week
first friday/open: 2026-01-02T22:00:00Z / 2026-01-04T23:00:00Z
last friday/open:  2026-06-05T21:00:00Z / 2026-06-07T22:15:00Z
```

Read: current-2026 now has reusable M1-backed Strength context for the
warehouse proof. Clean-2025 and older separated years still need their own M1
and Strength history materialization before they can be scored as
source-complete.

## Frozen

- No release canon changes.
- No Pine verifier cleanup.
- No broad seven-year sweeps.
- No ADR Grid parameter tuning.
- Do not call all-zero 2025 a strategy result.
