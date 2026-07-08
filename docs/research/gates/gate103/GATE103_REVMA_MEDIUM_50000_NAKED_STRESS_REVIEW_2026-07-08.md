# Gate 103 - Revma MEDIUM_50000 Naked-Stress Review

Date: 2026-07-08

Status: DIAGNOSTIC REVIEW ONLY - not promotion evidence

## Run Identity

```text
System: LimniPortfolioEA / Revma v001
Formula: revma-mean-reversion-grid-v001
Universe: FX28
Q profile: MEDIUM_50000
Tester model: open prices only (terminal profile Model=2)
Window observed in receipts: 2026.01.01 00:00:00 -> 2026.07.06 23:59:30
Deposit: 10000 USD
Fixed lot: 0.01
Grid spacing: 0.10q
Stop/take-profit mode: MULTI_CURRENCY_PERCENT_AFTER_FEES
Account TP: 1.0000%
SL: 0.0000
Equity guard: disabled
Currency guard: disabled
News guard: disabled
```

Receipt source:

```text
C:\Users\User\AppData\Roaming\MetaQuotes\Terminal\Common\Files\LimniPortfolioEA_Rv_FX28_MEDIUM_50000_APct_TP1p000_SL0p000_L0p010_G0p10Q_NCG_NEG_AC_20260101_20260706
```

## Summary Verdict

The Medium run is promising as a naked-harvest diagnostic, but it is not safer
than the earlier Fast anatomy. It made more money in this six-month window, but
it carried materially larger inventory and deeper tail pain.

The result says:

```text
MEDIUM_50000 + fixed 0.01 lots + 1% account TP + no guards
can harvest this six-month window profitably under open-prices-only testing.
```

It does not say:

```text
Medium is better than Fast.
Medium is crisis robust.
Open-prices-only is worst case.
The formula is ready for promotion.
```

## Key Metrics

```text
Starting balance: 10000.00
Ending balance: 19622.94
Net gain: +9622.94 / +96.23%
Final summary inventory: flat
Final engine inventory: flat
Final grid inventory: flat

Receipt lines: 4,016,942
Engine steps: 189,565
Revma signals: 9,157
Grid births: 409
Grid adds: 8,748
Account TP trigger episodes: 58
Account close scans: 214
Positions closed by account scans: 9,144
Market-closed order failures: 63
```

## Tail Pain

```text
Max managed positions: 719 at 2026.01.21 17:44:00
Max open grids: 21 at 2026.04.10 17:53:00
Worst managed floating PnL: -2634.81 at 2026.01.21 14:51:00
Worst net open pct after fees: -25.108135% at 2026.01.21 14:51:00
Estimated max equity drawdown: -25.80% / -2731.98 at 2026.01.21 14:51:00
Estimated min equity: 7859.04
Estimated max equity seen: 19664.61
Approximate time in inventory: 2715.44 hours
```

This is a real tail event for a six-month benign diagnostic. It survived, but
the survival depended on staying unliquidated through a large floating drawdown.

## Account TP Dependence

The account TP is the harvesting engine in this run.

```text
Account TP hits: 58
Average TP interval: 75.67 hours
Fastest TP interval: 7.78 hours
Slowest TP interval: 260.87 hours
Average net open money at TP trigger: 167.29
Largest TP trigger money: 415.41
Average positions at TP trigger: 157.66
Max positions at TP trigger: 719
```

Largest liquidation episodes:

```text
2026.01.21 17:44 -> 17:58: closed 719 positions across 15 scans
2026.04.13 00:03 -> 00:17: closed 670 positions across 15 scans
2026.04.21 15:26 -> 15:35: closed 463 positions across 10 scans
2026.03.31 17:03 -> 17:11: closed 416 positions across 9 scans
2026.03.13 15:46 -> 15:53: closed 370 positions across 8 scans
```

This is not a grid-level TP proof. This is a diversified account-inventory
harvest proof under a crude no-guard contract.

## Grid Anatomy

```text
Tracked grids: 409
Grids with adds: 392
Average tracked grid age: 39.39 hours
Max tracked grid age: 166.98 hours
Max single-grid depth: 195 positions
```

