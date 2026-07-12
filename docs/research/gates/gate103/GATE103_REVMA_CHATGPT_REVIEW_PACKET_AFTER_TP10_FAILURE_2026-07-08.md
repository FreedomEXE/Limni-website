# Gate 103 - Revma ChatGPT Review Packet After TP 10 Failure

Date: 2026-07-08

Status: OUTSIDE REVIEW PACKET - diagnostic only, not promotion evidence

## Request For Outside Review

Please review the current Revma evidence and give an opinion on the best next
test and formula direction.

The working hypothesis is:

```text
Revma may have a diversified FX mean-reversion inventory-harvest edge,
but the proof depends on whether harvest survives different q horizons,
TP thresholds, data quality, and bad market regimes without requiring
unacceptable inventory pain.
```

## Hard Boundaries

```text
Revma remains mean-reversion only.
Kyma/trend-following research is closed until Revma has its own verified edge.
No optimization sweep.
No new strategy systems.
Risk controls are not introduced yet.
Currency guard remains a separate later layer, not hidden Revma tuning.
These runs are diagnostic-only.
```

Formula caution:

```text
Do not clamp down a final Revma formula from this TP ladder alone.
The repo has a large mean-reversion research-literature backlog that must be
reviewed before final formula design or implementation.
The TP ladder is evidence collection for formula design, not the formula itself.
```

## Outside Review Returned

ChatGPT/outside review agreed with the main classification:

```text
Revma remains worth studying as a naked diversified FX mean-reversion harvest
candidate, but it is not a proven formula.

Medium 1% is promising but painful.
Medium 10% is an upper-bound failure, not "rough but promising."
The best next diagnostic test is MEDIUM_50000 with account TP 0.50%.
Do not jump to 0.10% yet.
Do not pause the Medium TP ladder for Slow/Full anatomy yet.
Do not switch to 1-minute OHLC before the 0.50% open-prices test.
Do not introduce Kyma, risk controls, broad optimization, or new formula code.
```

Outside review also supported using a small pain-adjusted dashboard rather than
one headline metric:

```text
profit / max equity drawdown
profit / max managed positions
profit / worst net open pct
profit / max grid depth
profit / time in inventory
```

The primary ranking metric proposed was:

```text
profit / max equity drawdown
```

But any result should still be rejected if it hides extreme inventory, margin
stress, or final non-flat ambiguity.

## Current Naked-Stress Test Contract

```text
Universe: FX28
System: LimniPortfolioEA / Revma v001
Formula: revma-mean-reversion-grid-v001
Tester model: open prices only
Window: 2026.01.01 -> 2026.07.06 unless noted otherwise
Deposit: 10000 USD
Lots: fixed 0.01
Grid spacing: 0.10q
SL: disabled
Equity guard: disabled
Currency guard: disabled
News guard: disabled
Account TP: variable under review
```

This is a naked stress diagnostic. It intentionally removes risk controls so we
can inspect the core harvest mechanism first.

## What Has Been Tested

### Gate 101 / Gate 102 Mechanics

```text
Gate 101: PASS
- Revma locked to mean-reversion only.
- LONG only below anchor.
- SHORT only above anchor.
- With-trend states rejected before strategy evaluation.

Gate 102: PASS
- FX28 activation proven.
- One tester symbol can drive the 28-symbol engine.
- Multi-currency account TP liquidation latch proven.
- Close-all can continue across close-limit scans until flat.
```

### Q Horizon Ladder At 1% Account TP

All below use the same naked-stress contract and 1% account TP.

| Q profile | Evidence status | Final balance | Final inventory | Notes |
| --- | --- | ---: | --- | --- |
| FAST_5000 | Prior context only | ~18600 | Evidence caveat | Earlier output was affected by stale output naming/run-id collision. Treat as rough context, not strict ledger evidence. |
| MEDIUM_50000 | Full anatomy reviewed | 19622.94 | Flat | Best reviewed headline result, but carried major tail pain. |
| SLOW_250000 | Summary verified; anatomy pending | 17049.08 | Flat | Profitable and flat; lower headline result than Medium. |
| FULL_ALL | Summary verified; anatomy pending | 16673.12 | Flat | Profitable and flat; user-reported runtime about 14 minutes versus about 7 minutes for Fast. |

