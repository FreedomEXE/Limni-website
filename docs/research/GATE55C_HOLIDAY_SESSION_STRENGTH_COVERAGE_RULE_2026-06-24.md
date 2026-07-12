# Gate 55C Holiday / Session-Aware Strength Coverage Rule

Date: 2026-06-24

## Verdict

Status: `SUPERSEDED_BY_GATE55E_100_PERCENT_SOURCE_STANDARD`

Gate 55B's local warmup blocker was repaired, but Gate 55C is not final
governance.

Freedom challenged the inherited `90%` coverage threshold and the old
holiday/session denominator as too weak for institutional-grade Strength source
work. Gate 55E supersedes this receipt with a canonical Postgres bundle rule:
an FX minute is active when any canonical OANDA provider pair has a real
`provider_minute` row inside the New York 5pm FX session window, and all 28 FX
pairs must have canonical rows for every active minute.

This receipt is retained as an audit/proof artifact, not as active coverage
governance. The active bundle receipt is:

`docs/research/GATE55E_FROZEN_CANONICAL_PRICE_BUNDLE_V1_RECEIPT_2026-06-24.md`

Selected-vs-fade testing remains closed until Strength source context is
rebuilt/regenerated from the Gate 55E bundle.

## Scope

Gate 55C is an internal Gate 55 source-contract receipt. It defines how
Strength coverage should be counted during:

- normal weeks
- holiday-shortened weeks
- early closes
- full market closures
- Christmas / New Year year-end weeks

It does not score Strength performance.

## Naming Clarification

The repo currently uses two similar names:

| Name | Meaning |
|---|---|
| `M1` / source timeframe `1m` | One-minute market bars. This is raw price data. |
| Strength horizon `1m` | Monthly Strength lookback, defined as `28,800` minutes in `historicalStrength.ts`. |

To avoid ambiguity in Gate 55 receipts:

- Use `M1 bars` for one-minute source bars.
- Use `monthly Strength` for the Strength horizon currently named `1m`.

## Current Strength Horizons

Current historical FX Strength windows:

| Horizon | Minutes | Gate 55C label |
|---|---:|---|
| `15m` | 15 | short |
| `30m` | 30 | short |
| `1h` | 60 | short |
| `4h` | 240 | intraday |
| `24h` | 1,440 | daily |
| `1w` | 7,200 | weekly |
| `1m` | 28,800 | monthly |

Source timeframe for all horizons:

`M1 one-minute bars`

## Reviewed Coverage Rule

### 1. Expected Denominator

For historical FX Strength, expected bars must be based on observed tradable
session minutes, not calendar minutes.

For a given interval:

1. Read the 28-pair FX universe from the selected source store.
2. Group bars by minute timestamp.
3. Count a timestamp as an expected tradable session minute when at least `14`
   of the 28 FX pairs have a provider bar at that timestamp.
4. The resulting count is the expected session denominator.

Why quorum `14`:

- It is half the FX universe.
- It excludes isolated bad ticks or one-pair artifacts.
- It does not require all 28 pairs to be present before recognizing that the
  market was open.
- It uses only bars at or before the evaluated timestamp, so it does not create
  lookahead.

### 2. Minimum Observed Pair Coverage

The repo's current historical Strength code uses the existing `90%` threshold.

That is not accepted as final Gate 55 governance after Freedom's review.

Pair-window coverage:

```text
pair coverage pct = pair observed M1 bars / expected tradable session bars
```

Current-code rule:

- `>= 90%`: window is coverage-pass and may be used.
- `< 90%`: window is unavailable with reason
  `insufficient_session_coverage`.
- `0 expected session bars`: full closure; window is unavailable with reason
  `market_closed_no_session_denominator`.

### 3. Holiday / Closure Treatment

Holiday closures and early closes are excluded from the denominator when the FX
universe does not show tradable session bars.

Gate 55C forbids:

- filling closed-market minutes with synthetic bars
- carrying future bars backward
- treating missing calendar minutes during a full closure as source gaps

Gate 55E supersedes the earlier quorum interpretation: an FX minute counts as
tradable when at least one canonical provider FX pair has a real provider M1
bar inside the approved session window. Every FX pair must then have a
canonical row for that active minute to pass. Missing no-tick pair rows may be
repaired only as explicit `derived_no_tick_forward_fill_v1` rows with no
future bar access; they must not be mixed silently with provider rows.
- changing coverage thresholds based on performance

### 4. Missing-Data Behavior

At the raw window level:

| Case | Behavior |
|---|---|
| Pair-window coverage pass | Use the window. |
| Pair-window coverage fail | Mark the window unavailable; do not synthesize. |
| Full market closure | Mark unavailable for that interval. |
| Missing source rows during open session | Mark unavailable. |
| Tie in directional calculation | Do not default-long; defer to the formal tie policy. |

At the weekly pair-decision level:

- Carry-forward is not allowed inside raw window coverage.
- Carry-forward may only be used by a later frozen pair-decision policy.
- Any carry-forward must be prior same-pair only, no-lookahead, and counted
  separately.

Gate 55C freezes coverage, not final Strength bucket selection.

## Input Database Identity

