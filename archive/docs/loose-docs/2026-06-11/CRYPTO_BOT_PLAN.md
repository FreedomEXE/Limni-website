# Crypto Trading Bot - Planning Document

## Project Overview

Build a position management bot for Bitget perpetual futures that:
- Monitors manually opened positions
- Automatically scales into winning trades
- Manages risk using breakeven stops
- Uses liquidation as the stop loss (high leverage strategy)

**Goal**: Trade from $100 → $10k using a compounding scale-in strategy

---

## 1. Architecture & Integration

### Platform
- **Exchange**: Bitget Perpetual Futures
- **API Integration**: Bitget Futures API (REST + WebSocket)
- **Execution Environment**: TBD (Node.js server / Python / Separate service)
- **Entry Method**: Manual execution by user on Bitget
- **Bot Responsibility**: Position management only (scaling, stop loss moves, partial exits)

### API Requirements
- **Bitget API Credentials**: ✅ Available (API key, secret, passphrase ready)
- **Permissions Needed**:
  - ✅ Read positions
  - ✅ Place orders
  - ✅ Modify orders
  - ✅ Read account balance
- **Connection Type**:
  - WebSocket for real-time position updates
  - REST API for order placement and balance checks

### Build Approach
- **Strategy**: Build from scratch (no example code copying)
- **Architecture**: Custom implementation for Limni
- **Data Sources**: CoinAnk + Augmento.ai APIs
- **Integration**: Similar pattern to existing MT5/COT system

### Operational Configuration
- ✅ **Runtime**: 24/7 monitoring (continuous operation)
- ✅ **Entry Execution**: Fully automated when triggers align
- ✅ **Assets**: BTC and ETH only (CFTC data available)
- ✅ **Trigger Threshold**: 2 out of 4 indicators must align for entry
- ✅ **Deployment**: Render (cloud hosting for all scraping + trading bots)

---

## 2. Trading Strategy (Position Management)

### Core Logic: "Scale-In on Profit" Strategy

**Example (SHORT BTC):**
```
1. User opens: SHORT BTC @ $95k with $10 (10% of $100 account)
   - Leverage: 20x
   - Position size: $200 notional ($10 × 20x)
   - Liquidation: ~$99.75k (5% move against, acts as SL)

2. Price drops to $90k → 100% profit reached ($10 profit)
   Bot automatically:
   a) Opens another SHORT position @ $90k with $10
   b) Closes HALF of original position (takes back initial $10)
   c) Moves SL to breakeven ($95k) on remaining half

   Result:
   - $10 back in pocket (risk-free)
   - Still short $100 notional @ average $92.5k
   - Stop at breakeven = no loss possible

3. Price drops to $85k → Another 100% profit
   Bot repeats:
   a) Opens another SHORT @ $85k with $10
   b) Takes partials from previous positions
   c) Adjusts stops to new breakeven

4. Eventually gets stopped out at breakeven or takes full profit
```

### Position Management Rules

| Rule | Description |
|------|-------------|
| **Initial Entry** | Manual by user. Bot detects new position opening. |
| **Position Size** | 10% of account balance per trade |
| **Leverage** | BTC: 20x, ETH: 40x |
| **Margin Mode** | Isolated |
| **Stop Loss** | Liquidation price (by design) |
| **Scale-In Trigger** | 100% profit on position (price moves 5% in favor for 20x leverage) |
| **Scale-In Action** | 1. Open new position (same size)<br>2. Close 50% of original position<br>3. Move SL to breakeven |
| **Max Scaling** | Continue until stopped out or position closed |
| **Risk Per Trade** | 10% of total account balance |

### Risk Calculation
- **BTC @ 20x leverage**: 5% price move = 100% profit or 100% loss (liquidation)
- **ETH @ 40x leverage**: 2.5% price move = 100% profit or 100% loss

---

## 3. Data Sources for Crypto Bias (Entry Logic)

### Primary Data Sources

#### 1. CoinAnk API (coinank.com)
**Purpose**: Liquidation data + sentiment metrics

**Available Data**:
- **Liquidation heatmaps**: Where large liquidations are clustered
- **Open Interest**: Total contracts open across exchanges
- **Funding Rates**: Perpetual futures funding (long/short bias)
- **Fear & Greed Index**: Market sentiment indicator
- **Long/Short Ratios**: Trader positioning data

**API Access**: Available
**Integration**: REST API for data collection

#### 2. Augmento.ai API
**Purpose**: Advanced sentiment analysis

