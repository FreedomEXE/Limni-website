# Render Migration & Unified Services Plan

## Overview

Migrate all scraping and trading bot infrastructure to Render for:
- ✅ 24/7 uptime (no local machine dependency)
- ✅ Centralized deployment (one place for all services)
- ✅ Easy scaling and monitoring
- ✅ Better reliability than local scraper

---

## Current Architecture (To Be Replaced)

```
Local Machine (scraper/)
  └─ COT scraper (Node.js) → Fetches forex COT data
     └─ Stores to local JSON → Next.js API reads from it
```

**Problems**:
- Requires local machine to be running
- No easy monitoring/restarts
- Limited to what can run locally

---

## New Architecture (Render-Based)

```
Render Services
  │
  ├─ Service 1: Data Collection Service (Node.js)
  │   ├─ Forex COT scraper (existing logic)
  │   ├─ Crypto COT scraper (CFTC CME futures)
  │   ├─ CoinAnk API integration (liquidations, funding, ratios)
  │   ├─ Augmento.ai integration (sentiment)
  │   ├─ Forex sentiment scraper (future expansion)
  │   └─ Stores all data → Database or API endpoints
  │
  ├─ Service 2: Crypto Trading Bot (Node.js)
  │   ├─ Bitget API client (WebSocket + REST)
  │   ├─ Signal engine (COT bias + 2/4 trigger logic)
  │   ├─ Position manager (scale-ins, breakeven stops)
  │   ├─ Telegram notifications
  │   └─ Runs 24/7 monitoring BTC/ETH
  │
  └─ Service 3: MT5 Integration (Optional - if needed)
      └─ Could consolidate MT5 data pushing here too
```

---

## Benefits of Render

### For Data Collection Service
- **Scheduled cron jobs**: Fetch COT data weekly automatically
- **Always-on polling**: CoinAnk/Augmento data updated continuously
- **Webhook support**: Can expose API endpoints for Next.js to fetch from
- **Logging**: Built-in logs for debugging scraper issues

### For Crypto Trading Bot
- **24/7 uptime**: Bot never goes offline
- **WebSocket persistence**: Maintains Bitget connection continuously
- **Easy restarts**: Redeploy without touching local machine
- **Environment variables**: Secure storage of API keys (Bitget, Telegram, etc.)

### For Forex Sentiment (Future)
- **Expandable**: Easy to add more scrapers (Oanda sentiment, etc.)
- **Centralized**: All data collection in one service

---

## Render Service Configuration

### Service 1: Data Collection (`limni-data-service`)

**Type**: Background Worker (or Web Service with cron)

**Tech Stack**: Node.js (TypeScript)

**Environment Variables**:
```
CFTC_API_URL=https://publicreporting.cftc.gov/...
COINANK_API_KEY=xxx
AUGMENTO_API_KEY=xxx
DATABASE_URL=xxx (or use Next.js API endpoints)
```

**Jobs**:
- **Weekly COT scrape** (Friday 3:30 PM ET + retry Saturday morning)
  - Forex COT (existing logic)
  - Crypto COT (BTC/ETH from CME)
- **Hourly CoinAnk poll**
  - Liquidations, funding rates, long/short ratios
- **Every 4 hours Augmento poll**
  - BTC/ETH sentiment scores

**Output**: POST data to Next.js API routes or store in shared database

---

### Service 2: Crypto Trading Bot (`limni-crypto-bot`)

**Type**: Background Worker

**Tech Stack**: Node.js (TypeScript)

**Environment Variables**:
```
BITGET_API_KEY=xxx
BITGET_API_SECRET=xxx
BITGET_API_PASSPHRASE=xxx
TELEGRAM_BOT_TOKEN=xxx
TELEGRAM_CHAT_ID=xxx
DATA_SERVICE_URL=https://limni-data-service.onrender.com
NEXTJS_API_URL=https://limni-website.vercel.app/api
```

**Responsibilities**:
- Fetch COT bias from data service or Next.js API
- Monitor CoinAnk/Augmento data for entry triggers
- Execute Bitget trades automatically
- Manage positions (scale-ins, breakeven stops)
- Send Telegram notifications
- Push position data back to Next.js API

**Uptime**: Continuous (24/7)

---

## Migration Strategy

### Phase 1: Move Existing Scraper to Render
**Goal**: Get current forex COT scraper running on Render

**Tasks**:
- [ ] Create new Render service (`limni-data-service`)
- [ ] Copy existing scraper code to new repo/folder
- [ ] Update to POST data to Next.js API instead of local JSON
- [ ] Set up environment variables on Render
- [ ] Configure cron schedule (Friday 3:30 PM ET)
- [ ] Test weekly COT fetch
- [ ] Deprecate local `scraper/` folder once working

**Deliverable**: Forex COT data automatically updates via Render

---

### Phase 2: Add Crypto COT to Data Service
**Goal**: Expand data service to include crypto COT

**Tasks**:
- [ ] Add CFTC crypto COT scraper to same service
- [ ] Fetch CME Bitcoin futures COT data
- [ ] Fetch CME Ethereum futures COT data
- [ ] Calculate BULLISH/BEARISH/NEUTRAL bias
- [ ] POST to `/api/crypto/cot` endpoint on Next.js
- [ ] Store historical data

**Deliverable**: Crypto COT data available via API

---

### Phase 3: Add CoinAnk Integration
**Goal**: Real-time crypto market data