Source store:

`data/canonical-m1/canonical-m1.sqlite`

File identity after the Gate 55B local warmup repair:

| Field | Value |
|---|---|
| Size | `14,398,754,816` bytes |
| Last write time | `2026-06-24 11:40:20 AM` |
| SQLite file SHA-256 | `14F978253D6AAEC3B923A7A8AEADF4CF044FF612B738918EDB7054CA38728008` |

Gate 55B repair changed rows:

| Chunk | Week | Bars upserted | Symbols |
|---:|---|---:|---:|
| 51 | `2018-12-17` | 198,102 | 28 |
| 52 | `2018-12-24` | 156,123 | 28 |
| 53 | `2018-12-31` | 157,281 | 28 |
| Total |  | 511,506 | 84 execution events |

Proof-window hashes from the repaired local warehouse:

| Hash | Value |
|---|---|
| Coverage manifest rows | `112` |
| Coverage manifest SHA-256 | `E150099E55D83D7B20D3A7471777B55BBEF3EE5EB18A867F5DB1EF793CB00E65` |
| Raw M1 rows | `709,380` |
| Raw M1 SHA-256 | `83C604B68A1A2D6B1228BA09F9AEB87CAD3BE6FC290E90A94658DB093BFC3B36` |

## Boundary-Week Proof

### Calendar-Minute Coverage

This is the old denominator and should not govern holiday weeks.

| Week | Calendar expected | Complete | Partial | Missing | Min pct | Max pct |
|---|---:|---:|---:|---:|---:|---:|
| `2018-12-17` | 7,200 | 27 | 1 | 0 | 88.85% | 99.94% |
| `2018-12-24` | 7,200 | 0 | 28 | 0 | 66.93% | 79.90% |
| `2018-12-31` | 7,200 | 0 | 28 | 0 | 71.60% | 79.65% |
| `2019-01-07` | 7,200 | 28 | 0 | 0 | 90.04% | 99.94% |

### Session-Aware Denominators

Session expected bars use the `14/28` pair quorum rule.

| Week | Calendar expected | Session expected | Pass | Fail | Min pct | Max pct | Fail sample |
|---|---:|---:|---:|---:|---:|---:|---|
| `2018-12-17` | 7,200 | 7,193 | 27 | 1 | 88.93% | 100.04% | `USDCHF` |
| `2018-12-24` | 7,200 | 5,746 | 26 | 2 | 83.87% | 100.12% | `AUDUSD`, `USDCHF` |
| `2018-12-31` | 7,200 | 5,723 | 28 | 0 | 90.08% | 100.21% | none |
| `2019-01-07` | 7,200 | 7,195 | 28 | 0 | 90.10% | 100.01% | none |

Interpretation:

- Christmas and New Year closures no longer cause a whole week to fail.
- `2018-12-31` becomes clean under session-aware coverage.
- `2018-12-24` still has real pair-level gaps in `AUDUSD` and `USDCHF`; those
  windows must remain unavailable, not filled.
- `2018-12-17` still has a real `USDCHF` pair-level gap.

## Monthly Strength Lookback Proof

The monthly Strength horizon is the current `1m` window in code.

At the first 2019 Friday freeze:

| Lookback | From | To | Calendar expected | Session expected | Pass | Fail | Min pct | Max pct | Fail sample |
|---|---|---|---:|---:|---:|---:|---:|---:|---|
| Friday monthly | `2018-12-15T22:00:00.000Z` | `2019-01-04T22:00:00.000Z` | 28,800 | 18,662 | 26 | 2 | 88.39% | 100.12% | `AUDUSD`, `USDCHF` |
| Market-open monthly | `2018-12-17T22:00:00.000Z` | `2019-01-06T22:00:00.000Z` | 28,800 | 17,223 | 26 | 2 | 88.63% | 100.12% | `AUDUSD`, `USDCHF` |
| Friday weekly | `2018-12-30T22:00:00.000Z` | `2019-01-04T22:00:00.000Z` | 7,200 | 5,723 | 28 | 0 | 90.08% | 100.21% | none |
| Market-open weekly | `2019-01-01T22:00:00.000Z` | `2019-01-06T22:00:00.000Z` | 7,200 | 4,288 | 28 | 0 | 92.09% | 100.16% | none |

Interpretation:

Session-aware coverage fixes the holiday-denominator problem, but it does not
force the monthly horizon to pass. `AUDUSD` and `USDCHF` remain below the
existing 90% threshold in the first monthly lookback.

Therefore:

```text
Monthly Strength remains unavailable for the first 2019 week under the frozen
90% session-aware rule.
```

That is acceptable as a source-contract result. It must be counted, not hidden.

## 99 Percent Source-Quality Review

At a `99%` pair-window coverage target, the repaired local warehouse does not
pass the boundary proof.

