# Project Backlog

Status: backlog inventory. Verify against repo evidence, current session state,
and active process docs before treating any entry as current work.

## ADR Grid + Weekly Hold Research Queue
- Latest research memo:
  - `docs/research/ADR_GRID_RUNNER_COST_RESEARCH_2026-06-02.md`
  - `docs/research/WEEKLY_HOLD_ADR_EXIT_RESEARCH_2026-06-02.md`
- Current ADR Grid conclusion:
  - Current app close/rearm remains best among tested no-cost and cost-sensitivity variants.
  - Runner/refill, half-runner trailing, and whole-fill trailing did not beat current app on capped Tandem by return, path DD, return/DD, or path Sharpe.
- Completed ADR Grid follow-up:
  - Tested true **seeded current-app ADR Grid**: initial execution/week-open grid trade with existing full close/rearm behavior.
  - Result, app-aligned 19-week window: did not beat capped Tandem current app baseline (`+632.67%`, `6.26%` DD, `10.05` Sharpe). Seeded current app returned `+631.08%`, raised DD to `8.72%`, and slightly lowered Sharpe to `10.02`.
  - Cost-adjusted note: seed can improve path Sharpe under moderate simulated costs, but still lowers return, so keep it as research-only for now.
- Completed Weekly Hold exit test:
  - Tested baseline Weekly Hold, full close at `+1x ADR`, and trailing after `+1x ADR` with `0.20`, `0.40`, and `1.00 ADR` trail distances.
  - Best first-pass result was `Trail after +1x, 0.40 ADR`.
  - Tandem improved from `+214.05%` return / `31.50%` DD / `1.67` Sharpe to `+311.44%` return / `24.89%` DD / `2.32` Sharpe.
  - Tiered improved from `+91.99%` return / `15.57%` DD / `2.42` Sharpe to `+99.97%` return / `9.63%` DD / `3.69` Sharpe.
  - Agreement improved from `+53.66%` return / `29.18%` DD / `1.07` Sharpe to `+68.59%` return / `15.81%` DD / `1.73` Sharpe.
  - Selector improved from `+19.65%` return / `53.99%` DD / `0.33` Sharpe to `+45.12%` return / `39.03%` DD / `0.83` Sharpe.
  - Weekly win-rate snapshot for `Trail after +1x, 0.40 ADR`: Tandem `57.9%`, Tiered `84.2%`, Agreement `63.2%`, Selector `57.9%`.
- Weekly Hold app candidate naming:
  - Working app label: `Weekly Hold + Trailing Stop`.
  - Exact rule copy: `Trail after +1x ADR, 0.40 ADR`.
  - Proposed internal id: `weekly_hold_trail_1x_adr_040`.
  - Keep this visibly separate from baseline Weekly Hold if it graduates into v2.0.3 or later.
- Active indicator work:
  - Revamp `scripts/pinescript/limni-adr-verifier.pine` ADR Grid mode to match the current app close-and-rearm model.
  - Show level activation count with colored grid lines, capped visually at `3+` for Pair Fill Cap.
  - Use aggregate red DD, green realized-TP, and light-green favorable-excursion boxes.
  - Use compact entry markers at fill levels and TP markers at the actual fill TP price; avoid partial-close or runner visuals.
  - Resume EURUSD ADR Grid 3-week parity after the visual/source-of-truth cleanup: Market Truth Raw, Market Truth ADR Normalized, Execution Raw, Execution ADR Normalized.
- Next single test:
  - Run Weekly Hold `Trail after +1x, 0.40 ADR` cost sensitivity and FX-only / asset-class split.
  - If it holds up, evaluate a hybrid where Weekly Hold offsets commission drag from smaller ADR Grid trades while ADR Grid harvests intraday movement.

## Weekly Hold Close Buffer / Broker-Safe Liquidation
- Add a future research + automation pass for weekly-hold exit timing.
- Current app research uses market/session close windows:
  - FX market-truth weekly window closes around Friday 5pm ET.
  - Indices/commodities use their configured market windows, but broker-specific early closes can differ.
  - Execution anchor opens Monday 00:00 UTC, while close still follows the market window.
- Risk:
  - A live weekly-hold bot should never depend on exact market close liquidity or assume all brokers keep every symbol tradable until the nominal close.
  - Indices and commodities can have earlier Friday closes, holidays, half days, or broker-specific session gaps.
- Proposed future upgrade:
  - Introduce a configurable liquidation buffer, e.g. Friday 4:30pm ET for FX by default, with per-asset/per-broker overrides.
  - Use the same close-buffer policy in app research, TradingView verifier, and automation when apples-to-apples automation validation begins.
  - Preserve current historical market-close results as the baseline research track unless/until the buffered close materially changes results.
- Priority:
  - Not blocking current Weekly Hold indicator sanity check.
  - Important before live weekly-hold automation; less likely to matter for ADR Grid because grid exits are intraday/trigger-driven.

