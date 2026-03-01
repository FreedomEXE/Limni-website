# Bitget Bot V3 Research Session - March 1, 2026

> Research session by Freedom + Claude (CTO). All results from 5-week backtest period (2026-01-19 to 2026-02-16). Weekly bias was SHORT/HIGH for both BTC and ETH across all weeks.

---

## V2 Live Bot Updates (Deployed This Session)

1. **Sundays enabled** - removed Sunday skip from `bitgetBotEngine.ts`
2. **UNQUALIFIED signal tracking** - near-miss sweeps logged to `bitget_bot_signals` with status `UNQUALIFIED` and metadata containing reason (`no_rejection`, `no_displacement`, `wrong_direction`)
3. **UI updated** - amber badges for UNQUALIFIED in `SignalLogTab.tsx`, reason displayed in handshake group column
4. **Dashboard query** - UNQUALIFIED priority added to signal dedup ordering

### Files Modified:
- `src/lib/bitgetBotSignals.ts` - added `UnqualifiedSweep` type, `bestUnqualified` tracking in `detectSignalForWindow()`
- `src/lib/bitgetBotEngine.ts` - removed Sunday skip, added UNQUALIFIED signal insertion
- `src/lib/bitgetBotDashboard.ts` - UNQUALIFIED priority in CASE ordering
- `src/components/bitget-bot/SignalLogTab.tsx` - amber styling, reason labels, info box update

---

## V2 Baseline (Current Live System)

**Rules:** Sweep (min 0.1%, or 0.3% for neutral tier) + rejection (close back inside range) + displacement (>=0.1% body) + handshake (BTC+ETH within 60 min) + scaling exit (milestones, BE stop, trailing stop, week close)

| Metric | Value |
|---|---|
| Trades | 16 |
| Win Rate | 87.50% |
| Total PnL (USD) | $661.52 |
| Max Drawdown | 3.08% |
| Profit Factor | 14.07 |
| NY Entry (single session) | 12 trades, 83.33% WR, $379.47 PnL |
| Asia+London Entry (two sessions) | 4 trades, 100% WR, $282.05 PnL |

### Individual V2 Trades:
| Date | Symbol | Direction | Session Window | Exit Reason | PnL USD | Result |
|---|---|---|---|---|---|---|
| Jan 21 | ETH | SHORT | ASIA_LONDON_RANGE_NY_ENTRY | TRAILING_STOP | +$39.87 | WIN |
| Jan 21 | BTC | SHORT | ASIA_LONDON_RANGE_NY_ENTRY | TRAILING_STOP | +$20.27 | WIN |
| Jan 23 | ETH | SHORT | ASIA_LONDON_RANGE_NY_ENTRY | TRAILING_STOP | +$40.54 | WIN |
| Jan 23 | BTC | SHORT | ASIA_LONDON_RANGE_NY_ENTRY | WEEK_CLOSE | +$48.65 | WIN |
| Jan 26 | ETH | SHORT | ASIA_LONDON_RANGE_NY_ENTRY | TRAILING_STOP | +$44.75 | WIN |
| Jan 26 | BTC | SHORT | ASIA_LONDON_RANGE_NY_ENTRY | TRAILING_STOP | +$51.77 | WIN |
| Jan 28 | ETH | SHORT | US_RANGE_ASIA_LONDON_ENTRY | TRAILING_STOP | +$79.45 | WIN |
| Jan 28 | BTC | SHORT | US_RANGE_ASIA_LONDON_ENTRY | TRAILING_STOP | +$75.47 | WIN |
| Feb 13 | BTC | SHORT | ASIA_LONDON_RANGE_NY_ENTRY | WEEK_CLOSE | -$43.48 | LOSS |
| Feb 13 | ETH | SHORT | ASIA_LONDON_RANGE_NY_ENTRY | WEEK_CLOSE | +$0.32 | WIN |
| Feb 16 | ETH | SHORT | ASIA_LONDON_RANGE_NY_ENTRY | TRAILING_STOP | +$36.36 | WIN |
| Feb 16 | BTC | SHORT | ASIA_LONDON_RANGE_NY_ENTRY | TRAILING_STOP | +$33.20 | WIN |

