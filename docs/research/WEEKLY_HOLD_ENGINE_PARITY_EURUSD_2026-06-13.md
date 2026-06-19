# Weekly Hold Engine Parity Research - EURUSD

Date: 2026-06-13

Gate: Gate 33 weekly-hold-engine-parity

## Scope

This note records the Dealer Weekly Hold parity proof for EURUSD after the
AUDCAD representative pass. The goal is not strategy tuning. The goal is to
record a reproducible app-side receipt and TradingView/Pine smoke test for
return and drawdown parity.

Status: PASS for EURUSD percentage and DD parity.

## COT Shutdown Boundary

As with the AUDCAD Gate 33 note, Sep-Dec 2025 is not a clean Dealer parity
window because of the 2025 CFTC/COT shutdown and catch-up schedule. This
EURUSD receipt starts from the first displayed app week in 2026.

## EURUSD Receipt

Command:

```powershell
npm run verification:export-weekly-hold-runback -- --symbol EURUSD --weeks 26 --from 2026-01-01 --derive-missing-execution
```

Receipt files:

- JSON: `app/reports/data-verification/weekly-hold-runback/eurusd-dealer-weekly-hold-23w-20260613-213922.json`
- CSV: `app/reports/data-verification/weekly-hold-runback/eurusd-dealer-weekly-hold-23w-20260613-213922.csv`
- Markdown: `app/reports/data-verification/weekly-hold-runback/eurusd-dealer-weekly-hold-23w-20260613-213922.md`
- Pine input: `app/reports/data-verification/weekly-hold-runback/eurusd-dealer-weekly-hold-23w-20260613-213922-pine-input.txt`

Result:

- Window: displayed weeks 2026-01-06 through 2026-06-08.
- Rows: 23.
- Direction rows: 23.
- Wins/losses/flat: 9/14/0.
- Total raw percent: -4.560005%.
- Total app ADR-normalized percent: -8.120682%.
- Max raw DD percent: -2.097255%.
- Max app ADR DD percent: -4.082173%.
- Avg raw DD percent: -0.699440%.
- Avg app ADR DD percent: -1.160027%.
- Worst DD week: displayed 2026-03-03.
- Missing signal rows: 0.
- Missing execution-return rows: 0 after read-only canonical 1H derivation.

Stored-app subset:

- Rows from stored `pair_period_returns`: 21.
- Rows derived from canonical 1H bars because stored execution rows were absent:
  2.
- Derived weeks: displayed 2026-01-06 and 2026-01-13.
- Database mutation: none.

ADR denominator note:

- Three rows used the app asset default ADR percent of 0.600000 because the ADR
  lookup had no canonical daily ADR value for EURUSD yet.
- Default ADR rows: displayed 2026-01-06, 2026-01-13, and 2026-01-20.
- This matches current app fallback behavior, but the canonical research engine
  should mark default-ADR rows as lower-confidence than canonical ADR rows.

## Pine Input

Set `Verifier Workflow` to `Runback Mode`, set `Runback Source Label` to
`Dealer`, and paste this into the indicator's `Runback Rows` input on EURUSD:

```text
2026-01-06,LONG,0.600000
2026-01-13,LONG,0.600000
2026-01-20,LONG,0.600000
2026-01-27,LONG,0.767384
2026-02-03,LONG,0.984558
2026-02-10,LONG,0.857252
2026-02-17,LONG,0.472030
2026-02-24,LONG,0.467171
2026-03-03,LONG,0.513759
2026-03-09,LONG,0.720673
2026-03-16,LONG,0.855617
2026-03-23,SHORT,0.890442
2026-03-30,SHORT,0.788945
2026-04-06,SHORT,0.617797
2026-04-13,SHORT,0.725774
2026-04-20,SHORT,0.642104
2026-04-27,SHORT,0.497527
2026-05-04,SHORT,0.528979
2026-05-11,SHORT,0.543657
2026-05-18,SHORT,0.495731
2026-05-25,SHORT,0.452209
2026-06-01,SHORT,0.439618
2026-06-08,SHORT,0.495369
```

## TradingView Smoke Test

Status: PASS.

TradingView setup:

- Symbol/feed: `OANDA:EURUSD`.
- Indicator mode: `Weekly Hold`.
- Return basis: `ADR Normalized`.
- Verifier workflow: `Runback Mode`.
- Runback source label: `Dealer`.
- Runback rows: the 23-line Pine input above.
- Screenshot proof:
  `app/releases/v2/screenshots/tradingview-parity-2026-06-13/eurusd-weekly-hold-dealer-runback-dd-pass-manual-2026-06-13.png`.

Observed on 2026-06-13 screenshot:

