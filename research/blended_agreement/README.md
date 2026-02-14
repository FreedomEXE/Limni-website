# Blended Agreement Filter Research

**Date**: February 2026
**Status**: Evaluated - Not Recommended
**Hypothesis**: Require dealer AND commercial to agree on bias direction instead of using 60/40 weighted blend

## Background

Current blended mode uses a 60/40 weighted average (60% dealer, 40% commercial) to generate signals. This research explores whether requiring strict agreement between dealer and commercial would produce better results by filtering out lower-conviction signals.

## Motivation

During the week of Feb 3-12, 2026, the weighted blended approach generated signals that in hindsight were suboptimal:
- **USD exposure**: Overly long USD across multiple pairs due to dealer bias dominating
- **Precious metals**: XAUUSD and XAGUSD signals followed dealer (lost -6.28%) when commercial had opposite view (would have gained +6.28%)

The hypothesis was that requiring dealer/commercial agreement would filter these divergent scenarios.

## Methodology

### Agreement Logic (Proposed)

For FX pairs:
1. Dealer and commercial must BOTH agree on base currency bias
2. Dealer and commercial must BOTH agree on quote currency bias
3. No neutral biases allowed
4. Base and quote must have opposite biases for signal

For non-FX pairs:
1. Dealer and commercial must agree on base currency bias
2. No neutral bias allowed

### Backtests Run

1. **Single Week Test** (`research-blended-agreement-backtest.ts`)
   - Week of Feb 3-12, 2026
   - Compared: Weighted, Agreement, Dealer, Commercial

2. **Historical Test** (`research-blended-agreement-historical.ts`)
   - 4 weeks of available historical data (Jan-Feb 2026)
   - Same model comparison

## Results

### Single Week (Feb 3-12, 2026)

| Model | Return | Signals | Win Rate |
|-------|--------|---------|----------|
| Weighted | 21.41% | 24 | 70.8% |
| Agreement | 13.51% | 3 | 66.7% |
| Dealer | 21.41% | 24 | 70.8% |
| Commercial | 23.29% | 23 | 47.8% |

**Difference**: Agreement underperformed by -7.90%

### 4-Week Historical (Jan-Feb 2026)

| Model | Total Return | Avg/Week | Signals/Week | Win Rate | Volatility |
|-------|--------------|----------|--------------|----------|------------|
| Weighted | 78.30% | 19.58% | 21.5 | 71.0% | 2.88 |
| Agreement | 44.53% | 11.13% | 1.5 | 75.0% | 6.43 |

**Difference**: Agreement underperformed by -33.78% over 4 weeks

### Week-by-Week Head-to-Head

- **Weeks Weighted Won**: 4/4 (100%)
- **Weeks Agreement Won**: 0/4 (0%)
- Agreement generated **ZERO signals** in the week of Jan 12

## Key Findings

1. **Too Restrictive**: Agreement filter reduced signals by 93% (1.5 vs 21.5 per week)
2. **Missed Opportunities**: While agreement had slightly higher win rate (+4%), it missed most profitable trades
3. **Higher Volatility**: 6.43 vs 2.88 - smaller sample size led to less consistent returns
4. **Risk of Zero Signals**: One week produced no signals at all

## Conclusion

While the agreement filter successfully avoids divergent dealer/commercial scenarios, it is **too conservative** for practical use. The 60/40 weighted blend is more robust.

## Potential Future Work

1. **Soft Agreement**: Allow signals where dealer and commercial are within 1 bias level (e.g., dealer BULLISH + commercial NEUTRAL = allowed)
2. **Threshold-Based**: Use net position thresholds instead of strict bias agreement
3. **Hybrid**: Use agreement for filtering but weighted blend for final signal strength
4. **Longer Backtest**: Re-evaluate when 10+ weeks of historical data available

## Files

- `research-blended-agreement-backtest.ts` - Single week comparison script
- `research-blended-agreement-historical.ts` - Multi-week historical analysis script
- `blended-comparison-2026-02-12.md` - Single week results
- `blended-historical-20w-2026-02-12.md` - 4-week historical results

## Usage

To re-run this analysis:

```bash
# Single week (current)
npx tsx research/blended_agreement/research-blended-agreement-backtest.ts

# Historical (specify number of weeks)
npx tsx research/blended_agreement/research-blended-agreement-historical.ts 20
```

Results will be written to `reports/` directory.
