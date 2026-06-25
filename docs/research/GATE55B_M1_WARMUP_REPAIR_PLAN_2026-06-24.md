# Gate 55B M1 Warmup Repair Plan

Date: 2026-06-24

## Plain-English Status

The Strength issue is diagnosed but not repaired yet.

The smallest repair is to fill the missing local M1 FX bars for the 2018 warmup
weeks that the first 2019 Strength signal needs.

This plan does not run the backfill. It freezes the exact command and proof
sequence to run only after approval.

## Decision

Recommended repair target: local SQLite M1 warehouse.

File:

`data/canonical-m1/canonical-m1.sqlite`

Reason:

- It already has `2019-01-07` complete for all 28 FX pairs.
- It needs only the three 2018 warmup weeks.
- It avoids Postgres/Render raw price writes.
- It keeps Gate 55B in research-source repair mode before any app/live claim.

Rejected as the first repair target: Postgres `canonical_price_bars`.

Reason:

- It has the same 2018 warmup gap.
- It also has a broken first 2019 execution week: `11` complete, `1` partial,
  `16` missing.
- It has larger blast radius than local research SQLite.

## Repair Scope

Fill only these local SQLite M1 display weeks:

- `2018-12-17`
- `2018-12-24`
- `2018-12-31`

Do not refetch or rewrite `2019-01-07`; local SQLite already reports it as
`28/28` complete.

## Read-Only Proof Already Captured

Local SQLite command:

```powershell
npx tsx app/scripts/verification/plan-local-m1-backfill.ts --from-year=2018 --to-year=2019 --latest-display-week=2019-01-07 --chunk-weeks=1 --from-chunk=51 --to-chunk=54
```

Local SQLite result:

```text
chunk=51 | 2018-12-17..2018-12-17 | complete=0 | partial=0 | missing=28 | weakRows=28 | weakSymbols=28
chunk=52 | 2018-12-24..2018-12-24 | complete=0 | partial=0 | missing=28 | weakRows=28 | weakSymbols=28
chunk=53 | 2018-12-31..2018-12-31 | complete=0 | partial=0 | missing=28 | weakRows=28 | weakSymbols=28
chunk=54 | 2019-01-07..2019-01-07 | complete=28 | partial=0 | missing=0 | weakRows=0 | weakSymbols=0
```

Postgres command:

```powershell
npx tsx app/scripts/verification/plan-bulk-m1-backfill.ts --from-year=2018 --to-year=2019 --latest-display-week=2019-01-07 --chunk-weeks=1 --from-chunk=51 --to-chunk=54
```

Postgres result:

```text
chunk=51 | 2018-12-17..2018-12-17 | complete=0 | partial=0 | missing=28 | weakRows=28 | weakSymbols=28
chunk=52 | 2018-12-24..2018-12-24 | complete=0 | partial=0 | missing=28 | weakRows=28 | weakSymbols=28
chunk=53 | 2018-12-31..2018-12-31 | complete=0 | partial=0 | missing=28 | weakRows=28 | weakSymbols=28
chunk=54 | 2019-01-07..2019-01-07 | complete=11 | partial=1 | missing=16 | weakRows=17 | weakSymbols=17
```

## Approved Execution Command

Run this only after explicit approval to write local M1 bars:

```powershell
npx tsx app/scripts/verification/plan-local-m1-backfill.ts --from-year=2018 --to-year=2019 --latest-display-week=2019-01-07 --chunk-weeks=1 --from-chunk=51 --to-chunk=53 --execute --concurrency=2 --write
```

Expected behavior:

- Fetch OANDA M1 bars for the 28 FX pairs.
- Write only to the local SQLite warehouse.
- Generate local M1 backfill plan/report files under
  `app/reports/data-verification/local-m1-warehouse`.
- Do not write Postgres.
- Do not derive Strength yet.
- Do not score selected/fade.

## Required Post-Backfill Check

After execution, rerun:

```powershell
npx tsx app/scripts/verification/plan-local-m1-backfill.ts --from-year=2018 --to-year=2019 --latest-display-week=2019-01-07 --chunk-weeks=1 --from-chunk=51 --to-chunk=54
```

Pass condition:

```text
2018-12-17 complete=28 partial=0 missing=0
2018-12-24 complete=28 partial=0 missing=0
2018-12-31 complete=28 partial=0 missing=0
2019-01-07 complete=28 partial=0 missing=0
```

If any row remains partial or missing, Gate 55B stays blocked and Strength
derivation must not proceed.

## Strength Derivation Check After M1 Repair

Only after local M1 coverage passes, run a no-write Strength derivation for the
first 2019 week:

```powershell
npx tsx app/scripts/verification/export-strength-history-context.ts --week=2019-01-07 --derive-weekly-context-snapshots --weekly-context --windows=15m,30m,1h,4h,24h,1w,1m --cadence=15 --context-snapshot-backward-minutes=28800
```

Pass condition:

- Friday-close context should produce `28/28` available pair decisions, or a
  counted no-lookahead fallback reason.
- Market-open context should produce `28/28` available pair decisions, or a
  counted no-lookahead fallback reason.
- The command must not produce default-long seeded rows.
- The command must not use selected/fade outcome scoring.

Only after this passes should a separate approval decide whether to write
Strength history rows.

## Hash Receipts Required Before Testing Reopens

After the raw M1 repair, produce or implement receipts for:

- Local M1 coverage manifest hash.
- Raw M1 bar hash for `2018-12-17` through `2019-01-07`.
- Feature contract hash.
- Derived currency Strength snapshot hash.
- Pair decision hash.

Selected-vs-fade testing does not reopen until those hashes exist and the first
2019 week proves `28/28` decisions or deterministic no-lookahead fallbacks.

## Hard Stops

Stop immediately if:

- OANDA fetch fails for any required pair/window.
- The post-backfill local coverage check is not `28/28` for all four weeks.
- Strength derivation still returns `missing_strength_windows`.
- Any helper tries to write Postgres during the local repair.
- The result depends on future data, provider fallback, default-long fallback,
  pair filtering, or outcome PnL.

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
