# Gate 54 Matrix Source Coverage Smoke

Date: 2026-06-23

Status: `PASS_MECHANICAL_NO_WRITE_BLOCKED_BY_COVERAGE`

## Objective

Run the smallest no-write Gate 54 source coverage smoke against the legacy
matrix/source path.

This is not a strategy test and not a system-selection receipt.

## Full-Window Attempt

Command:

```powershell
npm run verification:export-research-matrix-dataset-contract -- --coverage-manifest --from-year=2019 --to-year=2026 --latest-display-week=2026-06-08
```

Result:

```text
timed_out_after_ms: 184045
stdout: none before timeout
write_mode: false
process_cleanup: stopped only the npm/tsx coverage process tree
```

Read:

The existing full-window manifest command is too slow for the first Gate 54
smoke loop. That is an engineering constraint, not a source-readiness pass or
fail.

## Narrow 2026 No-Write Smoke

Command:

```powershell
npm run verification:export-research-matrix-dataset-contract -- --coverage-manifest --from-year=2026 --to-year=2026 --latest-display-week=2026-06-08
```

Output:

```text
year=2026 | includedWeeks=23 | validReceipts=0/23 | m1=643/672 complete | strengthFriday=23/23 | strengthOpen=23/23 | cot=23/23 | ready=0/23 | blockers=missing_or_invalid_receipt:23;prior_freeze_m1_not_complete:1;m1_week_not_complete:1
```

## Interpretation

Mechanical smoke result:

```text
coverage command can run in no-write mode
COT coverage present for narrowed current-2026 window
Friday Strength coverage present for narrowed current-2026 window
market-open Strength coverage present for narrowed current-2026 window
readiness remains blocked
```

Fail-closed blockers:

```text
missing_or_invalid_receipt: 23
prior_freeze_m1_not_complete: 1
m1_week_not_complete: 1
```

This is the correct Gate 54 posture. The command did not silently promote the
legacy matrix path as ready when receipts and M1 coverage still have blockers.

## Blocker Classification

Receipt blocker:

```text
receiptDir: app/reports/data-verification/fx-hedged-adr-grid
state: directory_absent
impact: validReceipts=0/23
```

M1 blocker:

```text
weeksChecked: 24
pairs: 28
weakRows: 29
priorFreezeWeek: 2025-12-29T00:00:00.000Z
priorFreezeWeakRows: 28/28 partial
includedWeekWeakRows: 1
includedWeakRow: CADCHF, 2026-02-16T00:00:00.000Z, partial, coveragePct=88.53, expectedBars=7200, actualBars=6374
```

Read:

The current-window blocker is now specific. It is not a broad current-2026 COT
or Strength failure. It is absent local ADR grid receipts plus one included
M1 coverage row and a partial prior-freeze week.

## Decision

```text
Gate 54 source coverage smoke: ACCEPT
Legacy baseline source readiness: NOT YET
System selection: NOT AUTHORIZED
Optimization: PAUSED
Next authorized work: isolate missing/invalid receipt classification and the one M1 weak week
```

## Next Narrow Proof

Do not rerun the full seven-year command until the current-window blockers are
classified.

Next read-only proof should answer:

```text
Which 2026 weeks have missing/invalid fx-hedged ADR grid receipts?
Which week/pair is responsible for m1_week_not_complete?
Is the receipt blocker caused by absent ignored app/reports files, invalid schema,
or a path/config mismatch?
```
