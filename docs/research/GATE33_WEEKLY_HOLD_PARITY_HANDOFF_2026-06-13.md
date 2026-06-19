# Gate 33 Weekly Hold Parity Handoff

Date: 2026-06-13

Gate: Gate 33 weekly-hold-engine-parity

## Current Decision

AUDCAD, EURUSD, GBPUSD, NZDUSD, USDCHF, and USDJPY are marked PASS for Weekly
Hold Dealer percentage and DD parity with manual screenshot proof saved under
`app/releases/v2/`.

Do not treat this as full engine readiness. The current sample proves the
TradingView/Pine verifier and export receipt agree across representative FX
pairs on the percentage and drawdown surfaces, while still keeping ADR Grid,
risk overlay, optimization, and release canon work out of scope.

## AUDCAD Evidence

Source receipt:

- `docs/research/WEEKLY_HOLD_ENGINE_PARITY_AUDCAD_2026-06-13.md`
- `app/reports/data-verification/weekly-hold-runback/audcad-dealer-weekly-hold-23w-20260613-211757.md`
- `app/reports/data-verification/weekly-hold-runback/audcad-dealer-weekly-hold-23w-20260613-211757-pine-input.txt`
- Screenshot proof:
  `app/releases/v2/screenshots/tradingview-parity-2026-06-13/audcad-weekly-hold-dealer-runback-dd-pass-manual-2026-06-13.png`

TradingView setup:

- Symbol/feed: `OANDA:AUDCAD`
- Indicator: `Limni ADR Verifier`
- Mode: `Weekly Hold`
- Basis: `ADR Normalized`
- Verifier Workflow: `Runback Mode`
- Runback Source Label: `Dealer`
- Runback Rows: AUDCAD 23-row Pine input from the receipt

Pass criteria met:

- Row coverage: 23/23
- Match status: all matched
- W/L: 15/8
- Total Raw: +8.34%
- ADR Norm: +11.46%

Receipt totals:

- Raw: +8.344354%
- App ADR-normalized: +11.460286%

## EURUSD Evidence

EURUSD is marked PASS for Weekly Hold Dealer percentage and DD parity.

Source receipt:

- `docs/research/WEEKLY_HOLD_ENGINE_PARITY_EURUSD_2026-06-13.md`
- `app/reports/data-verification/weekly-hold-runback/eurusd-dealer-weekly-hold-23w-20260613-213922.md`
- `app/reports/data-verification/weekly-hold-runback/eurusd-dealer-weekly-hold-23w-20260613-213922-pine-input.txt`
- Screenshot proof:
  `app/releases/v2/screenshots/tradingview-parity-2026-06-13/eurusd-weekly-hold-dealer-runback-dd-pass-manual-2026-06-13.png`

TradingView setup:

- Symbol/feed: `OANDA:EURUSD`
- Indicator: `Limni ADR Verifier`
- Mode: `Weekly Hold`
- Basis: `ADR Normalized`
- Verifier Workflow: `Runback Mode`
- Runback Source Label: `Dealer`
- Runback Rows: EURUSD 23-row Pine input from the receipt

Pass criteria met:

- Row coverage: 23/23
- Match status: all matched
- W/L: 9/14
- Total Raw: -4.56%
- ADR Norm: -8.12%
- Max DD Raw: -2.10%
- Max DD ADR: -4.08%
- Worst DD Week: 2026-03-03

The EURUSD research note includes the row-level raw, ADR-normalized, and DD
targets. This is a second representative FX parity pass after AUDCAD; it is
still not a full-engine promotion by itself.

## Remaining Prepared Targets

The remaining representative receipts are prepared. Freedom provided corrected
TradingView screenshots after the Pine aggregate DD display fix on 2026-06-13.
Those screenshots matched row coverage, W/L, total raw, total ADR-normalized
return, independent max raw DD, independent max ADR DD, and the independent
worst raw/ADR-DD weeks after UI rounding.

AUDCAD, EURUSD, GBPUSD, NZDUSD, USDCHF, and USDJPY local screenshot proof was
moved from repo-root image files into the Gate 33 screenshot folder. Use the
symbol-specific research notes for receipt links, Pine input paths, and
per-week DD source files.

