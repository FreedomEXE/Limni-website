# Weekly Hold Engine Parity Research - USDJPY

Date: 2026-06-13

Gate: Gate 33 weekly-hold-engine-parity

## Scope

This note records the Dealer Weekly Hold parity target for USDJPY. USDJPY is the
representative JPY precision/feed case in the Gate 33 sample.

Status: PASS.

## USDJPY Receipt

Command:

```powershell
npm run verification:export-weekly-hold-runback -- --symbol USDJPY --weeks 26 --from 2026-01-01 --derive-missing-execution
```

Receipt files:

- JSON: `app/reports/data-verification/weekly-hold-runback/usdjpy-dealer-weekly-hold-23w-20260613-220216.json`
- CSV: `app/reports/data-verification/weekly-hold-runback/usdjpy-dealer-weekly-hold-23w-20260613-220216.csv`
- Markdown: `app/reports/data-verification/weekly-hold-runback/usdjpy-dealer-weekly-hold-23w-20260613-220216.md`
- Pine input: `app/reports/data-verification/weekly-hold-runback/usdjpy-dealer-weekly-hold-23w-20260613-220216-pine-input.txt`

Result:

- Window: displayed weeks 2026-01-06 through 2026-06-08.
- Rows: 23.
- Direction rows: 23.
- Wins/losses/flat: 8/15/0.
- Total raw percent: -4.861884%.
- Total app ADR-normalized percent: -7.197098%.
- Max raw DD percent: -2.566063%.
- Max app ADR DD percent: -5.133223%.
- Avg raw DD percent: -0.922059%.
- Avg app ADR DD percent: -1.369444%.
- Worst DD week: displayed 2026-04-27.
- Missing signal rows: 0.
- Missing execution-return rows: 0 after read-only canonical 1H derivation.

Notes:

- Derived execution weeks: 2026-01-06 and 2026-01-13.
- Default ADR rows: 2026-01-06, 2026-01-13, and 2026-01-20.
- Per-week DD targets live in the receipt CSV/JSON. The CSV stores DD
  magnitudes; the Pine display renders them as negative drawdown percentages.

## TradingView Smoke Test

Status: PASS.

TradingView setup:

- Symbol/feed: `OANDA:USDJPY`.
- Indicator mode: `Weekly Hold`.
- Return basis: `ADR Normalized`.
- Verifier workflow: `Runback Mode`.
- Runback source label: `Dealer`.
- Runback rows: the 23-line Pine input from the receipt.

Pass target after UI rounding:

- Row coverage: 23/23.
- Match status: all matched.
- W/L: 8/15.
- Total Raw: -4.86%.
- ADR Norm: -7.20%.
- Max DD Raw: -2.57%.
- Max DD ADR: -5.13%.
- Worst Raw Week: 2026-04-27.
- Worst ADR Week: 2026-04-27.

Freedom provided a corrected-panel TradingView screenshot on 2026-06-13 after
the Pine aggregate DD display fix. The visible panel matched row coverage, W/L,
return totals, independent max raw DD, independent max ADR DD, worst raw week,
and worst ADR week after UI rounding.

Screenshot proof:

`app/releases/v2/screenshots/tradingview-parity-2026-06-13/usdjpy-weekly-hold-dealer-runback-dd-pass-manual-2026-06-13.png`

Saved screenshot filename:

`usdjpy-weekly-hold-dealer-runback-dd-pass-manual-2026-06-13.png`.

## Acceptance

USDJPY is PASS because the corrected TradingView screenshot proves:

- `OANDA:USDJPY` is the active feed.
- Row coverage is 23/23 and every row is matched.
- W/L is 8/15.
- Total Raw and ADR Norm match after UI rounding.
- Per-week DD raw and DD ADR values match after UI rounding.
- Max raw DD, max ADR DD, worst raw week, and worst ADR week match the receipt.
- Screenshot proof is saved under `app/releases/v2/screenshots/` and linked
  from this note.
