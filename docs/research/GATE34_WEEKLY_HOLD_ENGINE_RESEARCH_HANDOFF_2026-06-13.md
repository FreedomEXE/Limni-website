# Gate 34 Weekly Hold Engine Research Handoff

Date: 2026-06-13
Last updated: 2026-06-14

Gate: Gate 34 weekly-hold-engine-research

## Current Decision

Gate 34 has a useful first research pass, but the exact Weekly Hold TP/SL band
is not promoted.

The safe conclusion is:

- Dealer remains the only source under test.
- Weekly Hold is being treated as an execution layer on top of Dealer direction.
- Fixed market-week ADR TP/SL bands look materially better than blind week-close
  hold in the current 28-pair, 23-week sample.
- The exact TP/SL setting is undecided until broader and risk-adjusted tests
  are run.
- Do not promote the return-maximizing sweep result as a final rule. It is
  in-sample and may be curve-fit.
- The 2025 CFTC shutdown pass is complete enough for Gate 34: shutdown-affected
  source report dates are excluded from research, clean pre-shutdown 2025 path
  coverage has been restored for FX, and the 39-week clean 2025 result has been
  stitched with the current 23-week 2026 result into a 62-week Dealer baseline.
- ADR correction on 2026-06-14: the first 2024/2025 receipts were missing
  daily ADR bars and used the FX default ADR. Daily FX ADR bars were materialized
  from canonical 1H bars and the 2024, clean 2025, current 2026, and stitched
  2025+2026 receipts were rerun.
- 2024 still blocks final Dealer-only promotion after the ADR correction.
  Week-close and all broad fixed-band rows failed. The failure is concentrated
  in the `direct_opposed_bias` Dealer rule; neutral directional-ratio rows were
  slightly positive in 2024. Smaller-stop variants from the first pass are
  default-ADR history only; rerun them after the daily ADR fill if they matter
  later.
- Saved baseline note:
  `docs/research/GATE34_DEALER_WEEKLY_HOLD_BASELINE_2025_2026_2026-06-14.md`.
- 2024 result note:
  `docs/research/GATE34_DEALER_WEEKLY_HOLD_2024_RESULT_2026-06-14.md`.
- Corrected audit note:
  `docs/research/GATE34_DEALER_WEEKLY_HOLD_2024_2026_AUDIT_2026-06-14.md`.

## Tested Rule

The current fixed-band research uses the institutional market-week anchor:

- Market-week anchor starts at Sunday 17:00 New York time.
- Limni still executes at the normal Weekly Hold execution entry.
- If the hypothetical TP or SL is touched before execution, the trade is skipped
  as pre-entry invalidated.
- Running high/low starts from the first actual market bar open in the
  market-week anchor window, not from the later execution entry.
- Exits are only allowed after Limni's execution entry.
- If TP and SL are both touched in the same 1H bar, the receipt uses the worse
  exit for that trade.

Fixed-band math:

- Long TP: running weekly low plus `TP * ADR`.
- Long SL: running weekly high minus `SL * ADR`.
- Short TP: running weekly high minus `TP * ADR`.
- Short SL: running weekly low plus `SL * ADR`.

## Evidence

Corrected ADR/source/price audit:

- `docs/research/GATE34_DEALER_WEEKLY_HOLD_2024_2026_AUDIT_2026-06-14.md`
- JSON:
  `app/reports/data-verification/weekly-hold-audit/dealer-weekly-hold-2024-2026-audit-20260614.json`
- Daily ADR fill receipt:
  `app/reports/data-verification/weekly-hold-audit/fx-daily-adr-bars-from-hourly-20260614-180239.json`

Corrected rerun receipts after daily ADR fill:

- 2026 week-close:
  `app/reports/data-verification/weekly-hold-basket-baseline/fx-28pair-dealer-weekly-hold-baseline-23w-20260614-180424.md`
