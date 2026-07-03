# Gate 90D 2019 Open Bad-Cycle Origin And Trailing Research

Generated: 2026-07-03

## Verdict

`PASS_GATE90D_BAD_CYCLE_ORIGIN_VISIBLE_TRAILING_IS_SEGMENT_TOOL_NO_PROMOTION`

This pass did not run a new replay. It reads the existing 2019 open-price
no-Candidate-B close-event ledger and classifies each closed side-cycle by
excursion behavior.

The useful institutional framing is **MFE/MAE excursion capture**:

- MFE: Maximum Favorable Excursion, the best profit the cycle offered.
- MAE: Maximum Adverse Excursion, the worst pain the cycle took.
- Capture ratio: realized ADR divided by MFE ADR.
- Giveback: MFE ADR minus realized ADR.

Plain read: a trailing stop can only help the trades that first had enough MFE
to activate. If a losing cycle never reaches `1Q` MFE, the fix is start
quality, pair/side avoidance, heat control, or ugly-cycle protection. It is not
a trailing stop.

## Scope

- Source close events:
  `docs/research/gates/gate90/artifacts/gate90d-2019-open-live-state-strict-no-candidate-b/close-events.rows.csv`
- Rows scanned: `454`
- Rows included: `454`
- Return convention: ADR-normalized percent, where `1 ADR = 1%`.
- Account percent remains costed USD/equity truth against `10000`.

No MT5/live/app work, promotion, red-news implementation, 2020/year-by-year
expansion, full matrix restart, or full seven-pair handshake gate was opened.

## Variant Read

| rule | protection | cycles | ADR % | Acct % | PF | Win % | Avg ADR | Avg MFE | Avg MAE | Capture | MFE 1Q % | Trail-able losses | No-trail losses |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| triangle_v0_no_candidate_b | baseline | 454 | 25.29494 | 1.174326 | 1.229681 | 79.295154 | 0.055716 | 0.277514 | 0.40706 | 0.200767 | 46.9163 | 13 | 78 |

## Strict Katarakti Baseline Origin

| origin | cycles | losses | ADR % | Acct % | PF | Avg ADR | Avg MFE | Avg MAE | Giveback | MFE 1Q % | Trail-able | No-trail | Trail 1Q ADR |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| target_captured | 318 | 3 | 100.155172 | 5.790056 | 1162.111387 | 0.314953 | 0.323279 | 0.223981 | 0.008325 | 57.861635 | 0 | 0 | 0.017591 |
| eod_green_leftover | 47 | 5 | 7.310743 | 0.464088 | 66.686629 | 0.155548 | 0.220105 | 0.145741 | 0.064558 | 27.659574 | 0 | 5 | 0 |
| ugly_no_profit | 33 | 33 | -70.03746 | -4.376815 | 0 | -2.122347 | 0.101449 | 2.62129 | 2.223796 | 0 | 0 | 33 | 0 |
| small_red_no_profit | 27 | 27 | -2.261231 | -0.185196 | 0 | -0.083749 | 0.100782 | 0.165854 | 0.184531 | 0 | 0 | 27 | 0 |
| adverse_no_profit | 13 | 13 | -2.94948 | -0.170617 | 0 | -0.226883 | 0.107562 | 0.332495 | 0.334445 | 0 | 0 | 13 | 0 |
| green_to_red_giveback | 12 | 12 | -7.133439 | -0.368115 | 0 | -0.594453 | 0.341315 | 0.909834 | 0.935768 | 100 | 12 | 0 | 8.298928 |
| green_profit_leak | 4 | 1 | 0.210635 | 0.020925 | 354.588712 | 0.052659 | 0.320215 | 0.127097 | 0.267557 | 100 | 1 | 0 | 0.23881 |

## Strict Live-State Order

