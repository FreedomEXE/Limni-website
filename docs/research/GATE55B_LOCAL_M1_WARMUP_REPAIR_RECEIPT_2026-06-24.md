# Gate 55B Local M1 Warmup Repair Receipt

Date: 2026-06-24

## Verdict

Status: `LOCAL_M1_WARMUP_REPAIRED_WITH_MONTHLY_COVERAGE_CAVEAT`

Plain English:

The missing local M1 warmup data was repaired enough to produce first-week
2019 Strength decisions. The broader Strength rebuild is not finished yet.

Gate 55B still must freeze holiday-aware coverage rules, feature hashes, and
the rebuilt feature contract before selected-vs-fade testing reopens.

## What Was Written

Target:

`data/canonical-m1/canonical-m1.sqlite`

Written scope:

- `2018-12-17`
- `2018-12-24`
- `2018-12-31`

Not written:

- Postgres `canonical_price_bars`
- Matrix rows
- Strength history rows
- Selected-vs-fade results
- Any COT+Strength combination

## Execution Command

```powershell
npx tsx app/scripts/verification/plan-local-m1-backfill.ts --from-year=2018 --to-year=2019 --latest-display-week=2019-01-07 --chunk-weeks=1 --from-chunk=51 --to-chunk=53 --execute --concurrency=2 --write
```

Backfill report files:

- `app/reports/data-verification/local-m1-warehouse/local-m1-backfill-plan-2018-2019-20260624-154022.json`
- `app/reports/data-verification/local-m1-warehouse/local-m1-backfill-plan-2018-2019-20260624-154022.md`

Report hashes:

| File | SHA-256 |
|---|---|
| JSON | `E86D20648234F05ABC0EEAAE6D8A59C01B2B9918458CF7B0001231FBCCD0A7AA` |
| Markdown | `67B08BC60E79B5B9D7D3E0F53169035B1B3E973AE220CA376E6FE15152EFE1AD` |

## Backfill Result

Execution fetched and inserted OANDA M1 bars for all 28 FX pairs in the three
missing warmup weeks.

Post-write local coverage:

```text
chunk=51 | 2018-12-17..2018-12-17 | complete=27 | partial=1 | missing=0 | weakRows=1 | weakSymbols=1
chunk=52 | 2018-12-24..2018-12-24 | complete=0 | partial=28 | missing=0 | weakRows=28 | weakSymbols=28
chunk=53 | 2018-12-31..2018-12-31 | complete=0 | partial=28 | missing=0 | weakRows=28 | weakSymbols=28
chunk=54 | 2019-01-07..2019-01-07 | complete=28 | partial=0 | missing=0 | weakRows=0 | weakSymbols=0
```

Important caveat:

The post-write state has no missing pair-weeks, but the generic coverage helper
still marks Christmas and New Year weeks as partial because it expects `7,200`
calendar minutes per FX week. Those holiday weeks have fewer provider bars.

Exact coverage details:

| Week | Expected bars per pair | Complete | Partial | Missing | Min actual | Max actual | Min pct | Max pct |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| `2018-12-17` | 7,200 | 27 | 1 | 0 | 6,397 | 7,196 | 88.85% | 99.94% |
| `2018-12-24` | 7,200 | 0 | 28 | 0 | 4,819 | 5,753 | 66.93% | 79.90% |
| `2018-12-31` | 7,200 | 0 | 28 | 0 | 5,155 | 5,735 | 71.60% | 79.65% |
| `2019-01-07` | 7,200 | 28 | 0 | 0 | 6,483 | 7,196 | 90.04% | 99.94% |

## Raw Data Hashes

Read-only hash window:

- `2018-12-17`
- `2018-12-24`
- `2018-12-31`
- `2019-01-07`

| Hash | Value |
|---|---|
| Coverage manifest rows | `112` |
| Coverage manifest SHA-256 | `E150099E55D83D7B20D3A7471777B55BBEF3EE5EB18A867F5DB1EF793CB00E65` |
| Raw M1 rows | `709,380` |
| Raw M1 SHA-256 | `83C604B68A1A2D6B1228BA09F9AEB87CAD3BE6FC290E90A94658DB093BFC3B36` |

## No-Write Strength Context Check

Command:

```powershell
$env:LIMNI_M1_WAREHOUSE='sqlite'; npx tsx app/scripts/verification/export-strength-history-context.ts --week=2019-01-07 --derive-weekly-context-snapshots --weekly-context --windows=15m,30m,1h,4h,24h,1w,1m --cadence=15 --context-snapshot-backward-minutes=28800
```

Result:

```text
derivedWeeklyContextSnapshots | weeks=1 | snapshotTimes=1934 | rows=108304 | completeRows=43992 | incompleteRows=64312 | coverage=0.00-100.00% | elapsed=5.43s
weeklyContextSummary point=friday_close | available=28/28 | long=13 | short=15 | neutral=0 | missing={}
weeklyContextSummary point=market_open_confirmation | available=28/28 | long=20 | short=8 | neutral=0 | missing={}
```

Interpretation:

The first 2019 week now produces 28/28 rebuilt Strength decisions in the
no-write check.

Caveat:

- Friday-close decisions used `6/7` windows in the printed sample because `1m`
  remained unavailable under the current calendar-minute coverage rule.
- Market-open confirmation used `3/7` windows in the printed sample because
  only short windows are available inside the current forward confirmation
  allowance.

This means the missing-row problem is fixed for the first week, but Gate 55B
still needs a formal holiday/session-aware coverage policy before monthly
Strength is considered institutional-grade.

## Current Gate Status

Gate 55B may continue to source-contract hardening.

Selected-vs-fade testing is still closed until:

1. Coverage policy is frozen for holiday-shortened weeks.
2. Feature contract hash is created.
3. Derived Strength snapshot hash is created.
4. Pair decision hash is created.
5. The rebuilt contract proves full weekly coverage over the intended matrix
   window, not only the first week.

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