- Row coverage: 23/23.
- Match status: all matched.
- W/L: 9/14.
- Total Raw: -4.56%.
- ADR Norm: -8.12%.
- Max DD Raw: -2.10%.
- Max DD ADR: -4.08%.
- Worst DD Week: 2026-03-03.
- Avg Raw: -0.20%.
- Avg ADR Norm: -0.35%.

Acceptance:

- The TradingView percentage totals match the receipt totals after UI rounding:
  -4.560005% raw -> -4.56%, and -8.120682% app ADR-normalized -> -8.12%.
- The TradingView DD surface matches the receipt after UI rounding:
  -2.097255% raw DD -> -2.10%, -4.082173% app ADR DD -> -4.08%, and
  worst DD week 2026-03-03.
- EURUSD is therefore accepted as a Weekly Hold Dealer parity pass for the
  percentage and drawdown surfaces.
- This is not a full-engine promotion. It validates the verifier path for a
  second representative FX pair after AUDCAD.

## Row-Level Comparison Targets

Use this table for per-week TradingView DD comparison. TradingView should match
these values after UI rounding.

| Week | Dir | ADR % | Raw % | ADR Norm % | DD Raw % | DD ADR % | Outcome |
|---|---:|---:|---:|---:|---:|---:|---|
| 2026-01-06 | LONG | 0.600000 | -0.551047 | -0.918412 | -0.741563 | -1.235939 | LOSS |
| 2026-01-13 | LONG | 0.600000 | -0.612093 | -1.020155 | -0.689247 | -1.148745 | LOSS |
| 2026-01-20 | LONG | 0.600000 | 1.084069 | 1.806782 | -0.179675 | -0.299459 | WIN |
| 2026-01-27 | LONG | 0.767384 | 0.285803 | 0.372438 | -0.221729 | -0.288942 | WIN |
| 2026-02-03 | LONG | 0.984558 | -0.398598 | -0.404850 | -0.851128 | -0.864478 | LOSS |
| 2026-02-10 | LONG | 0.857252 | 0.147919 | 0.172550 | -0.124252 | -0.144942 | WIN |
| 2026-02-17 | LONG | 0.472030 | -0.615452 | -1.303842 | -1.004957 | -2.129013 | LOSS |
| 2026-02-24 | LONG | 0.467171 | -0.201166 | -0.430605 | -0.547714 | -1.172406 | LOSS |
| 2026-03-03 | LONG | 0.513759 | -1.678653 | -3.267391 | -2.097255 | -4.082173 | LOSS |
| 2026-03-09 | LONG | 0.720673 | -0.583973 | -0.810316 | -0.793961 | -1.101693 | LOSS |
| 2026-03-16 | LONG | 0.855617 | 0.868341 | 1.014872 | -0.186260 | -0.217691 | WIN |
| 2026-03-23 | SHORT | 0.890442 | 0.288872 | 0.324414 | -0.672017 | -0.754701 | WIN |
| 2026-03-30 | SHORT | 0.788945 | -0.254090 | -0.322063 | -1.176471 | -1.491195 | LOSS |
| 2026-04-06 | SHORT | 0.617797 | -1.894038 | -3.065793 | -1.986134 | -3.214863 | LOSS |
| 2026-04-13 | SHORT | 0.725774 | -1.186275 | -1.634497 | -1.490338 | -2.053447 | LOSS |
| 2026-04-20 | SHORT | 0.642104 | 0.277707 | 0.432496 | -0.443820 | -0.691197 | WIN |
| 2026-04-27 | SHORT | 0.497527 | -0.527952 | -1.061153 | -0.680016 | -1.366793 | LOSS |
| 2026-05-04 | SHORT | 0.528979 | -0.414471 | -0.783531 | -0.604650 | -1.143051 | LOSS |
| 2026-05-11 | SHORT | 0.543657 | 1.172731 | 2.157116 | -0.173360 | -0.318878 | WIN |
| 2026-05-18 | SHORT | 0.495731 | 0.141209 | 0.284850 | -0.411572 | -0.830233 | WIN |
| 2026-05-25 | SHORT | 0.452209 | -0.231064 | -0.510967 | -0.281743 | -0.623038 | LOSS |
| 2026-06-01 | SHORT | 0.439618 | 0.769191 | 1.749682 | -0.139073 | -0.316349 | WIN |
| 2026-06-08 | SHORT | 0.495369 | -0.446975 | -0.902307 | -0.590180 | -1.191396 | LOSS |

## Acceptance

EURUSD is marked PASS because the TradingView screenshot proves:

- `OANDA:EURUSD` is the active feed.
- Row coverage is 23/23 and every row is matched.
- W/L is 9/14.
- Total Raw and ADR Norm match after UI rounding.
- Per-week DD raw and DD ADR values match after UI rounding.
- Max raw DD, max ADR DD, and worst DD week match the receipt.
- Screenshot proof is saved under `app/releases/v2/screenshots/` and linked
  from this note.
