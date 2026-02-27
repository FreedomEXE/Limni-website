# Limni Trading Framework

> Proteus system prompt knowledge: the full strategy Proteus must understand.

---

## Philosophy: 5-Layer Conviction Model

1. **Weekly macro bias** (COT + sentiment) — tells us LONG or SHORT
2. **Intraday session structure** (institutional ranges) — tells us WHEN
3. **Price action confirmation** (sweep + rejection + displacement) — tells us WHERE
4. **Correlated asset agreement** (handshake) — confirms conviction
5. **Aggressive scaling into winners** (milestone leverage) — maximizes edge

The system only trades when ALL layers align. This is the edge.

---

## Layer 1: Weekly Bias (COT)

Three inputs vote on direction each week:
- COT dealer positioning (net change)
- COT commercial positioning (net change)
- Sentiment direction (or funding-rate proxy as fallback)

| Votes | Tier | Rule |
|-------|------|------|
| 3 same direction | HIGH | Trade that direction only |
| 2 same direction | MEDIUM | Trade majority direction only |
| Mixed | NEUTRAL | Both directions allowed (wider sweep threshold) |

Bias is frozen at week start (Sunday 00:00 UTC) and does not change mid-week.

**Key finding**: Bias-filtered returns were +84.71% vs unfiltered -46.17% in early testing. The bias IS the edge.

---

## Layer 2: Session Ranges

Two institutional session windows define structure:

| Window | Range Build (UTC) | Entry Sweep Window (UTC) |
|--------|-------------------|--------------------------|
| Asia/London range, NY entry | 00:00-13:00 | 13:00-21:00 (same day) |
| US range, Asia/London entry | 13:00-21:00 | 00:00-13:00 (next day) |

The range is the high and low printed during the range-building session. It locks at session end.

**Dead zone**: 21:00-00:00 UTC (3 hours). No entries. Tested closing this gap — it HURT returns. The gap is a quality filter, not a flaw.

---

## Layer 3: Entry — Sweep + Rejection + Displacement

Three confirmations in sequence on 1-minute candles:

1. **Sweep**: Price breaches the range boundary by >= 0.1% (0.3% for NEUTRAL bias)
2. **Rejection**: Same or next candle closes BACK inside the range
3. **Displacement**: Rejection candle body >= 0.1% in the direction opposite to sweep

A high sweep (price goes above range) + rejection + displacement = SHORT signal.
A low sweep (price goes below range) + rejection + displacement = LONG signal.

Direction must align with weekly bias (unless NEUTRAL tier).

---

## Layer 4: Handshake

Both BTC and ETH must signal in the same session window within 60 minutes.

- If only one signals: no trade (single_symbol)
- If both signal but >60 min apart: no trade (timing_miss)
- If both signal within window: HANDSHAKE CONFIRMED

Entry timestamp = the later of the two confirmations.
Capital allocation: 50/50 margin split between BTC and ETH.

**Impact**: Handshake requirement raised win rate from ~50% (independent) to 87.5%.

---

## Layer 5: Scaling Leverage

Positions start small and scale aggressively as the trade moves in our favor:

| Unlevered Move | Leverage | Stop Action |
|----------------|----------|-------------|
| Entry | 5x | Fixed 10% stop |
| +1.0% | 10x | Keep fixed stop |
| +2.0% | 25x | Move stop to BREAKEVEN |
| +3.0% | 50x | Activate trailing stop (1.5% offset) |
| +4.0% | 50x (capped) | Tighten trailing (1.0% offset) |

**Overnight hold**: Positions are NOT force-closed at session end. Exits are driven by stop/breakeven/trailing/week-close logic only.

**Key finding**: The 10% initial stop was NEVER hit in the 5-week backtest with this configuration.

---

## Backtest Results (Variant C — Production Config)

- **Period**: 5 canonical weeks (Jan 19 - Feb 23, 2026)
- **Return**: +112.54%
- **Win rate**: 87.50% (14/16 trades)
- **Max drawdown**: 6.19%
- **Exit reasons**: 12 trailing stop, 1 breakeven, 3 week-close, 0 stop-loss
- **Milestone hit rates**: +1% (93.75%), +2% (87.50%), +3% (81.25%), +4% (62.50%)

BTC: 8 trades, 87.5% WR, $771.49 net PnL
ETH: 8 trades, 87.5% WR, $353.91 net PnL

---

## What We Tested and Rejected

- **OI/funding as entry gates** (Variants E-J): Dropped returns from 112% to 64%. Too aggressive a filter.
- **Extended session windows** (closing the 3h gap): Baseline A (112%) beat all alternatives.
- **Session gap variants**: B (89%), C (60%), D (59%). The gap protects quality.

**Decision**: OI, funding, and liquidation data are collected passively. Every trade is tagged with market state at entry/exit. We observe for 20+ weeks before considering them as filters.

---

## Future: Alt Expansion (Phase 2)

- BTC+ETH handshake triggers alt gate
- Alts selected by: BTC correlation >= 0.50 over 7 days
- Scored on: correlation (35%), volume (25%), volatility (15%), OI (10%), spread (10%), leverage (3%), funding (2%)
- Max 3 alt positions alongside BTC+ETH, 10% margin each
- Variant K backtest: 114.02% return, 82.86% WR, 35 trades
