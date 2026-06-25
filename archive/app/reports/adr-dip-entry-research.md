# ADR Dip-Entry Research Tracker

> Living document tracking all ADR dip-entry test variants, results, and open questions.
> Owner: Freedom_EXE | Started: 2026-03-24

---

## Goal

Build a proven intraday execution layer on top of the Tiered V3 weekly directional system. This is what the Limni Matrix was built for.

**What we already know works:** Tiered V3 gated signals entered at week open and held to week close produce consistent returns with low drawdowns. That's the weekly hold system — it's live and proven.

**What we're solving for now:** An intraday system that uses ADR-normalized dip entries to improve execution quality. Instead of blindly entering at week open, we wait for price to dip 1x ADR in our direction before entering. This turns a weekly signal into an intraday trigger with a better entry price.

**The bigger picture — open research questions:**
1. **TP optimization** — What's the optimal profit target? 0.5x ADR? 1.0x ADR? Or hold to close? (Test 2 — COMPLETE)
2. **Re-entries with TP** — Can repeated fills after TP compound the high-probability edge enough to beat hold? (Test 3 — COMPLETE. Answer: +62.30% vs +95.81% hold. Not yet, but 92% win rate and zero losing weeks)
3. **Session filtering** — Does entering during a pair's primary session improve results? (Test 3 — ANSWERED: No. Session gating reduced returns by ~20% with no improvement in per-fill quality. DEAD.)
4. **Session performance breakdown** — Which trading session produces the best fills? Can you focus on one session per day? (Test 5 — PENDING)
5. **Neutral pair ADR trades** — Can we trade neutral pairs (no directional bias) by fading both ADR boundaries as mean-reversion? (Test 4 — PENDING)
6. **Non-gated signal recovery** — Pairs that fail the COT gate are currently skipped. ADR dip entry recovers them as conditional trades with zero opportunity cost. How much alpha does this add? (Answered in Test 1 baseline: +78% additional return)

**End state:** The Matrix surfaces all of this — Flagship (gated) signals, ADR Dip (non-gated) signals, ADR trigger levels, session context — so a trader can see the full picture and execute intraday with confidence.

---

## System Context

The Tiered V3 system produces weekly directional signals per pair via 3 independent voters (dealer, commercial, sentiment). Signals are gated by COT percentile (FX/indices/commodities) or liquidation heatmap (crypto). The ADR dip-entry system uses Average Daily Range as a conditional entry filter.

**Source of truth:** `computeTieredWeekForSystem({ weekOpenUtc, system: "v3" })` + `evaluatePairWithGate()`

**ADR calculation:** 10-day lookback, (high - low) / open * 100, averaged. Minimum 5 valid days required.

---

## Test 1: BASELINE — Hold Till End of Week (Current Live System)

**Script:** `scripts/non-gated-adr-dip-entry.ts`
**Date run:** 2026-03-23
**Sample:** 9 completed weeks, all asset classes (FX, Indices, Commodities, Crypto)
**Entry:** 1x ADR dip from week open, in direction of signal
**Exit:** Hold to week close (Friday)
**SL:** None
**TP:** None (hold to close)

### Two-Tier Results

| Tier | Description | Trades | Avg Return | Total Return | Win Rate | Fill Rate |
|------|-------------|-------:|----------:|-------------:|---------:|----------:|
| A — Gated PASS | Week-open entry | 92 | +0.32% | +29.88% | 59.8% | 100% (always entered) |
| B — Non-gated ADR Dip | 1x ADR dip entry, hold to close | 41 filled / 102 eligible | +1.91% | +78.19% | 75.6% | 40.2% |
| **Combined** | A + B | 133 | +0.81% | +108.07% | 64.7% | — |

### Non-Gated by Asset Class

| Asset Class | Eligible | Filled | Fill Rate | Avg Return | Total Return | Win Rate |
|-------------|----------|--------|-----------|------------|--------------|----------|
| FX | ~70 | ~25 | ~36% | — | — | — |
| Crypto | 16 | 10 | 62.5% | — | +65.15% | — |
| Indices | — | — | — | — | — | — |
| Commodities | — | — | — | — | — | — |

