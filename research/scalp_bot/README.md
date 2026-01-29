# Limni Scalp Bot (Research Backtest)

## How to run

From repo root:

```bash
python -m research.scalp_bot.run --start 2020-01-01 --end 2025-12-31 --tf M5 --session london --mode contrarian
```

Single-pair smoke test:

```bash
python -m research.scalp_bot.run --start 2024-01-01 --end 2024-12-31 --tf M5 --session london --mode contrarian --pairs EURUSD
```

Optional:

- `--grid` to run parameter grid search and holdout evaluation.
- `--audit-samples 20` to save annotated charts for random trades.
- `--pairs EURUSD,USDJPY` to limit the universe.
- `--publish` to copy summary + plots into `public/scalp-bot` for the website.

## Download OHLCV from OANDA (optional)

If you want to pull M5 data via your existing OANDA key:

```bash
python -m research.scalp_bot.download --start 2020-01-01 --end 2025-12-31 --tf M5
```

Single pair:

```bash
python -m research.scalp_bot.download --start 2024-01-01 --end 2024-12-31 --tf M5 --pairs EURUSD
```

The downloader reads `OANDA_API_KEY` from environment or `.env` and saves to `data/ohlc/{TF}/{PAIR}.csv`.

## Data expectations

OHLCV files are required. Supported search paths:

- `data/ohlc/{TF}/{PAIR}.csv` (recommended)
- `data/ohlc/{TF}/{PAIR}.parquet`
- `data/ohlc/{PAIR}/{TF}.csv`
- `data/ohlc/{PAIR}_{TF}.csv`
- `data/ohlc/{PAIR}/{TF}.parquet`
- `data/ohlc/{PAIR}_{TF}.parquet`
- `data/{PAIR}_{TF}.csv`
- `data/{PAIR}_{TF}.parquet`

CSV/Parquet columns (case-insensitive):

- time (or timestamp/date/datetime)
- open, high, low, close
- volume (optional)

Timestamps are assumed UTC and converted to America/Toronto. Unix seconds/ms/us/ns are detected automatically.

COT and sentiment data are loaded from:

- `data/cot_snapshot.json` or `data/cot_snapshots/*.json`
- `data/sentiment_aggregates.json` or `data/sentiment_snapshots.json`

Pair universe is parsed from `src/lib/cotPairs.ts` to avoid duplication.

## Spread config

Optional per-pair spread overrides can be supplied via `data/spread_config.json`.
See `research/scalp_bot/spread_config.example.json` for a starter template. If `data/spread_config.json` is missing, the runner will also look for `research/scalp_bot/spread_config.json`.

## Outputs

Default output directory: `research/scalp_bot/output`

- `trade_list.csv`
- `summary_report.md`
- `equity_curve.png`
- `drawdown_curve.png`
- `r_histogram.png`
- `audit/*.png`
- `best_params.json` (if `--grid`)
- `holdout_summary.md` (if `--grid`)

## Install

This module uses pandas + matplotlib:

```bash
pip install -r research/scalp_bot/requirements.txt
```
