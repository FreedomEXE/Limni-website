<!--
/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: docs/bots/COUNTER_TREND_BACKTEST_SPEC.md
 *
 * Description:
 * Implementation spec and Codex prompt for the counter-trend weekly sweep
 * backtest. Defines the system hypothesis, parameter grid, execution
 * instructions, expected outputs, and validation checklist.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/
-->

# Counter-Trend Weekly Sweep Backtest — Implementation Spec

## Purpose

This is a **feasibility study** for a counter-trend trading system on BTC/ETH perpetual futures. The system detects when price sweeps the PRIOR WEEK's high or low, waits for rejection + displacement on 1H candles, and enters counter-trend.

**Test window:** Configurable via `CT_WEEKS` env var (default: 26 weeks / 6 months). The initial 5-week feasibility study (all HIGH SHORT) has been completed — MULTIBAR quality filter was the only positive result (+7.1%, 50% WR, 2 trades). The extended test validates this across varied market conditions.

**This is the RISKY version first.** We start wide with all parameters, then tighten based on what the data shows.

---

## Script Location

`scripts/counter-trend-weekly-backtest.ts`

**Run command (extended test — recommended):**
```bash
npx tsx scripts/counter-trend-weekly-backtest.ts
```

This defaults to 26 weeks with COT-only bias (no DB needed for sentiment).

**Run command (custom period):**
```bash
CT_WEEKS=52 CT_BIAS_MODE=COT_ONLY npx tsx scripts/counter-trend-weekly-backtest.ts
```

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `CT_WEEKS` | `26` | Number of weeks to backtest |
| `CT_BIAS_MODE` | `COT_ONLY` | Bias computation mode: `FULL` (COT+sentiment, needs DB), `COT_ONLY` (COT positioning only, no DB), `NONE` (skip bias, all NEUTRAL) |
| `CT_NO_STOP_TEST` | `0` | Set to `1` to disable stops (week close exit only) |
| `CT_SINGLE_ENTRY_PER_WEEK` | `0` | Set to `1` to limit to one handshake per week |
| `BITGET_PRODUCT_TYPE` | `USDT-FUTURES` | Bitget product type for candle API |

### Candle Caching

M1 candles are cached per symbol/week in `.cache/counter-trend/`. On subsequent runs, cached weeks are loaded from disk instead of re-fetching from the API. Delete `.cache/counter-trend/` to force a fresh fetch.

This is critical for the extended test — fetching 27 weeks of M1 candles for 2 symbols takes 30-45 minutes. Caching means subsequent runs (e.g., after logic changes) execute in seconds.

**Prerequisites:**
- COT data files (for COT_ONLY/FULL modes): same `.env` / `.env.local` as `bitget-v2-backtest.ts`
- Database connection only needed for `CT_BIAS_MODE=FULL` (sentiment aggregates)
- Internet access (fetches M1 candles from Bitget API on first run)
- Node.js with tsx installed

---

## System Architecture

### Data Flow
```
Prior Week M1 Candles -> buildWeeklyRange() -> Weekly High/Low
                                                    |
Current Week M1 Candles -> aggregateToH1() -> H1 Candles
                                                    |
                                                    v
                              detectCounterTrendSignals()
                                                    |
                                                    v
                           passesCounterTrendBiasFilter()
                                                    |
                                                    v
                          evaluateCounterTrendHandshake()
                                                    |
                                                    v
                            simulateCounterTrendExit() [on M1 candles]
                                                    |
                                                    v
                              Trade Log + Parameter Grid Results
```

### Key Differences from Bias System (bitget-v2-backtest.ts)

| Aspect | Bias System | Counter-Trend System |
|--------|-------------|---------------------|
| Range reference | Session (Asia/London or US) | Full prior week |
| Detection timeframe | M1/M5 candles | H1 candles |
| Direction | WITH bias | AGAINST bias (or neutral) |
| Max leverage | 75x | 15x (conservative) |
| Initial leverage | 5x | 3x |
| Stop distance | 10% | 8-15% (parameterized) |
| Exit simulation | M5 candles | M1 candles |
| Hold period | Overnight, session, or week | Week max (force close) |
| Handshake window | 60 min | 60-480 min (parameterized) |

---

## Parameter Grid

Grid size depends on `CT_BIAS_MODE`:

- **COT_ONLY / NONE** (default): **2,160 combos** (bias filter locked to NONE)
- **FULL**: **6,480 combos** (all 3 bias filters tested)

| Parameter | Values | Count |
|-----------|--------|-------|
| `SWEEP_MIN_PCT` | 0.3, 0.5, 0.75, 1.0 | 4 |
| `DISPLACEMENT_MIN_PCT` | 0.1, 0.2, 0.3 | 3 |
| `HANDSHAKE_WINDOW_MIN` | 60, 240, 480 | 3 |
| `INITIAL_STOP_PCT` | 8, 10, 15 | 3 |
| `BIAS_FILTER` | NONE (or all 3 in FULL mode) | 1 or 3 |
| `PARTIAL_TP` | OFF, ON (50% at +3%) | 2 |
| `QUALITY_PROFILE` | RAW, RECLAIM05, RECLAIM1, HAMMER, MULTIBAR, VOLSPIKE, RANGEPROP2, RANGEPROP5, MODERATE, STRICT | 10 |