| Window | Session expected | 90% pass/fail | 95% pass/fail | 99% pass/fail |
|---|---:|---:|---:|---:|
| `2018-12-17` week | 7,193 | 27 / 1 | 26 / 2 | 17 / 11 |
| `2018-12-24` week | 5,746 | 26 / 2 | 23 / 5 | 9 / 19 |
| `2018-12-31` week | 5,723 | 28 / 0 | 26 / 2 | 13 / 15 |
| `2019-01-07` week | 7,195 | 28 / 0 | 26 / 2 | 15 / 13 |
| Friday monthly lookback | 18,662 | 26 / 2 | 26 / 2 | 12 / 16 |
| Market-open monthly lookback | 17,223 | 26 / 2 | 26 / 2 | 14 / 14 |

Interpretation:

- The Gate 55B repair filled the zero-row warmup gaps.
- It did not make the local warehouse `99%` complete at pair-minute level.
- Some gaps are true pair-level missing bars during observed tradable session
  minutes, not merely holiday closures.
- AUDUSD and USDCHF are the recurring worst offenders near the first 2019
  boundary.

Example real pair-level gaps:

| Window | Pair | Session minutes | Missing pair bars | Coverage | Largest observed missing ranges |
|---|---|---:|---:|---:|---|
| `2018-12-24` week | `AUDUSD` | 5,746 | 928 | 83.85% | `2018-12-26T08:10Z..08:27Z` (18m), `2018-12-26T09:07Z..09:18Z` (12m) |
| `2018-12-24` week | `USDCHF` | 5,746 | 804 | 86.01% | `2018-12-24T19:13Z..19:49Z` (37m), `2018-12-24T19:51Z..20:02Z` (12m) |
| Friday monthly lookback | `AUDUSD` | 18,662 | 2,095 | 88.77% | multiple AUDUSD gaps around `2018-12-26` and `2019-01-03` |
| Friday monthly lookback | `USDCHF` | 18,662 | 2,171 | 88.37% | multiple USDCHF gaps around `2018-12-24`, `2018-12-30`, and `2018-12-21` |

These gaps may be OANDA omitted-candle behavior, instrument liquidity behavior,
or source incompleteness. Gate 55 cannot treat them as solved until a source
audit proves which case applies and either repairs them or explicitly marks the
affected windows unavailable.

## No-Lookahead Statement

The Gate 55C denominator uses only bars inside the interval being evaluated.
For the Friday freeze, that interval ends at `2019-01-04T22:00:00.000Z`.
For market-open confirmation, the interval ends at the confirmation lookup
time.

No future bars are used to decide whether a historical minute was tradable.

## No Synthetic Data Statement

Gate 55C does not generate synthetic bars, copy bars across closed-market
periods, or fill one pair from another pair.

Closed-market minutes are excluded from the denominator only when the observed
FX universe does not show tradable session activity.

## Commands Run

Local coverage probe:

```powershell
npx tsx app/scripts/verification/plan-local-m1-backfill.ts --from-year=2018 --to-year=2019 --latest-display-week=2019-01-07 --chunk-weeks=1 --from-chunk=51 --to-chunk=54
```

No-write Strength context check:

```powershell
$env:LIMNI_M1_WAREHOUSE='sqlite'; npx tsx app/scripts/verification/export-strength-history-context.ts --week=2019-01-07 --derive-weekly-context-snapshots --weekly-context --windows=15m,30m,1h,4h,24h,1w,1m --cadence=15 --context-snapshot-backward-minutes=28800
```

Session-aware denominator probes:

```powershell
# Read-only better-sqlite3 probes against data/canonical-m1/canonical-m1.sqlite
# Count distinct bar_open_utc minutes where at least 14 of 28 FX pairs have bars.
```

SQLite file hash:

```powershell
Get-FileHash -Algorithm SHA256 data\canonical-m1\canonical-m1.sqlite
```

## Verification Status

```text
git diff --check
PASS

npx tsc --noEmit --project app/tsconfig.json --pretty false
PASS
```

## Superseded Gate Status

Gate 55C does not authorize selected-vs-fade testing by itself.

Gate 55E later completed the canonical Postgres FX M1 bundle repair with:

```text
price_bundle_id: gate55e_fx_m1_oanda_ny5_v1_20181217_20260607_8E37E953
final status: PASS_CANONICAL_FX_M1_100_PERCENT
complete pair-weeks: 10,948 / 10,948
missing active pair-minute rows: 0
```

Gate 55 still needs:

1. Strength source context rebuilt/regenerated from the Gate 55E canonical
   bundle.
2. Feature contract hash.
3. Derived Strength snapshot hash.
4. Pair decision hash.
5. Full-window source coverage audit across all intended matrix weeks.
6. Then Friday Strength selected-vs-fade retest.

## Still Forbidden

- No COT+Strength combination.
- No selected-vs-fade retest yet.
- No horizon selection by PnL.
- No threshold optimization.
- No pair filtering.
- No regime overlay.
- No BPR/RRP retest.
- No PPP/NEER/REER work.
- No execution optimization.
- No risk overlay.
- No MT5/live/bot work.
- No production/live claim.
- No final Signal Model selection.
Gate 55C review correction:

- The next governed source-quality target is `99%` pair-window coverage.
- Existing `90%` behavior may be used only as a legacy/current-code diagnostic,
  not as the final institutional Strength source contract.
- Any threshold lower than `99%` requires a separate explicit source-quality
  waiver before performance testing.
