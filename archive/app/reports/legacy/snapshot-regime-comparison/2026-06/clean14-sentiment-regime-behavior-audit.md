# Clean14 Sentiment Regime Behavior Audit

Generated: 2026-06-06T04:45:52.777Z

## Guardrails

- Read-only audit.
- No canon regeneration.
- No release decision.
- No missing sentiment rows filled.

## Resolver Behavior

- Sunday/Monday path mirrors `resolveSentimentDirections()`: current/prior bundles are loaded through week-start aggregate selection.
- That legacy week-start selection chooses the latest aggregate at or before week open; if none exists before week open, it can use the first aggregate after week open within the week.
- Friday path mirrors `buildFrozenSourceLedgerWeek()`: current/prior bundles are selected by latest aggregate at or before the Friday 17:00 America/New_York cutoff.
- Friday raw-provider evidence is checked only inside the 120 minutes before the Friday cutoff.

## Verdict

- Total symbol/week rows: 504.
- Manual SQL reconstruction direction changes: 1.
- Actual app resolver direction changes: 1.
- Rows where Friday used the same aggregate timestamp as Sunday/Monday: 0.
- Rows with Friday raw evidence inside 120 minutes: 0.
- Rows where Friday used aggregate-derived evidence without raw Friday evidence: 504.
- Rows where DB legacy timestamp was before week open but app-reported timestamp was after week open: 0.
- Rows where DB Friday timestamp was before cutoff but app-reported timestamp was after cutoff: 0.

Interpretation: corrected UTC-literal timestamp handling exposes the true current comparison: Friday and Sunday/Monday Sentiment differ on one clean14 symbol/week row, and every Friday row remains aggregate-derived without raw provider evidence in the cutoff window.

| Behavior | Count |
| --- | ---: |
| different_aggregate_no_raw_friday_evidence | 504 |

## Weekly Summary

| Week | Friday Cutoff | Manual Direction Changes | Actual Direction Changes | Legacy Boundary Shifts | Friday Boundary Shifts | Friday Raw 120m Symbols | Friday Aggregate Symbols |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 2026-02-23 | 2026-02-20T22:00:00.000Z | 1 | 1 | 0/36 | 0/36 | 0/36 | 36/36 |
| 2026-03-02 | 2026-02-27T22:00:00.000Z | 0 | 0 | 0/36 | 0/36 | 0/36 | 36/36 |
| 2026-03-08 | 2026-03-06T22:00:00.000Z | 0 | 0 | 0/36 | 0/36 | 0/36 | 36/36 |
| 2026-03-15 | 2026-03-13T21:00:00.000Z | 0 | 0 | 0/36 | 0/36 | 0/36 | 36/36 |
| 2026-03-22 | 2026-03-20T21:00:00.000Z | 0 | 0 | 0/36 | 0/36 | 0/36 | 36/36 |
| 2026-03-29 | 2026-03-27T21:00:00.000Z | 0 | 0 | 0/36 | 0/36 | 0/36 | 36/36 |
| 2026-04-05 | 2026-04-03T21:00:00.000Z | 0 | 0 | 0/36 | 0/36 | 0/36 | 36/36 |
| 2026-04-12 | 2026-04-10T21:00:00.000Z | 0 | 0 | 0/36 | 0/36 | 0/36 | 36/36 |
| 2026-04-19 | 2026-04-17T21:00:00.000Z | 0 | 0 | 0/36 | 0/36 | 0/36 | 36/36 |
| 2026-04-26 | 2026-04-24T21:00:00.000Z | 0 | 0 | 0/36 | 0/36 | 0/36 | 36/36 |
| 2026-05-03 | 2026-05-01T21:00:00.000Z | 0 | 0 | 0/36 | 0/36 | 0/36 | 36/36 |
| 2026-05-10 | 2026-05-08T21:00:00.000Z | 0 | 0 | 0/36 | 0/36 | 0/36 | 36/36 |
| 2026-05-17 | 2026-05-15T21:00:00.000Z | 0 | 0 | 0/36 | 0/36 | 0/36 | 36/36 |
| 2026-05-24 | 2026-05-22T21:00:00.000Z | 0 | 0 | 0/36 | 0/36 | 0/36 | 36/36 |