- 2026 fixed-band:
  `app/reports/data-verification/weekly-hold-exit-sweep/fx-28pair-dealer-weekly-hold-fixed-band-sweep-23w-20260614-180610.md`
- Clean 2025 week-close:
  `app/reports/data-verification/weekly-hold-basket-baseline/fx-28pair-dealer-weekly-hold-baseline-39w-20260614-181048.md`
- Clean 2025 fixed-band:
  `app/reports/data-verification/weekly-hold-exit-sweep/fx-28pair-dealer-weekly-hold-fixed-band-sweep-39w-20260614-181610.md`
- 2024 week-close:
  `app/reports/data-verification/weekly-hold-basket-baseline/fx-28pair-dealer-weekly-hold-baseline-52w-20260614-182222.md`
- 2024 fixed-band:
  `app/reports/data-verification/weekly-hold-exit-sweep/fx-28pair-dealer-weekly-hold-fixed-band-sweep-52w-20260614-182928.md`
- Corrected 2025+2026 stitched week-close:
  `app/reports/data-verification/weekly-hold-basket-baseline/fx-28pair-dealer-weekly-hold-baseline-62w-20260614-184050.md`
- Corrected 2025+2026 stitched fixed-band:
  `app/reports/data-verification/weekly-hold-exit-sweep/fx-28pair-dealer-weekly-hold-fixed-band-sweep-62w-20260614-184722.md`

Baseline 28-pair Dealer Weekly Hold receipt:

- `app/reports/data-verification/weekly-hold-basket-baseline/fx-28pair-dealer-weekly-hold-baseline-23w-20260614-015230.md`

Baseline stats:

- Window: displayed weeks `2026-01-06` through `2026-06-08`
- Pairs: 28
- Pair-week trades: 644
- Weekly W/L/F: 17/6/0
- Weekly win rate: 73.91%
- Total raw: +50.38%
- ADR normalized: +73.89%
- Weekly raw PF: 2.90
- Weekly ADR PF: 2.56
- Trade PF raw/ADR: 1.28/1.26
- ADR adverse DD: 29.25%
- ADR giveback: 16.93%

Important fixed-band receipts:

- First corrected market-week grid:
  `app/reports/data-verification/weekly-hold-exit-sweep/fx-28pair-dealer-weekly-hold-fixed-band-sweep-23w-20260614-033832.md`
- Fine local grid around the return leader:
  `app/reports/data-verification/weekly-hold-exit-sweep/fx-28pair-dealer-weekly-hold-fixed-band-sweep-23w-20260614-034454.md`
- Shutdown-aware normalized stitch receipt:
  `app/reports/data-verification/weekly-hold-exit-sweep/fx-28pair-dealer-weekly-hold-fixed-band-sweep-23w-20260614-041301.md`
- Clean 2025 shutdown-excluded receipt:
  `app/reports/data-verification/weekly-hold-exit-sweep/fx-28pair-dealer-weekly-hold-fixed-band-sweep-39w-20260614-060417.md`
- Clean 2025 week-close receipt:
  `app/reports/data-verification/weekly-hold-basket-baseline/fx-28pair-dealer-weekly-hold-baseline-39w-20260614-055715.md`
- Clean 2025 plus current 2026 stitched baseline:
  `app/reports/data-verification/weekly-hold-basket-baseline/fx-28pair-dealer-weekly-hold-baseline-62w-20260614-061144.md`
- Clean 2025 plus current 2026 stitched fixed-band sweep:
  `app/reports/data-verification/weekly-hold-exit-sweep/fx-28pair-dealer-weekly-hold-fixed-band-sweep-62w-20260614-061938.md`
- 2024 week-close receipt:
  `app/reports/data-verification/weekly-hold-basket-baseline/fx-28pair-dealer-weekly-hold-baseline-52w-20260614-145803.md`