**Available Data**:
- Social media sentiment aggregation
- News sentiment scoring
- Market momentum indicators
- Crowd psychology metrics
- Real-time sentiment shifts

**API Access**: Available
**Integration**: REST API for sentiment signals

### Data Collection Strategy

**Approach**: Build a data scraper/aggregator similar to the COT scraper for forex

**Storage**:
- Periodic snapshots of key metrics
- Historical data for backtesting
- Real-time updates for trading decisions

**Update Frequency**:
- Liquidation data: Every 15-60 minutes
- Open Interest: Every hour
- Sentiment data: Every 1-4 hours
- Fear & Greed: Daily

### Entry Logic Framework

**Strategy**: Two-tier approach (Bias → Trigger)

#### Tier 1: Long-Term Directional Bias (COT Data)
**Purpose**: Establish weekly/monthly directional bias (similar to forex)

**Data Source**: CFTC COT Reports for Crypto Futures
- Bitcoin Futures (CME)
- Ethereum Futures (CME)
- Other available crypto derivatives

**Bias Determination**:
- Analyze commercial vs non-commercial positioning
- Identify when "smart money" is positioned one way
- Create BULLISH / BEARISH / NEUTRAL bias per asset
- Update weekly (similar to forex COT schedule)

**Output**:
```
BTC: BEARISH (commercials net short, non-commercials overleveraged long)
ETH: BULLISH (commercials accumulating, non-commercials underweight)
```

#### Tier 2: Entry Triggers (Contrarian Extremes)
**Purpose**: Find entry points that align WITH bias but AGAINST crowd

**Logic**: Once bias is established, wait for extremes in the OPPOSITE direction, then enter with the bias

**Example - BEARISH Bias on BTC**:
1. COT shows BEARISH bias (smart money short)
2. Wait for crowd to push price UP (against bias)
3. Entry triggers:
   - ✅ **Short liquidations spike** (retail longs getting squeezed)
   - ✅ **Sentiment hits extreme greed** (dumb money FOMO buying)
   - ✅ **Funding rate heavily positive** (too many longs paying shorts)
   - ✅ **Long/Short ratio heavily skewed long** (everyone bullish)
4. Enter SHORT (with the bias, against the crowd)

**Example - BULLISH Bias on ETH**:
1. COT shows BULLISH bias (smart money long)
2. Wait for crowd to push price DOWN (against bias)
3. Entry triggers:
   - ✅ **Long liquidations spike** (retail shorts getting squeezed)
   - ✅ **Sentiment hits extreme fear** (dumb money panic selling)
   - ✅ **Funding rate heavily negative** (too many shorts paying longs)
   - ✅ **Long/Short ratio heavily skewed short** (everyone bearish)
4. Enter LONG (with the bias, against the crowd)

**Key Principle**:
> "Use COT for direction, use crowd extremes for timing"

**Data Sources for Triggers**:
- **CoinAnk**: Liquidation data, funding rates, long/short ratios
- **Augmento.ai**: Sentiment scoring (greed/fear)
- **Open Interest**: Validate if move is legitimate or exhaustion

**Entry Trigger Requirements**:
- **Minimum**: 2 out of 4 indicators must align
- **Indicators**:
  1. Liquidations (spike in opposite direction)
  2. Sentiment extreme (fear/greed)
  3. Funding rate extreme (positive for shorts, negative for longs)
  4. Long/Short ratio skewed (against bias direction)

**Examples**:
- BEARISH bias + (Short liquidations ✅ + Sentiment greed ✅) = Enter SHORT ✅
- BULLISH bias + (Long liquidations ✅ + Funding negative ✅) = Enter LONG ✅
- BEARISH bias + only 1 indicator = Wait ❌

**Execution**:
- ✅ **Fully automated**: Bot places orders automatically when 2+ triggers align
- ✅ **Telegram notification**: Alert sent when entry is executed
- ✅ **Safety check**: Verify sufficient balance and no duplicate positions before entry

**Status**: Framework defined. Ready for implementation.

---

## 4. Technical Specifications

### Markets Supported
- **Active**: BTCUSDT, ETHUSDT perpetuals only
- **Reasoning**: Only BTC and ETH have reliable CFTC COT data from CME futures
- **Future**: Can expand if CFTC adds more crypto derivatives

### Account Configuration
- **Margin Mode**: Isolated (each position has its own margin)
- **Leverage**:
  - BTC: 20x fixed
  - ETH: 40x fixed

