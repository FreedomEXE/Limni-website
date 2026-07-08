# Gate 103 - Revma Medium TP Band Review

Date: 2026-07-08

Status: DIAGNOSTIC REVIEW ONLY - not promotion evidence

## Scope

This review compares the Medium q horizon naked-stress account-TP band.

```text
Universe: FX28
System: LimniPortfolioEA / Revma v001
Formula: revma-mean-reversion-grid-v001
Q profile: MEDIUM_50000
Tester model: open prices only
Window: 2026.01.01 -> 2026.07.06 unless noted otherwise
Deposit: 10000 USD
Lots: fixed 0.01
Grid spacing: 0.10q
SL: disabled
Equity guard: disabled
Currency guard: disabled
News guard: disabled
Only intended variable: account TP percent
```

Revma remains mean-reversion only. This is evidence collection for formula
design, not a final formula or promotion gate.

## Summary Table

| Account TP | Final balance | Net % | Max running equity DD | Worst net open % | Max positions | Max grid depth | TP hits | No-money failures | Verdict |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| 0.01% | 10552.44 | +5.52% | -24.87% / -2611.81 | -24.87% | 441 | 195 | 313 | 0 | Too low; churns profit away and does not remove tail. |
| 0.10% | 12005.27 | +20.05% | -16.78% / -1978.52 | -16.70% | 351 | 195 | 168 | 0 | Smoothest low band, but profit falls too much. |
| 0.50% | 16126.50 | +61.27% | -13.03% / -1984.17 | -13.98% | 670 | 195 | 79 | 0 | Best lower-TP candidate; materially smoother than 1% with strong profit. |
| 1.00% | 19622.94 | +96.23% | about -25.80% / -2731.98 | -25.11% | 719 | 195 | 58 | 0 | Highest reviewed profit, but materially more painful. |
| 10.00% | 6374.35 | -36.26% | about -67.70% | -65.50% | 1456 | pending | 6 | 18019 | Failed upper bound; margin exhaustion behavior. |

Notes:

- `1.00%` metrics come from the full Medium anatomy review.
- `10.00%` ended early on `2026.03.12 17:28:59`.
- Running equity drawdown for the lower-TP runs was recomputed from receipt
  time order using estimated equity = balance + managed floating PnL.

## Lower-TP Details

### TP 0.50%

```text
Final balance: 16126.50
Net profit: +6126.50 / +61.27%
Final inventory: flat
Account TP hits: 79
Average TP interval: 55.28h
Max TP interval: 260.77h
Average positions at TP: 109.85
Max positions at TP: 670
Max managed positions: 670
Max open grids: 21
Worst floating PnL: -1972.80
Worst net open pct: -13.982702%
Max running equity DD: -1984.17 / -13.03%
Max grid depth estimate: 195 on NZDCAD
No-money failures: 0
```

### TP 0.10%

```text
Final balance: 12005.27
Net profit: +2005.27 / +20.05%
Final inventory: flat
Account TP hits: 168
Average TP interval: 25.91h
Max TP interval: 163.58h
Average positions at TP: 35.99
Max positions at TP: 351
Max managed positions: 351
Max open grids: 18
Worst floating PnL: -1967.14
Worst net open pct: -16.701817%
Max running equity DD: -1978.52 / -16.78%
Max grid depth estimate: 195 on NZDCAD
No-money failures: 0
```

### TP 0.01%

```text
Final balance: 10552.44
Net profit: +552.44 / +5.52%
Final inventory: flat
Account TP hits: 313
Average TP interval: 13.75h
Max TP interval: 165.62h
Average positions at TP: 12.88
Max positions at TP: 441
Max managed positions: 441
Max open grids: 12
Worst floating PnL: -2611.26
Worst net open pct: -24.868764%
Max running equity DD: -2611.81 / -24.87%
Max grid depth estimate: 195 on NZDCAD
No-money failures: 0
```

## Interpretation

The lower-TP band is now informative:

```text
TP 0.01% is too low.
TP 0.10% is smoother than 1%, but sacrifices too much profit.
TP 0.50% is the best lower-TP point so far.
TP 1.00% remains the highest-profit reviewed point, but with much worse pain.
TP 10.00% is failed.
```

The important structural finding is that fixed account TP is not enough to
solve deep grid behavior. The max grid depth estimate stayed around `195` in
the lower-TP runs. Lower TP harvested profitable account states earlier, but it
did not prevent a single grid from becoming deeply adverse.

That means fixed account TP is mostly a harvest-timing layer, not a complete
Revma formula solution.

## Direction

The useful TP region under this exact naked contract appears to be:

```text
0.50% to 1.00%
```

The next best single test is:

```text
MEDIUM_50000
Account TP: 0.75%
Same naked-stress contract
```

Why:

```text
0.50% materially reduced pain and kept strong profit.
1.00% made much more profit but roughly doubled the worst net-open pain.
0.75% is the clean midpoint to locate the knee between smoothness and harvest.
```

Do not continue lower than `0.01%`; the lower-bound churn test is complete.
Do not repeat `10.00%`; the upper-bound failure is established.

## Outside Review Update

Outside review agreed that the six-month TP band has answered enough. The main
finding is bigger than picking the exact best fixed TP:

```text
Fixed account TP changes harvest timing.
It does not solve deep adverse-grid inventory.
```

Because max grid depth stayed around `195` even at very low TP, more six-month
TP-band testing is lower-value. The next research question is regime survival.

Do not run a broad six-year ladder such as:

```text
0.25 / 0.50 / 0.75 / 1.00 / 2.00
```

That would become optimization. Use one six-year diagnostic to ask:

```text
Can the viable Medium TP band survive multiple regimes naked?
```

## Proposed Gate 104

```text
Gate 104 - Revma Medium 0.75 Long-Regime Naked Stress

Q profile: MEDIUM_50000
Account TP: 0.75%
Window: 6 years
Universe: FX28
Lots: fixed 0.01
Grid spacing: 0.10q
SL: disabled
Equity guard: disabled
Currency guard: disabled
News guard: disabled
Tester model: start with open prices only unless explicitly changed
Same receipt parser and evidence ledger
```

Pass/fail read:

```text
A six-year pass does not mean promotion.
It means Revma deserves formula and risk-design work.

Promising criteria:
- survives full window
- final flat, or end-state inventory is fully explained
- no margin/no-money spiral
- max drawdown tolerable relative to profit
- max positions not insane
- deepest grid eventually resolves
- profit not dominated by one lucky period
- no pair/currency concentration disaster
```

If `0.75%` fails, do not immediately tune. The question becomes whether Revma
needs risk controls before long horizons or whether the naked harvest mechanism
is regime-fragile.

If `0.75%` survives, run only two confirmation tests:

```text
MEDIUM_50000 / TP 0.50% / six-year
MEDIUM_50000 / TP 1.00% / six-year
```

That brackets the viable six-month region without turning the work into a sweep.

## Portfolio Risk Guard Follow-On

The long-regime naked test should not be mistaken for the intended final
production contract. Its purpose is to expose the raw failure mode.

If the six-year naked run shows the same COVID-era drawdown spike as prior
mean-reversion systems, the next layer should be a portfolio-risk guard gate,
not hidden formula tuning:

```text
Gate 105 candidate - Revma Portfolio Risk Guard Overlay Review

Goal:
Reduce deep adverse-grid and portfolio drawdown pain without killing the
continuous harvest mechanism.

Candidate layers:
- equity drawdown guard
- portfolio exposure cap
- max managed positions cap
- max grid depth cap
- grid age / stale inventory rule
- currency exposure guard
- no-money / margin-stress prevention
```

This should be evaluated after the naked long-regime evidence is known. If risk
guards materially reduce drawdown while preserving enough harvest, then later
position sizing can be revisited. The target final system is not maximum naked
profit; it is good harvest with controlled downside.

## Formula Implications

The TP band should not be converted directly into a final fixed parameter.
The literature review remains required before final Revma formula design.

Current evidence suggests:

```text
Fixed TP alone cannot manage the adverse-grid tail.
Very low TP harvests too frequently and loses most of the profit.
High TP waits too long and can push the account into margin stress.
The likely useful formula must combine q-dollar harvest value with inventory
state, especially depth and age.
```

Candidate formula direction remains only a research hypothesis:

```text
portfolio_q_value =
  sum(position_lots * symbol_q_pips * pip_value)

target_money =
  clamp(alpha * portfolio_q_value, min_equity_pct * equity, max_equity_pct * equity)
```

But the formula should not be implemented until mean-reversion literature has
been reviewed for:

```text
half-life
standardized displacement / z-score
volatility regime
stationarity
basket/correlation structure
inventory age and depth
mean-reversion decay or failure conditions
```

Currency guard remains a separate later layer and should not be hidden inside
Revma TP tuning.

## Current Recommendation

```text
Next diagnostic test:
Gate 104 - MEDIUM_50000 / TP 0.75% / six-year naked stress.

Purpose:
Regime survival, not TP optimization.

No Kyma.
No risk controls yet.
No formula code yet.
No broader optimization sweep.
No final formula until literature review is complete.
```