### Historical ADR Study (Longer Sample)

From `reports/tiered-v3-adr-gated-vs-ungated.md` (different methodology, older data):

| System | ADR Return | Baseline Return | Delta | Triggered | Total | Fill Rate | Weekly Win | Trade Win |
|--------|------------|-----------------|-------|-----------|-------|-----------|------------|-----------|
| Tiered V3 Net Hold | 566.59% | 273.22% | +293.37% | 53 | 211 | 25.12% | 88.89% | 72.99% |
| Tiered V3 Net Hold Gated | 399.94% | 263.18% | +136.76% | 28 | 104 | 26.92% | 100.00% | 71.15% |

### Key Observations (Test 1)
- Non-gated ADR dip trades have **higher avg return** (+1.91%) vs gated week-open (+0.32%)
- This makes mechanical sense: you're entering at a better price (1 ADR deeper)
- Fill rate is the bottleneck: only 40.2% of eligible signals actually fill
- Crypto has the highest fill rate (62.5%) — more volatile = more ADR touches
- **Zero opportunity cost** — these trades are currently skipped entirely

### Limitations
- Exit is always week close — no active profit-taking or stop-loss
- No session filtering — entries can happen at any time during the week
- Neutral pairs excluded — only directional (LONG/SHORT) signals tested
- Daily bar resolution — can't tell intraday fill order or exact fill time

---

## Test 2: PROFIT TARGET OPTIMIZATION (COMPLETE)

**Script:** `scripts/adr-dip-tp-optimization.ts`
**Date run:** 2026-03-24
**Sample:** 9 completed weeks, all asset classes (FX, Indices, Commodities, Crypto)
**Entry:** 1x ADR dip from week open, in direction of signal (all Tiered V3 signals before gate filtering)
**Exit variants:** Hold to close, TP 0.25/0.50/0.75/1.00 ADR from entry price
**SL:** None
**TP detection:** Daily bars from fill day onward (inclusive). If TP not hit, holds to week close.
**Re-entry:** None — one entry per pair per week

### Combined Results

| Variant | Trades | Avg Return | Total Return | Win Rate | Fill Rate |
|---------|-------:|----------:|-------------:|---------:|----------:|
| Baseline Hold | 79 | +1.21% | +95.81% | 73.42% | 42.93% |
| TP 0.25 ADR | 79 | +0.31% | +24.12% | 94.94% | 42.93% |
| TP 0.50 ADR | 79 | +0.54% | +43.03% | 92.41% | 42.93% |
| TP 0.75 ADR | 79 | +0.68% | +53.34% | 84.81% | 42.93% |
| TP 1.00 ADR | 79 | +0.88% | +69.45% | 81.01% | 42.93% |

### GATED (PASS / NO_DATA)

| Variant | Trades | Avg Return | Total Return | Win Rate | Fill Rate |
|---------|-------:|----------:|-------------:|---------:|----------:|
| Baseline Hold | 42 | +1.56% | +65.61% | 73.81% | 45.65% |
| TP 0.25 ADR | 42 | +0.28% | +11.84% | 95.24% | 45.65% |
| TP 0.50 ADR | 42 | +0.58% | +24.54% | 92.86% | 45.65% |
| TP 0.75 ADR | 42 | +0.83% | +34.89% | 85.71% | 45.65% |
| TP 1.00 ADR | 42 | +1.04% | +43.48% | 80.95% | 45.65% |

### NON-GATED (SKIP / REDUCE)

| Variant | Trades | Avg Return | Total Return | Win Rate | Fill Rate |
|---------|-------:|----------:|-------------:|---------:|----------:|
| Baseline Hold | 37 | +0.82% | +30.21% | 72.97% | 40.22% |
| TP 0.25 ADR | 37 | +0.33% | +12.28% | 94.59% | 40.22% |
| TP 0.50 ADR | 37 | +0.50% | +18.48% | 91.89% | 40.22% |
| TP 0.75 ADR | 37 | +0.50% | +18.45% | 83.78% | 40.22% |
| TP 1.00 ADR | 37 | +0.70% | +25.98% | 81.08% | 40.22% |