**Tasks**:
- [ ] Integrate CoinAnk API
- [ ] Poll every 15-60 minutes for:
  - Liquidation heatmaps
  - Funding rates
  - Long/Short ratios
  - Open interest
- [ ] Store latest snapshots
- [ ] Expose via API endpoint (`/api/crypto/market-data`)

**Deliverable**: Live crypto market sentiment data

---

### Phase 4: Add Augmento.ai Integration
**Goal**: Sentiment scoring for BTC/ETH

**Tasks**:
- [ ] Integrate Augmento.ai API
- [ ] Poll every 1-4 hours
- [ ] Store sentiment scores (fear/greed scale)
- [ ] Expose via API endpoint

**Deliverable**: Sentiment data available for signal engine

---

### Phase 5: Build Crypto Trading Bot
**Goal**: Automated Bitget trading

**Tasks**:
- [ ] Create new Render service (`limni-crypto-bot`)
- [ ] Implement Bitget API client (WebSocket + REST)
- [ ] Build signal engine (fetch COT bias + check triggers)
- [ ] Implement entry execution logic
- [ ] Implement position management (scale-ins)
- [ ] Add Telegram notifications
- [ ] Deploy to Render as background worker

**Deliverable**: Fully automated crypto bot running 24/7

---

### Phase 6: Frontend Integration
**Goal**: Display crypto data in Next.js app

**Tasks**:
- [ ] Create API routes to serve data from Render services
- [ ] Update `/cot` page to show crypto COT data
- [ ] Create `/accounts/crypto` section
- [ ] Display positions, P&L, signals
- [ ] Real-time updates from Render bot

**Deliverable**: Complete crypto dashboard

---

## Render Service Structure (Proposed)

```
limni-services/ (new repo or folder in existing repo)
  │
  ├─ data-service/
  │   ├─ src/
  │   │   ├─ scrapers/
  │   │   │   ├─ forexCOT.ts (existing scraper logic)
  │   │   │   ├─ cryptoCOT.ts (new)
  │   │   │   ├─ coinank.ts (new)
  │   │   │   └─ augmento.ts (new)
  │   │   ├─ scheduler.ts (cron jobs)
  │   │   └─ index.ts (entry point)
  │   ├─ package.json
  │   └─ render.yaml (Render config)
  │
  ├─ crypto-bot/
  │   ├─ src/
  │   │   ├─ bitget/
  │   │   │   ├─ client.ts (API wrapper)
  │   │   │   ├─ websocket.ts (real-time updates)
  │   │   │   └─ orders.ts (order placement)
  │   │   ├─ signals/
  │   │   │   ├─ bias.ts (fetch COT bias)
  │   │   │   ├─ triggers.ts (2/4 indicator logic)
  │   │   │   └─ validator.ts (safety checks)
  │   │   ├─ positions/
  │   │   │   ├─ manager.ts (position tracking)
  │   │   │   ├─ scaleIn.ts (100% profit logic)
  │   │   │   └─ breakeven.ts (stop adjustment)
  │   │   ├─ notifications/
  │   │   │   └─ telegram.ts
  │   │   └─ index.ts (entry point)
  │   ├─ package.json
  │   └─ render.yaml
  │
  └─ shared/ (optional - shared types/utilities)
      └─ types.ts
```

---

## Cost Estimate (Render)

### Free Tier (Starter)
- ✅ 750 hours/month (enough for one service)
- ✅ Services spin down after 15 min inactivity
- ❌ Not ideal for 24/7 trading bot (latency on wakeup)

### Starter Plan ($7/month per service)
- ✅ Always-on (no spin down)
- ✅ 512 MB RAM, 0.5 CPU
- ✅ Perfect for data service + crypto bot

**Estimated Monthly Cost**:
- Data Service: $7/month
- Crypto Bot: $7/month
- **Total: $14/month** (for 24/7 automated crypto trading)

---

## Advantages Over Local Scraper

| Feature | Local Scraper | Render Services |
|---------|---------------|-----------------|
| Uptime | Requires PC on | 24/7 always-on |
| Monitoring | Manual checking | Built-in logs + alerts |
| Scaling | Limited by PC | Easy to add services |
| Restarts | Manual | Auto-restart on crash |
| Deployment | Git pull + restart | Push to deploy |
| Security | Local API keys | Environment variables |
| Webhooks | Requires ngrok/tunneling | Native HTTPS endpoints |

---

## Next Steps

1. **Decision**: Approve Render migration approach
2. **Set up Render account** (if not already done)
3. **Start with Phase 1**: Move existing forex COT scraper to Render
4. **Test thoroughly**: Ensure data still flows to Next.js correctly
5. **Expand gradually**: Add crypto services one phase at a time

---

## Forex Sentiment Expansion (Future)

Once Render infrastructure is in place, we can easily add:

**Additional Data Sources**:
- Oanda client sentiment (positioning data)
- Myfxbook community sentiment
- Forex Factory sentiment indicators
- DailyFX sentiment scores
- Social media sentiment (Twitter/Reddit for forex)

**Integration**:
- Add new scraper modules to `data-service`
- Store alongside COT data
- Display on enhanced `/cot` page with multiple sentiment indicators

**Use Case**:
- Combine COT + retail sentiment for even stronger contrarian signals
- "Smart money long + retail short = strong bullish signal"

---

**Document Status**: Draft v1 - Ready for implementation once approved

**Last Updated**: 2026-01-14
