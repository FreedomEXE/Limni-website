# Limni Platform Knowledge

> Everything Proteus needs to know about Limni Labs beyond the Bitget bot.

---

## What Limni IS

Limni is a multi-asset trading intelligence platform built by Freedom. It spans FX, indices, crypto, and commodities. The name comes from the Greek word for "lake" (limni), fitting the water/sea deity theme of the AI system.

Limni is NOT just a trading bot. It's an institutional-grade research, signal generation, and execution framework with:
- 6 major application pages
- 50+ API routes
- 10+ automated cron jobs
- 2 active trading bots (Bitget crypto, OANDA forex)
- 5 sentiment data providers
- MT5 EA integration layer
- Performance backtesting lab
- Research engine
- 20+ database tables

---

## Core Systems

### 1. Antikythera Signal Engine (The Brain)

Named after the ancient Greek astronomical calculator. This is Limni's flagship multi-model signal aggregation system.

How it works:
- Combines COT bias (dealer positioning + commercial positioning) with retail sentiment data
- Generates LONG/SHORT signals ONLY when models agree
- Confidence scoring based on agreement count
- Tracks signal flips across weeks
- Historical performance overlay per pair

Available at `/antikythera`. This is the intelligence layer - bots are just execution.

### 2. COT Bias Framework

Source: CFTC weekly reports (Traders in Financial Futures).
- Dealer net positioning (dealers hedge retail, so net short = bullish retail)
- Commercial net positioning
- Blended = dealer * 0.6 + commercial * 0.4
- Combined with sentiment for 3-vote directional system

Coverage: BTC, ETH, FX (7 majors + crosses), indices (SPX, NDX, NIKKEI), commodities (XAU, XAG, WTI).

Dashboard at `/dashboard` - heatmap view of all asset classes with pair-level signals.

### 3. Sentiment Aggregation Engine

5 providers scraped/polled every hour:
- **IG**: Official API, retail positioning
- **OANDA**: Public sentiment page
- **Myfxbook**: Community positioning (detailed volume/position counts)
- **TradingView**: External scraper service
- **ForexClientSentiment**: Public aggregator

Detects: CROWDED_LONG, CROWDED_SHORT, NEUTRAL, FLIPPED_UP, FLIPPED_DOWN.
Dashboard at `/sentiment` - heatmap with provider health monitoring.
Also includes crypto-specific data: Bitget funding rates, OI, liquidation maps from CoinAnk.

### 4. Performance Lab

Full backtesting infrastructure at `/performance`.
- Simulates weekly basket performance across multiple models (Antikythera, Dealer-only, Commercial-only, Sentiment-only, Blended)
- All-time cumulative performance tracking
- Pair-level breakdowns
- Universal vs Tiered basket comparison
- Historical week replay

### 5. Research Lab

Custom backtesting at `/automation/research/lab`.
- Configurable entry/exit rules
- Custom symbol universes
- Adaptive trailing profiles
- Run caching (config hash deduplication)
- Bank participation analysis at `/automation/research/bank`

### 6. News Calendar

ForexFactory macro events at `/news`.
- Weekly snapshots scraped every 15 minutes
- High-impact event filtering
- Currency exposure tracking

---

## Trading Bots

### Bitget Bot v2 (Crypto Perps)
- BTC/USDT and ETH/USDT perpetual futures on Bitget
- 5-layer conviction model (COT bias + session structure + sweep/displacement + handshake + scaling)
- Dashboard at `/automation/bots/bitget`
- Runs as Vercel cron (every minute)
- Currently in demo/dry-run mode
- Full details in TRADING_FRAMEWORK.md and BOT_OPERATIONS.md

### OANDA Universal Bot (Forex)
- FX basket automation based on COT signals
- Deployed as Render worker
- Trailing profit logic + margin buffer management
- Connected accounts at `/accounts/connected/[accountKey]`

### MT5 EA Integration
- Client-side Expert Advisors push positions to Limni
- COT signals distributed to EAs via `/api/mt5/source`
- License system for distributable EX5 builds
- Legacy but still active

---

## Account Management

### Accounts Directory (`/accounts`)
- Unified view of all trading accounts (MT5 + connected brokers)
- Total equity aggregation
- Quick connect flow for new accounts

### Connected Accounts (`/accounts/connected/[accountKey]`)
- Server-managed OANDA and Bitget accounts
- Position reconciliation with live broker state
- Risk mode configuration (1:1, 1:2, 1:3)
- Trail configuration (start/offset percentages)
- Manual execution sheets + sizing calculator

---

## Infrastructure

| Service | Platform | Purpose |
|---------|----------|---------|
| Web App | Vercel | Next.js frontend + API routes + cron |
| Database | Render Postgres | All data persistence |
| Bitget Bot Worker | Render (alt) | Alternative to Vercel cron |
| OANDA Bot Worker | Render | Forex bot execution |
| Poseidon | Render (planned) | This bot (Telegram AI) |

### Automated Cron Jobs
- COT refresh: hourly + aggressive Friday polling
- Sentiment refresh: hourly
- Price refresh: hourly
- News refresh: every 15 min
- Performance refresh: hourly
- Market snapshots (funding, OI, liquidations): hourly
- Bitget bot tick: every minute

### System Status
Available at `/status` - cron health, data freshness, infrastructure monitoring.

---

## Other Freedom Projects (Context Only)

- **CKS Portal**: Trading portal (separate project)
- **Freedom TrenchBot**: Solana meme token monitoring bot (Python, Telegram) - integrated into Limni at `/automation/solana-meme-bot`
- **VibeSwap**: DEX project with Will - where Jarvis (the inspiration for this system) lives

---

## Key Numbers to Know

- Backtest return (Variant C): +112.54% over 5 weeks
- Win rate: 87.5% (14/16 trades)
- Max drawdown: 6.19%
- Handshake impact: raised win rate from ~50% to 87.5%
- Bias filter impact: +84.71% (with bias) vs -46.17% (without)
- Session gap test: baseline (with 3h gap) beat all alternatives