### Key Observations (Test 2)
- **Hold wins on total return** across all modes (+95.81% vs +69.45% for best TP)
- **TPs win on consistency** — 94.94% win rate at TP 0.25 vs 73.42% for hold
- **Drawdown protection:** Mar 09 week was -0.50% for hold but +6.26% for TP 0.25 — TPs lock in edge before reversals
- **Tradeoff:** Hold captures more upside in trending weeks (Jan 26: +38.95% hold vs +10.02% TP 1.00) but gives back gains in reversal weeks
- **TP 0.25 ADR is the consistency winner** — 94.94% win rate means nearly every filled trade books profit
- **Re-entries are the next unlock** — with a 0.25 ADR TP, price frequently returns to the 1 ADR dip level after TP, enabling multiple fills per week per pair

### Limitations
- 79 fills across 9 weeks, with 50 of 79 fills concentrated in last 3 weeks (Mar 02-16)
- Daily bar resolution — same-day fill + TP counted as TP hit by design
- No re-entries tested — one entry per pair per week caps the potential of tight TPs

---

## Test 3: RE-ENTRIES WITH TP + SESSION GATING (COMPLETE)

**Script:** `scripts/adr-dip-reentry.ts`
**Date run:** 2026-03-24
**Sample:** 9 completed weeks, all asset classes (FX, Indices, Commodities, Crypto)
**Entry:** 1x ADR dip from week open, in direction of signal (all Tiered V3 signals before gate filtering)
**Execution bars:** OANDA H1 candles for the full canonical week window
**Re-entry rule:** After TP is hit, state machine returns to waiting for another touch of the same 1x ADR dip level. Unlimited re-entries per pair per week.
**Exit if no TP:** Hold to week close
**SL:** None

### Variants

| Variant | TP | Re-entry | Session Gated |
|---------|---:|:--------:|:-------------:|
| A | 0.25 ADR | Yes | No |
| B | 0.50 ADR | Yes | No |
| C | 0.25 ADR | Yes | Yes |
| D | 0.50 ADR | Yes | Yes |

### Combined Results

| Variant | Total Fills | Avg Fills/Pair/Week | Total Return | Avg Return/Fill | Win Rate | TP Hit Rate |
|---------|------------:|--------------------:|-------------:|----------------:|---------:|------------:|
| A: TP 0.25 + Re-entry | 261 | 1.42 | +62.30% | +0.24% | 91.95% | 89.27% |
| B: TP 0.50 + Re-entry | 144 | 0.78 | +57.89% | +0.40% | 85.42% | 77.78% |
| C: TP 0.25 + Re-entry + Session | 195 | 1.06 | +49.67% | +0.25% | 90.77% | 89.23% |
| D: TP 0.50 + Re-entry + Session | 114 | 0.62 | +45.46% | +0.40% | 83.33% | 77.19% |

### GATED (PASS / NO_DATA)

| Variant | Total Fills | Avg Fills/Pair/Week | Total Return | Avg Return/Fill | Win Rate | TP Hit Rate |
|---------|------------:|--------------------:|-------------:|----------------:|---------:|------------:|
| A: TP 0.25 + Re-entry | 117 | 1.27 | +27.53% | +0.24% | 90.60% | 86.32% |
| B: TP 0.50 + Re-entry | 65 | 0.71 | +29.58% | +0.46% | 83.08% | 72.31% |
| C: TP 0.25 + Re-entry + Session | 81 | 0.88 | +19.54% | +0.24% | 88.89% | 86.42% |
| D: TP 0.50 + Re-entry + Session | 48 | 0.52 | +21.08% | +0.44% | 79.17% | 68.75% |

### NON-GATED (SKIP / REDUCE)