### Stop Loss Strategy
- **Method**: Liquidation price acts as stop loss
- **Philosophy**: High leverage with tight risk (10% account per trade)
- **Breakeven Management**: After first scale-in, move SL to entry price

### Position Sizing Logic
```javascript
accountBalance = 100 // Example: $100 account
riskPerTrade = 0.10 // 10%
positionRisk = accountBalance * riskPerTrade // $10

// For BTC at 20x leverage
leverage = 20
marginUsed = positionRisk // $10 margin
notionalSize = marginUsed * leverage // $200 position size

// Liquidation occurs at ~5% adverse move
// 100% profit occurs at ~5% favorable move
```

### Scale-In Mechanics

**Trigger Condition**: Position P&L reaches +100% (+$10 on $10 risk)

**Actions**:
1. **Open new position**:
   - Same direction (LONG/SHORT)
   - Same size ($10 margin = $200 notional @ 20x)
   - Current market price

2. **Take initial capital back**:
   - Close 50% of original position
   - Realizes ~$10 profit
   - Recovers initial risk

3. **Move stop to breakeven**:
   - Set SL at original entry price for remaining 50%
   - Ensures no loss possible on original position

**Result**:
- Original $10 recovered (risk-free)
- Still exposed with $10 at better average price
- Stop loss at breakeven = zero risk

### Trailing/Repeat Logic
- **Every time** position shows another +100% gain, repeat the scale-in process
- Continue until:
  - Stopped out at breakeven, OR
  - User manually closes position, OR
  - Account reaches daily/max loss limit

---

## 5. Risk Controls & Safety Rails

### Position-Level Controls
- ✅ Max 10% account balance per trade
- ✅ Liquidation acts as hard stop (built into leverage)
- ✅ Breakeven stop after first scale-in (eliminates risk)

### Account-Level Controls (Recommended to Add)
- [ ] **Daily loss limit**: Stop all trading if account drops X% in a day
- [ ] **Max concurrent positions**: Limit to 1-3 positions open at once
- [ ] **Max drawdown kill-switch**: Halt bot if account drops below $X
- [ ] **Sanity checks on orders**:
  - Verify order size doesn't exceed limits
  - Confirm leverage is set correctly
  - Validate prices are within reasonable range

### Order Validation
Before placing any order, bot should verify:
- Sufficient balance available
- Position size within limits
- Leverage correctly set
- No duplicate orders pending

---

## 6. Notifications (Telegram)

### Events to Notify
- ✅ New position detected
- ✅ 100% profit reached → scale-in triggered
- ✅ Partial profit taken
- ✅ Stop loss moved to breakeven
- ✅ Position closed (stopped out or manual)
- ✅ Errors (API issues, order failures)
- ⚠️ Risk warnings (daily loss limit, account drawdown)

### Message Format Example
```
🟢 BTC SHORT Position Detected
Entry: $95,000
Size: $200 notional ($10 @ 20x)
Liquidation: $99,750

---

🎯 100% Profit Reached!
Added: SHORT @ $90,000 ($10)
Took: $10 initial back
Moved SL: $95,000 (breakeven)

Remaining exposure: $200 @ avg $92,500
Status: RISK-FREE ✅
```

---

## 7. Frontend Integration

### COT Page Updates

**Current Structure**:
```
/cot → Shows forex COT data only
```

**New Structure**:
```
/cot
  ├─ Forex (existing)
  │   └─ CFTC forex futures data
  └─ Crypto (new section)
      ├─ BTC (CME Bitcoin futures COT)
      ├─ ETH (CME Ethereum futures COT)
      └─ Other crypto derivatives
```

**Crypto COT Display**:
- Similar table/chart format as forex
- Show commercial vs non-commercial positioning
- Display directional bias (BULLISH/BEARISH/NEUTRAL)
- Update weekly (CFTC publishes Friday 3:30 PM ET)

### Account Dashboard Updates

**Current Structure**:
```
/accounts → Shows MT5 accounts only
```

**New Structure**:
```
/accounts
  ├─ Forex (MT5 accounts)
  │   └─ [Existing functionality]
  └─ Crypto (Bitget accounts)
      └─ [New section]
```

### Crypto Account Display (Similar to Forex)

**Metrics to Show**:
- Account balance ($100 starting)
- Current equity (balance + unrealized P&L)
- Daily P&L ($, %)
- Weekly P&L ($, %)
- Open positions count
- Total risk deployed (% of account in open positions)