## Database Storage Management / Retention
- Add a future database retention and compaction pass before strategy history expands materially beyond the current 19-week window.
- Current risk:
  - Render Postgres hit the storage ceiling during data-verification work, causing connection termination and failed index writes.
  - Strategy week shards, historical path artifacts, verification exports, and backtest ledger rows can grow faster than normal app data.
- Proposed future upgrade:
  - Add a DB storage report script covering table size, index size, dead tuples, oldest artifact versions, and per-engine row counts.
  - Define retention rules for superseded `strategy_week_shards` engine versions and old verification-only ledger rows.
  - Archive large immutable artifacts to release JSON/object storage instead of keeping every historical recalculation in Postgres.
  - Add small-batch cleanup and `VACUUM/REINDEX` guidance for Render so cleanup does not trigger another out-of-space failure.
  - Track monthly storage growth after each closed week and alert before 80-90% capacity.
- Priority:
  - Not blocking current TradingView parity once Render is available again.
  - Important before adding more weeks, more symbols, or more strategy artifact variants.

## Positioning Risk Gate + HTF Structure Re-Evaluation
- Spec doc:
  - `docs/bots/positioning-risk-gate-htf-structure-spec.md`
- Immediate focus:
  - activate liquidation advisory as enforced crypto pre-flight gate (paper mode first)
  - require all liquidation timeframes (`6h`, `1d`, `7d`, `30d`) in gate decision
  - pilot HTF structure overlay (`W1`, `D1`, `H4`) to avoid entries at extremes

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

## FX Hedged Weekly Candidate Tracking
- Candidate registry saved for app integration:
  - `data/research_strategy_candidates.json`
- Candidate seed/update script:
  - `scripts/register-hedged-fx-candidate.ts`
- Backtest/sweep script:
  - `scripts/eightcap-3k-hedged-fx-weekly-sweep.ts`
- Latest report artifacts:
  - `reports/eightcap-3k-hedged-fx-weekly-sweep-latest.json`
  - `reports/eightcap-3k-hedged-fx-weekly-sweep-latest.md`
- API endpoint to consume candidates in app:
  - `GET /api/research/candidates` (`src/app/api/research/candidates/route.ts`)
- Current shortlisted side-retrace focus (Wednesday):
  - `side_retrace-d3-t2-r50`
  - `side_retrace-d3-t3-r40`
- COT-gated extension now tracked:
  - `cot_non_aligned_profit_close-d2-t7`
  - rule: close profitable non-COT-aligned legs at checkpoint; hold remaining basket to Friday.
- Staged daily COT-gated extension now tracked:
  - `cot_non_aligned_profit_close_staged-d2-t3`
  - rule: repeat non-COT-aligned profitable-leg closure on Tue/Wed/Thu checkpoints; close remainder Friday.
- Next extension hypothesis:
  - add COT-informed regime/direction gating on top of hedged weekly logic.

## Weekly Bias Selector Candidate
- Production-candidate handoff saved:
  - `docs/bots/WEEKLY_BIAS_SELECTOR_SENTIMENT_OVERRIDE_HANDOFF_2026-03-29.md`
- Canonical backtest protocol:
  - `docs/BACKTEST_CANONICAL_PROTOCOL.md`
- Repo agent note:
  - `AGENTS.md`
- Research scripts:
  - `scripts/backtest-weekly-bias-context-selector.ts`
  - `scripts/compare-weekly-bias-selector-vs-app-baselines.ts`
- Latest reports:
  - `reports/weekly-bias-context/weekly-bias-context-selector-latest.json`
  - `reports/weekly-bias-context/weekly-bias-vs-app-baselines-latest.json`
- Current candidate:
  - `selector_sentiment_context_override`
- Current canonical comparison snapshot:
  - `selector_sentiment_context_override`: `+134.29%`, max DD `-4.71%`
  - `tiered_v3`: `+137.21%`, max DD `-22.89%`
- Next step:
  - integrate as a site-visible weekly strategy for visual backtest verification before any flagship promotion.

## Universal Breakout Overlay (Phase 1)
- Backtest script:
  - `scripts/universal-breakout-overlay-phase1.ts`
- Latest report artifacts:
  - `reports/universal-breakout-overlay-phase1-latest.json`
  - `reports/universal-breakout-overlay-phase1-latest.md`
  - `reports/universal-breakout-overlay-phase1-touch0-latest.json`
  - `reports/universal-breakout-overlay-phase1-close0-latest.json`
  - `reports/universal-breakout-overlay-phase1-basis-compare-latest.json`
  - `reports/universal-breakout-overlay-phase1-targets-touch0-latest.json`
  - `reports/universal-breakout-overlay-phase1-targets-close0-latest.json`
- Phase-1 variants tracked:
  - `v1_antikythera`, `v2_antikythera`, `v3_antikythera`
  - `v1_tier1`, `v2_tier1`, `v3_tier1`
  - `triplet_antikythera`, `triplet_tier1`
- Current first-pass trigger:
  - prior-week high/low breakout filter (`touch`, 0% buffer)
  - if no breakout this week, skip trade (for breakout variant)
- Next expansion:
  - extend week coverage (beyond currently available canonical snapshot window),
  - test `close` basis and non-zero breakout buffers.

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
