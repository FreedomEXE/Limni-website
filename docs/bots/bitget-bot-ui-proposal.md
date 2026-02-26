# Bitget Bot v2 -- UI Proposal (DRAFT)

> **Owner:** Freedom_EXE
> **Last updated:** 2026-02-26
> **Status:** Parked. Revisit after bot is live-tested with demo funds.

---

## Location

New detail page at `/automation/bots/bitget`, linked from the existing Bitget card on `/automation/bots`.

Account-level data (equity, balances) stays in the existing **Accounts** section.
Performance section stays clean for the **Universal FX** system.

---

## Page Layout: 5 Tabs

### Tab 1: Live State
- Current weekly bias (direction + tier + COT breakdown)
- Active session ranges (Asia/London, US) with high/low
- Live signals (pending, confirmed, rejected)
- Open positions with real-time scaling progress (current milestone, leverage, PnL)
- Handshake status indicator (BTC + ETH alignment)

### Tab 2: Trade History
- Source: `bitget_bot_trades`
- Filterable by symbol, direction, date range, exit reason
- Columns: entry/exit time, direction, entry/exit price, PnL, milestones hit, max leverage, exit reason
- Expandable row for metadata (OI/funding/liq state at entry)

### Tab 3: Signal Log
- Source: `bitget_bot_signals`
- Shows all detected signals, not just ones that became trades
- Handshake group ID linking BTC + ETH confirmations
- Status: PENDING, CONFIRMED, REJECTED, EXPIRED
- Sweep %, displacement %, session window

### Tab 4: Market Data (Observation Dashboard)
- OI snapshots over time (chart)
- Funding rate history (chart)
- Liquidation cluster heatmap / levels
- Trade entries overlaid on the charts for visual correlation
- This is passive observation -- no decisions are made from this data yet

### Tab 5: Alt Screener (Phase 2 Stub)
- Will show correlation rankings when Variant K goes live
- BTC correlation (7d Pearson), volume, volatility, OI, spread
- Composite scores and tier rankings
- Currently shows placeholder: "Alt expansion is Phase 2. Core system validation in progress."

---

## Design Notes
- Match existing Limni design language (Tailwind CSS 4, dark theme, consistent card/table patterns)
- Reuse existing chart components where possible
- Mobile-responsive but desktop-first (this is a monitoring dashboard)
- Real-time feel via polling or SWR revalidation (not WebSocket)