**Default total: 4 x 3 x 3 x 3 x 1 x 2 x 10 = 2,160**

### Entry Quality Profiles

After the initial backtest showed entries bleeding out (-18.6% best return), entry quality filters were added. Instead of a full combinatorial grid on 5 filter dimensions (which would be 72x more combos), the script uses 10 discrete **quality profiles**:

| Profile | Reclaim Depth | Wick:Body | Multi-Bar | Vol Spike | Range Prop |
|---------|--------------|-----------|-----------|-----------|------------|
| **RAW** | off | off | off | off | off |
| **RECLAIM05** | ≥0.5% | off | off | off | off |
| **RECLAIM1** | ≥1.0% | off | off | off | off |
| **HAMMER** | off | ≥2.0x | off | off | off |
| **MULTIBAR** | off | off | ≥2 bars | off | off |
| **VOLSPIKE** | off | off | off | ≥1.5x avg | off |
| **RANGEPROP2** | off | off | off | off | ≥2% |
| **RANGEPROP5** | off | off | off | off | ≥5% |
| **MODERATE** | ≥0.5% | ≥2.0x | off | ≥1.5x avg | off |
| **STRICT** | ≥1.0% | ≥2.0x | ≥2 bars | ≥1.5x avg | ≥2% |

**Filter descriptions:**

1. **Reclaim Depth** (`reclaimDepthPct`): How far inside the prior week range the confirm candle closed. Higher = stronger rejection back into the range.

2. **Wick-to-Body Ratio** (`wickToBodyRatio`): Ratio of the rejection wick to the candle body on the sweep candle. ≥2.0 means a hammer/shooting star pattern — strong rejection.

3. **Multi-Bar Displacement** (`multiBarDisplacement`): Requires 2+ consecutive H1 candles with bodies in the counter-trend direction after the sweep. Confirms sustained buying/selling pressure.

4. **Volume Spike** (`volumeSpikeRatio`): Sweep candle volume vs. rolling 24-bar H1 average. ≥1.5 means the sweep occurred on above-average volume — institutional activity.

5. **Sweep-to-Range Proportion** (`sweepRangeProportionPct`): Sweep depth as a percentage of the prior week's total range width. Higher = more meaningful level breach.

### Bias Filter Modes

- **NONE**: Allow all counter-trend signals regardless of bias. Note: signals trading WITH the bias direction are still excluded (the system only produces counter-trend entries).
- **NEUTRAL_ONLY**: Only enter counter-trend when weekly bias is NEUTRAL tier.
- **EXTENDED_5PCT**: Enter when NEUTRAL, OR when price has already moved 5%+ in the bias direction this week (exhaustion play).

**IMPORTANT for 5-week test:** All 5 weeks are HIGH SHORT. This means:
- `NEUTRAL_ONLY` will produce **zero trades** (no neutral weeks exist).
- `EXTENDED_5PCT` will only produce trades if BTC/ETH dropped 5%+ from week open before the sweep occurred.
- `NONE` is the only filter that will reliably produce trades.

---

## Scaling Ladder (Counter-Trend Conservative)

| Milestone | Leverage | Stop Behavior | Trail |
|-----------|----------|---------------|-------|
| Entry | 3x | Fixed stop (8/10/15%) | None |
| +2% | 5x | Move to breakeven | None |
| +4% | 10x | Breakeven | 2% trailing |
| +6% | 15x (cap) | Breakeven | 1.5% trailing |

---

## Expected Outputs

### 1. JSON Results (`reports/counter-trend-weekly-backtest-{timestamp}.json`)

Contains:
- `paramSets`: All parameter combinations (2,160 in COT_ONLY/NONE mode, 6,480 in FULL mode)
- `results`: Only combinations that produced trades, sorted by return
- `bestByReturn`, `bestByWinRate`, `bestByDrawdown`: Top performers
- `signalDiagnostics`: How many weekly sweeps were detected at the widest thresholds
- `weeklyBiasSummary`: Bias state per week
- `recommendations`: Auto-generated analysis notes

### 2. Trade Log (`reports/counter-trend-trade-log-{timestamp}.json`)

Full trade log across all parameter combos. Each trade includes:
- Entry/exit timestamps and prices
- Sweep/displacement metrics
- Parameter set ID (for filtering)
- Unlevered P&L, milestones hit, exit reason

### 3. Markdown Summary (`reports/counter-trend-weekly-backtest-{timestamp}.md`)

Human-readable report with:
- Weekly bias summary table
- Signal diagnostics
- Top 10 parameter sets
- Sample trade log
- Recommendations

---

## Codex Task Instructions

