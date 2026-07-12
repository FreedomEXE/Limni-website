# LRMG Katarakti Pine Visual Handoff - 2026-07-04

This is a quick TradingView visual prototype, not a Gate 95 branch of work.
Keep it separate from the MT5/Gate 95 runner lane unless Freedom explicitly
opens a formal validation gate.

## Current Artifact

- Pine file: `automation/indicators/tradingview/limni-lrmg-katarakti-stoch.pine`
- Indicator name: `Limni LRMG Katarakti Stoch`
- Purpose: visually test the LRMG 0 line, Katarakti trigger, stochastic filter,
  grid entries, and basket exits on TradingView history.

## Indicator Shape

- Overlay indicator, not a TradingView strategy.
- Default source was moved to lower timeframe M1 precision for LRMG and
  Katarakti calculations.
- LRMG line is not a moving average. It ports the no-price/LRMG-style anchor:
  bootstrap closes, compute movement path median/radius, close equal-size
  movement bricks, then plot the median of recent closed brick levels converted
  back to chart price.
- Stochastic is used as a filter only. Default settings are K 1000, slowing 50,
  D 100, oversold 20, overbought 80, and D filter disabled.
- Katarakti is simplified to three presets:
  - Loose: more triggers, sweep depth 0.05, displacement body 0.04, close zone
    0.40.
  - Balanced: middle trigger rate, sweep depth 0.0833333333, displacement body
    0.0666666667, close zone 0.25.
  - Extreme: fewer triggers, sweep depth 0.12, displacement body 0.06, close
    zone 0.18.
- Buy arrow prints only when Katarakti buy + below LRMG line + stochastic
  oversold.
- Sell arrow prints only when Katarakti sell + above LRMG line + stochastic
  overbought.

## P/L Tracker Shape

- Indicator-side basket tracker, not broker-accurate order execution.
- ADR is average daily high-low over completed daily bars.
- TP and SL are expressed in ADR units and can be disabled with 0.
- Grid adds are directional:
  - Buy basket adds below the first entry.
  - Sell basket adds above the first entry.
- Basket TP, SL, and trailing stop are calculated from the combined average
  entry, not from each individual fill.
- Net ADR counts all fills. Example: a 3-fill basket closing at +0.10 ADR from
  average entry books +0.30 ADR.
- The tracker currently handles one directional basket at a time.

## Current Visual Candidate

Freedom's latest visual read:

- Source: lower timeframe M1 precision.
- LRMG defaults unchanged: bootstrap 720, median brick window 55, max bricks per
  bar 200.
- Stochastic defaults unchanged: K 1000, slowing 50, D 100, OS 20, OB 80.
- TP ADR units: 0, disabled.
- SL ADR units: 0, disabled.
- Grid adds: enabled.
- Max basket entries: 50.
- Grid spacing: 0.10 ADR.
- Trailing stop: enabled.
- Trail start: 0.20 ADR.
- Trail distance: 0.20 ADR.
- Katarakti mode: Loose currently looks best for total profit because it creates
  more entries. Balanced and Extreme also appear viable visually, but Loose
  produced more profit in the manual check.

Earlier visual candidate was trail start 0.05 and trail distance 0.10, but
Freedom later found 0.20 / 0.20 looked better.

## Findings So Far

- The useful shape appears to be no fixed TP, no fixed SL, grid into extremes,
  and a basket trailing exit.
- Loose Katarakti may be the best profit mode because trigger count matters
  when the basket/trailing logic handles the exit.
- No-SL visuals can look strong but hide unresolved basket tail risk. A real
  test must measure max adverse excursion, max fill count, time stuck in basket,
  and open baskets at cutoff.
- This should not be treated as proven edge until tested on deeper history and
  multiple symbols together.

## Known Limits

- Pine lower-timeframe history is still limited by TradingView intrabar request
  limits, even though it scrolls farther than the MT5 custom chart issue.
- This was not locally compiled by Codex; TradingView is the compiler/runtime.
- Same-bar TP, SL, trail, and grid ordering is simulated and approximate.
- Indicator-side P/L is useful for visual discovery, but a proper engine is
  needed before accepting performance numbers.

## Next Validation Ideas

- Test all 28 FX pairs together.
- Move from individual-pair accounting to grouped basket accounting.
- Add group/basket-level TP or trailing exit.
- Add weekly cutoffs or forced close rules.
- Report max open drawdown, unresolved baskets, max fill count, average fill
  count, time in basket, and pair contribution.
- Compare Loose, Balanced, and Extreme only after basket-level risk metrics are
  available.

## New Chat Prompt

Use this prompt to continue:

```text
We built a quick TradingView Pine prototype at
automation/indicators/tradingview/limni-lrmg-katarakti-stoch.pine.
This is not Gate 95 and should stay separate from MT5 runner work.

Current visual candidate:
- Source lower TF M1 precision.
- LRMG defaults: bootstrap 720, median brick window 55, max bricks 200.
- Stoch: K 1000, slowing 50, D 100, OS 20, OB 80, D filter off.
- Katarakti mode: Loose.
- TP 0/off, SL 0/off.
- Grid enabled, max basket entries 50, spacing 0.10 ADR.
- Trailing enabled, trail start 0.20 ADR, trail distance 0.20 ADR.

The current finding is that no fixed TP/SL, grid into extremes, and basket
trailing exit looks best visually. Loose appears to give more profit than
Balanced or Extreme because it creates more entries, but this is only visual.
Next serious step is a proper multi-pair validation: all 28 pairs, grouped
basket accounting, basket TP/trail, weekly cutoff rules, max drawdown, max fill
count, unresolved basket exposure, and pair contribution.
```
