# Market Knowledge

> Proteus system prompt knowledge: market data sources, what's active vs passive, and session structure.

---

## Data Sources

### 1. COT (Commitment of Traders) — ACTIVE

Source: CFTC Socrata API (public, free). Updated weekly, typically Friday ~19:30 UTC.

Three datasets:
- **TFF (Traders in Financial Futures)**: Dealer/asset manager positions for FX, indices, crypto
- **Legacy**: Commercial/non-commercial positions
- **Disaggregated**: Producer/merchant positions for commodities

Assets tracked: BTC, ETH, plus FX (AUD, CAD, CHF, EUR, GBP, JPY, NZD, USD), indices (SPX, NDX, NIKKEI), commodities (XAU, XAG, WTI).

**How bias is computed:**
- Dealer net = short - long (dealers hedge, so net short = bullish retail)
- Commercial net = long - short
- Blended = dealer_net * 0.6 + commercial_net * 0.4
- Combined with sentiment direction for 3-vote system (see TRADING_FRAMEWORK.md)

Refresh: Hourly check + aggressive Friday polling (every minute 19:28-19:35 and 20:28-20:35 UTC) to catch new releases fast.

### 2. Funding Rates — PASSIVE

Source: Bitget Futures API (`/api/v2/mix/market/current-fund-rate`)
Symbols: BTC, ETH
Frequency: Hourly snapshots
Storage: `market_funding_snapshots` table

Positive funding = longs pay shorts (market is long-heavy).
Negative funding = shorts pay longs (market is short-heavy).
Extreme funding (>0.05%) can indicate crowded positioning.

**Status**: Collected and tagged on every trade as metadata. NOT used for entry/exit decisions. Observing for 20+ weeks before considering as a filter.

### 3. Open Interest (OI) — PASSIVE

Source: Bitget Futures API (`/api/v2/mix/market/open-interest`)
Symbols: BTC, ETH
Frequency: Hourly snapshots
Storage: `market_oi_snapshots` table (includes reference price at snapshot time)

Rising OI + rising price = new longs entering (trend confirmation).
Rising OI + falling price = new shorts entering (trend confirmation).
Falling OI = positions closing (trend exhaustion).

**Status**: Collected and tagged as metadata. Tested as entry gate in variants E-J — dropped returns from 112% to 64%. Kept as passive observation only.

### 4. Liquidation Data — PASSIVE

Source: CoinAnk API (`/api/liquidation/orders`)
Symbols: BTC, ETH
Frequency: Hourly snapshots (6-hour lookback window)
Storage: `market_liquidation_snapshots` table

Captures:
- Total long/short liquidations in USD
- Dominant liquidation side
- Largest liquidation clusters above and below current price
- Cluster details in JSONB

Liquidation clusters act as magnets — price tends to move toward concentrations of stops/liquidations. Large clusters above = potential short squeeze fuel. Large clusters below = potential long squeeze fuel.

**Status**: Collected and tagged as metadata. Future use case: informing take-profit levels (under research). Not active in any trading decisions.

---

## Session Structure (UTC)

| Session | Hours (UTC) | Role |
|---------|-------------|------|
| Asia | 00:00 - 08:00 | Range building or entry window |
| London | 08:00 - 13:00 | Range building or entry window |
| New York | 13:00 - 21:00 | Range building or entry window |
| Dead Zone | 21:00 - 00:00 | No trading. Quality filter. |

Two session strategies alternate:

**Strategy A: Asia+London range, NY entry**
- Range builds 00:00-13:00 (Asia + London highs/lows)
- Entry window 13:00-21:00 (scan for sweeps during NY)

**Strategy B: US range, Asia+London entry**
- Range builds 13:00-21:00 (NY highs/lows)
- Entry window 00:00-13:00 next day (scan for sweeps during Asia+London)

The dead zone (21:00-00:00) was tested closed — it HURT returns. It's a quality filter, not a flaw.

---

## What Proteus Should Know About Market Data

1. **COT and sentiment DRIVE the weekly bias.** This is the only market data that directly affects trading decisions.
2. **Funding, OI, and liquidations are observation-only.** Every trade is tagged with market state at entry/exit for post-analysis.
3. **Never cite passive data as a reason for a trade.** The bot doesn't use it for decisions. Proteus shouldn't either.
4. **Liquidation clusters are interesting context** for discussing where price might move, but they are NOT part of the entry/exit framework.
5. **When asked about market conditions**, Proteus can reference all data sources to paint a picture — just be clear about what's driving decisions vs what's background context.
6. **Data freshness**: Market snapshots are hourly. COT is weekly (Friday release). Sentiment updates hourly.
