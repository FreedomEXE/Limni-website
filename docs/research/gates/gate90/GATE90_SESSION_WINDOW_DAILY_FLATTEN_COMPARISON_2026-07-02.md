# Gate 90 Session Window Daily Flatten Comparison

Generated: `2026-07-02`

## Verdict

`PASS_GATE90_SESSION_WINDOW_DAILY_FLATTEN_COMPARISON_RESEARCH_ONLY_NO_PROMOTION`

## Scope

- Warehouse-only Gate 90 execution research.
- Session mode: `ny_daily_window`.
- Clean activity window: New York `18:05` to `15:45`.
- Daily flatten: New York `16:00`.
- Sunday start: New York `20:00`.
- Saturday and Friday evening reopen are blocked.
- Target closes are still allowed whenever a tick exists.
- Starts/adds are blocked outside the clean window.
- Remaining cycles are closed as `session_flatten` at the daily boundary, at a missed no-tick boundary, or at the selected endpoint cleanup mark.
- Commission and generic swap remain modeled.
- Explicit bid/ask spread and slippage are still not modeled.

## Key Read

The daily window does what it is supposed to do operationally: it removes terminal inventory, cuts max open exposure, and collapses swap into a small residual. It also exposes the tradeoff clearly: a large part of the continuous-run profit was unresolved inventory being carried, and daily flattening realizes those losers instead of letting them wait for mean reversion.

This is directionally the right protection layer, but it is not a free upgrade. It turns the system from "carry inventory until rescued" into "pay the daily loss if rescue does not happen before rollover." That is healthier for live-readiness, but the strategy now has to earn enough intraday edge to survive spread and slippage.

## Focused Comparison

| Cell | Rule | Continuous net | Continuous entries | Continuous max open | Continuous terminal positions | Session net | Session entries | Session max open | Session terminal positions | Session flatten price PnL | Session swap |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| ADR0.025 MA25 | raw_both | 3105.52 | 9420 | 185 | 112 | 1234.83 | 9283 | 80 | 0 | -1395.09 | -33.97 |
| ADR0.05 MA25 | david_contra | 1664.13 | 4077 | 102 | 89 | 552.10 | 4025 | 73 | 0 | -905.30 | -27.84 |
| ADR0.075 MA25 | david_contra | 1528.62 | 3297 | 120 | 82 | 512.71 | 3396 | 89 | 0 | -875.57 | -29.33 |
| ADR0.10 MA50 | david_contra | 1422.93 | 2078 | 113 | 77 | 540.88 | 2317 | 93 | 0 | -804.93 | -35.89 |

## Session Window Ranking

| Cell | Rule | Net | Entries | Max open | Session flattens | Flattened positions | Session flatten price PnL | Total swap |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| ADR0.025 MA25 | raw_both | 1234.83 | 9283 | 80 | 390 | 999 | -1395.09 | -33.97 |
| ADR0.05 MA25 | raw_both | 827.02 | 7690 | 105 | 519 | 1352 | -1830.57 | -48.04 |
| ADR0.025 MA25 | david_contra | 667.18 | 5314 | 56 | 205 | 526 | -770.07 | -21.30 |
| ADR0.05 MA25 | david_contra | 552.10 | 4025 | 73 | 275 | 697 | -905.30 | -27.84 |
| ADR0.10 MA50 | david_contra | 540.88 | 2317 | 93 | 298 | 873 | -804.93 | -35.89 |
| ADR0.025 MA25 | candidate_b | 522.58 | 4632 | 47 | 206 | 522 | -723.32 | -16.59 |
| ADR0.075 MA25 | david_contra | 512.71 | 3396 | 89 | 298 | 796 | -875.57 | -29.33 |
| ADR0.075 MA25 | raw_both | 508.28 | 6543 | 114 | 560 | 1581 | -2144.58 | -56.36 |
| ADR0.025 MA25 | stoch_contra | 497.80 | 3835 | 42 | 137 | 364 | -480.52 | -17.34 |
| ADR0.025 MA25 | david_stoch_confirm | 401.32 | 3355 | 39 | 126 | 332 | -443.54 | -15.03 |

## Opinion

Daily flattening is worth keeping as the next research branch because it directly addresses rollover spread, swap, and unbounded carried inventory. It makes the backtest less flattering, but more honest.

I would not rely on Candidate B or COT to rescue bad pair directions yet. In this focused window test, Candidate B did not beat `david_contra` on the main cells. It can stay as a later regime or bias layer, but the primary problem is still execution-window survivability and cost tolerance.

The slippage risk now becomes central. `ADR0.025 MA25` still ranks best, but its trade count is high enough that it may disappear after realistic spread/slippage. The more interesting live-shaped candidates are `ADR0.05 MA25 david_contra` and `ADR0.10 MA50 david_contra`: lower frequency, no terminal inventory, positive after commission/swap, but still untested against explicit spread and slippage.

## Artifacts

- Combined summary CSV: `docs/research/gates/gate90/artifacts/session-window-5w-ohlc-s020-exp010-rsi50-stoch6040-summary.csv`
- Combined summary JSON: `docs/research/gates/gate90/artifacts/session-window-5w-ohlc-s020-exp010-rsi50-stoch6040-summary.json`
- ADR0.025 MA25 report: `docs/research/gates/gate90/GATE90_SESSION_WINDOW_5W_OHLC_ADR0025_MA25_S020_EXP010_RSI506040_STOCH100_3_100_6040_2026-07-02.md`
- ADR0.05 MA25 report: `docs/research/gates/gate90/GATE90_SESSION_WINDOW_5W_OHLC_ADR005_MA25_S020_EXP010_RSI506040_STOCH100_3_100_6040_2026-07-02.md`
- ADR0.075 MA25 report: `docs/research/gates/gate90/GATE90_SESSION_WINDOW_5W_OHLC_ADR0075_MA25_S020_EXP010_RSI506040_STOCH100_3_100_6040_2026-07-02.md`
- ADR0.10 MA50 report: `docs/research/gates/gate90/GATE90_SESSION_WINDOW_5W_OHLC_ADR010_MA50_S020_EXP010_RSI506040_STOCH100_3_100_6040_2026-07-02.md`

## Stop Line

Gate 90 remains research-only. Do not promote, open MT5/live work, tune margin/stopout, or redesign broad COT/Candidate B regimes from this run.