Deepest grids:

```text
NZDCAD grid 21031118614: max depth 195, age 8.15h
EURUSD grid 14031117043: max depth 159, age 22.22h
EURUSD grid 14031118210: max depth 144, age 113.82h
GBPCHF grid 17031110678: max depth 139, age 38.50h
GBPCHF grid 17031113383: max depth 136, age 64.83h
```

Top add concentration:

```text
GBPCHF: 18 births / 638 adds
NZDCAD: 21 births / 613 adds
AUDNZD: 18 births / 537 adds
AUDCAD: 25 births / 521 adds
NZDCHF: 16 births / 489 adds
CADCHF: 15 births / 408 adds
AUDCHF: 16 births / 359 adds
AUDUSD: 22 births / 354 adds
NZDUSD: 19 births / 352 adds
NZDJPY: 12 births / 351 adds
```

The concentration is not catastrophic across one pair only, but several pairs
can become very deep. Currency-layer exposure control should remain a separate
later layer, not hidden q tuning.

## Q Surface

Representative average signal q in pips:

```text
CADCHF 6.91
NZDCHF 7.04
EURCHF 7.27
AUDCHF 8.61
NZDUSD 10.09
GBPCHF 11.14
NZDCAD 11.15
AUDCAD 11.30
AUDUSD 11.35
EURUSD 13.63
GBPUSD 18.34
EURJPY 22.50
EURNZD 27.16
CHFJPY 27.68
GBPNZD 28.93
GBPJPY 29.73
```

Medium is not simply "slower Fast." It changes q geometry, add spacing, basket
shape, and TP exposure timing. Keeping fixed lots and fixed account TP means this
run tested the current crude money contract on Medium, not Medium's full formula
potential.

## Open-Prices-Only Caveat

This run used open-prices-only model quality. Treat that as a fast diagnostic,
not a final truth source.

The current Revma signal/birth/add surface is mostly M1/bar-state driven, so
open-prices-only may be directionally useful. But it is not proven to be worst
case. Higher-quality OHLC/tick tests can improve harvesting if account TP catches
intrabar profit earlier, but they can also degrade results if intrabar path,
spread, order timing, or deeper adverse movement changes adds and closes.

The correct stance is:

```text
Open prices only is the lab-speed anatomy pass.
1-minute OHLC is the next quality gate.
Tick data is the later proof gate.
If higher-quality data degrades the run, the open-prices result was optimistic.
```

## Comparison Caveat

The earlier six-month Fast output appears to have been overwritten by the stale
pre-AUTO output folder/run-id behavior. Earlier parsed Fast metrics can be used
as rough context, but this repo no longer has a clean Fast six-month receipt CSV
for a strict apples-to-apples ledger comparison.

AUTO output naming and receipt run-id suffixing were added after this to prevent
the same collision from happening again.

## Interpretation

Medium did very well on headline profit:

```text
10000 -> 19622.94 in about six months
```

But the pain profile is large:

```text
719 positions
21 open grids
-25.1% worst net open pct
-25.8% estimated equity drawdown
195-position deepest single grid
```

The result is better described as:

```text
Medium has a live naked-harvest signal in this window, but it is still using
account-level liquidation to rescue large inventory waves.
```

## Recommendation

Continue the fixed q-horizon ladder, not random tuning:

```text
FAST_5000      fixed lot 0.01 / account TP 1% / no guards
MEDIUM_50000   fixed lot 0.01 / account TP 1% / no guards
SLOW_250000    fixed lot 0.01 / account TP 1% / no guards
CUSTOM_1000000 fixed lot 0.01 / account TP 1% / no guards
```

Do not alter TP, lot size, spacing, SL, equity guard, or currency guard until the
fixed q ladder is complete and written into one evidence ledger.

After the q ladder:

```text
1. Repeat the same candidates on 1-minute OHLC.
2. If OHLC does not degrade materially, run selected candidates on tick data.
3. Only then test TP/lot/risk-control ladders.
4. Later, test crisis windows such as COVID separately.
```

The next diagnostic question is not "did Medium beat Fast on profit." The next
question is:

```text
Which q horizon gives the best harvest per unit of tail pain?
```
