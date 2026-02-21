# Eightcap 100k V3 Tier Test (Week of Feb 16, 2026)

Generated: 2026-02-21T21:31:35.826Z
Week: 2026-02-16T00:00:00.000Z
Account: 7936840 (Tyrell Tsolakis - USD 004)
Sizing source: frozen_week_plan
Lot map rows: 112

## Live V1 Reference
- Closed PnL: +$65809.64 (+65.81%)
- Closed trades: 75

## Baseline Systems

### V1 (as-is, GOD mode 1:1)
- Margin used: +$78936.88
- Legs: 110 (priced 110, wins 69)
- PnL on 100k: +$44380.22 (+44.38%)

### V2 (as-is)
- Margin used: +$45820.12
- Legs: 62 (priced 62, wins 44)
- PnL on 100k: +$42163.29 (+42.16%)

## V3 Tier Structure
- Tier 1 trades: 3
- Tier 2 trades: 16
- Tier 3 trades: 9
- Total candidate trades: 28

## V3 Tier Performance (Equal 1x Weight)
- Tier 1: 3 trades (priced 3), wins 2, win rate 66.67%, sum return +1.11%, avg/trade +0.37%
- Tier 2: 16 trades (priced 16), wins 10, win rate 62.50%, sum return +5.90%, avg/trade +0.37%
- Tier 3: 9 trades (priced 9), wins 7, win rate 77.78%, sum return +5.11%, avg/trade +0.57%

## Tier 3 Trade List
- AUDCAD | LONG | L/N/N | +0.80%
- AUDJPY | LONG | L/N/N | +1.81%
- CADJPY | LONG | L/N/N | +1.02%
- EURAUD | SHORT | S/N/N | +1.01%
- EURJPY | LONG | L/N/N | +0.79%
- GBPCHF | SHORT | S/N/N | +0.31%
- GBPNZD | SHORT | S/N/N | +0.36%
- NZDCHF | SHORT | S/N/N | -0.05%
- USDCHF | SHORT | S/N/N | -0.94%

## V3 Scenarios (Base)

### All tiers (1x/1x/1x)
- Margin used: +$16572.67
- Trades: 28 (priced 28, wins 19)
- PnL on 100k: +$12087.70 (+12.09%)

### Tier 1 only
- Margin used: +$10492.02
- Trades: 3 (priced 3, wins 2)
- PnL on 100k: +$1108.46 (+1.11%)

### Tier 2 only
- Margin used: +$4285.84
- Trades: 16 (priced 16, wins 10)
- PnL on 100k: +$5888.82 (+5.89%)

### Tier 3 only
- Margin used: +$1794.81
- Trades: 9 (priced 9, wins 7)
- PnL on 100k: +$5090.42 (+5.09%)

### Tier3 focus (1x/1x/2x)
- Margin used: +$18367.48
- Trades: 28 (priced 28, wins 19)
- PnL on 100k: +$17178.13 (+17.18%)

### Tier3 focus (0x/1x/2x)
- Margin used: +$7875.46
- Trades: 25 (priced 25, wins 17)
- PnL on 100k: +$16069.66 (+16.07%)

## V3 Scenarios (Scaled To V1 Margin Budget)
- V1 margin budget: +$78936.88

### All tiers (1x/1x/1x) (4.7631x)
- Margin used: +$78936.88
- Trades: 28 (priced 28, wins 19)
- PnL on 100k: +$57574.63 (+57.57%)

### Tier 1 only (7.5235x)
- Margin used: +$78936.88
- Trades: 3 (priced 3, wins 2)
- PnL on 100k: +$8339.52 (+8.34%)

### Tier 2 only (18.4181x)
- Margin used: +$78936.88
- Trades: 16 (priced 16, wins 10)
- PnL on 100k: +$108460.67 (+108.46%)

### Tier 3 only (43.9806x)
- Margin used: +$78936.88
- Trades: 9 (priced 9, wins 7)
- PnL on 100k: +$223879.89 (+223.88%)

### Tier3 focus (1x/1x/2x) (4.2976x)
- Margin used: +$78936.88
- Trades: 28 (priced 28, wins 19)
- PnL on 100k: +$73825.48 (+73.83%)

### Tier3 focus (0x/1x/2x) (10.0231x)
- Margin used: +$78936.88
- Trades: 25 (priced 25, wins 17)
- PnL on 100k: +$161068.54 (+161.07%)

## Assumptions
- V1 and V2 keep existing basket behavior and use lot_map-based USD conversion.
- V3 is computed as agreement vote tiers from dealer/commercial/sentiment (not antikythera-only).
- Trade USD move uses lot_map.move_1pct_usd; margin uses lot_map.margin_required.
- Normalized scenarios scale each strategy to the same margin budget used by V1 base.

JSON: `reports/eightcap-100k-v3-tier-test-2026-02-21.json`