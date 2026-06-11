# API Surface

This groups active API routes by purpose. See route files under [`src/app/api`](../../src/app/api) for implementation details.

## Performance And Strategy Artifacts

- `/api/performance/strategy-page-data` - strategy page payload.
- `/api/performance/strategy-current-week` - live/current-week strategy slice.
- `/api/performance/strategy-artifacts/status` - artifact readiness/status.
- `/api/performance/strategy-artifacts/warm` - warm one artifact.
- `/api/performance/strategy-artifacts/request-warm` - request artifact warm.
- `/api/performance/strategy-artifacts/request-bulk-warm` - request bulk warm.
- `/api/performance/comparison` - comparison surface data.
- `/api/performance/coverage` - coverage diagnostics.
- `/api/performance/engine-stats` - engine diagnostics.
- `/api/performance/engine-test` - engine test route.
- `/api/performance/gated-setups` - gated setup payload.
- `/api/performance/katarakti/sim` - Katarakti simulation route.
- `/api/performance/report` - performance report route.
- `/api/performance/snapshot` - snapshot route.

## Trade Ledger And Basket Inspection

- `/api/trades/drilldown` - Phase 1 trade drilldown modal data.
- `/api/basket/closed-history` - closed-history bundle for Basket v3 data layer.
- `/api/basket/weeks` - quarantined paginated Basket Phase 2 week summaries.
- `/api/basket/week-pairs` - quarantined paginated Basket Phase 2 pair summaries.

## Dashboard / Data / Market Intelligence

- `/api/dashboard/payload` - dashboard market-intelligence payload.
- `/api/cot/latest` - latest COT data.
- `/api/cot/baskets/latest` - latest COT baskets.
- `/api/cot/refresh` - manual COT refresh.
- `/api/prices/debug` - price diagnostics.
- `/api/prices/refresh` - price refresh.
- `/api/market/liquidation-heatmap` - liquidation heatmap data.
- `/api/matrix/weekly-returns` - weekly return rows for Matrix/ViewMode consumers.

## Flagship / Automation / Bots

- `/api/flagship/*` - flagship board endpoints for ADR trades, asset strength, weekly baskets, COT/crypto/currency matrices, live sizing, overlays, and summaries.
- `/api/bitget-bot/status` - Bitget bot status.
- `/api/solana-meme-bot/summary` - Solana meme bot summary.
- `/api/mt5/*` - MT5 accounts, heartbeat, kill switch, licenses, push, closed positions, and reconcile preview.

## Accounts

- `/api/accounts/payload` - accounts payload.
- `/api/accounts/connect` - account connection.
- `/api/accounts/connected/[accountKey]/*` - connected account reconcile, settings, sizes, and stats.
- `/api/broker-profiles` and `/api/broker-profiles/[id]` - broker profile management.

## Research

- `/api/research/candidates` - research candidates.
- `/api/research/runs` and `/api/research/runs/[id]` - research run management.
- `/api/research/strategies` - research strategy list.

## News And Sentiment

- `/api/news/latest`, `/api/news/payload`, `/api/news/refresh` - news data and refresh.
- `/api/sentiment/latest`, `/api/sentiment/history`, `/api/sentiment/health`, `/api/sentiment/refresh`, `/api/sentiment/myfxbook-debug` - sentiment data and diagnostics.

## Cron / Admin / Auth / System

- `/api/cron/*` - deployed cron endpoints for canonical refresh, COT, prices, performance, strategy artifacts, sentiment, news, and related refresh jobs.
- `/api/admin/*` - cache/admin maintenance routes.
- `/api/auth/session`, `/api/auth/logout` - auth routes.
- `/api/health` - health check.
- `/api/system/mode` - system mode status.
- `/api/db/migrate` - migration route; not used by v1 baseline docs.

Known service issue: production cron execution is paused by Vercel 402 Payment Required. See [known-issues.md](./known-issues.md).