---

## All Tests Conducted

### Test 1: 240-min Handshake Window - REJECTED
- **Hypothesis:** Widening handshake from 60 to 240 minutes captures more correlated sweeps
- **Result:** 26 trades, 76.92% WR, 23.64% DD. Quality degrades significantly.
- **Conclusion:** The 60-minute window is a quality gate, not a limitation.

### Test 2: Variant M (Sweep Only + 4H Close Entry) - REJECTED for bot
- **Hypothesis:** Simplified entry - just sweep detection, no rejection/displacement, enter at 4H candle close
- **Result:** 36 trades, 63.89% WR, 23.64% DD
- **Conclusion:** Confirms complex logic adds real edge. Useful for Freedom's manual trading framework.

### Test 3: Sunday Inclusion - NEUTRAL
- **Hypothesis:** Including Sundays may add or hurt performance
- **Result:** No impact on results. Enabled in live bot.

### Test 4: Overshoot Analysis (370 Bias-Aligned SHORT Sweeps) - INFORMATIONAL
- **Hypothesis:** Sweeps cluster at a predictable overshoot distance, enabling a "deviation block" entry zone
- **Result:**
  - 370 SHORT sweeps (all bias-aligned due to SHORT/HIGH every week)
  - Median overshoot: 0.159%, mean: 0.348%, std dev: 0.667
  - P25: 0.072, P75: 0.380, P90: 0.703, Max: 6.974%
  - 96.22% re-enter range before session close
  - Median time to re-entry: 0 minutes (same candle wicks)
  - Distribution too spread for fixed deviation block
- **Scripts:** `analyze-bitget-v2-overshoot.ts`, `analyze-bitget-v2-overshoot-by-bias.ts`

### Test 5: Sensitivity Grid (Fixed Stop/Target on 370 Sweeps) - INFORMATIONAL
- **Hypothesis:** There's a stop/target combination that extracts edge from raw sweeps
- **Result:**
  - Scalper profile: 0.25% target, 0.75-1% stop -> 73-77% WR, PF ~1.3, tiny edge per trade
  - Swinger profile: 50% range target, 0.5% stop -> 24-25% WR, PF 1.82, bigger edge
  - Naive range-low target: 5.95% WR - not viable
- **Script:** `analyze-bitget-v2-short-sweep-sensitivity-grid.ts`

### Test 6: Raw Sweeps + Scaling Exit (370 Trades) - PROMISING
- **Hypothesis:** Applying V2's scaling exit engine to ALL sweeps (no entry filters) finds edge
- **Result:** 370 trades, 72.70% WR, 0 stop losses, PF 5.78, $3,704 PnL (5x), 15.09% DD
- **Key insight:** The scaling exit engine IS the edge, not the entry filters
- **Script:** `analyze-bitget-v2-short-sweep-scaling-exit.ts`

### Test 7: V3 Sustained Deviation + Two-Session Re-entry + Scaling Exit - BEST NEW SYSTEM
- **Hypothesis:** Requiring sustained deviation (price holds beyond range for N minutes) before entering on re-entry is a simpler, more robust quality filter than rejection + displacement + handshake
- **Results:**

| Threshold | Trades | WR % | Total PnL $ (5x) | Max DD % | PF | Avg PnL/trade |
|---|---|---|---|---|---|---|
| N=1 | 37 | 75.68% | $3,704.94 | 15.09% | 5.78 | $100.13 |
| N=3 | 33 | 75.76% | $3,108.08 | 16.61% | 5.10 | $94.18 |
| N=5 | 32 | 75.00% | $2,905.19 | 16.60% | 4.84 | $90.79 |
| N=10 | 29 | 75.86% | $2,761.55 | 16.59% | 4.66 | $95.23 |
| N=15 | 27 | 74.07% | $2,797.20 | 15.52% | 4.74 | $103.60 |
| **N=30** | **19** | **84.21%** | **$2,596.74** | **8.32%** | **9.29** | **$136.67** |
| V2 baseline | 16 | 87.50% | $661.52 | 3.08% | 14.07 | ~$41.35 |

