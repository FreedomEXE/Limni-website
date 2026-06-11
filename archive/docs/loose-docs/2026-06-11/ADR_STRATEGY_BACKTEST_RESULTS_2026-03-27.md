# ADR Strategy Backtest Results — 2026-03-27

## Research Session Summary

Comprehensive comparison of ADR mean-reversion across multiple bias sources,
filters, and time horizons. All tests use M5 bars from Oanda, corrected ADR
(skip most recent daily bar), Fresh Start re-entry, static 0.25x TP.

Stoch settings: K=100, Smooth=3, OB=80, OS=20 (RRanjanFX)

---

## 9-Week Results: 5 Bias Sources × Baseline vs Stoch

Period: 2026-01-19 → 2026-03-16 (9 completed weeks, 36 pairs)

| Variant | Trades | TP Hits | WC | TP Pnl | WC Pnl | Net | WR |
|---------|--------|---------|-----|--------|--------|-----|-----|
| V3 Baseline | 176 | 149 | 27 | +44.46% | -41.05% | +3.42% | 84.7% |
| V3 + Stoch | 187 | 168 | 19 | +53.37% | -25.09% | +28.28% | 89.8% |
| Sentiment Baseline | 423 | 352 | 71 | +93.41% | -69.78% | +23.63% | 83.2% |
| Sentiment + Stoch | 435 | 377 | 58 | +103.12% | -49.17% | +53.94% | 86.7% |
| Dealer Baseline | 384 | 304 | 80 | +128.43% | -141.25% | -12.81% | 79.2% |
| Dealer + Stoch | 414 | 352 | 62 | +164.23% | -74.49% | +89.74% | 85.0% |
| Commercial Baseline | 385 | 313 | 72 | +147.02% | -147.51% | -0.50% | 81.3% |
| Commercial + Stoch | 374 | 314 | 60 | +142.81% | -89.52% | +53.29% | 84.0% |
| Neutral Baseline | 1196 | 950 | 246 | +330.07% | -368.51% | -38.44% | 79.4% |
| Neutral + Stoch | 1225 | 1021 | 204 | +371.08% | -235.05% | +136.04% | 83.3% |

### Stoch Impact (9 weeks)

| Bias Source | Base Net | Stoch Net | Delta | Base WR | Stoch WR |
|-------------|----------|-----------|-------|---------|----------|
| V3 | +3.42% | +28.28% | +24.87% | 84.7% | 89.8% |
| Sentiment | +23.63% | +53.94% | +30.32% | 83.2% | 86.7% |
| Dealer | -12.81% | +89.74% | +102.55% | 79.2% | 85.0% |
| Commercial | -0.50% | +53.29% | +53.79% | 81.3% | 84.0% |
| Neutral | -38.44% | +136.04% | +174.47% | 79.4% | 83.3% |

---

## 26-Week Extended Results: Dealer vs Commercial vs Neutral

Period: 2025-09-16 → 2026-03-10 (26 weeks, 36 pairs)

| Variant | Trades | TP | WC | Net | WR |
|---------|--------|-----|-----|-----|-----|
| Dealer Baseline | 733 | 550 | 183 | +2.79% | 75.0% |
| Dealer + Stoch | 751 | 597 | 154 | +99.21% | 79.5% |
| Commercial Baseline | 761 | 575 | 186 | +36.10% | 75.6% |
| Commercial + Stoch | 741 | 583 | 158 | +65.58% | 78.7% |
| Neutral Baseline | 2468 | 1855 | 613 | -11.03% | 75.2% |
| Neutral + Stoch | 2485 | 1956 | 529 | +188.95% | 78.7% |

### Risk Metrics (26 weeks)

| Metric | Dealer | Dealer+S | Commercial | Comm+S | Neutral | Neut+S |
|--------|--------|----------|------------|--------|---------|--------|
| Final Return | +2.79% | +99.21% | +36.10% | +65.58% | -11.03% | +188.95% |
| Max Drawdown | -14.87% | -9.64% | -10.67% | -4.07% | -35.78% | -13.20% |
| Worst Week | -12.37% | -9.49% | -10.31% | -9.99% | -24.70% | -16.00% |
| Losing Weeks | 14/26 | 8/26 | 12/26 | 9/26 | 16/26 | 7/26 |

---

## Agreement Test (9 weeks)

