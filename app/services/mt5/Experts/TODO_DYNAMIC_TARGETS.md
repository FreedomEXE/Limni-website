# Dynamic Profit Targets for Position-Limited Brokers

## Problem

Some brokers (especially demo accounts and prop firms) have a maximum position limit (commonly 200 positions). With the current EA settings:

- `LotSizePerAdd = 0.05`
- `BasketLotCapPer100k = 10.0` (target: 10 lots max)
- 14 pairs trading
- ~14 positions per pair = **196 total positions**

**Current setup hits the 200 position limit**, which means:
- **Actual exposure: ~10 lots** (200 × 0.05 = 10.0 lots)
- **Target profit: $1,500** (designed for 10 lots)
- **Problem: Can't reach profit target** with only 2 lots deployed

## Potential Solution: Dynamic Profit Targets

Instead of a fixed $1,500 profit target, scale the targets proportionally to actual lot exposure:

### Current System (Fixed)
```
TrailingStartPct = 1.5%  (~$1,500 on $100k account)
TrailingStepPct = 0.5%   (~$500 step)
```

### Proposed System (Dynamic)
```mql5
double GetBasketProfitTarget() {
  double totalLots = GetTotalLots(); // Sum all position lots
  double equity = AccountInfoDouble(ACCOUNT_EQUITY);
  double cap = (equity / 100000.0) * BasketLotCapPer100k;

  // Scale profit target proportionally to exposure vs cap
  double exposureRatio = totalLots / cap;

  // At 2 lots: 2/10 × $1,500 = $300
  // At 10 lots: 10/10 × $1,500 = $1,500
  return 1500.0 * exposureRatio;
}

double GetTrailingStep() {
  double totalLots = GetTotalLots();
  double equity = AccountInfoDouble(ACCOUNT_EQUITY);
  double cap = (equity / 100000.0) * BasketLotCapPer100k;
  double exposureRatio = totalLots / cap;

  // At 2 lots: 2/10 × $500 = $100
  // At 10 lots: 10/10 × $500 = $500
  return 500.0 * exposureRatio;
}
```

### Example Scenarios

**200 position limit (2 lots total):**
- Trail start: $300
- Trail step: $100
- More achievable targets with limited exposure

**Unlimited positions (10 lots total):**
- Trail start: $1,500
- Trail step: $500
- Original targets maintained

## Benefits

1. ✅ **Adapts automatically** to broker limitations
2. ✅ **Maintains basket logic** - no need to close trades early
3. ✅ **Uses 0.05 lot size** - aligns 200 trade cap with 10 lot exposure
4. ✅ **Faster turnover** with lower targets = more weekly baskets
5. ✅ **Works with any broker** - whether limit is 200, 500, or unlimited

## Alternative: Increase Lot Size

Instead of dynamic targets, could simply increase `LotSizePerAdd`:

| Broker Limit | Lot Size | Max Exposure | Positions per Pair |
|--------------|----------|--------------|-------------------|
| 200          | 0.05     | 10 lots      | ~14               |
| 500          | 0.02     | 10 lots      | ~35               |
| Unlimited    | 0.01     | 10 lots      | 100+              |

**Downside:** Less granular, fewer positions per pair, less diversification.

## Current Status

**Testing in progress** to see if 200 positions (2 lots exposure) can reach the $1,500 target naturally. If not, implement dynamic targets.

## Implementation Notes

If implementing this solution:

1. Add `GetBasketProfitTarget()` and `GetTrailingStep()` helper functions
2. Replace hardcoded percentage calculations with dynamic dollar amounts
3. Update trailing logic to use dynamic targets
4. Log when dynamic scaling is active for visibility
5. Consider making base targets configurable inputs (`BaseTrailTarget = 1500.0`, `BaseTrailStep = 500.0`)

## Date

2026-01-14
