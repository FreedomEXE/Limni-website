# Codex Prompt — Session-Level Top Pick Backtest

## Objective
Create a new backtest script that evaluates session-level trade selection from the weekly gated universe. Instead of treating the week as a single decision point, this tests: "If we only take the top-1 (or top-2) setup per trading session per day, what is the historical performance?"

## Context
- The project is a Next.js app at `C:/Users/User/Documents/GitHub/limni-website`
- An existing weekly-anchor backtest exists at `scripts/backtest-daily-top-pick.ts` — study its patterns for DB queries, COT gate logic, pair alias maps, and scoring. Reuse its utilities where possible.
- Another comparison backtest exists at `scripts/backtest-strategy-gate-comparison.ts` with COT gate evaluation, threshold sweeps, and diagnostics.
- Session windows are defined in `src/lib/bitgetBotSignals.ts` (lines 88-101): Asia 0-8 UTC, London 8-13 UTC, NY 13-21 UTC
- Weekly bias classification uses `classifyWeeklyBias()` from `src/lib/bitgetBotSignals.ts`
- Performance data is in the `performance_snapshots` table (weekly cadence, per-model per-pair returns)
- COT data in the `cot_snapshots` table
- Week anchor normalization via `src/lib/weekAnchor.ts`
- Display timezone is ET (Eastern Time)

## IMPORTANT: Price data constraint
The database stores **weekly** price snapshots only (`market_snapshots` table). There are NO intraday candles stored for FX or commodities. The Bitget API has `history-candles` but only for crypto perpetual futures (USDT-FUTURES product type).

Therefore, this backtest operates in **two modes**:
1. **`--mode=weekly-attr`** (default): Session-level selection, weekly P&L attribution. Each session selects its top pick from the weekly PASS universe, but P&L is the full-week return for that pair. This answers: "Does session-aware selection improve the weekly hit rate?"
2. **`--mode=session-pnl`** (future): True session-level P&L using Bitget candles. Only works for crypto pairs (BTCUSD, ETHUSD) in the current data environment. Outputs a warning for non-crypto pairs that P&L is estimated.

Build mode 1 fully. For mode 2, build the scaffolding and mark crypto pairs as complete, FX/metals as `pnl_source: "WEEKLY_ESTIMATE"`.

## File header standard
```
/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: backtest-session-top-pick.ts
 *
 * Description:
 * Session-level trade selection backtest for the Flagship manual trading system.
 * Evaluates top-1 and top-2 daily picks by trading session (Asia/London/NY)
 * against the gated weekly universe with Bitget MT5 profile constraints.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/
```

## Create: `scripts/backtest-session-top-pick.ts`

### CLI flags
```
--weeks=N          Number of weeks to backtest (default: 8)
--top-n=N          Top N picks per session (default: 1, max: 3)
--mode=MODE        "weekly-attr" or "session-pnl" (default: weekly-attr)
--profile=ID       "bitget_mt5" or "all_assets" (default: bitget_mt5)
--reduce-as-skip   Treat REDUCE as SKIP (default: true)
--strict           Require overlay data for PASS (default: false, since historical MenthorQ data may not exist)
--out=PATH         Output JSON path (default: reports/bias-gate/session-backtest-latest.json)
```

### Trading profile (includes indices for prop accounts)
- FX: all pairs, max leverage 500x
- Commodities: only XAUUSD, XAGUSD, max leverage 100x
- Crypto: only BTCUSD, ETHUSD, max leverage 75x
- Indices: SPXUSD, NDXUSD, NIKKEIUSD allowed, max leverage 100x

### Core logic

#### Step 1: Load weekly signals and build daily gate
Reuse the pattern from `backtest-daily-top-pick.ts`:
- Query `performance_snapshots` for each week via `readPerformanceSnapshotsByWeek()`
- Build pair-level signals using `classifyWeeklyBias()` from `src/lib/bitgetBotSignals.ts`
- Extract `baseReturnPct` from `pair_details` (same as existing backtest)
- Apply COT gate as the **structural weekly filter** (reuse `COT_PAIR_ALIASES`, `COT_MARKET_ALIASES`, `resolveCotMarketNet` pattern from `backtest-daily-top-pick.ts`)
- Filter through Bitget MT5 profile

