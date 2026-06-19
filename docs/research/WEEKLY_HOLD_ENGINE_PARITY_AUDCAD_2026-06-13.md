# Weekly Hold Engine Parity Research - AUDCAD

Date: 2026-06-13

Gate: Gate 33 weekly-hold-engine-parity

## Scope

This note records the first Dealer Weekly Hold parity receipt for AUDCAD. The
goal is not strategy tuning. The goal is to define the reproducible source path
for the canonical research engine and Pine/TradingView smoke tests.

## COT Shutdown Boundary

The 2025 CFTC/COT shutdown affects the usable test window. The official CFTC
catch-up notice says the interrupted sequence starts with the 09/30/2025 COT
report that would have published on 10/03/2025:

- https://www.cftc.gov/PressRoom/PressReleases/9138-25

The later CFTC accelerated schedule says the backlog would be eliminated by
12/29/2025 and lists 12/23/2025 as the report date that returned the schedule
to normal:

- https://www.cftc.gov/PressRoom/PressReleases/9147-25

Decision for Gate 33: do not use Sep-Dec 2025 rows as clean parity research
inputs. Start Weekly Hold parity from the first displayed app week in 2026.

## AUDCAD Receipt

Command:

```powershell
npm run verification:export-weekly-hold-runback -- --symbol AUDCAD --weeks 26 --from 2026-01-01 --derive-missing-execution
```

Receipt files:

- JSON: `app/reports/data-verification/weekly-hold-runback/audcad-dealer-weekly-hold-23w-20260613-211757.json`
- CSV: `app/reports/data-verification/weekly-hold-runback/audcad-dealer-weekly-hold-23w-20260613-211757.csv`
- Markdown: `app/reports/data-verification/weekly-hold-runback/audcad-dealer-weekly-hold-23w-20260613-211757.md`
- Pine input: `app/reports/data-verification/weekly-hold-runback/audcad-dealer-weekly-hold-23w-20260613-211757-pine-input.txt`

Result:

- Window: displayed weeks 2026-01-06 through 2026-06-08.
- Rows: 23.
- Direction rows: 23.
- Wins/losses/flat: 15/8/0.
- Total raw percent: +8.344354%.
- Total app ADR-normalized percent: +11.460286%.
- Max raw DD percent: -1.485701%.
- Max app ADR DD percent: -2.339632%.
- Avg raw DD percent: -0.471304%.
- Avg app ADR DD percent: -0.701120%.
- Worst DD week: displayed 2026-03-03.
- Missing signal rows: 0.
- Missing execution-return rows: 0 after read-only canonical 1H derivation.

Stored-app subset:

- Rows from stored `pair_period_returns`: 21.
- Stored subset wins/losses: 14/7.
- Stored subset total raw percent: +7.417271%.
- Stored subset app ADR-normalized percent: +9.915148%.

Derived-readonly subset:

- Rows derived from canonical 1H bars because stored execution rows were absent:
  2.
- Derived weeks: displayed 2026-01-06 and 2026-01-13.
- Derived subset total raw percent: +0.927083%.
- Derived subset app ADR-normalized percent: +1.545138%.
- Database mutation: none.

ADR denominator note:

- Three rows used the app asset default ADR percent of 0.600000 because the ADR
  lookup had no canonical daily ADR value for AUDCAD yet.
- Default ADR rows: displayed 2026-01-06, 2026-01-13, 2026-01-20.
- This matches current app fallback behavior, but the canonical research engine
  should mark default-ADR rows as lower-confidence than canonical ADR rows.

## Pine Input

Set `Verifier Workflow` to `Runback Mode`, set `Runback Source Label` to
`Dealer`, and paste this into the indicator's `Runback Rows` input on AUDCAD:

```text
2026-01-06,LONG,0.600000
2026-01-13,LONG,0.600000
2026-01-20,LONG,0.600000
2026-01-27,LONG,0.524879
2026-02-03,LONG,0.722500
2026-02-10,LONG,0.918442
2026-02-17,SHORT,0.810777
2026-02-24,SHORT,0.626884
2026-03-03,LONG,0.635015
2026-03-09,LONG,1.017151
2026-03-16,LONG,1.208966
2026-03-23,LONG,1.217802
2026-03-30,LONG,1.027957
2026-04-06,LONG,0.694460
2026-04-13,LONG,0.771268
2026-04-20,LONG,0.744096
2026-04-27,LONG,0.537501
2026-05-04,LONG,0.589930
2026-05-11,LONG,0.752527
2026-05-18,LONG,0.656146
2026-05-25,LONG,0.615470
2026-06-01,LONG,0.502118
2026-06-08,LONG,0.565371
```

## TradingView Smoke Test

Status: PASS for AUDCAD percentage and DD parity.

TradingView setup:

- Symbol/feed: `OANDA:AUDCAD`.
- Indicator mode: `Weekly Hold`.
- Return basis: `ADR Normalized`.
- Verifier workflow: `Runback Mode`.
- Runback Rows: the 23-line Pine input above.

Observed on 2026-06-13 screenshot:

- Screenshot proof:
  `app/releases/v2/screenshots/tradingview-parity-2026-06-13/audcad-weekly-hold-dealer-runback-dd-pass-manual-2026-06-13.png`.
- Row coverage: 23/23.
- W/L: 15/8.
- Match status: all matched.
- Total Raw: +8.34%.
- ADR Norm: +11.46%.
- Max DD Raw: -1.49%.
- Max DD ADR: -2.34%.
- Worst DD Week: 2026-03-03.

DD comparison targets from the app receipt:

- Max raw DD: -1.49% after Pine table rounding.
- Max ADR DD: -2.34% after Pine table rounding.
- Avg raw DD: -0.47% for receipt-level context.
- Avg ADR DD: -0.70% for receipt-level context.
- Worst DD week: 2026-03-03.

Acceptance:

- The TradingView percentage totals match the receipt totals after UI rounding:
  +8.344354% raw -> +8.34%, and +11.460286% app ADR-normalized -> +11.46%.
- The TradingView DD surface matches the receipt after UI rounding:
  -1.485701% raw DD -> -1.49%, -2.339632% app ADR DD -> -2.34%, and
  worst DD week 2026-03-03.
- AUDCAD is therefore accepted as the first Weekly Hold Dealer parity pass for
  the percentage and drawdown surfaces.
- This is not a full-engine promotion. It validates the current verifier path
  for one representative FX pair and should be extended only as needed with
  additional clean representative symbols.
- Drawdown parity is locked for this AUDCAD smoke test. Broader symbol coverage
  remains a separate Gate 33 decision.

## Engine Implications

- A flat 26-week requirement is not currently a truthful Gate 33 starting point
  for Dealer/COT parity because the shutdown window contaminates source
  recency and the post-clean window has only 23 displayed weeks available.
- The future canonical research engine should separate three states:
  stored materialized return, read-only derived canonical return, and missing
  return. These cannot be silently blended.
- The future engine should also separate canonical ADR rows from default-ADR
  fallback rows.
- Old loose scripts remain references only. A candidate result becomes research
  truth only after it emits a receipt with row-level direction, return source,
  ADR source, app-normalized return, and Pine-compatible input.