- 2024 broad fixed-band receipt:
  `app/reports/data-verification/weekly-hold-exit-sweep/fx-28pair-dealer-weekly-hold-fixed-band-sweep-52w-20260614-150632.md`
- 2024 tight-stop check receipt:
  `app/reports/data-verification/weekly-hold-exit-sweep/fx-28pair-dealer-weekly-hold-fixed-band-sweep-52w-20260614-151458.md`
- Backward coverage probe receipt:
  `app/reports/data-verification/weekly-hold-exit-sweep/fx-28pair-dealer-weekly-hold-fixed-band-sweep-0w-20260614-041316.md`

Representative rows:

Note: the table below is retained as first-pass history. For current decisions,
use the corrected audit and rerun receipts listed above.

| Variant | Raw | ADR Norm | Weekly W/L/F | Weekly ADR PF | Trade PF Raw/ADR | ADR Adv DD | ADR Giveback |
|---|---:|---:|---:|---:|---:|---:|---:|
| Week Close | +50.38% | +73.89% | 17/6/0 | 2.56 | 1.28/1.26 | 29.25% | 16.93% |
| Market TP 1.0x / SL 2.0x | +47.84% | +72.92% | 19/4/0 | 6.00 | 1.44/1.45 | 12.91% | 1.73% |
| Market TP 1.6x / SL 2.45x | +64.60% | +98.81% | 18/5/0 | 7.45 | 1.41/1.42 | 14.37% | 6.71% |

Read this table carefully:

- `1.0 / 2.0` is the cleaner simple candidate: higher weekly win rate than
  week close, sharply lower drawdown, strong PF, and low giveback.
- `1.6 / 2.45` is the current return leader in this sample, but it has lower
  weekly win rate than `1.0 / 2.0`, higher drawdown, more giveback, and weaker
  trade-level PF than the simple candidate.
- Return-maximizing on this one 23-week sample is not enough, especially because
  wider TP bands change the unnormalized reward profile.

## Sizing And Metrics Caveat

Do not choose the rule by headline return alone.

The next test needs normalized comparison columns because a wider TP can inflate
raw return without proving better risk-adjusted quality. Add or compute:

- TP-normalized return
- SL/risk-normalized return
- weekly and trade-level profit factor
- expectancy per trade
- weekly return stability / Sharpe-style score
- adverse DD per unit of return
- peak giveback per unit of return

The open question is not "which band made the most money in this short window."
The better question is "which simple band stays profitable with stable PF,
acceptable DD, and robust behavior across broader windows."

The 2026 shutdown-aware stitch receipt now includes these normalized columns:

- TP-normalized ADR return
- SL/risk-normalized ADR return
- trade raw/ADR expectancy
- weekly ADR mean, standard deviation, and Sharpe-style score
- adverse DD per unit ADR return
- giveback per unit ADR return

Key normalized read from the `20260614-041301` receipt:

- `TP 1.0x / SL 2.0x`: ADR +72.92%, weekly ADR PF 6.00, trade ADR PF 1.45,
  trade ADR expectancy +0.1132%, Sharpe-style 3.60, TP-normalized 72.92,
  SL-normalized 36.46, DD/return 0.18, giveback/return 0.02.
- `TP 1.6x / SL 2.45x`: ADR +98.81%, weekly ADR PF 7.45, trade ADR PF 1.42,
  trade ADR expectancy +0.1534%, Sharpe-style 3.92, TP-normalized 61.76,
  SL-normalized 40.33, DD/return 0.15, giveback/return 0.07.
- `TP 1.6x / SL 2.25x`: ADR +94.86%, weekly ADR PF 8.26, trade ADR PF 1.39,
  trade ADR expectancy +0.1473%, Sharpe-style 3.96, TP-normalized 59.29,
  SL-normalized 42.16, DD/return 0.15, giveback/return 0.06.

The wider `1.6` bands still remain in-sample. Do not promote them until broader
source/path coverage exists and later indicator parity can confirm the behavior.