- **Key finding:** N=30 nearly replicates V2 quality (84.21% vs 87.5% WR, PF 9.29 vs 14.07) with far simpler logic
- **WR is stable 74-76% from N=1 to N=15, then jumps to 84% at N=30** - quality cliff at 30 minutes
- **Script:** `analyze-bitget-v3-sustained-reentry-backtest.ts`

### Test 8: V2 + Double Session Window (Extend NY into Asia) - NO IMPACT
- **Hypothesis:** Giving NY entries a second session (extending into next Asia) catches more qualified signals
- **Result:** Identical to baseline. Zero new trades, zero lost trades.
- **Conclusion:** Window length isn't the bottleneck - filter strictness (rejection + displacement + handshake) is what blocks trades. Extending time doesn't create new qualified signals.
- **Script:** `analyze-bitget-v2-double-session-window.ts`

---

## V3 System Rules (Best Version: N=30)

1. **Range building:** Build session range (Asia+London or US) - same as V2
2. **Sweep detection:** Price breaches range high (for SHORT) or low (for LONG), minimum sweep % per bias tier - same as V2
3. **Sustained deviation:** Price must hold beyond range boundary for >= 30 consecutive 1-minute candles. This filters same-candle wicks and noise breaches.
4. **Two-session re-entry window:** Wait for a 1m candle that closes back inside the range. Window spans current session + next session:
   - Sweep during NY (13:00-21:00): window = NY + next Asia (until 08:00 next day)
   - Sweep during Asia (00:00-08:00): window = Asia + London (until 13:00)
   - Sweep during London (08:00-13:00): window = London + NY (until 21:00)
5. **One trade per range per symbol:** Once entered, no more entries against that range
6. **Entry:** At the close of the first 1m candle that closes back inside the range after sustained deviation confirmed
7. **Exit:** Same scaling engine as V2 (milestones, BE stop, trailing stop, week close)
8. **NO rejection pattern, NO displacement body check, NO handshake correlation required**

---

## Key Insights

1. **The scaling exit engine is the primary edge, not the entry filters.** Applying V2's exit logic to raw sweeps produces 72.7% WR with 0 stop losses.

2. **30 minutes of sustained deviation does the same filtering job as rejection + displacement + handshake.** Price holding beyond the range for 30 minutes proves it's a real liquidity grab, not a noise wick. The re-entry after that IS the rejection.

3. **V2's complexity is a liability in production.** More things can go wrong (displacement threshold misses like the 0.084% vs 0.10% observed live, handshake timing misses). V3's single time-based filter is more robust.

4. **Extending V2's entry windows doesn't help.** The bottleneck is filter strictness, not window length. Double session with V2 logic produced zero new trades.

5. **370 raw sweeps reduce to 37 unique range entries.** The one-per-range dedup removes 333 redundant sweeps. The 370-trade and 37-trade versions have identical PnL ($3,704) and PF (5.78).

6. **Two-session entry window for US_RANGE already outperforms.** Asia+London entry = 100% WR, $282 PnL vs NY entry = 83.3% WR, $379 PnL. More time = better results.

---

## Final Comparison Table

| System | Trades | WR % | Max DD % | PF | Total PnL (5x) | Complexity | Production Risk |
|---|---|---|---|---|---|---|---|
| V2 Baseline | 16 | 87.50 | 3.08 | 14.07 | $661.52 | High | Higher (many filters) |
| V3 N=30 | 19 | 84.21 | 8.32 | 9.29 | $2,596.74 | **Low** | **Low** (one filter) |
| V3 N=1 | 37 | 75.68 | 15.09 | 5.78 | $3,704.94 | **Low** | **Low** (one filter) |