**Crypto-Specific Metrics**:
- Total leverage used
- Liquidation risk (distance to liquidation on all positions)
- Funding fees (accumulated)
- Average entry price per position
- Breakeven status (how many positions are risk-free)

### Positions Table (Crypto)

Should show similar structure to Forex positions but with crypto-relevant fields:

| Field | Description |
|-------|-------------|
| Symbol | BTCUSDT, ETHUSDT, etc. |
| Side | LONG / SHORT |
| Entry Price | Average entry price |
| Current Price | Real-time price |
| Size | Notional value |
| Margin Used | Actual $ at risk |
| Leverage | 20x, 40x, etc. |
| Unrealized P&L | $ and % |
| Liquidation Price | Where position gets liquidated |
| Status | "ACTIVE", "BREAKEVEN", "SCALING" |
| Scale Count | How many times bot has scaled in |

---

## 8. System Architecture (Draft)

```
┌─────────────────────────────────────────────────────┐
│                   User (Manual Entry)                │
│              Opens position on Bitget                │
└───────────────────────┬─────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────┐
│              Bitget WebSocket Stream                 │
│        (Real-time position & balance updates)        │
└───────────────────────┬─────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────┐
│              Position Manager Bot                    │
│  • Detects new positions                            │
│  • Monitors P&L in real-time                        │
│  • Triggers scale-in at 100% profit                 │
│  • Places orders via Bitget REST API                │
│  • Updates stop losses                               │
│  • Sends Telegram notifications                      │
└───────────────────────┬─────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────┐
│              Local Database / State                  │
│  • Track position history                           │
│  • Store scale-in events                            │
│  • Log P&L snapshots                                │
│  • Account metrics                                   │
└───────────────────────┬─────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────┐
│              Next.js API Routes                      │
│  • /api/crypto/accounts (GET account data)          │
│  • /api/crypto/positions (GET open positions)       │
│  • /api/crypto/history (GET trade history)          │
└───────────────────────┬─────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────┐
│              Frontend Dashboard                      │
│  • /accounts/crypto/[accountId]                     │
│  • Real-time position display                        │
│  • P&L charts                                        │
│  • Risk metrics                                      │
└─────────────────────────────────────────────────────┘
```

---

## 9. Development Phases (Finalized)

### Phase 1: Data Collection Infrastructure
**Goal**: Get all data sources feeding into system

**Tasks**:
- [ ] Set up CFTC crypto COT scraper (BTC/ETH futures)
  - [ ] Fetch weekly CME Bitcoin futures COT data
  - [ ] Fetch weekly CME Ethereum futures COT data
  - [ ] Store historical data in database
  - [ ] Calculate directional bias (BULLISH/BEARISH/NEUTRAL)
- [ ] Integrate CoinAnk API
  - [ ] Liquidation data endpoint
  - [ ] Funding rates endpoint
  - [ ] Long/Short ratio endpoint
  - [ ] Open interest endpoint
- [ ] Integrate Augmento.ai API
  - [ ] Sentiment scoring for BTC
  - [ ] Sentiment scoring for ETH
  - [ ] Real-time sentiment updates
- [ ] Create data aggregation service (runs continuously)
  - [ ] Poll CoinAnk every 15-60 minutes
  - [ ] Poll Augmento every 1-4 hours
  - [ ] Update COT data weekly (Friday 3:30 PM ET)

**Deliverable**: All data sources operational and storing to database

---

### Phase 2: Entry Signal Engine
**Goal**: Analyze data and generate entry signals

**Tasks**:
- [ ] Build COT bias calculator
  - [ ] Analyze commercial vs non-commercial positioning
  - [ ] Output BULLISH/BEARISH/NEUTRAL per asset
  - [ ] Update weekly with new COT data
- [ ] Build trigger detection system
  - [ ] Define thresholds for each indicator:
    - Liquidation spike threshold (e.g., 2x average)
    - Sentiment extreme threshold (e.g., >80 greed, <20 fear)
    - Funding rate extreme (e.g., >0.1% or <-0.1%)
    - Long/Short ratio skew (e.g., >70% one side)
  - [ ] Monitor all 4 indicators in real-time
  - [ ] Trigger when 2+ indicators align with COT bias
- [ ] Build signal validator
  - [ ] Check if bias exists (skip if NEUTRAL)
  - [ ] Verify indicators align AGAINST current price move
  - [ ] Confirm no existing position on same asset
  - [ ] Validate sufficient account balance

**Deliverable**: Signal engine outputs "ENTER LONG BTC" or "ENTER SHORT ETH" when conditions met

---

