# Gate 103 - Revma Q Ladder And TP Ladder Review Packet

Date: 2026-07-08

Status: DIAGNOSTIC REVIEW ONLY - not promotion evidence

## Purpose

This packet summarizes the Revma naked-stress evidence collected so far and
frames the next fixed TP harvest ladder for outside review.

Revma remains mean-reversion only. Kyma/trend following is closed. These runs
are open-prices-only diagnostics, not live-readiness or crisis-robustness proof.

## Current Test Contract

```text
Universe: FX28
System: Revma v001
Formula: revma-mean-reversion-grid-v001
Tester model: open prices only
Window: 2026.01.01 -> 2026.07.06
Deposit: 10000 USD
Lots: fixed 0.01
Grid spacing: 0.10q
Account TP: 1.0000%
SL: disabled
Equity guard: disabled
Currency guard: disabled
News guard: disabled
```

These are naked-stress harvest diagnostics. They intentionally remove risk
controls so the core inventory-harvest mechanism can be inspected before risk
controls are introduced.

## Q Ladder Status

| Q profile | Evidence status | Final balance | Final inventory | Notes |
| --- | --- | ---: | --- | --- |
| FAST_5000 | Prior context only | ~18600 | Evidence caveat | Earlier output was affected by stale output naming/run-id collision. Use as rough context, not clean ledger evidence. |
| MEDIUM_50000 | Full Gate 103 anatomy reviewed | 19622.94 | Flat | Best final balance so far, but carried major tail pain. |
| SLOW_250000 | Summary verified; anatomy pending | 17049.08 | Flat | Profitable and flat under same contract. Internal summary still carries stale `output_folder` label text; actual folder was repaired. |
| FULL_ALL | Summary verified; anatomy pending | 16673.12 | Flat | Profitable and flat. User-reported runtime about 14 minutes versus about 7 minutes for Fast. |

Current top-level unreviewed output folders:

```text
C:\Users\User\AppData\Roaming\MetaQuotes\Terminal\Common\Files\LimniPortfolioEA_Rv_FX28_SLOW_250000_APct_TP1p000_SL0p000_L0p010_G0p10Q_NCG_NEG_AC_20260101_20260706
C:\Users\User\AppData\Roaming\MetaQuotes\Terminal\Common\Files\LimniPortfolioEA_Rv_FX28_FULL_ALL_APct_TP1p000_SL0p000_L0p010_G0p10Q_NCG_NEG_AC_2026_01_01_00_00_00_R137694015
```

Follow-up: this TP 10% run later completed, failed, and was summarized in the
post-failure review packet. It has been archived under the reviewed-runs batch:

```text
C:\Users\User\AppData\Roaming\MetaQuotes\Terminal\Common\Files\LimniPortfolioEA_Archive\20260708-gate103-reviewed-runs\LimniPortfolioEA_Rv_FX28_MEDIUM_50000_APct_TP10p000_SL0p000_L0p010_G0p10Q_NCG_NEG_AC_2026_01_01_00_00_00_R138788812
```

Medium reviewed output is archived under:

```text
C:\Users\User\AppData\Roaming\MetaQuotes\Terminal\Common\Files\LimniPortfolioEA_Archive\20260708-gate103-reviewed-runs
```

## Medium Anatomy Anchor

Medium is the only q-ladder run with a full anatomy ledger already written.

```text
Starting balance: 10000.00
Ending balance: 19622.94
Net gain: +9622.94 / +96.23%
Final summary inventory: flat
Final engine inventory: flat
Receipt lines: 4,016,942
Engine steps: 189,565
Revma signals: 9,157
Grid births: 409
Grid adds: 8,748
Account TP trigger episodes: 58
Positions closed by account scans: 9,144
Market-closed order failures: 63
Max managed positions: 719
Max open grids: 21
Worst managed floating PnL: -2634.81
Worst net open pct after fees: -25.108135%
Estimated max equity drawdown: -25.80% / -2731.98
```

Medium proves that `MEDIUM_50000 + fixed lots + 1% account TP + no guards` can
harvest this six-month open-prices diagnostic window. It does not prove Medium
is safer than Fast or crisis robust.

## Preliminary Interpretation