## 2025 Shutdown Source Decision

Official CFTC notices show that COT publication was interrupted by the 2025
government shutdown, then published in catch-up order after operations resumed.
The accelerated CFTC schedule lists interrupted COT report dates from
`2025-09-30` through `2025-12-23`, with normal schedule restored at the
`2025-12-23` report on `2025-12-29`.

Gate 34 research decision:

- Exclude source report dates `2025-09-30` through `2025-12-23` inclusive from
  clean optimization research.
- In displayed Weekly Hold week labels, that maps approximately to
  `2025-10-06` through `2025-12-30` inclusive.
- Current historical `cot_snapshots` rows are backfilled, so the local DB now
  contains the shutdown dates. They should not be treated as normally available
  live source truth.
- The current Weekly Hold research/runtime source path uses
  `basketSource.ts` and exact `deriveCotReportDate(weekOpenUtc)` snapshot reads.
  It does not intentionally carry stale Dealer rows through shutdown weeks.
- The older `performanceRefresh.ts` snapshot helper can choose the latest
  snapshot on or before a target report date. Treat that as a legacy carry
  path, not as Gate 34 Weekly Hold research truth.
- For research receipts, prefer exclusion. A live-simulation variant may model
  pause/no-trade separately, but do not mix it into pure optimization stats
  without labeling it.

Local coverage result after the 2025 backfill:

- Clean 2025 pre-shutdown FX coverage is complete for displayed weeks
  `2025-01-06` through `2025-09-29`.
- `pair_period_returns` has 1,092 FX weekly rows for `canonical` and 1,092 for
  `execution` across 28 pairs and 39 weeks.
- The stitched Dealer baseline uses exactly 62 weeks: 39 clean 2025 weeks plus
  the current 23-week 2026 result.
- 2024 FX coverage is also receipt-backed for 52 tradable displayed weeks,
  `2024-01-09` through `2024-12-31`. The displayed week `2024-01-02` was
  excluded because the `2024-01-01` New Year holiday had no exact FX open bar
  across all 28 pairs.
- The backward probe toward 2019 still remains coverage-gated unless source and
  path coverage are restored and receipt-backed for those older weeks.

## Recommended Next Chat

Use this continuation:

```text
Continue Limni / Poseidon in C:\Users\User\Documents\GitHub\limni-website.

Read recovery first:
1. C:\Users\User\Documents\GitHub\freedom-ops\.codex\CODEX_SESSION.md
2. C:\Users\User\Documents\GitHub\freedom-ops\.codex\CODEX_CKB.md
3. AGENTS.md
4. docs/backlog/CURRENT_WORK.md
5. docs/research/GATE34_WEEKLY_HOLD_ENGINE_RESEARCH_HANDOFF_2026-06-13.md
6. docs/BACKTEST_CANONICAL_PROTOCOL.md

Continue Gate 34: weekly-hold-engine-research.

Current conclusion:
- Dealer-only Weekly Hold fixed market-week TP/SL bands look better than blind
  week-close hold.
- Exact TP/SL is undecided.
- Do not promote the 1.6 / 2.45 return leader yet; it may be curve-fit and needs
  sizing-normalized, risk-adjusted, broader-window proof.
- 1.0 / 2.0 remains the cleaner simple candidate.
- 2025 shutdown-affected COT source report dates are excluded from clean
  research: 2025-09-30 through 2025-12-23 inclusive.
- Clean pre-shutdown 2025 FX coverage has been restored and tested for displayed
  weeks 2025-01-06 through 2025-09-29.
- A saved 62-week Dealer-only baseline now stitches clean 2025 with the current
  2026 23-week result:
  docs/research/GATE34_DEALER_WEEKLY_HOLD_BASELINE_2025_2026_2026-06-14.md.
- 2024 is a required failure window. Week-close was ADR `-205.99%`, weekly ADR
  PF `0.47`, ADR DD `211.62%`; the least-bad broad fixed-band row was
  `TP 1.0x / SL 1.5x` at ADR `-60.94%`.
- Backward-to-2019 testing remains source/path coverage-gated.

Next task:
Continue broader Dealer Weekly Hold research only where source/path coverage is
receipt-backed:
1. Use the saved 2025+2026 Dealer baseline plus the 2024 failure receipt as
   benchmarks for later source comparisons.
2. Do not promote final TP/SL from Dealer-only results until 2024 behavior is
   fixed or filtered.
3. Continue backward toward 2019 only if source/path coverage supports it.
4. Compare fixed-band candidates using risk-adjusted and sizing-normalized
   metrics, not headline return alone.

Frozen scope:
- Dealer source only.
- No Commercial/Sentiment/Strength source research yet.
- No ADR Grid parity.
- No Pair Fill Cap or risk-overlay redesign.
- No release canon work.
- No final TP/SL promotion until broader receipts and later indicator parity.
```