### Phase 3: Bitget Trading Bot
**Goal**: Execute and manage positions automatically

**Tasks**:
- [ ] Set up Bitget API client (REST + WebSocket)
  - [ ] Authentication with API credentials
  - [ ] WebSocket connection for real-time updates
  - [ ] Position monitoring
  - [ ] Balance monitoring
- [ ] Implement automated entry execution
  - [ ] Calculate position size (10% of balance)
  - [ ] Set leverage (20x BTC, 40x ETH)
  - [ ] Place market order
  - [ ] Verify order filled
  - [ ] Send Telegram notification
- [ ] Implement position tracking
  - [ ] Monitor unrealized P&L in real-time
  - [ ] Track position state (ACTIVE, BREAKEVEN, SCALING)
  - [ ] Store position data in database
- [ ] Implement scale-in logic (100% profit trigger)
  - [ ] Detect when position reaches +100% profit
  - [ ] Place new position (same direction, same size)
  - [ ] Close 50% of original position
  - [ ] Move stop loss to breakeven
  - [ ] Update position state to BREAKEVEN
  - [ ] Send Telegram notification
- [ ] Implement trailing/repeat logic
  - [ ] Continue monitoring for next +100% profit
  - [ ] Repeat scale-in process
  - [ ] Track scale count per position
- [ ] Add safety controls
  - [ ] Max 1 position per asset at a time
  - [ ] Daily loss limit kill-switch
  - [ ] Order sanity checks (size, leverage, balance)
  - [ ] Duplicate order prevention

**Deliverable**: Fully automated trading bot running 24/7

---

### Phase 4: Backend API & Database
**Goal**: Store and serve crypto trading data to frontend

**Tasks**:
- [ ] Design database schema
  - [ ] `crypto_accounts` table (balance, equity, P&L)
  - [ ] `crypto_positions` table (open positions with all details)
  - [ ] `crypto_trades` table (historical closed positions)
  - [ ] `crypto_cot_data` table (weekly COT snapshots)
  - [ ] `crypto_signals` table (entry signal history)
- [ ] Create API endpoints
  - [ ] `GET /api/crypto/accounts` - list accounts
  - [ ] `GET /api/crypto/accounts/:id` - account details
  - [ ] `GET /api/crypto/positions/:accountId` - open positions
  - [ ] `GET /api/crypto/history/:accountId` - closed trades
  - [ ] `GET /api/crypto/cot` - COT data for BTC/ETH
  - [ ] `GET /api/crypto/signals` - recent entry signals
- [ ] Implement metrics calculations
  - [ ] Daily/weekly P&L
  - [ ] Win rate
  - [ ] Average scale-in count
  - [ ] Total liquidation risk
  - [ ] Funding fees accumulated

**Deliverable**: Backend API serving crypto trading data

---

### Phase 5: Frontend - COT Page (Crypto Section)
**Goal**: Display crypto COT data alongside forex

**Tasks**:
- [ ] Add tab/section to `/cot` page for crypto
- [ ] Display BTC COT data
  - [ ] Commercial positioning (net long/short)
  - [ ] Non-commercial positioning
  - [ ] Calculated bias (BULLISH/BEARISH/NEUTRAL)
  - [ ] Historical chart (positioning over time)
- [ ] Display ETH COT data (same format as BTC)
- [ ] Add bias indicator (color-coded: green=bullish, red=bearish, gray=neutral)
- [ ] Show last update timestamp
- [ ] Responsive design for mobile

**Deliverable**: `/cot` page shows both forex and crypto COT data

---

### Phase 6: Frontend - Crypto Accounts Dashboard
**Goal**: Display Bitget account and positions

**Tasks**:
- [ ] Update `/accounts` page structure
  - [ ] Add "Forex" and "Crypto" tabs/sections
  - [ ] List Bitget accounts in Crypto section
- [ ] Create `/accounts/crypto/[accountId]` page
  - [ ] Display account metrics:
    - Balance, Equity, Daily P&L, Weekly P&L
    - Total risk deployed (% in positions)
    - Average leverage used
    - Liquidation risk distance
  - [ ] Show COT bias for BTC/ETH (pulled from COT data)
  - [ ] Display current entry signals (if any active)
- [ ] Create crypto positions table
  - [ ] Columns: Symbol, Side, Entry, Current, Size, Margin, Leverage, P&L, Liquidation, Status, Scale Count
  - [ ] Color-coded by status (ACTIVE, BREAKEVEN, SCALING)
  - [ ] Real-time P&L updates
  - [ ] Show distance to liquidation (% and $)
