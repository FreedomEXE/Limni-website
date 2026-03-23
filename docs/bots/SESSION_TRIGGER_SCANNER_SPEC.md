# Session Trigger Scanner — Real-Time Signal Notification

> Status: DESIGN — Depends on backtest results to lock final trigger spec
> Author: Freedom + Nyx
> Date: 2026-03-19

---

## 1. Purpose

After the backtest identifies the best-performing trigger entry variant, this scanner runs during live sessions and notifies Freedom the moment a signal fires on any qualifying pair. This enables forward testing without watching 36 charts.

---

## 2. Core Architecture

### 2.1 Tick Rate

- **Base interval: every 5 minutes** (matches 5M chart, the lowest qualifying timeframe)
- Scanner runs on a cron/interval, not continuously
- Each tick: determine session → scan eligible pairs → check for signals → notify if triggered

### 2.2 Session Awareness

The scanner only runs during active trading sessions:

| Session | UTC Window | Scanner Active |
|---------|-----------|----------------|
| ASIA    | 00:00–08:00 | Yes |
| LONDON  | 08:00–13:00 | Yes |
| NY      | 13:00–21:00 | Yes |
| Off-hours | 21:00–00:00 | **No** — scanner sleeps |

Source of truth: `src/lib/flagship/sessionConfig.ts`

On each tick, the scanner calls `sessionForUtcHour(currentHourUtc)` to determine which session is active. If `null`, skip.

### 2.3 Pair Filtering Per Session

Only scan pairs eligible for the current session using `SESSION_ELIGIBILITY` from `sessionConfig.ts`:

- **ASIA**: AUD/NZD/JPY crosses + crypto + commodities + NIKKEIUSD
- **LONDON**: EUR/GBP/CHF crosses + crypto + commodities + NIKKEIUSD
- **NY**: USD/CAD crosses + crypto + commodities + SPXUSD + NDXUSD

This reduces the scan set from 36 to ~15–25 pairs per session.

---

## 3. Trigger Logic (From Backtest Spec)

### 3.1 Indicator: Stoch+RSI (rranjan fx)

Settings: `21, 13, 3, 3`

- RSI period: 21
- Stochastic K period: 13 (applied to RSI values)
- Stochastic K smoothing: 3
- Stochastic D smoothing: 3

Thresholds:
- **Oversold**: Stoch+RSI K-line < 20
- **Overbought**: Stoch+RSI K-line > 80

### 3.2 Directional Filter

The scanner only looks for signals aligned with the matrix bias:
- **Matrix says LONG** → only scan for oversold (long entry)
- **Matrix says SHORT** → only scan for overbought (short entry)
- **Matrix says NEUTRAL/EXCLUDED** → skip pair entirely

Bias source: `/api/performance/gated-setups` or frozen matrix snapshot (variant TBD by backtest results).

### 3.3 Top-Down Timeframe Cascade

For each eligible pair, scan timeframes in order: **4H → 1H → 15M → 5M**

**First qualifying timeframe wins** (primary variant — may change based on backtest).

### 3.4 Entry Trigger

On the qualifying timeframe:
1. Stoch+RSI is oversold/overbought ✓
2. Wait for **one engulfing candle** on that same timeframe
3. Engulfing definition: candle body closes beyond the prior candle's high (for longs) or low (for shorts) in the trade direction

Signal fires on engulfing candle close.

---

## 4. Smart Polling — Minimizing API Calls

This is the critical engineering decision. Naive approach = fetch all 4 timeframes for all pairs every 5 minutes = **~100+ OANDA calls per tick**. That's wasteful and will hit rate limits.

### 4.1 Tiered Check Frequency

Each timeframe only checks when a new candle closes on that timeframe. Per ~8-hour session:

| Timeframe | Candle closes every | Checks per session | When |
|-----------|--------------------|--------------------|------|
| 4H | 4 hours | **1** | Once at session open only. If not oversold/overbought, 4H is dead for this session. |
| 1H | 1 hour | **7** | On each hourly candle close within the session (after the open check) |
| 15M | 15 minutes | **31** | On each 15M candle close within the session |
| 5M | 5 minutes | **95** | On each 5M candle close within the session |

The 5-minute cron interval matches the 5M candle close rate. On any given tick, the scanner only fetches data for timeframes that have a new candle close at that moment:

- **:00 tick** (on the hour): check 5M + 15M + 1H (3 TFs)
- **:05, :10, :20, :25, :35, :40, :50, :55 tick**: check 5M only (1 TF)
- **:15, :30, :45 tick**: check 5M + 15M (2 TFs)

### 4.2 Early Elimination Logic

The top-down cascade creates natural filtering:

