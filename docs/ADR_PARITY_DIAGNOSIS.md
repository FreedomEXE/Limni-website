/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/

# ADR System Parity Diagnosis — Indicator vs Scanner

> **Date**: 2026-03-26
> **Status**: Diagnosis complete. Fix pending.
> **Compared**: 23 pairs, full week of 2026-03-22

## Executive Summary

The PineScript indicator and the Limni Matrix scanner produce different trade counts on 9 of 23 pairs (39% mismatch rate). The indicator found 47 total trades; the scanner found 45. Two root causes identified: H1 vs 5M bar resolution, and Oanda API vs TradingView data source differences.

## Full Comparison Results

| Pair | Indicator | Scanner | Match | Entry Offset | Notes |
|------|-----------|---------|-------|-------------|-------|
| AUDJPY | 2 trades | 3 trades | MISMATCH | ~10 pip | Scanner extra trade |
| AUDNZD | 1 trade | 1 trade | MATCH | ~5 pip | |
| AUDUSD | 3 trades | 3 trades | MATCH | ~3 pip | |
| CADCHF | 1 trade | 1 trade | MATCH | ~1 pip | |
| CADJPY | 1 trade | 1 trade | MATCH | ~0.3 pip | Near-perfect |
| CHFJPY | 2 trades | 2 trades | MATCH | ~10 pip | Offset flipped direction |
| EURAUD | 3 trades | 3 trades | MATCH | ~40 pip | Compounds per re-entry |
| EURCHF | 2 trades | 2 trades | MATCH | ~2 pip | |
| EURJPY | 2 trades | 1 trade | MISMATCH | ~10 pip | Indicator extra |
| EURNZD | 2 trades | 1 trade | MISMATCH | ~10 pip | Indicator extra |
| GBPAUD | 4 trades | 3 trades | MISMATCH | ~30 pip | Indicator ahead by 1 |
| GBPCHF | 3 trades | 1 trade | **MAJOR** | ~7 pip | Indicator 3x scanner |
| GBPNZD | 3 trades | 3 trades | MATCH | ~11 pip | |
| JPN225 | 1 trade | 3 trades | **MAJOR** | ~200 pts | Scanner 3x indicator |
| NDX100 | 1 trade | 1 trade | MATCH | ~34 pts | |
| NZDCAD | 2 trades | 1 trade | MISMATCH | ~2 pip | Indicator extra |
| NZDCHF | 2 trades | 1 trade | MISMATCH | ~1 pip | Indicator extra |
| NZDJPY | 2 trades | 2 trades | MATCH | ~4 pip | |
| NZDUSD | 2 trades | 1 trade | MISMATCH | ~2 pip | Indicator extra |
| SPX500 | 3 trades | 3 trades | MATCH | ~8 pts | Constant offset (ADR diff) |
| USDCHF | 3 trades | 3 trades | MATCH | ~1.4 pip | Near-perfect |
| USDJPY | 1 trade | 1 trade | MATCH | ~14 pip | |
| XAUUSD | 1 trade | 1 trade | MATCH | ~$19 | Largest absolute offset |

**Match rate**: 14/23 (61%)
**Indicator total trades**: ~47 | **Scanner total trades**: 45

## Root Causes

### Issue 1: H1 vs 5M Resolution (6 of 9 mismatches)

The scanner runs on H1 bars from the Oanda API. The indicator runs on 5M bars (via `request.security("5")`). After a Fresh Start reset (TP hit → anchor resets → new trade cycle), the 5M indicator catches brief price dips/spikes that trigger re-entries. H1 bars aggregate these into a single candle, missing the trigger entirely.

**Affected pairs**: EURJPY, EURNZD, GBPAUD, NZDCAD, NZDCHF, NZDUSD (all "indicator extra")

**Fix**: Switch scanner to M5 bars (`fetchOanda5MinuteSeries`). Previously attempted but caused Gold ghost trades due to same-bar TP cascading. The same-bar TP fix is already in place, so M5 should work now.

### Issue 2: Data Source Discrepancy (all pairs, critical on 3)

TradingView's Oanda data feed and the Oanda REST API return slightly different prices for the same instrument at the same time. This causes:
- Different anchor values (running high/low)
- Different ADR calculations (from canonical DB daily bars vs TradingView daily bars)
- Entry/TP levels that are offset by 0.3 to 200+ pips depending on the pair

**Worst affected**: JPN225 (~200 pts offset, scanner has 3x more trades), GBPCHF (~7 pip offset but 3x trade count difference), XAUUSD ($19 offset)

**Fix**: This cannot be fully resolved without using the exact same data source. Options:
1. Accept small offsets (most forex pairs are <10 pips, immaterial to trade outcomes)
2. Switch scanner ADR to Oanda API daily bars (already tested, didn't change results)
3. Add tolerance bands to entry/TP detection (allow ±N pips)
4. Future: use TradingView data export as scanner input (requires TradingView API access)

### Issue 3: Anchor Compounding (affects multi-re-entry pairs)

After each Fresh Start reset, the new anchor seeds from a different bar (H1 vs 5M). This small initial difference compounds with each re-entry cycle:
- EURAUD: 5 pip offset on trade #1 → 40 pip offset on trade #3
- GBPAUD: 10 pip offset on trade #1 → 30 pip offset on trade #3

This is a consequence of Issue 1 + Issue 2 interacting.

## Proposed Fix Strategy

### Phase 1: Switch scanner to M5 (immediate)
- Change `fetchOandaCandleSeries` (H1) to `fetchOanda5MinuteSeries` (M5)
- Same-bar TP removal is already in place
- Re-run comparison to verify improvement
- **Expected impact**: Resolves 6 of 9 trade count mismatches

### Phase 2: ADR alignment (with Codex)
- Compute scanner ADR from Oanda M5 bars aggregated to daily ranges
- This uses the same data source for both ADR and trade detection
- **Expected impact**: Reduces price offsets

### Phase 3: Tolerance bands (future consideration)
- Add ±0.5 ADR% tolerance to entry detection
- Would absorb small data source differences
- Requires backtesting to ensure it doesn't degrade signal quality

### Phase 4: Confirmation filter (separate research track)
- See `docs/ADR_CONFIRMATION_RESEARCH.md` for Stoch RSI / BOS experiments
- A slower confirmation signal would naturally align both systems
- Separate from parity — this is a strategy enhancement

## Key Insight

The indicator is the source of truth. Its trades are visually validated by Freedom on the TradingView chart. The scanner's job is to reproduce the indicator's results as closely as possible. Perfect parity may not be achievable due to data source differences, but M5 resolution + same-bar TP removal should get us to 90%+ match rate.

---

*Diagnosed by Nyx. Validated by Freedom via pair-by-pair comparison.*
