# Katarakti Phase 2 — Handshake via Correlation Groups

> Status: DESIGN — Depends on Phase 1 backtest results
> Author: Freedom + Claude (CTO)
> Date: 2026-02-27

---

## Concept

In the Bitget V2 crypto bot, the handshake requirement (BTC + ETH must both signal within 60 minutes) raised win rate from ~50% to 87.5%. The same principle applies to FX/indices/commodities — correlated instruments should confirm each other before entry.

**Core idea**: When a pair generates a Katarakti sweep signal, don't enter immediately. Wait for at least N correlated pairs to also signal in the same direction within the same session window. Enter the group together.

This exploits the same market mechanics:
- Correlated pairs move together on macro flows (risk-on/off, USD strength, commodity cycles)
- If only ONE pair sweeps and reverses, it may be noise
- If MULTIPLE correlated pairs sweep and reverse, it's likely a real institutional flow

---

## Correlation Data Source

### Myfxbook Correlation Heatmap

We already have myfxbook integration (`src/lib/sentiment/providers/myfxbook.ts`) with session caching and symbol mapping. Myfxbook provides correlation matrices for all major FX pairs, indices, and commodities.

**What we need from myfxbook:**
- Pairwise correlation coefficients (e.g. AUDUSD vs AUDCAD = +0.85)
- Multiple timeframes: daily, weekly (weekly aligns with our bias period)
- Updated at least weekly (correlation shifts over time)

**API endpoint**: `https://www.myfxbook.com/api/get-community-outlook.json` gives sentiment, but for correlation we need to either:
1. Scrape the correlation page (`myfxbook.com/forex-correlation`)
2. Use their API if a correlation endpoint exists
3. Calculate our own from the 1h candle data we already have in DB

**Recommendation**: Calculate our own. We have 1h candles for all 36 pairs. A rolling 4-week Pearson correlation on 1h returns gives us a fresh, customizable correlation matrix every week. No external dependency.

---

## Correlation Group Design

### Building the Groups

For each pair, identify its **correlation cluster** — the set of pairs with correlation above a threshold.

| Correlation | Relationship | Example |
|-------------|-------------|---------|
| ≥ +0.70 | **Positive correlation** — same direction handshake | AUDUSD + NZDUSD |
| ≤ -0.70 | **Anti-correlation** — opposite direction handshake | EURUSD + USDCHF |
| -0.70 to +0.70 | **Uncorrelated** — no handshake value | EURUSD + USDJPY (sometimes) |

**Anti-correlation is equally valuable**: If EURUSD sweeps LOW (long signal) and USDCHF sweeps HIGH (short signal) in the same session, that's a USD-weakness handshake. Both signals confirm the same macro flow from opposite sides.

### Example Correlation Clusters

Based on typical FX correlations:

| Cluster | Pairs | Common Driver |
|---------|-------|---------------|
| **AUD block** | AUDUSD, AUDCAD, AUDNZD, AUDJPY | Risk sentiment, commodity demand |
| **EUR block** | EURUSD, EURGBP, EURJPY, EURCHF | ECB policy, EU data |
| **USD strength** | EURUSD(-), GBPUSD(-), AUDUSD(-), USDCAD(+), USDJPY(+), USDCHF(+) | Fed policy, risk flows |
| **Commodity** | XAUUSD, XAGUSD, AUDUSD | Real rates, inflation |
| **Risk proxy** | USDJPY, SPXUSD, NDXUSD | Risk-on/risk-off |

### Dynamic vs Static Groups

**Phase 2a (simpler)**: Use static correlation groups based on known macro relationships. Hardcode clusters.

**Phase 2b (better)**: Compute rolling 4-week correlation matrix from 1h candle data. Rebuild clusters every Sunday before the week starts. This adapts to regime changes (e.g., JPY pairs decouple from risk during BOJ intervention periods).

---

## Handshake Logic

### Entry Flow with Handshake

```
1. Pair A generates a Katarakti sweep signal (sweep + rejection + displacement)
2. Check: does Pair A belong to any correlation cluster?
3. If yes: hold the signal — don't enter yet
4. Scan the same session window for other signals in the cluster:
   - Positively correlated pairs: must signal in SAME direction
   - Anti-correlated pairs: must signal in OPPOSITE direction
5. Count confirming signals
6. If confirming_signals >= HANDSHAKE_THRESHOLD → enter ALL confirming pairs together
7. If session window ends without enough confirmations → discard signal
```

### Handshake Parameters

| Parameter | Value | Notes |
|-----------|-------|-------|
| **Correlation threshold** | ±0.70 | Minimum absolute correlation to be in same cluster |
| **Handshake threshold** | 2 | Minimum confirming pairs needed (including the trigger pair) |
| **Time window** | Same session window | Signals must occur in the same Asia→London/NY or NY→Asia/London window |
| **Anti-correlation handling** | Opposite direction counts as confirmation | EURUSD long + USDCHF short = valid handshake |

### Sizing with Handshake

When a handshake triggers, all confirming pairs enter together:
- Same 1% risk per trade per pair
- But consider: correlated entries have correlated risk
- **Portfolio correlation adjustment** (optional): If 4 highly correlated pairs enter together, effective risk is closer to 4% than 4 independent 1% bets
- May need to reduce per-trade risk when handshake group size > 3

---

## Backtest Plan (Phase 2)

After Phase 1 validates the base Katarakti system:

1. **Compute correlation matrix** from 1h candle data for the 5-week period (use prior 4 weeks of data for each week's matrix)
2. **Build clusters** using ±0.70 threshold
3. **Re-run Katarakti backtest** with handshake gate enabled
4. **Compare**: Katarakti without handshake vs with handshake
5. **Sweep handshake threshold**: Test 2, 3, 4 confirming pairs required
6. **Test anti-correlation**: Run with and without anti-correlated confirmations

### Key Questions to Answer

- Does handshake improve win rate (like it did for crypto)?
- How many trades does it filter out? (If it kills 80% of trades, the return may drop even if WR improves)
- What's the optimal handshake threshold for the 36-pair universe?
- Do anti-correlated confirmations add signal or just noise?

---

## Data Requirements

### For Backtest
- 1h candle data for all 36 pairs (already have)
- 4 weeks of prior 1h data for correlation matrix seeding (need to verify coverage)

### For Live Implementation
- Rolling correlation matrix computed every Sunday
- Stored in DB for dashboard display
- Used by Katarakti engine for real-time handshake gating

### For Website Heatmap
- See: `CORRELATION_HEATMAP_IMPLEMENTATION.md` (separate doc)