| Variant | Total Fills | Avg Fills/Pair/Week | Total Return | Avg Return/Fill | Win Rate | TP Hit Rate |
|---------|------------:|--------------------:|-------------:|----------------:|---------:|------------:|
| A: TP 0.25 + Re-entry | 144 | 1.57 | +34.77% | +0.24% | 93.06% | 91.67% |
| B: TP 0.50 + Re-entry | 79 | 0.86 | +28.31% | +0.36% | 87.34% | 82.28% |
| C: TP 0.25 + Re-entry + Session | 114 | 1.24 | +30.13% | +0.26% | 92.11% | 91.23% |
| D: TP 0.50 + Re-entry + Session | 66 | 0.72 | +24.38% | +0.37% | 86.36% | 83.33% |

### Comparison vs Test 2 Baselines

| Metric | Value |
|--------|-------|
| Test 2 TP 0.25 single-fill total return | +24.12% (79 trades, 94.94% WR) |
| Test 3 Variant A total return | +62.30% (261 fills, 91.95% WR) |
| Delta vs Test 2 TP 0.25 | +38.18% |
| Test 2 Baseline Hold total return | +95.81% (79 trades, 73.42% WR) |
| Variant A minus Hold | -33.51% |

### Per-Week Breakdown (Variant A — Best performer)

| Week | Signals | Pairs w/ Fill | Total Fills | Re-entries | Total Return |
|------|--------:|--------------:|------------:|-----------:|-------------:|
| Jan 26 | 27 | 9 | 28 | 19 | +8.25% |
| Feb 02 | 25 | 12 | 25 | 13 | +2.34% |
| Feb 09 | 21 | 1 | 2 | 1 | +0.57% |
| Feb 16 | 21 | 3 | 6 | 3 | +0.62% |
| Feb 23 | 19 | 5 | 11 | 6 | +6.30% |
| Mar 02 | 24 | 18 | 97 | 79 | +24.87% |
| Mar 09 | 22 | 15 | 50 | 35 | +8.94% |
| Mar 16 | 25 | 18 | 42 | 24 | +10.40% |

### Key Observations (Test 3)
- **Re-entries nearly tripled fill count** — 261 fills vs 79 single-fill, but total return (+62.30%) still -33.5pp behind hold (+95.81%)
- **Win rate held above 90%** — 91.95% for Variant A, down only 3pp from Test 2's 94.94% despite aggressive re-entry cycling
- **Zero losing weeks** — every week was positive for Variant A. Hold had one losing week (Mar 09: -0.50%)
- **Mar 02 was 40% of all return** — 97 fills, +24.87%. Concentration risk is real
- **Variant B (TP 0.50) surprisingly close** — +57.89% on 144 fills vs +62.30% on 261 fills. Wider TP, fewer fills, but +0.40%/fill vs +0.24%/fill. Extra re-entries in Variant A are scraping diminishing returns
- **Session gating is dead** — Variant C (-12.6pp vs A) and D (-12.4pp vs B) with no improvement in per-fill quality. Killed.
- **Non-gated outperformed gated on re-entries** — 1.57 fills/pair/week vs 1.27 for gated. Non-gated pairs bounce harder off ADR dips (stronger mean-reversion when market pushes against signal)

### Limitations
- H1 bars still hide intrabar order. Same-bar fill + TP counted, but multiple re-entry cycles inside one H1 bar not modeled
- No stop-loss tested — reversal week protection comes entirely from tight TP
- 9-week sample with heavy concentration in last 3 weeks (Mar 02-16)

---

## Test 4: NEUTRAL PAIR ADR BOTH-SIDES (PENDING)

**Status:** Not yet run
**Hypothesis:** Neutral pairs (no directional bias from tiered voters) may still be tradeable by fading both ADR boundaries as mean-reversion trades.

### Design
- **Universe:** Pairs where all 3 voters see no directional pressure (NEUTRAL)
- **Entry:** 1x ADR touch from week open in EITHER direction → enter counter-direction
- **Exit:** TBD (0.5x ADR TP? Hold to close? Mean-reversion target at week open price?)
- **Thesis:** No directional pressure = range-bound → ADR boundaries act as S/R