## Verification Already Run

After adding the fixed-band exporter and market-week anchor correction:

```powershell
npx tsc --noEmit --project app/tsconfig.json --pretty false
npm test -- app/src/lib/__tests__/weeklyHoldEngineAdrGrid.test.ts app/src/lib/__tests__/basketPathEngine.test.ts
git diff --check
npm run verification:export-weekly-hold-fixed-band-sweep -- --from=2025-01-01 --to=2025-12-31 --exclude-source-report-from=2025-09-30 --exclude-source-report-to=2025-12-23 --anchor-modes=market_week --tp-multiples=1,1.2,1.4,1.6 --sl-multiples=1.5,2,2.25,2.45
npm run verification:export-weekly-hold-fixed-band-sweep -- --from=2025-01-01 --to=2026-06-08 --exclude-source-report-from=2025-09-30 --exclude-source-report-to=2025-12-23 --anchor-modes=market_week --tp-multiples=1,1.2,1.4,1.6 --sl-multiples=1.5,2,2.25,2.45
npm run verification:export-weekly-hold-fixed-band-sweep -- --from=2019-01-01 --to=2025-09-29 --exclude-source-report-from=2025-09-30 --exclude-source-report-to=2025-12-23 --anchor-modes=market_week --tp-multiples=1,1.2,1.4,1.6 --sl-multiples=1.5,2,2.25,2.45
```

Results now superseded by the 2025 backfill and stitched baseline:

- TypeScript passed before the first Gate 34 fixed-band receipts.
- Focused Vitest suite passed: 12/12 tests.
- `git diff --check` passed before the first Gate 34 handoff update.
- Clean 2025 FX path coverage was restored for 39 displayed weeks,
  `2025-01-06` through `2025-09-29`.
- Clean 2025 week-close receipt selected 39 weeks and 1,092 Dealer trades:
  ADR-normalized return `-18.57%`, weekly ADR PF `0.92`.
- Clean 2025 fixed-band receipt selected 39 weeks; fixed market-week ADR bands
  turned the same Dealer directions positive when SL was at least `2.0x`.
- Stitched 2025+2026 baseline selected exactly 62 weeks: 39 clean 2025 weeks
  plus 23 current 2026 weeks.
- Stitched week-close baseline: ADR-normalized return `+55.32%`, weekly ADR PF
  `1.20`, ADR adverse DD `73.97%`.
- Stitched fixed-band sweep: all tested SL-at-least-2.0 market-week variants
  beat week-close on risk-adjusted normalized metrics. See
  `docs/research/GATE34_DEALER_WEEKLY_HOLD_BASELINE_2025_2026_2026-06-14.md`.
- Backward probe toward 2019 remains source/path coverage-gated.

## Dirty Tree Notes

Expected dirty work includes Gate 33 parity receipts/screenshots, Gate 34
research exporters/receipts, `package.json` verification scripts, and hot-state
docs. Do not mistake generated JSON receipts for release canon.