| state | cycles | losses | ADR % | Acct % | PF | Avg ADR | Avg MFE | Avg MAE | Giveback | MFE 1Q % | Trail-able | No-trail |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| profit_1q_before_pain_1q | 154 | 8 | 51.065139 | 3.335909 | 16.290198 | 0.331592 | 0.384887 | 0.098949 | 0.053295 | 100 | 8 | 0 |
| profit_0_5q_only | 140 | 9 | 23.458938 | 1.287798 | 22.375418 | 0.167564 | 0.196705 | 0.073548 | 0.029141 | 0 | 0 | 9 |
| pain_2q_before_profit_0_5q | 45 | 28 | -41.665342 | -3.181872 | 0.07117 | -0.925896 | 0.204265 | 1.967583 | 1.130162 | 24.444444 | 1 | 26 |
| pain_1q_before_profit_0_5q | 41 | 13 | 9.634019 | 0.486362 | 4.101223 | 0.234976 | 0.3692 | 0.532417 | 0.134224 | 68.292683 | 3 | 9 |
| pain_1q_before_profit_1q | 38 | 14 | -16.75738 | -0.701373 | 0.375537 | -0.440984 | 0.309716 | 1.157078 | 0.7507 | 52.631579 | 1 | 12 |
| inside_1q | 36 | 22 | -0.440434 | -0.052497 | 0.592306 | -0.012234 | 0.085606 | 0.136981 | 0.09784 | 0 | 0 | 22 |

## Strict Protected-Flatten Origin

| origin | cycles | losses | ADR % | Acct % | PF | Avg ADR | Avg MFE | Avg MAE | Giveback | MFE 1Q % | Trail-able | No-trail | Trail 1Q ADR |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|

## Standalone David Baseline Origin

| origin | cycles | losses | ADR % | Acct % | PF | Avg ADR | Avg MFE | Avg MAE | Giveback | MFE 1Q % | Trail-able | No-trail | Trail 1Q ADR |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|

## Strict Worst Pair-Side Origins

| pair | side | origin | cycles | ADR % | Acct % | Avg MFE | Avg MAE | Trail-able | No-trail |
|---|---|---|---|---|---|---|---|---|---|
| GBPJPY | SHORT | ugly_no_profit | 1 | -9.727663 | -0.839835 | 0.086786 | 11.102352 | 0 | 1 |
| AUDJPY | LONG | ugly_no_profit | 2 | -16.694905 | -0.613814 | 0.174407 | 8.990286 | 0 | 2 |
| GBPNZD | SHORT | ugly_no_profit | 3 | -5.798424 | -0.581909 | 0.080217 | 2.502279 | 0 | 3 |
| GBPUSD | SHORT | ugly_no_profit | 1 | -5.442426 | -0.480589 | 0.067986 | 6.866177 | 0 | 1 |
| EURGBP | LONG | ugly_no_profit | 1 | -7.069248 | -0.472923 | 0 | 8.499846 | 0 | 1 |
| EURUSD | SHORT | ugly_no_profit | 3 | -3.790032 | -0.182782 | 0.114023 | 1.947548 | 0 | 3 |
| EURJPY | LONG | ugly_no_profit | 1 | -2.821283 | -0.148378 | 0.007248 | 3.502799 | 0 | 1 |
| GBPCHF | SHORT | ugly_no_profit | 1 | -2.025588 | -0.147737 | 0.204035 | 2.025588 | 0 | 1 |
| USDCHF | SHORT | ugly_no_profit | 1 | -4.010184 | -0.131729 | 0.117099 | 4.434462 | 0 | 1 |
| GBPCAD | SHORT | ugly_no_profit | 2 | -1.403622 | -0.127982 | 0.060187 | 0.701811 | 0 | 2 |
| AUDUSD | SHORT | green_to_red_giveback | 1 | -2.652344 | -0.124544 | 0.239105 | 3.216337 | 1 | 0 |
| GBPJPY | LONG | ugly_no_profit | 1 | -1.450825 | -0.124135 | 0 | 1.450825 | 0 | 1 |

## Strict Worst Start-Date Origins

