# Dealer vs Commercial Quality Backtest Notes

**Date:** 2026-02-20 UTC  
**Status:** Saved for revisit  
**Primary report:** `reports/dealer-commercial-quality-backtest-latest.json`

## What changed

- Historical quality backtest crypto pricing was switched from Bitget to OANDA in `scripts/backtest-dealer-commercial-quality.ts`.
- Run windows:
1. Smoke: `--lookbackDays=60` -> quality pass `68/72`, strict weeks `7/9` (dealer/commercial).
2. Full: `--lookbackDays=370` -> diagnostics `424`, quality pass `408`, strict weeks `48/53`.

## Portfolio-level snapshot (53 weeks, strict quality)

### Dealer
- Total return: `+139.65%`
- Win rate: `62.50%`
- Trailing drawdown: `148.71%`
- Static drawdown: `83.27%`

### Commercial
- Total return: `+51.96%`
- Win rate: `47.92%`
- Trailing drawdown: `110.60%`
- Static drawdown: `32.87%`

## Asset class breakdown (strict quality rows only)

### Dealer
- `commodities`: return `+129.51%`, win rate `62.00%`, trailing DD `25.55%`
- `crypto`: return `+33.35%`, win rate `50.98%`, trailing DD `170.46%`
- `fx`: return `-12.27%`, win rate `41.51%`, trailing DD `76.76%`
- `indices`: return `-15.60%`, win rate `40.00%`, trailing DD `24.50%`

### Commercial
- `crypto`: return `+107.76%`, win rate `58.82%`, trailing DD `80.48%`
- `indices`: return `+38.36%`, win rate `66.00%`, trailing DD `15.76%`
- `fx`: return `+17.39%`, win rate `54.72%`, trailing DD `35.54%`
- `commodities`: return `-129.51%`, win rate `36.00%`, trailing DD `148.70%`

## Data quality by sleeve

- `fx`: `106/106` pass (`100.00%`)
- `indices`: `100/106` pass (`94.34%`) -> timing fails `6`
- `commodities`: `100/106` pass (`94.34%`) -> timing fails `6`
- `crypto`: `102/106` pass (`96.23%`) -> coverage fails `2`, timing fails `2`

## Investor read (working view)

- Dealer alpha is concentrated in commodities, with crypto adding return but also major path risk.
- Commercial behaves like a barbell: strong crypto + indices, with commodities as the major drag.
- The return opportunity is visible, but current risk shape is likely too aggressive for allocator-grade capital without sleeve-level risk controls.

## Open questions to revisit

1. **FX regime mismatch:** 53-week aggregate FX underperformed for dealer, while recent 5-week observations were strong. Need regime and window-decomposition analysis.
2. **Sentiment sleeve:** Suspected missing piece; evaluate dealer/commercial plus sentiment integration.
3. **Drawdown math audit:** Drawdown outputs appear potentially overstated or method-sensitive; verify implementation before using for external capital decisions.

## Files to reference

- `reports/dealer-commercial-quality-backtest-latest.json`
- `reports/dealer-commercial-quality-backtest-2026-02-20_235931.json`
- `scripts/backtest-dealer-commercial-quality.ts`