---

## Open Questions for Future Sessions

1. **PnL normalization:** V2 ($661) and V3 ($2,596) use different position sizing calculations. Need apples-to-apples comparison.
2. **Regime diversity:** All 5 weeks had SHORT/HIGH bias. V3 needs validation in LONG and NEUTRAL bias regimes.
3. **Concurrency modeling:** V3-N1 (37 trades) needs position sizing analysis for concurrent positions.
4. **Live observation:** Deploy V3 signal tracking alongside V2 (paper trade) to compare in real-time.
5. **Combined system:** Could V2 and V3 run simultaneously on separate equity allocations?

---

## Test 9: V3 Crypto Alt Universe (31 Symbols) — SCALES BEAUTIFULLY

**Hypothesis:** V3 sustained deviation entry works across the crypto alt universe, not just BTC/ETH.

**Setup:** V3 N=30 applied to 29 alts + BTC + ETH (31 total). Weekly bias uses BTC's SHORT/HIGH as proxy for all alts. Correlation vs BTC measured per week.

### Portfolio Results

| Scope | Trades | WR % | Total PnL (5x) | PF | Max DD % |
|---|---|---|---|---|---|
| BTC+ETH only | 19 | 84.21% | $2,596 | 9.29 | 8.32% |
| **Full universe (31 symbols)** | **208** | **70.67%** | **$15,772** | **3.20** | **28.76%** |
| High-corr alts (>0.75) | 121 | 68.60% | $9,715 | 3.67 | — |
| Medium-corr alts (0.50-0.75) | 68 | 70.59% | $3,460 | 2.08 | — |

### Correlation Matrix (vs BTC, hourly returns, average across 5 weeks)

**High correlation (>0.75) — recommended for V3:**
SOL (0.854), LINK (0.852), DOGE (0.818), BNB (0.813), AVAX (0.813), ADA (0.808), SUI (0.806), AAVE (0.806), XRP (0.796), ONDO (0.787), PENGU (0.784), SEI (0.779), SHIB (0.778), ENA (0.771), DOT (0.759)

**Medium correlation (0.50-0.75) — usable but weaker edge:**
NEAR (0.749), HBAR (0.749), PEPE (0.729), LTC (0.729), TAO (0.727), FARTCOIN (0.714), APT (0.704), VIRTUAL (0.697), UNI (0.686), WLD (0.671), PUMP (0.629), BCH (0.623), ASTER (0.579), HYPE (0.552)

### Top 10 Alts by Profit Factor

| Rank | Symbol | Correlation | Trades | WR % | PnL (5x) | PF |
|---|---|---|---|---|---|---|
| 1 | XRP | 0.796 | 10 | 100% | $1,590.90 | INF |
| 2 | SUI | 0.806 | 9 | 100% | $1,067.82 | INF |
| 3 | LTC | 0.729 | 8 | 100% | $923.66 | INF |
| 4 | HBAR | 0.749 | 7 | 100% | $838.81 | INF |
| 5 | HYPE | 0.552 | 7 | 100% | $793.11 | INF |
| 6 | SHIB | 0.778 | 5 | 100% | $627.11 | INF |
| 7 | PUMP | 0.629 | 3 | 100% | $363.49 | INF |
| 8 | APT | 0.704 | 2 | 100% | $341.68 | INF |
| 9 | FARTCOIN | 0.714 | 2 | 100% | $163.74 | INF |
| 10 | SEI | 0.779 | 2 | 100% | $160.79 | INF |

### Cut List (negative or marginal alts)

