# Limni Scalp Bot + Daily Bias Worklog (as of 2026-01-30)

## Scope status
- Built research/backtest module under `research/scalp_bot/` with CLI, reports, plots, audit charts, and tests.
- Added daily bias tester (COT-only) and published results to `public/scalp-bot/`.
- Integrated summaries + calendar into Automation page.

## What’s implemented
### Backtest engine (scalp bot)
- Entry model: session sweep + displacement; bar-based execution.
- Direction filter: COT + sentiment alignment; sentiment missing policy default “allow.”
- Risk/exec: spread + slippage, conservative intrabar ordering (SL first), one position/pair.
- Outputs: `trade_list.csv`, `summary_report.md`, equity/drawdown/R histogram.
- Sanity checks: in `research/scalp_bot/sanity.py`.

### Daily bias tester (COT-only)
- Modes:
  - single: entry 18:00 ET, exit 16:45 ET
  - hourly: hourly adds 18:00 → 16:00 (23 adds), equal size, exit 16:45 ET
  - weekly: enter Sunday 18:00 ET, exit Friday 16:45 ET
- Uses latest Friday COT for the week.
- Spread/slippage applied on mid prices.
- Outputs per mode:
  - `summary.json`, `summary_report.md`, `daily_bias_trades.csv`
  - Published to `public/scalp-bot/daily_bias_{mode}/`

### UI integration
- `src/app/automation/page.tsx`:
  - Daily bias comparison cards (single/hourly/weekly)
  - Monthly calendar (hourly adds), red/green days, weekends greyed
  - Weekly/monthly tables
  - Pair contribution bars
  - Stage2 baseline + Stage3 best charts still present
- Data loaders in `src/lib/scalpBot.ts` updated to load daily bias by mode.

## Latest daily bias results (2020-01-01 → 2025-12-31, M5)
- Single: Trades 43,066 | Net pips -96,349 | Avg/day -61.68 | Win rate 46.35%
- Hourly: Trades 43,066 | Net pips -76,285 | Avg/day -48.84 | Win rate 44.24%
  - Total entries: 989,930 (avg 22.99 per day)
- Weekly: Trades 8,602 | Net pips -33,966 | Avg/week -108.87 | Win rate 48.40%

Note: Only 28 FX pairs traded (no OHLC found for WTI/XAU/XAG/SPX/NDX/NIKKEI/BTC/ETH).

## Key code paths
- Daily bias engine: `research/scalp_bot/daily_bias.py`
- Scalp bot runner: `research/scalp_bot/run.py`
- Download helper: `research/scalp_bot/download.py`
- COT backfill: `research/scalp_bot/backfill_cot.py`
- Stage 3 grid tools: `research/scalp_bot/grid_small.py`, `research/scalp_bot/run_top_configs.py`
- Automation UI: `src/app/automation/page.tsx`
- Data loader: `src/lib/scalpBot.ts`

## Open items / pending
1) Add OHLC download support for non-FX assets (need instrument codes + API source).
2) Re-run daily bias on majors-only (user requested).
3) Review COT mapping for crosses if needed.
4) Add a “COT-only weekly hold without daily exits” sanity check (optional).