| start ET | origin | cycles | losses | ADR % | Acct % | Avg MFE | Avg MAE | Trail-able | No-trail |
|---|---|---|---|---|---|---|---|---|---|
| 2019-10-10 | ugly_no_profit | 4 | 4 | -26.513552 | -2.180024 | 0.04417 | 7.824848 | 0 | 4 |
| 2019-08-01 | ugly_no_profit | 4 | 4 | -20.956939 | -0.876675 | 0.120054 | 5.646786 | 0 | 4 |
| 2019-10-15 | ugly_no_profit | 1 | 1 | -1.410919 | -0.18463 | 0.143766 | 1.6694 | 0 | 1 |
| 2019-05-03 | ugly_no_profit | 1 | 1 | -2.025588 | -0.147737 | 0.204035 | 2.025588 | 0 | 1 |
| 2019-04-18 | ugly_no_profit | 1 | 1 | -4.010184 | -0.131729 | 0.117099 | 4.434462 | 0 | 1 |
| 2019-07-17 | green_to_red_giveback | 1 | 1 | -2.652344 | -0.124544 | 0.239105 | 3.216337 | 1 | 0 |
| 2019-06-21 | ugly_no_profit | 1 | 1 | -1.523041 | -0.092763 | 0.097469 | 1.523041 | 0 | 1 |
| 2019-12-12 | ugly_no_profit | 2 | 2 | -1.933863 | -0.087392 | 0.147527 | 1.174206 | 0 | 2 |
| 2019-06-03 | ugly_no_profit | 1 | 1 | -1.660132 | -0.085536 | 0.074394 | 3.104112 | 0 | 1 |
| 2019-08-27 | ugly_no_profit | 1 | 1 | -0.716347 | -0.082345 | 0.120373 | 0.716347 | 0 | 1 |
| 2019-04-23 | green_to_red_giveback | 1 | 1 | -1.700751 | -0.076753 | 0.496119 | 2.718464 | 1 | 0 |
| 2019-04-24 | ugly_no_profit | 2 | 2 | -1.316915 | -0.065059 | 0.074664 | 2.201328 | 0 | 2 |

## Decision Read

The previous protection sweep already showed that global `1Q` trailing and
protected flatten reduce or reshuffle return rather than fixing the strict
baseline. This classifier explains why: trailing is only relevant to the
`green_to_red_giveback` bucket. It cannot help the no-profit buckets because
those cycles never earned the right to activate the trail.

For strict no-Candidate-B, the next v1 shape should therefore split exits:

1. **Target close:** keep normal MA-reversion close for ordinary captured wins.
2. **Giveback candidate:** only consider trailing/lock rules when MFE reaches
   `1Q` or better.
3. **No-profit adverse bucket:** fix entry quality, pair/side eligibility, or
   heat before adding risk.
4. **Ugly no-profit bucket:** this is protection/no-start territory, not a
   profit trail.
5. **Katarakti premium class:** can still earn larger targets, but only when
   excursion evidence says it offers enough MFE.

Plain monkey version:

- A trail can protect food that is already on the table.
- If the trade never put food on the table, the trail has nothing to protect.
- So do not hunt for one magic trailing stop.
- First separate: bad start, good start that gave back, and premium start that
  deserves a bigger target.

## Runner Caveat

This is an artifact-derived diagnostic. Existing close-event rows have MFE/MAE
amounts, and newer ledgers also include first profit/pain quantum timestamps.
The theoretical trail-improvement columns are still **upper-bound evidence**,
not a replayed promise. A final trail rule still needs targeted replay before
freeze.

Key strict references from this run:

- Strict green-to-red bucket:
  `12 cycles, -7.133439% ADR, 12 trail-addressable losses`.
- Strict no-profit bucket:
  `ugly_no_profit, 33 cycles, -70.03746% ADR, 33 no-trail losses`.
- Strict live profit-first bucket:
  `154 cycles, 51.065139% ADR, 8 losses`.
- Strict live pain-first bucket:
  `pain_2q_before_profit_0_5q, 45 cycles, -41.665342% ADR, 28 losses`.

## Artifacts

- Variant summary:
  `docs/research/gates/gate90/artifacts/gate90d-2019-open-live-state-excursion-diagnostic/cycle-origin-variant-summary.rows.json`
- Origin summary:
  `docs/research/gates/gate90/artifacts/gate90d-2019-open-live-state-excursion-diagnostic/cycle-origin-summary.rows.json`
- Live-state summary:
  `docs/research/gates/gate90/artifacts/gate90d-2019-open-live-state-excursion-diagnostic/cycle-live-state-summary.rows.json`
- Pair-side origin summary:
  `docs/research/gates/gate90/artifacts/gate90d-2019-open-live-state-excursion-diagnostic/cycle-origin-pair-side.rows.json`
- Close-reason summary:
  `docs/research/gates/gate90/artifacts/gate90d-2019-open-live-state-excursion-diagnostic/cycle-origin-close-reason.rows.json`
- Start-date origin summary:
  `docs/research/gates/gate90/artifacts/gate90d-2019-open-live-state-excursion-diagnostic/cycle-origin-start-date.rows.json`
- SHA receipt:
  `docs/research/gates/gate90/artifacts/gate90d-2019-open-live-state-excursion-diagnostic/gate90d-bad-cycle-origin-sha256.txt`

## Stop Line

Research-only. This does not freeze trailing stops, promote Triangle v1, or open
MT5/live/app work.
