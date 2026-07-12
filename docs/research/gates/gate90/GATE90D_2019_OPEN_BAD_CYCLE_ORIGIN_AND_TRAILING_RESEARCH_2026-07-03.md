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
  `docs/research/gates/gate90/artifacts/gate90d-2019-open-protection-sweep-no-candidate-b/close-events.rows.csv`
- Rows scanned: `162440`
- Rows included: `106252`
- Return convention: ADR-normalized percent, where `1 ADR = 1%`.
- Account percent remains costed USD/equity truth against `10000`.

No MT5/live/app work, promotion, red-news implementation, 2020/year-by-year
expansion, full matrix restart, or full seven-pair handshake gate was opened.

## Variant Read

| rule | protection | cycles | ADR % | Acct % | PF | Win % | Avg ADR | Avg MFE | Avg MAE | Capture | MFE 1Q % | Trail-able losses | No-trail losses |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| david_contra | baseline | 13257 | 392.371928 | 9.301286 | 1.074854 | 83.804782 | 0.029597 | 0.201379 | 0.466685 | 0.146973 | 30.014332 | 296 | 1662 |
| david_contra | lock_1q_stop_adds | 13164 | 346.799001 | 7.433603 | 1.061162 | 83.08265 | 0.026345 | 0.198637 | 0.448361 | 0.132626 | 29.990884 | 359 | 1654 |
| triangle_v0_no_candidate_b | baseline | 454 | 25.29494 | 1.174326 | 1.229681 | 79.295154 | 0.055716 | 0.277514 | 0.40706 | 0.200767 | 46.9163 | 13 | 78 |
| triangle_v0_no_candidate_b | protected_flatten_1q | 452 | 25.91911 | 1.025928 | 1.196267 | 84.070796 | 0.057343 | 0.280038 | 0.42846 | 0.204769 | 47.787611 | 12 | 55 |
| triangle_v0_no_candidate_b | trail_1q_0_5q | 518 | 22.957795 | 0.976382 | 1.189562 | 81.081081 | 0.04432 | 0.258566 | 0.365279 | 0.171407 | 45.945946 | 6 | 90 |
| triangle_v1_david_contra_extension | baseline | 12363 | 177.43224 | -0.736576 | 0.984393 | 62.703227 | 0.014352 | 0.084869 | 0.204106 | 0.169107 | 9.123999 | 76 | 987 |

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

## Strict Protected-Flatten Origin

| origin | cycles | losses | ADR % | Acct % | PF | Avg ADR | Avg MFE | Avg MAE | Giveback | MFE 1Q % | Trail-able | No-trail | Trail 1Q ADR |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| target_captured | 333 | 5 | 101.102208 | 5.805116 | 929.769543 | 0.30361 | 0.317515 | 0.236516 | 0.013904 | 56.756757 | 0 | 0 | 0.268207 |
| eod_green_leftover | 65 | 16 | 7.264259 | 0.407337 | 31.315496 | 0.111758 | 0.178897 | 0.194272 | 0.067139 | 18.461538 | 0 | 16 | 0 |
| ugly_no_profit | 31 | 31 | -75.271119 | -4.746392 | 0 | -2.428101 | 0.102047 | 2.952178 | 2.530147 | 0 | 0 | 31 | 0 |
| green_to_red_giveback | 9 | 9 | -4.975875 | -0.323668 | 0 | -0.552875 | 0.351644 | 0.840485 | 0.904519 | 100 | 9 | 0 | 5.95093 |
| adverse_no_profit | 8 | 8 | -2.427479 | -0.136767 | 0 | -0.303435 | 0.113248 | 0.316259 | 0.416682 | 0 | 0 | 8 | 0 |
| green_profit_leak | 6 | 3 | 0.227116 | 0.020302 | 30.760129 | 0.037853 | 0.330368 | 0.110781 | 0.292515 | 100 | 3 | 0 | 0.3719 |

## Standalone David Baseline Origin

| origin | cycles | losses | ADR % | Acct % | PF | Avg ADR | Avg MFE | Avg MAE | Giveback | MFE 1Q % | Trail-able | No-trail | Trail 1Q ADR |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| target_captured | 10798 | 189 | 2261.854742 | 126.722261 | 303.067032 | 0.20947 | 0.215571 | 0.285432 | 0.006101 | 31.84849 | 0 | 0 | 9.402134 |
| ugly_no_profit | 1007 | 1007 | -1587.359756 | -96.936671 | 0 | -1.576325 | 0.068588 | 2.295596 | 1.644913 | 0 | 0 | 1007 | 0 |
| eod_green_leftover | 498 | 60 | 100.857798 | 6.015801 | 127.497442 | 0.202526 | 0.237461 | 0.26919 | 0.034935 | 36.746988 | 2 | 58 | 0.131267 |
| small_red_no_profit | 384 | 384 | -26.338092 | -2.04291 | 0 | -0.068589 | 0.053461 | 0.116842 | 0.12205 | 0 | 0 | 384 | 0 |
| green_to_red_giveback | 279 | 279 | -326.534288 | -22.294355 | 0 | -1.170374 | 0.335245 | 1.883255 | 1.505619 | 100 | 279 | 0 | 364.267758 |
| adverse_no_profit | 213 | 213 | -36.857231 | -2.489765 | 0 | -0.173039 | 0.070206 | 0.291771 | 0.243244 | 0 | 0 | 213 | 0 |
| green_profit_leak | 78 | 15 | 6.748755 | 0.326924 | 12.318109 | 0.086522 | 0.328353 | 0.340813 | 0.24183 | 100 | 15 | 0 | 4.890447 |

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
amounts, but not exact MFE/MAE timestamps. The theoretical trail-improvement
columns are therefore **upper-bound evidence**, not a replayed promise. A final
trail rule still needs timestamped excursion replay before freeze.

Key strict references from this run:

- Strict green-to-red bucket:
  `12 cycles, -7.133439% ADR, 12 trail-addressable losses`.
- Strict no-profit bucket:
  `ugly_no_profit, 33 cycles, -70.03746% ADR, 33 no-trail losses`.

## Artifacts

- Variant summary:
  `docs/research/gates/gate90/artifacts/gate90d-2019-open-bad-cycle-origin-diagnostic/cycle-origin-variant-summary.rows.json`
- Origin summary:
  `docs/research/gates/gate90/artifacts/gate90d-2019-open-bad-cycle-origin-diagnostic/cycle-origin-summary.rows.json`
- Pair-side origin summary:
  `docs/research/gates/gate90/artifacts/gate90d-2019-open-bad-cycle-origin-diagnostic/cycle-origin-pair-side.rows.json`
- Close-reason summary:
  `docs/research/gates/gate90/artifacts/gate90d-2019-open-bad-cycle-origin-diagnostic/cycle-origin-close-reason.rows.json`
- Start-date origin summary:
  `docs/research/gates/gate90/artifacts/gate90d-2019-open-bad-cycle-origin-diagnostic/cycle-origin-start-date.rows.json`
- SHA receipt:
  `docs/research/gates/gate90/artifacts/gate90d-2019-open-bad-cycle-origin-diagnostic/gate90d-bad-cycle-origin-sha256.txt`

## Stop Line

Research-only. This does not freeze trailing stops, promote Triangle v1, or open
MT5/live/app work.