## Actual App Direction Change Rows

| Week | Symbol | Actual Legacy | Actual Friday | Manual Legacy | Manual Friday | Legacy Current TS | Friday Current TS | Raw Friday Evidence |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-02-23 | EURCAD | SHORT | LONG | SHORT | LONG | 2026-02-22T23:10:08.687Z | 2026-02-20T21:10:24.596Z | no |

## Manual Reconstruction Direction Change Rows

| Week | Symbol | Manual Legacy | Manual Friday | Legacy DB TS | Friday DB TS | Legacy Reported TS | Friday Reported TS | Raw Friday Evidence |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-02-23 | EURCAD | SHORT | LONG | 2026-02-22 23:10:08.687 | 2026-02-20 21:10:24.596 | 2026-02-22T23:10:08.687Z | 2026-02-20T21:10:24.596Z | no |

## Sample Rows

| Week | Symbol | Actual Legacy | Actual Friday | Manual Legacy | Manual Friday | Legacy Agg Long | Friday Agg Long | Legacy DB TS | Legacy Reported TS | Friday DB TS | Friday Reported TS | Behavior |
| --- | --- | --- | --- | --- | --- | ---: | ---: | --- | --- | --- | --- | --- |
| 2026-02-23 | EURUSD | SHORT | SHORT | SHORT | SHORT | 57 | 57 | 2026-02-22 23:10:08.687 | 2026-02-22T23:10:08.687Z | 2026-02-20 21:10:24.596 | 2026-02-20T21:10:24.596Z | different_aggregate_no_raw_friday_evidence |
| 2026-02-23 | GBPUSD | SHORT | SHORT | SHORT | SHORT | 54 | 56 | 2026-02-22 23:10:08.687 | 2026-02-22T23:10:08.687Z | 2026-02-20 21:10:24.596 | 2026-02-20T21:10:24.596Z | different_aggregate_no_raw_friday_evidence |
| 2026-02-23 | AUDUSD | LONG | LONG | LONG | LONG | 14 | 15 | 2026-02-22 23:10:08.687 | 2026-02-22T23:10:08.687Z | 2026-02-20 21:10:24.596 | 2026-02-20T21:10:24.596Z | different_aggregate_no_raw_friday_evidence |
| 2026-02-23 | NZDUSD | LONG | LONG | LONG | LONG | 45 | 48 | 2026-02-22 23:10:08.687 | 2026-02-22T23:10:08.687Z | 2026-02-20 21:10:24.596 | 2026-02-20T21:10:24.596Z | different_aggregate_no_raw_friday_evidence |
| 2026-02-23 | USDJPY | LONG | LONG | LONG | LONG | 41 | 47 | 2026-02-22 23:10:08.687 | 2026-02-22T23:10:08.687Z | 2026-02-20 21:10:24.596 | 2026-02-20T21:10:24.596Z | different_aggregate_no_raw_friday_evidence |
| 2026-02-23 | USDCHF | SHORT | SHORT | SHORT | SHORT | 77 | 80 | 2026-02-22 23:10:08.687 | 2026-02-22T23:10:08.687Z | 2026-02-20 21:10:24.596 | 2026-02-20T21:10:24.596Z | different_aggregate_no_raw_friday_evidence |
| 2026-02-23 | USDCAD | SHORT | SHORT | SHORT | SHORT | 64 | 60 | 2026-02-22 23:10:08.687 | 2026-02-22T23:10:08.687Z | 2026-02-20 21:10:24.596 | 2026-02-20T21:10:24.596Z | different_aggregate_no_raw_friday_evidence |
| 2026-02-23 | EURGBP | LONG | LONG | LONG | LONG | 40 | 31 | 2026-02-22 23:10:08.687 | 2026-02-22T23:10:08.687Z | 2026-02-20 21:10:24.596 | 2026-02-20T21:10:24.596Z | different_aggregate_no_raw_friday_evidence |
| 2026-02-23 | EURJPY | LONG | LONG | LONG | LONG | 31 | 31 | 2026-02-22 23:10:08.687 | 2026-02-22T23:10:08.687Z | 2026-02-20 21:10:24.596 | 2026-02-20T21:10:24.596Z | different_aggregate_no_raw_friday_evidence |
| 2026-02-23 | EURCHF | SHORT | SHORT | SHORT | SHORT | 89 | 91 | 2026-02-22 23:10:08.687 | 2026-02-22T23:10:08.687Z | 2026-02-20 21:10:24.596 | 2026-02-20T21:10:24.596Z | different_aggregate_no_raw_friday_evidence |
| 2026-02-23 | EURAUD | SHORT | SHORT | SHORT | SHORT | 80 | 82 | 2026-02-22 23:10:08.687 | 2026-02-22T23:10:08.687Z | 2026-02-20 21:10:24.596 | 2026-02-20T21:10:24.596Z | different_aggregate_no_raw_friday_evidence |
| 2026-02-23 | EURNZD | SHORT | SHORT | SHORT | SHORT | 37 | 44 | 2026-02-22 23:10:08.687 | 2026-02-22T23:10:08.687Z | 2026-02-20 21:10:24.596 | 2026-02-20T21:10:24.596Z | different_aggregate_no_raw_friday_evidence |
| 2026-02-23 | EURCAD | SHORT | LONG | SHORT | LONG | 54 | 50 | 2026-02-22 23:10:08.687 | 2026-02-22T23:10:08.687Z | 2026-02-20 21:10:24.596 | 2026-02-20T21:10:24.596Z | different_aggregate_no_raw_friday_evidence |
| 2026-02-23 | GBPJPY | LONG | LONG | LONG | LONG | 44 | 54 | 2026-02-22 23:10:08.687 | 2026-02-22T23:10:08.687Z | 2026-02-20 21:10:24.596 | 2026-02-20T21:10:24.596Z | different_aggregate_no_raw_friday_evidence |
| 2026-02-23 | GBPCHF | SHORT | SHORT | SHORT | SHORT | 85 | 93 | 2026-02-22 23:10:08.687 | 2026-02-22T23:10:08.687Z | 2026-02-20 21:10:24.596 | 2026-02-20T21:10:24.596Z | different_aggregate_no_raw_friday_evidence |
| 2026-02-23 | GBPAUD | SHORT | SHORT | SHORT | SHORT | 81 | 81 | 2026-02-22 23:10:08.687 | 2026-02-22T23:10:08.687Z | 2026-02-20 21:10:24.596 | 2026-02-20T21:10:24.596Z | different_aggregate_no_raw_friday_evidence |
| 2026-02-23 | GBPNZD | SHORT | SHORT | SHORT | SHORT | 86 | 86 | 2026-02-22 23:10:08.687 | 2026-02-22T23:10:08.687Z | 2026-02-20 21:10:24.596 | 2026-02-20T21:10:24.596Z | different_aggregate_no_raw_friday_evidence |
| 2026-02-23 | GBPCAD | SHORT | SHORT | SHORT | SHORT | 54 | 59 | 2026-02-22 23:10:08.687 | 2026-02-22T23:10:08.687Z | 2026-02-20 21:10:24.596 | 2026-02-20T21:10:24.596Z | different_aggregate_no_raw_friday_evidence |
| 2026-02-23 | AUDJPY | LONG | LONG | LONG | LONG | 13 | 18 | 2026-02-22 23:10:08.687 | 2026-02-22T23:10:08.687Z | 2026-02-20 21:10:24.596 | 2026-02-20T21:10:24.596Z | different_aggregate_no_raw_friday_evidence |
| 2026-02-23 | AUDCHF | LONG | LONG | LONG | LONG | 40 | 34 | 2026-02-22 23:10:08.687 | 2026-02-22T23:10:08.687Z | 2026-02-20 21:10:24.596 | 2026-02-20T21:10:24.596Z | different_aggregate_no_raw_friday_evidence |
| 2026-02-23 | AUDCAD | LONG | LONG | LONG | LONG | 19 | 18 | 2026-02-22 23:10:08.687 | 2026-02-22T23:10:08.687Z | 2026-02-20 21:10:24.596 | 2026-02-20T21:10:24.596Z | different_aggregate_no_raw_friday_evidence |
| 2026-02-23 | AUDNZD | LONG | LONG | LONG | LONG | 10 | 9 | 2026-02-22 23:10:08.687 | 2026-02-22T23:10:08.687Z | 2026-02-20 21:10:24.596 | 2026-02-20T21:10:24.596Z | different_aggregate_no_raw_friday_evidence |
| 2026-02-23 | NZDJPY | LONG | LONG | LONG | LONG | 40 | 49 | 2026-02-22 23:10:08.687 | 2026-02-22T23:10:08.687Z | 2026-02-20 21:10:24.596 | 2026-02-20T21:10:24.596Z | different_aggregate_no_raw_friday_evidence |
| 2026-02-23 | NZDCHF | SHORT | SHORT | SHORT | SHORT | 76 | 80 | 2026-02-22 23:10:08.687 | 2026-02-22T23:10:08.687Z | 2026-02-20 21:10:24.596 | 2026-02-20T21:10:24.596Z | different_aggregate_no_raw_friday_evidence |
| 2026-02-23 | NZDCAD | LONG | LONG | LONG | LONG | 38 | 41 | 2026-02-22 23:10:08.687 | 2026-02-22T23:10:08.687Z | 2026-02-20 21:10:24.596 | 2026-02-20T21:10:24.596Z | different_aggregate_no_raw_friday_evidence |
| 2026-02-23 | CADJPY | LONG | LONG | LONG | LONG | 41 | 52 | 2026-02-22 23:10:08.687 | 2026-02-22T23:10:08.687Z | 2026-02-20 21:10:24.596 | 2026-02-20T21:10:24.596Z | different_aggregate_no_raw_friday_evidence |
| 2026-02-23 | CADCHF | SHORT | SHORT | SHORT | SHORT | 80 | 86 | 2026-02-22 23:10:08.687 | 2026-02-22T23:10:08.687Z | 2026-02-20 21:10:24.596 | 2026-02-20T21:10:24.596Z | different_aggregate_no_raw_friday_evidence |
| 2026-02-23 | CHFJPY | LONG | LONG | LONG | LONG | 14 | 16 | 2026-02-22 23:10:08.687 | 2026-02-22T23:10:08.687Z | 2026-02-20 21:10:24.596 | 2026-02-20T21:10:24.596Z | different_aggregate_no_raw_friday_evidence |
| 2026-02-23 | SPXUSD | LONG | LONG | LONG | LONG | 25 | 25 | 2026-02-22 23:10:08.687 | 2026-02-22T23:10:08.687Z | 2026-02-20 21:10:24.596 | 2026-02-20T21:10:24.596Z | different_aggregate_no_raw_friday_evidence |
| 2026-02-23 | NDXUSD | SHORT | SHORT | SHORT | SHORT | 98 | 98 | 2026-02-22 23:10:08.687 | 2026-02-22T23:10:08.687Z | 2026-02-20 21:10:24.596 | 2026-02-20T21:10:24.596Z | different_aggregate_no_raw_friday_evidence |
| 2026-02-23 | NIKKEIUSD | SHORT | SHORT | SHORT | SHORT | 100 | 100 | 2026-02-22 23:10:08.688 | 2026-02-22T23:10:08.688Z | 2026-02-20 21:10:24.596 | 2026-02-20T21:10:24.596Z | different_aggregate_no_raw_friday_evidence |
| 2026-02-23 | BTCUSD | SHORT | SHORT | SHORT | SHORT | 42 | 54 | 2026-02-22 23:10:08.688 | 2026-02-22T23:10:08.688Z | 2026-02-20 21:10:24.596 | 2026-02-20T21:10:24.596Z | different_aggregate_no_raw_friday_evidence |
| 2026-02-23 | ETHUSD | SHORT | SHORT | SHORT | SHORT | 62 | 67 | 2026-02-22 23:10:08.688 | 2026-02-22T23:10:08.688Z | 2026-02-20 21:10:24.596 | 2026-02-20T21:10:24.596Z | different_aggregate_no_raw_friday_evidence |
| 2026-02-23 | XAUUSD | SHORT | SHORT | SHORT | SHORT | 61 | 60 | 2026-02-22 23:10:08.687 | 2026-02-22T23:10:08.687Z | 2026-02-20 21:10:24.596 | 2026-02-20T21:10:24.596Z | different_aggregate_no_raw_friday_evidence |
| 2026-02-23 | XAGUSD | SHORT | SHORT | SHORT | SHORT | 52 | 56 | 2026-02-22 23:10:08.687 | 2026-02-22T23:10:08.687Z | 2026-02-20 21:10:24.596 | 2026-02-20T21:10:24.596Z | different_aggregate_no_raw_friday_evidence |
| 2026-02-23 | WTIUSD | SHORT | SHORT | SHORT | SHORT | 50 | 50 | 2026-02-22 23:10:08.688 | 2026-02-22T23:10:08.688Z | 2026-02-20 21:10:24.596 | 2026-02-20T21:10:24.596Z | different_aggregate_no_raw_friday_evidence |
| 2026-03-02 | EURUSD | LONG | LONG | LONG | LONG | 42 | 42 | 2026-03-01 23:10:51.454 | 2026-03-01T23:10:51.454Z | 2026-02-27 21:10:33.68 | 2026-02-27T21:10:33.680Z | different_aggregate_no_raw_friday_evidence |
| 2026-03-02 | GBPUSD | LONG | LONG | LONG | LONG | 44 | 44 | 2026-03-01 23:10:51.454 | 2026-03-01T23:10:51.454Z | 2026-02-27 21:10:33.68 | 2026-02-27T21:10:33.680Z | different_aggregate_no_raw_friday_evidence |
| 2026-03-02 | AUDUSD | LONG | LONG | LONG | LONG | 12 | 12 | 2026-03-01 23:10:51.454 | 2026-03-01T23:10:51.454Z | 2026-02-27 21:10:33.68 | 2026-02-27T21:10:33.680Z | different_aggregate_no_raw_friday_evidence |
| 2026-03-02 | NZDUSD | LONG | LONG | LONG | LONG | 50 | 50 | 2026-03-01 23:10:51.455 | 2026-03-01T23:10:51.455Z | 2026-02-27 21:10:33.681 | 2026-02-27T21:10:33.681Z | different_aggregate_no_raw_friday_evidence |
| 2026-03-02 | USDJPY | LONG | LONG | LONG | LONG | 47 | 45 | 2026-03-01 23:10:51.454 | 2026-03-01T23:10:51.454Z | 2026-02-27 21:10:33.68 | 2026-02-27T21:10:33.680Z | different_aggregate_no_raw_friday_evidence |
| 2026-03-02 | USDCHF | SHORT | SHORT | SHORT | SHORT | 90 | 90 | 2026-03-01 23:10:51.455 | 2026-03-01T23:10:51.455Z | 2026-02-27 21:10:33.681 | 2026-02-27T21:10:33.681Z | different_aggregate_no_raw_friday_evidence |
| 2026-03-02 | USDCAD | SHORT | SHORT | SHORT | SHORT | 71 | 71 | 2026-03-01 23:10:51.454 | 2026-03-01T23:10:51.454Z | 2026-02-27 21:10:33.68 | 2026-02-27T21:10:33.680Z | different_aggregate_no_raw_friday_evidence |
| 2026-03-02 | EURGBP | LONG | LONG | LONG | LONG | 16 | 15 | 2026-03-01 23:10:51.454 | 2026-03-01T23:10:51.454Z | 2026-02-27 21:10:33.681 | 2026-02-27T21:10:33.681Z | different_aggregate_no_raw_friday_evidence |
| 2026-03-02 | EURJPY | LONG | LONG | LONG | LONG | 19 | 19 | 2026-03-01 23:10:51.454 | 2026-03-01T23:10:51.454Z | 2026-02-27 21:10:33.68 | 2026-02-27T21:10:33.680Z | different_aggregate_no_raw_friday_evidence |
| 2026-03-02 | EURCHF | SHORT | SHORT | SHORT | SHORT | 96 | 96 | 2026-03-01 23:10:51.454 | 2026-03-01T23:10:51.454Z | 2026-02-27 21:10:33.681 | 2026-02-27T21:10:33.681Z | different_aggregate_no_raw_friday_evidence |
| 2026-03-02 | EURAUD | SHORT | SHORT | SHORT | SHORT | 78 | 78 | 2026-03-01 23:10:51.454 | 2026-03-01T23:10:51.454Z | 2026-02-27 21:10:33.68 | 2026-02-27T21:10:33.680Z | different_aggregate_no_raw_friday_evidence |
| 2026-03-02 | EURNZD | LONG | LONG | LONG | LONG | 45 | 41 | 2026-03-01 23:10:51.454 | 2026-03-01T23:10:51.454Z | 2026-02-27 21:10:33.681 | 2026-02-27T21:10:33.681Z | different_aggregate_no_raw_friday_evidence |
| 2026-03-02 | EURCAD | LONG | LONG | LONG | LONG | 41 | 42 | 2026-03-01 23:10:51.454 | 2026-03-01T23:10:51.454Z | 2026-02-27 21:10:33.681 | 2026-02-27T21:10:33.681Z | different_aggregate_no_raw_friday_evidence |
| 2026-03-02 | GBPJPY | SHORT | SHORT | SHORT | SHORT | 55 | 55 | 2026-03-01 23:10:51.454 | 2026-03-01T23:10:51.454Z | 2026-02-27 21:10:33.68 | 2026-02-27T21:10:33.680Z | different_aggregate_no_raw_friday_evidence |
| 2026-03-02 | GBPCHF | SHORT | SHORT | SHORT | SHORT | 96 | 96 | 2026-03-01 23:10:51.454 | 2026-03-01T23:10:51.454Z | 2026-02-27 21:10:33.681 | 2026-02-27T21:10:33.681Z | different_aggregate_no_raw_friday_evidence |
| 2026-03-02 | GBPAUD | SHORT | SHORT | SHORT | SHORT | 83 | 83 | 2026-03-01 23:10:51.455 | 2026-03-01T23:10:51.455Z | 2026-02-27 21:10:33.681 | 2026-02-27T21:10:33.681Z | different_aggregate_no_raw_friday_evidence |
| 2026-03-02 | GBPNZD | SHORT | SHORT | SHORT | SHORT | 87 | 87 | 2026-03-01 23:10:51.455 | 2026-03-01T23:10:51.455Z | 2026-02-27 21:10:33.681 | 2026-02-27T21:10:33.681Z | different_aggregate_no_raw_friday_evidence |
| 2026-03-02 | GBPCAD | SHORT | SHORT | SHORT | SHORT | 60 | 60 | 2026-03-01 23:10:51.454 | 2026-03-01T23:10:51.454Z | 2026-02-27 21:10:33.681 | 2026-02-27T21:10:33.681Z | different_aggregate_no_raw_friday_evidence |
| 2026-03-02 | AUDJPY | LONG | LONG | LONG | LONG | 22 | 22 | 2026-03-01 23:10:51.454 | 2026-03-01T23:10:51.454Z | 2026-02-27 21:10:33.68 | 2026-02-27T21:10:33.680Z | different_aggregate_no_raw_friday_evidence |
| 2026-03-02 | AUDCHF | LONG | LONG | LONG | LONG | 49 | 51 | 2026-03-01 23:10:51.455 | 2026-03-01T23:10:51.455Z | 2026-02-27 21:10:33.681 | 2026-02-27T21:10:33.681Z | different_aggregate_no_raw_friday_evidence |
| 2026-03-02 | AUDCAD | LONG | LONG | LONG | LONG | 28 | 29 | 2026-03-01 23:10:51.454 | 2026-03-01T23:10:51.454Z | 2026-02-27 21:10:33.68 | 2026-02-27T21:10:33.680Z | different_aggregate_no_raw_friday_evidence |
| 2026-03-02 | AUDNZD | LONG | LONG | LONG | LONG | 10 | 10 | 2026-03-01 23:10:51.454 | 2026-03-01T23:10:51.454Z | 2026-02-27 21:10:33.68 | 2026-02-27T21:10:33.680Z | different_aggregate_no_raw_friday_evidence |
| 2026-03-02 | NZDJPY | LONG | LONG | LONG | LONG | 30 | 28 | 2026-03-01 23:10:51.455 | 2026-03-01T23:10:51.455Z | 2026-02-27 21:10:33.681 | 2026-02-27T21:10:33.681Z | different_aggregate_no_raw_friday_evidence |
| 2026-03-02 | NZDCHF | SHORT | SHORT | SHORT | SHORT | 81 | 81 | 2026-03-01 23:10:51.455 | 2026-03-01T23:10:51.455Z | 2026-02-27 21:10:33.681 | 2026-02-27T21:10:33.681Z | different_aggregate_no_raw_friday_evidence |
| 2026-03-02 | NZDCAD | LONG | LONG | LONG | LONG | 34 | 33 | 2026-03-01 23:10:51.455 | 2026-03-01T23:10:51.455Z | 2026-02-27 21:10:33.681 | 2026-02-27T21:10:33.681Z | different_aggregate_no_raw_friday_evidence |
| 2026-03-02 | CADJPY | LONG | LONG | LONG | LONG | 26 | 27 | 2026-03-01 23:10:51.454 | 2026-03-01T23:10:51.454Z | 2026-02-27 21:10:33.681 | 2026-02-27T21:10:33.681Z | different_aggregate_no_raw_friday_evidence |
| 2026-03-02 | CADCHF | SHORT | SHORT | SHORT | SHORT | 88 | 89 | 2026-03-01 23:10:51.455 | 2026-03-01T23:10:51.455Z | 2026-02-27 21:10:33.681 | 2026-02-27T21:10:33.681Z | different_aggregate_no_raw_friday_evidence |
| 2026-03-02 | CHFJPY | LONG | LONG | LONG | LONG | 9 | 10 | 2026-03-01 23:10:51.455 | 2026-03-01T23:10:51.455Z | 2026-02-27 21:10:33.681 | 2026-02-27T21:10:33.681Z | different_aggregate_no_raw_friday_evidence |
| 2026-03-02 | SPXUSD | LONG | LONG | LONG | LONG | 25 | 25 | 2026-03-01 23:10:51.455 | 2026-03-01T23:10:51.455Z | 2026-02-27 21:10:33.681 | 2026-02-27T21:10:33.681Z | different_aggregate_no_raw_friday_evidence |
| 2026-03-02 | NDXUSD | SHORT | SHORT | SHORT | SHORT | 98 | 98 | 2026-03-01 23:10:51.455 | 2026-03-01T23:10:51.455Z | 2026-02-27 21:10:33.681 | 2026-02-27T21:10:33.681Z | different_aggregate_no_raw_friday_evidence |
| 2026-03-02 | NIKKEIUSD | SHORT | SHORT | SHORT | SHORT | 100 | 100 | 2026-03-01 23:10:51.455 | 2026-03-01T23:10:51.455Z | 2026-02-27 21:10:33.681 | 2026-02-27T21:10:33.681Z | different_aggregate_no_raw_friday_evidence |
| 2026-03-02 | BTCUSD | SHORT | SHORT | SHORT | SHORT | 81 | 81 | 2026-03-01 23:10:51.455 | 2026-03-01T23:10:51.455Z | 2026-02-27 21:10:33.681 | 2026-02-27T21:10:33.681Z | different_aggregate_no_raw_friday_evidence |
| 2026-03-02 | ETHUSD | SHORT | SHORT | SHORT | SHORT | 69 | 69 | 2026-03-01 23:10:51.455 | 2026-03-01T23:10:51.455Z | 2026-02-27 21:10:33.681 | 2026-02-27T21:10:33.681Z | different_aggregate_no_raw_friday_evidence |
| 2026-03-02 | XAUUSD | SHORT | SHORT | SHORT | SHORT | 61 | 62 | 2026-03-01 23:10:51.455 | 2026-03-01T23:10:51.455Z | 2026-02-27 21:10:33.681 | 2026-02-27T21:10:33.681Z | different_aggregate_no_raw_friday_evidence |
| 2026-03-02 | XAGUSD | SHORT | SHORT | SHORT | SHORT | 51 | 51 | 2026-03-01 23:10:51.455 | 2026-03-01T23:10:51.455Z | 2026-02-27 21:10:33.681 | 2026-02-27T21:10:33.681Z | different_aggregate_no_raw_friday_evidence |
| 2026-03-02 | WTIUSD | SHORT | SHORT | SHORT | SHORT | 50 | 50 | 2026-03-01 23:10:51.455 | 2026-03-01T23:10:51.455Z | 2026-02-27 21:10:33.681 | 2026-02-27T21:10:33.681Z | different_aggregate_no_raw_friday_evidence |
| 2026-03-08 | EURUSD | SHORT | SHORT | SHORT | SHORT | 69 | 69 | 2026-03-08 22:10:12.555 | 2026-03-08T22:10:12.555Z | 2026-03-06 21:10:11.816 | 2026-03-06T21:10:11.816Z | different_aggregate_no_raw_friday_evidence |
| 2026-03-08 | GBPUSD | LONG | LONG | LONG | LONG | 40 | 40 | 2026-03-08 22:10:12.555 | 2026-03-08T22:10:12.555Z | 2026-03-06 21:10:11.816 | 2026-03-06T21:10:11.816Z | different_aggregate_no_raw_friday_evidence |
| 2026-03-08 | AUDUSD | LONG | LONG | LONG | LONG | 16 | 16 | 2026-03-08 22:10:12.555 | 2026-03-08T22:10:12.555Z | 2026-03-06 21:10:11.816 | 2026-03-06T21:10:11.816Z | different_aggregate_no_raw_friday_evidence |
| 2026-03-08 | NZDUSD | SHORT | SHORT | SHORT | SHORT | 55 | 55 | 2026-03-08 22:10:12.555 | 2026-03-08T22:10:12.555Z | 2026-03-06 21:10:11.816 | 2026-03-06T21:10:11.816Z | different_aggregate_no_raw_friday_evidence |
| 2026-03-08 | USDJPY | LONG | LONG | LONG | LONG | 33 | 33 | 2026-03-08 22:10:12.555 | 2026-03-08T22:10:12.555Z | 2026-03-06 21:10:11.816 | 2026-03-06T21:10:11.816Z | different_aggregate_no_raw_friday_evidence |
| 2026-03-08 | USDCHF | SHORT | SHORT | SHORT | SHORT | 82 | 82 | 2026-03-08 22:10:12.555 | 2026-03-08T22:10:12.555Z | 2026-03-06 21:10:11.816 | 2026-03-06T21:10:11.816Z | different_aggregate_no_raw_friday_evidence |
| 2026-03-08 | USDCAD | SHORT | SHORT | SHORT | SHORT | 80 | 78 | 2026-03-08 22:10:12.555 | 2026-03-08T22:10:12.555Z | 2026-03-06 21:10:11.816 | 2026-03-06T21:10:11.816Z | different_aggregate_no_raw_friday_evidence |
| 2026-03-08 | EURGBP | SHORT | SHORT | SHORT | SHORT | 68 | 68 | 2026-03-08 22:10:12.555 | 2026-03-08T22:10:12.555Z | 2026-03-06 21:10:11.816 | 2026-03-06T21:10:11.816Z | different_aggregate_no_raw_friday_evidence |
| ... | ... | ... | ... | ... | ... | ... | ... | ... | 424 more rows in JSON |

## Report Files

- JSON: `reports\snapshot-regime-comparison\clean14-sentiment-regime-behavior-audit.json`
- Markdown: `reports\snapshot-regime-comparison\clean14-sentiment-regime-behavior-audit.md`