| Symbol | Correlation | Trades | PnL | PF | Action |
|---|---|---|---|---|---|
| ASTER | 0.579 | 5 | -$1,273.12 | 0.15 | **CUT** |
| PENGU | 0.784 | 7 | -$206.31 | 0.64 | **CUT** |
| WLD | 0.671 | 2 | $0.00 | 0.00 | MONITOR |
| PEPE | 0.729 | 11 | $17.70 | 1.02 | MONITOR |

**Script:** `analyze-bitget-v3-alt-universe-correlation-backtest.ts`

---

## Test 10: Katarakti V3 (MT5 Forex/Indices/Commodities) — DOES NOT PORT CLEANLY

**Hypothesis:** V3 sustained deviation entry works on the 36-instrument MT5 universe using Katarakti's ATR-based exit engine.

**Setup:** V3 entry rules applied to 28 FX pairs + 3 indices + 3 commodities + BTC/ETH. ATR-based exit (BE at 1.0x ATR, Lock1 at 2.0x, Lock2 at 3.0x, trail at 3.0x+). COT dealer + commercial + sentiment bias per instrument.

### Results

| Config | Trades | WR % | PnL | PF | Max DD % |
|---|---|---|---|---|---|
| V3 N=30, 1.0% sweep | 12 | 50.00% | -$4,178 | 0.24 | 5.47% |
| V3 N=30, 0.3% sweep | 42 | 35.71% | -$4,285 | 0.31 | 6.15% |
| **V3 N=60, 1.0% sweep** | **7** | **71.43%** | **+$1,009** | **INF** | **0.00%** |
| V3 N=60, 0.3% sweep | 34 | 41.18% | +$895 | 1.84 | 1.06% |
| Current Katarakti Phase 2 | 30 | 36.67% | +$21,620 | — | — |

**Conclusion:** N=30 is negative PnL on forex — the 30-minute sustained deviation that works for crypto is too short for forex's slower tempo. N=60 shows a glimmer (71.43% WR) but only 7 trades and $1,009 PnL vs the current system's $21,620. **V3 entry does not fit the forex market's dynamics. Keep Katarakti as-is for MT5.**

**Script:** `analyze-katarakti-v3-sustained-reentry-atr-backtest.ts`
**Report:** `reports/katarakti-v3-sustained-reentry-latest.txt`

---

## Test 11 — Range-Width Normalized Exit (MT5)

**Hypothesis:** Replace ATR exit with range-width multiples (rangeWidth = session high - low). All exit distances expressed as multiples of rangeWidth. More intuitive than ATR.

**Exit config:** Hard stop 1.5×RW, BE 0.5×RW, Lock1 1.0×/0.3×RW, Lock2 1.5×/0.8×RW, Trail 2.0×/0.75×RW

| N | Trades | WR% | PnL | PF | Max DD% | Return |
|---|---|---|---|---|---|---|
| 15 | 102 | 38.24 | -$122 | 0.93 | 6.73% | -1.22% |
| 30 | 94 | 37.23 | +$589 | 1.39 | 4.84% | +5.89% |
| **45** | **94** | **35.11** | **+$882** | **1.61** | **3.91%** | **+8.82%** |
| 60 | 87 | 32.18 | +$554 | 1.42 | 4.34% | +5.54% |

**Follow-up — tighter exit multiplier grids (N=45):**

| Grid | Return | DD | PF |
|---|---|---|---|
| Baseline | +8.82% | 3.91% | 1.61 |
| Mid | +7.74% | 3.43% | 1.61 |
| Aggressive | +2.02% | 3.49% | 1.16 |

**Conclusion:** Tightening exits HURT — trailing rate dropped from 11.7% to 4%. Range-width can't match ATR (Phase 2: +21.62%, 0.56% DD, PF 36.85). ATR smooths volatility over 14 periods; range-width uses single session = noisy.

**Commodity investigation:** XAUUSD/XAGUSD/WTIUSD had zero trades — all NEUTRAL bias every week. Data/mapping is fine. Bias gate blocks them.