Medium 1% anatomy:

```text
Starting balance: 10000.00
Ending balance: 19622.94
Net gain: +9622.94 / +96.23%
Final inventory: flat
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

Interpretation:

```text
Medium 1% made very strong money, but it did so through account-level
inventory harvesting and real tail exposure. It is promising, not safe.
```

## TP 10% Failure Evidence

One additional user-run tested Medium with account TP stretched from 1% to 10%.

```text
Q profile: MEDIUM_50000
Account TP: 10.0000%
Same naked-stress contract otherwise
Run observed: 2026.01.01 -> 2026.03.12 17:28:59
Starting balance: 10000.00
Final balance: 6374.35
Final inventory: flat
Net result: -3625.65 / -36.26%
Engine steps: 71,416
Receipt lines: 1,643,225
Revma signals: 22,685
Grid births: 123
Grid adds: 22,562
Account TP newly triggered: 6
Account TP trigger pct range: about 10.04% to 10.30%
Max managed positions: 1456
Max open grids: 26
Worst managed floating PnL: -11642.00
Worst net open pct after fees: -65.501495%
Estimated max equity seen: 18981.11
Estimated min equity seen: 6131.64
Estimated peak-to-trough equity drawdown: -67.70%
Max realized balance seen in receipts: 17819.57
TRADE_RETCODE_NO_MONEY count: 18,019
TRADE_RETCODE_MARKET_CLOSED count: 21
First no-money failure observed: 2026.03.03 17:14:00
Last no-money failure observed: 2026.03.12 17:28:00
```

Archived evidence folder:

```text
C:\Users\User\AppData\Roaming\MetaQuotes\Terminal\Common\Files\LimniPortfolioEA_Archive\20260708-gate103-reviewed-runs\LimniPortfolioEA_Rv_FX28_MEDIUM_50000_APct_TP10p000_SL0p000_L0p010_G0p10Q_NCG_NEG_AC_2026_01_01_00_00_00_R138788812
```

Interpretation:

```text
TP 10% is not "better but rougher."
It is an upper-bound harvest failure under this naked contract.

It did harvest six large cycles and reached a peak realized balance near 17.8k,
but waiting for 10% let inventory expand until margin exhaustion behavior
appeared. The system then ended the diagnostic at 6374.35.
```

The important lesson is that stretching account TP did not unlock much more
useful upside than 1%, while it massively increased tail pain and introduced
no-money failures.

## Current Read

The q ladder suggests the core harvest mechanism is real enough to keep
studying:

```text
1% TP survived across Medium, Slow, and Full with final flat summaries.
Medium 1% had the strongest reviewed result.
```

The TP 10% run gives the first hard upper-bound evidence:

```text
10% TP is too stretched for Medium under fixed 0.01 lots, 0.10q spacing,
no guards, and this six-month open-prices window.
```

So the next research question is now sharper:

```text
Can lower TP produce a smoother profit/pain profile than 1%,
and where does the upper TP boundary begin to break between 1% and 10%?
```

## Proposed Best Next Test

Run one next test:

```text
Gate 104A - Revma Medium TP 0.50 Naked-Stress Check

Q profile: MEDIUM_50000
Account TP: 0.50%
Everything else unchanged:
- FX28
- open prices only
- 2026.01.01 -> 2026.07.06
- fixed 0.01 lots
- grid spacing 0.10q
- no SL
- no equity guard
- no currency guard
- no news guard
```

Why 0.50% first:

```text
1. It directly tests whether lowering TP from 1% smooths inventory.
2. It avoids jumping all the way to 0.10%, which may be too spread/noise
   sensitive and could confuse the conclusion.