```
SESSION OPEN:
  For each eligible pair:
    1. Fetch 4H candles → compute Stoch+RSI
    2. If 4H is oversold/overbought:
       → Mark pair as "WATCHING_4H" — only need to check 4H for engulfing
       → No need to check lower TFs for this pair
    3. If 4H is NOT oversold/overbought:
       → Pair falls through to 1H check pool

EVERY HOUR (on the hour):
  For each pair NOT already watching on a higher TF:
    1. Fetch latest 1H candle → compute Stoch+RSI
    2. If 1H oversold/overbought:
       → Mark pair as "WATCHING_1H"
    3. Else → pair falls through to 15M pool

EVERY 15 MINUTES:
  For each pair NOT already watching on a higher TF:
    1. Fetch latest 15M candle → compute Stoch+RSI
    2. If 15M oversold/overbought:
       → Mark pair as "WATCHING_15M"
    3. Else → pair falls through to 5M pool

EVERY 5 MINUTES:
  For each pair NOT already watching on a higher TF:
    1. Fetch latest 5M candle → compute Stoch+RSI
    2. If 5M oversold/overbought:
       → Mark pair as "WATCHING_5M"
    3. Else → no signal this tick
```

### 4.3 Engulfing Watch

Once a pair is in a `WATCHING_<TF>` state:
- On each new candle close for that TF, check if the candle is engulfing
- If engulfing → **SIGNAL FIRED** → notify Freedom
- If the indicator leaves oversold/overbought zone before engulfing → cancel watch, pair re-enters cascade

### 4.4 Call Budget Per Tick

Assuming ~20 eligible pairs per session, with early elimination reducing the pool as higher TFs qualify or get eliminated:

| Tick type | When it fires | Pairs to fetch | TFs fetched | Max API calls |
|-----------|--------------|---------------|-------------|---------------|
| Session open | Once | 20 | 4H | 20 |
| :00 (hourly) | 7× per session | ~15 (minus 4H watchers) | 1H + 15M + 5M | ~45 |
| :15, :30, :45 | 21× per session | ~12 (minus 4H/1H watchers) | 15M + 5M | ~24 |
| :05, :10, etc. | 67× per session | ~8 (minus higher TF watchers) | 5M only | ~8 |
| Engulfing watches | On TF candle close | ~3-5 active | Their qualifying TF | ~5 |

**Typical 5M-only tick: ~8 calls. Heaviest tick (hourly): ~45 calls.**
OANDA live rate limit is ~30 req/s. Even the heaviest tick completes in under 2 seconds with concurrency.

### 4.5 Indicator Lookback Cache

Stoch+RSI(21,13,3,3) needs ~40 candles of lookback for stable values. Rather than re-fetching the full lookback every tick:

- **On session open**: Fetch 50 candles per TF per pair (initial seed)
- **On subsequent ticks**: Fetch only the latest 1–2 candles and append to the cached series
- **Cache invalidation**: Clear at session boundary (new session = fresh state)

This reduces each incremental fetch from 50 candles to 1–2.

---

## 5. State Machine Per Pair Per Session

```
┌─────────────┐
│   IDLE       │ ← Session open, pair eligible, no signal yet
└──────┬──────┘
       │ Check 4H → 1H → 15M → 5M cascade
       ▼
┌─────────────────────┐
│ WATCHING_<TF>        │ ← Oversold/overbought detected on TF
│ (awaiting engulfing) │
└──────┬──────────────┘
       │ Engulfing candle closes
       ▼
┌─────────────┐
│  TRIGGERED   │ ← Signal fired, notify Freedom
└──────┬──────┘
       │
       ▼
┌─────────────┐
│   DONE       │ ← First trade only, skip pair rest of session
└─────────────┘

Cancellation: WATCHING → IDLE if indicator exits oversold/overbought zone
```

---

## 6. Gate Variant Handling

Based on backtest results, the scanner will use one of:

| Gate Mode | Behavior |
|-----------|----------|
| **Frozen** | Snapshot matrix bias at session open. Direction locked for entire session even if COT/overlay changes mid-session. |
| **Live** | Re-check `/api/performance/gated-setups` every tick. If a pair flips from PASS to SKIP mid-session, cancel its watch. |
| **Ungated** | Use matrix direction only (LONG/SHORT from weekly bias), ignore gate decision entirely. |

The backtest will determine which mode produces the best results. Scanner implements the winner.

---

## 7. Notification System

### 7.1 Notification Payload

When a signal fires:

```json
{
  "pair": "AUDJPY",
  "session": "ASIA",
  "direction": "LONG",
  "timeframe": "1H",
  "stochRsi": 18.4,
  "engulfingCandle": {
    "open": 97.234,
    "high": 97.891,
    "low": 97.102,
    "close": 97.856
  },
  "entryPrice": 97.856,
  "matrixGate": "PASS",
  "matrixTier": "HIGH",
  "timestamp": "2026-03-19T03:00:00Z"
}
```

### 7.2 Notification Channels

Priority order (implement what's available):

1. **Telegram bot** — Freedom already has bot infra from trenchbot
2. **Desktop toast** — PowerShell notification (existing `notify-response.ps1` pattern)
3. **Website push** — Future: badge/alert on the matrix UI itself

### 7.3 Message Format (Telegram)

```
🎯 SIGNAL: AUDJPY LONG
━━━━━━━━━━━━━━━
Session: ASIA
Timeframe: 1H
Stoch+RSI: 18.4 (oversold)
Entry: 97.856 (engulfing close)
Gate: PASS | Tier: HIGH
━━━━━━━━━━━━━━━
Time: 03:00 UTC
```

---

## 8. Implementation Plan

### 8.1 File Structure

```
src/lib/scanner/
  sessionScanner.ts       ← Main scanner loop + state machine
  stochRsi.ts             ← Stoch+RSI indicator (shared with backtest)
  engulfing.ts            ← Engulfing candle detector (shared with backtest)
  ohlcFetcher.ts          ← Multi-TF OANDA OHLC fetcher (shared with backtest)
  scannerNotify.ts        ← Notification dispatch (Telegram, desktop)
  types.ts                ← Scanner types + state definitions

scripts/
  run-session-scanner.ts  ← Standalone entry point (cron or pm2)
```

### 8.2 Shared Code With Backtest

The indicator implementations (Stoch+RSI, engulfing detector, OHLC fetcher) must be **identical** between the backtest and the live scanner. Extract them into shared modules under `src/lib/scanner/` and import from both places.

This guarantees that the signals the scanner fires in production match what the backtest validated.

### 8.3 Deployment Options

| Option | Pros | Cons |
|--------|------|------|
| **Local script (pm2)** | Simple, Freedom controls it, no hosting cost | Depends on Freedom's machine being on |
| **Render cron job** | Always-on, matches existing infra | 5-min cron minimum on free tier, paid for faster |
| **Vercel cron** | Already deployed there | 1-min minimum interval but only on Pro plan |

**Recommended**: Local pm2 process for forward testing phase. Move to Render if it proves valuable.

### 8.4 Startup Sequence

```
1. Determine current session (or wait for next session if off-hours)
2. Load matrix bias for current week
3. Filter pairs by session eligibility
4. Fetch initial candle lookback for all TFs (seed cache)
5. Run state machine for all pairs
6. Enter 5-minute tick loop
7. On session boundary: reset all state, reload matrix, restart
```

---

## 9. Edge Cases

### 9.1 Session Transitions
- At session boundary (e.g., ASIA→LONDON at 08:00 UTC), the pair set changes
- Clear all state, rebuild eligible pairs, re-seed candle cache
- Pairs that were WATCHING in ASIA but are also eligible for LONDON: treat as fresh — re-check from 4H

### 9.2 Weekend Gap
- Friday NY close (21:00 UTC) → Sunday ASIA open (00:00 UTC)
- Scanner sleeps through weekend
- On Sunday ASIA open: fresh start, no carryover state

### 9.3 Matrix Not Yet Published
- If the new week's matrix hasn't been published by Sunday session open, fall back to previous week's bias with a warning notification
- Once new matrix publishes, reload on next tick

### 9.4 OANDA API Downtime
- If a fetch fails, retry once after 5s
- If still failing, skip that pair for this tick, log warning
- Do not fire false signals on stale data

### 9.5 Multiple Signals Same Tick
- If multiple pairs trigger simultaneously, send one consolidated notification listing all signals
- Still treat each pair independently (first trade only per pair per session)

---

## 10. Forward Test Protocol

Once the scanner is live:

1. **Week 1–2**: Receive signals, log them, do NOT trade. Compare against what you would have seen manually.
2. **Week 3–4**: Paper trade signals. Track entry, drawdown, outcome per signal.
3. **Week 5+**: If results match backtest expectations, begin live execution with minimum size.

Keep a forward test journal (can be a simple JSON log the scanner appends to) with:
- Signal details (pair, session, TF, direction, entry price)
- Whether you took the trade
- Outcome (if taken)
- Notes

---

## 11. Dependencies

- [ ] Backtest complete — winning trigger variant locked
- [ ] Stoch+RSI indicator validated against TradingView
- [ ] Shared indicator modules extracted
- [ ] Telegram bot token configured (or alternative notification channel)
- [ ] OANDA API key verified for sustained polling (rate limit check)