**Scripts:** `analyze-katarakti-rangewidth-backtest.ts`
**Reports:** `katarakti-v3-rangewidth-latest.txt`, `katarakti-v3-rangewidth-followup.txt`

---

## Test 12 — V3 Sustained Entry + ATR Exit (MT5)

**Hypothesis:** Keep the proven ATR exit engine, only simplify the entry to sustained deviation (price holds beyond range for N minutes).

| N | Trades | WR% | PnL | PF | Max DD% | Return |
|---|---|---|---|---|---|---|
| 15 | 101 | 32.67 | -$474 | 0.77 | 16.01% | -4.74% |
| 30 | 96 | 32.29 | +$327 | 1.18 | 11.87% | +3.27% |
| 45 | 85 | 28.24 | -$349 | 0.79 | 12.75% | -3.49% |
| 60 | 91 | 31.87 | +$487 | 1.28 | 11.26% | +4.87% |
| 240 | 47 | 34.04 | +$33 | 1.06 | 2.87% | +0.33% |

**Conclusion:** V3 sustained entry doesn't work for forex even with ATR exits. Best case +4.87% vs Phase 2's +21.62%. ~53% breakeven exits across all N = entries are at wrong timing. Lock_035/Lock_055 never reached (0% across all runs). Forex mean-reverts; sustained deviation catches continuation = wrong signal shape.

**Script:** `analyze-katarakti-v3-atr-exit-backtest.ts`
**Report:** `katarakti-v3-atr-exit-latest.txt`

---

## Test 13 — Katarakti Lite Ablation Ladder (MT5)

**Hypothesis:** Instead of replacing entry from scratch, strip Phase 2 entry piece by piece to find what matters.

| Variant | Trades | WR% | Return | DD | PF |
|---|---|---|---|---|---|
| Phase 2 baseline (handshake ON) | 19 | 26.32 | +10.56% | 0.33% | 29.62 |
| Remove handshake | 21 | 28.57 | +11.38% | 0.00% | INF |
| Remove displacement | 39 | 41.03 | +16.16% | 1.24% | 8.90 |
| Add close-location (40%) | 39 | 41.03 | +17.17% | 0.82% | 17.33 |
| **Add dwell (3 min)** | **39** | **46.15** | **+18.04%** | **0.82%** | **18.03** |
| Add ATR floor (0.1×) | 39 | 46.15 | +18.04% | 0.82% | 18.03 |

**Key findings:**
1. **Handshake adds nothing on forex** — removing improved returns
2. **Displacement was HURTING** — removing doubled trades, added +5% return
3. **Close-location (40%) is the replacement** — PF jumped 8.90→17.33, DD dropped 1.24%→0.82%
4. **Dwell (3 min) adds polish** — WR 41%→46%, PF 17.33→18.03
5. **ATR floor redundant** — 0.1× identical to off
6. **Trailing exits rose to 33%** — vs Phase 2's ~15%. More trades reaching runners.

**Script:** `analyze-katarakti-lite-ablation.ts`
**Report:** `katarakti-lite-ablation-latest.txt`

---

## Test 14 — Katarakti Lite Parameter Sweep (MT5)

**Grid:** dwell=[2,3,5] × close-loc=[0.35,0.40,0.45] × ATR-floor=[off,0.1,0.2,0.3]

**Top configs:**

| Config | Trades | WR% | Return | DD | PF | Return/DD |
|---|---|---|---|---|---|---|
| **d5/c0.35/off** | 39 | 48.72 | **+20.23%** | 1.59% | 11.05 | 12.72 |
| **d3/c0.40/off** | 39 | 46.15 | +18.04% | **0.82%** | **18.03** | **21.98** |
| d5/c0.40/off | 39 | 46.15 | +18.04% | 0.82% | 18.03 | 21.98 |
| d2/c0.40/off | 39 | 41.03 | +17.37% | 0.82% | 17.49 | 21.16 |