| Variant | Trades | Net Base | Net Stoch | Base WR | Stoch WR | Return/Trade (Stoch) |
|---------|--------|----------|-----------|---------|----------|---------------------|
| Dealer | 384 | -12.81% | +89.74% | 79.2% | 85.0% | 0.217% |
| Commercial | 385 | -0.50% | +53.29% | 81.3% | 84.0% | 0.142% |
| Sentiment | 423 | +23.63% | +53.94% | 83.2% | 86.7% | 0.124% |
| 2-of-3 Agree | 237 | +20.11% | +47.70% | 84.8% | 88.4% | 0.191% |
| 3-of-3 Agree | 37 | +5.15% | +22.00% | 81.1% | 84.6% | 0.564% |
| V3 (ref) | 176 | +3.42% | +28.28% | 84.7% | 89.8% | 0.151% |

### Signals per week (avg): Dealer ~23, Comm ~23, Sent ~27, 2of3 ~16, 3of3 ~3, V3 ~10

---

## Tandem vs Agreement Test (9 weeks, all Stoch)

Tandem = dealer + commercial + sentiment running independently, combined P&L.
Agreement = only trade when 2-of-3 models agree on direction.

| Metric | Tandem (3 indep) | 2-of-3 Agreement |
|--------|-----------------|-----------------|
| Net Return | +196.97% | +47.70% |
| Trades | 1,223 | 250 |
| Win Rate | 85.3% | 88.4% |
| Return/Trade | 0.161%/t | 0.191%/t |
| Max Drawdown | -0.61% | -4.35% |
| Losing Weeks | 1/9 | 1/9 |
| Worst Week | -0.61% | -4.35% |

### Per-model contribution (tandem)
- Dealer: +89.74% (46%)
- Commercial: +53.29% (27%)
- Sentiment: +53.94% (27%)

### Signal alignment: 192/324 pair-weeks had conflicting signals (natural hedging)

### Per asset class (tandem vs agreement)
- FX: +41.64% vs +13.90%
- Commodities: +57.85% vs +0.81%
- Indices: +21.44% vs +7.02%
- Crypto: +76.04% vs +25.98%

---

## Key Findings

1. **Stoch confirmation is the single most impactful improvement** regardless of bias source
2. **Tandem (3 independent models + stoch) is the highest-return approach** (+196.97%) with lowest drawdown (-0.61%)
3. **Conflicting positions between models create natural hedging** — 192/324 pair-weeks conflicted but this REDUCED drawdowns
4. **2-of-3 agreement has best per-trade efficiency** (0.191%/t, 88.4% WR) but fewer trades and worse drawdowns than tandem
5. **Sentiment is the only standalone signal profitable without stoch** (+23.63%)
6. **Commercial has the cleanest 26-week equity curve** (max DD -4.07% with stoch)
7. **Dealer + Stoch has highest 26-week return** (+99.21%) but rougher equity curve
8. **Neutral is not tradeable without stoch** and has violent swings even with it
9. **Direction matters** — neutral loses -38.44% baseline over 9 weeks
10. **Dealer and commercial disagree 7-8 out of 8 FX currencies every week**

---

## Grid Overlay Results (9 weeks, 36 pairs)

Grid: 0.25 ADR step, 2x ADR max depth (max 5 positions), Net Profit TP.
Stoch confirms first entry, grid auto-adds at deeper levels.

| Variant | Net Return | Trades | WR | Max Pos | Max DD |
|---------|-----------|--------|-----|---------|--------|
| Tandem + Stoch (no grid) | +196.97% | 1,223 | 85.3% | 1 | -0.61% |
| Tandem + Grid 0.25x TP | +195.18% | 1,309 | 90.0% | 5 | -49.83% |
| Tandem + Grid 0.5x TP | +318.85% | 1,054 | 76.3% | 5 | -59.80% |
| Agree + Stoch (no grid) | +47.70% | 250 | 88.4% | 1 | -4.35% |
| Agree + Grid 0.25x TP | +74.77% | 264 | 92.0% | 5 | -39.40% |
| Agree + Grid 0.5x TP | +168.53% | 218 | 80.7% | 5 | -30.12% |

### Key insight: Grid amplifies returns BUT introduces massive drawdowns
- Grid adds little to tandem (conflicting positions already create natural averaging)
- Grid shines on agreement where one clean direction gets scaled in deeper
- Tandem + Stoch (no grid) has the best risk-adjusted return: +197% with -0.61% DD

---

## Strategy Candidates (ranked by risk-adjusted return)

1. **Tandem + Stoch** — +196.97%, -0.61% DD, 85.3% WR, 1223 trades
2. **Agree + Grid 0.5x** — +168.53%, -30.12% DD, 80.7% WR, 218 trades
3. **Agree + Stoch** — +47.70%, -4.35% DD, 88.4% WR, 250 trades
4. **Tandem + Grid 0.5x** — +318.85%, -59.80% DD, 76.3% WR, 1054 trades

Next steps: Automation for forward testing (tandem is hard to verify manually)
