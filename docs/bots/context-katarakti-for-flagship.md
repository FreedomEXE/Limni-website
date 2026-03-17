# Context — Katarakti Strategy: Reusable Components for Flagship

## What is Katarakti?
Katarakti is a **session-based liquidity sweep counter-trend strategy** that already exists in this codebase. While Flagship is WITH-trend (bias-aligned entry), Katarakti is counter-trend (sweep reversal entry). Despite the directional difference, they share the same structural architecture and several components are directly reusable.

## Signal Chain Comparison

```
Katarakti:  Weekly bias → Session range → Sweep trigger → Stepped exit
Flagship:   Weekly bias → Session filter → GEX gate → Currency strength trigger → [exit TBD]
```

Both are "strategic bias + tactical session entry." The difference is the trigger mechanism and directional philosophy.

## Key Files

| File | What it contains |
|------|-----------------|
| `scripts/katarakti-phase1-backtest.ts` | Main backtest engine — sweep detection, session logic, exit simulation, ATR calculation |
| `src/lib/performance/strategyRegistry.ts` | Strategy registry (Core/Lite/V3 variants) |
| `src/lib/performance/kataraktiMetrics.ts` | Metrics computation (Sharpe, drawdown, profit factor) |
| `src/lib/performance/kataraktiHistory.ts` | Historical data loader (DB + file snapshots) |
| `src/lib/kataraktiDashboard.ts` | Core variant dashboard (bot_id: `katarakti_v1`) |
| `src/lib/kataraktiLiteDashboard.ts` | Lite variant dashboard (bot_id: `katarakti_cfd_lite`) |
| `docs/research/KATARAKTI_HANDSHAKE_SPEC.md` | Phase 2 correlation handshake design |
| `migrations/012_katarakti_tables.sql` | Trade log, signals, bias snapshots, correlation matrix tables |

## Reusable Component 1: Stepped Profit Lock System

**File:** `scripts/katarakti-phase1-backtest.ts` — `simulateExit()` function (lines ~901-1099)

This is the most directly reusable component. It implements a cascading stop system that protects profits at milestones:

### Fixed Percentage Mode (`lockStyle: "fixed_pct"`)
```
Entry → price rises:
  +0.25% → move stop to breakeven (0%)
  +0.50% → lock profit at +0.15%
  +0.75% → lock profit at +0.35%
  +1.00% → lock profit at +0.55%
  >1.00% → trailing stop at -0.45% from peak
```

Hard stop (optional): -1.0% from entry. Can be disabled (`stepped_no_hard_sl` mode lets trades breathe through deeper drawdowns).

### ATR-Based Mode (`lockStyle: "atr"`)
Same ladder but thresholds are ATR multiples instead of fixed percentages:
```
ATR_BREAKEVEN_TRIGGER_X: 1.0  → move stop to breakeven at 1.0×ATR profit
ATR_LOCK1_TRIGGER_X: 2.0      → lock at 0.8×ATR when profit hits 2.0×ATR
ATR_LOCK2_TRIGGER_X: 3.0      → lock at 1.8×ATR when profit hits 3.0×ATR
ATR_TRAIL_ACTIVATE_X: 3.0     → trail at -1.5×ATR when profit > 3.0×ATR
```

**Why ATR mode matters for Flagship:** FX, indices, crypto, and metals have very different volatility profiles. ATR-based exits auto-calibrate to each instrument. A +0.25% move is nothing for BTCUSD but significant for EURGBP.

### Function Signature
```typescript
simulateExit({
  candles: OhlcCandle[],
  entryIdx: number,
  entryPrice: number,
  direction: "LONG" | "SHORT",
  weekEndMs: number,
  exitMode: "stepped_with_hard_sl" | "stepped_no_hard_sl",
  lockStyle: "fixed_pct" | "atr",
  atrAtEntry: number
})
// Returns: exit price, exit reason, step reached, milestones hit
```

Uses H1 OANDA candles — same data source Flagship now uses for session-pnl.