**Key pattern:** Close-location 0.40 produces 0.82% DD regardless of dwell. It's the risk control lever. Dwell is the return optimizer.

**Production candidates:**
- **Lite-Return:** d5/c0.35 → +20.23%, 1.59% DD, PF 11.05 (closest to Phase 2 return)
- **Lite-Balanced:** d3/c0.40 → +18.04%, 0.82% DD, PF 18.03 (best risk-adjusted)

**Script:** `analyze-katarakti-lite-parameter-sweep.ts`
**Report:** `katarakti-lite-parameter-sweep-latest.txt`

---

## Test 15 — Katarakti Lite Entry on Crypto (Bitget)

**Hypothesis:** Does the Lite entry (dwell + re-enter inside range + close-location) work better than V3 sustained deviation (N=30 hold outside range) for crypto?

**BTC+ETH grid:**

| Config | Trades | WR% | PnL | PF | Max DD% |
|---|---|---|---|---|---|
| d2/c0.35-0.45 | 20 | 60.00 | $6,258 | 1.95 | 27.99 |
| d3/c0.35-0.45 | 18 | 61.11 | $4,980 | 1.77 | 27.99 |
| d5/c0.35-0.45 | 18 | 61.11 | $5,066 | 1.79 | 27.99 |

**Note:** Close-location filter had zero effect — all thresholds produced identical results. Crypto candles are more directional than forex, so every re-entry candle passes all close-loc thresholds.

**Comparison vs existing crypto systems:**

| System | Trades | WR% | PnL | PF | Max DD% |
|---|---|---|---|---|---|
| V2 Baseline | 16 | 87.50 | $661 | 14.07 | 3.08 |
| **V3 N=30 (sustained)** | **19** | **84.21** | **$2,596** | **9.29** | **8.32** |
| Lite d2/c0.35 | 20 | 60.00 | $6,258 | 1.95 | 27.99 |

**Alt universe:** Bug in position sizing — equity went deeply negative and continued trading. Numbers invalid ($-833K on $10K). BTC+ETH results are valid.

**Conclusion:** Lite entry does NOT work for crypto. Higher raw PnL ($6,258) but catastrophic DD (28%) and terrible PF (1.95). WR drops from 84%→60%. Crypto is momentum-driven — sustained deviation (price holds beyond range) is the correct entry. Mean-reversion entry (re-enter inside range) catches crypto at the wrong inflection point.

**Key insight: Different markets need different "Lite" entries.**
- Forex: mean-reverts → Lite entry (dwell + re-enter inside + close-loc) works
- Crypto: trends/momentum → V3 sustained (hold outside range for N minutes) works

**Script:** `analyze-bitget-lite-entry-backtest.ts`
**Report:** `bitget-lite-entry-latest.txt`

---

## Katarakti Lite — Final Entry Specs

**Forex/CFD Lite:**
```
Entry: sweep ≥0.1% → dwell 3 min outside range → re-enter (close back inside range) → close-location 40% check
Exit: ATR scaling (Phase 2 defaults, no hard stop)
Bias: universal_v1, skip neutrals
No handshake. No displacement.
```

**Crypto Lite:**
```
Entry: sweep ≥0.1% → sustained N=30 (price holds beyond range for 30 consecutive 1-min candle closes)
Exit: %-based scaling milestones (BE stop, trailing, week close)
Bias: weekly bias from performance_snapshots, BTC proxy for alts
No rejection. No displacement. No handshake.
```

---

## Final Comparison Table