The harvest mechanism is alive across multiple q horizons. Fast, Medium, Slow,
and Full did not immediately break under the same crude naked-stress contract.

More q memory did not automatically improve final balance under a fixed 1%
account TP. Medium currently has the best headline result, while Slow and Full
are lower but still profitable and flat.

That means the next research question is not "which q is best" in isolation.
The next question is:

```text
Which harvest threshold produces the best profit per unit of inventory pain?
```

The account TP threshold is a harvest-layer variable. It should be studied as a
predeclared sensitivity ladder, not as an optimization sweep.

## Required Before TP Ladder

Before running the TP ladder, Slow and Full should receive at least the same
summary/anatomy extraction categories as Medium:

```text
net profit
max managed positions
max open grids
worst floating PnL
worst net open pct
estimated max equity drawdown
account TP hit count
average and max TP interval
average and max positions at TP
grid births
grid adds
max grid depth
max grid age
market-closed failures
final flat/non-flat proof
```

If Slow or Full has materially lower tail pain than Medium, it may be a better
TP-ladder candidate despite lower final profit.

## Proposed Next Gate

```text
Gate 104 - Revma Fixed TP Harvest Sensitivity Ladder
```

This gate should test one selected q profile first. Do not run all q profiles
against all TP values yet.

Recommended first candidate:

```text
Primary candidate: MEDIUM_50000
Reason: best reviewed headline profit and complete anatomy ledger.
Conditional candidate: SLOW_250000
Reason: use Slow instead if full anatomy shows materially better pain-adjusted behavior.
```

## Fixed TP Ladder

Predeclare the ladder before running and do not change it after seeing results.

```text
0.10%
0.25%
0.50%
1.00%
1.50%
2.00%
3.00%
```

The existing 1.00% run is the baseline. It can be reused if the selected q
profile is Medium and the exact settings/window/model match.

## TP Ladder Contract

```text
Universe: FX28
Mode: Revma mean-reversion only
Q profile: one selected q candidate only
Tester model: open prices only for first TP ladder
Window: 2026.01.01 -> 2026.07.06
Lots: fixed 0.01
Grid spacing: 0.10q
SL: disabled
Equity guard: disabled
Currency guard: disabled
News guard: disabled
Only variable: account TP percent
No parameter changes after seeing output
```

## Break Criteria

A TP setting should be considered broken or suspect if any of the following
occur, even if final balance is profitable:

```text
final inventory is not flat
max drawdown grows faster than profit
worst net open pct becomes materially worse
max managed positions explodes
one pair or one currency dominates inventory
TP interval becomes too long
market-closed failures leave unresolved inventory
profit improves only by accepting much worse tail pain
```

## Smoothness Criteria

Lower TP may be better if it produces:

```text
more frequent harvests
shorter TP intervals
lower average and max positions at TP
lower max drawdown
lower worst net open pct
lower time in inventory
cleaner final flat behavior
acceptable profit per drawdown and profit per position
```

But lower TP can also fail if spread/noise churn reduces net harvest quality.
That is why `0.10%` is useful as a lower-bound stress point, not as an assumed
improvement.

## Outside Review Questions

```text
1. Does the q ladder support the hypothesis that Revma has a real naked
   diversified mean-reversion harvest mechanism?

2. Is Medium the correct first TP-ladder candidate, or should Slow be used if
   its pending anatomy shows lower tail pain?

3. Is the proposed TP ladder too wide, too narrow, or missing an important
   lower-bound or upper-bound threshold?

4. Should TP be judged by final profit, or by profit per max drawdown, profit
   per max positions, and profit per time in inventory?

5. What formula shape should we look for after the ladder: fixed account TP,
   q-scaled TP, exposure-scaled TP, or a hybrid?

6. Should the first TP ladder remain open-prices-only, or should one baseline
   TP be repeated on 1-minute OHLC first to check whether open-prices diagnostics
   are misleading?
```

## Current Recommendation

Finish the Slow and Full anatomy review first. Then run a one-q TP ladder,
starting with Medium unless Slow proves materially smoother on pain metrics.

Do not introduce risk controls yet. The next question remains:

```text
How far can account TP be stretched before the naked harvest breaks,
and does a lower TP harvest threshold produce a smoother profit/pain profile?
```
