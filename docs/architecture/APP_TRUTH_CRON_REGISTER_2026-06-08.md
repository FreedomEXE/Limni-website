# App Truth Cron Register - 2026-06-08

This register ties every scheduled Vercel cron to a current architecture reason.

Status after the SchedulerRunLedger / MaterializationRunLedger gate:

- Static cron classification remains useful for schedule ownership.
- Durable receipt tables now exist: `app_truth_scheduler_run_ledger` and `app_truth_materialization_run_ledger`.
- `/status` reads and displays recent scheduler/materialization receipts.
- The main materialization producers now emit receipts: canonical refresh, performance refresh, strategy artifacts, and ADR trade scan.
- The source-freeze cron route and build script now emit receipts for current/frozen source-ledger materialization.
- `app-truth:certify-active-baseline` and `/api/cron/active-baseline-certification` audit the active baseline and write certification receipts only when existing source-freeze, weekly-return, and strategy-shard rows satisfy the manifest.
- Data and Performance route shells now consume active-baseline receipt readiness before rendering their trusted route payloads.
- Full lifecycle/domain promotion is still not complete; DomainManifest and selected trade-row ledger identity remain future gates.

## Scheduled

| Cron | Schedule | Why it stays |
| --- | --- | --- |
| `/api/cron/cot-refresh` | `0 * * * *`, `*/10 19-23 * * 5`, `*/10 19-23 * * 1` | Keeps dealer/commercial/sentiment source snapshots fresh for Data, Performance, and source-freeze evidence. |
| `/api/cron/prices-refresh` | `5 * * * *` | Keeps current market snapshots fresh for Data/live overlay context. |
| `/api/cron/sentiment-refresh` | `10 * * * *` | Keeps active sentiment aggregates fresh for Data and current-week signal context. |
| `/api/cron/source-freeze` | `15 21 * * 5`, `15 22 * * 5` | Builds the next display week's frozen source ledger after Friday 5pm New York; double UTC schedule handles DST and the route skips before cutoff. |
| `/api/cron/news-refresh` | `*/15 * * * *` | Keeps news/calendar context fresh for News/Dashboard surfaces. |
| `/api/cron/performance-refresh` | `20 * * * *` | Transitional: still feeds Accounts/comparison/secondary utilities through `performance_snapshots`; not selected Performance truth. |
| `/api/cron/strategy-artifacts` | `40 * * * *` | Keeps visible Performance strategy week shards ready until formal materialization ledgers exist. |
| `/api/cron/active-baseline-certification` | `55 * * * *` | Writes active-baseline certification receipts after source-freeze, price-return, and strategy-shard materializers are ready. |
| `/api/cron/market-snapshots` | `0 * * * *` | Preserved crypto/custom-strategy data lane: funding, open interest, liquidation, and heatmap snapshots. |
| `/api/cron/currency-strength` | `2 * * * *` | Maintains FX strength snapshots for Data/flagship/current strategy context. |
| `/api/cron/asset-strength` | `3 * * * *` | Maintains crypto, commodity, and index strength snapshots for Data/flagship/future strategies. |
| `/api/cron/bitget-bot` | `* * * * *` | Feature-flagged automation tick; returns IDLE unless `BITGET_BOT_ENABLED=true`. |
| `/api/cron/adr-trade-scan` | `25 * * * *` | Scans current-week ADR rows consumed by ADR/flagship/weekly-hold paths. |
| `/api/cron/canonical-refresh?includeHourly=1` | `30 * * * *` | Refreshes canonical bars and closed weekly return materialization, including crypto price data. |

## Removed From Vercel Schedule

| Cron | Former schedule | Why it is manual only |
| --- | --- | --- |
| `/api/cron/menthorq-overlay-import` | `15 * * * *` | Imports local browser-captured CSV rows. Vercel does not produce that CSV, so scheduling it risks stale/no-data imports. Keep the route as an authorized manual import hook. |
| `/api/cron/adr-trade-backfill` | `0 0 1 1 *` | One-shot historical repair endpoint. It should only run after an explicit repair/backfill decision, not on an annual timer. |

## Implemented Receipt Gate

Static schedule reasoning is now backed by the first durable run receipt contract:

- `SchedulerRunLedger`: route, schedule, start/end, status, errors, source versions.
- `MaterializationRunLedger`: rows touched, week window, namespace/version, hash/evidence.
- Status continues showing both scheduled and manual-only cron entries alongside recent receipt rows.

Receipt-producing routes in this gate:

- `/api/cron/canonical-refresh?includeHourly=1`
- `/api/cron/performance-refresh`
- `/api/cron/strategy-artifacts`
- `/api/cron/adr-trade-scan`
- `/api/cron/source-freeze`
- `/api/cron/active-baseline-certification`
- `scripts/build-friday-freeze-source-ledger.ts`

## Receipt-Backed Lifecycle Gate

Status now distinguishes:

- legacy evidence ready: trusted source-freeze ledger rows plus Performance kernel coverage
- receipt-backed closed ready: source-freeze receipt plus Data materialization receipt plus Performance materialization receipt

This prevents a recovery evidence window from becoming implicit architecture. Existing recovery evidence can be visible while still showing that old rows are not fully receipt-backed under the new lifecycle contract.

## Active Baseline Certification Gate

The active institutional seed baseline has now been certified through the generic active-baseline audit path:

- Command: `npm run app-truth:certify-active-baseline -- --json`
- Source-freeze ledger: `15/15`
- Canonical + execution weekly returns: `1080/1080`
- Visible strategy week shards: `180/180`
- Evidence: `releases/v2/screenshots/weekly-rollover-active-baseline-2026-06-09/`

The certification command is intentionally baseline-driven rather than recovery-window-specific. A future source/engine system should update the active baseline/materialized rows, then rerun certification and browser evidence without new architecture work if the same contracts still apply.

## Route Readiness Gate

`/dashboard` and `/performance` now read `readActiveBaselineRouteReadiness()` before loading their heavier route payloads.

The route gate requires:

- Data: `source_freeze_ledger` and `canonical_price_and_weekly_returns` receipts for every active baseline week.
- Performance: Data requirements plus `strategy_week_shards` receipts for every active baseline week.

Current verification:

- Baseline: `v2.0.3-institutional-seed`
- `/status`: Active Baseline READY, Weekly Lifecycle READY, scheduled source-freeze and active-baseline-certification visible
- `/dashboard`: `15/15` closed weeks ready, Jun 08 current/live week selectable with freeze ledger ready
- `/performance`: `15/15` closed weeks ready, Jun 08 current/live week selectable through the current-week API
- Evidence: `releases/v2/screenshots/weekly-rollover-active-baseline-2026-06-09/`

## Selected Basket Ledger Gate

The active Performance Basket path now consumes the selected runtime trade-row bundle instead of silently falling back to closed-history canon/API state.

Current verification:

- Route: `/performance?view=basket&strategy=tandem&f1=adr_grid&f2=pair_fill_cap`
- Basket source: `selected-trade-rows`
- Selected trade-row count: `13111`
- `/api/basket/closed-history` requests: `0`
- Evidence: `releases/v2/screenshots/selected-trade-row-ledger-2026-06-09/`

## Next Gate

Use the durable receipts inside selected Performance truth:

- selected ExecutionLedger identity
- selected TradeRowLedger identity
- Summary/Basket/export/drilldown/parity all reading the same selected rows
- keep live-refresh failures separate from frozen closed-week readiness