| System | Universe | Trades | WR % | Max DD % | PF | Return | Complexity |
|---|---|---|---|---|---|---|---|
| V2 Baseline (crypto) | BTC+ETH | 16 | 87.50 | 3.08 | 14.07 | $661 PnL | High |
| **V3 N=30 (crypto)** | **BTC+ETH** | **19** | **84.21** | **8.32** | **9.29** | **$2,596 PnL** | **Low** |
| V3 N=30 + Alts (crypto) | 31 symbols | 208 | 70.67 | 28.76 | 3.20 | $15,772 PnL | Low |
| Lite entry (crypto) | BTC+ETH | 20 | 60.00 | 27.99 | 1.95 | $6,258 PnL | Low |
| Katarakti Phase 2 (MT5) | 36 instruments | 30 | 36.70 | 0.56 | 36.85 | +21.62% | High |
| **Katarakti Lite (MT5)** | **36 instruments** | **39** | **46.15** | **0.82** | **18.03** | **+18.04%** | **Low** |
| Katarakti RW Exit (MT5) | 36 instruments | 94 | 35.11 | 3.91 | 1.61 | +8.82% | Low |
| Katarakti V3 Sustained (MT5) | 36 instruments | 91 | 31.87 | 11.26 | 1.28 | +4.87% | Low |

---

## Final Recommendations

### Crypto (Bitget):
1. **Deploy V3 N=30 on BTC+ETH** as crypto Lite (84% WR, PF 9.29, 8.32% DD)
2. **Expand to high-correlation alts** with reduced position sizing
3. Keep V2 running in parallel as quality benchmark
4. Lite mean-reversion entry does NOT fit crypto — don't use it

### Forex/CFD (MT5):
1. **Keep Katarakti Phase 2** as primary (PF 36.85, 0.56% DD)
2. **Deploy Katarakti Lite alongside** — d3/c0.40, no handshake, no displacement (PF 18.03, 0.82% DD)
3. V3 sustained entry does NOT fit forex — don't use it

### Architecture — Four-Bot Dashboard:
| Slot | System | Entry | Status |
|---|---|---|---|
| Katarakti Crypto | Complex (sweep+rejection+displacement+handshake) + scaling exit | Mean-reversion | Live |
| Katarakti Crypto Lite | V3 sustained N=30 + scaling exit | Momentum | To build |
| Katarakti Forex | Complex (sweep+rejection+displacement) + ATR exit | Mean-reversion | Live |
| Katarakti Forex Lite | Dwell 3min + close-loc 40% + ATR exit | Mean-reversion (simplified) | To build |

---

## Scripts Created This Session

| Script | Purpose |
|---|---|
| `analyze-bitget-v2-overshoot.ts` | Overshoot % statistics for all sweeps |
| `analyze-bitget-v2-overshoot-by-bias.ts` | Overshoot split by bias alignment |
| `analyze-bitget-v2-short-sweep-followthrough.ts` | Follow-through analysis on 370 SHORT sweeps |
| `analyze-bitget-v2-short-sweep-sensitivity-grid.ts` | Stop/target sensitivity grid |
| `analyze-bitget-v2-short-sweep-scaling-exit.ts` | Raw sweeps with V2 scaling exit |
| `analyze-bitget-v3-sustained-reentry-backtest.ts` | V3 sustained deviation backtest (main V3 test) |
| `analyze-bitget-v2-double-session-window.ts` | V2 with extended NY window |
| `analyze-bitget-v3-alt-universe-correlation-backtest.ts` | V3 on 31 crypto symbols with correlation analysis |
| `analyze-katarakti-v3-sustained-reentry-atr-backtest.ts` | V3 on 36 MT5 forex/indices/commodities instruments |
| `analyze-katarakti-rangewidth-backtest.ts` | Range-width normalized exit on 36 MT5 instruments |
| `analyze-katarakti-v3-atr-exit-backtest.ts` | V3 sustained entry + ATR exit hybrid |
| `analyze-katarakti-lite-ablation.ts` | Ablation ladder stripping Phase 2 entry |
| `analyze-katarakti-lite-parameter-sweep.ts` | Dwell/close-loc/ATR-floor grid on Lite entry |
| `analyze-bitget-lite-entry-backtest.ts` | Lite entry (dwell+close-loc) on crypto BTC+ETH + 31 alts |