- [ ] Add trade history section
  - [ ] List closed trades
  - [ ] Show profit/loss per trade
  - [ ] Display scale-in count and final exit price
- [ ] Responsive design for mobile

**Deliverable**: Complete crypto account dashboard

---

### Phase 7: Testing & Optimization
**Goal**: Validate system end-to-end

**Tasks**:
- [ ] Test data collection (verify all APIs working)
- [ ] Test signal generation (manually verify entry logic)
- [ ] Test position management (scale-ins, breakeven stops)
- [ ] Test safety controls (kill-switches, duplicate prevention)
- [ ] Monitor first week of live trading
- [ ] Tune indicator thresholds based on results
- [ ] Add additional safety rails if needed
- [ ] Optimize Telegram notifications (reduce noise)

**Deliverable**: Production-ready crypto trading system

---

### Phase 8: Monitoring & Maintenance
**Goal**: Keep system running reliably 24/7

**Tasks**:
- [ ] Set up uptime monitoring (alert if bot goes offline)
- [ ] Log all trades and signals for analysis
- [ ] Weekly review of performance
- [ ] Adjust COT bias rules if needed
- [ ] Adjust trigger thresholds based on market conditions
- [ ] Update API integrations if endpoints change

**Deliverable**: Stable, self-sufficient trading system

---

## 10. Outstanding Questions

### Technical Decisions Needed
1. **Execution environment**: Where to run the bot?
   - Option A: Same Node.js server as scraper
   - Option B: Separate Python service
   - Option C: Separate Node.js service

2. **Database**: Extend existing MT5 storage or separate crypto DB?

3. **State management**: How to track position state between restarts?

4. **Multiple accounts**: Support multiple Bitget accounts or single account only?

### API & Credentials
5. Do you have Bitget API credentials ready?
6. Have you enabled futures trading API permissions?
7. Do you need testnet access first or go straight to live?

### Risk & Safety
8. Should we add a "max daily loss" kill-switch?
9. Maximum number of concurrent positions allowed?
10. Any time-based limits (e.g., don't trade on weekends)?

---

## 11. Next Steps

**Awaiting from User**:
1. ✅ **Section 1 context provided** (trade management logic)
2. ⏳ Entry logic / bias data sources (liquidation + sentiment data)
3. ⏳ Bitget API credentials status
4. ⏳ Answers to outstanding questions above

**After receiving all context**:
- Finalize system architecture
- Choose tech stack (Node.js vs Python)
- Design database schema
- Create detailed implementation plan
- Start Phase 1 development

---

## 12. Example Trade Flow (Detailed)

### Scenario: SHORT BTC with scale-ins

**Account**: $100 balance

#### Step 1: Initial Entry (Manual)
```
User opens: SHORT BTCUSDT @ $100,000
Margin: $10 (10% of account)
Leverage: 20x
Notional: $200
Liquidation: ~$105,000
Target: $95,000 (100% profit = $10)

Bot detects position → Sends Telegram notification
```

#### Step 2: First Scale-In (Automated)
```
Price drops to $95,000 → +100% profit ($10)

Bot actions:
1. Opens: SHORT BTCUSDT @ $95,000, $10 margin, $200 notional
2. Closes: 50% of original position @ $95,000
   - Realizes $10 profit (initial capital recovered)
3. Moves SL: Set stop at $100,000 (breakeven on remaining 50%)

Current state:
- Account: $100 (balance restored)
- Position 1: SHORT $100 notional @ $100k, SL @ $100k (breakeven)
- Position 2: SHORT $200 notional @ $95k, SL @ liquidation (~$99.75k)
- Average entry: ~$96.6k
- Total exposure: $300 notional with $10 at risk

Telegram: "🎯 Scaled in! Entry recovered. Now risk-free."
```

#### Step 3: Second Scale-In
```
Price drops to $90,000 → Position 2 shows +100% profit

Bot repeats:
1. Opens: SHORT @ $90k, $10 margin
2. Closes: Partials from Position 2
3. Adjusts stops

Continue pattern...
```

#### Step 4: Stop Out or Exit
```
Scenario A: Price reverses to $100k
- Stopped out at breakeven
- No loss, recovered all risk
- Account still at ~$100

Scenario B: Price continues to $80k
- Multiple scale-ins executed
- Significant profit banked
- Account grows toward $200+
```

---

**Document Status**: Draft v1 - Awaiting entry logic context and API setup details

**Last Updated**: 2026-01-14