| Symbol | TradingView feed | Status | W/L | Total Raw | ADR Norm | Max DD Raw / Worst Raw Week | Max DD ADR / Worst ADR Week | Research note |
|---|---|---|---:|---:|---:|---:|---:|---|
| GBPUSD | `OANDA:GBPUSD` | PASS | 12/11 | -1.69% | -2.48% | -2.26% / 2026-04-06 | -3.16% / 2026-04-06 | `docs/research/WEEKLY_HOLD_ENGINE_PARITY_GBPUSD_2026-06-13.md` |
| USDJPY | `OANDA:USDJPY` | PASS | 8/15 | -4.86% | -7.20% | -2.57% / 2026-04-27 | -5.13% / 2026-04-27 | `docs/research/WEEKLY_HOLD_ENGINE_PARITY_USDJPY_2026-06-13.md` |
| USDCHF | `OANDA:USDCHF` | PASS | 9/13 plus 1 flat | -1.44% | -1.63% | -2.18% / 2026-01-27 | -2.63% / 2026-04-06 | `docs/research/WEEKLY_HOLD_ENGINE_PARITY_USDCHF_2026-06-13.md` |
| NZDUSD | `OANDA:NZDUSD` | PASS | 11/12 | -3.47% | -6.67% | -3.31% / 2026-04-06 | -4.78% / 2026-01-20 | `docs/research/WEEKLY_HOLD_ENGINE_PARITY_NZDUSD_2026-06-13.md` |

## What Changed In This Gate

- Pine runback matching now accepts any app week label date inside the same
  week, not just Sunday/Monday keys.
- Pine display separates the actual app ADR denominator from ADR-normalized
  return.
- The verifier now has a workflow selector:
  - `Legacy Mode` keeps the old LONG/SHORT pair paste boxes with a week-offset
    selector.
  - `Runback Mode` owns pasted source rows and ignores the legacy pair lists.
- Runback labels are generic through `Runback Source Label`, so the same
  verifier can be used for Dealer, Commercial, or another source set.
- The bottom-left runback table is row-level only: matched/input count, W/L,
  ADR %, Raw, ADR Norm, and DD Raw/ADR columns.
- The top-right `Limni Verify` panel becomes the runback aggregate panel in
  Runback Mode: coverage, W/L, win rate, total raw, ADR Norm, average returns,
  max raw DD, max ADR DD, and worst DD week.
- The runback aggregate panel now separates independent max raw DD from
  independent max ADR DD and labels their weeks separately as `Worst Raw Week`
  and `Worst ADR Week`.
- Runback START/STOP markers remain visible across matched weeks.
- Return totals were removed from the row-level runback panel so totals and
  individual week rows are not mixed.

## Drawdown Follow-Up

Freedom identified that return parity is not enough. Weekly Hold parity also
needs drawdown parity:

- every runback week should expose its own max DD in raw percent and
  ADR-normalized percent;
- the aggregate panel should show the worst DD week across the pasted runback;
- AUDCAD percentage and DD parity are marked PASS for the first smoke test.

Fresh AUDCAD DD-aware app receipt:

- Receipt: `app/reports/data-verification/weekly-hold-runback/audcad-dealer-weekly-hold-23w-20260613-211757.md`
- Max raw DD: -1.485701%.
- Max app ADR DD: -2.339632%.
- Avg raw DD: -0.471304%.
- Avg app ADR DD: -0.701120%.
- Worst DD week: 2026-03-03.
- TradingView observed on 2026-06-13: max raw DD -1.49%, max ADR DD -2.34%,
  and worst DD week 2026-03-03. These match the app receipt after UI rounding.

## Current Boundaries

Keep this gate as data verification only.

Frozen until Freedom chooses otherwise:

- ADR Grid parity
- Pair Fill Cap or risk-overlay redesign
- strategy optimization
- full production research-engine build
- release canon changes

Freedom's current direction: use a small representative sample for Weekly Hold
trust before moving toward optimization. The corrected-panel sample now covers
AUD, CAD, EUR, USD, GBP, JPY, CHF, and NZD with repo-local screenshot proof.

## Recommended Continuation

If continuing Weekly Hold parity, do not run every FX pair by default. Use a
representative clean sample that exercises the major currencies and feed
mapping:

- AUDCAD: done, PASS return + DD
- EURUSD: done, PASS return + DD
- GBPUSD: done, PASS return + DD
- USDJPY: done, PASS return + DD
- USDCHF: done, PASS return + DD
- NZDUSD: done, PASS return + DD

This sample covers AUD, CAD, EUR, USD, GBP, JPY, CHF, and NZD without turning
Gate 33 into a broad backtest campaign.

For each candidate:

1. Generate the receipt:

   ```powershell
   npm run verification:export-weekly-hold-runback -- --symbol SYMBOL --weeks 26 --from 2026-01-01 --derive-missing-execution
   ```

2. Set `Verifier Workflow` to `Runback Mode` and paste the generated Pine input
   into `Runback Rows`.
