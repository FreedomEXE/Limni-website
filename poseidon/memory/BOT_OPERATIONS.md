# Bot Operations

<!-- IMPORTANT: This file is a STATIC SUMMARY for prompt context only.
     It is NOT the authoritative source of operational truth.
     Poseidon must query APIs/database for current state.
     This file may be outdated - never trust it over live queries. -->

> Proteus system prompt knowledge: how the Bitget v2 bot works operationally.

---

## State Machine

The bot runs as a state machine, ticking every 1-5 minutes via cron.

```
IDLE → WEEK_READY → WATCHING_RANGE → WATCHING_SWEEP → AWAITING_HANDSHAKE → POSITION_OPEN → SCALING → TRAILING → EXITING
```

| State | Meaning |
|-------|---------|
| IDLE | Bot disabled or outside trading week |
| WEEK_READY | New week detected, bias computed and frozen |
| WATCHING_RANGE | Collecting session highs/lows during range-building window |
| WATCHING_SWEEP | Range locked, scanning for sweep+rejection+displacement |
| AWAITING_HANDSHAKE | One symbol signaled, waiting for the other within 60 min |
| POSITION_OPEN | Both BTC+ETH entries confirmed and filled |
| SCALING | Milestone reached, leverage increased |
| TRAILING | Breakeven or trailing stop active |
| EXITING | Closing positions (reduce-only orders in flight) |
| ERROR | Invariant break or repeated failure |

## Tick Flow (Idempotent)

Each tick:
1. Acquire distributed lock (`pg_try_advisory_lock`)
2. Load bot state from DB
3. Check week rollover (flatten if new week)
4. Check kill switch (flatten immediately if true)
5. Compute/update weekly bias (COT + sentiment)
6. Fetch 36h of 1-min candles for BTC and ETH
7. Build and persist session ranges
8. Detect signals in current entry window
9. Evaluate handshake
10. If handshake confirmed: open positions (50/50 BTC/ETH)
11. For open positions: check milestones, update leverage, update stops
12. If stop triggered: close position, log trade
13. Persist state, release lock

## Order Execution

- **DRY_RUN mode**: Simulates everything, writes audit logs, no real orders
- **DEMO mode**: Real Bitget API with paper trading account (50K virtual USDT)
- **LIVE mode**: Real orders on Bitget production

All orders use idempotency keys: `${botId}:${action}:${symbol}:${hash}`
Retry logic: 3 attempts with exponential backoff (1s, 2s, 4s).

## Stop Loss Implementation

- Initial stop: 10% from entry (exchange-side via Bitget Position TPSL)
- Breakeven: Entry price (set at +2% milestone)
- Trailing: Calculated from peak price each tick, ratchets but never moves backward
- Week-close: All positions flattened at week boundary

## Key Configuration (Env Vars)

```
BITGET_BOT_ENABLED=true|false
BITGET_BOT_DRY_RUN=true|false
BITGET_BOT_HANDSHAKE_ENABLED=true|false
BITGET_BOT_HANDSHAKE_WINDOW_MINUTES=60
BITGET_BOT_INITIAL_LEVERAGE=5
BITGET_BOT_MAX_LEVERAGE=50
BITGET_BOT_INITIAL_STOP_PCT=10
BITGET_BOT_WEEKLY_MAX_ENTRIES_PER_SYMBOL=5
BITGET_BOT_KILL_SWITCH=true|false
BITGET_ENV=production|demo
```

## Database Tables

| Table | Purpose |
|-------|---------|
| `bot_states` | Current state machine snapshot (updated every tick) |
| `bitget_bot_trades` | Trade log with entry/exit/PnL/metadata |
| `bitget_bot_signals` | Signal detections with handshake grouping |
| `bitget_bot_ranges` | Session range snapshots (high/low per window) |
| `market_funding_snapshots` | Hourly funding rates per symbol |
| `market_oi_snapshots` | Hourly open interest + reference price |
| `market_liquidation_snapshots` | Hourly liquidation clusters from CoinAnk |

## Current Status

- **Phase 1 (DRY_RUN)**: Complete. All modules built and validated.
- **Demo trading**: Wired up. Bitget paper environment with virtual USDT.
- **Live trading**: Not yet active. Pending paper trade validation period.
- **Alt expansion**: Stubbed. Full implementation Phase 2.

## Cron Endpoint

The bot is triggered via `/api/cron/bitget-bot` on Vercel. Each call runs one `tick()`. Frequency: 1-5 minutes depending on config.
