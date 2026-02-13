# Strategy Definition: Road-Favorite Context OVR v1

## Hypothesis

When the market posts a high total (above season baseline), and HM still projects meaningful additional points, overs are strongest in matchups where the away side is favored.

## Data

- HM projection source: `TD_ratings.xml_wayback_snapshot_formula` via Wayback snapshots.
- Book source: SBR consensus proxy lines.
- Total line: median consensus `Book_total`.
- Favorite context: consensus `home_spread` sign from SBR (`home_favorite == False` means away favored or pick).
- Grading: full-game total including OT.
- No-lookahead: only snapshots with timestamp `<=` game tip time are allowed.

## Entry Rules (OVR only)

Bet OVER if all are true:

1. `Book_total > season_avg_total`
2. `edge_points = HM_total - Book_total >= 5.0`
3. `home_favorite == False`
4. `tournament_flag == 0` (regular season only)

## Current Backtest Output

- Script: `sports/ncaab/scripts/backtest_ncaab_road_fav_ovr_v1.py`
- Bets file: `sports/ncaab/backtests/ncaab_ovr_v1/bets_road_fav_ovr_v1.csv`
- Summary: `sports/ncaab/backtests/ncaab_ovr_v1/summary_road_fav_ovr_v1.md`