#### Step 1b: Daily overlay gate re-evaluation
The COT gate is weekly (CFTC data is weekly). But overlays can change daily, modifying which signals are actually tradeable on each day:

**Crypto pairs (BTCUSD, ETHUSD) — daily liquidation gate:**
- For each trading day in the week, query `market_liquidation_snapshots` using `readLiquidationHistory()` from `src/lib/marketSnapshots.ts`
- Find the nearest snapshot to that day's session open (within 24h lookback)
- Compute long/short liquidation ratio: `ratio = total_long_usd / (total_long_usd + total_short_usd)`
- Gate logic: if the weekly bias is LONG, the ratio must be > 0.6 (crowded longs = liquidation cascade risk favors short, so longs need strong liquidation skew away from them). If SHORT, ratio must be < 0.4. Otherwise SKIP with reason "liquidation_imbalance"
- If no liquidation snapshot exists for that day, fall back to the weekly COT gate decision
- Track `gateSource: "CRYPTO_LIQUIDATION_DAILY"` vs `"COT_WEEKLY_FALLBACK"`

**Non-crypto pairs (FX, metals, indices) — weekly COT only (for now):**
- MenthorQ gamma data is not yet stored historically in the database (only captured to CSV recently)
- Use the weekly COT gate decision for all 5 trading days within the week
- Track `gateSource: "COT_WEEKLY"`
- When `--strict` flag is set: mark non-crypto signals as `gateSource: "COT_WEEKLY_NO_OVERLAY"` and log a diagnostic note. Do NOT skip them — just annotate that no daily overlay was available.

**Future-proofing:** When a `menthorq_gamma_snapshots` table exists, the script should detect it and use daily gamma data for non-crypto gate re-evaluation (similar to liquidation for crypto). For now, add a comment placeholder for this.

#### Step 2: Session-level selection
For each week, for each trading day (Monday-Friday), for each session (Asia, London, NY):
- The PASS universe for that session = signals that passed BOTH the weekly COT gate AND the daily overlay gate (Step 1b), filtered by session eligibility
- Session eligibility rules:
  - **FX pairs**: Eligible in all sessions (forex trades 24/5)
  - **XAUUSD, XAGUSD**: Eligible in London and NY sessions only (metals less liquid in Asia)
  - **BTCUSD, ETHUSD**: Eligible in all sessions (crypto has no session concept — trades 24/7)
  - **NIKKEIUSD**: Eligible in Asia and London sessions only (Japanese equity hours)
  - **SPXUSD, NDXUSD**: Eligible in NY session only (US equity index hours)
- Score each eligible PASS signal using the same `scoreSignal()` logic from `scripts/select-daily-max-conviction-trade.ts` (tier weight + consistency + actionable - flips + backtest history)
- Select top-N by score

#### Step 3: Deduplication and correlation cap (for top-2 mode)
When `--top-n=2`:
- The second pick must NOT be in the same USD-risk cluster as the first
- USD-risk clusters: if pick #1 is a USD pair (EURUSD, GBPUSD, XAUUSD, etc.), pick #2 must not be another USD pair
- Cross pairs (EURGBP, EURJPY, etc.) are in their own cluster
- This prevents doubling up on the same directional bet

#### Step 4: P&L attribution

**Mode `weekly-attr`:**
- Each selected session trade gets the full-week `tradePnlPct` for that pair
- A pair selected in multiple sessions in the same week is counted only once for P&L (first selection wins)
- Track which session first selected it

**Mode `session-pnl`** (scaffolding):
- For crypto pairs: fetch 1h candles from Bitget API (`https://api.bitget.com/api/v2/mix/market/history-candles`) for the session window, compute session open-to-close return
- For FX/metals: use `pnl_source: "WEEKLY_ESTIMATE"` and fall back to weekly return / 5 (rough daily estimate). Flag these clearly in output.