### Key Questions Before Building
1. How many neutral pairs per week? (Need sufficient sample size)
2. What's the right TP? Mean-reversion to week open? 0.5x ADR? Full ADR?
3. Do we enter both sides if both ADR levels are touched in the same week?
4. This is a fundamentally different strategy (mean-reversion vs trend-following) — should it be tracked separately?

### Implementation Notes
- Same backtest infrastructure as Test 1
- Filter `computeTieredWeekForSystem` results for pairs where direction === null or all voters === NEUTRAL
- For each neutral pair, check both upper and lower ADR bands
- If lower band touched → LONG entry, TP at week open or 0.5x ADR above entry
- If upper band touched → SHORT entry, TP at week open or 0.5x ADR below entry

---

## Test 5: SESSION PERFORMANCE BREAKDOWN + MAE ANALYSIS (COMPLETE)

**Script:** `scripts/adr-dip-session-breakdown.ts`
**Report:** `reports/adr-dip-session-breakdown.md`
**Date run:** 2026-03-24
**Sample:** 9 completed weeks, all asset classes (FX, Indices, Commodities, Crypto)
**Base from Test 3:** Same signal universe, same H1 bars, same re-entry logic (Variant A: TP 0.25 ADR + re-entry, no session filter)
**Modification:** For every fill, record the UTC hour and track max adverse excursion (MAE) through life of trade.

### Session Buckets (UTC)
- **Asian:** 22:00-07:00 UTC
- **London:** 07:00-12:00 UTC
- **NY Overlap:** 12:00-16:00 UTC
- **NY Afternoon:** 16:00-20:00 UTC
- **Off-Hours:** 20:00-22:00 UTC

### Session Results

| Session | Fills | Total Return | Avg Return/Fill | Win Rate | TP Hit Rate | Re-entries |
|---------|------:|-------------:|----------------:|---------:|------------:|-----------:|
| NY_Overlap | 81 | +22.41% | +0.28% | 91.36% | 91.36% | 56 |
| NY_Afternoon | 54 | +21.03% | +0.39% | 98.15% | 92.59% | 38 |
| Asian | 36 | +8.49% | +0.24% | 94.44% | 91.67% | 20 |
| London | 74 | +6.98% | +0.09% | 87.84% | 87.84% | 55 |
| Off_Hours | 16 | +3.39% | +0.21% | 87.50% | 68.75% | 11 |

### Best Session Per Asset Class

| Asset Class | Best Session | Fills | Total Return | Win Rate |
|-------------|-------------|------:|-------------:|---------:|
| FX | NY_Overlap | 61 | +6.65% | 88.52% |
| Indices | NY_Overlap | 14 | +6.17% | 100.00% |
| Crypto | NY_Afternoon | 10 | +12.56% | 100.00% |
| Commodities | No fills | 0 | — | — |

### Peak Hours (UTC)
- **Hour 15:** +9.12% (23 fills, 95.65% WR) — best single hour
- **Hour 16:** +9.62% (16 fills, 93.75% WR) — highest return per hour
- **Hour 02:** -3.66% (6 fills, 83.33% WR) — worst hour
- **Hour 10:** -3.45% (16 fills, 81.25% WR) — second worst

### MAE Distribution

| MAE Bucket (xADR) | Fills | % of Total | Cumulative % | Avg Return | Win Rate |
|--------------------|------:|-----------:|-------------:|-----------:|---------:|
| 0.00 - 0.10 | 93 | 35.63% | 35.63% | +0.42% | 98.92% |
| 0.10 - 0.25 | 68 | 26.05% | 61.69% | +0.29% | 98.53% |
| 0.25 - 0.50 | 49 | 18.77% | 80.46% | +0.27% | 95.92% |
| 0.50 - 0.75 | 15 | 5.75% | 86.21% | +0.24% | 93.33% |
| 0.75 - 1.00 | 13 | 4.98% | 91.19% | -0.42% | 61.54% |
| 1.00 - 1.50 | 16 | 6.13% | 97.32% | -0.28% | 62.50% |
| 1.50+ | 7 | 2.68% | 100.00% | -0.44% | 28.57% |