### Step 1: Verify Script Compiles
```bash
cd limni-website
npx tsx --no-execute scripts/counter-trend-weekly-backtest.ts 2>&1 | head -20
```
If there are type errors, fix them. The script uses the same imports as `bitget-v2-backtest.ts` — verify all paths resolve.

### Step 2: Run the Backtest
```bash
npx tsx scripts/counter-trend-weekly-backtest.ts
```

This will:
1. Fetch M1 candles from Bitget (CT_WEEKS + 1 weeks, cached after first fetch). First run takes 30-45 minutes for 26 weeks. Subsequent runs use cache and complete in seconds.
2. Compute weekly bias (COT-only by default, no DB needed).
3. Run 2,160 parameter combinations (216 base x 10 quality profiles).
4. Write results to `reports/`.

### Step 3: Analyze Results

After the backtest completes, analyze the output:

1. **Signal frequency**: How many weekly sweeps were detected? If zero, the prior week range was never breached — the system has no edge in this regime.

2. **Trade frequency**: How many parameter combos produced trades? If very few, the system is too restrictive for current conditions.

3. **Best performers**: Look at the top 5 by return AND by win rate. Are they using similar parameters? That's a signal of robustness. If the top performers are scattered across different params, that's noise.

4. **Exit reasons**: What % of trades exit via STOP_LOSS vs TRAILING_STOP vs WEEK_CLOSE? High STOP_LOSS % means the counter-trend hypothesis is weak in this regime.

5. **Handshake impact**: Compare results at handshake window = 60 vs 480. Does the wider window produce more trades without destroying win rate?

6. **Quality profile comparison**: The markdown report includes a "Quality Profile Comparison" table. Compare RAW (no quality filter) against each individual filter and the MODERATE/STRICT combos. Key questions:
   - Do stricter filters eliminate the losing trades while keeping winners? (Fewer trades, higher WR)
   - Does RECLAIM or HAMMER improve results vs RAW? These target the specific failure mode (weak rejections).
   - Does STRICT produce zero trades? If so, the filters are too aggressive for this sample size.
   - Is there a profile that improves return while maintaining ≥2 trades?

### Step 4: Write Analysis Summary

After reviewing results, write a brief analysis to `docs/bots/counter-trend-backtest-analysis.md` covering:
- Did the system find any viable counter-trend signals?
- Which parameter ranges showed promise (if any)?
- Is there enough signal to justify expanding the test to more data?
- What would need to change to make this system viable?

---

## Validation Checklist

Before accepting results:

- [ ] Script compiled and ran without errors
- [ ] All trading weeks were processed (check console output for week count)
- [ ] Candle cache populated in `.cache/counter-trend/` (verify files exist for each symbol/week)
- [ ] Prior week ranges were correctly computed (BTC/ETH ranges should be reasonable — e.g., BTC range ~$3000-$8000, not $0 or $999999)
- [ ] Weekly bias summary shows varied conditions across 26 weeks (not all identical — confirms we have bullish, bearish, and neutral weeks)
- [ ] At least the `NONE` bias filter variant produced signals (if not, check sweep detection logic)
- [ ] MULTIBAR quality profile shows distinct results from RAW (confirms quality filter is active)
- [ ] Both LONG and SHORT signals detected across the 26-week period
- [ ] Trade P&L calculations are directionally correct (a counter-trend LONG that enters and price drops further should be a loss)
- [ ] Quality Profile Comparison table shows all 10 profiles
- [ ] Markdown report was generated and is readable
- [ ] No API errors in console output (Bitget rate limits may require retries)

---

## Known Limitations

1. **No fee/slippage model** — Same caveat as existing backtest. Real performance will be 5-15% worse.
2. **Partial TP is approximate** — The script notes when 50% TP would trigger but continues simulating the full position. Real partial TP would lock in gains earlier.
3. **No independent mode** — This version requires handshake (BTC + ETH both signal). A future iteration should test independent entries per symbol.
4. **Bitget API history depth** — The history-candles endpoint may not provide M1 data beyond ~6-12 months. If weeks return zero candles, reduce `CT_WEEKS`.
5. **COT-only bias is 2-vote** — With only dealer + commercial (no sentiment), ties resolve to NEUTRAL. This means more weeks classify as NEUTRAL, allowing both LONG and SHORT counter-trend signals.

---

## Future Work (After Feasibility Confirmed)

1. **Expand to 3-6 months** — Pull historical candles from Bitget for Sep 2025-Feb 2026. This requires paginating the history-candles API further back.
2. **Add independent entry mode** — Test without handshake to increase signal count.
3. **Add WITH-bias weekly sweep variant** — Same detection, but enter WITH the bias when weekly levels are swept. This could complement the existing session-level system.
4. **Correlation handshake** — Port Phase 2 handshake spec from Katarakti.
5. **Fee/slippage model** — Add 0.04% maker + 0.06% taker fees and 0.05% slippage per side.

---

*Counter-Trend Weekly Sweep System — Freedom_EXE / Limni Intelligence Platform*
