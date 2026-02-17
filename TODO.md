# TODO

## Performance Deep Analysis UI
- See detailed implementation checklist in `docs/TODO_PERFORMANCE_DEEP_ANALYSIS_UI.md`.
- Integrate weekly deep-analysis stats into Performance view:
  - weekly peak/low/intraweek drawdown (universal)
  - basket/model comparison
  - historical + current-week support

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

## MT5 Weekend Fixes (5ERS execution blockers found on 2026-02-16 UTC)
- Scope:
  - `mt5/Experts/LimniBasketEA.mq5`
  - Runtime evidence from terminal logs:
    - `AppData/Roaming/MetaQuotes/Terminal/14275C4F9441C73E9E6547075C33FE6C/MQL5/Logs/20260215.log`
    - `AppData/Roaming/MetaQuotes/Terminal/94497F60A2BFEA1AFAB110FCF3E331BB/MQL5/Logs/20260215.log`

### 1) Crypto failures are volume-limit failures, not leverage failures
- Evidence:
  - `CTrade::OrderSend ... BTCUSD [limit volume]` and `... ETHUSD [limit volume]` in `20260215.log` (XAUUSD chart terminal hash `14275...`).
  - Rejected order sizes were very large (`BTCUSD ~1.45`, `ETHUSD ~50.9`) versus sizing-audit 5ERS-safe lots (`BTCUSD ~0.13`, `ETHUSD ~4.67`).
  - Broker-provided directional caps (user-confirmed): `BTCUSD max=5 lots`, `ETHUSD max=150 lots`.
- Tasks:
  - Add explicit pre-check logging for symbol-direction volume limits:
    - log `SYMBOL_VOLUME_LIMIT`, current directional open volume, requested volume, and clamped volume.
  - Ensure 5ERS path always uses net-symbol sizing and one order per symbol per pass (no per-model duplicate sends).
  - Add hard guard: if requested volume exceeds broker directional limit, skip with dedicated reason key and cooldown log.
  - Add telemetry fields to push payload for `volume_limit`, `directional_open_volume`, `requested_volume`, `final_volume`.

### 2) 5ERS per-order SL compliance blocks metals (and many other symbols)
- Evidence:
  - Repeated errors on `2026-02-16` in hash `94497...`:
    - `Order blocked XAUUSD LONG vol=0.01 (unable to set compliant SL)`
    - `Order blocked XAGUSD LONG vol=0.01 (unable to set compliant SL)`
  - Same SL-block pattern also appears for FX/indices/crypto in same run, indicating SL calculation/compliance path issue rather than metals-only sizing.
- Tasks:
  - Instrument `CalculateRiskStopLoss` and `EnforceBrokerStopDistance` with reason-rich logs:
    - entry price, bid/ask, stop/freeze levels, min distance, computed distance, final SL, estimated risk USD.
  - Include `g_lastStopLossReason` in the user-facing trade error line for all builds.
  - Prevent impossible BUY SL math for low-priced/tiny-lot CFDs:
    - when computed risk distance exceeds entry price, clamp to smallest positive broker-valid stop instead of hard-failing.
    - if broker min stop distance itself exceeds available buy-price distance, surface explicit reason key.
  - Add fallback branch test coverage for tiny lot + large stop-distance symbols (XAU/XAG CFDs).
  - Verify SL side/distance logic against broker reference price rules at send-time (buy uses bid constraints, sell uses ask constraints).
  - Add runtime switch to temporarily allow reduced risk percent when strict per-order risk cannot satisfy broker min-distance.

### 3) Build/runtime consistency and diagnostics
- Evidence:
  - Current source includes richer SL reason logging, but running logs still show generic `unable to set compliant SL` lines.
- Tasks:
  - Verify deployed `.ex5` matches current source hash before Sunday open.
  - Add `EA build/version` string to startup logs and push payload.
  - Add one-click pre-market validation script:
    - run `LimniSizingAudit` for account
    - run SL dry-run probe for `BTCUSD`, `ETHUSD`, `XAUUSD`, `XAGUSD`
    - fail-fast summary if any symbol is non-compliant.
