# TODO

## COT + Sentiment Expansion (Data-Only First)
- Track full 63‑symbol universe (44 FX + 19 non‑FX) in research only.
- Keep new symbols **data-only** (not tradable) until graduation.
- Graduation rule proposal:
  - 8–12 consecutive weeks of COT + sentiment.
  - No missing data in last 4 weeks.
  - Volatility/spread sanity checks.
- Add gating flag so research can include all 63 without affecting performance/live trading.

## NCAAB Forward-Test Automation (Road-Favorite Context OVR v1, Freshness-Gated)
- Strategy status: promising but **operationally thin**; approved for forward-test only.
- Canonical strategy doc: `sports/ncaab/STRATEGY_ROAD_FAV_OVR_V1.md`
- Backtest script: `sports/ncaab/scripts/backtest_ncaab_road_fav_ovr_v1.py`
- Latest output summary: `sports/ncaab/backtests/ncaab_ovr_v1/summary_road_fav_ovr_v1.md`
- Latest bet log: `sports/ncaab/backtests/ncaab_ovr_v1/bets_road_fav_ovr_v1.csv`

### Locked Entry Rules (do not tune in forward test)
- Bet OVER when all are true:
  - `Book_total > season_avg_total`
  - `edge_points = HM_total - Book_total >= 5.0`
  - `home_favorite == False`
  - `tournament_flag == 0`
  - `snapshot_age_days <= 14.0` (mandatory integrity gate)

### Latest Integrity-Tested Metrics (snapshot)
- Total bets: 22
- Overall ROI: 13.02%
- Post-2021 ROI: 13.02%
- Post-2023 ROI: 9.14%
- Max drawdown: -3.00u
- Snapshot age (mean/median/p95): 7.15 / 6.79 / 13.90 days
- Per-season:
  - 2023: 15 bets, ROI 14.83%
  - 2025: 7 bets, ROI 9.14%
  - 2024: 0 bets (removed by freshness gate)

### Build Tasks (automation + forward test)
- Create daily signal generator script:
  - Input: today’s scheduled games + latest HM snapshot + SBR totals/spreads.
  - Output: `sports/ncaab/live/signals_YYYY-MM-DD.csv`.
  - Include columns: date, teams, HM_total, Book_total, season_avg_total, edge_points, home_spread, snapshot_age_days, qualified.
- Enforce hard pre-tip timing:
  - Freeze and save lines at fixed cutoff (example: 30 minutes before tip) for reproducibility.
  - Store frozen market snapshot in `sports/ncaab/live/market_snapshots/`.
- Add execution-ready picks feed:
  - Write qualified picks to `sports/ncaab/live/picks_YYYY-MM-DD.csv`.
  - Include reason codes for each gate pass/fail.
- Add results reconciler:
  - Grade outcomes after final scores postgame.
  - Append to `sports/ncaab/live/forward_test_log.csv`.
- Add monitoring summary:
  - Rolling KPIs: bet count, win%, ROI, drawdown, CLV proxy (if available), average snapshot age.
  - Weekly markdown report in `sports/ncaab/live/reports/`.
- Add guardrails:
  - If `snapshot_age_days > 14`, no pick.
  - If required inputs missing (HM, spread, total), no pick.
  - If daily qualified bets > risk cap, cap to predefined max and log skipped picks.
- Add simple task runner:
  - `sports/ncaab/scripts/run_forward_test_daily.py` to run fetch -> qualify -> output picks.
- Add validation tests:
  - Unit tests for each gate.
  - Regression test using historical fixtures to confirm no-lookahead and gate behavior.