#### Step 5: Compute metrics
Track per-session and aggregate:

```typescript
type SessionBacktestSummary = {
  mode: "weekly-attr" | "session-pnl";
  profile: string;
  topN: number;
  weeksAnalyzed: number;
  totalTradingSessions: number;      // weeks × 5 days × 3 sessions
  tradedSessions: number;            // sessions with at least one pick
  noTradeSessions: number;           // sessions with zero qualifying picks
  winSessions: number;
  lossSessions: number;
  flatSessions: number;
  winRatePct: number;
  avgPnlPerSessionPct: number;
  cumulativePnlPct: number;
  maxDrawdownPct: number;
  maxConcurrentOpenTrades: number;   // peak open positions at any point
  bySession: {
    ASIA: SessionStats;
    LONDON: SessionStats;
    NY: SessionStats;
  };
  byAssetClass: Record<string, {
    trades: number;
    winRate: number;
    cumPnl: number;
  }>;
  pairFrequency: Array<{ pair: string; timesSelected: number; cumPnl: number }>;
};

type SessionStats = {
  totalSessions: number;
  tradedSessions: number;
  noTradeSessions: number;
  winRate: number;
  avgPnl: number;
  cumPnl: number;
  maxDD: number;
};
```

#### Step 6: Max concurrent open trades (margin load proxy)
- Model that each session trade is open for the duration of that session only (Asia=8h, London=5h, NY=8h)
- Track overlapping positions across sessions within the same day
- Report peak concurrent open count

#### Step 7: Console output
Print a summary table similar to `backtest-daily-top-pick.ts`:
```
=== Session-Level Top Pick Backtest ===
Profile: Bitget MT5
Mode: weekly-attr
Top N: 1
Weeks: 8

--- Aggregate ---
Sessions tested: 120  (8w × 5d × 3)
Traded: 87 | No-trade: 33
Win: 52 | Loss: 30 | Flat: 5
Win rate: 59.8%
Avg PnL/session: +0.12%
Cumulative: +10.44%
Max DD: -3.2%
Peak concurrent: 2

--- By Session ---
[table with ASIA, LONDON, NY rows]

--- By Asset Class ---
[table with fx, commodities, crypto rows]

--- Top 10 Most Selected Pairs ---
[table]
```

#### Step 8: JSON output
Write full results to `--out` path. Include:
- Summary object (above)
- Per-week-per-day-per-session detail rows (pair, direction, score, pnl, gate decision, gateSource)
- Metadata (run timestamp, git commit if available, CLI flags)

### npm script
Add to `package.json`:
```json
"trade:backtest-session": "npx tsx scripts/backtest-session-top-pick.ts"
```

## Existing code to reuse (DO NOT rewrite these)
- `src/lib/bitgetBotSignals.ts`: `classifyWeeklyBias()`, session window functions
- `src/lib/performanceSnapshots.ts`: `listPerformanceWeeks()`, `readPerformanceSnapshotsByWeek()`
- `src/lib/cotStore.ts`: `readSnapshotHistory()`
- `src/lib/cotPairs.ts`: `PAIRS_BY_ASSET_CLASS`
- `src/lib/weekAnchor.ts`: `normalizeWeekOpenUtc()`, `getCanonicalWeekOpenUtc()`
- `src/lib/db.ts`: `getPool()`
- `src/lib/marketSnapshots.ts`: `readLiquidationHistory()` — for daily crypto liquidation gate re-evaluation
- `scripts/backtest-daily-top-pick.ts`: COT gate patterns, pair alias maps, scoring approach

## Do NOT
- Do not modify any existing files except `package.json` (to add the npm script)
- Do not create new lib modules — keep everything in the single script file (same pattern as other backtests)
- Do not add npm dependencies
- Do not create README or documentation files
- Do not touch UI components or API routes