### MAE Per Asset Class

| Asset Class | Avg MAE (xADR) | Median MAE (xADR) | P95 MAE (xADR) | Max MAE (xADR) |
|-------------|---------------:|-------------------:|----------------:|---------------:|
| FX | 0.37 | 0.18 | 1.26 | 3.94 |
| Indices | 0.24 | 0.11 | 1.29 | 1.44 |
| Crypto | 0.34 | 0.11 | 1.13 | 1.70 |
| Commodities | — | — | — | — |

### MAE vs Outcome

| Outcome | Count | Avg MAE (xADR) | Median MAE (xADR) | P95 MAE (xADR) |
|---------|------:|---------------:|-------------------:|---------------:|
| TP Hit | 233 | 0.26 | 0.15 | 1.00 |
| Fallback Win | 7 | 0.18 | 0.06 | 0.63 |
| Fallback Loss | 21 | 1.37 | 1.18 | 3.53 |

### Position Sizing Implications
- At 0.50x ADR stop: 19.5% of fills would be stopped out
- At 0.75x ADR stop: 13.8% of fills would be stopped out
- At 1.00x ADR stop: 8.8% of fills would be stopped out
- **Combined P95 MAE: 1.27x ADR** — recommended risk distance for conservative sizing
- **TP Hit P95 MAE: 1.00x ADR** — tighter risk distance for winners-only calibration

### Key Observations (Test 5)
- **NY_Afternoon is the quality winner** — fewest fills (54) but highest avg return (+0.39%/fill) and 98.15% WR
- **NY_Overlap wins on volume** — 81 fills, +22.41% total, but only +0.28%/fill
- **London is a trap** — high fill count (74) but +0.09%/fill and 87.84% WR. Hour 10 (-3.45%) drags it down
- **US window (12:00-20:00 UTC) captures ~70% of return** — NY_Overlap + NY_Afternoon = 135 fills, +43.44%
- **One-session rule rejected** — NY_Overlap captures only 31% of fills, 36% of return. Edge too distributed
- **80% of fills never go more than 0.50x ADR against you** — entries are well-timed
- **MAE > 0.75x ADR = win rate collapses to ~60%** — this is the kill zone for stops
- **Mar 02 CHF pairs dominate worst fills** — systematic event, not random noise
- **Non-gated outperforms gated in NY sessions** — signals the gate would have killed actually performed better

---

## Research Queue

| Priority | Test | Status | Blocking? |
|----------|------|--------|-----------|
| 1 | Test 2: TP optimization | COMPLETE | — |
| 2 | Test 3: Re-entries with TP + session gating | COMPLETE | — |
| 3 | Test 5: Session breakdown + MAE | COMPLETE | — |
| 4 | Test 4: Neutral pair both-sides | PENDING | Need neutral pair count per week |

---

## Scripts Reference

| Script | Purpose |
|--------|---------|
| `scripts/non-gated-adr-dip-entry.ts` | Test 1 baseline — non-gated signals, ADR dip entry, hold to close |
| `scripts/adr-dip-tp-optimization.ts` | Test 2 — TP optimization (0.25/0.50/0.75/1.00 ADR) vs hold to close |
| `scripts/adr-dip-reentry.ts` | Test 3 — H1 re-entries with TP 0.25/0.50 + session gating |
| `scripts/adr-dip-session-breakdown.ts` | Test 5 — Session performance breakdown + MAE analysis |
| `scripts/fx-flagship-adr-dip-entry.ts` | FX-only gated PASS signals, ADR dip vs week-open comparison |
| `scripts/fx-flagship-pair-breakdown.ts` | Per-pair breakdown of FX gated flagship trades |

---

*Last updated: 2026-03-24*
