# NCAAB Research Workspace

This folder contains NCAA basketball research, backtests, and raw source artifacts.

## Layout

- `sports/ncaab/scripts/`: backtest and utility scripts.
- `sports/ncaab/backtests/ncaab_ovr_v1/`: generated bet logs, summaries, plots, and caches.
- `sports/ncaab/research/haslametrics/`: Haslametrics source snapshots and notes.
- `sports/ncaab/research/sbr/`: SBR HTML snapshots and temporary captures.

## Main Commands

- Run baseline season-gated OVR with home-favorite filter:
  - `python sports/ncaab/scripts/backtest_ncaab_season_baseline_ovr.py`
- Run road-favorite-context OVR v1:
  - `python sports/ncaab/scripts/backtest_ncaab_road_fav_ovr_v1.py`
- Join OLG export to proxy bet file:
  - `python sports/ncaab/scripts/join_olg_export.py --bets sports/ncaab/backtests/ncaab_ovr_v1/bets.csv --olg <path-to-olg-csv>`