3. Switch TradingView to the same pair/feed, preferably the app-comparable
   OANDA feed where available.
4. Confirm row count, W/L, Total Raw, ADR Norm, each week DD, max DD, and worst
   DD week against the receipt after UI rounding.
5. Save screenshot proof under `app/releases/v2/screenshots/` and link it from
   this handoff or the symbol-specific research note.
6. Record PASS/FAIL in this handoff or a symbol-specific research note.

## Pass/Fail Standard

Mark PASS when:

- TradingView feed matches the receipt symbol.
- Matched/input count is complete for the receipt window.
- W/L matches.
- Total Raw matches after UI rounding.
- ADR Norm matches after UI rounding.
- Per-week raw and ADR-normalized max DD match after UI rounding.
- Independent max raw DD, independent max ADR DD, `Worst Raw Week`, and
  `Worst ADR Week` match after UI rounding.
- Screenshot proof is saved under `app/releases/v2/screenshots/` and linked
  from the symbol research note or Gate 33 handoff.

Mark FAIL when:

- The chart is on the wrong symbol/feed.
- Rows are missing.
- W/L differs.
- Raw or ADR-normalized totals differ beyond displayed rounding.

Do not patch Pine from a failed screenshot until the symbol/feed and receipt
input are confirmed.

## Known Dirty Tree At Handoff

Expected modified/untracked Gate 33 files include:

- `app/scripts/pinescript/limni-adr-verifier.pine`
- `docs/backlog/CURRENT_WORK.md`
- `package.json`
- `app/scripts/verification/export-weekly-hold-runback.ts`
- `docs/research/WEEKLY_HOLD_ENGINE_PARITY_AUDCAD_2026-06-13.md`
- `docs/research/GATE33_WEEKLY_HOLD_PARITY_HANDOFF_2026-06-13.md`
- `app/releases/v2/screenshots/tradingview-parity-2026-06-13/README.md`
- `app/releases/v2/screenshots/tradingview-parity-2026-06-13/audcad-weekly-hold-dealer-runback-dd-pass-manual-2026-06-13.png`
- `app/releases/v2/screenshots/tradingview-parity-2026-06-13/eurusd-weekly-hold-dealer-runback-dd-pass-manual-2026-06-13.png`
- `app/releases/v2/screenshots/tradingview-parity-2026-06-13/gbpusd-weekly-hold-dealer-runback-dd-pass-manual-2026-06-13.png`
- `app/releases/v2/screenshots/tradingview-parity-2026-06-13/nzdusd-weekly-hold-dealer-runback-dd-pass-manual-2026-06-13.png`
- `app/releases/v2/screenshots/tradingview-parity-2026-06-13/usdchf-weekly-hold-dealer-runback-dd-pass-manual-2026-06-13.png`
- `app/releases/v2/screenshots/tradingview-parity-2026-06-13/usdjpy-weekly-hold-dealer-runback-dd-pass-manual-2026-06-13.png`
- `app/reports/data-verification/weekly-hold-runback/audcad-dealer-weekly-hold-23w-20260613-211757.*`
- `app/reports/data-verification/weekly-hold-runback/audcad-dealer-weekly-hold-23w-20260613-170715.*`
- `docs/research/WEEKLY_HOLD_ENGINE_PARITY_EURUSD_2026-06-13.md`
- `app/reports/data-verification/weekly-hold-runback/eurusd-dealer-weekly-hold-23w-20260613-213922.*`
- `docs/research/WEEKLY_HOLD_ENGINE_PARITY_GBPUSD_2026-06-13.md`
- `app/reports/data-verification/weekly-hold-runback/gbpusd-dealer-weekly-hold-23w-20260613-215954.*`
- `docs/research/WEEKLY_HOLD_ENGINE_PARITY_USDJPY_2026-06-13.md`
- `app/reports/data-verification/weekly-hold-runback/usdjpy-dealer-weekly-hold-23w-20260613-220216.*`
- `docs/research/WEEKLY_HOLD_ENGINE_PARITY_USDCHF_2026-06-13.md`
- `app/reports/data-verification/weekly-hold-runback/usdchf-dealer-weekly-hold-23w-20260613-220439.*`
- `docs/research/WEEKLY_HOLD_ENGINE_PARITY_NZDUSD_2026-06-13.md`
- `app/reports/data-verification/weekly-hold-runback/nzdusd-dealer-weekly-hold-23w-20260613-220648.*`

JSON receipt files may be ignored by `.gitignore`; keep that in mind when
checking `git status`.
