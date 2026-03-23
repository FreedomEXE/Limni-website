/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
# Performance Flagship Refactor Progress — 2026-03-22
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

## Completed

- Verified Playwright browser access with `AUTH_BYPASS=true`.
- Locked local browser verification to `next dev --webpack` because Turbopack was unstable for this workflow.
- Audited the current Performance numbers into:
  - `reports/performance-accuracy-audit.json`
- Removed the misleading gate-report metric override from:
  - `src/app/api/performance/comparison/route.ts`
- Fixed compounded-return handling for Katarakti period metrics in:
  - `src/lib/performance/kataraktiMetrics.ts`
- Normalized the weekly flagship into DB:
  - `tiered_v1_flagship / v1 / multi_asset`
  - `strategy_backtest_runs.id = 11`
- Simplified `/performance` to the audited flagship view:
  - Weekly Hold = `tiered_v1`
  - Intraday = `katarakti_core_crypto`
- Added new forward-test placeholder pages:
  - `/flagship/weekly-hold`
  - `/flagship/intraday`
- Left existing matrix pages unchanged:
  - `/flagship`
  - `/flagship/crypto`

## Current Canonical Flagships

- Weekly Hold:
  - `tiered_v1`
  - audited 8-week return: `+8.95%`
  - max DD: `27.49%`
  - trades: `199`
  - source: `db:strategy_backtest_runs:11`

- Intraday:
  - `katarakti_core_crypto`
  - audited 8-week return: `+102.75%`
  - max DD: `3.64%`
  - trades: `24`
  - source: `db:strategy_backtest_runs:10`

## Still Explicitly Not Promoted

- `universal_v1`
- `universal_v2`
- `universal_v3`

Reason:
- still flagged `SUSPICIOUS` in the audit because the raw-row normalization and the displayed 8-week story do not reconcile cleanly enough to promote them.

## Verification

- TypeScript: passed
  - `npx tsc --noEmit --pretty false -p tsconfig.json`
- Production build: passed
  - `npm run build`
- Screenshots captured in:
  - `screenshots/performance-*-after.png`
  - `screenshots/flagship-weekly-hold-*-after.png`
  - `screenshots/flagship-intraday-*-after.png`