3. It gives a clean midpoint below the known profitable but painful 1% run.
4. It is more actionable for formula design than another high-TP stress run.
```

After 0.50%, use the following fixed continuation ladder, already declared:

```text
0.25%
0.10%
2.00%
3.00%
```

Interpretation rules:

```text
If 0.50% is smoother with acceptable profit, test 0.25%.
If 0.25% is still smooth, test 0.10% as the lower-bound churn/noise check.
If lower TP is profitable but weak, test 2.00% to bracket upper stretch.
If 2.00% fails or shows major pain, do not test 3.00%.
If 2.00% survives cleanly, test 3.00% as the next upper-bound point.
10.00% is already failed and should not be repeated under this contract.
```

This is not intended as an optimization sweep. It is a fixed sensitivity map
around a known working point and a known failed upper bound.

## Metrics Required For Every TP Run

```text
final balance
final flat/non-flat proof
max realized balance
max estimated equity
min estimated equity
max managed positions
max open grids
worst floating PnL
worst net open pct
estimated peak-to-trough equity drawdown
account TP hit count
average / min / max TP interval
average / max positions at TP
grid births
grid adds
max grid depth
max grid age
market-closed failures
no-money failures
profit / max drawdown
profit / max positions
profit / time in inventory
```

## Formula Direction To Review

The current account TP is a fixed percentage of balance. That is probably too
crude. The eventual harvest target should likely be formula-based, but this is
not the next implementation step. Keep fixed-percent TP for the diagnostic
ladder, then use the TP evidence plus mean-reversion literature review to decide
the final formula surface.

Candidate formula layers:

### 1. Formula layer

```text
q horizon
anchor / centerline
mean-reversion birth condition
add spacing as a q multiple
```

Current:

```text
birth: LONG below anchor, SHORT above anchor
add spacing: 0.10q
```

### 2. Exposure layer

```text
fixed lots for diagnostics
later: lot/exposure scaled by q-dollar risk, active grids, depth, and equity
```

Do not hide currency exposure in Revma formula tuning. Currency guard should
remain a separate later layer.

### 3. Harvest layer

The account TP target may need to become:

```text
target_harvest_money = f(equity, q-dollar inventory, active grids, depth, age)
```

Possible terms:

```text
equity_pct_floor
portfolio_q_value
active_grid_count
managed_position_count
max_grid_depth
max_grid_age
currency concentration, only as a separate guard or penalty layer
current floating PnL and net open pct
```

One candidate shape for discussion:

```text
portfolio_q_value =
  sum over managed positions of position_lots * symbol_q_pips * pip_value

raw_target_money =
  alpha * portfolio_q_value

target_money =
  clamp(raw_target_money, min_equity_pct * equity, max_equity_pct * equity)

target_pct =
  target_money / equity
```

Then adjust or cap the target when inventory becomes too old, too deep, or too
concentrated:

```text
age_penalty = g(max_grid_age)
depth_penalty = h(max_grid_depth)
concentration_penalty = separate currency guard layer, not hidden q tuning
```

The TP 10% failure suggests fixed high TP ignores inventory stress. A q-aware
harvest formula should likely collect more frequently as inventory depth/age
rises rather than demanding a larger account-level win.

Literature review must still answer whether this q-dollar harvest idea matches
known mean-reversion principles or whether the formula should instead emphasize
half-life, z-score/standardized displacement, variance regime, stationarity
tests, volatility scaling, or basket/correlation structure.

## Questions For ChatGPT

```text
1. Does the evidence support continuing Revma as a naked diversified
   mean-reversion harvest candidate?

2. Is TP 10% correctly classified as an upper-bound failure rather than merely
   a bad final result?

3. Is Medium 0.50% the best next test, or should the next test be 0.25%,
   2.00%, or a different bracket point?

4. Should the next ladder stay on MEDIUM_50000, or should Slow/Full anatomy be
   reviewed first and possibly used for the TP ladder?

5. Should TP smoothness be judged primarily by profit/max drawdown,
   profit/max positions, or profit/time-in-inventory?

6. Is a q-dollar harvest target the right formula direction, or should harvest
   remain fixed-percent until more data is gathered?

7. What terms should be included in a future harvest formula without creating
   hidden overfit parameter sprawl?

8. Should 1-minute OHLC validation happen before the full TP ladder, or only
   after a lower-TP candidate beats the 1% baseline on pain-adjusted metrics?
```

## Current Recommendation

```text
Do not introduce risk controls yet.
Do not run another 10% TP test.
Do not open Kyma/trend research.
Do not switch to broad optimization.

Next best test:
MEDIUM_50000, account TP 0.50%, same naked-stress contract.

Reason:
We now know 1% works but is painful, and 10% fails by exposure/margin stress.
The highest-value next question is whether lower TP smooths the harvest while
retaining enough profit to justify a q-aware formula.
```