## Reusable Component 2: Session Range Detection

**File:** `scripts/katarakti-phase1-backtest.ts` — `buildWeekSessions()` (lines ~668-711)

Builds session windows with range periods and entry windows:

### Katarakti's Dual-Session Model
```
Asia Reference:
  Range period:  00:00 - 08:00 UTC (compute session high/low)
  Entry window:  08:00 - 21:00 UTC (look for sweeps in London + NY)

NY Reference:
  Range period:  13:00 - 21:00 UTC (compute session high/low)
  Entry window:  00:00 - 13:00 UTC next day (look for sweeps in Asia + London)
```

**Flagship use:** The session range (high/low) could serve as reference levels for currency strength triggers. When EUR/USD breaks above the Asian range high with EUR showing strength, that's a strong confirmation of the LONG bias.

### Key Functions
```typescript
buildWeekSessions(weekStartMs, weekEndMs)
// Returns: Array<{sessionName, rangeStartMs, rangeEndMs, entryStartMs, entryEndMs}>

findIndicesInRange(candles, startMs, endMs)
// Returns indices of candles within the time window
```

## Reusable Component 3: ATR Calculation

**File:** `scripts/katarakti-phase1-backtest.ts` — `calcAtr()` (lines ~529-547)

Standard ATR(14) on H1 candles. Returns ATR in price units.

```typescript
function calcAtr(candles: OhlcCandle[], endIdx: number, period: number = 14): number
```

**Flagship use:** Dynamic position sizing and exit thresholds per instrument.

## Reusable Component 4: Bias Filtering

**File:** `scripts/katarakti-phase1-backtest.ts` — `resolveAllowedDirections()` (lines ~713-722)

```typescript
function resolveAllowedDirections(bias: Direction, neutralMode: "skip" | "both_ways"): Set<"LONG" | "SHORT">
```

Given a weekly bias direction (LONG/SHORT/NEUTRAL/EXCLUDED), returns the allowed signal directions. Flagship already has equivalent logic via `classifyWeeklyBias()`.

## Reusable Component 5: Week-End Force Close

All Katarakti positions force-close at **Friday 23:59 UTC**. Exit price = close of last H1 candle before week end. This discipline aligns with the weekly bias cycle — bias is re-evaluated each Sunday, so all positions should be flat by Friday close.

**Flagship should adopt this same rule** for any intra-week entries triggered by currency strength.

## What is NOT Reusable

| Katarakti Component | Why Not for Flagship |
|---------------------|---------------------|
| Sweep detection (`checkSweep`) | Flagship is with-trend, not counter-trend reversal |
| 2-bar confirmation pattern | Flagship trigger is currency strength, not price rejection |
| Displacement validation | Price action pattern specific to counter-trend |
| V3 liquidation heatmap entries | Already have separate liquidation overlay in Flagship |
| Correlation handshake (Phase 2) | Flagship uses currency strength instead of cross-pair correlation |

## Katarakti Backtest Data Available

Extensive backtest reports exist in `reports/` directory:
- Parameter sweeps across sweep threshold, lock percentages, ATR multiples
- Ablation studies (which components add value)
- V3 ATR exit analysis
- Rangewidth analysis
- Sustained re-entry analysis

These reports contain methodology patterns for how to structure Flagship backtests once we have GEX and daily sentiment data.

## Database Tables (from `migrations/012_katarakti_tables.sql`)

```sql
-- Trade log for all Katarakti variants
katarakti_trade_log (bot_id, pair, direction, entry_price, exit_price, pnl_pct, ...)

-- Sweep signal candidates (before bias filter)
katarakti_signals (session_name, pair, direction, sweep_side, entry_price, ...)

-- Weekly bias snapshots (frozen at week open)
katarakti_weekly_bias (pair, bias_direction, bias_source, week_open_utc, ...)

-- Cross-pair correlation matrix
correlation_matrix (symbol_a, symbol_b, correlation, lookback_hours, ...)
```

The `correlation_matrix` table could be repurposed for currency strength clustering if needed.
